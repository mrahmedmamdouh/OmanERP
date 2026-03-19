import { useState, useCallback, useMemo, useEffect } from "react";
import * as api from "./api.js";

// ─── Constants (still needed for targets display) ───
var VAT=0.05,SPF_ER=0.1175,SPF_EE=0.07,SPF_GV=0.0525;
var TARGETS={"IT & Telecom":25,Banking:90,Retail:20,Tourism:30,Construction:15,Manufacturing:20,Education:50,Healthcare:40,"Oil & Gas":60,Transport:30,"General Trading":15};
var DEPTS=Object.keys(TARGETS);

// ─── Helpers ───
function fmt(n,c){c=c||"OMR";var v=typeof n==="number"?n:0;var s={OMR:" ر.ع",AED:" د.إ",SAR:" ر.س"};return(c==="USD"?"$":"")+v.toFixed(c==="OMR"?3:2)+(s[c]||"");}
function fD(d){if(!d)return"—";return new Date(d).toLocaleDateString("en-GB",{year:"numeric",month:"short",day:"numeric"});}
function iTotal(inv){var s=0;for(var i=0;i<(inv.items||[]).length;i++)s+=(inv.items[i].qty||0)*(inv.items[i].price||0);return s;}
function iVat(inv){return iTotal(inv)*VAT;}
function iGrand(inv){return iTotal(inv)*(1+VAT);}
function uid(){return Math.random().toString(36).slice(2,8);}
function buildCSV(h,r){var lines=[h.join(",")];for(var i=0;i<r.length;i++){var c=[];for(var j=0;j<r[i].length;j++)c.push('"'+String(r[i][j]).replace(/"/g,'""')+'"');lines.push(c.join(","));}return lines.join("\n");}
function buildJSON(d){return JSON.stringify(d,null,2);}

// ─── Translations ───
var TR={
  en:{dashboard:"Dashboard",revenue:"Revenue",vatDue:"VAT Due",employees:"Employees",omani:"Omani",expat:"Expat",total:"Total",spfMonth:"Monthly SPF",payroll:"Payroll",invoices:"Invoices",pending:"Pending",overdue:"Overdue",paid:"Paid",cancelled:"Cancelled",invNo:"Invoice #",client:"Client",date:"Date",subtotal:"Subtotal",vat:"VAT",status:"Status",recentInv:"Recent Invoices",omanOv:"Omanization",newInv:"New Invoice",clientAr:"Client (AR)",clientEn:"Client (EN)",descAr:"Desc (AR)",descEn:"Desc (EN)",qty:"Qty",price:"Price",addItem:"+ Add Item",create:"Create",back:"\u2190 Back",addEmp:"Add Employee",editEmp:"Edit Employee",nameAr:"Name (AR)",nameEn:"Name (EN)",nationality:"Nationality",department:"Department",salary:"Salary",role:"Role",joinDate:"Joined",save:"Save",name:"Name",cancel:"Cancel",confirm:"Confirm",confirmDel:"Confirm delete?",vatComp:"VAT Compliance",outputVAT:"Output VAT",inputVAT:"Input VAT",netVAT:"Net VAT",vatReturn:"VAT Return",download:"Download",submit:"Submit",checklist:"Checklist",taxReg:"Tax Registered",invOk:"Invoices OK",retFiled:"Return Filed",payDone:"Payment Done",recsKept:"Records Kept 5yr",spf:"Social Protection",erContrib:"Employer",eeContrib:"Employee",gvContrib:"Government",monthlyTotal:"Monthly Total",eligible:"eligible",employer:"Employer",employee:"Employee",govt:"Govt",spfNo:"SPF #",basicSal:"Basic Salary",erShare:"ER Share",eeShare:"EE Share",totalCont:"Total",dlSPF:"Export SPF",submitSPF:"Submit SPF",oman:"Omanization",overallRate:"Overall",compliant:"Compliant",nonComp:"Non-Compliant",actionNeeded:"Action Needed",current:"Current",target:"Target",needHire:"Need to hire",moreOmanis:"more Omanis",payrollMod:"Payroll",basic:"Basic",allowances:"Allowances",netPay:"Net Pay",spfDed:"SPF Ded.",runPayroll:"Run Payroll",payslip:"Pay Slip",payslipTitle:"Monthly Pay Slip",expenses:"Expenses",addExp:"Add Expense",category:"Category",vendor:"Vendor",amount:"Amount",vatInc:"VAT Incl.",reports:"Reports",incomeStatement:"Income Statement",totalIncome:"Income",totalExp:"Expenses",netProfit:"Net Profit",grossMargin:"Margin",settings:"Settings",compAr:"Company (AR)",compEn:"Company (EN)",crNo:"CR No.",taxId:"Tax ID",address:"Address",email:"Email",language:"Language",saveSettings:"Save Settings",export:"Export",print:"Print",emailInv:"Email",markPaid:"Mark Paid",cancelInv:"Cancel Invoice",duplicate:"Duplicate",search:"Search...",notifications:"Notifications",noNotif:"No notifications",clearAll:"Clear All",logout:"Logout",appTitle:"Oman SME ERP",connected:"Connected",taxableSales:"Taxable Sales",deductible:"Deductible Input",netPayable:"Net Payable",submitted:"Submitted",done:"Done",running:"Running...",submitting:"Submitting...",saving:"Saving...",creating:"Creating...",adding:"Adding...",deleting:"Deleting...",dataExport:"Data Export",fullBackup:"Full Backup (JSON)",empCSV:"Employees CSV",invCSV:"Invoices CSV",companyInfo:"Company Info",signIn:"Sign In",createAccount:"Create Account",signInSub:"Sign in to your account",registerSub:"Create your company account",yourName:"Your Name",compName:"Company Name",compNameAr:"\u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629",noAccount:"No account? Register",hasAccount:"Have an account? Sign In",gross:"Gross",description:"Description",all:"All",close:"Close",copy:"Copy",taxInvoice:"Tax Invoice",net:"Net",costs:"Costs",profit:"Profit",margin:"Margin",income:"Income",importCSV:"Import CSV",importSheet:"Import Spreadsheet",dlTemplate:"Download Template",importing:"Importing...",imported:"Imported",rows:"rows",preview:"Preview",selectFile:"Select CSV File",duplicateInv:"Duplicate Invoice",quickInv:"Quick Invoice",recurInv:"Recurring Invoice",createFrom:"Create From...",dragDrop:"Drop CSV file here or click to browse",mapCols:"Column Mapping",importNow:"Import Now",skipHeader:"First row is header",products:"Products",barcode:"Barcode",sku:"SKU",unitPrice:"Unit Price",costPrice:"Cost Price",unit:"Unit",stockQty:"Stock",addProduct:"Add Product",editProduct:"Edit Product",scanBarcode:"Scan Barcode",scanHint:"Scan barcode or type code + Enter",productFound:"Product found",productNotFound:"Product not found",piece:"piece",hour:"hour",box:"box",kg:"kg",meter:"meter",catalog:"Catalog",accounting:"Accounting",chartOfAccounts:"Chart of Accounts",journalEntries:"Journal Entries",balanceSheet:"Balance Sheet",cashFlow:"Cash Flow",arAging:"AR Aging",apAging:"AP Aging",contacts:"Contacts",customers:"Customers",vendors:"Vendors",quotations:"Quotations",purchaseOrders:"Purchase Orders",leavesMgmt:"Leave Mgmt",attendance:"Attendance",wps:"WPS File",contactType:"Type",phone:"Phone",creditLimit:"Credit Limit",paymentTerms:"Payment Terms",days:"days",quoteNo:"Quote #",poNo:"PO #",vendorName:"Vendor",validUntil:"Valid Until",convertToInv:"Convert to Invoice",leaveType:"Leave Type",startDate:"Start",endDate:"End",reason:"Reason",approve:"Approve",reject:"Reject",checkIn:"Check In",checkOut:"Check Out",hoursWorked:"Hours",present:"Present",absent:"Absent",late:"Late",halfDay:"Half Day",onLeave:"On Leave",generateWPS:"Generate WPS",debit:"Debit",credit:"Credit",post:"Post",posted:"Posted",draft:"Draft",sent:"Sent",accepted:"Accepted",rejected:"Rejected",converted:"Converted",confirmed:"Confirmed",received:"Received",assets:"Assets",liabilities:"Liabilities",equity:"Equity",accountCode:"Code",accountType:"Type",newJournal:"New Journal Entry",newQuotation:"New Quotation",newPO:"New Purchase Order",newContact:"New Contact",newLeave:"New Leave Request",customer:"Customer",both:"Both",notes:"Notes",reference:"Reference",current30:"Current",past30:"1-30 days",past60:"31-60 days",past90:"61-90 days",past90plus:"90+ days",heroTitle:"Smart ERP for Oman SMEs",heroSub:"Invoicing, Payroll, VAT, SPF, Omanization — all in one bilingual platform.",getStarted:"Get Started Free",viewPricing:"View Pricing",pricing:"Pricing",perMonth:"/month",features14:"14-day free trial",noCard:"No credit card required",planTrial:"Free Trial",planStarter:"Starter",planPro:"Professional",planEnt:"Enterprise",popular:"Most Popular",choosePlan:"Choose Plan",trialDays:"days left in trial",upgrade:"Upgrade",planExpired:"Plan expired",setupWizard:"Setup Your Company",step1:"Company Info",step2:"First Employee",step3:"First Product",skip:"Skip",next:"Next",finish:"Finish Setup",welcomeMsg:"Welcome to your ERP!",trialBanner:"Trial",users:"users",empLimit:"employees",invLimit:"invoices/month",featInv:"Create, print, email, duplicate, barcode scanner",featEmp:"Full HR + payroll + SPF + Omanization",featVat:"5% Oman VAT with quarterly returns",featAcct:"Chart of accounts, journal entries, balance sheet",featContacts:"Customer & vendor database with aging reports",featQuotes:"Quote → Accept → Convert to invoice",password:"Password"},
  ar:{dashboard:"لوحة المعلومات",revenue:"الإيرادات",vatDue:"ضريبة مستحقة",employees:"الموظفون",omani:"عُماني",expat:"وافد",total:"الإجمالي",spfMonth:"اشتراكات الحماية",payroll:"الرواتب",invoices:"الفواتير",pending:"معلقة",overdue:"متأخرة",paid:"مدفوعة",cancelled:"ملغاة",invNo:"رقم الفاتورة",client:"العميل",date:"التاريخ",subtotal:"الفرعي",vat:"ض.ق.م",status:"الحالة",recentInv:"أحدث الفواتير",omanOv:"نظرة التعمين",newInv:"فاتورة جديدة",clientAr:"العميل (ع)",clientEn:"العميل (EN)",descAr:"الوصف (ع)",descEn:"الوصف (EN)",qty:"الكمية",price:"السعر",addItem:"+ إضافة بند",create:"إنشاء",back:"→ رجوع",addEmp:"إضافة موظف",editEmp:"تعديل موظف",nameAr:"الاسم (ع)",nameEn:"الاسم (EN)",nationality:"الجنسية",department:"القسم",salary:"الراتب",role:"الوظيفة",joinDate:"الالتحاق",save:"حفظ",name:"الاسم",cancel:"إلغاء",confirm:"تأكيد",confirmDel:"تأكيد الحذف؟",vatComp:"الامتثال الضريبي",outputVAT:"ضريبة المخرجات",inputVAT:"ضريبة المدخلات",netVAT:"صافي الضريبة",vatReturn:"الإقرار الضريبي",download:"تحميل",submit:"تقديم",checklist:"قائمة الامتثال",taxReg:"مسجل ضريبياً",invOk:"فواتير متوافقة",retFiled:"تم تقديم الإقرار",payDone:"تم السداد",recsKept:"سجلات محفوظة ٥ سنوات",spf:"صندوق الحماية الاجتماعية",erContrib:"حصة المنشأة",eeContrib:"حصة الموظف",gvContrib:"حصة الحكومة",monthlyTotal:"إجمالي شهري",eligible:"مؤهل",employer:"صاحب العمل",employee:"الموظف",govt:"الحكومة",spfNo:"رقم الحماية",basicSal:"الراتب الأساسي",erShare:"حصة المنشأة",eeShare:"حصة الموظف",totalCont:"الإجمالي",dlSPF:"تصدير الحماية",submitSPF:"تقديم للصندوق",oman:"التعمين",overallRate:"النسبة الإجمالية",compliant:"ملتزم",nonComp:"غير ملتزم",actionNeeded:"يتطلب إجراء",current:"الحالي",target:"المستهدف",needHire:"يجب توظيف",moreOmanis:"عُمانيين إضافيين",payrollMod:"كشف الرواتب",basic:"أساسي",allowances:"بدلات",netPay:"صافي الراتب",spfDed:"خصم الحماية",runPayroll:"تشغيل الرواتب",payslip:"قسيمة الراتب",payslipTitle:"قسيمة الراتب الشهرية",expenses:"المصروفات",addExp:"إضافة مصروف",category:"الفئة",vendor:"المورد",amount:"المبلغ",vatInc:"شامل الضريبة",reports:"التقارير",incomeStatement:"قائمة الدخل",totalIncome:"الدخل",totalExp:"المصروفات",netProfit:"صافي الربح",grossMargin:"هامش الربح",settings:"الإعدادات",compAr:"الشركة (عربي)",compEn:"الشركة (إنجليزي)",crNo:"السجل التجاري",taxId:"الرقم الضريبي",address:"العنوان",email:"البريد",language:"اللغة",saveSettings:"حفظ الإعدادات",export:"تصدير",print:"طباعة",emailInv:"إرسال",markPaid:"تحديد كمدفوعة",cancelInv:"إلغاء الفاتورة",duplicate:"نسخ",search:"بحث...",notifications:"الإشعارات",noNotif:"لا إشعارات",clearAll:"مسح الكل",logout:"تسجيل الخروج",appTitle:"نظام إدارة المنشآت",connected:"متصل",taxableSales:"مبيعات خاضعة",deductible:"مدخلات قابلة للخصم",netPayable:"صافي مستحق",submitted:"تم التقديم",done:"تم",running:"جاري التشغيل...",submitting:"جاري التقديم...",saving:"جاري الحفظ...",creating:"جاري الإنشاء...",adding:"جاري الإضافة...",deleting:"جاري الحذف...",dataExport:"تصدير البيانات",fullBackup:"نسخة احتياطية كاملة",empCSV:"الموظفون CSV",invCSV:"الفواتير CSV",companyInfo:"بيانات الشركة",signIn:"تسجيل الدخول",createAccount:"إنشاء حساب",signInSub:"سجل الدخول إلى حسابك",registerSub:"أنشئ حساب شركتك",yourName:"اسمك",compName:"اسم الشركة (إنجليزي)",compNameAr:"اسم الشركة (عربي)",noAccount:"ليس لديك حساب؟ سجل الآن",hasAccount:"لديك حساب؟ سجل الدخول",gross:"الإجمالي",description:"الوصف",all:"الكل",close:"إغلاق",copy:"نسخ",taxInvoice:"فاتورة ضريبية",importCSV:"استيراد CSV",importSheet:"استيراد جدول بيانات",dlTemplate:"تحميل القالب",importing:"جاري الاستيراد...",imported:"تم الاستيراد",rows:"صفوف",preview:"معاينة",selectFile:"اختر ملف CSV",duplicateInv:"نسخ الفاتورة",quickInv:"فاتورة سريعة",recurInv:"فاتورة دورية",createFrom:"إنشاء من...",dragDrop:"اسحب ملف CSV هنا أو اضغط للتصفح",mapCols:"تعيين الأعمدة",importNow:"استيراد الآن",skipHeader:"الصف الأول عنوان",products:"المنتجات",barcode:"الباركود",sku:"رمز المنتج",unitPrice:"سعر الوحدة",costPrice:"سعر التكلفة",unit:"الوحدة",stockQty:"المخزون",addProduct:"إضافة منتج",editProduct:"تعديل منتج",scanBarcode:"مسح الباركود",scanHint:"امسح الباركود أو اكتب الرمز + Enter",productFound:"تم العثور على المنتج",productNotFound:"المنتج غير موجود",piece:"قطعة",hour:"ساعة",box:"صندوق",kg:"كجم",meter:"متر",catalog:"الكتالوج",accounting:"المحاسبة",chartOfAccounts:"دليل الحسابات",journalEntries:"القيود اليومية",balanceSheet:"الميزانية العمومية",cashFlow:"التدفق النقدي",arAging:"أعمار الذمم المدينة",apAging:"أعمار الذمم الدائنة",contacts:"جهات الاتصال",customers:"العملاء",vendors:"الموردون",quotations:"عروض الأسعار",purchaseOrders:"أوامر الشراء",leavesMgmt:"إدارة الإجازات",attendance:"الحضور",wps:"ملف WPS",contactType:"النوع",phone:"الهاتف",creditLimit:"حد الائتمان",paymentTerms:"شروط الدفع",days:"يوم",quoteNo:"رقم العرض",poNo:"رقم أمر الشراء",vendorName:"المورد",validUntil:"صالح حتى",convertToInv:"تحويل لفاتورة",leaveType:"نوع الإجازة",startDate:"البداية",endDate:"النهاية",reason:"السبب",approve:"موافقة",reject:"رفض",checkIn:"دخول",checkOut:"خروج",hoursWorked:"الساعات",present:"حاضر",absent:"غائب",late:"متأخر",halfDay:"نصف يوم",onLeave:"إجازة",generateWPS:"إنشاء ملف WPS",debit:"مدين",credit:"دائن",post:"ترحيل",posted:"مرحّل",draft:"مسودة",sent:"مرسل",accepted:"مقبول",rejected:"مرفوض",converted:"محوّل",confirmed:"مؤكد",received:"مستلم",assets:"الأصول",liabilities:"الالتزامات",equity:"حقوق الملكية",accountCode:"الرمز",accountType:"النوع",newJournal:"قيد جديد",newQuotation:"عرض سعر جديد",newPO:"أمر شراء جديد",newContact:"جهة اتصال جديدة",newLeave:"طلب إجازة جديد",customer:"عميل",both:"كلاهما",notes:"ملاحظات",reference:"المرجع",current30:"جاري",past30:"1-30 يوم",past60:"31-60 يوم",past90:"61-90 يوم",past90plus:"90+ يوم",heroTitle:"نظام ERP ذكي للمنشآت العُمانية",heroSub:"الفوترة، الرواتب، الضريبة، الحماية الاجتماعية، التعمين — في منصة واحدة ثنائية اللغة.",getStarted:"ابدأ مجاناً",viewPricing:"عرض الأسعار",pricing:"الأسعار",perMonth:"/شهرياً",features14:"تجربة مجانية 14 يوم",noCard:"بدون بطاقة ائتمان",planTrial:"تجربة مجانية",planStarter:"أساسي",planPro:"احترافي",planEnt:"مؤسسي",popular:"الأكثر شعبية",choosePlan:"اختر الخطة",trialDays:"يوم متبقي",upgrade:"ترقية",planExpired:"انتهت الخطة",setupWizard:"إعداد شركتك",step1:"بيانات الشركة",step2:"أول موظف",step3:"أول منتج",skip:"تخطي",next:"التالي",finish:"إنهاء الإعداد",welcomeMsg:"مرحباً بك في نظامك!",trialBanner:"تجربة",users:"مستخدمين",empLimit:"موظف",invLimit:"فاتورة/شهرياً",featInv:"إنشاء، طباعة، إرسال، نسخ، ماسح الباركود",featEmp:"إدارة الموارد البشرية + الرواتب + الحماية الاجتماعية + التعمين",featVat:"ضريبة القيمة المضافة 5% مع الإقرارات الفصلية",featAcct:"دليل الحسابات، القيود اليومية، الميزانية العمومية",featContacts:"قاعدة بيانات العملاء والموردين مع تقارير أعمار الذمم",featQuotes:"عرض سعر ← قبول ← تحويل إلى فاتورة",password:"كلمة المرور"}
};

// ─── Icons ───
function Ic(p){return <svg width={p.s||18} height={p.s||18} viewBox="0 0 24 24" fill="none" stroke={p.c||"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={p.d}/></svg>;}
var ic={home:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",file:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8",users:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87",dollar:"M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",flag:"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7",gear:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33",plus:"M12 5v14 M5 12h14",check:"M20 6L9 17l-5-5",x:"M18 6L6 18 M6 6l12 12",search:"M11 17.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5z M16.5 16.5L21 21",dl:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",alert:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",globe:"M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M2 12h20",wallet:"M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12a2 2 0 0 0 2 2h14v-4 M18 12a2 2 0 0 0 0 4h4v-4z",chart:"M18 20V10 M12 20V4 M6 20v-6",bell:"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",edit:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",trash:"M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",copy:"M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",send:"M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",menu:"M3 12h18M3 6h18M3 18h18",card:"M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M1 10h22",pie:"M21.21 15.89A10 10 0 1 1 8 2.83 M22 12A10 10 0 0 0 12 2v10z",print:"M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",clip:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6v4H9z",lock:"M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4",logout:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9"};

// ─── Theme ───
var C={bg:"#060b16",bg2:"#0c1222",card:"#111827",hov:"#162036",inp:"#0b1120",brd:"#1c2842",txt:"#e4e8f0",mut:"#7b879e",dim:"#4a5568",acc:"#c44530",accL:"#e06040",accG:"rgba(196,69,48,0.12)",g:"#10b981",gB:"rgba(16,185,129,0.08)",gD:"rgba(16,185,129,0.25)",y:"#eab308",yB:"rgba(234,179,8,0.08)",yD:"rgba(234,179,8,0.25)",r:"#ef4444",rB:"rgba(239,68,68,0.08)",rD:"rgba(239,68,68,0.25)",b:"#3b82f6",bB:"rgba(59,130,246,0.08)",bD:"rgba(59,130,246,0.25)",gld:"#d4a74a"};

// ─── UI Primitives (same as before) ───
function Badge(p){var cc={g:C.g,y:C.y,r:C.r,b:C.b};var bg={g:C.gB,y:C.yB,r:C.rB,b:C.bB};var bd={g:C.gD,y:C.yD,r:C.rD,b:C.bD};var col=p.color||"g";return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,color:cc[col]||col,background:bg[col]||"rgba(255,255,255,.05)",border:"1px solid "+(bd[col]||"rgba(255,255,255,.1)")}}>{p.children}</span>;}
function Btn(p){var styles={primary:{background:C.acc,color:"#fff",border:"none"},secondary:{background:C.hov,color:C.txt,border:"1px solid "+C.brd},ghost:{background:"transparent",color:C.mut,border:"none"},success:{background:C.g,color:"#fff",border:"none"},danger:{background:C.r,color:"#fff",border:"none"}};var v=styles[p.v||"primary"];var sz=p.s==="sm"?{padding:"5px 11px",fontSize:11}:{padding:"8px 16px",fontSize:13};return <button type="button" onClick={p.disabled?undefined:p.onClick} style={Object.assign({},{borderRadius:8,fontWeight:600,cursor:p.disabled?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:6,fontFamily:"inherit",opacity:p.disabled?0.5:1},v,sz,p.style||{})}>{p.children}</button>;}
function Inp(p){return <div style={Object.assign({display:"flex",flexDirection:"column",gap:4},p.style||{})}>{p.label&&<label style={{fontSize:11,fontWeight:600,color:C.mut,textTransform:"uppercase",letterSpacing:".04em"}}>{p.label}</label>}<input type={p.type||"text"} value={p.value} onChange={function(e){p.onChange(e.target.value);}} placeholder={p.placeholder||""} style={{padding:"8px 12px",background:C.inp,border:"1px solid "+C.brd,borderRadius:8,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}/></div>;}
function Sel(p){return <div style={Object.assign({display:"flex",flexDirection:"column",gap:4},p.style||{})}>{p.label&&<label style={{fontSize:11,fontWeight:600,color:C.mut,textTransform:"uppercase",letterSpacing:".04em"}}>{p.label}</label>}<select value={p.value} onChange={function(e){p.onChange(e.target.value);}} style={{padding:"8px 12px",background:C.inp,border:"1px solid "+C.brd,borderRadius:8,color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none"}}>{p.options.map(function(o){return <option key={o.v} value={o.v}>{o.l}</option>;})}</select></div>;}
function SC(p){var color=p.color||C.acc;return <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:"20px 22px",flex:1,minWidth:170,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:-20,right:-20,width:100,height:100,background:"radial-gradient(circle,"+color+"15,transparent 70%)"}}></div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><div style={{width:34,height:34,borderRadius:9,background:color+"14",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic d={p.icon} s={16} c={color}/></div><span style={{fontSize:11,color:C.mut,fontWeight:600,textTransform:"uppercase"}}>{p.label}</span></div><div style={{fontSize:24,fontWeight:700,color:C.txt,fontFeatureSettings:"'tnum'"}}>{p.value}</div>{p.sub&&<div style={{fontSize:11,color:C.mut,marginTop:3}}>{p.sub}</div>}</div>;}
function PBar(p){var h=p.h||8;return <div style={{width:"100%",background:C.hov,borderRadius:h,height:h,overflow:"hidden"}}><div style={{width:Math.min(p.value/p.max*100,100)+"%",height:"100%",background:p.color||C.g,borderRadius:h,transition:"width .5s"}}></div></div>;}
function Tbl(p){return <div style={{overflowX:"auto",borderRadius:12,border:"1px solid "+C.brd}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:C.hov}}>{p.cols.map(function(c,i){return <th key={i} style={{padding:"11px 14px",textAlign:"left",color:C.mut,fontWeight:600,fontSize:10,textTransform:"uppercase",borderBottom:"1px solid "+C.brd,whiteSpace:"nowrap"}}>{c.label}</th>;})}</tr></thead><tbody>{p.data.length===0&&<tr><td colSpan={p.cols.length} style={{padding:40,textAlign:"center",color:C.dim}}>No data</td></tr>}{p.data.map(function(row,ri){return <tr key={ri} onClick={function(){if(p.onRow)p.onRow(row);}} style={{borderBottom:"1px solid "+C.brd,cursor:p.onRow?"pointer":"default"}} onMouseEnter={function(e){e.currentTarget.style.background=C.hov;}} onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>{p.cols.map(function(c,ci){return <td key={ci} style={{padding:"10px 14px",color:C.txt,whiteSpace:"nowrap"}}>{c.render?c.render(row):row[c.key]}</td>;})}</tr>;})}</tbody></table></div>;}
function Modal(p){if(!p.open)return null;return <div onClick={p.onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}><div onClick={function(e){e.stopPropagation();}} style={{background:C.card,border:"1px solid "+C.brd,borderRadius:16,padding:28,width:p.wide?700:480,maxWidth:"92vw",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 25px 60px rgba(0,0,0,.5)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h3 style={{fontSize:17,fontWeight:700,color:C.txt,margin:0}}>{p.title}</h3><button type="button" onClick={p.onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.mut,padding:4}}><Ic d={ic.x} s={18}/></button></div>{p.children}</div></div>;}

// ─── Loading Spinner ───
function Spinner(){return <div style={{display:"flex",justifyContent:"center",alignItems:"center",padding:60}}><div style={{width:36,height:36,border:"3px solid "+C.brd,borderTopColor:C.acc,borderRadius:"50%",animation:"spin 1s linear infinite"}}/></div>;}

// ─── Export Modal (data URI download + clipboard) ───
function ExportModal(p){
  var [copied,setCopied]=useState(false);
  function doCopy(){try{navigator.clipboard.writeText(p.content).then(function(){setCopied(true);setTimeout(function(){setCopied(false);},2000);});}catch(e){var ta=document.createElement("textarea");ta.value=p.content;ta.style.cssText="position:fixed;left:-9999px";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");setCopied(true);setTimeout(function(){setCopied(false);},2000);}catch(ex){}document.body.removeChild(ta);}}
  if(!p.open)return null;
  var mime=p.type==="json"?"application/json":"text/csv";
  var dataHref="data:"+mime+";charset=utf-8,"+encodeURIComponent(p.content);
  return <div onClick={p.onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}><div onClick={function(e){e.stopPropagation();}} style={{background:C.card,border:"1px solid "+C.brd,borderRadius:16,padding:28,width:640,maxWidth:"92vw",maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 25px 60px rgba(0,0,0,.5)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div><h3 style={{fontSize:17,fontWeight:700,color:C.txt,margin:0}}>{p.filename}</h3><span style={{fontSize:11,color:C.mut}}>{p.type==="csv"?"CSV":"JSON"}</span></div><button type="button" onClick={p.onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.mut,padding:4}}><Ic d={ic.x} s={18}/></button></div>
    <pre style={{background:C.bg,border:"1px solid "+C.brd,borderRadius:10,padding:16,fontSize:11,color:C.txt,lineHeight:1.5,margin:"0 0 16px",whiteSpace:"pre-wrap",wordBreak:"break-all",maxHeight:300,overflow:"auto",fontFamily:"monospace",flex:1}}>{p.content}</pre>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
      <Btn v="ghost" onClick={p.onClose}>Close</Btn>
      <Btn v={copied?"success":"secondary"} onClick={doCopy}><Ic d={copied?ic.check:ic.clip} s={14} c={copied?"#fff":C.txt}/>{copied?"Copied!":"Copy"}</Btn>
      <a href={dataHref} download={p.filename} style={{textDecoration:"none"}}><Btn><Ic d={ic.dl} s={14} c="#fff"/>Download {p.filename}</Btn></a>
    </div>
  </div></div>;
}

// ─── Import Modal (CSV upload + preview + submit) ───
function ImportModal(p){
  var [file,setFile]=useState(null);var [rows,setRows]=useState([]);var [headers,setHeaders]=useState([]);var [busy,setBusy]=useState(false);var [result,setResult]=useState(null);
  var t=p.t||function(k){return k;};

  function parseCSV(text){
    var lines=text.split(/\r?\n/).filter(function(l){return l.trim();});
    if(lines.length<2)return;
    var h=lines[0].split(",").map(function(s){return s.trim().replace(/^"|"$/g,"");});
    var data=[];
    for(var i=1;i<lines.length;i++){
      var vals=lines[i].split(",").map(function(s){return s.trim().replace(/^"|"$/g,"");});
      var obj={};
      for(var j=0;j<h.length;j++) obj[h[j]]=vals[j]||"";
      data.push(obj);
    }
    setHeaders(h);setRows(data);
  }

  function handleFile(e){
    var f=e.target.files[0];if(!f)return;setFile(f);setResult(null);
    var reader=new FileReader();
    reader.onload=function(ev){parseCSV(ev.target.result);};
    reader.readAsText(f);
  }

  function handleDrop(e){
    e.preventDefault();e.stopPropagation();
    var f=e.dataTransfer.files[0];if(!f)return;setFile(f);setResult(null);
    var reader=new FileReader();
    reader.onload=function(ev){parseCSV(ev.target.result);};
    reader.readAsText(f);
  }

  async function doImport(){
    setBusy(true);setResult(null);
    try{
      // Map CSV headers to API field names using the column map
      var mapped=rows.map(function(row){
        var obj={};
        for(var k in p.colMap){
          // Find CSV column that matches
          for(var h in row){
            if(h.toLowerCase().replace(/[^a-z]/g,"")===k.toLowerCase().replace(/[^a-z]/g,"")||h===p.colMap[k]){
              obj[p.colMap[k]]=row[h];break;
            }
          }
          // Direct key match
          if(!obj[p.colMap[k]]&&row[p.colMap[k]]) obj[p.colMap[k]]=row[p.colMap[k]];
          if(!obj[p.colMap[k]]&&row[k]) obj[p.colMap[k]]=row[k];
        }
        return obj;
      });
      var res=await p.onImport(mapped);
      setResult({ok:true,msg:t("imported")+" "+(res.imported||rows.length)+" "+t("rows")});
      if(p.onDone) p.onDone();
    }catch(e){setResult({ok:false,msg:e.message});}
    setBusy(false);
  }

  function dlTemplate(){
    var csv=Object.keys(p.colMap).join(",")+"\n";
    var href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    var a=document.createElement("a");a.href=href;a.download=p.templateName||"template.csv";a.click();
  }

  if(!p.open)return null;
  return <Modal open={true} onClose={function(){setFile(null);setRows([]);setHeaders([]);setResult(null);p.onClose();}} title={t("importSheet")+" — "+p.title} wide>
    <div style={{marginBottom:16,display:"flex",gap:8,flexWrap:"wrap"}}>
      <Btn v="secondary" s="sm" onClick={dlTemplate}><Ic d={ic.dl} s={14}/> {t("dlTemplate")}</Btn>
      <div style={{fontSize:11,color:C.mut,padding:"6px 0"}}>{p.hint||""}</div>
    </div>

    {!file&&<div onDragOver={function(e){e.preventDefault();}} onDrop={handleDrop} style={{border:"2px dashed "+C.brd,borderRadius:12,padding:40,textAlign:"center",cursor:"pointer",background:C.hov}} onClick={function(){document.getElementById("csv-input-"+p.entity).click();}}>
      <Ic d={ic.dl} s={32} c={C.dim}/>
      <div style={{color:C.mut,fontSize:13,marginTop:12}}>{t("dragDrop")}</div>
      <div style={{color:C.dim,fontSize:11,marginTop:4}}>CSV, max 500 {t("rows")}</div>
      <input id={"csv-input-"+p.entity} type="file" accept=".csv,.txt" onChange={handleFile} style={{display:"none"}}/>
    </div>}

    {rows.length>0&&<div>
      <div style={{fontSize:13,fontWeight:600,color:C.txt,marginBottom:8}}>{t("preview")}: {rows.length} {t("rows")}</div>
      <div style={{overflowX:"auto",maxHeight:250,borderRadius:8,border:"1px solid "+C.brd}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr style={{background:C.hov}}>{headers.map(function(h,i){return <th key={i} style={{padding:"6px 10px",textAlign:"left",color:C.mut,borderBottom:"1px solid "+C.brd,whiteSpace:"nowrap"}}>{h}</th>;})}</tr></thead>
          <tbody>{rows.slice(0,10).map(function(row,ri){return <tr key={ri} style={{borderBottom:"1px solid "+C.brd}}>{headers.map(function(h,ci){return <td key={ci} style={{padding:"5px 10px",color:C.txt,whiteSpace:"nowrap"}}>{row[h]||""}</td>;})}</tr>;})}</tbody>
        </table>
      </div>
      {rows.length>10&&<div style={{fontSize:11,color:C.dim,marginTop:4}}>...and {rows.length-10} more</div>}
    </div>}

    {result&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:8,background:result.ok?C.gB:C.rB,border:"1px solid "+(result.ok?C.gD:C.rD),color:result.ok?C.g:C.r,fontSize:13}}>{result.msg}</div>}

    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
      <Btn v="ghost" onClick={function(){setFile(null);setRows([]);setHeaders([]);setResult(null);p.onClose();}}>{t("cancel")}</Btn>
      {file&&!result&&<Btn v="secondary" s="sm" onClick={function(){setFile(null);setRows([]);setHeaders([]);}}>Clear</Btn>}
      <Btn onClick={doImport} disabled={rows.length===0||busy}>{busy?t("importing"):t("importNow")+" ("+rows.length+")"}</Btn>
    </div>
  </Modal>;
}

// ═══════════════════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════════════════
function LoginPage(p){
  var [mode,setMode]=useState("login"); // login | register
  var [email,setEmail]=useState("");var [pass,setPass]=useState("");
  var [nameEn,setNameEn]=useState("");var [coNameEn,setCoNameEn]=useState("");var [coNameAr,setCoNameAr]=useState("");
  var [err,setErr]=useState("");var [loading,setLoading]=useState(false);

  async function doLogin(){
    setErr("");setLoading(true);
    try{
      var data=await api.login(email,pass);
      p.onAuth(data.user,data.token);
    }catch(e){setErr(e.message||"Login failed");}
    setLoading(false);
  }

  async function doRegister(){
    setErr("");setLoading(true);
    try{
      var data=await api.register({email:email,password:pass,name_en:nameEn,company_name_en:coNameEn,company_name_ar:coNameAr});
      p.onAuth(data.user,data.token);
    }catch(e){setErr(e.message||"Registration failed");}
    setLoading(false);
  }

  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
    <div style={{width:420,maxWidth:"90vw",background:C.card,border:"1px solid "+C.brd,borderRadius:20,padding:40,boxShadow:"0 25px 60px rgba(0,0,0,.5)"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,"+C.acc+","+C.accL+")",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><span style={{fontSize:28,fontWeight:800,color:"#fff"}}>ع</span></div>
        <h1 style={{fontSize:22,fontWeight:700,color:C.txt,margin:"0 0 4px"}}>{t("appTitle")}</h1>
        <p style={{fontSize:13,color:C.mut,margin:0}}>{mode==="login"?"Sign in to your account":"Create your company account"}</p>
      </div>

      {err&&<div style={{padding:"10px 14px",background:C.rB,border:"1px solid "+C.rD,borderRadius:8,color:C.r,fontSize:12,marginBottom:16}}>{err}</div>}

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {mode==="register"&&<Inp label="Your Name" value={nameEn} onChange={setNameEn} placeholder="John Smith"/>}
        {mode==="register"&&<Inp label="Company Name (English)" value={coNameEn} onChange={setCoNameEn} placeholder="Future Tech LLC"/>}
        {mode==="register"&&<Inp label="اسم الشركة (عربي)" value={coNameAr} onChange={setCoNameAr} placeholder="شركة المستقبل"/>}
        <Inp label="Email" value={email} onChange={setEmail} placeholder="admin@company.om" type="email"/>
        <Inp label={t("password")} value={pass} onChange={setPass} placeholder="••••••••" type="password"/>
        <Btn onClick={mode==="login"?doLogin:doRegister} disabled={loading} style={{width:"100%",justifyContent:"center",padding:"12px 20px",fontSize:14}}>
          <Ic d={ic.lock} s={16} c="#fff"/>
          {loading?"Please wait...":mode==="login"?"Sign In":"Create Account"}
        </Btn>
      </div>

      <div style={{textAlign:"center",marginTop:20}}>
        <button type="button" onClick={function(){setMode(mode==="login"?"register":"login");setErr("");}} style={{background:"none",border:"none",color:C.acc,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          {mode==="login"?"Don't have an account? Register":"Already have an account? Sign In"}
        </button>
      </div>

      <div style={{textAlign:"center",marginTop:16,fontSize:11,color:C.dim}}>
        Demo: admin@futuretech.om / admin123
      </div>
      {!import.meta.env.VITE_API_URL && <div style={{textAlign:"center",marginTop:12,padding:"8px 12px",background:C.rB,border:"1px solid "+C.rD,borderRadius:8,fontSize:11,color:C.r}}>
        ⚠ VITE_API_URL not set. Add your Render API URL in Vercel → Settings → Environment Variables.
      </div>}
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP (wired to API)
// ═══════════════════════════════════════════════════════════════
export default function App(){
  // ─── Auth state ───
  var [user,setUser]=useState(null);
  var [token,setTokenState]=useState(null);
  var [authLoading,setAuthLoading]=useState(true);

  // ─── App state ───
  var [page,setPage]=useState("dashboard");
  var [col,setCol]=useState(false);
  var [toasts,setToasts]=useState([]);
  var [lang,setLang]=useState("en");

  // ─── Data state (loaded from API) ───
  var [emps,setEmps]=useState([]);
  var [invs,setInvs]=useState([]);
  var [exps,setExps]=useState([]);
  var [products,setProducts]=useState([]);
  var [co,setCo]=useState({nameAr:"",nameEn:"",cr:"",taxId:"",address:"",city:"",phone:"",email:""});
  var [notifs,setNotifs]=useState([]);
  var [dataLoading,setDataLoading]=useState(false);

  // ─── Persisted statuses (survive page refresh) ───
  var [vatReturns,setVatReturns]=useState([]);
  var [spfSubs,setSpfSubs]=useState([]);
  var [payrollRuns,setPayrollRuns]=useState([]);
  var [billing,setBilling]=useState(null);

  // ─── Search state (must be here, before any conditional return) ───
  var [searchQ,setSearchQ]=useState("");
  var [searchOpen,setSearchOpen]=useState(false);

  // ─── Export modal state ───
  var [expModal,setExpModal]=useState({open:false,filename:"",content:"",type:"csv"});
  function showExport(fn,content,type){setExpModal({open:true,filename:fn,content:content,type:type||"csv"});}

  function toast(msg,tp){var id=uid();setToasts(function(p){return p.concat([{id:id,msg:msg,type:tp||"s"}]);});setTimeout(function(){setToasts(function(p){return p.filter(function(x){return x.id!==id;});});},3000);}

  // ─── Translation function ───
  function t(k){return (TR[lang]&&TR[lang][k])||k;}

  // ─── Auth handler ───
  function handleAuth(userData,tokenStr){
    setUser(userData);
    setTokenState(tokenStr);
    api.setToken(tokenStr);
    setAuthLoading(false);
    loadAllData();
  }

  function handleLogout(){
    setUser(null);
    setTokenState(null);
    api.clearToken();
    setEmps([]);setInvs([]);setExps([]);
    setPage("dashboard");
  }

  // ─── Load all data from API ───
  async function loadAllData(){
    setDataLoading(true);
    try{
      var [empData,invData,expData,prodData,coData,notifData,vatData,spfData,prData,billData]=await Promise.all([
        api.getEmployees().catch(function(){return[];}),
        api.getInvoices().catch(function(){return[];}),
        api.getExpenses().catch(function(){return[];}),
        api.getProducts().catch(function(){return[];}),
        api.getCompany().catch(function(){return{nameAr:"",nameEn:"",cr:"",taxId:"",address:"",city:"",phone:"",email:""};}),
        api.getNotifications().catch(function(){return[];}),
        api.getVATReturns().catch(function(){return[];}),
        api.getSPFSubmissions().catch(function(){return[];}),
        api.getPayrollRuns().catch(function(){return[];}),
        api.getBilling().catch(function(){return null;}),
      ]);
      setEmps(empData);
      setInvs(invData);
      setExps(expData);
      setProducts(prodData);
      setCo(coData);
      setNotifs(notifData.map(function(n){return{id:n.id,msg:n.message,type:n.type==="warning"?"w":n.type==="error"?"e":"i",read:n.is_read};}));
      setVatReturns(vatData);
      setSpfSubs(spfData);
      setPayrollRuns(prData);
      setBilling(billData);
    }catch(e){
      console.error("Failed to load data:",e);
    }
    setDataLoading(false);
  }

  // ─── Reload individual collections after mutations ───
  async function reloadEmps(){try{setEmps(await api.getEmployees());}catch(e){}}
  async function reloadInvs(){try{setInvs(await api.getInvoices());}catch(e){}}
  async function reloadExps(){try{setExps(await api.getExpenses());}catch(e){}}
  async function reloadProds(){try{setProducts(await api.getProducts());}catch(e){}}

  // ─── Search results (must be before any conditional return) ───
  var sr=useMemo(function(){
    if(!searchQ.trim())return[];
    var q=searchQ.toLowerCase(),r=[];
    emps.forEach(function(e){
      var name=(e.nameEn||"").toLowerCase();
      var nameA=(e.name||"").toLowerCase();
      var dept=(e.dept||"").toLowerCase();
      if(name.indexOf(q)>=0||nameA.indexOf(q)>=0||dept.indexOf(q)>=0)
        r.push({l:e.nameEn||e.name,s:(e.roleEn||"")+" — "+(e.dept||""),p:"employees"});
    });
    invs.forEach(function(inv){
      var id=(inv.id||"").toLowerCase();
      var cl=(inv.clientEn||"").toLowerCase();
      var clA=(inv.client||"").toLowerCase();
      if(id.indexOf(q)>=0||cl.indexOf(q)>=0||clA.indexOf(q)>=0)
        r.push({l:inv.id||"",s:inv.clientEn||inv.client||"",p:"invoices"});
    });
    return r.slice(0,8);
  },[searchQ,emps,invs]);

  // ─── Check auth on mount ───
  useEffect(function(){
    setAuthLoading(false);
  },[]);

  // ─── If not logged in, show landing page ───
  if(!user){
    if(authLoading) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;
    return <LandingPage onAuth={handleAuth} t={t} lang={lang} setLang={setLang}/>;
  }

  // ─── Onboarding wizard (first login) ───
  if(billing&&!billing.onboarding_done){
    return <OnboardingWizard t={t} co={co} setCo={setCo} toast={toast} onDone={function(){setBilling(Object.assign({},billing,{onboarding_done:true}));loadAllData();}}/>;
  }

  // ─── Plan banner ───
  var planBanner=null;
  if(billing){
    var isTrialVal=billing.plan==="trial";var expiredVal=billing.expired;var daysVal=billing.daysLeft||0;
    if(expiredVal){planBanner=<div style={{padding:"8px 16px",background:C.rB,borderBottom:"1px solid "+C.rD,display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:13}}><span style={{color:C.r,fontWeight:600}}>{t("planExpired")}</span><Btn s="sm" onClick={function(){setPage("settings");}}>{t("upgrade")}</Btn></div>;}
    else if(isTrialVal&&daysVal<=14){planBanner=<div style={{padding:"6px 16px",background:C.yB,borderBottom:"1px solid "+C.yD,display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:12}}><span style={{color:C.y,fontWeight:600}}>{t("trialBanner")}: {daysVal} {t("trialDays")}</span><Btn s="sm" v="secondary" onClick={function(){setPage("settings");}}>{t("upgrade")}</Btn></div>;}
  }

  // ─── Navigation ───
  var navItems=[{k:"dashboard",i:ic.home},{k:"invoices",i:ic.file},{k:"quotations",i:ic.clip},{k:"products",i:ic.card},{k:"contacts",i:ic.globe},{k:"purchaseOrders",i:ic.wallet},{k:"employees",i:ic.users},{k:"payroll",i:ic.card},{k:"leaves",i:ic.flag},{k:"expenses",i:ic.wallet},{k:"accounting",i:ic.chart},{k:"vat",i:ic.dollar},{k:"spf",i:ic.shield},{k:"omanization",i:ic.flag},{k:"reports",i:ic.pie},{k:"settings",i:ic.gear}];
  var navLabels={dashboard:t("dashboard"),invoices:t("invoices"),quotations:t("quotations"),products:t("products"),contacts:t("contacts"),purchaseOrders:t("purchaseOrders"),employees:t("employees"),payroll:t("payrollMod"),leaves:t("leavesMgmt"),expenses:t("expenses"),accounting:t("accounting"),vat:t("vatComp"),spf:t("spf"),omanization:t("oman"),reports:t("reports"),settings:t("settings")};

  // ═══ PAGE ROUTER ═══
  function renderPage(){
    if(dataLoading) return <Spinner/>;

    if(page==="dashboard"){
      var rev=invs.filter(function(i){return i.status==="paid";}).reduce(function(s,i){return s+iTotal(i);},0);
      var om=emps.filter(function(e){return e.nat==="Omani";}).length;
      var tp=emps.reduce(function(s,e){return s+e.salary+e.allow;},0);
      var spfT=emps.filter(function(e){return e.nat==="Omani";}).reduce(function(s,e){return s+e.salary*(SPF_ER+SPF_EE);},0);
      var exT=exps.reduce(function(s,e){return s+e.amount;},0);
      return <div>
        <h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:"0 0 24px"}}>{t("dashboard")}</h2>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:24}}>
          <SC icon={ic.dollar} label={t("revenue")} value={fmt(rev)} sub={t("vatDue")+": "+fmt(invs.reduce(function(s,i){return s+iVat(i);},0))} color={C.g}/>
          <SC icon={ic.users} label={t("employees")} value={emps.length} sub={om+" "+t("omani")} color={C.b}/>
          <SC icon={ic.shield} label={t("spfMonth")} value={fmt(spfT)} sub={t("payroll")+": "+fmt(tp)} color={C.gld}/>
          <SC icon={ic.wallet} label={t("expenses")} value={fmt(exT)} color={C.acc}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24}}>
            <h3 style={{fontSize:14,fontWeight:700,color:C.txt,marginBottom:16}}>{t("omanOv")}</h3>
            {Object.entries(emps.reduce(function(a,e){if(!a[e.dept])a[e.dept]={t:0,o:0};a[e.dept].t++;if(e.nat==="Omani")a[e.dept].o++;return a;},{})).map(function(en){var dept=en[0],d=en[1],pct=d.t>0?Math.round(d.o/d.t*100):0,tg=TARGETS[dept]||20;return <div key={dept} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:C.txt}}>{dept}</span><span style={{color:pct>=tg?C.g:C.y}}>{pct}%/{tg}%</span></div><PBar value={pct} max={tg} color={pct>=tg?C.g:C.y}/></div>;})}
          </div>
          <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24}}>
            <h3 style={{fontSize:14,fontWeight:700,color:C.txt,marginBottom:16}}>{t("recentInv")}</h3>
            {invs.slice(0,4).map(function(inv){return <div key={inv.id} onClick={function(){setPage("invoices");}} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid "+C.brd,cursor:"pointer"}}><div><div style={{fontSize:13,fontWeight:600,color:C.txt}}>{inv.id}</div><div style={{fontSize:11,color:C.mut}}>{inv.clientEn}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:600,color:C.txt}}>{fmt(iGrand(inv))}</div><Badge color={inv.status==="paid"?"g":inv.status==="pending"?"y":"r"}>{inv.status}</Badge></div></div>;})}
          </div>
        </div>
      </div>;
    }

    if(page==="invoices") return <InvPage invs={invs} reloadInvs={reloadInvs} t={t} toast={toast} co={co} showExport={showExport} products={products}/>;
    if(page==="quotations") return <QuotePage t={t} toast={toast} showExport={showExport} reloadInvs={reloadInvs}/>;
    if(page==="products") return <ProdPage products={products} reloadProds={reloadProds} t={t} toast={toast} showExport={showExport}/>;
    if(page==="contacts") return <ContactsPage t={t} toast={toast} showExport={showExport}/>;
    if(page==="purchaseOrders") return <POPage t={t} toast={toast} showExport={showExport}/>;
    if(page==="employees") return <EmpPage emps={emps} reloadEmps={reloadEmps} t={t} toast={toast} showExport={showExport}/>;
    if(page==="payroll") return <PayPage emps={emps} t={t} toast={toast} co={co} showExport={showExport} payrollRuns={payrollRuns} reloadAll={loadAllData}/>;
    if(page==="leaves") return <LeavesPage emps={emps} t={t} toast={toast} showExport={showExport}/>;
    if(page==="expenses") return <ExpPage exps={exps} reloadExps={reloadExps} t={t} toast={toast} showExport={showExport}/>;
    if(page==="accounting") return <AcctPage t={t} toast={toast} showExport={showExport}/>;
    if(page==="vat") return <VATPage invs={invs} exps={exps} t={t} toast={toast} showExport={showExport} vatReturns={vatReturns} reloadAll={loadAllData}/>;
    if(page==="spf") return <SPFPage emps={emps} t={t} toast={toast} showExport={showExport} spfSubs={spfSubs} reloadAll={loadAllData}/>;
    if(page==="omanization") return <OmanPage emps={emps} t={t} toast={toast} showExport={showExport}/>;
    if(page==="reports") return <RepPage invs={invs} emps={emps} exps={exps} t={t} toast={toast} showExport={showExport}/>;
    if(page==="settings") return <SetPage co={co} setCo={setCo} lang={lang} setLang={setLang} t={t} toast={toast} emps={emps} invs={invs} exps={exps} showExport={showExport} billing={billing} reloadAll={loadAllData}/>;
    return null;
  }

  // ═══ LAYOUT ═══
  var isAr = lang==="ar";
  return <div dir={isAr?"rtl":"ltr"} style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:isAr?"'Noto Sans Arabic','Segoe UI',sans-serif":"'DM Sans','Segoe UI',sans-serif",color:C.txt}}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Noto+Sans+Arabic:wght@400;600;700;800&display=swap" rel="stylesheet"/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes sIn{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}*{box-sizing:border-box}select option{background:${C.card};color:${C.txt}}`}</style>
    <ExportModal open={expModal.open} filename={expModal.filename} content={expModal.content} type={expModal.type} onClose={function(){setExpModal({open:false,filename:"",content:"",type:"csv"});}}/>
    <div style={{position:"fixed",bottom:24,right:24,zIndex:2000,display:"flex",flexDirection:"column",gap:8}}>{toasts.map(function(tt){return <div key={tt.id} style={{padding:"12px 20px",borderRadius:10,background:tt.type==="e"?C.r:C.g,color:"#fff",fontSize:13,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,.3)",animation:"sIn .3s ease",minWidth:240}}>{tt.msg}</div>;})}</div>

    {/* Sidebar */}
    <div style={{width:col?62:220,background:C.bg2,borderRight:isAr?"none":"1px solid "+C.brd,borderLeft:isAr?"1px solid "+C.brd:"none",display:"flex",flexDirection:"column",transition:"width .2s",flexShrink:0}}>
      <div style={{padding:col?"16px 10px":"16px 18px",borderBottom:"1px solid "+C.brd}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,"+C.acc+","+C.accL+")",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:17,fontWeight:800,color:"#fff"}}>ع</span></div>{!col&&<div><div style={{fontSize:14,fontWeight:800,color:C.txt}}>Oman ERP</div><div style={{fontSize:9,color:C.mut}}>{co.nameEn||"Loading..."}</div></div>}</div></div>
      <div style={{padding:"10px 6px",flex:1,overflowY:"auto"}}>{navItems.map(function(ni){var active=page===ni.k;return <button key={ni.k} type="button" onClick={function(){setPage(ni.k);}} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:col?"9px 0":"9px 12px",marginBottom:1,borderRadius:8,border:"none",cursor:"pointer",background:active?C.accG:"transparent",color:active?C.acc:C.mut,fontSize:13,fontWeight:active?600:500,fontFamily:"inherit",justifyContent:col?"center":"flex-start"}}><Ic d={ni.i} s={17} c={active?C.acc:C.dim}/>{!col&&(navLabels[ni.k]||ni.k)}</button>;})}</div>
      <div style={{padding:10,borderTop:"1px solid "+C.brd,display:"flex",flexDirection:"column",gap:6}}>
        <button type="button" onClick={function(){setLang(lang==="ar"?"en":"ar");}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:col?"center":"flex-start",gap:8,padding:"8px 12px",borderRadius:8,border:"1px solid "+C.brd,background:C.hov,color:C.txt,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}><Ic d={ic.globe} s={15} c={C.b}/>{!col&&(lang==="ar"?"English":"العربية")}</button>
        <button type="button" onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:col?"center":"flex-start",gap:8,padding:"8px 12px",borderRadius:8,border:"1px solid "+C.brd,background:C.hov,color:C.r,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}><Ic d={ic.logout} s={15} c={C.r}/>{!col&&t("logout")}</button>
      </div>
    </div>

    {/* Main */}
    <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
      {planBanner}
      <div style={{padding:"10px 24px",borderBottom:"1px solid "+C.brd,display:"flex",alignItems:"center",justifyContent:"space-between",background:C.bg2,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button type="button" onClick={function(){setCol(!col);}} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:C.mut}}><Ic d={ic.menu} s={18}/></button>
          <div style={{position:"relative"}}><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:C.inp,borderRadius:8,border:"1px solid "+(searchOpen?C.acc:C.brd),width:260}}><Ic d={ic.search} s={14} c={C.dim}/><input value={searchQ} onChange={function(e){setSearchQ(e.target.value);setSearchOpen(true);}} onFocus={function(){setSearchOpen(true);}} onBlur={function(){setTimeout(function(){setSearchOpen(false);},200);}} placeholder={t("search")} style={{background:"none",border:"none",color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"}}/></div>
            {searchOpen&&sr.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:C.card,border:"1px solid "+C.brd,borderRadius:10,boxShadow:"0 12px 32px rgba(0,0,0,.4)",zIndex:100}}>{sr.map(function(r,i){return <button key={i} type="button" onMouseDown={function(){setPage(r.p);setSearchQ("");setSearchOpen(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"transparent",border:"none",borderBottom:"1px solid "+C.brd,color:C.txt,fontSize:13,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}><div><div style={{fontWeight:600}}>{r.l}</div><div style={{fontSize:11,color:C.mut}}>{r.s}</div></div></button>;})}</div>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:12,color:C.mut}}>{user.name_en||user.email}</div>
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:C.gB,borderRadius:20,border:"1px solid "+C.gD}}><div style={{width:5,height:5,borderRadius:"50%",background:C.g}}/><span style={{fontSize:10,fontWeight:600,color:C.g}}>Connected</span></div>
          <div onClick={function(){setPage("settings");}} style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,"+C.acc+","+C.accL+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>{(user.name_en||"U").charAt(0)}</div>
        </div>
      </div>
      <div style={{padding:24,flex:1}}>{renderPage()}</div>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// PAGE COMPONENTS (all wired to API)
// ═══════════════════════════════════════════════════════════════

function InvPage(p){var invs=p.invs,reloadInvs=p.reloadInvs,t=p.t,toast=p.toast,co=p.co,showExport=p.showExport;
  var [showC,setShowC]=useState(false);var [viewI,setViewI]=useState(null);var [fil,setFil]=useState("all");var [busy,setBusy]=useState(false);
  var [showImp,setShowImp]=useState(false);var [barcodeQ,setBarcodeQ]=useState("");
  var [nI,setNI]=useState({client:"",clientEn:"",cur:"OMR",items:[{desc:"",descEn:"",qty:1,price:0}],notes:""});

  async function doCreate(){if(!nI.clientEn){toast("Client required","e");return;}setBusy(true);try{await api.createInvoice(nI);await reloadInvs();setShowC(false);setNI({client:"",clientEn:"",cur:"OMR",items:[{desc:"",descEn:"",qty:1,price:0}],notes:""});toast("Invoice created");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doStatus(inv,st){setBusy(true);try{await api.updateInvoiceStatus(inv._dbId||inv.id,st);await reloadInvs();if(viewI)setViewI(Object.assign({},inv,{status:st}));toast("Status updated");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doDel(inv){setBusy(true);try{await api.deleteInvoice(inv._dbId||inv.id);await reloadInvs();setViewI(null);toast("Deleted");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doDup(inv){setBusy(true);try{await api.duplicateInvoice(inv._dbId||inv.id);await reloadInvs();toast(t("duplicateInv")+" ✓");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function handleBarcode(code){if(!code.trim())return;try{var prod=await api.lookupBarcode(code.trim());setNI(function(prev){return Object.assign({},prev,{items:prev.items.concat([{desc:prod.name_ar||"",descEn:prod.name_en,qty:1,price:parseFloat(prod.unit_price)}])});});setBarcodeQ("");toast(t("productFound")+": "+prod.name_en);}catch(e){toast(t("productNotFound")+": "+code,"e");setBarcodeQ("");}}
  function doExport(){showExport("invoices.csv",buildCSV(["#","Client","Date","Total","Status"],invs.map(function(i){return[i.id,i.clientEn,i.date,iGrand(i).toFixed(3),i.status];})),"csv");}
  var fd=fil==="all"?invs:invs.filter(function(i){return i.status===fil;});

  if(viewI){var inv=viewI,sub=iTotal(inv),vat=iVat(inv),grand=iGrand(inv);
    return <div><div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}><Btn v="ghost" s="sm" onClick={function(){setViewI(null);}}>{t("back")}</Btn><Btn v="secondary" s="sm" onClick={function(){window.print();}}><Ic d={ic.print} s={14}/> {t("print")}</Btn><Btn v="secondary" s="sm" onClick={function(){toast(t("emailInv"));}}><Ic d={ic.send} s={14}/> {t("emailInv")}</Btn>{inv.status==="pending"&&<Btn v="success" s="sm" onClick={function(){doStatus(inv,"paid");}}>{t("markPaid")}</Btn>}{inv.status!=="cancelled"&&<Btn v="danger" s="sm" onClick={function(){doStatus(inv,"cancelled");}}>{t("cancelInv")}</Btn>}<Btn v="secondary" s="sm" onClick={function(){doDup(inv);}}><Ic d={ic.copy} s={14}/> {t("duplicate")}</Btn><Btn v="ghost" s="sm" onClick={function(){doDel(inv);}} style={{color:C.r}}><Ic d={ic.trash} s={14} c={C.r}/></Btn></div>
      <div style={{background:"#fff",color:"#111",borderRadius:14,padding:40,maxWidth:800,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",borderBottom:"3px solid #c44530",paddingBottom:20,marginBottom:24}}><div><div style={{fontSize:24,fontWeight:800,color:"#c44530"}}>{co.nameAr}</div><div style={{fontSize:13,color:"#666"}}>{co.nameEn}</div><div style={{fontSize:11,color:"#888",marginTop:8}}>{t("taxId")}: {co.taxId}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:700}}>{t("taxInvoice")}</div><div style={{fontSize:12,color:"#666"}}>Tax Invoice</div><div style={{marginTop:12,fontSize:12,color:"#555",lineHeight:1.8}}><div>{inv.id}</div><div>{fD(inv.date)}</div></div></div></div>
        <div style={{marginBottom:24,padding:14,background:"#f8f8f8",borderRadius:8}}><div style={{fontSize:15,fontWeight:600}}>{inv.client}</div><div style={{fontSize:12,color:"#666"}}>{inv.clientEn}</div></div>
        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:24,fontSize:13}}><thead><tr style={{background:"#f0f0f0"}}><th style={{padding:10,textAlign:"left"}}>{t("description")}</th><th style={{padding:10,width:60}}>{t("qty")}</th><th style={{padding:10,textAlign:"right",width:100}}>{t("price")}</th><th style={{padding:10,textAlign:"right",width:100}}>{t("total")}</th></tr></thead><tbody>{(inv.items||[]).map(function(item,i){return <tr key={i} style={{borderBottom:"1px solid #eee"}}><td style={{padding:10}}><div>{item.desc||item.descEn}</div><div style={{fontSize:11,color:"#888"}}>{item.descEn}</div></td><td style={{padding:10,textAlign:"center"}}>{item.qty}</td><td style={{padding:10,textAlign:"right"}}>{fmt(item.price)}</td><td style={{padding:10,textAlign:"right",fontWeight:600}}>{fmt(item.qty*item.price)}</td></tr>;})}</tbody></table>
        <div style={{display:"flex",justifyContent:"flex-end"}}><div style={{width:260}}><div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}><span>{t("subtotal")}</span><span>{fmt(sub)}</span></div><div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}><span>{t("vat")} 5%</span><span>{fmt(vat)}</span></div><div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontSize:16,fontWeight:700,borderTop:"2px solid #c44530",marginTop:8}}><span>{t("total")}</span><span>{fmt(grand)}</span></div></div></div>
      </div></div>;}

  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("invoices")}</h2><div style={{display:"flex",gap:8}}><Btn v="secondary" s="sm" onClick={doExport}><Ic d={ic.dl} s={14}/> {t("export")}</Btn><Btn v="secondary" s="sm" onClick={function(){setShowImp(true);}}><Ic d={ic.clip} s={14}/> {t("importCSV")}</Btn><Btn onClick={function(){setShowC(true);}}><Ic d={ic.plus} s={14} c="#fff"/> {t("newInv")}</Btn></div></div>
    <ImportModal open={showImp} onClose={function(){setShowImp(false);}} t={t} entity="invoices" title={t("invoices")} templateName="invoices-template.csv" colMap={{client_name_en:"client_name_en",client_name_ar:"client_name_ar",subtotal:"subtotal",due_date:"due_date",status:"status"}} hint="Columns: client_name_en, client_name_ar, subtotal, due_date, status" onImport={api.importInvoices} onDone={reloadInvs}/>
    <div style={{display:"flex",gap:6,marginBottom:16}}>{["all","pending","paid","overdue","cancelled"].map(function(s){return <button key={s} type="button" onClick={function(){setFil(s);}} style={{padding:"6px 14px",borderRadius:20,border:"1px solid "+(fil===s?C.acc:C.brd),background:fil===s?C.accG:"transparent",color:fil===s?C.acc:C.mut,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{s==="all"?t("all"):s}</button>;})}</div>
    <Modal open={showC} onClose={function(){setShowC(false);}} title={t("newInv")} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}><Inp label={t("clientAr")} value={nI.client} onChange={function(v){setNI(Object.assign({},nI,{client:v}));}}/><Inp label={t("clientEn")} value={nI.clientEn} onChange={function(v){setNI(Object.assign({},nI,{clientEn:v}));}}/></div>
      <div style={{marginBottom:14,padding:14,background:C.hov,borderRadius:10,border:"1px solid "+C.brd}}>
        <label style={{fontSize:11,fontWeight:600,color:C.acc,textTransform:"uppercase",letterSpacing:".04em",display:"block",marginBottom:6}}>{t("scanBarcode")}</label>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{flex:1,display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:C.inp,borderRadius:8,border:"1px solid "+C.acc}}><Ic d={ic.search} s={14} c={C.acc}/><input value={barcodeQ} onChange={function(e){setBarcodeQ(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"){e.preventDefault();handleBarcode(barcodeQ);}}} placeholder={t("scanHint")} autoFocus style={{background:"none",border:"none",color:C.txt,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%"}}/></div>
          <Btn v="secondary" s="sm" onClick={function(){handleBarcode(barcodeQ);}}><Ic d={ic.search} s={14}/></Btn>
        </div>
        <div style={{fontSize:10,color:C.dim,marginTop:4}}>USB/Bluetooth scanner auto-submits on Enter</div>
      </div>
      {nI.items.map(function(item,idx){return <div key={idx} style={{display:"grid",gridTemplateColumns:"2fr 2fr 70px 100px",gap:8,marginBottom:6}}><Inp label={idx===0?t("descAr"):""} value={item.desc} onChange={function(v){var items=nI.items.slice();items[idx]=Object.assign({},items[idx],{desc:v});setNI(Object.assign({},nI,{items:items}));}}/><Inp label={idx===0?t("descEn"):""} value={item.descEn} onChange={function(v){var items=nI.items.slice();items[idx]=Object.assign({},items[idx],{descEn:v});setNI(Object.assign({},nI,{items:items}));}}/><Inp label={idx===0?t("qty"):""} type="number" value={item.qty} onChange={function(v){var items=nI.items.slice();items[idx]=Object.assign({},items[idx],{qty:Number(v)});setNI(Object.assign({},nI,{items:items}));}}/><Inp label={idx===0?t("price"):""} type="number" value={item.price} onChange={function(v){var items=nI.items.slice();items[idx]=Object.assign({},items[idx],{price:Number(v)});setNI(Object.assign({},nI,{items:items}));}}/></div>;})}
      <div style={{display:"flex",gap:8,marginTop:14}}><Btn v="secondary" s="sm" onClick={function(){setNI(Object.assign({},nI,{items:nI.items.concat([{desc:"",descEn:"",qty:1,price:0}])}));}}>{t("addItem")}</Btn><div style={{flex:1}}/><Btn v="ghost" onClick={function(){setShowC(false);}}>{t("cancel")}</Btn><Btn onClick={doCreate} disabled={busy}>{busy?t("creating"):t("create")}</Btn></div>
    </Modal>
    <Tbl cols={[{key:"id",label:t("invNo"),render:function(r){return <span style={{fontWeight:600,color:C.acc}}>{r.id}</span>;}},{key:"client",label:t("client"),render:function(r){return r.clientEn;}},{key:"date",label:t("date"),render:function(r){return fD(r.date);}},{key:"total",label:t("total"),render:function(r){return <strong>{fmt(iGrand(r))}</strong>;}},{key:"status",label:t("status"),render:function(r){return <Badge color={r.status==="paid"?"g":r.status==="pending"?"y":"r"}>{r.status}</Badge>;}},{key:"act",label:"",render:function(r){return <div style={{display:"flex",gap:4}}><Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();setViewI(r);}}><Ic d={ic.eye} s={14}/></Btn>{r.status==="pending"&&<Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doStatus(r,"paid");}}><Ic d={ic.check} s={14} c={C.g}/></Btn>}<Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doDup(r);}}><Ic d={ic.copy} s={14}/></Btn><Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doDel(r);}}><Ic d={ic.trash} s={14} c={C.r}/></Btn></div>;}}]} data={fd} onRow={function(r){setViewI(r);}}/></div>;}

function ProdPage(p){var products=p.products,reloadProds=p.reloadProds,t=p.t,toast=p.toast,showExport=p.showExport;
  var [showF,setShowF]=useState(false);var [editP,setEditP]=useState(null);var [busy,setBusy]=useState(false);var [showImp,setShowImp]=useState(false);
  var empty={barcode:"",sku:"",name_ar:"",name_en:"",unit_price:0,cost_price:0,category:"",unit:"piece",stock_qty:0};
  var [form,setForm]=useState(empty);
  var units=["piece","hour","box","kg","meter","liter","set"];

  async function doSave(){
    if(!form.name_en){toast(t("nameEn")+" required","e");return;}
    setBusy(true);
    try{
      if(editP){await api.updateProduct(editP.id,form);}else{await api.createProduct(form);}
      await reloadProds();setShowF(false);setEditP(null);setForm(empty);toast(editP?"Updated":"Created");
    }catch(e){toast(e.message,"e");}
    setBusy(false);
  }
  async function doDel(prod){
    try{await api.deleteProduct(prod.id);await reloadProds();toast("Deleted");}catch(e){toast(e.message,"e");}
  }
  function doExport(){showExport("products.csv",buildCSV(["Barcode","SKU","Name EN","Name AR","Price","Category","Unit","Stock"],products.map(function(pr){return[(pr.barcode||""),(pr.sku||""),pr.name_en,(pr.name_ar||""),pr.unit_price,(pr.category||""),(pr.unit||""),pr.stock_qty];})),"csv");}

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("products")} ({products.length})</h2>
      <div style={{display:"flex",gap:8}}>
        <Btn v="secondary" s="sm" onClick={doExport}><Ic d={ic.dl} s={14}/> {t("export")}</Btn>
        <Btn v="secondary" s="sm" onClick={function(){setShowImp(true);}}><Ic d={ic.clip} s={14}/> {t("importCSV")}</Btn>
        <Btn onClick={function(){setForm(empty);setEditP(null);setShowF(true);}}><Ic d={ic.plus} s={14} c="#fff"/> {t("addProduct")}</Btn>
      </div>
    </div>
    <ImportModal open={showImp} onClose={function(){setShowImp(false);}} t={t} entity="products" title={t("products")} templateName="products-template.csv" colMap={{barcode:"barcode",sku:"sku",name_en:"name_en",name_ar:"name_ar",unit_price:"unit_price",category:"category",unit:"unit"}} hint="Columns: barcode, sku, name_en, name_ar, unit_price, category, unit" onImport={api.importProducts} onDone={reloadProds}/>
    <Modal open={showF} onClose={function(){setShowF(false);}} title={editP?t("editProduct"):t("addProduct")} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <Inp label={t("barcode")} value={form.barcode} onChange={function(v){setForm(Object.assign({},form,{barcode:v}));}} placeholder="6281000000001"/>
        <Inp label={t("sku")} value={form.sku} onChange={function(v){setForm(Object.assign({},form,{sku:v}));}} placeholder="PRD-001"/>
        <Inp label={t("nameEn")} value={form.name_en} onChange={function(v){setForm(Object.assign({},form,{name_en:v}));}}/>
        <Inp label={t("nameAr")} value={form.name_ar} onChange={function(v){setForm(Object.assign({},form,{name_ar:v}));}}/>
        <Inp label={t("unitPrice")+" (OMR)"} type="number" value={form.unit_price} onChange={function(v){setForm(Object.assign({},form,{unit_price:Number(v)}));}}/>
        <Inp label={t("costPrice")+" (OMR)"} type="number" value={form.cost_price} onChange={function(v){setForm(Object.assign({},form,{cost_price:Number(v)}));}}/>
        <Inp label={t("category")} value={form.category} onChange={function(v){setForm(Object.assign({},form,{category:v}));}} placeholder="Services / Hardware / Supplies"/>
        <Sel label={t("unit")} value={form.unit} onChange={function(v){setForm(Object.assign({},form,{unit:v}));}} options={units.map(function(u){return{v:u,l:t(u)||u};})}/>
        <Inp label={t("stockQty")} type="number" value={form.stock_qty} onChange={function(v){setForm(Object.assign({},form,{stock_qty:Number(v)}));}}/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={function(){setShowF(false);}}>{t("cancel")}</Btn>
        <Btn onClick={doSave} disabled={busy}>{busy?t("saving"):t("save")}</Btn>
      </div>
    </Modal>
    <Tbl cols={[
      {key:"barcode",label:t("barcode"),render:function(r){return <span style={{fontFamily:"monospace",fontSize:12,color:C.acc}}>{r.barcode||"—"}</span>;}},
      {key:"sku",label:t("sku"),render:function(r){return r.sku||"—";}},
      {key:"name",label:t("name"),render:function(r){return <span style={{fontWeight:500}}>{r.name_en}<br/><span style={{fontSize:11,color:C.mut}}>{r.name_ar||""}</span></span>;}},
      {key:"price",label:t("unitPrice"),render:function(r){return <strong>{fmt(parseFloat(r.unit_price))}</strong>;}},
      {key:"cat",label:t("category"),render:function(r){return r.category?<Badge color="b">{r.category}</Badge>:"—";}},
      {key:"unit",label:t("unit"),render:function(r){return r.unit||"piece";}},
      {key:"stock",label:t("stockQty"),render:function(r){var sq=parseFloat(r.stock_qty||0);return <span style={{color:sq<=0?C.r:sq<5?C.y:C.g,fontWeight:600}}>{sq}</span>;}},
      {key:"act",label:"",render:function(r){return <div style={{display:"flex",gap:4}}>
        <Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();setForm({barcode:r.barcode||"",sku:r.sku||"",name_en:r.name_en,name_ar:r.name_ar||"",unit_price:parseFloat(r.unit_price),cost_price:parseFloat(r.cost_price||0),category:r.category||"",unit:r.unit||"piece",stock_qty:parseFloat(r.stock_qty||0)});setEditP(r);setShowF(true);}}><Ic d={ic.edit} s={14}/></Btn>
        <Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doDel(r);}}><Ic d={ic.trash} s={14} c={C.r}/></Btn>
      </div>;}}
    ]} data={products}/>
  </div>;}

function EmpPage(p){var emps=p.emps,reloadEmps=p.reloadEmps,t=p.t,toast=p.toast,showExport=p.showExport;
  var [showF,setShowF]=useState(false);var [editE,setEditE]=useState(null);var [delE,setDelE]=useState(null);var [busy,setBusy]=useState(false);
  var [showImp,setShowImp]=useState(false);
  var empty={name:"",nameEn:"",nat:"Omani",dept:"IT & Telecom",salary:0,allow:0,roleEn:"",email:"",bank:"Bank Muscat"};var [form,setForm]=useState(empty);

  async function doSave(){if(!form.nameEn){toast("Name required","e");return;}setBusy(true);try{if(editE){await api.updateEmployee(editE.id,form);}else{await api.createEmployee(form);}await reloadEmps();setShowF(false);toast(editE?"Updated":"Created");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doDelete(){setBusy(true);try{await api.deleteEmployee(delE.id);await reloadEmps();setDelE(null);toast("Deleted");}catch(e){toast(e.message,"e");}setBusy(false);}
  function doExport(){showExport("employees.csv",buildCSV(["Name","Nationality","Dept","Role","Salary"],emps.map(function(e){return[e.nameEn,e.nat,e.dept,e.roleEn,e.salary];})),"csv");}

  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("employees")} ({emps.length})</h2><div style={{display:"flex",gap:8}}><Btn v="secondary" s="sm" onClick={doExport}><Ic d={ic.dl} s={14}/> {t("export")}</Btn><Btn v="secondary" s="sm" onClick={function(){setShowImp(true);}}><Ic d={ic.clip} s={14}/> {t("importCSV")}</Btn><Btn onClick={function(){setForm(empty);setEditE(null);setShowF(true);}}><Ic d={ic.plus} s={14} c="#fff"/> {t("addEmp")}</Btn></div></div>
    <ImportModal open={showImp} onClose={function(){setShowImp(false);}} t={t} entity="employees" title={t("employees")} templateName="employees-template.csv" colMap={{name_en:"name_en",name_ar:"name_ar",nationality:"nationality",department:"department",role_title_en:"role_title_en",basic_salary:"basic_salary",allowances:"allowances",email:"email"}} hint="Columns: name_en, name_ar, nationality, department, role_title_en, basic_salary, allowances, email" onImport={api.importEmployees} onDone={reloadEmps}/>
    <Modal open={showF} onClose={function(){setShowF(false);}} title={editE?t("editEmp"):t("addEmp")} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}><Inp label={t("nameAr")} value={form.name} onChange={function(v){setForm(Object.assign({},form,{name:v}));}}/><Inp label={t("nameEn")} value={form.nameEn} onChange={function(v){setForm(Object.assign({},form,{nameEn:v}));}}/><Sel label={t("nationality")} value={form.nat} onChange={function(v){setForm(Object.assign({},form,{nat:v}));}} options={[{v:"Omani",l:"Omani"},{v:"Indian",l:"Indian"},{v:"Pakistani",l:"Pakistani"},{v:"Egyptian",l:"Egyptian"},{v:"Other",l:"Other"}]}/><Sel label={t("department")} value={form.dept} onChange={function(v){setForm(Object.assign({},form,{dept:v}));}} options={DEPTS.map(function(d){return{v:d,l:d};})}/><Inp label={t("role")} value={form.roleEn} onChange={function(v){setForm(Object.assign({},form,{roleEn:v}));}}/><Inp label={t("salary")} type="number" value={form.salary} onChange={function(v){setForm(Object.assign({},form,{salary:Number(v)}));}}/><Inp label={t("allowances")} type="number" value={form.allow} onChange={function(v){setForm(Object.assign({},form,{allow:Number(v)}));}}/><Inp label={t("email")} value={form.email} onChange={function(v){setForm(Object.assign({},form,{email:v}));}}/></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn v="ghost" onClick={function(){setShowF(false);}}>{t("cancel")}</Btn><Btn onClick={doSave} disabled={busy}>{busy?t("saving"):"Save"}</Btn></div>
    </Modal>
    <Modal open={!!delE} onClose={function(){setDelE(null);}} title={t("confirmDel")}><p style={{color:C.mut,marginBottom:20}}>{delE?delE.nameEn:""}</p><div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn v="ghost" onClick={function(){setDelE(null);}}>{t("cancel")}</Btn><Btn v="danger" onClick={doDelete} disabled={busy}>{busy?t("deleting"):"Delete"}</Btn></div></Modal>
    <Tbl cols={[{key:"name",label:t("name"),render:function(r){return <span style={{fontWeight:500}}>{r.nameEn}<br/><span style={{fontSize:11,color:C.mut}}>{r.name}</span></span>;}},{key:"nat",label:t("nationality"),render:function(r){return <Badge color={r.nat==="Omani"?"g":"y"}>{r.nat}</Badge>;}},{key:"dept",label:t("department")},{key:"role",label:t("role"),render:function(r){return r.roleEn;}},{key:"salary",label:t("salary"),render:function(r){return fmt(r.salary);}},{key:"join",label:t("joinDate"),render:function(r){return fD(r.join);}},{key:"act",label:"",render:function(r){return <div style={{display:"flex",gap:4}}><Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();setForm(Object.assign({},r));setEditE(r);setShowF(true);}}><Ic d={ic.edit} s={14}/></Btn><Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();setDelE(r);}}><Ic d={ic.trash} s={14} c={C.r}/></Btn></div>;}}]} data={emps}/></div>;}

function PayPage(p){var emps=p.emps,t=p.t,toast=p.toast,co=p.co,showExport=p.showExport;
  var [slip,setSlip]=useState(null);var [busy,setBusy]=useState(false);
  var now=new Date();var curMonth=now.getMonth()+1;var curYear=now.getFullYear();
  // Check if payroll already ran this month (persisted in DB)
  var alreadyRan=p.payrollRuns&&p.payrollRuns.some(function(r){return r.period_month===curMonth&&r.period_year===curYear;});
  var pd=emps.map(function(e){var b=e.salary,a=e.allow,g=b+a,se=e.nat==="Omani"?b*SPF_EE:0;return Object.assign({},e,{basic:b,al:a,gross:g,spfE:se,net:g-se});});
  var tot=pd.reduce(function(s,e){return{b:s.b+e.basic,a:s.a+e.al,g:s.g+e.gross,s:s.s+e.spfE,n:s.n+e.net};},{b:0,a:0,g:0,s:0,n:0});

  async function doRun(){setBusy(true);try{await api.runPayroll(curMonth,curYear);await p.reloadAll();toast("Payroll complete");}catch(e){toast(e.message,"e");}setBusy(false);}
  function doExport(){showExport("payroll.csv",buildCSV(["Name","Basic","Allowances","Gross","SPF","Net"],pd.map(function(e){return[e.nameEn,e.basic,e.al,e.gross,e.spfE.toFixed(3),e.net.toFixed(3)];})),"csv");}

  if(slip) return <div><Btn v="ghost" s="sm" onClick={function(){setSlip(null);}} style={{marginBottom:16}}>← Back</Btn>
    <div style={{background:"#fff",color:"#111",borderRadius:14,padding:36,maxWidth:700,margin:"0 auto"}}><div style={{textAlign:"center",borderBottom:"3px solid #c44530",paddingBottom:16,marginBottom:20}}><div style={{fontSize:20,fontWeight:800,color:"#c44530"}}>{co.nameAr||co.nameEn}</div><div style={{fontSize:14,fontWeight:700,marginTop:10}}>{t("payslipTitle")}</div></div><div style={{fontSize:14,fontWeight:600,marginBottom:16}}>{slip.nameEn} — {slip.dept}</div><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:16}}><tbody><tr style={{borderBottom:"1px solid #eee"}}><td style={{padding:10}}>Basic</td><td style={{padding:10,textAlign:"right"}}>{fmt(slip.basic)}</td></tr><tr style={{borderBottom:"1px solid #eee"}}><td style={{padding:10}}>Allowances</td><td style={{padding:10,textAlign:"right"}}>{fmt(slip.al)}</td></tr><tr style={{background:"#f8f8f8",fontWeight:600}}><td style={{padding:10}}>Gross</td><td style={{padding:10,textAlign:"right"}}>{fmt(slip.gross)}</td></tr><tr><td style={{padding:10,color:"#ef4444"}}>SPF 7%</td><td style={{padding:10,textAlign:"right",color:"#ef4444"}}>-{fmt(slip.spfE)}</td></tr></tbody></table><div style={{display:"flex",justifyContent:"space-between",padding:14,background:"#c44530",borderRadius:8,color:"#fff"}}><span style={{fontSize:16,fontWeight:700}}>Net Pay</span><span style={{fontSize:20,fontWeight:800}}>{fmt(slip.net)}</span></div></div></div>;

  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("payrollMod")}</h2><div style={{display:"flex",gap:8}}><Btn v="secondary" onClick={doExport}><Ic d={ic.dl} s={14}/> {t("export")}</Btn><Btn onClick={doRun} disabled={alreadyRan||busy}>{alreadyRan?"✓ Done ("+curMonth+"/"+curYear+")":busy?t("running"):"Run Payroll"}</Btn></div></div>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:24}}><SC icon={ic.dollar} label={t("basic")} value={fmt(tot.b)} color={C.b}/><SC icon={ic.card} label={t("allowances")} value={fmt(tot.a)} color={C.g}/><SC icon={ic.shield} label={t("spfDed")} value={fmt(tot.s)} color={C.gld}/><SC icon={ic.wallet} label={t("netPay")} value={fmt(tot.n)} color={C.acc}/></div>
    <Tbl cols={[{key:"name",label:t("name"),render:function(r){return <span style={{fontWeight:500}}>{r.nameEn}</span>;}},{key:"dept",label:t("department")},{key:"basic",label:t("basic"),render:function(r){return fmt(r.basic);}},{key:"gross",label:t("gross"),render:function(r){return <strong>{fmt(r.gross)}</strong>;}},{key:"spf",label:t("spfDed"),render:function(r){return r.nat==="Omani"?<span style={{color:C.r}}>-{fmt(r.spfE)}</span>:"—";}},{key:"net",label:t("netPay"),render:function(r){return <strong style={{color:C.g}}>{fmt(r.net)}</strong>;}},{key:"a",label:"",render:function(r){return <Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();setSlip(r);}}>{t("payslip")}</Btn>;}}]} data={pd}/></div>;}

function ExpPage(p){var exps=p.exps,reloadExps=p.reloadExps,t=p.t,toast=p.toast,showExport=p.showExport;
  var [showA,setShowA]=useState(false);var [busy,setBusy]=useState(false);var [showImp,setShowImp]=useState(false);
  var cats=["rent","utilities","supplies","insurance","other"];var [form,setForm]=useState({descEn:"",amount:0,cat:"utilities",vendor:"",vatI:false});
  async function doAdd(){if(!form.descEn){toast("Required","e");return;}setBusy(true);try{await api.createExpense(form);await reloadExps();setShowA(false);setForm({descEn:"",amount:0,cat:"utilities",vendor:"",vatI:false});toast("Created");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doDel(id){try{await api.deleteExpense(id);await reloadExps();toast("Deleted");}catch(e){toast(e.message,"e");}}
  function doExport(){showExport("expenses.csv",buildCSV(["Description","Amount","Category","Vendor","Date"],exps.map(function(e){return[e.descEn,e.amount,e.cat,e.vendor,e.date];})),"csv");}
  var totalExp=exps.reduce(function(s,e){return s+e.amount;},0);var inputVAT=exps.filter(function(e){return e.vatI;}).reduce(function(s,e){return s+(e.amount/1.05)*0.05;},0);
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("expenses")}</h2><div style={{display:"flex",gap:8}}><Btn v="secondary" s="sm" onClick={doExport}><Ic d={ic.dl} s={14}/></Btn><Btn v="secondary" s="sm" onClick={function(){setShowImp(true);}}><Ic d={ic.clip} s={14}/> {t("importCSV")}</Btn><Btn onClick={function(){setShowA(true);}}><Ic d={ic.plus} s={14} c="#fff"/> {t("addExp")}</Btn></div></div>
    <ImportModal open={showImp} onClose={function(){setShowImp(false);}} t={t} entity="expenses" title={t("expenses")} templateName="expenses-template.csv" colMap={{description_en:"description_en",amount:"amount",category:"category",vendor:"vendor",expense_date:"expense_date",vat_included:"vat_included"}} hint="Columns: description_en, amount, category (rent/utilities/supplies/insurance/other), vendor, expense_date, vat_included (true/false)" onImport={api.importExpenses} onDone={reloadExps}/>
    <div style={{display:"flex",gap:14,marginBottom:24}}><SC icon={ic.wallet} label={t("total")} value={fmt(totalExp)} color={C.acc}/><SC icon={ic.dollar} label={t("inputVAT")} value={fmt(inputVAT)} color={C.b}/></div>
    <Modal open={showA} onClose={function(){setShowA(false);}} title={t("addExp")}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Inp label={t("description")} value={form.descEn} onChange={function(v){setForm(Object.assign({},form,{descEn:v}));}}/><Inp label={t("amount")} type="number" value={form.amount} onChange={function(v){setForm(Object.assign({},form,{amount:v}));}}/><Sel label={t("category")} value={form.cat} onChange={function(v){setForm(Object.assign({},form,{cat:v}));}} options={cats.map(function(c){return{v:c,l:c};})}/><Inp label={t("vendor")} value={form.vendor} onChange={function(v){setForm(Object.assign({},form,{vendor:v}));}}/></div><label style={{display:"flex",alignItems:"center",gap:8,marginTop:12,fontSize:13,color:C.txt,cursor:"pointer"}}><input type="checkbox" checked={form.vatI} onChange={function(e){setForm(Object.assign({},form,{vatI:e.target.checked}));}}/>{t("vatInc")}</label><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn v="ghost" onClick={function(){setShowA(false);}}>{t("cancel")}</Btn><Btn onClick={doAdd} disabled={busy}>{busy?t("adding"):"Save"}</Btn></div></Modal>
    <Tbl cols={[{key:"d",label:t("description"),render:function(r){return r.descEn;}},{key:"amount",label:t("amount"),render:function(r){return <strong>{fmt(r.amount)}</strong>;}},{key:"cat",label:t("category"),render:function(r){return <Badge color="b">{r.cat}</Badge>;}},{key:"vendor",label:t("vendor")},{key:"date",label:t("date"),render:function(r){return fD(r.date);}},{key:"a",label:"",render:function(r){return <Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doDel(r.id);}}><Ic d={ic.trash} s={14} c={C.r}/></Btn>;}}]} data={exps}/></div>;}

function VATPage(p){var invs=p.invs,exps=p.exps,t=p.t,toast=p.toast,showExport=p.showExport;
  var curPeriod="Q"+Math.ceil((new Date().getMonth()+1)/3)+"-"+new Date().getFullYear();
  // Check if already submitted this quarter (persisted in DB)
  var alreadySubmitted=p.vatReturns&&p.vatReturns.some(function(r){return r.period===curPeriod;});
  var alreadyPaid=p.vatReturns&&p.vatReturns.some(function(r){return r.period===curPeriod&&r.status==="paid";});
  var [ck,setCk]=useState({reg:true,inv:true,ret:alreadySubmitted,pay:alreadyPaid,rec:true});var [busy,setBusy]=useState(false);
  var oV=invs.reduce(function(s,i){return s+iVat(i);},0);var iV=exps.filter(function(e){return e.vatI;}).reduce(function(s,e){return s+(e.amount/1.05)*0.05;},0);var net=oV-iV;
  async function doSubmit(){setBusy(true);try{await api.submitVATReturn({period:curPeriod,taxable_sales:(oV/VAT).toFixed(3),output_vat:oV.toFixed(3),input_vat:iV.toFixed(3),net_payable:net.toFixed(3)});await p.reloadAll();setCk(Object.assign({},ck,{ret:true}));toast("VAT Return submitted for "+curPeriod);}catch(e){toast(e.message,"e");}setBusy(false);}
  return <div><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:"0 0 20px"}}>{t("vatComp")}</h2>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:24}}><SC icon={ic.dollar} label={t("outputVAT")} value={fmt(oV)} color={C.acc}/><SC icon={ic.dollar} label={t("inputVAT")} value={fmt(iV)} color={C.b}/><SC icon={ic.dollar} label={t("netVAT")} value={fmt(net)} color={net>0?C.r:C.g}/></div>
    <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24,marginBottom:20}}><h3 style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:16}}>{t("vatReturn")}</h3>
      {[{l:t("taxableSales"),v:fmt(oV/VAT)},{l:t("outputVAT")+" 5%",v:fmt(oV),h:true},{l:t("deductible"),v:fmt(iV)},{l:t("netPayable"),v:fmt(net),h:true,b:true}].map(function(r,i){return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",background:r.h?C.accG:i%2===0?C.hov:"transparent",borderRadius:6,marginBottom:2}}><span style={{fontSize:13,color:C.txt,fontWeight:r.b?700:400}}>{r.l}</span><span style={{fontSize:r.b?16:14,fontWeight:r.b?800:600,color:r.b?C.acc:C.txt}}>{r.v}</span></div>;})}
      <div style={{display:"flex",gap:8,marginTop:18}}><Btn onClick={function(){showExport("vat-return.json",buildJSON({period:curPeriod,taxable_sales:(oV/VAT),output_vat:oV,input_vat:iV,net_payable:net}),"json");}}><Ic d={ic.dl} s={14} c="#fff"/> {t("download")}</Btn><Btn v="secondary" onClick={doSubmit} disabled={alreadySubmitted||busy}>{alreadySubmitted?"✓ Submitted ("+curPeriod+")":busy?t("submitting"):"Submit "+curPeriod}</Btn>{(alreadySubmitted||ck.ret)&&!alreadyPaid&&<Btn v="success" onClick={function(){setCk(Object.assign({},ck,{pay:true}));toast("Payment recorded");}}>{t("payDone")}</Btn>}</div></div>
    <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24}}><h3 style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:14}}>{t("checklist")}</h3>{[{k:"reg",l:t("taxReg")},{k:"inv",l:t("invOk")},{k:"ret",l:t("retFiled")},{k:"pay",l:t("payDone")},{k:"rec",l:t("recsKept")}].map(function(item,i){return <div key={i} onClick={function(){var u={};u[item.k]=!ck[item.k];setCk(Object.assign({},ck,u));}} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<4?"1px solid "+C.brd:"none",cursor:"pointer"}}><div style={{width:22,height:22,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:ck[item.k]?C.gB:C.hov,border:"1px solid "+(ck[item.k]?C.gD:C.brd)}}>{ck[item.k]&&<Ic d={ic.check} s={12} c={C.g}/>}</div><span style={{fontSize:13,color:ck[item.k]?C.txt:C.mut}}>{item.l}</span></div>;})}</div></div>;}

function SPFPage(p){var emps=p.emps,t=p.t,toast=p.toast,showExport=p.showExport;
  var [busy,setBusy]=useState(false);var om=emps.filter(function(e){return e.nat==="Omani";});var ts=om.reduce(function(s,e){return s+e.salary;},0);var er=ts*SPF_ER,ee=ts*SPF_EE,gv=ts*SPF_GV;
  var now=new Date();var curMonth=now.getMonth()+1;var curYear=now.getFullYear();
  // Check if already submitted this month (persisted in DB)
  var alreadySub=p.spfSubs&&p.spfSubs.some(function(s){return s.period_month===curMonth&&s.period_year===curYear;});

  async function doSubmit(){setBusy(true);try{await api.submitSPF({month:curMonth,year:curYear,employer:er,employee:ee,government:gv,total:er+ee+gv,eligible_count:om.length});await p.reloadAll();toast("SPF submitted for "+curMonth+"/"+curYear);}catch(e){toast(e.message,"e");}setBusy(false);}
  return <div><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:"0 0 20px"}}>{t("spf")}</h2>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:24}}><SC icon={ic.shield} label={t("erContrib")} value={fmt(er)} sub={(SPF_ER*100).toFixed(2)+"%" } color={C.acc}/><SC icon={ic.shield} label={t("eeContrib")} value={fmt(ee)} sub={SPF_EE*100+"%"} color={C.b}/><SC icon={ic.shield} label={t("gvContrib")} value={fmt(gv)} sub={(SPF_GV*100).toFixed(2)+"%"} color={C.g}/><SC icon={ic.shield} label={t("monthlyTotal")} value={fmt(er+ee+gv)} sub={om.length+" eligible"} color={C.gld}/></div>
    <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24}}>
      <Tbl cols={[{key:"n",label:t("name"),render:function(r){return <span style={{fontWeight:500}}>{r.nameEn}</span>;}},{key:"spf",label:t("spfNo")},{key:"s",label:t("salary"),render:function(r){return fmt(r.salary);}},{key:"er",label:t("erShare"),render:function(r){return fmt(r.salary*SPF_ER);}},{key:"ee",label:t("eeShare"),render:function(r){return fmt(r.salary*SPF_EE);}},{key:"tot",label:t("total"),render:function(r){return <strong>{fmt(r.salary*(SPF_ER+SPF_EE))}</strong>;}}]} data={om}/>
      <div style={{display:"flex",gap:8,marginTop:18}}>
        <Btn onClick={function(){showExport("spf.csv",buildCSV(["Name","SPF#","Salary","ER","EE","Total"],om.map(function(e){return[e.nameEn,e.spf,e.salary,(e.salary*SPF_ER).toFixed(3),(e.salary*SPF_EE).toFixed(3),(e.salary*(SPF_ER+SPF_EE)).toFixed(3)];})),"csv");}}><Ic d={ic.dl} s={14} c="#fff"/> {t("dlSPF")}</Btn>
        <Btn v="secondary" onClick={doSubmit} disabled={alreadySub||busy}>{alreadySub?"✓ Submitted ("+curMonth+"/"+curYear+")":busy?t("submitting"):"Submit SPF"}</Btn>
      </div>
    </div></div>;}

function OmanPage(p){var emps=p.emps,t=p.t,toast=p.toast,showExport=p.showExport;
  var depts=useMemo(function(){var m={};emps.forEach(function(e){if(!m[e.dept])m[e.dept]={t:0,o:0};m[e.dept].t++;if(e.nat==="Omani")m[e.dept].o++;});return Object.entries(m).map(function(en){return{dept:en[0],t:en[1].t,o:en[1].o,pct:en[1].t>0?Math.round(en[1].o/en[1].t*100):0,target:TARGETS[en[0]]||20};});},[emps]);
  var totalO=emps.filter(function(e){return e.nat==="Omani";}).length;var ok=depts.filter(function(d){return d.pct>=d.target;}).length;
  function doExport(){showExport("omanization.csv",buildCSV(["Department","Total","Omani","%","Target","Gap"],depts.map(function(d){return[d.dept,d.t,d.o,d.pct,d.target,Math.max(0,Math.ceil(d.target/100*d.t)-d.o)];})),"csv");}
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("oman")}</h2><Btn v="secondary" onClick={doExport}><Ic d={ic.dl} s={14}/> {t("export")}</Btn></div>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:24}}><SC icon={ic.flag} label={t("overallRate")} value={(emps.length>0?Math.round(totalO/emps.length*100):0)+"%"} sub={totalO+"/"+emps.length} color={C.acc}/><SC icon={ic.check} label={t("compliant")} value={ok} color={C.g}/><SC icon={ic.alert} label={t("nonComp")} value={depts.length-ok} color={C.r}/></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>{depts.map(function(d){var met=d.pct>=d.target,gap=Math.max(0,Math.ceil(d.target/100*d.t)-d.o);return <div key={d.dept} style={{background:C.card,border:"1px solid "+(met?C.gD:C.rD),borderRadius:14,padding:18,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,right:0,padding:"3px 10px",borderRadius:"0 14px 0 10px",background:met?C.gB:C.rB,fontSize:10,fontWeight:700,color:met?C.g:C.r}}>{met?t("compliant"):t("actionNeeded")}</div><h4 style={{fontSize:14,fontWeight:700,color:C.txt,marginBottom:10}}>{d.dept}</h4><div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:12}}><span style={{color:C.mut}}>{t("current")}: <strong style={{color:C.txt}}>{d.pct}%</strong></span><span style={{color:C.mut}}>{t("target")}: <strong style={{color:met?C.g:C.r}}>{d.target}%</strong></span></div><PBar value={d.pct} max={d.target} color={met?C.g:C.r} h={10}/>{!met&&<div style={{marginTop:10,padding:"7px 10px",background:C.rB,borderRadius:8,border:"1px solid "+C.rD,fontSize:11,color:C.r}}>⚠ {t("needHire")} {gap} {t("moreOmanis")}</div>}</div>;})}</div></div>;}

function RepPage(p){var invs=p.invs,emps=p.emps,exps=p.exps,t=p.t,toast=p.toast,showExport=p.showExport;
  var inc=invs.filter(function(i){return i.status==="paid";}).reduce(function(s,i){return s+iTotal(i);},0);var pay=emps.reduce(function(s,e){return s+e.salary+e.allow;},0);var spfC=emps.filter(function(e){return e.nat==="Omani";}).reduce(function(s,e){return s+e.salary*SPF_ER;},0);var expA=exps.reduce(function(s,e){return s+e.amount;},0);var costs=pay+spfC+expA,np=inc-costs,mg=inc>0?((np/inc)*100).toFixed(1):"0";
  function doExport(){showExport("pnl.csv",buildCSV(["Item","Amount"],[["Revenue",inc.toFixed(3)],["Payroll",pay.toFixed(3)],["SPF ER",spfC.toFixed(3)],["Expenses",expA.toFixed(3)],[t("netProfit"),np.toFixed(3)]]),"csv");}
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("reports")}</h2><Btn onClick={doExport}><Ic d={ic.dl} s={14} c="#fff"/> {t("export")}</Btn></div>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:24}}><SC icon={ic.chart} label={t("totalIncome")} value={fmt(inc)} color={C.g}/><SC icon={ic.wallet} label={t("costs")} value={fmt(costs)} color={C.r}/><SC icon={ic.dollar} label={t("netProfit")} value={fmt(np)} color={np>=0?C.g:C.r}/><SC icon={ic.pie} label={t("grossMargin")} value={mg+"%"} color={C.gld}/></div>
    <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24}}><h3 style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:16}}>{t("incomeStatement")}</h3>
      {[{l:t("revenue")+" ("+t("paid")+")",v:inc,c:C.g,b:true},{l:"— "+t("payroll"),v:-pay,c:C.r},{l:"— "+t("spf"),v:-spfC,c:C.r},{l:"— "+t("expenses"),v:-expA,c:C.r},{l:t("netProfit"),v:np,c:np>=0?C.g:C.r,b:true,a:true}].map(function(r,i){return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px 14px",background:r.a?C.accG:i%2===0?C.hov:"transparent",borderRadius:6,marginBottom:2,borderTop:r.a?"2px solid "+C.acc:"none",marginTop:r.a?8:0}}><span style={{fontSize:13,color:C.txt,fontWeight:r.b?700:400}}>{r.l}</span><span style={{fontSize:r.a?18:14,fontWeight:r.b?800:600,color:r.c}}>{r.v<0?"−":""}{fmt(Math.abs(r.v))}</span></div>;})}</div></div>;}

function SetPage(p){var co=p.co,setCo=p.setCo,t=p.t,toast=p.toast,showExport=p.showExport;
  var [form,setForm]=useState(co);var [busy,setBusy]=useState(false);
  var [tab,setTab]=useState("company");var [payments,setPayments]=useState([]);var [payBusy,setPayBusy]=useState("");
  var bill=p.billing||{};
  var plans=[
    {id:"trial",n:t("planTrial"),p:0,u:3,e:10,i:20},
    {id:"starter",n:t("planStarter"),p:9,u:5,e:25,i:100},
    {id:"professional",n:t("planPro"),p:25,u:15,e:100,i:500},
    {id:"enterprise",n:t("planEnt"),p:59,u:50,e:999,i:9999},
  ];

  async function doSave(){setBusy(true);try{await api.updateCompany(form);setCo(form);toast("Saved");}catch(e){toast(e.message,"e");}setBusy(false);}
  useEffect(function(){if(tab==="billing"){api.getPaymentHistory().then(setPayments).catch(function(){});}},[tab]);

  // Check URL params for payment callback
  useEffect(function(){
    var params=new URLSearchParams(window.location.search);
    var payStatus=params.get("payment");var payPlan=params.get("plan");var sid=params.get("session_id");
    if(payStatus==="success"&&payPlan){
      setTab("billing");
      // Auto-verify payment
      (async function(){
        try{
          if(sid){await api.verifyStripe(sid,payPlan);}
          else{await api.upgradePlan(payPlan,"landing-checkout");}
          toast(t("upgrade")+" → "+payPlan+" ✓");
          if(p.reloadAll)p.reloadAll();
        }catch(e){toast(e.message,"e");}
        window.history.replaceState({},"",window.location.pathname);
      })();
    }
    if(payStatus==="cancelled"){setTab("billing");toast(t("cancel"),"e");window.history.replaceState({},"",window.location.pathname);}
  },[]);

  async function doPay(planId,gateway){
    setPayBusy(planId+"-"+gateway);
    try{
      var res=gateway==="thawani"?await api.payThawani(planId):await api.payStripe(planId);
      if(res.checkout_url){window.location.href=res.checkout_url;}
      else{toast("No checkout URL returned","e");}
    }catch(e){toast(e.message,"e");}
    setPayBusy("");
  }

  var tabs=[{k:"company",l:t("companyInfo")},{k:"billing",l:t("pricing")},{k:"export",l:t("dataExport")}];

  return <div><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:"0 0 20px"}}>{t("settings")}</h2>
    <div style={{display:"flex",gap:6,marginBottom:20}}>{tabs.map(function(tb){return <button key={tb.k} type="button" onClick={function(){setTab(tb.k);}} style={{padding:"6px 14px",borderRadius:20,border:"1px solid "+(tab===tb.k?C.acc:C.brd),background:tab===tb.k?C.accG:"transparent",color:tab===tb.k?C.acc:C.mut,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{tb.l}</button>;})}</div>

    {tab==="company"&&<div style={{maxWidth:500}}>
      <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24}}><h3 style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:16}}>{t("companyInfo")}</h3><div style={{display:"flex",flexDirection:"column",gap:12}}><Inp label={t("compAr")} value={form.nameAr} onChange={function(v){setForm(Object.assign({},form,{nameAr:v}));}}/><Inp label={t("compEn")} value={form.nameEn} onChange={function(v){setForm(Object.assign({},form,{nameEn:v}));}}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label={t("crNo")} value={form.cr} onChange={function(v){setForm(Object.assign({},form,{cr:v}));}}/><Inp label={t("taxId")} value={form.taxId} onChange={function(v){setForm(Object.assign({},form,{taxId:v}));}}/></div><Inp label={t("address")} value={form.address} onChange={function(v){setForm(Object.assign({},form,{address:v}));}}/><Inp label={t("email")} value={form.email} onChange={function(v){setForm(Object.assign({},form,{email:v}));}}/></div><Btn onClick={doSave} disabled={busy} style={{marginTop:18}}>{busy?t("saving"):t("saveSettings")}</Btn></div>
    </div>}

    {tab==="billing"&&<div>
      {/* Current plan */}
      <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24,marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:12}}>{t("pricing")}</h3>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:16}}>
          <SC icon={ic.shield} label={t("status")} value={bill.plan||"trial"} color={bill.expired?C.r:C.g}/>
          <SC icon={ic.chart} label={t("trialDays")} value={(bill.daysLeft||0)+" "+t("days")} color={bill.daysLeft<7?C.r:C.y}/>
          <SC icon={ic.users} label={t("users")} value={(bill.usage?.users||0)+"/"+(bill.limits?.users||3)} color={C.b}/>
          <SC icon={ic.users} label={t("empLimit")} value={(bill.usage?.employees||0)+"/"+(bill.limits?.employees||10)} color={C.b}/>
        </div>
      </div>

      {/* Plan cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:20}}>
        {plans.map(function(pl){var isCurrent=bill.plan===pl.id;return <div key={pl.id} style={{background:C.card,border:isCurrent?"2px solid "+C.acc:"1px solid "+C.brd,borderRadius:14,padding:20}}>
          <div style={{fontSize:16,fontWeight:700,color:C.txt,marginBottom:4}}>{pl.n}</div>
          <div style={{fontSize:28,fontWeight:800,color:C.acc,marginBottom:8}}>{pl.p===0?t("planTrial"):"$"+pl.p}<span style={{fontSize:13,fontWeight:400,color:C.mut}}>{pl.p>0?t("perMonth"):""}</span></div>
          <div style={{fontSize:12,color:C.mut,marginBottom:12,lineHeight:1.6}}>{pl.u} {t("users")} · {pl.e} {t("empLimit")} · {pl.i} {t("invLimit")}</div>
          {isCurrent?<div style={{padding:"8px 14px",background:C.gB,border:"1px solid "+C.gD,borderRadius:8,textAlign:"center",fontSize:12,fontWeight:600,color:C.g}}>{t("current")}</div>
          :pl.id==="trial"?null
          :<div style={{display:"flex",flexDirection:"column",gap:6}}>
            <Btn v="secondary" s="sm" onClick={function(){doPay(pl.id,"thawani");}} disabled={!!payBusy} style={{width:"100%",justifyContent:"center"}}>{payBusy===pl.id+"-thawani"?t("saving"):"Thawani (OMR)"}</Btn>
            <Btn v="ghost" s="sm" onClick={function(){doPay(pl.id,"stripe");}} disabled={!!payBusy} style={{width:"100%",justifyContent:"center"}}>{payBusy===pl.id+"-stripe"?t("saving"):"Stripe (USD)"}</Btn>
          </div>}
        </div>;})}
      </div>

      {/* Payment history */}
      {payments.length>0&&<div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24}}>
        <h3 style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:12}}>Payment History</h3>
        <Tbl cols={[{key:"date",label:t("date"),render:function(r){return fD(r.created_at);}},{key:"plan",label:t("pricing"),render:function(r){return <Badge color="b">{r.plan}</Badge>;}},{key:"amt",label:t("amount"),render:function(r){return <strong>{r.currency} {parseFloat(r.amount).toFixed(2)}</strong>;}},{key:"via",label:t("contactType"),render:function(r){return r.payment_method;}},{key:"st",label:t("status"),render:function(r){return <Badge color="g">{r.status}</Badge>;}}]} data={payments}/>
      </div>}
    </div>}

    {tab==="export"&&<div style={{maxWidth:500}}>
      <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24}}><h3 style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:16}}>{t("dataExport")}</h3><div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn v="secondary" onClick={function(){showExport("erp-backup.json",buildJSON({employees:p.emps,invoices:p.invs,expenses:p.exps,settings:form}),"json");}} style={{width:"100%"}}><Ic d={ic.dl} s={14}/> {t("fullBackup")}</Btn>
          <Btn v="secondary" onClick={function(){showExport("employees.csv",buildCSV(["Name","Dept","Salary","Nationality"],p.emps.map(function(e){return[e.nameEn,e.dept,e.salary,e.nat];})),"csv");}} style={{width:"100%"}}><Ic d={ic.users} s={14}/> {t("empCSV")}</Btn>
          <Btn v="secondary" onClick={function(){showExport("invoices.csv",buildCSV(["ID","Client","Total","Status"],p.invs.map(function(i){return[i.id,i.clientEn,iGrand(i).toFixed(3),i.status];})),"csv");}} style={{width:"100%"}}><Ic d={ic.file} s={14}/> {t("invCSV")}</Btn>
          <Btn v="secondary" onClick={function(){api.getContacts().then(function(d){showExport("contacts.csv",buildCSV(["Name","Type","Email","Phone"],d.map(function(c){return[c.name_en,c.contact_type,c.email||"",c.phone||""];})),"csv");});}} style={{width:"100%"}}><Ic d={ic.globe} s={14}/> {t("contacts")} CSV</Btn>
          <Btn v="secondary" onClick={function(){api.getQuotations().then(function(d){showExport("quotations.csv",buildCSV(["#","Client","Total","Status"],d.map(function(q){return[q.quote_number,q.client_name,q.total||0,q.status];})),"csv");});}} style={{width:"100%"}}><Ic d={ic.clip} s={14}/> {t("quotations")} CSV</Btn>
          <Btn v="secondary" onClick={function(){api.getPurchaseOrders().then(function(d){showExport("purchase-orders.csv",buildCSV(["#","Vendor","Total","Status"],d.map(function(po){return[po.po_number,po.vendor_name,po.total||0,po.status];})),"csv");});}} style={{width:"100%"}}><Ic d={ic.wallet} s={14}/> {t("purchaseOrders")} CSV</Btn>
          <Btn v="secondary" onClick={function(){api.getAccounts().then(function(d){showExport("chart-of-accounts.csv",buildCSV(["Code","Name","Type","Balance"],d.map(function(a){return[a.code,a.name_en,a.account_type,a.balance||0];})),"csv");});}} style={{width:"100%"}}><Ic d={ic.chart} s={14}/> {t("chartOfAccounts")} CSV</Btn>
          <Btn v="secondary" onClick={function(){api.getJournals().then(function(d){showExport("journals.csv",buildCSV(["#","Date","Description","Posted"],d.map(function(j){return[j.entry_number,j.entry_date,j.description||"",j.is_posted?"Yes":"No"];})),"csv");});}} style={{width:"100%"}}><Ic d={ic.edit} s={14}/> {t("journalEntries")} CSV</Btn>
          <Btn v="secondary" onClick={function(){api.getLeaves().then(function(d){showExport("leaves.csv",buildCSV(["Employee","Type","From","To","Days","Status"],d.map(function(l){return[l.emp_name,l.leave_type,l.start_date,l.end_date,l.days,l.status];})),"csv");});}} style={{width:"100%"}}><Ic d={ic.flag} s={14}/> {t("leavesMgmt")} CSV</Btn>
          <Btn v="secondary" onClick={function(){api.getAttendance().then(function(d){showExport("attendance.csv",buildCSV(["Employee","Date","Check In","Check Out","Hours","Status"],d.map(function(a){return[a.emp_name,a.att_date,a.check_in||"",a.check_out||"",a.hours_worked||"",a.status];})),"csv");});}} style={{width:"100%"}}><Ic d={ic.check} s={14}/> {t("attendance")} CSV</Btn>
        </div></div>
    </div>}
  </div>;}

// ═══════════════════════════════════════════════════════════════
// ACCOUNTING PAGE — Chart of Accounts + Journal Entries + Balance Sheet + Cash Flow + Aging
// ═══════════════════════════════════════════════════════════════
function AcctPage(p){var t=p.t,toast=p.toast,showExport=p.showExport;
  var [tab,setTab]=useState("coa");var [accts,setAccts]=useState([]);var [journals,setJournals]=useState([]);
  var [bs,setBs]=useState(null);var [cf,setCf]=useState(null);var [ar,setAr]=useState([]);var [ap,setAp]=useState([]);
  var [showF,setShowF]=useState(false);var [busy,setBusy]=useState(false);var [loading,setLoading]=useState(true);
  var [acctForm,setAcctForm]=useState({code:"",name_en:"",name_ar:"",account_type:"expense"});
  var [jeForm,setJeForm]=useState({description:"",reference:"",lines:[{account_id:"",description:"",debit:0,credit:0}]});
  var acctTypes=["asset","bank","receivable","liability","payable","equity","revenue","expense"];

  useEffect(function(){loadData();},[]);
  async function loadData(){setLoading(true);try{
    var [a,j,b,c,arD,apD]=await Promise.all([api.getAccounts().catch(function(){return[];}),api.getJournals().catch(function(){return[];}),api.getBalanceSheet().catch(function(){return null;}),api.getCashFlow().catch(function(){return null;}),api.getARaging().catch(function(){return[];}),api.getAPaging().catch(function(){return[];})]);
    setAccts(a);setJournals(j);setBs(b);setCf(c);setAr(arD);setAp(apD);
  }catch(e){}setLoading(false);}

  async function saveAcct(){if(!acctForm.code||!acctForm.name_en){toast("Code & name required","e");return;}setBusy(true);try{await api.createAccount(acctForm);await loadData();setShowF(false);setAcctForm({code:"",name_en:"",name_ar:"",account_type:"expense"});toast("Created");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function saveJE(){var totalD=0,totalC=0;jeForm.lines.forEach(function(l){totalD+=parseFloat(l.debit)||0;totalC+=parseFloat(l.credit)||0;});if(Math.abs(totalD-totalC)>0.001){toast("Debits must equal credits","e");return;}setBusy(true);try{await api.createJournal(jeForm);await loadData();setJeForm({description:"",reference:"",lines:[{account_id:"",description:"",debit:0,credit:0}]});toast("Created");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doPost(je){try{await api.postJournal(je.id);await loadData();toast(t("posted"));}catch(e){toast(e.message,"e");}}

  if(loading)return <Spinner/>;
  var tabs=[{k:"coa",l:t("chartOfAccounts")},{k:"je",l:t("journalEntries")},{k:"bs",l:t("balanceSheet")},{k:"cf",l:t("cashFlow")},{k:"ar",l:t("arAging")},{k:"ap",l:t("apAging")}];
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("accounting")}</h2></div>
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{tabs.map(function(tb){return <button key={tb.k} type="button" onClick={function(){setTab(tb.k);}} style={{padding:"6px 14px",borderRadius:20,border:"1px solid "+(tab===tb.k?C.acc:C.brd),background:tab===tb.k?C.accG:"transparent",color:tab===tb.k?C.acc:C.mut,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{tb.l}</button>;})}</div>

    {tab==="coa"&&<div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12}}><Btn v="secondary" s="sm" onClick={function(){showExport("chart-of-accounts.csv",buildCSV(["Code","Name EN","Name AR","Type","Balance"],accts.map(function(a){return[a.code,a.name_en,a.name_ar||"",a.account_type,a.balance||0];})),"csv");}}><Ic d={ic.dl} s={14}/> {t("export")}</Btn><Btn onClick={function(){setShowF(true);}}><Ic d={ic.plus} s={14} c="#fff"/> {t("create")}</Btn></div>
      <Modal open={showF} onClose={function(){setShowF(false);}} title={t("chartOfAccounts")}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Inp label={t("accountCode")} value={acctForm.code} onChange={function(v){setAcctForm(Object.assign({},acctForm,{code:v}));}}/><Inp label={t("nameEn")} value={acctForm.name_en} onChange={function(v){setAcctForm(Object.assign({},acctForm,{name_en:v}));}}/><Inp label={t("nameAr")} value={acctForm.name_ar} onChange={function(v){setAcctForm(Object.assign({},acctForm,{name_ar:v}));}}/><Sel label={t("accountType")} value={acctForm.account_type} onChange={function(v){setAcctForm(Object.assign({},acctForm,{account_type:v}));}} options={acctTypes.map(function(a){return{v:a,l:a};})}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn v="ghost" onClick={function(){setShowF(false);}}>{t("cancel")}</Btn><Btn onClick={saveAcct} disabled={busy}>{busy?t("saving"):t("save")}</Btn></div>
      </Modal>
      <Tbl cols={[{key:"code",label:t("accountCode"),render:function(r){return <strong style={{fontFamily:"monospace"}}>{r.code}</strong>;}},{key:"name",label:t("name"),render:function(r){return <span>{r.name_en}<br/><span style={{fontSize:11,color:C.mut}}>{r.name_ar||""}</span></span>;}},{key:"type",label:t("accountType"),render:function(r){return <Badge color={r.account_type==="asset"||r.account_type==="bank"?"g":r.account_type==="liability"||r.account_type==="payable"?"r":"b"}>{r.account_type}</Badge>;}},{key:"bal",label:t("total"),render:function(r){return <strong>{fmt(parseFloat(r.balance||0))}</strong>;}}]} data={accts}/>
    </div>}

    {tab==="je"&&<div>
      <div style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:20,marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:700,color:C.txt,marginBottom:12}}>{t("newJournal")}</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}><Inp label={t("description")} value={jeForm.description} onChange={function(v){setJeForm(Object.assign({},jeForm,{description:v}));}}/><Inp label={t("reference")} value={jeForm.reference} onChange={function(v){setJeForm(Object.assign({},jeForm,{reference:v}));}}/></div>
        {jeForm.lines.map(function(line,i){return <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr",gap:8,marginBottom:4}}>
          <Sel label={i===0?t("chartOfAccounts"):""} value={line.account_id} onChange={function(v){var ls=jeForm.lines.slice();ls[i]=Object.assign({},ls[i],{account_id:v});setJeForm(Object.assign({},jeForm,{lines:ls}));}} options={[{v:"",l:"— Select —"}].concat(accts.map(function(a){return{v:a.id,l:a.code+" "+a.name_en};}))}/>
          <Inp label={i===0?t("description"):""} value={line.description} onChange={function(v){var ls=jeForm.lines.slice();ls[i]=Object.assign({},ls[i],{description:v});setJeForm(Object.assign({},jeForm,{lines:ls}));}}/>
          <Inp label={i===0?t("debit"):""} type="number" value={line.debit} onChange={function(v){var ls=jeForm.lines.slice();ls[i]=Object.assign({},ls[i],{debit:Number(v)});setJeForm(Object.assign({},jeForm,{lines:ls}));}}/>
          <Inp label={i===0?t("credit"):""} type="number" value={line.credit} onChange={function(v){var ls=jeForm.lines.slice();ls[i]=Object.assign({},ls[i],{credit:Number(v)});setJeForm(Object.assign({},jeForm,{lines:ls}));}}/>
        </div>;})}
        <div style={{display:"flex",gap:8,marginTop:10}}><Btn v="secondary" s="sm" onClick={function(){setJeForm(Object.assign({},jeForm,{lines:jeForm.lines.concat([{account_id:"",description:"",debit:0,credit:0}])}));}}>{t("addItem")}</Btn><div style={{flex:1}}/><Btn onClick={saveJE} disabled={busy}>{busy?t("saving"):t("create")}</Btn></div>
      </div>
      <Tbl cols={[{key:"num",label:"#",render:function(r){return <strong style={{color:C.acc}}>{r.entry_number}</strong>;}},{key:"date",label:t("date"),render:function(r){return fD(r.entry_date);}},{key:"desc",label:t("description"),render:function(r){return r.description||"—";}},{key:"lines",label:t("debit")+" / "+t("credit"),render:function(r){var d=0,c=0;(r.lines||[]).forEach(function(l){d+=parseFloat(l.debit)||0;c+=parseFloat(l.credit)||0;});return fmt(d)+" / "+fmt(c);}},{key:"st",label:t("status"),render:function(r){return r.is_posted?<Badge color="g">{t("posted")}</Badge>:<Badge color="y">{t("draft")}</Badge>;}},{key:"act",label:"",render:function(r){return !r.is_posted?<Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doPost(r);}}>{t("post")}</Btn>:null;}}]} data={journals}/>
    </div>}

    {tab==="bs"&&bs&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
      <SC icon={ic.chart} label={t("assets")} value={fmt(bs.assets)} color={C.g}/>
      <SC icon={ic.chart} label={t("liabilities")} value={fmt(bs.liabilities)} color={C.r}/>
      <SC icon={ic.chart} label={t("equity")} value={fmt(bs.equity)} color={C.b}/>
    </div>}

    {tab==="cf"&&cf&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14}}>
      <SC icon={ic.dollar} label={t("revenue")} value={fmt(cf.inflow)} color={C.g}/>
      <SC icon={ic.wallet} label={t("expenses")} value={fmt(cf.operating_expenses)} color={C.r}/>
      <SC icon={ic.card} label={t("purchaseOrders")} value={fmt(cf.purchases)} color={C.y}/>
      <SC icon={ic.chart} label={t("cashFlow")} value={fmt(cf.net_cash)} color={cf.net_cash>=0?C.g:C.r}/>
    </div>}

    {tab==="ar"&&<Tbl cols={[{key:"inv",label:t("invNo"),render:function(r){return r.invoice_number;}},{key:"cl",label:t("client"),render:function(r){return r.client_name_en;}},{key:"amt",label:t("amount"),render:function(r){return <strong>{fmt(parseFloat(r.total))}</strong>;}},{key:"due",label:t("date"),render:function(r){return fD(r.due_date);}},{key:"age",label:t("status"),render:function(r){return <Badge color={r.aging==="current"?"g":r.aging==="1-30"?"y":"r"}>{r.aging}</Badge>;}}]} data={ar}/>}

    {tab==="ap"&&<Tbl cols={[{key:"po",label:t("poNo"),render:function(r){return r.po_number;}},{key:"v",label:t("vendor"),render:function(r){return r.vendor_name;}},{key:"amt",label:t("amount"),render:function(r){return <strong>{fmt(parseFloat(r.total))}</strong>;}},{key:"due",label:t("date"),render:function(r){return fD(r.expected_date);}},{key:"age",label:t("status"),render:function(r){return <Badge color={r.aging==="current"?"g":r.aging==="1-30"?"y":"r"}>{r.aging}</Badge>;}}]} data={ap}/>}
  </div>;}

// ═══════════════════════════════════════════════════════════════
// CONTACTS PAGE — Customers + Vendors
// ═══════════════════════════════════════════════════════════════
function ContactsPage(p){var t=p.t,toast=p.toast,showExport=p.showExport;
  var [data,setData]=useState([]);var [fil,setFil]=useState("");var [showF,setShowF]=useState(false);var [editC,setEditC]=useState(null);var [busy,setBusy]=useState(false);var [loading,setLoading]=useState(true);var [showImp,setShowImp]=useState(false);
  var empty={contact_type:"customer",name_en:"",name_ar:"",email:"",phone:"",tax_id:"",address:"",city:"",country:"Oman",credit_limit:0,payment_terms:30,notes:""};
  var [form,setForm]=useState(empty);

  useEffect(function(){load();},[fil]);
  async function load(){setLoading(true);try{setData(await api.getContacts(fil||undefined));}catch(e){}setLoading(false);}
  async function doSave(){if(!form.name_en){toast(t("nameEn")+" required","e");return;}setBusy(true);try{if(editC){await api.updateContact(editC.id,form);}else{await api.createContact(form);}await load();setShowF(false);setEditC(null);setForm(empty);toast(editC?"Updated":"Created");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doDel(c){try{await api.deleteContact(c.id);await load();toast("Deleted");}catch(e){toast(e.message,"e");}}
  function doExport(){showExport("contacts.csv",buildCSV(["Name","Type","Email","Phone","City"],data.map(function(c){return[c.name_en,c.contact_type,c.email||"",c.phone||"",c.city||""];})),"csv");}

  if(loading)return <Spinner/>;
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("contacts")} ({data.length})</h2><div style={{display:"flex",gap:8}}><Btn v="secondary" s="sm" onClick={doExport}><Ic d={ic.dl} s={14}/> {t("export")}</Btn><Btn v="secondary" s="sm" onClick={function(){setShowImp(true);}}><Ic d={ic.clip} s={14}/> {t("importCSV")}</Btn><Btn onClick={function(){setForm(empty);setEditC(null);setShowF(true);}}><Ic d={ic.plus} s={14} c="#fff"/> {t("newContact")}</Btn></div></div>
    <div style={{display:"flex",gap:6,marginBottom:16}}>{[{k:"",l:t("all")},{k:"customer",l:t("customers")},{k:"vendor",l:t("vendors")}].map(function(f){return <button key={f.k} type="button" onClick={function(){setFil(f.k);}} style={{padding:"6px 14px",borderRadius:20,border:"1px solid "+(fil===f.k?C.acc:C.brd),background:fil===f.k?C.accG:"transparent",color:fil===f.k?C.acc:C.mut,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{f.l}</button>;})}</div>
    <ImportModal open={showImp} onClose={function(){setShowImp(false);}} t={t} entity="contacts" title={t("contacts")} templateName="contacts-template.csv" colMap={{name_en:"name_en",name_ar:"name_ar",contact_type:"contact_type",email:"email",phone:"phone",city:"city",payment_terms:"payment_terms"}} hint="Columns: name_en, name_ar, contact_type (customer/vendor), email, phone, city, payment_terms" onImport={api.importContacts} onDone={load}/>
    <Modal open={showF} onClose={function(){setShowF(false);}} title={editC?t("editProduct"):t("newContact")} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <Sel label={t("contactType")} value={form.contact_type} onChange={function(v){setForm(Object.assign({},form,{contact_type:v}));}} options={[{v:"customer",l:t("customer")},{v:"vendor",l:t("vendor")},{v:"both",l:t("both")}]}/>
        <Inp label={t("nameEn")} value={form.name_en} onChange={function(v){setForm(Object.assign({},form,{name_en:v}));}}/>
        <Inp label={t("nameAr")} value={form.name_ar} onChange={function(v){setForm(Object.assign({},form,{name_ar:v}));}}/>
        <Inp label={t("email")} value={form.email} onChange={function(v){setForm(Object.assign({},form,{email:v}));}}/>
        <Inp label={t("phone")} value={form.phone} onChange={function(v){setForm(Object.assign({},form,{phone:v}));}}/>
        <Inp label={t("taxId")} value={form.tax_id} onChange={function(v){setForm(Object.assign({},form,{tax_id:v}));}}/>
        <Inp label={t("address")} value={form.address} onChange={function(v){setForm(Object.assign({},form,{address:v}));}}/>
        <Inp label={t("creditLimit")} type="number" value={form.credit_limit} onChange={function(v){setForm(Object.assign({},form,{credit_limit:Number(v)}));}}/>
        <Inp label={t("paymentTerms")+" ("+t("days")+")"} type="number" value={form.payment_terms} onChange={function(v){setForm(Object.assign({},form,{payment_terms:Number(v)}));}}/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn v="ghost" onClick={function(){setShowF(false);}}>{t("cancel")}</Btn><Btn onClick={doSave} disabled={busy}>{busy?t("saving"):t("save")}</Btn></div>
    </Modal>
    <Tbl cols={[{key:"name",label:t("name"),render:function(r){return <span style={{fontWeight:500}}>{r.name_en}<br/><span style={{fontSize:11,color:C.mut}}>{r.name_ar||""}</span></span>;}},{key:"type",label:t("contactType"),render:function(r){return <Badge color={r.contact_type==="customer"?"g":r.contact_type==="vendor"?"b":"y"}>{r.contact_type}</Badge>;}},{key:"email",label:t("email"),render:function(r){return r.email||"—";}},{key:"phone",label:t("phone"),render:function(r){return r.phone||"—";}},{key:"terms",label:t("paymentTerms"),render:function(r){return (r.payment_terms||30)+" "+t("days");}},{key:"act",label:"",render:function(r){return <div style={{display:"flex",gap:4}}><Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();setForm({contact_type:r.contact_type,name_en:r.name_en,name_ar:r.name_ar||"",email:r.email||"",phone:r.phone||"",tax_id:r.tax_id||"",address:r.address||"",city:r.city||"",country:r.country||"Oman",credit_limit:parseFloat(r.credit_limit)||0,payment_terms:parseInt(r.payment_terms)||30,notes:r.notes||""});setEditC(r);setShowF(true);}}><Ic d={ic.edit} s={14}/></Btn><Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doDel(r);}}><Ic d={ic.trash} s={14} c={C.r}/></Btn></div>;}}]} data={data}/>
  </div>;}

// ═══════════════════════════════════════════════════════════════
// QUOTATIONS PAGE
// ═══════════════════════════════════════════════════════════════
function QuotePage(p){var t=p.t,toast=p.toast,showExport=p.showExport;
  var [data,setData]=useState([]);var [showF,setShowF]=useState(false);var [busy,setBusy]=useState(false);var [loading,setLoading]=useState(true);var [showImp,setShowImp]=useState(false);
  var [form,setForm]=useState({client_name:"",notes:"",items:[{description_en:"",quantity:1,unit_price:0}]});

  useEffect(function(){load();},[]);
  async function load(){setLoading(true);try{setData(await api.getQuotations());}catch(e){}setLoading(false);}
  async function doCreate(){if(!form.client_name){toast(t("client")+" required","e");return;}setBusy(true);try{await api.createQuotation(form);await load();setShowF(false);setForm({client_name:"",notes:"",items:[{description_en:"",quantity:1,unit_price:0}]});toast("Created");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doStatus(q,st){try{await api.updateQuotationStatus(q.id,st);await load();toast(t("status")+" → "+st);}catch(e){toast(e.message,"e");}}
  async function doConvert(q){setBusy(true);try{var res=await api.convertQuotation(q.id);await load();if(p.reloadInvs)p.reloadInvs();toast(t("convertToInv")+" → "+res.invoice_number);}catch(e){toast(e.message,"e");}setBusy(false);}
  function qTotal(q){return (q.items||[]).reduce(function(s,i){return s+(parseFloat(i.quantity)||0)*(parseFloat(i.unit_price)||0);},0);}

  if(loading)return <Spinner/>;
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("quotations")} ({data.length})</h2><Btn v="secondary" s="sm" onClick={function(){showExport("quotations.csv",buildCSV(["#","Client","Date","Total","Status"],data.map(function(q){return[q.quote_number,q.client_name,q.issue_date,q.total||0,q.status];})),"csv");}}><Ic d={ic.dl} s={14}/> {t("export")}</Btn><Btn v="secondary" s="sm" onClick={function(){setShowImp(true);}}><Ic d={ic.clip} s={14}/> {t("importCSV")}</Btn><Btn onClick={function(){setShowF(true);}}><Ic d={ic.plus} s={14} c="#fff"/> {t("newQuotation")}</Btn></div>
    <ImportModal open={showImp} onClose={function(){setShowImp(false);}} t={t} entity="quotations" title={t("quotations")} templateName="quotations-template.csv" colMap={{client_name:"client_name",subtotal:"subtotal"}} hint="Columns: client_name, subtotal" onImport={api.importQuotations} onDone={load}/>
    <Modal open={showF} onClose={function(){setShowF(false);}} title={t("newQuotation")} wide>
      <Inp label={t("client")} value={form.client_name} onChange={function(v){setForm(Object.assign({},form,{client_name:v}));}} style={{marginBottom:12}}/>
      {form.items.map(function(item,idx){return <div key={idx} style={{display:"grid",gridTemplateColumns:"3fr 80px 120px",gap:8,marginBottom:4}}><Inp label={idx===0?t("description"):""} value={item.description_en} onChange={function(v){var items=form.items.slice();items[idx]=Object.assign({},items[idx],{description_en:v});setForm(Object.assign({},form,{items:items}));}}/><Inp label={idx===0?t("qty"):""} type="number" value={item.quantity} onChange={function(v){var items=form.items.slice();items[idx]=Object.assign({},items[idx],{quantity:Number(v)});setForm(Object.assign({},form,{items:items}));}}/><Inp label={idx===0?t("price"):""} type="number" value={item.unit_price} onChange={function(v){var items=form.items.slice();items[idx]=Object.assign({},items[idx],{unit_price:Number(v)});setForm(Object.assign({},form,{items:items}));}}/></div>;})}
      <div style={{display:"flex",gap:8,marginTop:10}}><Btn v="secondary" s="sm" onClick={function(){setForm(Object.assign({},form,{items:form.items.concat([{description_en:"",quantity:1,unit_price:0}])}));}}>{t("addItem")}</Btn><div style={{flex:1}}/><Btn v="ghost" onClick={function(){setShowF(false);}}>{t("cancel")}</Btn><Btn onClick={doCreate} disabled={busy}>{busy?t("creating"):t("create")}</Btn></div>
    </Modal>
    <Tbl cols={[{key:"num",label:t("quoteNo"),render:function(r){return <strong style={{color:C.acc}}>{r.quote_number}</strong>;}},{key:"cl",label:t("client"),render:function(r){return r.client_name;}},{key:"date",label:t("date"),render:function(r){return fD(r.issue_date);}},{key:"total",label:t("total"),render:function(r){return <strong>{fmt(parseFloat(r.total)||qTotal(r)*1.05)}</strong>;}},{key:"st",label:t("status"),render:function(r){return <Badge color={r.status==="accepted"?"g":r.status==="draft"?"y":r.status==="converted"?"b":"r"}>{r.status}</Badge>;}},{key:"act",label:"",render:function(r){return <div style={{display:"flex",gap:4}}>{r.status==="draft"&&<Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doStatus(r,"sent");}}><Ic d={ic.send} s={14}/></Btn>}{r.status==="sent"&&<Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doStatus(r,"accepted");}}><Ic d={ic.check} s={14} c={C.g}/></Btn>}{(r.status==="accepted"||r.status==="sent")&&<Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doConvert(r);}} style={{color:C.b}}><Ic d={ic.file} s={14} c={C.b}/></Btn>}</div>;}}]} data={data}/>
  </div>;}

// ═══════════════════════════════════════════════════════════════
// PURCHASE ORDERS PAGE
// ═══════════════════════════════════════════════════════════════
function POPage(p){var t=p.t,toast=p.toast,showExport=p.showExport;
  var [data,setData]=useState([]);var [showF,setShowF]=useState(false);var [busy,setBusy]=useState(false);var [loading,setLoading]=useState(true);var [showImp,setShowImp]=useState(false);
  var [form,setForm]=useState({vendor_name:"",notes:"",items:[{description_en:"",quantity:1,unit_price:0}]});

  useEffect(function(){load();},[]);
  async function load(){setLoading(true);try{setData(await api.getPurchaseOrders());}catch(e){}setLoading(false);}
  async function doCreate(){if(!form.vendor_name){toast(t("vendor")+" required","e");return;}setBusy(true);try{await api.createPurchaseOrder(form);await load();setShowF(false);setForm({vendor_name:"",notes:"",items:[{description_en:"",quantity:1,unit_price:0}]});toast("Created");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doStatus(po,st){try{await api.updatePOStatus(po.id,st);await load();toast(t("status")+" → "+st);}catch(e){toast(e.message,"e");}}

  if(loading)return <Spinner/>;
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("purchaseOrders")} ({data.length})</h2><Btn v="secondary" s="sm" onClick={function(){showExport("purchase-orders.csv",buildCSV(["#","Vendor","Date","Total","Status"],data.map(function(po){return[po.po_number,po.vendor_name,po.order_date,po.total||0,po.status];})),"csv");}}><Ic d={ic.dl} s={14}/> {t("export")}</Btn><Btn v="secondary" s="sm" onClick={function(){setShowImp(true);}}><Ic d={ic.clip} s={14}/> {t("importCSV")}</Btn><Btn onClick={function(){setShowF(true);}}><Ic d={ic.plus} s={14} c="#fff"/> {t("newPO")}</Btn></div>
    <ImportModal open={showImp} onClose={function(){setShowImp(false);}} t={t} entity="pos" title={t("purchaseOrders")} templateName="purchase-orders-template.csv" colMap={{vendor_name:"vendor_name",subtotal:"subtotal"}} hint="Columns: vendor_name, subtotal" onImport={api.importPurchaseOrders} onDone={load}/>
    <Modal open={showF} onClose={function(){setShowF(false);}} title={t("newPO")} wide>
      <Inp label={t("vendorName")} value={form.vendor_name} onChange={function(v){setForm(Object.assign({},form,{vendor_name:v}));}} style={{marginBottom:12}}/>
      {form.items.map(function(item,idx){return <div key={idx} style={{display:"grid",gridTemplateColumns:"3fr 80px 120px",gap:8,marginBottom:4}}><Inp label={idx===0?t("description"):""} value={item.description_en} onChange={function(v){var items=form.items.slice();items[idx]=Object.assign({},items[idx],{description_en:v});setForm(Object.assign({},form,{items:items}));}}/><Inp label={idx===0?t("qty"):""} type="number" value={item.quantity} onChange={function(v){var items=form.items.slice();items[idx]=Object.assign({},items[idx],{quantity:Number(v)});setForm(Object.assign({},form,{items:items}));}}/><Inp label={idx===0?t("price"):""} type="number" value={item.unit_price} onChange={function(v){var items=form.items.slice();items[idx]=Object.assign({},items[idx],{unit_price:Number(v)});setForm(Object.assign({},form,{items:items}));}}/></div>;})}
      <div style={{display:"flex",gap:8,marginTop:10}}><Btn v="secondary" s="sm" onClick={function(){setForm(Object.assign({},form,{items:form.items.concat([{description_en:"",quantity:1,unit_price:0}])}));}}>{t("addItem")}</Btn><div style={{flex:1}}/><Btn v="ghost" onClick={function(){setShowF(false);}}>{t("cancel")}</Btn><Btn onClick={doCreate} disabled={busy}>{busy?t("creating"):t("create")}</Btn></div>
    </Modal>
    <Tbl cols={[{key:"num",label:t("poNo"),render:function(r){return <strong style={{color:C.acc}}>{r.po_number}</strong>;}},{key:"v",label:t("vendor"),render:function(r){return r.vendor_name;}},{key:"date",label:t("date"),render:function(r){return fD(r.order_date);}},{key:"total",label:t("total"),render:function(r){return <strong>{fmt(parseFloat(r.total))}</strong>;}},{key:"st",label:t("status"),render:function(r){return <Badge color={r.status==="received"?"g":r.status==="confirmed"?"b":r.status==="draft"?"y":"r"}>{r.status}</Badge>;}},{key:"act",label:"",render:function(r){return <div style={{display:"flex",gap:4}}>{r.status==="draft"&&<Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doStatus(r,"sent");}}><Ic d={ic.send} s={14}/></Btn>}{r.status==="sent"&&<Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doStatus(r,"confirmed");}}><Ic d={ic.check} s={14} c={C.g}/></Btn>}{r.status==="confirmed"&&<Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doStatus(r,"received");}}><Ic d={ic.dl} s={14} c={C.b}/></Btn>}</div>;}}]} data={data}/>
  </div>;}

// ═══════════════════════════════════════════════════════════════
// LEAVES & ATTENDANCE PAGE
// ═══════════════════════════════════════════════════════════════
function LeavesPage(p){var emps=p.emps,t=p.t,toast=p.toast,showExport=p.showExport;
  var [tab,setTab]=useState("leaves");var [leaves,setLeaves]=useState([]);var [types,setTypes]=useState([]);var [att,setAtt]=useState([]);
  var [attDate,setAttDate]=useState(new Date().toISOString().slice(0,10));
  var [showF,setShowF]=useState(false);var [busy,setBusy]=useState(false);var [loading,setLoading]=useState(true);
  var [form,setForm]=useState({employee_id:"",leave_type_id:"",start_date:"",end_date:"",reason:""});
  var [attForm,setAttForm]=useState({employee_id:"",check_in:"08:00",check_out:"17:00",status:"present"});
  var statuses=["present","absent","late","half_day","on_leave"];

  useEffect(function(){loadAll();},[]);
  useEffect(function(){loadAtt();},[attDate]);
  async function loadAll(){setLoading(true);try{var [l,ty]=await Promise.all([api.getLeaves(),api.getLeaveTypes()]);setLeaves(l);setTypes(ty);}catch(e){}setLoading(false);}
  async function loadAtt(){try{setAtt(await api.getAttendance(attDate));}catch(e){}}

  async function doCreateLeave(){if(!form.employee_id||!form.leave_type_id||!form.start_date||!form.end_date){toast("All fields required","e");return;}setBusy(true);try{await api.createLeave(form);await loadAll();setShowF(false);setForm({employee_id:"",leave_type_id:"",start_date:"",end_date:"",reason:""});toast("Created");}catch(e){toast(e.message,"e");}setBusy(false);}
  async function doApprove(lv,st){try{await api.updateLeaveStatus(lv.id,st);await loadAll();toast(st==="approved"?t("approve"):t("reject"));}catch(e){toast(e.message,"e");}}
  async function doRecordAtt(){if(!attForm.employee_id){toast("Select employee","e");return;}try{await api.recordAttendance(Object.assign({},attForm,{att_date:attDate}));await loadAtt();setAttForm({employee_id:"",check_in:"08:00",check_out:"17:00",status:"present"});toast("Recorded");}catch(e){toast(e.message,"e");}}
  async function doWPS(){try{var res=await api.generateWPS();showExport(res.filename,res.content,"csv");toast(t("generateWPS")+" ✓");}catch(e){toast(e.message,"e");}}

  if(loading)return <Spinner/>;
  return <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:22,fontWeight:700,color:C.txt,margin:0}}>{t("leavesMgmt")}</h2><div style={{display:"flex",gap:8}}><Btn v="secondary" onClick={doWPS}><Ic d={ic.dl} s={14}/> {t("wps")}</Btn></div></div>
    <div style={{display:"flex",gap:6,marginBottom:16}}>{[{k:"leaves",l:t("leavesMgmt")},{k:"attendance",l:t("attendance")}].map(function(tb){return <button key={tb.k} type="button" onClick={function(){setTab(tb.k);}} style={{padding:"6px 14px",borderRadius:20,border:"1px solid "+(tab===tb.k?C.acc:C.brd),background:tab===tb.k?C.accG:"transparent",color:tab===tb.k?C.acc:C.mut,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{tb.l}</button>;})}</div>

    {tab==="leaves"&&<div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12}}><Btn v="secondary" s="sm" onClick={function(){showExport("leaves.csv",buildCSV(["Employee","Type","From","To","Days","Status"],leaves.map(function(l){return[l.emp_name,l.leave_type,l.start_date,l.end_date,l.days,l.status];})),"csv");}}><Ic d={ic.dl} s={14}/> {t("export")}</Btn><Btn onClick={function(){setShowF(true);}}><Ic d={ic.plus} s={14} c="#fff"/> {t("newLeave")}</Btn></div>
      <Modal open={showF} onClose={function(){setShowF(false);}} title={t("newLeave")}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Sel label={t("employees")} value={form.employee_id} onChange={function(v){setForm(Object.assign({},form,{employee_id:v}));}} options={[{v:"",l:"—"}].concat(emps.map(function(e){return{v:e.id,l:e.nameEn};}))}/>
          <Sel label={t("leaveType")} value={form.leave_type_id} onChange={function(v){setForm(Object.assign({},form,{leave_type_id:v}));}} options={[{v:"",l:"—"}].concat(types.map(function(lt){return{v:lt.id,l:lt.name_en};}))}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label={t("startDate")} type="date" value={form.start_date} onChange={function(v){setForm(Object.assign({},form,{start_date:v}));}}/><Inp label={t("endDate")} type="date" value={form.end_date} onChange={function(v){setForm(Object.assign({},form,{end_date:v}));}}/></div>
          <Inp label={t("reason")} value={form.reason} onChange={function(v){setForm(Object.assign({},form,{reason:v}));}}/>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn v="ghost" onClick={function(){setShowF(false);}}>{t("cancel")}</Btn><Btn onClick={doCreateLeave} disabled={busy}>{busy?t("creating"):t("create")}</Btn></div>
      </Modal>
      <Tbl cols={[{key:"emp",label:t("name"),render:function(r){return <span style={{fontWeight:500}}>{r.emp_name}</span>;}},{key:"type",label:t("leaveType"),render:function(r){return <Badge color="b">{r.leave_type}</Badge>;}},{key:"from",label:t("startDate"),render:function(r){return fD(r.start_date);}},{key:"to",label:t("endDate"),render:function(r){return fD(r.end_date);}},{key:"days",label:t("days"),render:function(r){return r.days;}},{key:"st",label:t("status"),render:function(r){return <Badge color={r.status==="approved"?"g":r.status==="pending"?"y":"r"}>{r.status}</Badge>;}},{key:"act",label:"",render:function(r){return r.status==="pending"?<div style={{display:"flex",gap:4}}><Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doApprove(r,"approved");}}><Ic d={ic.check} s={14} c={C.g}/></Btn><Btn v="ghost" s="sm" onClick={function(e){e.stopPropagation();doApprove(r,"rejected");}}><Ic d={ic.x} s={14} c={C.r}/></Btn></div>:null;}}]} data={leaves}/>
    </div>}

    {tab==="attendance"&&<div>
      <div style={{display:"flex",gap:12,alignItems:"flex-end",marginBottom:16,flexWrap:"wrap"}}>
        <Inp label={t("date")} type="date" value={attDate} onChange={setAttDate}/>
        <Sel label={t("employees")} value={attForm.employee_id} onChange={function(v){setAttForm(Object.assign({},attForm,{employee_id:v}));}} options={[{v:"",l:"—"}].concat(emps.map(function(e){return{v:e.id,l:e.nameEn};}))}/>
        <Inp label={t("checkIn")} type="time" value={attForm.check_in} onChange={function(v){setAttForm(Object.assign({},attForm,{check_in:v}));}}/>
        <Inp label={t("checkOut")} type="time" value={attForm.check_out} onChange={function(v){setAttForm(Object.assign({},attForm,{check_out:v}));}}/>
        <Sel label={t("status")} value={attForm.status} onChange={function(v){setAttForm(Object.assign({},attForm,{status:v}));}} options={statuses.map(function(s){return{v:s,l:t(s)||s};})}/>
        <Btn onClick={doRecordAtt} style={{marginBottom:4}}><Ic d={ic.plus} s={14} c="#fff"/> Record</Btn>
      </div>
      <Tbl cols={[{key:"emp",label:t("name"),render:function(r){return <span style={{fontWeight:500}}>{r.emp_name}</span>;}},{key:"dept",label:t("department"),render:function(r){return r.department;}},{key:"in",label:t("checkIn"),render:function(r){return r.check_in||"—";}},{key:"out",label:t("checkOut"),render:function(r){return r.check_out||"—";}},{key:"hrs",label:t("hoursWorked"),render:function(r){return r.hours_worked||"—";}},{key:"st",label:t("status"),render:function(r){return <Badge color={r.status==="present"?"g":r.status==="absent"?"r":r.status==="late"?"y":"b"}>{t(r.status)||r.status}</Badge>;}}]} data={att}/>
    </div>}
  </div>;}

// ═══════════════════════════════════════════════════════════════
// LANDING PAGE — Marketing + Pricing + Login/Register
// ═══════════════════════════════════════════════════════════════
function LandingPage(p){
  var [view,setView]=useState("landing");var t=p.t;
  var [mode,setMode]=useState("login");
  var [email,setEmail]=useState("");var [pass,setPass]=useState("");
  var [nameEn,setNameEn]=useState("");var [coNameEn,setCoNameEn]=useState("");var [coNameAr,setCoNameAr]=useState("");
  var [plan,setPlan]=useState("trial");
  var [err,setErr]=useState("");var [loading,setLoading]=useState(false);

  async function doLogin(){setErr("");setLoading(true);try{var data=await api.login(email,pass);p.onAuth(data.user,data.token);}catch(e){setErr(e.message||"Login failed");}setLoading(false);}
  async function doRegister(){setErr("");setLoading(true);try{var data=await api.subscribe({email:email,password:pass,name_en:nameEn,company_name_en:coNameEn,company_name_ar:coNameAr,plan:plan});p.onAuth(data.user,data.token);}catch(e){setErr(e.message||"Registration failed");}setLoading(false);}

  var plans=[
    {id:"trial",n:t("planTrial"),p:0,f:["3 "+t("users"),"10 "+t("empLimit"),"20 "+t("invLimit"),t("features14")]},
    {id:"starter",n:t("planStarter"),p:9,f:["5 "+t("users"),"25 "+t("empLimit"),"100 "+t("invLimit"),t("vat")+" + "+t("spf")]},
    {id:"professional",n:t("planPro"),p:25,pop:true,f:["15 "+t("users"),"100 "+t("empLimit"),"500 "+t("invLimit"),t("accounting")+" + "+t("quotations")]},
    {id:"enterprise",n:t("planEnt"),p:59,f:["50 "+t("users"),"999 "+t("empLimit"),"9999 "+t("invLimit"),t("purchaseOrders")+" + "+t("wps")]},
  ];

  var features=[
    {i:ic.file,n:t("invoices"),d:t("featInv")},
    {i:ic.users,n:t("employees"),d:t("featEmp")},
    {i:ic.dollar,n:t("vatComp"),d:t("featVat")},
    {i:ic.chart,n:t("accounting"),d:t("featAcct")},
    {i:ic.globe,n:t("contacts"),d:t("featContacts")},
    {i:ic.clip,n:t("quotations"),d:t("featQuotes")},
  ];

  var isAr=p.lang==="ar";
  if(view==="auth") return <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,fontFamily:isAr?"'Noto Sans Arabic','Segoe UI',sans-serif":"'DM Sans','Segoe UI',sans-serif"}}>
    <div style={{width:440,maxWidth:"90vw",background:C.card,border:"1px solid "+C.brd,borderRadius:20,padding:40,boxShadow:"0 25px 60px rgba(0,0,0,.5)"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,"+C.acc+","+C.accL+")",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12}}><span style={{fontSize:28,fontWeight:800,color:"#fff"}}>ع</span></div>
        <h1 style={{fontSize:22,fontWeight:700,color:C.txt,margin:"0 0 4px"}}>{t("appTitle")}</h1>
        <p style={{fontSize:13,color:C.mut,margin:0}}>{mode==="login"?t("signInSub"):t("registerSub")}</p>
        {plan!=="trial"&&mode==="register"&&<div style={{marginTop:8,padding:"4px 12px",background:C.accG,borderRadius:20,display:"inline-block",fontSize:12,color:C.acc,fontWeight:600}}>{plans.find(function(pp){return pp.id===plan;})?.n} — ${plans.find(function(pp){return pp.id===plan;})?.p}{t("perMonth")}</div>}
      </div>
      {err&&<div style={{padding:"10px 14px",background:C.rB,border:"1px solid "+C.rD,borderRadius:8,color:C.r,fontSize:12,marginBottom:14}}>{err}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {mode==="register"&&<Inp label={t("yourName")} value={nameEn} onChange={setNameEn} placeholder="Ahmed Al-Harthi"/>}
        {mode==="register"&&<Inp label={t("compName")} value={coNameEn} onChange={setCoNameEn} placeholder="Future Tech LLC"/>}
        {mode==="register"&&<Inp label={t("compNameAr")} value={coNameAr} onChange={setCoNameAr} placeholder="شركة المستقبل"/>}
        <Inp label={t("email")} value={email} onChange={setEmail} placeholder="admin@company.om" type="email"/>
        <Inp label={t("password")} value={pass} onChange={setPass} placeholder="••••••••" type="password"/>
        <Btn onClick={mode==="login"?doLogin:doRegister} disabled={loading} style={{width:"100%",justifyContent:"center",padding:"12px 20px",fontSize:14}}>
          <Ic d={ic.lock} s={16} c="#fff"/>{loading?t("saving"):mode==="login"?t("signIn"):t("createAccount")}
        </Btn>
      </div>
      <div style={{textAlign:"center",marginTop:16}}>
        <button type="button" onClick={function(){setMode(mode==="login"?"register":"login");setErr("");}} style={{background:"none",border:"none",color:C.acc,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{mode==="login"?t("noAccount"):t("hasAccount")}</button>
      </div>
      <div style={{textAlign:"center",marginTop:8}}><button type="button" onClick={function(){setView("landing");}} style={{background:"none",border:"none",color:C.mut,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{t("viewPricing")}</button></div>
    </div>
  </div>;

  // ─── LANDING PAGE ───
  return <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100vh",background:C.bg,fontFamily:isAr?"'Noto Sans Arabic','Segoe UI',sans-serif":"'DM Sans','Segoe UI',sans-serif",color:C.txt}}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Noto+Sans+Arabic:wght@400;600;700;800&display=swap" rel="stylesheet"/>

    {/* Nav */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 40px",borderBottom:"1px solid "+C.brd}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,"+C.acc+","+C.accL+")",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:17,fontWeight:800,color:"#fff"}}>ع</span></div><span style={{fontSize:16,fontWeight:800,color:C.txt}}>{t("appTitle")}</span></div>
      <div style={{display:"flex",gap:8}}>
        <button type="button" onClick={function(){p.setLang(p.lang==="ar"?"en":"ar");}} style={{background:"none",border:"1px solid "+C.brd,borderRadius:8,padding:"6px 12px",color:C.txt,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{p.lang==="ar"?"English":"العربية"}</button>
        <Btn v="secondary" onClick={function(){setView("auth");setMode("login");}}>{t("signIn")}</Btn>
        <Btn onClick={function(){setView("auth");setMode("register");setPlan("trial");}}>{t("getStarted")}</Btn>
      </div>
    </div>

    {/* Hero */}
    <div style={{textAlign:"center",padding:"80px 40px 60px",maxWidth:700,margin:"0 auto"}}>
      <h1 style={{fontSize:42,fontWeight:800,color:C.txt,lineHeight:1.2,margin:"0 0 20px"}}>{t("heroTitle")}</h1>
      <p style={{fontSize:18,color:C.mut,lineHeight:1.6,margin:"0 0 32px"}}>{t("heroSub")}</p>
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        <Btn onClick={function(){setView("auth");setMode("register");setPlan("trial");}} style={{padding:"14px 32px",fontSize:16}}>{t("getStarted")}</Btn>
        <Btn v="secondary" onClick={function(){document.getElementById("pricing").scrollIntoView({behavior:"smooth"});}} style={{padding:"14px 32px",fontSize:16}}>{t("viewPricing")}</Btn>
      </div>
      <p style={{fontSize:13,color:C.dim,marginTop:16}}>{t("features14")} — {t("noCard")}</p>
    </div>

    {/* Features */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,padding:"0 40px 60px",maxWidth:1000,margin:"0 auto"}}>
      {features.map(function(f,i){return <div key={i} style={{background:C.card,border:"1px solid "+C.brd,borderRadius:14,padding:24}}>
        <div style={{width:40,height:40,borderRadius:10,background:C.accG,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}><Ic d={f.i} s={18} c={C.acc}/></div>
        <div style={{fontSize:15,fontWeight:700,color:C.txt,marginBottom:6}}>{f.n}</div>
        <div style={{fontSize:13,color:C.mut,lineHeight:1.5}}>{f.d}</div>
      </div>;})}
    </div>

    {/* Pricing */}
    <div id="pricing" style={{padding:"60px 40px",maxWidth:1100,margin:"0 auto"}}>
      <h2 style={{fontSize:32,fontWeight:800,color:C.txt,textAlign:"center",margin:"0 0 8px"}}>{t("pricing")}</h2>
      <p style={{fontSize:15,color:C.mut,textAlign:"center",margin:"0 0 40px"}}>{t("noCard")}</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16}}>
        {plans.map(function(pl){return <div key={pl.id} style={{background:C.card,border:pl.pop?"2px solid "+C.acc:"1px solid "+C.brd,borderRadius:16,padding:28,position:"relative",display:"flex",flexDirection:"column"}}>
          {pl.pop&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",padding:"4px 16px",background:C.acc,borderRadius:20,fontSize:11,fontWeight:700,color:"#fff"}}>{t("popular")}</div>}
          <div style={{fontSize:18,fontWeight:700,color:C.txt,marginBottom:4}}>{pl.n}</div>
          <div style={{fontSize:36,fontWeight:800,color:C.acc,marginBottom:4}}>{pl.p===0?t("planTrial"):"$"+pl.p}<span style={{fontSize:14,fontWeight:400,color:C.mut}}>{pl.p>0?t("perMonth"):""}</span></div>
          <div style={{flex:1,marginBottom:20}}>{pl.f.map(function(feat,fi){return <div key={fi} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",fontSize:13,color:C.txt}}><Ic d={ic.check} s={14} c={C.g}/>{feat}</div>;})}</div>
          <Btn v={pl.pop?"primary":"secondary"} onClick={function(){setPlan(pl.id);setView("auth");setMode("register");}} style={{width:"100%",justifyContent:"center"}}>{t("choosePlan")}</Btn>
        </div>;})}
      </div>
    </div>

    {/* Footer */}
    <div style={{textAlign:"center",padding:"30px 40px",borderTop:"1px solid "+C.brd,fontSize:12,color:C.dim}}>
      © {new Date().getFullYear()} {t("appTitle")}
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// ONBOARDING WIZARD — First-time setup after registration
// ═══════════════════════════════════════════════════════════════
function OnboardingWizard(p){
  var t=p.t,toast=p.toast;
  var [step,setStep]=useState(1);var [busy,setBusy]=useState(false);
  var [coForm,setCoForm]=useState({nameAr:p.co.nameAr||"",nameEn:p.co.nameEn||"",cr:"",taxId:"",address:"",phone:"",email:""});
  var [empForm,setEmpForm]=useState({name_en:"",name_ar:"",nationality:"Omani",department:"IT & Telecom",role_title_en:"",basic_salary:0});
  var [prodForm,setProdForm]=useState({name_en:"",barcode:"",unit_price:0,category:""});

  async function saveStep(){
    setBusy(true);
    try{
      if(step===1&&coForm.nameEn){await api.updateCompany(coForm);if(p.setCo)p.setCo(coForm);}
      if(step===2&&empForm.name_en){await api.createEmployee({nameEn:empForm.name_en,name:empForm.name_ar,nat:empForm.nationality,dept:empForm.department,roleEn:empForm.role_title_en,salary:empForm.basic_salary,allow:0});}
      if(step===3&&prodForm.name_en){await api.createProduct(prodForm);}
    }catch(e){toast(e.message,"e");}
    setBusy(false);
    if(step<3){setStep(step+1);}else{doFinish();}
  }
  async function doFinish(){try{await api.markOnboardingDone();}catch(e){}p.onDone();}

  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
    <div style={{width:520,maxWidth:"92vw",background:C.card,border:"1px solid "+C.brd,borderRadius:20,padding:40,boxShadow:"0 25px 60px rgba(0,0,0,.5)"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,"+C.acc+","+C.accL+")",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12}}><span style={{fontSize:28,fontWeight:800,color:"#fff"}}>ع</span></div>
        <h2 style={{fontSize:20,fontWeight:700,color:C.txt,margin:"0 0 4px"}}>{t("setupWizard")}</h2>
        <p style={{fontSize:13,color:C.mut,margin:0}}>{t("step"+step)} — {step}/3</p>
      </div>

      {/* Progress */}
      <div style={{display:"flex",gap:8,marginBottom:28}}>{[1,2,3].map(function(s){return <div key={s} style={{flex:1,height:4,borderRadius:4,background:s<=step?C.acc:C.hov}}></div>;})}</div>

      {step===1&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Inp label={t("compEn")} value={coForm.nameEn} onChange={function(v){setCoForm(Object.assign({},coForm,{nameEn:v}));}}/>
        <Inp label={t("compAr")} value={coForm.nameAr} onChange={function(v){setCoForm(Object.assign({},coForm,{nameAr:v}));}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label={t("crNo")} value={coForm.cr} onChange={function(v){setCoForm(Object.assign({},coForm,{cr:v}));}}/><Inp label={t("taxId")} value={coForm.taxId} onChange={function(v){setCoForm(Object.assign({},coForm,{taxId:v}));}}/></div>
        <Inp label={t("address")} value={coForm.address} onChange={function(v){setCoForm(Object.assign({},coForm,{address:v}));}}/>
        <Inp label={t("phone")} value={coForm.phone} onChange={function(v){setCoForm(Object.assign({},coForm,{phone:v}));}}/>
      </div>}

      {step===2&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
        <p style={{fontSize:13,color:C.mut,margin:0}}>{t("step2")} — {t("skip")}?</p>
        <Inp label={t("nameEn")} value={empForm.name_en} onChange={function(v){setEmpForm(Object.assign({},empForm,{name_en:v}));}}/>
        <Inp label={t("nameAr")} value={empForm.name_ar} onChange={function(v){setEmpForm(Object.assign({},empForm,{name_ar:v}));}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label={t("department")} value={empForm.department} onChange={function(v){setEmpForm(Object.assign({},empForm,{department:v}));}}/>
          <Inp label={t("salary")} type="number" value={empForm.basic_salary} onChange={function(v){setEmpForm(Object.assign({},empForm,{basic_salary:Number(v)}));}}/>
        </div>
      </div>}

      {step===3&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
        <p style={{fontSize:13,color:C.mut,margin:0}}>{t("step3")} — {t("skip")}?</p>
        <Inp label={t("nameEn")} value={prodForm.name_en} onChange={function(v){setProdForm(Object.assign({},prodForm,{name_en:v}));}}/>
        <Inp label={t("barcode")} value={prodForm.barcode} onChange={function(v){setProdForm(Object.assign({},prodForm,{barcode:v}));}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label={t("unitPrice")} type="number" value={prodForm.unit_price} onChange={function(v){setProdForm(Object.assign({},prodForm,{unit_price:Number(v)}));}}/>
          <Inp label={t("category")} value={prodForm.category} onChange={function(v){setProdForm(Object.assign({},prodForm,{category:v}));}}/>
        </div>
      </div>}

      <div style={{display:"flex",justifyContent:"space-between",marginTop:24}}>
        <Btn v="ghost" onClick={function(){if(step<3)setStep(step+1);else doFinish();}}>{t("skip")}</Btn>
        <Btn onClick={saveStep} disabled={busy}>{busy?t("saving"):step===3?t("finish"):t("next")+" →"}</Btn>
      </div>
    </div>
  </div>;
}
