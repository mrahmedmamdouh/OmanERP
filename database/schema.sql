-- ═══════════════════════════════════════════════════════════════
-- OMAN SME ERP — PostgreSQL Database Schema
-- Compatible with: Supabase, Neon, Railway, plain PostgreSQL
-- ═══════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ──────────────────────────────────────────────────
CREATE TYPE invoice_status AS ENUM ('draft','pending','paid','overdue','cancelled');
CREATE TYPE employee_status AS ENUM ('active','inactive','terminated');
CREATE TYPE expense_category AS ENUM ('rent','utilities','supplies','insurance','travel','marketing','other');
CREATE TYPE user_role AS ENUM ('owner','admin','accountant','hr','viewer');

-- ─── COMPANIES (multi-tenant) ───────────────────────────────
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar VARCHAR(200) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  cr_number VARCHAR(20) UNIQUE,
  tax_id VARCHAR(30) UNIQUE,
  address TEXT,
  city VARCHAR(100) DEFAULT 'مسقط',
  phone VARCHAR(30),
  email VARCHAR(150),
  logo_url TEXT,
  default_currency VARCHAR(3) DEFAULT 'OMR',
  fiscal_year_start INTEGER DEFAULT 1, -- month (1=Jan)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USERS & AUTH ───────────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name_ar VARCHAR(150),
  name_en VARCHAR(150) NOT NULL,
  role user_role DEFAULT 'viewer',
  lang VARCHAR(2) DEFAULT 'en',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);

-- ─── SESSIONS ───────────────────────────────────────────────
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ─── EMPLOYEES ──────────────────────────────────────────────
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  emp_number SERIAL,
  name_ar VARCHAR(200),
  name_en VARCHAR(200) NOT NULL,
  nationality VARCHAR(50) NOT NULL DEFAULT 'Omani',
  is_omani BOOLEAN GENERATED ALWAYS AS (nationality = 'Omani') STORED,
  department VARCHAR(100) NOT NULL,
  role_title_ar VARCHAR(150),
  role_title_en VARCHAR(150),
  basic_salary NUMERIC(10,3) NOT NULL DEFAULT 0,
  allowances NUMERIC(10,3) DEFAULT 0,
  civil_id VARCHAR(20),
  spf_number VARCHAR(30),
  email VARCHAR(200),
  phone VARCHAR(30),
  bank_name VARCHAR(100),
  iban VARCHAR(50),
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  termination_date DATE,
  status employee_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_emp_company ON employees(company_id);
CREATE INDEX idx_emp_dept ON employees(company_id, department);
CREATE INDEX idx_emp_nationality ON employees(company_id, nationality);
CREATE INDEX idx_emp_status ON employees(company_id, status);

-- ─── INVOICES ───────────────────────────────────────────────
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(30) NOT NULL,
  client_name_ar VARCHAR(200),
  client_name_en VARCHAR(200) NOT NULL,
  client_tax_id VARCHAR(30),
  client_address TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  currency VARCHAR(3) DEFAULT 'OMR',
  subtotal NUMERIC(12,3) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  total NUMERIC(12,3) NOT NULL DEFAULT 0,
  status invoice_status DEFAULT 'draft',
  paid_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);
CREATE INDEX idx_inv_company ON invoices(company_id);
CREATE INDEX idx_inv_status ON invoices(company_id, status);
CREATE INDEX idx_inv_date ON invoices(company_id, issue_date);
CREATE INDEX idx_inv_due ON invoices(company_id, due_date);

-- ─── INVOICE LINE ITEMS ─────────────────────────────────────
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description_ar TEXT,
  description_en TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,3) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,3) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX idx_inv_items ON invoice_items(invoice_id);

-- ─── EXPENSES ───────────────────────────────────────────────
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  description_ar TEXT,
  description_en TEXT NOT NULL,
  amount NUMERIC(12,3) NOT NULL,
  category expense_category DEFAULT 'other',
  vendor VARCHAR(200),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vat_included BOOLEAN DEFAULT FALSE,
  vat_amount NUMERIC(12,3) DEFAULT 0,
  receipt_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_exp_company ON expenses(company_id);
CREATE INDEX idx_exp_date ON expenses(company_id, expense_date);
CREATE INDEX idx_exp_category ON expenses(company_id, category);

-- ─── PAYROLL RUNS ───────────────────────────────────────────
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL, -- 1-12
  period_year INTEGER NOT NULL,
  total_basic NUMERIC(12,3) DEFAULT 0,
  total_allowances NUMERIC(12,3) DEFAULT 0,
  total_gross NUMERIC(12,3) DEFAULT 0,
  total_spf_employee NUMERIC(12,3) DEFAULT 0,
  total_spf_employer NUMERIC(12,3) DEFAULT 0,
  total_net NUMERIC(12,3) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft', -- draft, approved, paid
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, period_month, period_year)
);

-- ─── PAYROLL LINE ITEMS (per employee per run) ──────────────
CREATE TABLE payroll_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  basic_salary NUMERIC(10,3) NOT NULL,
  allowances NUMERIC(10,3) DEFAULT 0,
  gross NUMERIC(10,3) NOT NULL,
  spf_employee NUMERIC(10,3) DEFAULT 0,
  spf_employer NUMERIC(10,3) DEFAULT 0,
  other_deductions NUMERIC(10,3) DEFAULT 0,
  net_pay NUMERIC(10,3) NOT NULL
);
CREATE INDEX idx_payroll_items ON payroll_items(payroll_run_id);

-- ─── VAT RETURNS ────────────────────────────────────────────
CREATE TABLE vat_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period VARCHAR(10) NOT NULL, -- e.g. 'Q1-2025'
  taxable_sales NUMERIC(14,3) DEFAULT 0,
  exempt_sales NUMERIC(14,3) DEFAULT 0,
  zero_rated_sales NUMERIC(14,3) DEFAULT 0,
  output_vat NUMERIC(14,3) DEFAULT 0,
  input_vat NUMERIC(14,3) DEFAULT 0,
  net_payable NUMERIC(14,3) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft', -- draft, submitted, paid
  submitted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, period)
);

-- ─── SPF SUBMISSIONS ────────────────────────────────────────
CREATE TABLE spf_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  total_employer NUMERIC(12,3) DEFAULT 0,
  total_employee NUMERIC(12,3) DEFAULT 0,
  total_government NUMERIC(12,3) DEFAULT 0,
  total_amount NUMERIC(12,3) DEFAULT 0,
  eligible_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, period_month, period_year)
);

-- ─── AUDIT LOG ──────────────────────────────────────────────
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50) NOT NULL, -- create, update, delete, login, export
  entity_type VARCHAR(50), -- invoice, employee, expense, etc.
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_company ON audit_log(company_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- ─── NOTIFICATIONS ──────────────────────────────────────────
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'info', -- info, warning, error, success
  is_read BOOLEAN DEFAULT FALSE,
  link VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);

-- ─── HELPER FUNCTIONS ───────────────────────────────────────

-- Auto-calculate invoice totals from line items
CREATE OR REPLACE FUNCTION calc_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices SET
    subtotal = COALESCE((SELECT SUM(line_total) FROM invoice_items WHERE invoice_id = NEW.invoice_id), 0),
    vat_amount = COALESCE((SELECT SUM(line_total) FROM invoice_items WHERE invoice_id = NEW.invoice_id), 0) * 0.05,
    total = COALESCE((SELECT SUM(line_total) FROM invoice_items WHERE invoice_id = NEW.invoice_id), 0) * 1.05,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_calc
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION calc_invoice_totals();

-- Auto-calculate expense VAT
CREATE OR REPLACE FUNCTION calc_expense_vat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vat_included THEN
    NEW.vat_amount := (NEW.amount / 1.05) * 0.05;
  ELSE
    NEW.vat_amount := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expense_vat
BEFORE INSERT OR UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION calc_expense_vat();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_ts BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_employee_ts BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_invoice_ts BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Auto-detect overdue invoices (run daily via cron/pg_cron)
CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices
  SET status = 'overdue', updated_at = NOW()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ─── VIEWS ──────────────────────────────────────────────────

-- Omanization dashboard per company+department
CREATE OR REPLACE VIEW v_omanization AS
SELECT
  company_id,
  department,
  COUNT(*) AS total_employees,
  COUNT(*) FILTER (WHERE is_omani) AS omani_count,
  ROUND(COUNT(*) FILTER (WHERE is_omani)::numeric / NULLIF(COUNT(*), 0) * 100) AS omani_pct
FROM employees
WHERE status = 'active'
GROUP BY company_id, department;

-- Monthly payroll summary
CREATE OR REPLACE VIEW v_payroll_summary AS
SELECT
  company_id,
  SUM(basic_salary) AS total_basic,
  SUM(allowances) AS total_allowances,
  SUM(basic_salary + allowances) AS total_gross,
  SUM(CASE WHEN is_omani THEN basic_salary * 0.07 ELSE 0 END) AS total_spf_employee,
  SUM(CASE WHEN is_omani THEN basic_salary * 0.1175 ELSE 0 END) AS total_spf_employer,
  SUM(basic_salary + allowances - CASE WHEN is_omani THEN basic_salary * 0.07 ELSE 0 END) AS total_net
FROM employees
WHERE status = 'active'
GROUP BY company_id;

-- ─── ROW LEVEL SECURITY (for Supabase) ─────────────────────
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE spf_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ─── SEED DATA (for testing) ────────────────────────────────
INSERT INTO companies (id, name_ar, name_en, cr_number, tax_id, address, city, phone, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'شركة المستقبل للتقنية', 'Future Tech LLC', '1234567', 'OM1234567890', 'شارع السلطان قابوس، بوشر', 'مسقط', '+968 2412 3456', 'info@futuretech.om');

INSERT INTO users (company_id, email, password_hash, name_en, name_ar, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@futuretech.om', crypt('admin123', gen_salt('bf')), 'Admin User', 'المدير', 'owner');
