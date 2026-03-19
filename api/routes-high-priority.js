// ═══════════════════════════════════════════════════════════════
// HIGH-PRIORITY ROUTES — require and call registerHighPriorityRoutes(app, pool, auth, audit, isUUID, uuidv4)
// ═══════════════════════════════════════════════════════════════

module.exports = function registerHighPriorityRoutes(app, pool, auth, audit, isUUID, uuidv4) {

// ─── CHART OF ACCOUNTS ──────────────────────────────────────
app.get('/api/accounts', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM accounts WHERE company_id=$1 AND is_active=true ORDER BY code', [req.user.company_id]);
    res.json(rows);
  } catch (err) { res.json([]); }
});

app.post('/api/accounts', auth(['owner','admin','accountant']), async (req, res) => {
  try {
    const b = req.body; const id = uuidv4();
    const { rows } = await pool.query(
      'INSERT INTO accounts (id,company_id,code,name_en,name_ar,account_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [id, req.user.company_id, b.code, b.name_en, b.name_ar||'', b.account_type||'expense']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Account code exists' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/accounts/:id', auth(['owner','admin','accountant']), async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const b = req.body;
    const { rows } = await pool.query(
      'UPDATE accounts SET code=$1,name_en=$2,name_ar=$3,account_type=$4 WHERE id=$5 AND company_id=$6 RETURNING *',
      [b.code, b.name_en, b.name_ar||'', b.account_type, req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── JOURNAL ENTRIES ────────────────────────────────────────
app.get('/api/journals', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT je.*, json_agg(json_build_object('id',jl.id,'account_id',jl.account_id,'description',jl.description,'debit',jl.debit,'credit',jl.credit) ORDER BY jl.sort_order) as lines
       FROM journal_entries je LEFT JOIN journal_lines jl ON je.id=jl.journal_entry_id
       WHERE je.company_id=$1 GROUP BY je.id ORDER BY je.entry_date DESC, je.entry_number DESC`,
      [req.user.company_id]
    );
    res.json(rows.map(r => { r.lines = (r.lines||[]).filter(l => l.id !== null); return r; }));
  } catch (err) { res.json([]); }
});

app.post('/api/journals', auth(['owner','admin','accountant']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body; const id = uuidv4();
    const { rows: seq } = await client.query(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM '[0-9]+$') AS INTEGER)),0)+1 as n FROM journal_entries WHERE company_id=$1",
      [req.user.company_id]
    );
    const num = 'JE-' + new Date().getFullYear() + '-' + String(seq[0].n).padStart(4,'0');
    await client.query(
      'INSERT INTO journal_entries (id,company_id,entry_number,entry_date,description,reference,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, req.user.company_id, num, b.entry_date||new Date(), b.description||'', b.reference||'', req.user.id]
    );
    let totalD=0, totalC=0;
    for (let i=0; i<(b.lines||[]).length; i++) {
      const l = b.lines[i];
      await client.query(
        'INSERT INTO journal_lines (journal_entry_id,account_id,description,debit,credit,sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, l.account_id, l.description||'', parseFloat(l.debit)||0, parseFloat(l.credit)||0, i]
      );
      totalD += parseFloat(l.debit)||0;
      totalC += parseFloat(l.credit)||0;
    }
    if (Math.abs(totalD - totalC) > 0.001) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Debits ('+totalD.toFixed(3)+') must equal credits ('+totalC.toFixed(3)+')' });
    }
    await client.query('COMMIT');
    res.status(201).json({ id, entry_number: num, total: totalD });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.patch('/api/journals/:id/post', auth(['owner','admin','accountant']), async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const { rows } = await pool.query(
      'UPDATE journal_entries SET is_posted=true WHERE id=$1 AND company_id=$2 RETURNING *',
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    // Update account balances
    const { rows: lines } = await pool.query('SELECT * FROM journal_lines WHERE journal_entry_id=$1', [req.params.id]);
    for (const l of lines) {
      await pool.query('UPDATE accounts SET balance = balance + $1 - $2 WHERE id=$3', [parseFloat(l.debit), parseFloat(l.credit), l.account_id]);
    }
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── FINANCIAL REPORTS ──────────────────────────────────────
app.get('/api/reports/balance-sheet', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT account_type, SUM(balance) as total FROM accounts WHERE company_id=$1 AND is_active=true GROUP BY account_type ORDER BY account_type",
      [req.user.company_id]
    );
    const data = {};
    rows.forEach(r => { data[r.account_type] = parseFloat(r.total); });
    const assets = (data.asset||0) + (data.bank||0) + (data.receivable||0);
    const liabilities = (data.liability||0) + (data.payable||0);
    const equity = data.equity||0;
    res.json({ assets, liabilities, equity, balanced: Math.abs(assets - liabilities - equity) < 0.01, details: rows });
  } catch (err) { res.json({ assets:0, liabilities:0, equity:0, balanced:true, details:[] }); }
});

app.get('/api/reports/cash-flow', auth(), async (req, res) => {
  try {
    const cid = req.user.company_id;
    const [revR, expR, payR, invPaid] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(total),0) as v FROM invoices WHERE company_id=$1 AND status='paid'", [cid]),
      pool.query('SELECT COALESCE(SUM(amount),0) as v FROM expenses WHERE company_id=$1', [cid]),
      pool.query("SELECT COALESCE(SUM(basic_salary+allowances),0) as v FROM employees WHERE company_id=$1 AND status='active'", [cid]),
      pool.query("SELECT COALESCE(SUM(total),0) as v FROM purchase_orders WHERE company_id=$1 AND status='received'", [cid]).catch(()=>({rows:[{v:0}]})),
    ]);
    const inflow = parseFloat(revR.rows[0].v);
    const opEx = parseFloat(expR.rows[0].v) + parseFloat(payR.rows[0].v);
    const purchases = parseFloat(invPaid.rows[0].v);
    res.json({ inflow, operating_expenses: opEx, purchases, net_cash: inflow - opEx - purchases });
  } catch (err) { res.json({ inflow:0, operating_expenses:0, purchases:0, net_cash:0 }); }
});

app.get('/api/reports/ar-aging', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT invoice_number, client_name_en, total, due_date, status,
       CASE WHEN due_date >= CURRENT_DATE THEN 'current'
            WHEN CURRENT_DATE - due_date <= 30 THEN '1-30'
            WHEN CURRENT_DATE - due_date <= 60 THEN '31-60'
            WHEN CURRENT_DATE - due_date <= 90 THEN '61-90'
            ELSE '90+' END as aging
       FROM invoices WHERE company_id=$1 AND status IN ('pending','overdue')
       ORDER BY due_date`, [req.user.company_id]
    );
    res.json(rows);
  } catch (err) { res.json([]); }
});

app.get('/api/reports/ap-aging', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT po_number, vendor_name, total, expected_date, status,
       CASE WHEN expected_date >= CURRENT_DATE OR expected_date IS NULL THEN 'current'
            WHEN CURRENT_DATE - expected_date <= 30 THEN '1-30'
            WHEN CURRENT_DATE - expected_date <= 60 THEN '31-60'
            ELSE '60+' END as aging
       FROM purchase_orders WHERE company_id=$1 AND status IN ('confirmed','sent')
       ORDER BY expected_date`, [req.user.company_id]
    );
    res.json(rows);
  } catch (err) { res.json([]); }
});

// ─── CONTACTS (customers + vendors) ─────────────────────────
app.get('/api/contacts', auth(), async (req, res) => {
  try {
    const type = req.query.type; // customer, vendor, or undefined for all
    const where = type ? ' AND contact_type=$2' : '';
    const params = type ? [req.user.company_id, type] : [req.user.company_id];
    const { rows } = await pool.query('SELECT * FROM contacts WHERE company_id=$1 AND is_active=true' + where + ' ORDER BY name_en', params);
    res.json(rows);
  } catch (err) { res.json([]); }
});

app.post('/api/contacts', auth(['owner','admin','accountant']), async (req, res) => {
  try {
    const b = req.body; const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO contacts (id,company_id,contact_type,name_en,name_ar,email,phone,tax_id,address,city,country,credit_limit,payment_terms,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, req.user.company_id, b.contact_type||'customer', b.name_en, b.name_ar||'', b.email||'', b.phone||'', b.tax_id||'', b.address||'', b.city||'', b.country||'Oman', parseFloat(b.credit_limit)||0, parseInt(b.payment_terms)||30, b.notes||'']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/contacts/:id', auth(['owner','admin','accountant']), async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const b = req.body;
    const { rows } = await pool.query(
      `UPDATE contacts SET contact_type=$1,name_en=$2,name_ar=$3,email=$4,phone=$5,tax_id=$6,address=$7,city=$8,country=$9,credit_limit=$10,payment_terms=$11,notes=$12
       WHERE id=$13 AND company_id=$14 RETURNING *`,
      [b.contact_type, b.name_en, b.name_ar||'', b.email||'', b.phone||'', b.tax_id||'', b.address||'', b.city||'', b.country||'Oman', parseFloat(b.credit_limit)||0, parseInt(b.payment_terms)||30, b.notes||'', req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/contacts/:id', auth(['owner','admin']), async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    await pool.query('UPDATE contacts SET is_active=false WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── QUOTATIONS ─────────────────────────────────────────────
app.get('/api/quotations', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT q.*, json_agg(json_build_object('id',qi.id,'description_en',qi.description_en,'quantity',qi.quantity,'unit_price',qi.unit_price,'line_total',qi.line_total) ORDER BY qi.sort_order) as items
       FROM quotations q LEFT JOIN quotation_items qi ON q.id=qi.quotation_id
       WHERE q.company_id=$1 GROUP BY q.id ORDER BY q.issue_date DESC`,
      [req.user.company_id]
    );
    res.json(rows.map(r => { r.items = (r.items||[]).filter(i => i.id !== null); return r; }));
  } catch (err) { res.json([]); }
});

app.post('/api/quotations', auth(['owner','admin','accountant']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body; const id = uuidv4();
    const { rows: seq } = await client.query(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INTEGER)),0)+1 as n FROM quotations WHERE company_id=$1",
      [req.user.company_id]
    );
    const num = 'QT-' + new Date().getFullYear() + '-' + String(seq[0].n).padStart(4,'0');
    await client.query(
      'INSERT INTO quotations (id,company_id,quote_number,contact_id,client_name,issue_date,valid_until,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, req.user.company_id, num, b.contact_id||null, b.client_name, b.issue_date||new Date(), b.valid_until||null, b.notes||'', req.user.id]
    );
    for (let i=0; i<(b.items||[]).length; i++) {
      const item = b.items[i];
      await client.query(
        'INSERT INTO quotation_items (quotation_id,description_en,description_ar,quantity,unit_price,sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, item.description_en, item.description_ar||'', item.quantity||1, item.unit_price||0, i]
      );
    }
    await client.query('COMMIT');
    const { rows } = await pool.query('SELECT * FROM quotations WHERE id=$1', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.patch('/api/quotations/:id/status', auth(['owner','admin','accountant']), async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const { rows } = await pool.query(
      'UPDATE quotations SET status=$1 WHERE id=$2 AND company_id=$3 RETURNING *',
      [req.body.status, req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convert quotation to invoice
app.post('/api/quotations/:id/convert', auth(['owner','admin','accountant']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const { rows: qt } = await client.query('SELECT * FROM quotations WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
    if (!qt.length) return res.status(404).json({ error: 'Not found' });
    const q = qt[0]; const invId = uuidv4();
    const { rows: seq } = await client.query(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)),0)+1 as n FROM invoices WHERE company_id=$1",
      [req.user.company_id]
    );
    const invNum = 'INV-' + new Date().getFullYear() + '-' + String(seq[0].n).padStart(4,'0');
    await client.query(
      `INSERT INTO invoices (id,company_id,invoice_number,client_name_en,client_name_ar,issue_date,due_date,currency,status,notes,created_by)
       VALUES ($1,$2,$3,$4,'',$5,$6,$7,'pending',$8,$9)`,
      [invId, req.user.company_id, invNum, q.client_name, new Date(), new Date(Date.now()+30*864e5), q.currency, q.notes, req.user.id]
    );
    const { rows: items } = await client.query('SELECT * FROM quotation_items WHERE quotation_id=$1 ORDER BY sort_order', [req.params.id]);
    for (const i of items) {
      await client.query(
        'INSERT INTO invoice_items (invoice_id,description_en,description_ar,quantity,unit_price,sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [invId, i.description_en, i.description_ar, i.quantity, i.unit_price, i.sort_order]
      );
    }
    await client.query("UPDATE quotations SET status='converted' WHERE id=$1", [req.params.id]);
    await client.query('COMMIT');
    res.status(201).json({ invoice_id: invId, invoice_number: invNum });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ─── PURCHASE ORDERS ────────────────────────────────────────
app.get('/api/purchase-orders', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT po.*, json_agg(json_build_object('id',pi.id,'description_en',pi.description_en,'quantity',pi.quantity,'unit_price',pi.unit_price,'line_total',pi.line_total) ORDER BY pi.sort_order) as items
       FROM purchase_orders po LEFT JOIN purchase_order_items pi ON po.id=pi.purchase_order_id
       WHERE po.company_id=$1 GROUP BY po.id ORDER BY po.order_date DESC`,
      [req.user.company_id]
    );
    res.json(rows.map(r => { r.items = (r.items||[]).filter(i => i.id !== null); return r; }));
  } catch (err) { res.json([]); }
});

app.post('/api/purchase-orders', auth(['owner','admin','accountant']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body; const id = uuidv4();
    const { rows: seq } = await client.query(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER)),0)+1 as n FROM purchase_orders WHERE company_id=$1",
      [req.user.company_id]
    );
    const num = 'PO-' + new Date().getFullYear() + '-' + String(seq[0].n).padStart(4,'0');
    await client.query(
      'INSERT INTO purchase_orders (id,company_id,po_number,contact_id,vendor_name,order_date,expected_date,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, req.user.company_id, num, b.contact_id||null, b.vendor_name, b.order_date||new Date(), b.expected_date||null, b.notes||'', req.user.id]
    );
    for (let i=0; i<(b.items||[]).length; i++) {
      const item = b.items[i];
      await client.query(
        'INSERT INTO purchase_order_items (purchase_order_id,description_en,description_ar,quantity,unit_price,sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, item.description_en, item.description_ar||'', item.quantity||1, item.unit_price||0, i]
      );
    }
    await client.query('COMMIT');
    const { rows } = await pool.query('SELECT * FROM purchase_orders WHERE id=$1', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.patch('/api/purchase-orders/:id/status', auth(['owner','admin','accountant']), async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const { rows } = await pool.query(
      'UPDATE purchase_orders SET status=$1 WHERE id=$2 AND company_id=$3 RETURNING *',
      [req.body.status, req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── LEAVE MANAGEMENT ───────────────────────────────────────
app.get('/api/leave-types', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM leave_types WHERE company_id=$1 ORDER BY name_en', [req.user.company_id]);
    res.json(rows);
  } catch (err) { res.json([]); }
});

app.get('/api/leaves', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT lr.*, e.name_en as emp_name, e.name_ar as emp_name_ar, e.department, lt.name_en as leave_type, lt.color
       FROM leave_requests lr JOIN employees e ON lr.employee_id=e.id JOIN leave_types lt ON lr.leave_type_id=lt.id
       WHERE lr.company_id=$1 ORDER BY lr.created_at DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) { res.json([]); }
});

app.post('/api/leaves', auth(['owner','admin','hr']), async (req, res) => {
  try {
    const b = req.body; const id = uuidv4();
    const days = Math.ceil((new Date(b.end_date) - new Date(b.start_date)) / 864e5) + 1;
    const { rows } = await pool.query(
      'INSERT INTO leave_requests (id,company_id,employee_id,leave_type_id,start_date,end_date,days,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [id, req.user.company_id, b.employee_id, b.leave_type_id, b.start_date, b.end_date, days, b.reason||'']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/leaves/:id/status', auth(['owner','admin','hr']), async (req, res) => {
  try {
    if (!isUUID(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
    const { rows } = await pool.query(
      'UPDATE leave_requests SET status=$1, approved_by=$2 WHERE id=$3 AND company_id=$4 RETURNING *',
      [req.body.status, req.user.id, req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ATTENDANCE ─────────────────────────────────────────────
app.get('/api/attendance', auth(), async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0,10);
    const { rows } = await pool.query(
      `SELECT a.*, e.name_en as emp_name, e.department
       FROM attendance a JOIN employees e ON a.employee_id=e.id
       WHERE a.company_id=$1 AND a.att_date=$2 ORDER BY e.name_en`,
      [req.user.company_id, date]
    );
    res.json(rows);
  } catch (err) { res.json([]); }
});

app.post('/api/attendance', auth(['owner','admin','hr']), async (req, res) => {
  try {
    const b = req.body; const id = uuidv4();
    const hours = (b.check_in && b.check_out) ? Math.round((new Date('2000-01-01T'+b.check_out) - new Date('2000-01-01T'+b.check_in)) / 36e5 * 10) / 10 : null;
    const { rows } = await pool.query(
      'INSERT INTO attendance (id,company_id,employee_id,att_date,check_in,check_out,status,hours_worked,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (company_id,employee_id,att_date) DO UPDATE SET check_in=EXCLUDED.check_in,check_out=EXCLUDED.check_out,status=EXCLUDED.status,hours_worked=EXCLUDED.hours_worked,notes=EXCLUDED.notes RETURNING *',
      [id, req.user.company_id, b.employee_id, b.att_date||new Date().toISOString().slice(0,10), b.check_in||null, b.check_out||null, b.status||'present', hours, b.notes||'']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance/bulk', auth(['owner','admin','hr']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = req.body.items || [];
    let count = 0;
    for (const b of items) {
      if (!b.employee_id) continue;
      const hours = (b.check_in && b.check_out) ? Math.round((new Date('2000-01-01T'+b.check_out) - new Date('2000-01-01T'+b.check_in)) / 36e5 * 10) / 10 : null;
      await client.query(
        'INSERT INTO attendance (id,company_id,employee_id,att_date,check_in,check_out,status,hours_worked) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (company_id,employee_id,att_date) DO UPDATE SET check_in=EXCLUDED.check_in,check_out=EXCLUDED.check_out,status=EXCLUDED.status,hours_worked=EXCLUDED.hours_worked',
        [uuidv4(), req.user.company_id, b.employee_id, b.att_date||new Date().toISOString().slice(0,10), b.check_in||null, b.check_out||null, b.status||'present', hours]
      );
      count++;
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, recorded: count });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ─── WPS BANK FILE ──────────────────────────────────────────
app.get('/api/wps/generate', auth(['owner','admin','accountant']), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT e.name_en, e.iban, e.bank_name, e.basic_salary, e.allowances, e.basic_salary + e.allowances as gross, CASE WHEN e.is_omani THEN e.basic_salary * 0.07 ELSE 0 END as spf_ded, e.basic_salary + e.allowances - CASE WHEN e.is_omani THEN e.basic_salary * 0.07 ELSE 0 END as net_pay FROM employees e WHERE e.company_id=$1 AND e.status='active' ORDER BY e.name_en",
      [req.user.company_id]
    );
    // Generate SIF-like format (Oman WPS standard)
    const { rows: co } = await pool.query('SELECT * FROM companies WHERE id=$1', [req.user.company_id]);
    const company = co[0] || {};
    let sif = '@SIF1.0\n';
    sif += 'SCR,' + (company.cr_number||'') + ',' + new Date().toISOString().slice(0,10).replace(/-/g,'') + ',' + new Date().toISOString().slice(0,10).replace(/-/g,'') + ',OMR,' + rows.length + ',' + rows.reduce((s,r) => s + parseFloat(r.net_pay), 0).toFixed(3) + '\n';
    for (const emp of rows) {
      sif += 'EDR,' + (emp.iban||'') + ',' + emp.name_en + ',' + parseFloat(emp.net_pay).toFixed(3) + ',OMR,' + (emp.bank_name||'') + '\n';
    }
    res.json({ content: sif, filename: 'WPS-' + new Date().toISOString().slice(0,7) + '.sif', employees: rows.length, total: rows.reduce((s,r) => s + parseFloat(r.net_pay), 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── STOCK ALERTS ───────────────────────────────────────────
app.get('/api/stock-alerts', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE company_id=$1 AND is_active=true AND stock_qty <= min_stock ORDER BY stock_qty ASC',
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) { res.json([]); }
});

// ─── BULK IMPORTS FOR NEW ENTITIES ──────────────────────────
app.post('/api/contacts/import', auth(['owner','admin','accountant']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = req.body.items || []; let created = 0;
    for (const b of items) {
      if (!b.name_en) continue;
      await client.query(
        'INSERT INTO contacts (id,company_id,contact_type,name_en,name_ar,email,phone,city,payment_terms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [uuidv4(), req.user.company_id, b.contact_type||'customer', b.name_en, b.name_ar||'', b.email||'', b.phone||'', b.city||'', parseInt(b.payment_terms)||30]
      );
      created++;
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, imported: created });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

app.post('/api/quotations/import', auth(['owner','admin','accountant']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = req.body.items || []; let created = 0;
    for (const b of items) {
      if (!b.client_name) continue;
      const id = uuidv4();
      const { rows: seq } = await client.query("SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INTEGER)),0)+1 as n FROM quotations WHERE company_id=$1", [req.user.company_id]);
      const num = 'QT-' + new Date().getFullYear() + '-' + String(seq[0].n).padStart(4,'0');
      await client.query(
        'INSERT INTO quotations (id,company_id,quote_number,client_name,subtotal,total) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, req.user.company_id, num, b.client_name, parseFloat(b.subtotal)||0, (parseFloat(b.subtotal)||0)*1.05]
      );
      created++;
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, imported: created });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

app.post('/api/purchase-orders/import', auth(['owner','admin','accountant']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = req.body.items || []; let created = 0;
    for (const b of items) {
      if (!b.vendor_name) continue;
      const id = uuidv4();
      const { rows: seq } = await client.query("SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER)),0)+1 as n FROM purchase_orders WHERE company_id=$1", [req.user.company_id]);
      const num = 'PO-' + new Date().getFullYear() + '-' + String(seq[0].n).padStart(4,'0');
      await client.query(
        'INSERT INTO purchase_orders (id,company_id,po_number,vendor_name,subtotal,total) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, req.user.company_id, num, b.vendor_name, parseFloat(b.subtotal)||0, (parseFloat(b.subtotal)||0)*1.05]
      );
      created++;
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, imported: created });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

app.post('/api/leaves/import', auth(['owner','admin','hr']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = req.body.items || []; let created = 0;
    for (const b of items) {
      if (!b.employee_id || !b.leave_type_id) continue;
      const days = Math.ceil((new Date(b.end_date) - new Date(b.start_date)) / 864e5) + 1;
      await client.query(
        'INSERT INTO leave_requests (id,company_id,employee_id,leave_type_id,start_date,end_date,days,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [uuidv4(), req.user.company_id, b.employee_id, b.leave_type_id, b.start_date, b.end_date, days>0?days:1, b.reason||'']
      );
      created++;
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, imported: created });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

}; // end module.exports
