#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Push Oman ERP to GitHub
# Run this ONCE after unzipping oman-erp-production.zip
# ═══════════════════════════════════════════════════════════

set -e

echo "📦 Setting up Oman ERP repository..."

# Enter project directory
cd oman-erp-prod

# Initialize git
git init
git checkout -b main

# Configure (optional — uses your global git config)
# git config user.name "Your Name"
# git config user.email "your@email.com"

# Add all files
git add -A

# Commit
git commit -m "🚀 Oman SME ERP — Full production stack

Backend: Express + PostgreSQL + JWT auth (25 API endpoints)
Frontend: React + Vite (10 modules, bilingual AR/EN)
Database: 14 tables with triggers, views, RLS, audit log
Deploy configs: Render, Vercel, Netlify, Docker, GitHub Actions
Oman compliance: VAT 5%, SPF contributions, Omanization tracking"

# Connect to GitHub
git remote add origin https://github.com/mrahmedmamdouh/OmanERP.git

# Push
git push -u origin main --force

echo ""
echo "✅ Done! Your ERP is live at:"
echo "   https://github.com/mrahmedmamdouh/OmanERP"
echo ""
echo "Next steps:"
echo "   1. Create Supabase project → run database/schema.sql"
echo "   2. Deploy API on Render → connect this repo"
echo "   3. Deploy frontend on Vercel → root dir: frontend"
echo "   See DEPLOY.md for full instructions."
