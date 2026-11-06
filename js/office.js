/* ===== พนักงานออฟฟิศ (Office Employee) + ผู้จัดการออฟฟิศ (Office Manager) ===== */
const fuelSelect = (v = 8) => `<select>${[8, 7, 6, 5, 4, 3, 2, 1, 0].map(n => `<option value="${n}" ${n === v ? 'selected' : ''}>${n}/8${n === 8 ? ' (' + tt('เต็มถัง', 'full') + ')' : ''}</option>`).join('')}</select>`;
const fuelText = n => n == null ? '-' : `${n}/8`;

const StaffViews = {
  detail(id) {
    const b = Store.rental(id), c = Store.user(b.customerId), car = Store.car(b.plate);
    const pays = Store.db.payments.filter(p => p.bookingId === b.id);
    UI.modal(`<div class="modal-head"><div><h3>${tt('รายละเอียดการเช่ารถ', 'Rental details')} <span class="mono">${b.id}</span></h3><div style="margin-top:4px">${badge(b.status)}</div></div><button class="x-btn" data-close>×</button></div>
      <div class="modal-body"><div class="grid g2"><dl class="kv">
        <dt>${tt('ผู้เช่า', 'Renter')}</dt><dd>${esc(fullName(c))}<div class="small muted">${esc(c.phone || '')} · ID ${esc(c.nationalId || '-')}</div></dd>
        <dt>${tt('ทะเบียนรถ', 'Plate')}</dt><dd class="mono">${esc(b.plate)}</dd><dt>${tt('ยี่ห้อรถ', 'Car')}</dt><dd>${esc(carName(car))}</dd><dt>${tt('ประเภทรถ', 'Type')}</dt><dd>${esc(typeName(b.type))}</dd>
        <dt>${tt('วันเวลารับรถ', 'Pick-up')}</dt><dd>${fmtDT(b.pickupAt)}</dd><dt>${tt('วันเวลาส่งคืนรถ', 'Return')}</dt><dd>${fmtDT(b.returnAt)}</dd><dt>${tt('สาขา', 'Branch')}</dt><dd>${esc(branchName(b.branch))}</dd>
        <dt>${tt('สัญญาเช่า', 'Contract')}</dt><dd>${b.contract ? `${b.contract.no} · ${b.contract.signed ? `<span class="badge b-ok">${tt('เซ็นแล้ว', 'Signed')}</span>` : `<span class="badge b-warn">${tt('ยังไม่เซ็น', 'Unsigned')}</span>`}` : '-'}</dd>
      </dl><div><dl class="kv">
        <dt>${tt('ยอดชำระ', 'Amount')}</dt><dd>${money(b.total)}</dd><dt>${tt('มัดจำ', 'Deposit')}</dt><dd>${money(b.deposit)} ${badge(b.depositStatus)}</dd>
        ${b.handover ? `<dt>${tt('ส่งมอบ', 'Handed over')}</dt><dd>${fmtDT(b.handover.at)} · ${num(b.handover.mileage)} km · ${fuelText(b.handover.fuel)}</dd>` : ''}
        ${b.returned ? `<dt>${tt('รับคืน', 'Returned')}</dt><dd>${fmtDT(b.returned.at)} · ${num(b.returned.mileage)} km · ${fuelText(b.returned.fuel)}</dd><dt>${tt('ค่าปรับคืนช้า', 'Late fee')}</dt><dd>${money(b.lateFee)}</dd>` : ''}
        ${b.returned && b.returned.damaged ? `<dt>${tt('ความเสียหาย', 'Damage')}</dt><dd>${esc(b.returned.note)}</dd>` : ''}
        ${b.cancelReason ? `<dt>${tt('เหตุผลยกเลิก', 'Cancel reason')}</dt><dd>${esc(b.cancelReason)}</dd>` : ''}
      </dl><div class="small muted" style="margin-top:10px">${tt('การชำระเงิน (D5)', 'Payments (D5)')}: ${pays.length} ${tt('รายการ', 'records')} · ${tt('สุทธิ', 'net')} ${money(pays.reduce((s, p) => s + p.amount, 0))}</div></div></div></div>
      <div class="modal-foot"><button class="btn btn-primary" data-close>${tt('ปิด', 'Close')}</button></div>`, { wide: true });
  },

  /* OE-02 / DFD 1.2 */
  avail(el) {
    const p = App.params;
    const s0 = p.start || (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d.getTime(); })();
    const e0 = p.end || s0 + DAY;
    el.innerHTML = UI.pageHead('ตรวจสอบรถที่ว่าง', 'Check available cars', 'ค้นหารถว่างตามวันที่เช่าและประเภทรถ', 'Search free cars by rental date and type', ['OE-02'], ['1.2'])
      + `<div class="card"><form id="f" class="form" novalidate><div class="form-alert"></div><div class="fields" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${UI.field('start', 'วันที่เช่า (รับรถ)', 'Rental date (pick-up)', `<input type="datetime-local" value="${toLocalInput(s0)}">`, { req: true })}
        ${UI.field('end', 'วันที่คืนรถ', 'Return date', `<input type="datetime-local" value="${toLocalInput(e0)}">`, { req: true })}
        ${UI.field('branch', 'สาขา', 'Branch', `<select><option value="">${tt('ทุกสาขา', 'All branches')}</option>${BRANCHES.map(b => `<option value="${b.id}" ${p.branch === b.id ? 'selected' : ''}>${esc(tt(b.th, b.en))}</option>`).join('')}</select>`)}
        ${UI.field('type', 'ประเภทรถ', 'Car type', `<select><option value="">${tt('ทุกประเภท', 'All types')}</option>${TYPES.map(t => `<option value="${t.id}" ${p.type === t.id ? 'selected' : ''}>${esc(tt(t.th, t.en))}</option>`).join('')}</select>`)}
        </div><div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${tt('ตรวจสอบ', 'Check')}</button></div></form></div><div id="res"></div>`;
    const f = $('#f', el);
    const run = () => {
      UI.clearErrors(f);
      try {
        const start = new Date($('[data-field=start] input', f).value).getTime(), end = new Date($('[data-field=end] input', f).value).getTime();
        Logic.validatePeriod(start, end, { allowPast: true });
        const branch = $('[data-field=branch] select', f).value, type = $('[data-field=type] select', f).value;
        const cars = Store.db.cars.filter(c => (!branch || c.branch === branch) && (!type || c.type === type));
        const free = cars.filter(c => Logic.isFree(c.plate, start, end));
        $('#res', el).innerHTML = `<div class="card"><div class="card-head"><h3>${tt('รายการรถที่ว่าง', 'Available cars')}: ${free.length} / ${cars.length}</h3>
          <button class="btn btn-sm btn-primary" id="mk" ${free.length ? '' : 'disabled'}>${tt('สร้างรายการเช่าจากช่วงเวลานี้', 'Create rental for this period')} →</button></div>
          ${UI.table([
          { h: tt('ทะเบียนรถ', 'Plate'), v: c => `<span class="mono">${esc(c.plate)}</span>` }, { h: tt('ยี่ห้อรถ', 'Car'), v: c => esc(carName(c)) },
          { h: tt('ประเภทรถ', 'Type'), v: c => esc(typeName(c.type)) }, { h: tt('สาขา', 'Branch'), v: c => esc(branchName(c.branch)) },
          { h: tt('ค่าเช่า', 'Price'), cls: 'num', v: c => money(Logic.price(c.type, start, end).total) },
          { h: tt('ช่วงเวลานี้', 'This period'), v: c => Logic.isFree(c.plate, start, end) ? badge('available') : c.status === 'maintenance' ? badge('maintenance') : `<span class="badge b-danger">${tt('ไม่ว่าง (มีการจอง)', 'Booked')}</span>` },
        ], cars.sort((a, b) => Logic.isFree(b.plate, start, end) - Logic.isFree(a.plate, start, end)))}</div>`;
        $('#mk', el).onclick = () => App.go('create', { start, end, branch, type });
      } catch (err) { UI.showError(f, err); $('#res', el).innerHTML = ''; }
    };
    f.onsubmit = e => { e.preventDefault(); run(); };
    run();
  },

  /* OE-03 / DFD 1.3 */
  create(el) {
    const p = App.params;
    const s0 = p.start || Date.now() + HOUR, e0 = p.end || s0 + DAY;
    const custOpts = Store.db.users.filter(u => u.role === 'customer');
    el.innerHTML = UI.pageHead('สร้างรายการเช่ารถ', 'Create a rental', 'สำหรับลูกค้า walk-in หรือจองทางโทรศัพท์', 'For walk-in or phone customers', ['OE-03'], ['1.3', '1.4'])
      + `<form id="f" class="form" novalidate><div class="form-alert"></div><div class="grid g2">
        <div class="card"><div class="card-head"><h3>${tt('ข้อมูลผู้เช่า', 'Renter')}</h3><div class="seg"><button type="button" class="on" data-mode="new">${tt('ลูกค้าใหม่', 'New')}</button><button type="button" data-mode="old">${tt('ลูกค้าเดิม', 'Existing')}</button></div></div>
          <div id="newc" class="fields">
            ${UI.field('first', 'ชื่อ', 'First name', '<input>', { req: true })}${UI.field('last', 'นามสกุล', 'Last name', '<input>', { req: true })}
            ${UI.field('nid', 'เลขบัตรประชาชน', 'National ID', '<input inputmode="numeric" maxlength="13" placeholder="13 หลัก">', { req: true, hint: tt('ตรวจ checksum 13 หลัก', '13-digit checksum validated') })}
            ${UI.field('license', 'เลขใบขับขี่', 'Driving licence no.', '<input>', { req: true })}
            ${UI.field('phone', 'เบอร์โทร', 'Phone', '<input inputmode="tel" maxlength="10" placeholder="08xxxxxxxx">', { req: true })}
            ${UI.field('email', 'อีเมล', 'Email', '<input type="email">')}
          </div>
          <div id="oldc" class="hidden">${UI.field('cust', 'เลือกลูกค้า', 'Select customer', `<select><option value="">—</option>${custOpts.map(u => `<option value="${u.id}">${esc(fullName(u))} · ${esc(u.phone)}</option>`).join('')}</select>`, { req: true })}</div>
        </div>
        <div class="card"><h3 style="margin-bottom:14px">${tt('ข้อมูลการเช่า', 'Rental')}</h3><div class="fields">
          ${UI.field('start', 'วันเวลารับรถ', 'Pick-up', `<input type="datetime-local" value="${toLocalInput(s0)}">`, { req: true })}
          ${UI.field('end', 'วันเวลาคืนรถ', 'Return', `<input type="datetime-local" value="${toLocalInput(e0)}">`, { req: true })}
          ${UI.field('plate', 'ยี่ห้อรถ / ทะเบียน (เฉพาะคันที่ว่าง)', 'Car / plate (available only)', '<select></select>', { req: true, cls: 'span2' })}
          </div><div id="price" style="margin-top:12px"></div></div></div>
        <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn btn-primary">${tt('สร้างรายการเช่าและรับชำระเงิน', 'Create rental and take payment')}</button></div></form>`;
    const f = $('#f', el); let mode = 'new';
    $$('[data-mode]', f).forEach(b => b.onclick = () => { mode = b.dataset.mode; $$('[data-mode]', f).forEach(x => x.classList.toggle('on', x === b)); $('#newc', f).classList.toggle('hidden', mode !== 'new'); $('#oldc', f).classList.toggle('hidden', mode !== 'old'); });
    const sIn = $('[data-field=start] input', f), eIn = $('[data-field=end] input', f), pSel = $('[data-field=plate] select', f);
    const refresh = () => {
      const start = new Date(sIn.value).getTime(), end = new Date(eIn.value).getTime();
      if (!(end > start)) { pSel.innerHTML = `<option value="">${tt('ระบุช่วงเวลาให้ถูกต้องก่อน', 'Enter a valid period first')}</option>`; $('#price', f).innerHTML = ''; return; }
      const list = Logic.search({ start, end, branch: p.branch || '', type: p.type || '' });
      const all = list.length ? list : Logic.search({ start, end });
      pSel.innerHTML = all.length ? all.map(({ car, price }) => `<option value="${esc(car.plate)}">${esc(carName(car))} · ${esc(car.plate)} · ${esc(branchName(car.branch))} · ${money(price.total)}</option>`).join('') : `<option value="">${tt('ไม่มีรถว่าง', 'No cars available')}</option>`;
      showPrice();
    };
    const showPrice = () => {
      const car = Store.car(pSel.value); const start = new Date(sIn.value).getTime(), end = new Date(eIn.value).getTime();
      $('#price', f).innerHTML = car ? (() => { const pr = Logic.price(car.type, start, end); return `<div class="sum-line"><span>${tt('ค่าเช่า', 'Rent')} (${pr.days} ${tt('วัน', 'days')})</span><span class="mono">${money(pr.total)}</span></div><div class="sum-line"><span>${tt('มัดจำ', 'Deposit')}</span><span class="mono">${money(pr.deposit)}</span></div><div class="sum-line total"><span>${tt('ยอดชำระ', 'Amount due')}</span><span>${money(pr.total + pr.deposit)}</span></div>`; })() : '';
    };
    sIn.onchange = refresh; eIn.onchange = refresh; pSel.onchange = showPrice; refresh();
    f.onsubmit = e => {
      e.preventDefault(); UI.clearErrors(f);
      try {
        let cust;
        if (mode === 'new') {
          UI.require(f, ['first', 'last', 'nid', 'license', 'phone']);
          const nid = $('[data-field=nid] input', f).value.trim(), phone = $('[data-field=phone] input', f).value.trim();
          if (!validThaiId(nid)) throw new AppError(tt('เลขบัตรประชาชนไม่ถูกต้อง (ต้องเป็น 13 หลักและผ่าน checksum)', 'Invalid national ID (13 digits with valid checksum)'), 'nid');
          if (!/^0\d{9}$/.test(phone)) throw new AppError(tt('เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0', 'Phone must be 10 digits starting with 0'), 'phone');
          cust = Store.db.users.find(u => u.role === 'customer' && u.nationalId === nid);
          if (!cust) {
            cust = { id: Store.next('user', 'U'), username: null, password: null, role: 'customer', firstName: $('[data-field=first] input', f).value.trim(), lastName: $('[data-field=last] input', f).value.trim(), nationalId: nid, license: $('[data-field=license] input', f).value.trim(), phone, email: $('[data-field=email] input', f).value.trim(), status: 'active', createdAt: Date.now(), walkIn: true };
            Store.db.users.push(cust);
          }
        } else {
          UI.require(f, ['cust']); cust = Store.user($('[data-field=cust] select', f).value);
        }
        UI.require(f, ['start', 'end', 'plate']);
        const b = Logic.createBooking({ customerId: cust.id, plate: pSel.value, start: new Date(sIn.value).getTime(), end: new Date(eIn.value).getTime(), createdBy: App.user.id });
        UI.toast(tt(`สร้างรายการเช่า ${b.id} แล้ว — รับชำระเงิน`, `Rental ${b.id} created — take payment`), 'ok');
        PaymentService.open({
          bookingId: b.id, amount: b.total + b.deposit, holdUntil: b.holdUntil, lines: [[tt('ค่าเช่า', 'Rent'), b.total], [tt('ค่ามัดจำ', 'Deposit'), b.deposit]],
          onSuccess: r => Logic.confirmPayment(b.id, r),
          after: () => { App.go('bookings'); UI.confirm(tt('ให้ผู้เช่าเซ็นสัญญาที่เคาน์เตอร์?', 'Have the renter sign at the counter?'), `<p>Booking ID <b class="mono">${b.id}</b></p><p class="muted">${tt('ผู้เช่าต้องเซ็นสัญญาก่อนส่งมอบรถ', 'The renter must sign before hand-over')}</p>`, { okText: tt('เปิดสัญญา', 'Open contract') }).then(ok => ok && CustomerViews.contract(b.id)); },
          onTimeout: () => { Logic.expirePending(b.id); App.render(); },
          onCancel: () => { UI.toast(tt(`ยังไม่ได้รับชำระ — ${b.id} สถานะรอชำระ`, `Not paid — ${b.id} awaiting payment`), 'warn'); App.go('bookings'); }
        });
      } catch (err) { UI.showError(f, err); }
    };
  },

  /* OE-04 / OE-05 — DFD 2.1–2.3 */
  bookings(el) {
    Logic.housekeeping();
    const q = (App.params.q || '').toUpperCase(), st = App.params.status || '';
    const rows = Store.db.rentals.filter(b => (!st || b.status === st) && (!q || b.id.includes(q) || b.plate.toUpperCase().includes(q) || fullName(Store.user(b.customerId)).toUpperCase().includes(q))).sort((a, b) => b.createdAt - a.createdAt);
    el.innerHTML = UI.pageHead('รายการเช่าทั้งหมด', 'All rentals', 'ดู แก้ไข และลบรายการเช่า', 'View, edit and delete rentals', ['OE-04', 'OE-05'], ['2.1', '2.2', '2.3'])
      + `<div class="card"><div class="card-head"><div class="row"><input id="q" placeholder="Booking ID / ${tt('ทะเบียน / ชื่อ', 'plate / name')}" value="${esc(App.params.q || '')}" style="width:240px">
        <select id="st" style="width:auto"><option value="">${tt('ทุกสถานะ', 'All statuses')}</option>${['pending_payment', 'confirmed', 'picked_up', 'returned', 'cancelled'].map(s => `<option value="${s}" ${s === st ? 'selected' : ''}>${esc(tt(STATUS[s][0], STATUS[s][1]))}</option>`).join('')}</select></div>
        <span class="small muted">${rows.length} ${tt('รายการ', 'rows')}</span></div>
        ${UI.table([
        { h: 'Booking ID', v: b => `<span class="mono">${b.id}</span>` }, { h: tt('ผู้เช่า', 'Renter'), v: b => esc(fullName(Store.user(b.customerId))) },
        { h: tt('ทะเบียนรถ', 'Plate'), v: b => `<span class="mono">${esc(b.plate)}</span>` }, { h: tt('รับรถ', 'Pick-up'), v: b => fmtDT(b.pickupAt) }, { h: tt('คืนรถ', 'Return'), v: b => fmtDT(b.returnAt) },
        { h: tt('ยอดชำระ', 'Amount'), cls: 'num', v: b => money(b.total) }, { h: tt('สถานะ', 'Status'), v: b => badge(b.status) },
        { h: '', cls: 'right nowrap', v: b => `<button class="btn btn-sm" data-v="${b.id}">${tt('ดู', 'View')}</button> ${b.status === 'confirmed' ? `<button class="btn btn-sm" data-e="${b.id}">${tt('แก้ไข', 'Edit')}</button>` : ''} ${['confirmed', 'pending_payment'].includes(b.status) ? `<button class="btn btn-sm btn-danger" data-x="${b.id}">${tt('ลบ', 'Delete')}</button>` : ''}` },
      ], rows.slice(0, 120))}</div>`;
    const go = () => App.go('bookings', { q: $('#q', el).value.trim(), status: $('#st', el).value });
    $('#q', el).onkeydown = e => { if (e.key === 'Enter') go(); }; $('#st', el).onchange = go;
    $$('[data-v]', el).forEach(b => b.onclick = () => this.detail(b.dataset.v));
    $$('[data-e]', el).forEach(b => b.onclick = () => CustomerViews.edit(b.dataset.e, { staff: true }));
    $$('[data-x]', el).forEach(b => b.onclick = () => CustomerViews.cancel(b.dataset.x, { staff: true }));
  },

  /* OE-06 / DFD 2.5 */
  handover(el) {
    const due = Store.db.rentals.filter(b => b.status === 'confirmed').sort((a, b) => a.pickupAt - b.pickupAt);
    el.innerHTML = UI.pageHead('ส่งมอบรถ', 'Car hand-over', 'บันทึกเลขไมล์ ระดับน้ำมัน และเวลาส่งมอบ', 'Record odometer, fuel and hand-over time', ['OE-06'], ['2.5'])
      + `<div class="grid g2"><div class="card"><h3 style="margin-bottom:12px">${tt('รอส่งมอบ', 'Awaiting hand-over')} (${due.length})</h3>
        ${UI.table([{ h: 'Booking ID', v: b => `<button class="link-btn mono" data-pick="${b.id}">${b.id}</button>` }, { h: tt('ผู้เช่า', 'Renter'), v: b => esc(fullName(Store.user(b.customerId))) }, { h: tt('รับรถ', 'Pick-up'), v: b => `${fmtDT(b.pickupAt)}${b.pickupAt < Date.now() ? ` <span class="badge b-danger">${tt('เลยเวลา', 'late')}</span>` : ''}` }, { h: tt('สัญญา', 'Contract'), v: b => b.contract && b.contract.signed ? `<span class="badge b-ok">${tt('เซ็นแล้ว', 'Signed')}</span>` : `<span class="badge b-warn">${tt('ยังไม่เซ็น', 'Unsigned')}</span>` }], due, 'ไม่มีรายการรอส่งมอบ', 'Nothing awaiting hand-over')}</div>
        <div class="card"><h3 style="margin-bottom:12px">${tt('บันทึกการส่งมอบ', 'Record hand-over')}</h3><form id="f" class="form" novalidate><div class="form-alert"></div>
          ${UI.field('id', 'Booking ID', 'Booking ID', `<input class="mono" placeholder="BK1xxx" value="${esc(App.params.id || '')}">`, { req: true })}
          <div id="info"></div>
          <div class="fields">${UI.field('mileage', 'เลขไมล์ (กม.)', 'Odometer (km)', '<input type="number" min="0">', { req: true })}${UI.field('fuel', 'ระดับน้ำมัน', 'Fuel level', fuelSelect(8), { req: true })}</div>
          ${UI.field('at', 'วันเวลาส่งมอบ', 'Hand-over time', `<input type="datetime-local" value="${toLocalInput(Date.now())}">`, { req: true })}
          <div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${tt('บันทึกการส่งมอบ', 'Save hand-over')}</button></div></form></div></div>`;
    const f = $('#f', el), idIn = $('[data-field=id] input', f);
    const info = () => {
      const b = Store.rental(idIn.value || ''); const box = $('#info', f);
      if (!b) { box.innerHTML = ''; return; }
      const car = Store.car(b.plate);
      box.innerHTML = `<div class="alert alert-info small">${esc(fullName(Store.user(b.customerId)))} · ${esc(carName(car))} <span class="mono">${esc(b.plate)}</span> · ${tt('เลขไมล์ล่าสุด', 'last odometer')} ${num(car.mileage)} km · ${badge(b.status)}</div>`;
      const m = $('[data-field=mileage] input', f); if (!m.value) m.value = car.mileage;
    };
    idIn.oninput = info; info();
    $$('[data-pick]', el).forEach(b => b.onclick = () => { idIn.value = b.dataset.pick; $('[data-field=mileage] input', f).value = ''; info(); });
    f.onsubmit = e => {
      e.preventDefault(); UI.clearErrors(f);
      try {
        UI.require(f, ['id', 'mileage', 'at']);
        const id = idIn.value.trim().toUpperCase();
        Logic.handover(id, { mileage: +$('[data-field=mileage] input', f).value, fuel: +$('[data-field=fuel] select', f).value, at: new Date($('[data-field=at] input', f).value).getTime(), by: App.user.id });
        UI.toast(tt(`ส่งมอบรถ ${id} เรียบร้อย`, `${id} handed over`), 'ok'); App.go('handover');
      } catch (err) { UI.showError(f, err); }
    };
  },

  /* OE-07 / DFD 2.6 */
  returns(el) {
    const out = Store.db.rentals.filter(b => b.status === 'picked_up').sort((a, b) => a.returnAt - b.returnAt);
    el.innerHTML = UI.pageHead('รับคืนรถ', 'Car return', 'บันทึกการคืนรถ ตรวจความเสียหาย คำนวณค่าปรับคืนช้า และคืนเงินมัดจำ', 'Record return, check damage, compute late fee and refund deposit', ['OE-07', 'C-19'], ['2.6'])
      + `<div class="grid g2"><div class="card"><h3 style="margin-bottom:12px">${tt('รถที่อยู่ระหว่างเช่า', 'Cars on rent')} (${out.length})</h3>
        ${UI.table([{ h: 'Booking ID', v: b => `<button class="link-btn mono" data-pick="${b.id}">${b.id}</button>` }, { h: tt('ทะเบียน', 'Plate'), v: b => `<span class="mono">${esc(b.plate)}</span>` }, { h: tt('กำหนดคืน', 'Due back'), v: b => `${fmtDT(b.returnAt)}${b.returnAt < Date.now() ? ` <span class="badge b-danger">${tt('เกินกำหนด', 'overdue')}</span>` : ''}` }], out, 'ไม่มีรถที่อยู่ระหว่างเช่า', 'No cars on rent')}</div>
        <div class="card"><h3 style="margin-bottom:12px">${tt('บันทึกการคืนรถ', 'Record return')}</h3><form id="f" class="form" novalidate><div class="form-alert"></div>
          ${UI.field('id', 'Booking ID', 'Booking ID', '<input class="mono" placeholder="BK1xxx">', { req: true })}
          <div id="info"></div>
          <div class="fields">${UI.field('mileage', 'เลขไมล์ (กม.)', 'Odometer (km)', '<input type="number" min="0">', { req: true })}${UI.field('fuel', 'ระดับน้ำมัน', 'Fuel level', fuelSelect(8), { req: true })}</div>
          ${UI.field('at', 'วันเวลาคืนรถ', 'Return time', `<input type="datetime-local" value="${toLocalInput(Date.now())}">`, { req: true })}
          <div class="field" data-field="damaged"><label class="lbl">${tt('สภาพรถ', 'Condition')}</label><div class="seg"><button type="button" class="on" data-c="0">${tt('ปกติ ไม่มีความเสียหาย', 'OK, no damage')}</button><button type="button" data-c="1">${tt('พบความเสียหาย', 'Damage found')}</button></div></div>
          <div class="hidden" id="dmg">${UI.field('note', 'รายละเอียดความเสียหาย', 'Damage details', '<textarea></textarea>', { req: true, hint: tt('ระบบจะสร้างงานซ่อมให้หัวหน้าช่าง และถือเงินมัดจำไว้', 'A repair job is created for the Mechanic Manager and the deposit is held') })}</div>
          <div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${tt('บันทึกการคืนรถ', 'Save return')}</button></div></form><div id="out" style="margin-top:12px"></div></div></div>`;
    const f = $('#f', el), idIn = $('[data-field=id] input', f); let damaged = false;
    $$('[data-c]', f).forEach(b => b.onclick = () => { damaged = b.dataset.c === '1'; $$('[data-c]', f).forEach(x => x.classList.toggle('on', x === b)); $('#dmg', f).classList.toggle('hidden', !damaged); });
    const info = () => {
      const b = Store.rental(idIn.value || ''); const box = $('#info', f);
      if (!b || !b.handover) { box.innerHTML = ''; return; }
      box.innerHTML = `<div class="alert alert-info small">${esc(fullName(Store.user(b.customerId)))} · <span class="mono">${esc(b.plate)}</span> · ${tt('รับรถ', 'picked up')} ${num(b.handover.mileage)} km, ${fuelText(b.handover.fuel)} · ${tt('กำหนดคืน', 'due')} ${fmtDT(b.returnAt)}</div>`;
    };
    idIn.oninput = info;
    $$('[data-pick]', el).forEach(b => b.onclick = () => { idIn.value = b.dataset.pick; info(); });
    f.onsubmit = e => {
      e.preventDefault(); UI.clearErrors(f);
      try {
        UI.require(f, ['id', 'mileage', 'at']);
        const id = idIn.value.trim().toUpperCase();
        const r = Logic.returnCar(id, { mileage: +$('[data-field=mileage] input', f).value, fuel: +$('[data-field=fuel] select', f).value, at: new Date($('[data-field=at] input', f).value).getTime(), by: App.user.id, damaged, note: damaged ? $('[data-field=note] textarea', f).value : '' });
        const b = Store.rental(id);
        UI.toast(tt(`รับคืนรถ ${id} เรียบร้อย`, `${id} returned`), 'ok');
        App.go('returns');
        $('#out').innerHTML = `<div class="alert ${r.damaged ? 'alert-warn' : 'alert-ok'}"><b>${tt('ผลการรับคืน', 'Return result')} ${id}</b><br>
          ${tt('สถานะรถ', 'Car status')}: ${badge(Store.car(b.plate).status)}<br>
          ${tt('ค่าปรับคืนช้า', 'Late fee')}: <b>${money(r.lateFee)}</b>${r.hoursLate > 0 ? ` (${tt('ช้า', 'late')} ${r.hoursLate.toFixed(1)} ${tt('ชม.', 'h')})` : ''}<br>
          ${r.damaged ? tt('พบความเสียหาย: ส่งงานซ่อมให้หัวหน้าช่างแล้ว ถือเงินมัดจำไว้จนกว่าจะประเมินค่าซ่อม', 'Damage: repair job sent to the Mechanic Manager; deposit held until assessed') : `${tt('คืนเงินมัดจำ', 'Deposit refunded')}: <b>${money(r.refund)}</b>`}</div>`;
      } catch (err) { UI.showError(f, err); }
    };
  },

  /* ===== Office Manager ===== */
  dash(el) {
    const today = d => sameDay(d, Date.now());
    const bookingsToday = Store.db.rentals.filter(b => today(b.createdAt) && b.status !== 'cancelled').length;
    const rented = Store.db.cars.filter(c => c.status === 'rented').length;
    const revToday = Logic.revenue(p => today(p.at));
    const days = [...Array(14)].map((_, i) => { const d = startOfDay(Date.now() - (13 - i) * DAY); return { label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, value: Logic.revenue(p => sameDay(p.at, d)) }; });
    const upcoming = Store.db.rentals.filter(b => ['confirmed', 'picked_up'].includes(b.status)).sort((a, b) => a.pickupAt - b.pickupAt).slice(0, 8);
    el.innerHTML = UI.pageHead('แดชบอร์ดประจำวัน', 'Daily dashboard', fmtD(Date.now()), fmtD(Date.now()), ['OM-03'], ['4'])
      + `<div class="grid g4" style="margin-bottom:16px">
        <div class="stat"><div class="label">${tt('จำนวนการจองวันนี้', 'Bookings today')}</div><div class="value">${bookingsToday}</div><div class="sub">${tt('การจองใหม่ที่ไม่ถูกยกเลิก', 'new, not cancelled')}</div></div>
        <div class="stat"><div class="label">${tt('จำนวนที่ถูกเช่า (ตอนนี้)', 'Cars on rent now')}</div><div class="value">${rented} / ${Store.db.cars.length}</div><div class="sub">${Math.round(rented / Store.db.cars.length * 100)}% ${tt('ของรถทั้งหมด', 'of fleet')}</div></div>
        <div class="stat"><div class="label">${tt('รายได้ประจำวัน', 'Revenue today')}</div><div class="value">${money(revToday)}</div><div class="sub">${tt('สุทธิหลังคืนเงิน ไม่รวมมัดจำ', 'net of refunds, excl. deposits')}</div></div>
        <div class="stat"><div class="label">${tt('การเช่าที่ยังเปิดอยู่', 'Open rentals')}</div><div class="value">${Store.db.rentals.filter(b => ['confirmed', 'picked_up'].includes(b.status)).length}</div><div class="sub">${tt('ยืนยันแล้ว + กำลังเช่า', 'confirmed + on rent')}</div></div></div>
      <div class="grid g2"><div class="card"><h3 style="margin-bottom:8px">${tt('รายได้ 14 วันล่าสุด', 'Revenue, last 14 days')}</h3>${UI.bars(days)}</div>
      <div class="card"><h3 style="margin-bottom:12px">${tt('รับ-คืนรถที่กำลังจะถึง', 'Upcoming pick-ups / returns')}</h3>${UI.table([{ h: 'Booking ID', v: b => `<span class="mono">${b.id}</span>` }, { h: tt('ทะเบียน', 'Plate'), v: b => `<span class="mono">${esc(b.plate)}</span>` }, { h: tt('เวลา', 'Time'), v: b => fmtDT(b.status === 'picked_up' ? b.returnAt : b.pickupAt) }, { h: tt('สถานะ', 'Status'), v: b => badge(b.status) }], upcoming)}</div></div>`;
  },

  data(el) {
    const tab = App.params.tab || 'rentals';
    const tabs = [['rentals', 'ข้อมูลการเช่า', 'Rentals'], ['cars', 'ข้อมูลรถ', 'Cars'], ['customers', 'ข้อมูลลูกค้า', 'Customers'], ['payments', 'การชำระเงิน', 'Payments'], ['staff', 'ข้อมูลพนักงาน', 'Employees']];
    let body = '';
    if (tab === 'rentals') body = UI.table([{ h: 'Booking ID', v: b => `<button class="link-btn mono" data-v="${b.id}">${b.id}</button>` }, { h: tt('ผู้เช่า', 'Renter'), v: b => esc(fullName(Store.user(b.customerId))) }, { h: tt('ทะเบียน', 'Plate'), v: b => `<span class="mono">${esc(b.plate)}</span>` }, { h: tt('สาขา', 'Branch'), v: b => esc(branchName(b.branch)) }, { h: tt('รับรถ', 'Pick-up'), v: b => fmtDT(b.pickupAt) }, { h: tt('ยอด', 'Amount'), cls: 'num', v: b => money(b.total) }, { h: tt('สถานะ', 'Status'), v: b => badge(b.status) }], [...Store.db.rentals].sort((a, b) => b.pickupAt - a.pickupAt).slice(0, 100));
    if (tab === 'cars') body = UI.table([{ h: tt('ทะเบียนรถ', 'Plate'), v: c => `<span class="mono">${esc(c.plate)}</span>` }, { h: tt('ยี่ห้อรถ', 'Car'), v: c => esc(carName(c)) }, { h: tt('ประเภท', 'Type'), v: c => esc(typeName(c.type)) }, { h: tt('ปี', 'Year'), v: c => c.year }, { h: tt('สาขา', 'Branch'), v: c => esc(branchName(c.branch)) }, { h: tt('เลขไมล์', 'Odometer'), cls: 'num', v: c => num(c.mileage) }, { h: tt('สถานะรถ', 'Status'), v: c => badge(Logic.carStatus(c)) }], Store.db.cars);
    if (tab === 'customers') body = UI.table([{ h: tt('รหัสลูกค้า', 'Customer ID'), v: u => `<span class="mono">${u.id}</span>` }, { h: tt('ชื่อ-นามสกุล', 'Name'), v: u => esc(fullName(u)) + (u.walkIn ? ' <span class="badge">walk-in</span>' : '') }, { h: tt('เบอร์โทร', 'Phone'), v: u => esc(u.phone) }, { h: tt('อีเมล', 'Email'), v: u => esc(u.email || '-') }, { h: tt('เลขบัตรประชาชน', 'National ID'), v: u => `<span class="mono">${esc((u.nationalId || '').replace(/^(\d{1})\d{8}(\d{4})$/, '$1-XXXX-XXXX-$2'))}</span>` }, { h: tt('จำนวนการเช่า', 'Rentals'), cls: 'num', v: u => Store.db.rentals.filter(b => b.customerId === u.id).length }], Store.db.users.filter(u => u.role === 'customer'));
    if (tab === 'payments') body = UI.table([{ h: tt('เลขที่ธุรกรรม', 'Txn'), v: p => `<span class="mono small">${p.txn}</span>` }, { h: 'Booking ID', v: p => `<span class="mono">${p.bookingId}</span>` }, { h: tt('รายการ', 'Kind'), v: p => esc(payKind(p.kind)) }, { h: tt('ช่องทาง', 'Method'), v: p => esc(methodName(p.method)) }, { h: tt('วันที่', 'Date'), v: p => fmtDT(p.at) }, { h: tt('จำนวนเงิน', 'Amount'), cls: 'num', v: p => money(p.amount) }], [...Store.db.payments].sort((a, b) => b.at - a.at).slice(0, 100));
    if (tab === 'staff') body = UI.table([{ h: tt('รหัสพนักงาน', 'Emp. ID'), v: u => `<span class="mono">${esc(u.empId)}</span>` }, { h: tt('ชื่อ-นามสกุล', 'Name'), v: u => esc(fullName(u)) }, { h: tt('ตำแหน่ง', 'Position'), v: u => esc(roleName(u.role)) }, { h: tt('สถานะ', 'Status'), v: u => badge(u.status) }], Store.db.users.filter(u => u.role !== 'customer'));
    el.innerHTML = UI.pageHead('ข้อมูลในระบบ', 'System data', 'ดูข้อมูลการเช่าและข้อมูลพนักงาน (อ่านอย่างเดียว)', 'Rental and employee data (read only)', ['OM-02'], ['4'])
      + `<div class="card"><div class="tabs">${tabs.map(([k, th, en]) => `<button class="tab ${tab === k ? 'on' : ''}" data-t="${k}">${tt(th, en)}</button>`).join('')}</div>${body}<div class="small muted" style="margin-top:8px">${tt('แสดงสูงสุด 100 แถวล่าสุด', 'Showing up to the latest 100 rows')}</div></div>`;
    $$('[data-t]', el).forEach(b => b.onclick = () => App.go('data', { tab: b.dataset.t }));
    $$('[data-v]', el).forEach(b => b.onclick = () => this.detail(b.dataset.v));
  },

  employees(el) {
    const staff = Store.db.users.filter(u => u.role !== 'customer');
    el.innerHTML = UI.pageHead('จัดการข้อมูลพนักงาน', 'Manage employees', 'เพิ่ม แก้ไข และระงับบัญชีพนักงาน', 'Add, edit and deactivate staff accounts', ['OM-04'], ['4'], `<button class="btn btn-primary" id="add">+ ${tt('เพิ่มพนักงาน', 'Add employee')}</button>`)
      + `<div class="card">${UI.table([{ h: tt('รหัสพนักงาน', 'Emp. ID'), v: u => `<span class="mono">${esc(u.empId)}</span>` }, { h: tt('ชื่อ-นามสกุล', 'Name'), v: u => esc(fullName(u)) }, { h: tt('ตำแหน่ง', 'Position'), v: u => esc(roleName(u.role)) }, { h: 'Username', v: u => `<span class="mono">${esc(u.username)}</span>` }, { h: tt('สถานะ', 'Status'), v: u => badge(u.status) }, { h: '', cls: 'right', v: u => u.id === App.user.id ? `<span class="small muted">${tt('คุณ', 'you')}</span>` : `<button class="btn btn-sm" data-e="${u.id}">${tt('แก้ไข', 'Edit')}</button>` }], staff)}</div>`;
    $('#add', el).onclick = () => this.empForm(null);
    $$('[data-e]', el).forEach(b => b.onclick = () => this.empForm(b.dataset.e));
  },
  empForm(id) {
    const u = id ? Store.user(id) : null;
    const m = UI.modal(`<div class="modal-head"><h3>${u ? tt('แก้ไขข้อมูลพนักงาน', 'Edit employee') : tt('เพิ่มพนักงาน', 'Add employee')}</h3><button class="x-btn" data-close>×</button></div>
      <div class="modal-body"><form id="f" class="form" novalidate><div class="form-alert"></div><div class="fields">
        ${UI.field('empId', 'รหัสพนักงาน', 'Employee ID', `<input class="mono" value="${esc(u ? u.empId : '')}" placeholder="EMP-xxx">`, { req: true })}
        ${UI.field('role', 'ตำแหน่ง', 'Position', `<select>${Object.keys(ROLES).filter(r => r !== 'customer').map(r => `<option value="${r}" ${u && u.role === r ? 'selected' : ''}>${esc(roleName(r))}</option>`).join('')}</select>`, { req: true })}
        ${UI.field('first', 'ชื่อ', 'First name', `<input value="${esc(u ? u.firstName : '')}">`, { req: true })}${UI.field('last', 'นามสกุล', 'Last name', `<input value="${esc(u ? u.lastName : '')}">`, { req: true })}
        ${UI.field('username', 'Username', 'Username', `<input class="mono" value="${esc(u ? u.username : '')}" ${u ? 'disabled' : ''}>`, { req: true })}
        ${UI.field('password', u ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน', u ? 'New password (blank = keep)' : 'Password', '<input type="password" autocomplete="new-password">', { req: !u, hint: tt('อย่างน้อย 8 ตัวอักษร', 'At least 8 characters') })}
        ${UI.field('status', 'สถานะ', 'Status', `<select><option value="active" ${!u || u.status === 'active' ? 'selected' : ''}>${tt('ใช้งาน', 'Active')}</option><option value="inactive" ${u && u.status === 'inactive' ? 'selected' : ''}>${tt('ระงับ (เข้าสู่ระบบไม่ได้)', 'Inactive (cannot sign in)')}</option></select>`)}
      </div></form></div>
      <div class="modal-foot"><button class="btn" data-close>${tt('ยกเลิก', 'Cancel')}</button><button class="btn btn-primary" data-save>${tt('บันทึก', 'Save')}</button></div>`);
    $('[data-save]', m.el).onclick = () => {
      const f = $('#f', m.el); UI.clearErrors(f);
      const v = n => $(`[data-field=${n}] input, [data-field=${n}] select`, f).value.trim();
      try {
        UI.require(f, u ? ['empId', 'first', 'last'] : ['empId', 'first', 'last', 'username', 'password']);
        if (Store.db.users.some(x => x.empId === v('empId') && x !== u)) throw new AppError(tt('รหัสพนักงานนี้มีอยู่แล้ว', 'Employee ID already exists'), 'empId');
        if (!u && Store.db.users.some(x => x.username === v('username'))) throw new AppError(tt('Username นี้ถูกใช้แล้ว', 'Username already taken'), 'username');
        if (v('password') && v('password').length < 8) throw new AppError(tt('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 'Password must be at least 8 characters'), 'password');
        const data = { empId: v('empId'), role: v('role'), firstName: v('first'), lastName: v('last'), status: v('status'), position: roleName(v('role')) };
        if (u) { Object.assign(u, data); if (v('password')) u.password = v('password'); }
        else Store.db.users.push(Object.assign({ id: Store.next('user', 'U'), username: v('username'), password: v('password'), email: v('username') + '@carrental.example', phone: '', createdAt: Date.now() }, data));
        Store.save(); m.close(true); UI.toast(tt('บันทึกข้อมูลพนักงานแล้ว', 'Employee saved'), 'ok'); App.render();
      } catch (err) { UI.showError(f, err); }
    };
  },

  rates(el) {
    el.innerHTML = UI.pageHead('อัตราค่าเช่า', 'Rental rates', 'กำหนดอัตรารายวัน รายสัปดาห์ รายเดือน และเงินมัดจำต่อประเภทรถ', 'Set daily, weekly, monthly rates and deposit per car type', ['OM-05', 'OM-06'], ['3.2'])
      + `<div class="card"><form id="f" novalidate><div class="form-alert"></div><div class="table-wrap"><table><thead><tr><th>${tt('ประเภทรถ', 'Car type')}</th><th class="num">${tt('รายวัน', 'Daily')}</th><th class="num">${tt('รายสัปดาห์', 'Weekly')}</th><th class="num">${tt('รายเดือน', 'Monthly')}</th><th class="num">${tt('มัดจำ', 'Deposit')}</th><th class="num">${tt('จำนวนรถ', 'Cars')}</th></tr></thead><tbody>
        ${Store.db.rates.map(r => `<tr data-type="${r.type}"><td><b>${esc(typeName(r.type))}</b></td>${['daily', 'weekly', 'monthly', 'deposit'].map(k => `<td class="num"><div class="field" data-field="${r.type}-${k}"><input type="number" min="1" step="50" value="${r[k]}" data-k="${k}" style="text-align:right;max-width:130px;margin-left:auto"><span class="err"></span></div></td>`).join('')}<td class="num">${Store.db.cars.filter(c => c.type === r.type).length}</td></tr>`).join('')}
        </tbody></table></div><div class="row" style="justify-content:space-between;margin-top:14px"><span class="small muted">${tt('การจองที่ยืนยันแล้วยังใช้ราคาเดิม อัตราใหม่ใช้กับการจองใหม่เท่านั้น', 'Confirmed bookings keep their price; new rates apply to new bookings only')}</span><button class="btn btn-primary">${tt('บันทึกอัตราค่าเช่า', 'Save rates')}</button></div></form></div>`;
    const f = $('#f', el);
    f.onsubmit = e => {
      e.preventDefault(); UI.clearErrors(f);
      try {
        const next = Store.db.rates.map(r => { const row = $(`tr[data-type=${r.type}]`, f); const o = { type: r.type }; $$('input', row).forEach(i => o[i.dataset.k] = Number(i.value)); return o; });
        for (const r of next) {
          for (const k of ['daily', 'weekly', 'monthly', 'deposit']) if (!(r[k] > 0) || !Number.isInteger(r[k])) throw new AppError(tt('ต้องเป็นจำนวนเต็มบวก', 'Must be a positive whole number'), `${r.type}-${k}`);
          if (r.weekly > r.daily * 7) throw new AppError(tt('รายสัปดาห์ต้องไม่แพงกว่ารายวัน × 7', 'Weekly cannot exceed daily × 7'), `${r.type}-weekly`);
          if (r.monthly > r.weekly * 30 / 7) throw new AppError(tt('รายเดือนต้องไม่แพงกว่ารายสัปดาห์คิดเป็น 30 วัน', 'Monthly cannot exceed the weekly rate over 30 days'), `${r.type}-monthly`);
        }
        Store.db.rates = next; Store.save(); UI.toast(tt('บันทึกอัตราค่าเช่าแล้ว', 'Rates saved'), 'ok'); App.render();
      } catch (err) { UI.showError(f, err); }
    };
  },
};

Roles.office_employee = {
  nav: [['avail', 'ตรวจสอบรถว่าง', 'Availability', 'search'], ['create', 'สร้างรายการเช่า', 'New rental', 'plus'], ['bookings', 'รายการเช่าทั้งหมด', 'All rentals', 'list'], ['handover', 'ส่งมอบรถ', 'Hand-over', 'key'], ['returns', 'รับคืนรถ', 'Returns', 'return']],
  badge: { handover: () => Store.db.rentals.filter(b => b.status === 'confirmed' && b.pickupAt - Date.now() < DAY).length, returns: () => Store.db.rentals.filter(b => b.status === 'picked_up' && b.returnAt < Date.now()).length },
  views: { avail: el => StaffViews.avail(el), create: el => StaffViews.create(el), bookings: el => StaffViews.bookings(el), handover: el => StaffViews.handover(el), returns: el => StaffViews.returns(el) },
};
Roles.office_manager = {
  nav: [['dash', 'แดชบอร์ด', 'Dashboard', 'chart'], ['data', 'ข้อมูลในระบบ', 'System data', 'db'], ['employees', 'พนักงาน', 'Employees', 'users'], ['rates', 'อัตราค่าเช่า', 'Rates', 'tag']],
  views: { dash: el => StaffViews.dash(el), data: el => StaffViews.data(el), employees: el => StaffViews.employees(el), rates: el => StaffViews.rates(el) },
};
