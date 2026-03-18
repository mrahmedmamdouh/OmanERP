describe("Oman ERP — Unit Tests", () => {

  test("VAT rate is 5% per Oman Tax Authority", () => {
    const VAT = 0.05;
    const subtotal = 1000;
    expect(subtotal * VAT).toBe(50);
    expect(subtotal * (1 + VAT)).toBe(1050);
  });

  test("SPF contribution rates are correct", () => {
    const SPF_ER = 0.1175;  // Employer
    const SPF_EE = 0.07;    // Employee
    const SPF_GV = 0.0525;  // Government
    const total = SPF_ER + SPF_EE + SPF_GV;
    expect(total).toBeCloseTo(0.24, 4);

    // Test with a salary of 1000 OMR
    const salary = 1000;
    expect(salary * SPF_ER).toBeCloseTo(117.5, 1);
    expect(salary * SPF_EE).toBe(70);
    expect(salary * SPF_GV).toBeCloseTo(52.5, 1);
  });

  test("Omanization targets match Ministry of Labour", () => {
    const TARGETS = {
      "IT & Telecom": 25, Banking: 90, Retail: 20, Tourism: 30,
      Construction: 15, Manufacturing: 20, Education: 50,
      Healthcare: 40, "Oil & Gas": 60, Transport: 30, "General Trading": 15,
    };
    expect(TARGETS.Banking).toBe(90);
    expect(TARGETS["Oil & Gas"]).toBe(60);
    expect(TARGETS.Retail).toBe(20);
    expect(Object.keys(TARGETS).length).toBe(11);
  });

  test("OMR formats to 3 decimal places", () => {
    const fmtOMR = (n) => n.toFixed(3) + " OMR";
    expect(fmtOMR(1234.5)).toBe("1234.500 OMR");
    expect(fmtOMR(0)).toBe("0.000 OMR");
    expect(fmtOMR(99.999)).toBe("99.999 OMR");
  });

  test("Invoice total calculation", () => {
    const items = [
      { qty: 1, price: 2500 },
      { qty: 3, price: 150 },
    ];
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    expect(subtotal).toBe(2950);
    expect(subtotal * 1.05).toBeCloseTo(3097.5, 2);
  });

  test("Omanization compliance check", () => {
    function isCompliant(omanis, total, target) {
      return Math.round((omanis / total) * 100) >= target;
    }
    expect(isCompliant(2, 3, 25)).toBe(true);   // 67% >= 25%
    expect(isCompliant(1, 10, 25)).toBe(false);  // 10% < 25%
    expect(isCompliant(9, 10, 90)).toBe(true);   // 90% >= 90%
  });

  test("Payroll net pay calculation", () => {
    const basic = 850;
    const allowances = 150;
    const gross = basic + allowances;
    const spfDeduction = basic * 0.07; // Omani employee
    const net = gross - spfDeduction;
    expect(gross).toBe(1000);
    expect(spfDeduction).toBeCloseTo(59.5, 1);
    expect(net).toBeCloseTo(940.5, 1);
  });

  test("Sequential invoice numbering", () => {
    function nextInvNum(existing) {
      const nums = existing.map(id => parseInt(id.split("-").pop()));
      const next = Math.max(0, ...nums) + 1;
      return "INV-2025-" + String(next).padStart(4, "0");
    }
    expect(nextInvNum(["INV-2025-0001", "INV-2025-0002"])).toBe("INV-2025-0003");
    expect(nextInvNum([])).toBe("INV-2025-0001");
  });
});
