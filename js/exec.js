/* ===== ผู้บริหารระดับสูง (Big Manager) — DFD process 4 ดูรายงาน ===== */
const payBooking = p => Store.rental(p.bookingId) || {};

const ExecViews = {
  overview(el) {
    const db = Store.db;
    const revenue = Logic.revenue();
    const rentals = db.rentals.filter(b => b.status !== 'cancelled' && b.status !== 'pending_payment').length;
    const cars = db.cars.length, rented = db.cars.filter(c => c.status === 'rented').length, repair = db.cars.filter(c => c.status === 'maintenance').length;
    const customers = db.users.filter(u => u.role === 'customer').length;
    const byBranch = BRANCHES.map(b => ({ label: tt(b.th, b.en), value: Logic.revenue(p => payBooking(p).branch === b.id) }));
    const byType = TYPES.map(t => ({ label: tt(t.th, t.en), value: Logic.revenue(p => payBooking(p).type === t.id) }));
    const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return { label: d.toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'th-TH', { month: 'short' }), value: Logic.revenue(p => { const t = new Date(p.at); return t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear(); }) }; });
    el.innerHTML = UI.pageHead('ภาพรวมบริษัท', 'Company overview', 'ตัวเลขสะสมทั้งหมดของบริษัท', 'All-time company figures', ['BM-02'], ['4'])
      + `<div class="grid g3" style="margin-bottom:16px">
        <div class="stat"><div class="label">${tt('รายได้รวม', 'Total revenue')}</div><div class="value">${money(revenue)}</div><div class="sub">${tt('สุทธิหลังคืนเงิน ไม่รวมมัดจำ', 'net of refunds, excl. deposits')}</div></div>
        <div class="stat"><div class="label">${tt('จำนวนการเช่า', 'Rentals')}</div><div class="value">${num(rentals)}</div></div>
        <div class="stat"><div class="label">${tt('จำนวนลูกค้า', 'Customers')}</div><div class="value">${num(customers)}</div></div>
        <div class="stat"><div class="label">${tt('รถทั้งหมด', 'Total cars')}</div><div class="value">${cars}</div></div>
        <div class="stat"><div class="label">${tt('รถที่ถูกเช่า', 'Cars rented')}</div><div class="value">${rented}</div></div>
        <div class="stat"><div class="label">${tt('รถที่ซ่อม', 'Cars in repair')}</div><div class="value">${repair}</div></div></div>
      <div class="grid g2"><div class="card"><h3 style="margin-bottom:8px">${tt('รายได้ 6 เดือนล่าสุด', 'Revenue, last 6 months')}</h3>${UI.bars(months)}</div>
      <div class="card"><h3 style="margin-bottom:10px">${tt('รายได้ตามสาขา', 'Revenue by branch')}</h3>${UI.hbars(byBranch)}<h3 style="margin:16px 0 10px">${tt('รายได้ตามประเภทรถ', 'Revenue by car type')}</h3>${UI.hbars(byType)}</div></div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>${tt('ดูข้อมูลรายคัน', 'Look up a car')}</h3><div style="min-width:220px">${UI.field('plate', 'ทะเบียนรถ', 'Plate', this.plateSelect(App.params.plate || '', tt('เลือกทะเบียนรถ', 'Choose a plate')))}</div></div><div id="car1"></div></div>`;
    const sel = $('[data-field=plate] select', el), box = $('#car1', el);
    const show = () => {
      const c = Store.car(sel.value);
      if (!c) { box.innerHTML = `<p class="muted small">${tt('เลือกทะเบียนรถเพื่อดูรายได้ จำนวนการเช่า และค่าซ่อมของคันนั้น', 'Choose a plate to see that car\'s revenue, rentals and repair cost')}</p>`; return; }
      const ids = new Set(db.rentals.filter(b => b.plate === c.plate).map(b => b.id));
      const n = db.rentals.filter(b => b.plate === c.plate && b.status !== 'cancelled' && b.status !== 'pending_payment').length;
      const rev = Logic.revenue(p => ids.has(p.bookingId)), cost = db.jobs.filter(j => j.plate === c.plate).reduce((s, j) => s + Logic.jobCost(j), 0);
      box.innerHTML = `<div class="small muted" style="margin-bottom:10px">${esc(carName(c))} · ${esc(typeName(c.type))} · ${esc(branchName(c.branch))} · ${badge(Logic.carStatus(c))}</div><div class="grid g3">
        <div class="stat"><div class="label">${tt('รายได้รวม', 'Total revenue')}</div><div class="value">${money(rev)}</div></div>
        <div class="stat"><div class="label">${tt('จำนวนการเช่า', 'Rentals')}</div><div class="value">${num(n)}</div></div>
        <div class="stat"><div class="label">${tt('ค่าซ่อมรวม', 'Repair cost')}</div><div class="value">${money(cost)}</div></div>
        <div class="stat"><div class="label">${tt('กำไรของคันนี้', 'Profit from this car')}</div><div class="value">${money(rev - cost)}</div></div>
        <div class="stat"><div class="label">${tt('อัตราการใช้รถ (90 วัน)', 'Utilisation (90 days)')}</div><div class="value">${(Logic.utilisation(c.plate, 90) * 100).toFixed(1)}%</div></div>
        <div class="stat"><div class="label">${tt('เลขไมล์ล่าสุด', 'Odometer')}</div><div class="value">${num(c.mileage || 0)}</div></div></div>`;
    };
    sel.onchange = show; show();
  },

  /* plate picker shared by the overview and reports (DFD: Big Manager → 4 ทะเบียนรถ) */
  plateSelect(cur, blank = tt('ทุกคัน', 'All cars')) {
    return `<select><option value="">${blank}</option>${Store.db.cars.map(c => `<option value="${esc(c.plate)}" ${c.plate === cur ? 'selected' : ''}>${esc(c.plate)} · ${esc(carName(c))}</option>`).join('')}</select>`;
  },

  revenue(el) {
    const p = App.params;
    const from = p.from || toDateInput(Date.now() - 90 * DAY), to = p.to || toDateInput(Date.now()), group = p.group || 'month', type = p.type || '', branch = p.branch || '';
    el.innerHTML = UI.pageHead('วิเคราะห์รายได้ตามเงื่อนไข', 'Revenue analysis', 'กรองตามช่วงเวลา ประเภทรถ และสาขา', 'Filter by period, car type and branch', ['BM-03'], ['4'])
      + `<div class="card"><form id="f" class="form" novalidate><div class="form-alert"></div><div class="fields" style="grid-template-columns:repeat(5,minmax(0,1fr))">
        ${UI.field('from', 'ตั้งแต่', 'From', `<input type="date" value="${from}">`, { req: true })}${UI.field('to', 'ถึง', 'To', `<input type="date" value="${to}">`, { req: true })}
        ${UI.field('group', 'แสดงราย', 'Group by', `<select>${[['day', 'วัน', 'Day'], ['month', 'เดือน', 'Month'], ['year', 'ปี', 'Year']].map(([k, th, en]) => `<option value="${k}" ${k === group ? 'selected' : ''}>${tt(th, en)}</option>`).join('')}</select>`)}
        ${UI.field('type', 'ประเภทรถ', 'Car type', `<select><option value="">${tt('ทั้งหมด', 'All')}</option>${TYPES.map(t => `<option value="${t.id}" ${t.id === type ? 'selected' : ''}>${esc(tt(t.th, t.en))}</option>`).join('')}</select>`)}
        ${UI.field('branch', 'สาขา', 'Branch', `<select><option value="">${tt('ทั้งหมด', 'All')}</option>${BRANCHES.map(b => `<option value="${b.id}" ${b.id === branch ? 'selected' : ''}>${esc(tt(b.th, b.en))}</option>`).join('')}</select>`)}
        </div><div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${tt('วิเคราะห์', 'Analyse')}</button></div></form></div><div id="res" style="margin-top:16px"></div>`;
    const f = $('#f', el);
    const run = () => {
      UI.clearErrors(f);
      try {
        UI.require(f, ['from', 'to']);
        const a = startOfDay($('[data-field=from] input', f).value).getTime(), z = startOfDay($('[data-field=to] input', f).value).getTime() + DAY - 1;
        if (z < a) throw new AppError(tt('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม', 'End date cannot be before start date'), 'to');
        const g = $('[data-field=group] select', f).value, ty = $('[data-field=type] select', f).value, br = $('[data-field=branch] select', f).value;
        if (g === 'day' && z - a > 92 * DAY) throw new AppError(tt('แสดงรายวันได้สูงสุด 92 วัน กรุณาเลือกรายเดือน', 'Daily view is limited to 92 days — use monthly'), 'group');
        const match = pp => pp.at >= a && pp.at <= z && (!ty || payBooking(pp).type === ty) && (!br || payBooking(pp).branch === br);
        const key = t => { const d = new Date(t); return g === 'day' ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : g === 'month' ? `${pad(d.getMonth() + 1)}/${d.getFullYear()}` : String(d.getFullYear()); };
        const buckets = []; const seen = {};
        for (let t = a; t <= z; t += DAY) { const k = key(t); if (!seen[k]) { seen[k] = { label: k, value: 0, n: new Set() }; buckets.push(seen[k]); } }
        Store.db.payments.filter(pp => Logic.REVENUE_KINDS.includes(pp.kind) && match(pp)).forEach(pp => { const b = seen[key(pp.at)]; if (b) { b.value += pp.amount; if (pp.kind === 'rent') b.n.add(pp.bookingId); } });
        const total = buckets.reduce((s, b) => s + b.value, 0), count = buckets.reduce((s, b) => s + b.n.size, 0);
        $('#res', el).innerHTML = `<div class="grid g3" style="margin-bottom:16px"><div class="stat"><div class="label">${tt('รายได้ในช่วงที่เลือก', 'Revenue in range')}</div><div class="value">${money(total)}</div></div><div class="stat"><div class="label">${tt('จำนวนการเช่าที่ชำระ', 'Paid rentals')}</div><div class="value">${count}</div></div><div class="stat"><div class="label">${tt('รายได้เฉลี่ยต่อการเช่า', 'Average per rental')}</div><div class="value">${money(count ? total / count : 0)}</div></div></div>
          <div class="card"><h3 style="margin-bottom:8px">${tt('ผลวิเคราะห์รายได้', 'Revenue analysis')}</h3>${total ? UI.bars(buckets) : `<div class="alert alert-warn">${tt('ไม่มีรายได้ตามเงื่อนไขที่เลือก', 'No revenue for these filters')}</div>`}
          <div style="margin-top:14px">${UI.table([{ h: tt('ช่วง', 'Period'), v: b => b.label }, { h: tt('จำนวนการเช่า', 'Rentals'), cls: 'num', v: b => b.n.size }, { h: tt('รายได้', 'Revenue'), cls: 'num', v: b => money(b.value) }], buckets.filter(b => b.value))}</div></div>`;
      } catch (err) { UI.showError(f, err); $('#res', el).innerHTML = ''; }
    };
    f.onsubmit = e => { e.preventDefault(); run(); };
    run();
  },

  kpiFor(a, z) {
    const db = Store.db;
    const revenue = Logic.revenue(p => p.at >= a && p.at < z);
    const expenses = db.jobs.filter(j => { const t = j.approvedAt || (j.logs[0] && j.logs[0].at); return t >= a && t < z; }).reduce((s, j) => s + Logic.jobCost(j), 0);
    const made = db.rentals.filter(b => b.createdAt >= a && b.createdAt < z && b.status !== 'pending_payment');
    const cancelled = made.filter(b => b.status === 'cancelled').length;
    const newCust = db.users.filter(u => u.role === 'customer' && u.createdAt >= a && u.createdAt < z).length;
    return { revenue, expenses, profit: revenue - expenses, newCust, bookings: made.length, cancelRate: made.length ? cancelled / made.length : 0 };
  },
  kpi(el) {
    const per = App.params.per || '30';
    const n = +per, z = Date.now(), a = z - n * DAY;
    const cur = this.kpiFor(a, z), prev = this.kpiFor(a - n * DAY, a);
    const delta = (c, p, inv) => { if (!p) return '<span class="sub">-</span>'; const d = (c - p) / Math.abs(p); const good = inv ? d < 0 : d > 0; return `<span class="sub" style="color:${good ? 'var(--ok)' : 'var(--danger)'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(1)}% ${tt('เทียบช่วงก่อน', 'vs previous')}</span>`; };
    const util = Store.db.cars.reduce((s, c) => s + Logic.utilisation(c.plate, Math.min(n, 180)), 0) / Store.db.cars.length;
    el.innerHTML = UI.pageHead('ตัวชี้วัด (KPI)', 'Key performance indicators', 'เทียบกับช่วงเวลาก่อนหน้าที่ยาวเท่ากัน', 'Compared with the previous period of equal length', ['BM-04'], ['4'],
      `<div class="seg">${[['7', '7 วัน', '7 days'], ['30', '30 วัน', '30 days'], ['90', '90 วัน', '90 days'], ['180', '180 วัน', '180 days']].map(([k, th, en]) => `<button class="${k === per ? 'on' : ''}" data-p="${k}">${tt(th, en)}</button>`).join('')}</div>`)
      + `<div class="grid g3">
        <div class="stat"><div class="label">${tt('รายได้', 'Revenue')}</div><div class="value">${money(cur.revenue)}</div>${delta(cur.revenue, prev.revenue)}</div>
        <div class="stat"><div class="label">${tt('ค่าใช้จ่าย (ซ่อมบำรุง)', 'Expenses (maintenance)')}</div><div class="value">${money(cur.expenses)}</div>${delta(cur.expenses, prev.expenses, true)}</div>
        <div class="stat"><div class="label">${tt('กำไร', 'Profit')}</div><div class="value">${money(cur.profit)}</div>${delta(cur.profit, prev.profit)}</div>
        <div class="stat"><div class="label">${tt('จำนวนลูกค้าใหม่', 'New customers')}</div><div class="value">${cur.newCust}</div>${delta(cur.newCust, prev.newCust)}</div>
        <div class="stat"><div class="label">${tt('อัตราการยกเลิก', 'Cancellation rate')}</div><div class="value">${(cur.cancelRate * 100).toFixed(1)}%</div><span class="sub">${cur.bookings} ${tt('การจองในช่วงนี้', 'bookings in period')}</span></div>
        <div class="stat"><div class="label">${tt('อัตราการใช้รถเฉลี่ย', 'Avg. fleet utilisation')}</div><div class="value">${(util * 100).toFixed(1)}%</div></div></div>
      <div class="small muted" style="margin-top:12px">${tt('กำไร = รายได้ − ค่าซ่อมบำรุง (ต้นแบบนี้ยังไม่รวมต้นทุนอื่น เช่น เงินเดือน ค่าเสื่อม)', 'Profit = revenue − maintenance cost (this prototype excludes other costs such as salaries and depreciation)')}</div>`;
    $$('[data-p]', el).forEach(b => b.onclick = () => App.go('kpi', { per: b.dataset.p }));
  },

  REPORTS: {
    rentals: {
      th: 'รายงานการเช่ารถ', en: 'Rental report', cols: () => [['Booking ID', 'Booking ID'], ['ผู้เช่า', 'Renter'], ['ทะเบียนรถ', 'Plate'], ['ประเภทรถ', 'Type'], ['สาขา', 'Branch'], ['วันเวลารับรถ', 'Pick-up'], ['วันเวลาคืนรถ', 'Return'], ['ยอดชำระ', 'Amount'], ['ค่าปรับ', 'Late fee'], ['สถานะ', 'Status']],
      rows: (a, z, pl) => Store.db.rentals.filter(b => b.pickupAt >= a && b.pickupAt <= z && (!pl || b.plate === pl)).sort((x, y) => x.pickupAt - y.pickupAt).map(b => [b.id, fullName(Store.user(b.customerId)), b.plate, typeName(b.type), branchName(b.branch), fmtDT(b.pickupAt), fmtDT(b.returnAt), b.total, b.lateFee, tt(STATUS[b.status][0], STATUS[b.status][1])])
    },
    repairs: {
      th: 'รายงานการซ่อมรถ', en: 'Repair report', cols: () => [['งาน', 'Job'], ['ทะเบียนรถ', 'Plate'], ['รายการซ่อม', 'Repair'], ['ช่าง', 'Mechanic'], ['ซ่อมที่', 'Where'], ['ค่าซ่อม', 'Cost'], ['สถานะ', 'Status'], ['วันที่', 'Date']],
      rows: (a, z, pl) => Store.db.jobs.filter(j => { const t = j.approvedAt || j.assignedAt || 0; return t >= a && t <= z && (!pl || j.plate === pl); }).map(j => [j.id, j.plate, j.damage, j.assignedTo ? fullName(Store.user(j.assignedTo)) : '-', j.mode === 'shop' ? tt('อู่', 'Shop') : tt('ภายใน', 'In-house'), Logic.jobCost(j), tt(STATUS[j.status][0], STATUS[j.status][1]), fmtD(j.approvedAt || j.assignedAt)])
    },
    payments: {
      th: 'รายงานการชำระเงิน', en: 'Payment report', cols: () => [['เลขที่ธุรกรรม', 'Txn'], ['Booking ID', 'Booking ID'], ['รายการ', 'Kind'], ['ช่องทาง', 'Method'], ['วันที่', 'Date'], ['จำนวนเงิน', 'Amount']],
      rows: (a, z, pl) => Store.db.payments.filter(p => p.at >= a && p.at <= z && (!pl || payBooking(p).plate === pl)).sort((x, y) => x.at - y.at).map(p => [p.txn, p.bookingId, payKind(p.kind), methodName(p.method), fmtDT(p.at), p.amount])
    },
    customers: {
      th: 'รายงานลูกค้า', en: 'Customer report', cols: () => [['รหัสลูกค้า', 'Customer ID'], ['ชื่อ-นามสกุล', 'Name'], ['อีเมล', 'Email'], ['วันที่สมัคร', 'Joined'], ['จำนวนการเช่า', 'Rentals'], ['ยอดใช้จ่ายรวม', 'Total spend']],
      rows: (a, z, pl) => Store.db.users.filter(u => u.role === 'customer' && u.createdAt <= z && (!pl || Store.db.rentals.some(b => b.customerId === u.id && b.plate === pl))).map(u => { const ids = new Set(Store.db.rentals.filter(b => b.customerId === u.id && (!pl || b.plate === pl)).map(b => b.id)); return [u.id, fullName(u), u.email || '-', fmtD(u.createdAt), ids.size, Logic.revenue(p => ids.has(p.bookingId) && p.at >= a && p.at <= z)]; })
    },
  },
  reports(el) {
    const p = App.params, kind = p.kind || 'rentals';
    const from = p.from || toDateInput(Date.now() - 30 * DAY), to = p.to || toDateInput(Date.now() + 30 * DAY), plate = p.plate || '';
    el.innerHTML = UI.pageHead('รายงานทั้งหมด', 'All reports', 'ดูรายงาน แล้ว Export เป็น CSV (Excel) หรือ PDF', 'View reports, then export as CSV (Excel) or PDF', ['BM-05', 'BM-06'], ['4'])
      + `<div class="card"><form id="f" class="form" novalidate><div class="form-alert"></div><div class="fields" style="grid-template-columns:repeat(5,minmax(0,1fr))">
        ${UI.field('kind', 'ประเภทรายงาน', 'Report type', `<select>${Object.entries(this.REPORTS).map(([k, r]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${tt(r.th, r.en)}</option>`).join('')}</select>`, { req: true })}
        ${UI.field('from', 'ช่วงเวลา ตั้งแต่', 'From', `<input type="date" value="${from}">`, { req: true })}${UI.field('to', 'ถึง', 'To', `<input type="date" value="${to}">`, { req: true })}
        ${UI.field('plate', 'ทะเบียนรถ', 'Plate', ExecViews.plateSelect(plate))}
        ${UI.field('fmt', 'รูปแบบไฟล์', 'File format', `<select><option value="csv">CSV (Excel)</option><option value="pdf">PDF (${tt('พิมพ์', 'print')})</option></select>`)}
        </div><div class="row" style="justify-content:flex-end"><button type="button" class="btn" id="view">${tt('ดูรายงาน', 'View report')}</button><button class="btn btn-primary">${tt('Export รายงาน', 'Export report')}</button></div></form></div><div id="res" style="margin-top:16px"></div>`;
    const f = $('#f', el);
    const build = () => {
      UI.clearErrors(f);
      UI.require(f, ['from', 'to']);
      const a = startOfDay($('[data-field=from] input', f).value).getTime(), z = startOfDay($('[data-field=to] input', f).value).getTime() + DAY - 1;
      if (z < a) throw new AppError(tt('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม', 'End date cannot be before start date'), 'to');
      const k = $('[data-field=kind] select', f).value, r = this.REPORTS[k], pl = $('[data-field=plate] select', f).value;
      return { k, r, a, z, pl, cols: r.cols().map(c => tt(...c)), rows: r.rows(a, z, pl) };
    };
    const show = rep => {
      $('#res', el).innerHTML = `<div class="card" id="rep"><div class="card-head"><div><h3>${tt(rep.r.th, rep.r.en)}</h3><div class="small muted">${fmtD(rep.a)} – ${fmtD(rep.z)}${rep.pl ? ` · <span class="mono">${esc(rep.pl)}</span>` : ''} · ${rep.rows.length} ${tt('รายการ', 'rows')} · ${tt('สร้างเมื่อ', 'generated')} ${fmtDT(Date.now())}</div></div></div>
        ${UI.table(rep.cols.map((h, i) => ({ h, cls: typeof rep.rows[0]?.[i] === 'number' ? 'num' : '', v: row => typeof row[i] === 'number' ? (/(ยอด|Amount|Cost|ค่า|fee|spend|จำนวนเงิน)/i.test(h) ? money(row[i]) : num(row[i])) : esc(row[i]) })), rep.rows.slice(0, 200), 'ไม่มีข้อมูลในช่วงเวลาที่เลือก', 'No data for this period')}</div>`;
    };
    $('#view', el).onclick = () => { try { show(build()); } catch (err) { UI.showError(f, err); } };
    f.onsubmit = e => {
      e.preventDefault();
      try {
        const rep = build();
        if (!rep.rows.length) throw new AppError(tt('ไม่มีข้อมูลในช่วงเวลาที่เลือก ไม่สามารถ Export ได้', 'No data in this period — nothing to export'));
        show(rep);
        if ($('[data-field=fmt] select', f).value === 'csv') { UI.csv(`ITDS262_${rep.k}_report_${rep.pl ? rep.pl.replace(/\s+/g, '') + '_' : ''}${toDateInput(rep.a)}_${toDateInput(rep.z)}.csv`, [rep.cols, ...rep.rows]); UI.toast(tt('ดาวน์โหลดไฟล์รายงาน (CSV) แล้ว', 'Report downloaded (CSV)'), 'ok'); }
        else UI.printEl($('#rep', el));
      } catch (err) { UI.showError(f, err); }
    };
    try { show(build()); } catch (e) { }
  },
};

/* ===== FR coverage / traceability page (no login needed) ===== */
const FrMap = {
  render(el) {
    const actors = ['customer', 'office_employee', 'office_manager', 'mechanic', 'mechanic_manager', 'big_manager'];
    const gaps = FRS.filter(f => f.gap);
    el.innerHTML = UI.pageHead('แผนผัง FR ↔ หน้าจอ ↔ DFD', 'FR ↔ screen ↔ DFD map', 'ทุก functional requirement ใน Lab 5 ถูกทำเป็นหน้าจอในต้นแบบนี้ แถวสีส้มคือ FR ที่ยังไม่มี use case หรือ data flow รองรับ ต้องแก้ diagram ก่อนส่ง', 'Every Lab 5 functional requirement is implemented in this prototype. Orange rows are FRs with no supporting use case or data flow; fix the diagrams before submission.', [], [])
      + `<div class="grid g4" style="margin-bottom:16px"><div class="stat"><div class="label">${tt('FR ทั้งหมด', 'Total FRs')}</div><div class="value">${FRS.length}</div></div><div class="stat"><div class="label">${tt('ทำในต้นแบบ', 'Implemented')}</div><div class="value" style="color:var(--ok)">${FRS.length}</div></div><div class="stat"><div class="label">${tt('ไม่สอดคล้องกับ diagram', 'Diagram mismatches')}</div><div class="value" style="color:var(--warn)">${gaps.length}</div></div><div class="stat"><div class="label">${tt('Use case ที่ไม่มี FR', 'Use cases without FR')}</div><div class="value" style="color:var(--warn)">${UC_WITHOUT_FR.length}</div></div></div>
      ${actors.map(a => `<div class="card"><h3 style="margin-bottom:10px">${esc(roleName(a))}</h3><div class="table-wrap"><table><thead><tr><th>FR</th><th>${tt('ความต้องการ', 'Requirement')}</th><th>${tt('หน้าจอ', 'Screen')}</th><th>DFD</th><th>Use case</th></tr></thead><tbody>
        ${FRS.filter(f => f.actor === a).map(f => `<tr style="${f.gap ? 'background:var(--warn-soft)' : ''}"><td class="mono nowrap"><b>${f.id}</b></td><td>${esc(tt(f.th, f.en))}${f.gap ? `<div class="small" style="color:var(--warn);margin-top:2px">⚠ ${esc(tt(...f.gap))}</div>` : ''}</td><td class="small">${esc(tt(...f.screen))}</td><td class="mono small nowrap">${esc(f.dfd)}</td><td class="small">${esc(f.uc)}</td></tr>`).join('')}
        </tbody></table></div></div>`).join('')}
      <div class="card"><h3 style="margin-bottom:10px">${tt('Use case ใน diagram ที่ยังไม่มี FR', 'Use cases on the diagram with no FR')}</h3>${UC_WITHOUT_FR.map(u => `<div class="sum-line"><span>${esc(tt(u[0], u[1]))}</span><span class="small mono muted">${esc(u[2])}</span></div>`).join('')}<p class="small muted" style="margin-top:8px">${tt('ทั้งสองอย่างมีในต้นแบบแล้ว (เมนู "ค่าใช้จ่ายการซ่อม" ของผู้เช่า และคอลัมน์อัตราการใช้งานในหน้าสถานะรถ) ควรเพิ่ม FR ให้ครบ', 'Both are in the prototype (Customer "Repair costs" and the utilisation column on Fleet status) — add matching FRs')}</p></div>`;
  }
};

Roles.big_manager = {
  nav: [['overview', 'ภาพรวมบริษัท', 'Overview', 'chart'], ['revenue', 'วิเคราะห์รายได้', 'Revenue analysis', 'trend'], ['kpi', 'ตัวชี้วัด (KPI)', 'KPIs', 'gauge'], ['reports', 'รายงาน + Export', 'Reports + export', 'file']],
  views: { overview: el => ExecViews.overview(el), revenue: el => ExecViews.revenue(el), kpi: el => ExecViews.kpi(el), reports: el => ExecViews.reports(el) },
};
