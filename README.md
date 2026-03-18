# Oman SME ERP — Production Deployment Guide

## Architecture Overview

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   React Frontend     │────▶│   Express API        │────▶│   PostgreSQL     │
│   (Vercel/Netlify)   │     │   (Railway/Render)   │     │   (Supabase/Neon)│
│                      │     │                      │     │                  │
│ • 10 ERP modules     │     │ • JWT auth           │     │ • 14 tables      │
│ • Bilingual AR/EN    │     │ • RBAC middleware     │     │ • RLS policies   │
│ • RTL support        │     │ • Rate limiting      │     │ • Auto triggers  │
│ • Print invoices     │     │ • Audit logging      │     │ • Views          │
└──────────────────────┘     └──────────────────────┘     └──────────────────┘
```

## Files In This Package

| File | Purpose |
|------|---------|
| `database/schema.sql` | Complete PostgreSQL schema (14 tables, indexes, triggers, views, RLS, seed data) |
| `api/server.js` | Full Express API (auth, CRUD for all entities, payroll engine, VAT/SPF, reports) |
| `package.json` | Node.js dependencies |
| `.env.example` | Environment variables template |
| `Dockerfile` | Production container image |
| `docker-compose.yml` | Local development stack (API + PostgreSQL) |
| `oman-erp.jsx` | Frontend React component (the artifact you already have) |

---

## Quick Start (Local Development)

### Option A: Docker (Recommended)
```bash
# 1. Clone and enter
cd oman-erp-prod

# 2. Start everything (DB + API)
docker-compose up -d

# 3. API is running at http://localhost:3001
# 4. Test it:
curl http://localhost:3001/api/health

# 5. Login with seed user:
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@futuretech.om","password":"admin123"}'
```

### Option B: Manual
```bash
# 1. Install PostgreSQL 16+ and create a database
createdb oman_erp

# 2. Run schema
psql oman_erp < database/schema.sql

# 3. Install dependencies
npm install

# 4. Create .env from template
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 5. Start
npm run dev
```

---

## Cloud Deployment

### Database: Supabase (Free Tier)
1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy the **Connection String** from Settings → Database
3. Go to SQL Editor → paste `database/schema.sql` → Run
4. Set the connection string in your API's `DATABASE_URL` env var

### API: Railway (Free Tier)
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Connect your repo
3. Add environment variables:
   - `DATABASE_URL` = your Supabase connection string
   - `JWT_SECRET` = generate with `openssl rand -hex 32`
   - `FRONTEND_URL` = your Vercel URL
   - `NODE_ENV` = production
4. Railway auto-detects the Dockerfile and deploys

### Frontend: Vercel
1. Create a new Next.js project or static React app
2. Drop the `oman-erp.jsx` component into your pages
3. Update API calls to point to your Railway URL
4. Deploy to Vercel

### Alternative Stacks

| Component | Budget Option | Premium Option |
|-----------|--------------|----------------|
| Database | Supabase Free / Neon Free | AWS RDS / DigitalOcean Managed |
| API | Railway Free / Render Free | AWS ECS / GCP Cloud Run |
| Frontend | Vercel Free / Netlify Free | AWS CloudFront + S3 |
| Domain | ~$10/year (.om domain) | Same |
| SSL | Free (Let's Encrypt via platform) | Same |

**Estimated monthly cost: $0-20 for up to 50 users**

---

## API Endpoints Reference

### Auth
| Method | Endpoint | Body | Auth Required |
|--------|----------|------|---------------|
| POST | `/api/auth/register` | email, password, name_en, company_name_en, ... | No |
| POST | `/api/auth/login` | email, password | No |
| GET | `/api/auth/me` | - | Yes |

### Employees
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/employees` | List all active employees | Any |
| POST | `/api/employees` | Create employee | owner, admin, hr |
| PUT | `/api/employees/:id` | Update employee | owner, admin, hr |
| DELETE | `/api/employees/:id` | Terminate employee | owner, admin, hr |

### Invoices
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/invoices` | List all invoices with items | Any |
| POST | `/api/invoices` | Create invoice + line items | owner, admin, accountant |
| PATCH | `/api/invoices/:id/status` | Update status (paid/cancelled) | owner, admin, accountant |
| DELETE | `/api/invoices/:id` | Delete invoice | owner, admin |

### Expenses
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/expenses` | List all expenses | Any |
| POST | `/api/expenses` | Create expense | owner, admin, accountant |
| DELETE | `/api/expenses/:id` | Delete expense | owner, admin, accountant |

### Payroll
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/api/payroll/run` | Generate payroll for month/year | owner, admin, accountant |
| GET | `/api/payroll/:runId` | Get payroll details with employee breakdown | Any |

### VAT & SPF
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vat/summary` | Output VAT, Input VAT, Net |
| POST | `/api/vat/returns` | Submit VAT return |
| GET | `/api/spf/summary` | SPF contribution totals |
| GET | `/api/omanization` | Department-level Omanization stats |

### Reports & Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | KPIs (revenue, employees, expenses) |
| GET | `/api/reports/pnl` | Profit & Loss statement |
| GET | `/api/company` | Company settings |
| PUT | `/api/company` | Update company settings |

---

## Database Schema (14 Tables)

### Core Tables
- **companies** — Multi-tenant company data (name, CR, tax ID, address)
- **users** — Auth users with roles (owner/admin/accountant/hr/viewer)
- **sessions** — JWT session tracking

### Business Tables
- **employees** — Full HR records with Omanization tracking (computed `is_omani` column)
- **invoices** — Tax-compliant invoices with auto-calculated totals
- **invoice_items** — Line items with computed `line_total`
- **expenses** — Categorized expenses with auto-calculated VAT

### Operations Tables
- **payroll_runs** — Monthly payroll batches
- **payroll_items** — Per-employee payroll details
- **vat_returns** — Quarterly VAT return records
- **spf_submissions** — Monthly SPF contribution records

### System Tables
- **audit_log** — Every action logged (who, what, when, IP)
- **notifications** — In-app notification system

### Automated Features
- **Triggers**: Auto-calculate invoice totals, expense VAT, timestamps
- **Views**: `v_omanization` (dept-level stats), `v_payroll_summary`
- **Functions**: `mark_overdue_invoices()` (run via cron)
- **RLS**: Row-level security enabled on all tables

---

## Security Checklist

- [x] Password hashing (bcrypt, 12 rounds)
- [x] JWT tokens with expiry
- [x] Role-based access control (5 roles)
- [x] Rate limiting (200 req/15min)
- [x] Helmet security headers
- [x] CORS restricted to frontend origin
- [x] SQL injection protection (parameterized queries)
- [x] Audit logging on all mutations
- [x] Input size limits (10MB max)
- [x] Row-level security policies
- [ ] Set up HTTPS (handled by deployment platform)
- [ ] Enable pg_cron for overdue invoice detection
- [ ] Add email verification on registration
- [ ] Implement password reset flow
- [ ] Add 2FA for owner/admin roles

---

## Oman-Specific Compliance

### VAT (5%)
- All invoices auto-calculate 5% VAT per Oman Tax Authority
- Quarterly VAT return preparation with taxable/exempt/zero-rated breakdown
- Input VAT tracking from expenses
- Compliance checklist built into UI

### SPF (Social Protection Fund)
- Employer: 11.75% of basic salary
- Employee: 7% of basic salary
- Government: 5.25% (tracked, not deducted)
- Only Omani employees are eligible (auto-detected via `is_omani` column)

### Omanization
- Sector-specific targets built in (Banking 90%, IT 25%, Retail 20%, etc.)
- Real-time compliance tracking per department
- Gap analysis (how many Omanis needed to hire)

### Bilingual
- Full Arabic/English support
- RTL layout toggle
- All invoices rendered bilingually
- Tax invoice format per Oman requirements (فاتورة ضريبية)

---

## Connecting Frontend to Backend

Replace the static state in `oman-erp.jsx` with API calls:

```javascript
// Example: Replace useState(initEmp) with API fetch
const [emps, setEmps] = useState([]);
useEffect(() => {
  fetch('https://your-api.railway.app/api/employees', {
    headers: { Authorization: 'Bearer ' + token }
  })
  .then(r => r.json())
  .then(data => setEmps(data));
}, []);

// Example: Create employee
async function doSave(form) {
  const res = await fetch('https://your-api.railway.app/api/employees', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify(form)
  });
  const newEmp = await res.json();
  setEmps(prev => [...prev, newEmp]);
}
```

---

## Support & Next Steps

This package gives you a working production backend. To go fully live:

1. Deploy the database, API, and frontend (see Cloud Deployment above)
2. Wire the frontend components to the API endpoints
3. Add a login page component
4. Register your first company through the API
5. Set up a cron job to call `mark_overdue_invoices()` daily
6. Configure email sending for invoice delivery
7. Add your .om domain and SSL certificate

Estimated effort to go from this package to live: **2-3 weeks for 1 developer**.
