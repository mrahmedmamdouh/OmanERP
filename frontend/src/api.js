// ═══════════════════════════════════════════════════════════════
// API Client — maps every frontend action to a backend endpoint
// ═══════════════════════════════════════════════════════════════

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

let _token = null;
export function setToken(t) { _token = t; }
export function getToken() { return _token; }
export function clearToken() { _token = null; }

async function req(method, path, body) {
  const url = BASE + path;
  const headers = { "Content-Type": "application/json" };
  if (_token) headers["Authorization"] = "Bearer " + _token;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error("Cannot reach server. Check VITE_API_URL (" + (BASE || "empty") + ")");
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    throw new Error("Server returned invalid response (status " + res.status + ")");
  }

  if (!res.ok) throw new Error(data.error || "Request failed (status " + res.status + ")");
  return data;
}

// ─── AUTH ────────────────────────────────────────────────────
export async function login(email, password) {
  const data = await req("POST", "/api/auth/login", { email, password });
  setToken(data.token);
  return data;
}

export async function register(form) {
  const data = await req("POST", "/api/auth/register", form);
  setToken(data.token);
  return data;
}

export async function getMe() {
  return req("GET", "/api/auth/me");
}

// ─── DASHBOARD ──────────────────────────────────────────────
export async function getDashboard() {
  return req("GET", "/api/dashboard");
}

// ─── EMPLOYEES ──────────────────────────────────────────────
export async function getEmployees() {
  const rows = await req("GET", "/api/employees");
  // Map DB fields → frontend fields
  return rows.map(function (e) {
    return {
      id: e.id,
      name: e.name_ar || "",
      nameEn: e.name_en,
      nat: e.nationality,
      dept: e.department,
      salary: parseFloat(e.basic_salary),
      allow: parseFloat(e.allowances || 0),
      roleEn: e.role_title_en || "",
      join: e.join_date,
      spf: e.spf_number || "—",
      email: e.email || "",
      bank: e.bank_name || "",
      iban: e.iban || "",
      status: e.status,
    };
  });
}

export async function createEmployee(form) {
  // Map frontend fields → DB fields
  const data = await req("POST", "/api/employees", {
    name_ar: form.name,
    name_en: form.nameEn,
    nationality: form.nat,
    department: form.dept,
    role_title_en: form.roleEn,
    basic_salary: form.salary,
    allowances: form.allow,
    email: form.email,
    bank_name: form.bank,
    iban: form.iban,
    join_date: form.join || new Date().toISOString().slice(0, 10),
  });
  return {
    id: data.id,
    name: data.name_ar || "",
    nameEn: data.name_en,
    nat: data.nationality,
    dept: data.department,
    salary: parseFloat(data.basic_salary),
    allow: parseFloat(data.allowances || 0),
    roleEn: data.role_title_en || "",
    join: data.join_date,
    spf: data.spf_number || "—",
    email: data.email || "",
    bank: data.bank_name || "",
    iban: data.iban || "",
  };
}

export async function updateEmployee(id, form) {
  const data = await req("PUT", "/api/employees/" + id, {
    name_ar: form.name,
    name_en: form.nameEn,
    nationality: form.nat,
    department: form.dept,
    role_title_en: form.roleEn,
    basic_salary: form.salary,
    allowances: form.allow,
    email: form.email,
    phone: form.phone,
    bank_name: form.bank,
    iban: form.iban,
  });
  return data;
}

export async function deleteEmployee(id) {
  return req("DELETE", "/api/employees/" + id);
}

// ─── INVOICES ───────────────────────────────────────────────
export async function getInvoices() {
  const rows = await req("GET", "/api/invoices");
  return rows.map(function (inv) {
    var items = (inv.items || []).filter(function (i) { return i.id !== null; });
    return {
      id: inv.invoice_number || inv.id,
      _dbId: inv.id,
      client: inv.client_name_ar || "",
      clientEn: inv.client_name_en,
      date: inv.issue_date,
      due: inv.due_date,
      status: inv.status,
      cur: inv.currency || "OMR",
      notes: inv.notes || "",
      items: items.map(function (i) {
        return {
          desc: i.description_ar || "",
          descEn: i.description_en || "",
          qty: parseFloat(i.quantity),
          price: parseFloat(i.unit_price),
        };
      }),
    };
  });
}

export async function createInvoice(form) {
  return req("POST", "/api/invoices", {
    client_name_ar: form.client,
    client_name_en: form.clientEn,
    currency: form.cur || "OMR",
    due_date: form.due || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    notes: form.notes,
    items: (form.items || []).map(function (i, idx) {
      return {
        description_ar: i.desc,
        description_en: i.descEn,
        quantity: i.qty,
        unit_price: i.price,
        sort_order: idx,
      };
    }),
  });
}

export async function updateInvoiceStatus(dbId, status) {
  return req("PATCH", "/api/invoices/" + dbId + "/status", { status: status });
}

export async function deleteInvoice(dbId) {
  return req("DELETE", "/api/invoices/" + dbId);
}

// ─── EXPENSES ───────────────────────────────────────────────
export async function getExpenses() {
  const rows = await req("GET", "/api/expenses");
  return rows.map(function (e) {
    return {
      id: e.id,
      descEn: e.description_en,
      amount: parseFloat(e.amount),
      date: e.expense_date,
      cat: e.category,
      vatI: e.vat_included,
      vendor: e.vendor || "",
    };
  });
}

export async function createExpense(form) {
  return req("POST", "/api/expenses", {
    description_en: form.descEn,
    description_ar: form.descAr,
    amount: form.amount,
    category: form.cat,
    vendor: form.vendor,
    expense_date: form.date || new Date().toISOString().slice(0, 10),
    vat_included: form.vatI || false,
  });
}

export async function deleteExpense(id) {
  return req("DELETE", "/api/expenses/" + id);
}

// ─── PAYROLL ────────────────────────────────────────────────
export async function runPayroll(month, year) {
  return req("POST", "/api/payroll/run", { month: month, year: year });
}

export async function getPayrollDetail(runId) {
  const rows = await req("GET", "/api/payroll/" + runId);
  return rows.map(function (r) {
    return {
      nameEn: r.name_en,
      name: r.name_ar || "",
      dept: r.department,
      roleEn: r.role_title_en || "",
      nat: r.nationality,
      bank: r.bank_name || "",
      iban: r.iban || "",
      basic: parseFloat(r.basic_salary),
      al: parseFloat(r.allowances),
      gross: parseFloat(r.gross),
      spfE: parseFloat(r.spf_employee),
      net: parseFloat(r.net_pay),
    };
  });
}

// ─── VAT ────────────────────────────────────────────────────
export async function getVATSummary() {
  return req("GET", "/api/vat/summary");
}

export async function submitVATReturn(data) {
  return req("POST", "/api/vat/returns", data);
}

// ─── SPF ────────────────────────────────────────────────────
export async function getSPFSummary() {
  return req("GET", "/api/spf/summary");
}

// ─── OMANIZATION ────────────────────────────────────────────
export async function getOmanization() {
  const rows = await req("GET", "/api/omanization");
  return rows.map(function (r) {
    return {
      dept: r.department,
      t: parseInt(r.total_employees),
      o: parseInt(r.omani_count),
      pct: parseInt(r.omani_pct),
    };
  });
}

// ─── REPORTS ────────────────────────────────────────────────
export async function getPnL() {
  return req("GET", "/api/reports/pnl");
}

// ─── COMPANY SETTINGS ───────────────────────────────────────
export async function getCompany() {
  const c = await req("GET", "/api/company");
  return {
    nameAr: c.name_ar,
    nameEn: c.name_en,
    cr: c.cr_number || "",
    taxId: c.tax_id || "",
    address: c.address || "",
    city: c.city || "",
    phone: c.phone || "",
    email: c.email || "",
  };
}

export async function updateCompany(form) {
  return req("PUT", "/api/company", {
    name_ar: form.nameAr,
    name_en: form.nameEn,
    cr_number: form.cr,
    tax_id: form.taxId,
    address: form.address,
    city: form.city,
    phone: form.phone,
    email: form.email,
  });
}

// ─── NOTIFICATIONS ──────────────────────────────────────────
export async function getNotifications() {
  return req("GET", "/api/notifications");
}

export async function markNotificationsRead() {
  return req("PATCH", "/api/notifications/read");
}

// ─── STATUS CHECKS (persist across refresh) ─────────────────
export async function getVATReturns() {
  return req("GET", "/api/vat/returns");
}

export async function getSPFSubmissions() {
  return req("GET", "/api/spf/submissions");
}

export async function submitSPF(data) {
  return req("POST", "/api/spf/submit", data);
}

export async function getPayrollRuns() {
  return req("GET", "/api/payroll/runs");
}

// ─── BULK IMPORT ────────────────────────────────────────────
export async function importEmployees(items) {
  return req("POST", "/api/employees/import", { items: items });
}

export async function importInvoices(items) {
  return req("POST", "/api/invoices/import", { items: items });
}

export async function importExpenses(items) {
  return req("POST", "/api/expenses/import", { items: items });
}

// ─── INVOICE EXTRAS ─────────────────────────────────────────
export async function duplicateInvoice(idOrNumber) {
  return req("POST", "/api/invoices/" + idOrNumber + "/duplicate", {});
}

// ─── PRODUCTS CATALOG ───────────────────────────────────────
export async function getProducts() {
  return req("GET", "/api/products");
}

export async function lookupBarcode(code) {
  return req("GET", "/api/products/barcode/" + encodeURIComponent(code));
}

export async function searchProducts(q) {
  return req("GET", "/api/products/search?q=" + encodeURIComponent(q));
}

export async function createProduct(form) {
  return req("POST", "/api/products", form);
}

export async function updateProduct(id, form) {
  return req("PUT", "/api/products/" + id, form);
}

export async function deleteProduct(id) {
  return req("DELETE", "/api/products/" + id);
}

export async function importProducts(items) {
  return req("POST", "/api/products/import", { items: items });
}

// ═══════════════════════════════════════════════════════════════
// HIGH-PRIORITY FEATURES
// ═══════════════════════════════════════════════════════════════

// ─── CHART OF ACCOUNTS ──────────────────────────────────────
export async function getAccounts() { return req("GET", "/api/accounts"); }
export async function createAccount(form) { return req("POST", "/api/accounts", form); }
export async function updateAccount(id, form) { return req("PUT", "/api/accounts/" + id, form); }

// ─── JOURNAL ENTRIES ────────────────────────────────────────
export async function getJournals() { return req("GET", "/api/journals"); }
export async function createJournal(form) { return req("POST", "/api/journals", form); }
export async function postJournal(id) { return req("PATCH", "/api/journals/" + id + "/post", {}); }

// ─── FINANCIAL REPORTS ──────────────────────────────────────
export async function getBalanceSheet() { return req("GET", "/api/reports/balance-sheet"); }
export async function getCashFlow() { return req("GET", "/api/reports/cash-flow"); }
export async function getARaging() { return req("GET", "/api/reports/ar-aging"); }
export async function getAPaging() { return req("GET", "/api/reports/ap-aging"); }

// ─── CONTACTS ───────────────────────────────────────────────
export async function getContacts(type) { return req("GET", "/api/contacts" + (type ? "?type=" + type : "")); }
export async function createContact(form) { return req("POST", "/api/contacts", form); }
export async function updateContact(id, form) { return req("PUT", "/api/contacts/" + id, form); }
export async function deleteContact(id) { return req("DELETE", "/api/contacts/" + id); }

// ─── QUOTATIONS ─────────────────────────────────────────────
export async function getQuotations() { return req("GET", "/api/quotations"); }
export async function createQuotation(form) { return req("POST", "/api/quotations", form); }
export async function updateQuotationStatus(id, status) { return req("PATCH", "/api/quotations/" + id + "/status", { status: status }); }
export async function convertQuotation(id) { return req("POST", "/api/quotations/" + id + "/convert", {}); }

// ─── PURCHASE ORDERS ────────────────────────────────────────
export async function getPurchaseOrders() { return req("GET", "/api/purchase-orders"); }
export async function createPurchaseOrder(form) { return req("POST", "/api/purchase-orders", form); }
export async function updatePOStatus(id, status) { return req("PATCH", "/api/purchase-orders/" + id + "/status", { status: status }); }

// ─── LEAVE MANAGEMENT ───────────────────────────────────────
export async function getLeaveTypes() { return req("GET", "/api/leave-types"); }
export async function getLeaves() { return req("GET", "/api/leaves"); }
export async function createLeave(form) { return req("POST", "/api/leaves", form); }
export async function updateLeaveStatus(id, status) { return req("PATCH", "/api/leaves/" + id + "/status", { status: status }); }

// ─── ATTENDANCE ─────────────────────────────────────────────
export async function getAttendance(date) { return req("GET", "/api/attendance?date=" + (date || new Date().toISOString().slice(0,10))); }
export async function recordAttendance(form) { return req("POST", "/api/attendance", form); }
export async function bulkAttendance(items) { return req("POST", "/api/attendance/bulk", { items: items }); }

// ─── WPS & STOCK ALERTS ─────────────────────────────────────
export async function generateWPS() { return req("GET", "/api/wps/generate"); }
export async function getStockAlerts() { return req("GET", "/api/stock-alerts"); }

// ─── BULK IMPORTS FOR NEW ENTITIES ──────────────────────────
export async function importContacts(items) { return req("POST", "/api/contacts/import", { items: items }); }
export async function importQuotations(items) { return req("POST", "/api/quotations/import", { items: items }); }
export async function importPurchaseOrders(items) { return req("POST", "/api/purchase-orders/import", { items: items }); }
export async function importLeaves(items) { return req("POST", "/api/leaves/import", { items: items }); }

// ─── SAAS BILLING ───────────────────────────────────────────
export async function getPlans() { return req("GET", "/api/plans"); }
export async function subscribe(form) {
  var data = await req("POST", "/api/subscribe", form);
  if (data.token) setToken(data.token);
  return data;
}
export async function getBilling() { return req("GET", "/api/billing"); }
export async function upgradePlan(plan, paymentRef) { return req("POST", "/api/billing/upgrade", { plan: plan, payment_ref: paymentRef }); }
export async function markOnboardingDone() { return req("POST", "/api/billing/onboarding-done", {}); }
export async function getPaymentHistory() { return req("GET", "/api/billing/payments"); }
