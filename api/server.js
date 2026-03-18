// ═══════════════════════════════════════════════════════════════
// OMAN SME ERP — Production API Server
// Stack: Express + PostgreSQL + JWT + bcrypt
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── DATABASE ───────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.set('trust proxy', 1);

// CORS — must come BEFORE helmet
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, health checks)
    if (!origin) return callback(null, true);
    // Allow any localhost during development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    // Allow configured origins
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) return callback(null, true);
    // Allow any .vercel.app domain (for preview deploys)
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight explicitly
app.options('*', cors());

// Helmet — configured to not block cross-origin requests
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
function auth(requiredRoles) {
  return async (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'No token provided' });
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await pool.query(
        'SELECT u.*, c.name_en as company_name FROM users u JOIN companies c ON u.company_id = c.id WHERE u.id = $1 AND u.is_active = true',
        [decoded.userId]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'User not found' });
      
      req.user = rows[0];
      
      if (requiredRoles && !requiredRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// ─── AUDIT HELPER ───────────────────────────────────────────
async function audit(companyId, userId, action, entityType, entityId, details, ip) {
  await pool.query(
    'INSERT INTO audit_log (company_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [companyId, userId, action, entityType, entityId, JSON.stringify(details), ip]
  );
}

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ userId: user.id, companyId: user.company_id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    await audit(user.company_id, user.id, 'login', 'user', user.id, {}, req.ip);
    
    res.json({ token, user: { id: user.id, email: user.email, name_en: user.name_en, name_ar: user.name_ar, role: user.role, lang: user.lang, company_id: user.company_id } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name_en, name_ar, company_name_ar, company_name_en, cr_number, tax_id } = req.body;
    
    // Create company
    const companyId = uuidv4();
    await pool.query(
      'INSERT INTO companies (id, name_ar, name_en, cr_number, tax_id) VALUES ($1,$2,$3,$4,$5)',
      [companyId, company_name_ar, company_name_en, cr_number, tax_id]
    );
    
    // Create owner user
    const hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (id, company_id, email, password_hash, name_en, name_ar, role) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userId, companyId, email, hash, name_en, name_ar, 'owner']
    );
    
    const token = jwt.sign({ userId, companyId, role: 'owner' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: { id: userId, email, name_en, role: 'owner', company_id: companyId } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email or company already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', auth(), (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, name_en: req.user.name_en, name_ar: req.user.name_ar, role: req.user.role, lang: req.user.lang, company_id: req.user.company_id, company_name: req.user.company_name } });
});

// ═══════════════════════════════════════════════════════════════
// EMPLOYEES CRUD
// ═══════════════════════════════════════════════════════════════
app.get('/api/employees', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM employees WHERE company_id = $1 AND status = $2 ORDER BY name_en', [req.user.company_id, req.query.status || 'active']);
  res.json(rows);
});

app.post('/api/employees', auth(['owner','admin','hr']), async (req, res) => {
  const b = req.body;
  const id = uuidv4();
  const spf = b.nationality === 'Omani' ? 'SPF-' + Date.now().toString().slice(-6) : null;
  const { rows } = await pool.query(
    `INSERT INTO employees (id, company_id, name_ar, name_en, nationality, department, role_title_en, basic_salary, allowances, email, phone, bank_name, iban, join_date, spf_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [id, req.user.company_id, b.name_ar, b.name_en, b.nationality, b.department, b.role_title_en, b.basic_salary, b.allowances||0, b.email, b.phone, b.bank_name, b.iban, b.join_date||new Date(), spf]
  );
  await audit(req.user.company_id, req.user.id, 'create', 'employee', id, { name: b.name_en }, req.ip);
  res.status(201).json(rows[0]);
});

app.put('/api/employees/:id', auth(['owner','admin','hr']), async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    `UPDATE employees SET name_ar=$1, name_en=$2, nationality=$3, department=$4, role_title_en=$5, basic_salary=$6, allowances=$7, email=$8, phone=$9, bank_name=$10, iban=$11
     WHERE id=$12 AND company_id=$13 RETURNING *`,
    [b.name_ar, b.name_en, b.nationality, b.department, b.role_title_en, b.basic_salary, b.allowances, b.email, b.phone, b.bank_name, b.iban, req.params.id, req.user.company_id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  await audit(req.user.company_id, req.user.id, 'update', 'employee', req.params.id, b, req.ip);
  res.json(rows[0]);
});

app.delete('/api/employees/:id', auth(['owner','admin','hr']), async (req, res) => {
  await pool.query("UPDATE employees SET status='terminated', termination_date=CURRENT_DATE WHERE id=$1 AND company_id=$2", [req.params.id, req.user.company_id]);
  await audit(req.user.company_id, req.user.id, 'delete', 'employee', req.params.id, {}, req.ip);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// INVOICES CRUD
// ═══════════════════════════════════════════════════════════════
app.get('/api/invoices', auth(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.*, json_agg(json_build_object('id',ii.id,'description_en',ii.description_en,'description_ar',ii.description_ar,'quantity',ii.quantity,'unit_price',ii.unit_price,'line_total',ii.line_total)) as items
     FROM invoices i LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
     WHERE i.company_id = $1 GROUP BY i.id ORDER BY i.issue_date DESC`,
    [req.user.company_id]
  );
  res.json(rows);
});

app.post('/api/invoices', auth(['owner','admin','accountant']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body;
    const id = uuidv4();
    
    // Generate sequential invoice number
    const { rows: seqRows } = await client.query(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1 as next_num FROM invoices WHERE company_id = $1",
      [req.user.company_id]
    );
    const invNum = 'INV-' + new Date().getFullYear() + '-' + String(seqRows[0].next_num).padStart(4, '0');
    
    await client.query(
      `INSERT INTO invoices (id, company_id, invoice_number, client_name_ar, client_name_en, client_tax_id, issue_date, due_date, currency, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, req.user.company_id, invNum, b.client_name_ar, b.client_name_en, b.client_tax_id, b.issue_date||new Date(), b.due_date, b.currency||'OMR', 'pending', b.notes, req.user.id]
    );
    
    // Insert line items
    for (const item of (b.items || [])) {
      await client.query(
        'INSERT INTO invoice_items (invoice_id, description_ar, description_en, quantity, unit_price, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, item.description_ar, item.description_en, item.quantity, item.unit_price, item.sort_order||0]
      );
    }
    
    await client.query('COMMIT');
    await audit(req.user.company_id, req.user.id, 'create', 'invoice', id, { number: invNum }, req.ip);
    
    // Return full invoice
    const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create invoice' });
  } finally {
    client.release();
  }
});

app.patch('/api/invoices/:id/status', auth(['owner','admin','accountant']), async (req, res) => {
  const { status } = req.body;
  const paidDate = status === 'paid' ? new Date() : null;
  const { rows } = await pool.query(
    'UPDATE invoices SET status=$1, paid_date=$2 WHERE id=$3 AND company_id=$4 RETURNING *',
    [status, paidDate, req.params.id, req.user.company_id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  await audit(req.user.company_id, req.user.id, 'update', 'invoice', req.params.id, { status }, req.ip);
  res.json(rows[0]);
});

app.delete('/api/invoices/:id', auth(['owner','admin']), async (req, res) => {
  await pool.query('DELETE FROM invoices WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
  await audit(req.user.company_id, req.user.id, 'delete', 'invoice', req.params.id, {}, req.ip);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// EXPENSES CRUD
// ═══════════════════════════════════════════════════════════════
app.get('/api/expenses', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM expenses WHERE company_id = $1 ORDER BY expense_date DESC', [req.user.company_id]);
  res.json(rows);
});

app.post('/api/expenses', auth(['owner','admin','accountant']), async (req, res) => {
  const b = req.body;
  const id = uuidv4();
  const { rows } = await pool.query(
    'INSERT INTO expenses (id, company_id, description_en, description_ar, amount, category, vendor, expense_date, vat_included, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
    [id, req.user.company_id, b.description_en, b.description_ar, b.amount, b.category, b.vendor, b.expense_date||new Date(), b.vat_included||false, req.user.id]
  );
  await audit(req.user.company_id, req.user.id, 'create', 'expense', id, { amount: b.amount }, req.ip);
  res.status(201).json(rows[0]);
});

app.delete('/api/expenses/:id', auth(['owner','admin','accountant']), async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// PAYROLL
// ═══════════════════════════════════════════════════════════════
app.post('/api/payroll/run', auth(['owner','admin','accountant']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { month, year } = req.body;
    const runId = uuidv4();
    
    await client.query('INSERT INTO payroll_runs (id, company_id, period_month, period_year) VALUES ($1,$2,$3,$4)', [runId, req.user.company_id, month, year]);
    
    const { rows: emps } = await client.query("SELECT * FROM employees WHERE company_id = $1 AND status = 'active'", [req.user.company_id]);
    
    let totals = { basic: 0, allow: 0, gross: 0, spfEe: 0, spfEr: 0, net: 0 };
    for (const emp of emps) {
      const basic = parseFloat(emp.basic_salary);
      const allow = parseFloat(emp.allowances);
      const gross = basic + allow;
      const spfEe = emp.is_omani ? basic * 0.07 : 0;
      const spfEr = emp.is_omani ? basic * 0.1175 : 0;
      const net = gross - spfEe;
      
      await client.query(
        'INSERT INTO payroll_items (payroll_run_id, employee_id, basic_salary, allowances, gross, spf_employee, spf_employer, net_pay) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [runId, emp.id, basic, allow, gross, spfEe, spfEr, net]
      );
      totals.basic += basic; totals.allow += allow; totals.gross += gross;
      totals.spfEe += spfEe; totals.spfEr += spfEr; totals.net += net;
    }
    
    await client.query(
      'UPDATE payroll_runs SET total_basic=$1, total_allowances=$2, total_gross=$3, total_spf_employee=$4, total_spf_employer=$5, total_net=$6 WHERE id=$7',
      [totals.basic, totals.allow, totals.gross, totals.spfEe, totals.spfEr, totals.net, runId]
    );
    
    await client.query('COMMIT');
    await audit(req.user.company_id, req.user.id, 'create', 'payroll', runId, { month, year }, req.ip);
    res.status(201).json({ id: runId, ...totals, employee_count: emps.length });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Payroll already exists for this period' });
    res.status(500).json({ error: 'Failed to run payroll' });
  } finally {
    client.release();
  }
});

app.get('/api/payroll/:runId', auth(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT pi.*, e.name_en, e.name_ar, e.department, e.role_title_en, e.nationality, e.bank_name, e.iban
     FROM payroll_items pi JOIN employees e ON pi.employee_id = e.id
     WHERE pi.payroll_run_id = $1`, [req.params.runId]
  );
  res.json(rows);
});

// ═══════════════════════════════════════════════════════════════
// VAT & SPF
// ═══════════════════════════════════════════════════════════════
app.get('/api/vat/summary', auth(), async (req, res) => {
  const cid = req.user.company_id;
  const { rows: invRows } = await pool.query('SELECT COALESCE(SUM(vat_amount),0) as output_vat FROM invoices WHERE company_id=$1', [cid]);
  const { rows: expRows } = await pool.query('SELECT COALESCE(SUM(vat_amount),0) as input_vat FROM expenses WHERE company_id=$1 AND vat_included=true', [cid]);
  const output = parseFloat(invRows[0].output_vat);
  const input = parseFloat(expRows[0].input_vat);
  res.json({ output_vat: output, input_vat: input, net_vat: output - input });
});

app.post('/api/vat/returns', auth(['owner','admin','accountant']), async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    'INSERT INTO vat_returns (company_id, period, taxable_sales, output_vat, input_vat, net_payable, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.user.company_id, b.period, b.taxable_sales, b.output_vat, b.input_vat, b.net_payable, 'submitted']
  );
  res.status(201).json(rows[0]);
});

app.get('/api/spf/summary', auth(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as eligible_count, SUM(basic_salary) as total_salary,
     SUM(basic_salary * 0.1175) as employer_total, SUM(basic_salary * 0.07) as employee_total,
     SUM(basic_salary * 0.0525) as govt_total
     FROM employees WHERE company_id=$1 AND status='active' AND is_omani=true`,
    [req.user.company_id]
  );
  res.json(rows[0]);
});

app.get('/api/omanization', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM v_omanization WHERE company_id=$1', [req.user.company_id]);
  res.json(rows);
});

// ═══════════════════════════════════════════════════════════════
// REPORTS & DASHBOARD
// ═══════════════════════════════════════════════════════════════
app.get('/api/dashboard', auth(), async (req, res) => {
  const cid = req.user.company_id;
  const [rev, emps, exps, invCount] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(total),0) as revenue FROM invoices WHERE company_id=$1 AND status='paid'", [cid]),
    pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE is_omani) as omani FROM employees WHERE company_id=$1 AND status='active'", [cid]),
    pool.query('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE company_id=$1', [cid]),
    pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER(WHERE status='pending') as pending, COUNT(*) FILTER(WHERE status='overdue') as overdue FROM invoices WHERE company_id=$1", [cid]),
  ]);
  res.json({
    revenue: parseFloat(rev.rows[0].revenue),
    employees: { total: parseInt(emps.rows[0].total), omani: parseInt(emps.rows[0].omani) },
    expenses: parseFloat(exps.rows[0].total),
    invoices: invCount.rows[0],
  });
});

app.get('/api/reports/pnl', auth(), async (req, res) => {
  const cid = req.user.company_id;
  const [rev, payroll, spf, exps] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(subtotal),0) as income FROM invoices WHERE company_id=$1 AND status='paid'", [cid]),
    pool.query("SELECT COALESCE(SUM(basic_salary+allowances),0) as total FROM employees WHERE company_id=$1 AND status='active'", [cid]),
    pool.query("SELECT COALESCE(SUM(basic_salary*0.1175),0) as total FROM employees WHERE company_id=$1 AND status='active' AND is_omani=true", [cid]),
    pool.query('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE company_id=$1', [cid]),
  ]);
  const income = parseFloat(rev.rows[0].income);
  const costs = parseFloat(payroll.rows[0].total) + parseFloat(spf.rows[0].total) + parseFloat(exps.rows[0].total);
  res.json({ income, payroll: parseFloat(payroll.rows[0].total), spf: parseFloat(spf.rows[0].total), expenses: parseFloat(exps.rows[0].total), costs, profit: income - costs });
});

// ─── COMPANY SETTINGS ───────────────────────────────────────
app.get('/api/company', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]);
  res.json(rows[0]);
});

app.put('/api/company', auth(['owner','admin']), async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(
    'UPDATE companies SET name_ar=$1, name_en=$2, cr_number=$3, tax_id=$4, address=$5, city=$6, phone=$7, email=$8 WHERE id=$9 RETURNING *',
    [b.name_ar, b.name_en, b.cr_number, b.tax_id, b.address, b.city, b.phone, b.email, req.user.company_id]
  );
  res.json(rows[0]);
});

// ─── NOTIFICATIONS ──────────────────────────────────────────
app.get('/api/notifications', auth(), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND company_id = $2 ORDER BY created_at DESC LIMIT 20',
    [req.user.id, req.user.company_id]
  );
  res.json(rows);
});

app.patch('/api/notifications/read', auth(), async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND company_id = $2', [req.user.id, req.user.company_id]);
  res.json({ success: true });
});

// ─── HEALTH CHECK ───────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy' });
  }
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERP API] Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: Origin not allowed. Set FRONTEND_URL env var.' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ─── START SERVER ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[ERP API] Running on port ${PORT}`);
  console.log(`[ERP API] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[ERP API] CORS origins: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`[ERP API] Database: ${process.env.DATABASE_URL ? 'configured' : 'NOT SET'}`);
});

module.exports = app;
