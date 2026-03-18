# Oman SME ERP — Free Cloud Deployment (10 minutes)

> **Cost: $0/month** — All three services have generous free tiers.
> **Result:** Live production ERP at `your-app.vercel.app`

---

## Overview

| Service | Purpose | Free Tier | Sign Up |
|---------|---------|-----------|---------|
| **Supabase** | PostgreSQL database | 500MB, 2 projects | [supabase.com](https://supabase.com) |
| **Render** | Node.js API server | 750 hrs/month | [render.com](https://render.com) |
| **Vercel** | React frontend | Unlimited deploys | [vercel.com](https://vercel.com) |

---

## STEP 1: Push Code to GitHub (2 min)

### 1.1 Create a GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `oman-erp`
3. Set to **Private**
4. Click **Create repository**

### 1.2 Push the code

```bash
# Unzip the package
unzip oman-erp-production.zip
cd oman-erp-prod

# Initialize git
git init
git add .
git commit -m "Initial commit - Oman SME ERP"

# Connect to GitHub (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/oman-erp.git
git branch -M main
git push -u origin main
```

---

## STEP 2: Database — Supabase (3 min)

### 2.1 Create project

1. Go to [supabase.com](https://supabase.com) → Sign in with GitHub
2. Click **New Project**
3. Fill in:
   - **Name:** `oman-erp`
   - **Database Password:** (generate a strong one — save it!)
   - **Region:** Choose closest to Oman (e.g., `Central EU - Frankfurt`)
4. Click **Create new project**
5. Wait ~2 minutes for provisioning

### 2.2 Run the database schema

1. In your Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New query**
3. Open the file `database/schema.sql` from the zip
4. Copy the ENTIRE content and paste it into the SQL editor
5. Click **Run** (or Ctrl+Enter)
6. You should see: `Success. No rows returned` — this means all 14 tables are created

### 2.3 Copy connection string

1. Go to **Project Settings** (gear icon, bottom left)
2. Click **Database**
3. Under **Connection string**, select **URI**
4. Copy the connection string — it looks like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
5. **SAVE THIS** — you'll need it for the API server

---

## STEP 3: API Server — Render (3 min)

### 3.1 Create web service

1. Go to [render.com](https://render.com) → Sign in with GitHub
2. Click **New +** → **Web Service**
3. Connect your `oman-erp` GitHub repository
4. Fill in:
   - **Name:** `oman-erp-api`
   - **Region:** `Frankfurt (EU Central)`
   - **Branch:** `main`
   - **Root Directory:** (leave empty)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node api/server.js`
   - **Instance Type:** **Free**

### 3.2 Set environment variables

Scroll down to **Environment Variables** and add these:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | (paste the Supabase connection string from Step 2.3) |
| `JWT_SECRET` | (click "Generate" or type 32+ random characters) |
| `FRONTEND_URL` | `https://oman-erp.vercel.app` (update after Step 4) |

### 3.3 Deploy

1. Click **Create Web Service**
2. Wait ~2 minutes for the first deploy
3. Once live, you'll see a URL like: `https://oman-erp-api.onrender.com`
4. Test it: open `https://oman-erp-api.onrender.com/api/health` in your browser
5. You should see: `{"status":"healthy","timestamp":"..."}`
6. **SAVE THIS URL** — you'll need it for the frontend

---

## STEP 4: Frontend — Vercel (2 min)

### 4.1 Import project

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **Add New...** → **Project**
3. Select your `oman-erp` repository
4. Under **Configure Project**:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** → type `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### 4.2 Set environment variables

Click **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://oman-erp-api.onrender.com` (your Render URL from Step 3.3) |

### 4.3 Deploy

1. Click **Deploy**
2. Wait ~1 minute
3. Your app is live at: `https://oman-erp.vercel.app` (or similar)

### 4.4 Update Render CORS

Go back to Render dashboard → your service → **Environment** → update:

| Key | New Value |
|-----|-----------|
| `FRONTEND_URL` | `https://oman-erp.vercel.app` (your actual Vercel URL) |

Click **Save Changes** — Render auto-redeploys.

---

## STEP 5: Test Your Live App (1 min)

1. Open your Vercel URL in a browser
2. You should see the **login page**
3. Log in with:
   - **Email:** `admin@futuretech.om`
   - **Password:** `admin123`
4. You're in! The full ERP is live.

### Quick test checklist:
- [ ] Dashboard loads with KPI cards
- [ ] Create a new invoice → check it appears in the list
- [ ] Add an employee → verify in employees table
- [ ] Run payroll → view pay slip
- [ ] Add an expense → check totals
- [ ] Export any data → export modal opens with Download button
- [ ] Check VAT page → submit return
- [ ] View Omanization → department cards show targets
- [ ] Settings → change company name → save → verify on invoices
- [ ] Logout → login again

---

## Architecture Diagram

```
┌─────────────────────────────────┐
│         YOUR BROWSER            │
│   https://oman-erp.vercel.app   │
└──────────────┬──────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────┐
│      VERCEL (Free Tier)         │
│   Static React/Vite Frontend    │
│   Auto-SSL, Global CDN          │
└──────────────┬──────────────────┘
               │ API calls (/api/*)
               ▼
┌─────────────────────────────────┐
│      RENDER (Free Tier)         │
│   Node.js + Express API         │
│   JWT Auth, Rate Limiting       │
│   750 free hours/month          │
└──────────────┬──────────────────┘
               │ PostgreSQL
               ▼
┌─────────────────────────────────┐
│     SUPABASE (Free Tier)        │
│   PostgreSQL 15 Database        │
│   500MB storage, 2 projects     │
│   Auto-backups, Dashboard       │
└─────────────────────────────────┘
```

---

## Troubleshooting

### "Cannot connect to database"
- Check your `DATABASE_URL` on Render — make sure you used the **pooler** connection string from Supabase (port 6543, not 5432)
- Make sure password has no special characters that need URL-encoding

### "CORS error" in browser console
- Update `FRONTEND_URL` on Render to match your exact Vercel URL (including `https://`)
- Redeploy the Render service

### "Login fails"
- Make sure you ran `schema.sql` in Supabase SQL Editor (Step 2.2)
- The seed data creates the demo user `admin@futuretech.om`

### Render service sleeps after inactivity
- Free tier services spin down after 15 min of no traffic
- First request after sleep takes ~30 seconds (cold start)
- For production: upgrade to Render Starter ($7/mo) for always-on

### Build fails on Vercel
- Make sure **Root Directory** is set to `frontend`
- Make sure `VITE_API_URL` is set (without trailing slash)

---

## Custom Domain (Optional)

### Add your .om domain

**Vercel:**
1. Go to Project Settings → Domains
2. Add `erp.yourcompany.om`
3. Update your DNS: add CNAME record pointing to `cname.vercel-dns.com`

**Render:**
1. Go to Service Settings → Custom Domains
2. Add `api.yourcompany.om`
3. Update DNS with the provided CNAME

---

## Next Steps After Deployment

1. **Change the default password** — log in and update via Settings
2. **Set up a cron job** for overdue invoice detection — use Supabase pg_cron or a free cron service like cron-job.org to hit `/api/health` every 15 min (also keeps Render from sleeping)
3. **Add more users** — use the Register page or create them via Supabase dashboard
4. **Enable Supabase backups** — automatic on free tier (daily, 7-day retention)
5. **Monitor** — Render provides free logging; Supabase has a built-in SQL dashboard

---

## Monthly Cost Summary

| Service | Free Tier Limits | When to Upgrade |
|---------|-----------------|-----------------|
| Supabase | 500MB DB, 1GB transfer | >500MB data or need realtime |
| Render | 750 hrs, sleeps after 15min idle | Need always-on ($7/mo) |
| Vercel | 100GB bandwidth, 100 deploys | >100GB bandwidth |

**Total: $0/month** for a small team (1-10 users).
For a team of 10-50 users with no downtime: ~$7/month (Render Starter only).
