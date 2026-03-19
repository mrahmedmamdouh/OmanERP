// ═══════════════════════════════════════════════════════════════
// SAAS BILLING ROUTES — Stripe payments, plan management
// ═══════════════════════════════════════════════════════════════

module.exports = function registerBillingRoutes(app, pool, auth, isUUID, uuidv4, bcrypt, jwt) {

const PLANS = {
  trial:        { price: 0,    users: 3,  employees: 10,  invoices: 20,  label: 'Free Trial (14 days)' },
  starter:      { price: 9,    users: 5,  employees: 25,  invoices: 100, label: 'Starter' },
  professional: { price: 25,   users: 15, employees: 100, invoices: 500, label: 'Professional' },
  enterprise:   { price: 59,   users: 50, employees: 999, invoices: 9999,label: 'Enterprise' },
};

// Public — get pricing plans
app.get('/api/plans', (req, res) => {
  res.json(Object.entries(PLANS).map(([k, v]) => ({ id: k, ...v })));
});

// Public — register + auto-provision after payment intent
app.post('/api/subscribe', async (req, res) => {
  try {
    const { email, password, name_en, name_ar, company_name_en, company_name_ar, plan, payment_ref } = req.body;
    if (!email || !password || !name_en || !company_name_en) {
      return res.status(400).json({ error: 'Required: email, password, name_en, company_name_en' });
    }
    const selectedPlan = PLANS[plan] || PLANS.starter;
    const planKey = PLANS[plan] ? plan : 'starter';

    // Check if email exists
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'Email already registered. Please login.' });

    // Create company with plan
    const companyId = uuidv4();
    const trialEnd = planKey === 'trial' ? new Date(Date.now() + 14 * 864e5) : new Date(Date.now() + 365 * 864e5);
    await pool.query(
      `INSERT INTO companies (id, name_ar, name_en, plan, plan_expires_at, max_users, max_employees, max_invoices_month, trial_started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [companyId, company_name_ar || company_name_en, company_name_en, planKey, trialEnd, selectedPlan.users, selectedPlan.employees, selectedPlan.invoices]
    );

    // Create admin user
    const hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (id, company_id, email, password_hash, name_en, name_ar, role) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userId, companyId, email, hash, name_en, name_ar || name_en, 'owner']
    );

    // Record payment if not trial
    if (planKey !== 'trial' && payment_ref) {
      await pool.query(
        'INSERT INTO payments (company_id, amount, plan, stripe_payment_id, period_start, period_end) VALUES ($1,$2,$3,$4,CURRENT_DATE,$5)',
        [companyId, selectedPlan.price, planKey, payment_ref, trialEnd]
      );
    }

    // Seed default data for new company
    try {
      // Default chart of accounts
      const acctSeeds = [
        ['1000','Cash','النقدية','asset'],['1010','Bank Account','الحساب البنكي','bank'],
        ['1100','Accounts Receivable','ذمم مدينة','receivable'],['2000','Accounts Payable','ذمم دائنة','payable'],
        ['2100','VAT Payable','ضريبة مستحقة','liability'],['3000','Owner Equity','رأس المال','equity'],
        ['4000','Sales Revenue','إيرادات المبيعات','revenue'],['5000','COGS','تكلفة البضاعة','expense'],
        ['5100','Salaries','رواتب','expense'],['5200','Rent','إيجار','expense'],['5900','Other Expenses','مصروفات أخرى','expense'],
      ];
      for (const [code, en, ar, type] of acctSeeds) {
        await pool.query('INSERT INTO accounts (id,company_id,code,name_en,name_ar,account_type) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
          [uuidv4(), companyId, code, en, ar, type]);
      }
      // Default leave types
      const leaveSeeds = [['Annual Leave','إجازة سنوية',30,true,'#3b82f6'],['Sick Leave','إجازة مرضية',14,true,'#ef4444'],['Unpaid Leave','إجازة بدون راتب',0,false,'#6b7280']];
      for (const [en, ar, days, paid, col] of leaveSeeds) {
        await pool.query('INSERT INTO leave_types (id,company_id,name_en,name_ar,days_per_year,is_paid,color) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',
          [uuidv4(), companyId, en, ar, days, paid, col]);
      }
    } catch (seedErr) { console.error('[SEED ERROR]', seedErr.message); }

    const token = jwt.sign({ userId, companyId, role: 'owner' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: { id: userId, email, name_en, role: 'owner', company_id: companyId }, plan: planKey });
  } catch (err) {
    console.error('[SUBSCRIBE ERROR]', err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Email or company already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Get current company plan
app.get('/api/billing', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT plan, plan_expires_at, max_users, max_employees, max_invoices_month, is_active, onboarding_done, trial_started_at FROM companies WHERE id=$1',
      [req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Company not found' });
    const co = rows[0];
    const { rows: userCount } = await pool.query('SELECT COUNT(*) as c FROM users WHERE company_id=$1 AND is_active=true', [req.user.company_id]);
    const { rows: empCount } = await pool.query("SELECT COUNT(*) as c FROM employees WHERE company_id=$1 AND status='active'", [req.user.company_id]);
    const expired = co.plan_expires_at && new Date(co.plan_expires_at) < new Date();
    const daysLeft = co.plan_expires_at ? Math.max(0, Math.ceil((new Date(co.plan_expires_at) - new Date()) / 864e5)) : 999;
    res.json({
      plan: co.plan, expires: co.plan_expires_at, daysLeft, expired, onboarding_done: co.onboarding_done,
      limits: { users: co.max_users, employees: co.max_employees, invoices: co.max_invoices_month },
      usage: { users: parseInt(userCount.rows ? userCount.rows[0].c : userCount[0]?.c || 0), employees: parseInt(empCount.rows ? empCount.rows[0].c : empCount[0]?.c || 0) },
      plans: PLANS,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upgrade plan
app.post('/api/billing/upgrade', auth(['owner']), async (req, res) => {
  try {
    const { plan, payment_ref } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });
    const p = PLANS[plan];
    const expires = new Date(Date.now() + 365 * 864e5);
    await pool.query(
      'UPDATE companies SET plan=$1, plan_expires_at=$2, max_users=$3, max_employees=$4, max_invoices_month=$5 WHERE id=$6',
      [plan, expires, p.users, p.employees, p.invoices, req.user.company_id]
    );
    if (payment_ref) {
      await pool.query(
        'INSERT INTO payments (company_id, amount, plan, stripe_payment_id, period_start, period_end) VALUES ($1,$2,$3,$4,CURRENT_DATE,$5)',
        [req.user.company_id, p.price, plan, payment_ref, expires]
      );
    }
    res.json({ success: true, plan, expires });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark onboarding complete
app.post('/api/billing/onboarding-done', auth(), async (req, res) => {
  try {
    await pool.query('UPDATE companies SET onboarding_done=true WHERE id=$1', [req.user.company_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Payment history
app.get('/api/billing/payments', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM payments WHERE company_id=$1 ORDER BY created_at DESC', [req.user.company_id]);
    res.json(rows);
  } catch (err) { res.json([]); }
});

// ─── THAWANI PAYMENT (Oman local gateway) ───────────────────
// Env vars needed: THAWANI_SECRET_KEY, THAWANI_PUBLISHABLE_KEY, THAWANI_MODE (test|live)
app.post('/api/billing/pay/thawani', auth(['owner']), async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan] || plan === 'trial') return res.status(400).json({ error: 'Invalid plan' });
    const p = PLANS[plan];
    const thawaniKey = process.env.THAWANI_SECRET_KEY;
    if (!thawaniKey) return res.status(500).json({ error: 'Thawani not configured. Set THAWANI_SECRET_KEY in environment.' });
    const isTest = (process.env.THAWANI_MODE || 'test') === 'test';
    const baseUrl = isTest ? 'https://uatcheckout.thawani.om' : 'https://checkout.thawani.om';
    const frontendUrl = process.env.FRONTEND_URL || 'https://oman-erp.vercel.app';
    const fetch = (await import('node-fetch')).default;
    const sessionRes = await fetch(baseUrl + '/api/v1/checkout/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'thawani-api-key': thawaniKey },
      body: JSON.stringify({
        client_reference_id: req.user.company_id,
        mode: 'payment',
        products: [{ name: 'Oman ERP — ' + p.label + ' (Annual)', quantity: 1, unit_amount: Math.round(p.price * 12 * 1000) }],
        success_url: frontendUrl + '/?payment=success&plan=' + plan,
        cancel_url: frontendUrl + '/?payment=cancelled',
        metadata: { company_id: req.user.company_id, plan: plan, user_id: req.user.id },
      }),
    });
    const sessionData = await sessionRes.json();
    if (!sessionData.data || !sessionData.data.session_id) {
      return res.status(500).json({ error: 'Thawani session failed', details: sessionData });
    }
    const pubKey = process.env.THAWANI_PUBLISHABLE_KEY || '';
    const checkoutUrl = baseUrl + '/pay/' + sessionData.data.session_id + '?key=' + pubKey;
    res.json({ checkout_url: checkoutUrl, session_id: sessionData.data.session_id, gateway: 'thawani' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thawani payment verification (called from frontend after redirect)
app.post('/api/billing/verify/thawani', auth(['owner']), async (req, res) => {
  try {
    const { session_id, plan } = req.body;
    if (!session_id || !plan) return res.status(400).json({ error: 'Missing session_id or plan' });
    const thawaniKey = process.env.THAWANI_SECRET_KEY;
    if (!thawaniKey) return res.status(500).json({ error: 'Thawani not configured' });
    const isTest = (process.env.THAWANI_MODE || 'test') === 'test';
    const baseUrl = isTest ? 'https://uatcheckout.thawani.om' : 'https://checkout.thawani.om';
    const fetch = (await import('node-fetch')).default;
    const verifyRes = await fetch(baseUrl + '/api/v1/checkout/session/' + session_id, {
      headers: { 'thawani-api-key': thawaniKey },
    });
    const verifyData = await verifyRes.json();
    if (verifyData.data && verifyData.data.payment_status === 'paid') {
      const p = PLANS[plan];
      const expires = new Date(Date.now() + 365 * 864e5);
      await pool.query('UPDATE companies SET plan=$1, plan_expires_at=$2, max_users=$3, max_employees=$4, max_invoices_month=$5 WHERE id=$6',
        [plan, expires, p.users, p.employees, p.invoices, req.user.company_id]);
      await pool.query('INSERT INTO payments (company_id,amount,currency,payment_method,stripe_payment_id,plan,period_start,period_end) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7)',
        [req.user.company_id, p.price * 12, 'OMR', 'thawani', session_id, plan, expires]);
      return res.json({ success: true, plan, expires });
    }
    res.status(400).json({ error: 'Payment not confirmed', status: verifyData.data?.payment_status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── STRIPE PAYMENT (international) ─────────────────────────
// Env vars needed: STRIPE_SECRET_KEY
app.post('/api/billing/pay/stripe', auth(['owner']), async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan] || plan === 'trial') return res.status(400).json({ error: 'Invalid plan' });
    const p = PLANS[plan];
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY in environment.' });
    const stripe = require('stripe')(stripeKey);
    const frontendUrl = process.env.FRONTEND_URL || 'https://oman-erp.vercel.app';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: { currency: 'usd', product_data: { name: 'Oman ERP — ' + p.label + ' (Annual)' }, unit_amount: Math.round(p.price * 12 * 100) },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: frontendUrl + '/?payment=success&plan=' + plan + '&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: frontendUrl + '/?payment=cancelled',
      metadata: { company_id: req.user.company_id, plan: plan },
    });
    res.json({ checkout_url: session.url, session_id: session.id, gateway: 'stripe' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stripe payment verification
app.post('/api/billing/verify/stripe', auth(['owner']), async (req, res) => {
  try {
    const { session_id, plan } = req.body;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
    const stripe = require('stripe')(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid') {
      const p = PLANS[plan];
      const expires = new Date(Date.now() + 365 * 864e5);
      await pool.query('UPDATE companies SET plan=$1, plan_expires_at=$2, max_users=$3, max_employees=$4, max_invoices_month=$5 WHERE id=$6',
        [plan, expires, p.users, p.employees, p.invoices, req.user.company_id]);
      await pool.query('INSERT INTO payments (company_id,amount,currency,payment_method,stripe_payment_id,plan,period_start,period_end) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7)',
        [req.user.company_id, p.price * 12, 'USD', 'stripe', session_id, plan, expires]);
      return res.json({ success: true, plan, expires });
    }
    res.status(400).json({ error: 'Payment not confirmed', status: session.payment_status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Plan enforcement middleware helper (call from other routes)
app.planCheck = async function(companyId, resource) {
  const { rows } = await pool.query('SELECT plan, plan_expires_at, max_users, max_employees, max_invoices_month FROM companies WHERE id=$1', [companyId]);
  if (!rows.length) return { allowed: false, reason: 'Company not found' };
  const co = rows[0];
  if (co.plan_expires_at && new Date(co.plan_expires_at) < new Date()) return { allowed: false, reason: 'Plan expired. Please upgrade.' };
  if (resource === 'employee') {
    const { rows: ct } = await pool.query("SELECT COUNT(*) as c FROM employees WHERE company_id=$1 AND status='active'", [companyId]);
    if (parseInt(ct[0].c) >= co.max_employees) return { allowed: false, reason: 'Employee limit reached (' + co.max_employees + '). Upgrade your plan.' };
  }
  return { allowed: true };
};

}; // end module.exports
