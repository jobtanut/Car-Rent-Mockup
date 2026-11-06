/* ===== ผู้เช่ารถ (Customer) — DFD processes 1 and 2 ===== */
const CustomerViews = {
  wiz: null,
  resetWiz() {
    const s = new Date(Date.now() + DAY); s.setHours(10, 0, 0, 0);
    const e = new Date(s.getTime() + 2 * DAY);
    this.wiz = { step: 1, start: s.getTime(), end: e.getTime(), branch: 'SVB', type: '', plate: null, bookingId: null };
  },

  /* ---------- rent a car: 1.2 search → 1.3 book → 1.4 pay ---------- */
  rent(el) {
    if (!this.wiz) this.resetWiz();
    const w = this.wiz;
    const steps = [['เลือกวันเวลาและสถานที่', 'Date, time & place'], ['เลือกรถ', 'Choose a car'], ['ตรวจสอบและยืนยัน', 'Review & confirm'], ['เสร็จสิ้น', 'Done']];
    const stepBar = `<div class="steps">${steps.map((s, i) => `<div class="step ${i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : ''}"><span class="n">${i + 1 < w.step ? '✓' : i + 1}</span>${esc(tt(...s))}</div>`).join('')}</div>`;
    const frsByStep = { 1: ['C-03'], 2: ['C-04', 'C-05'], 3: ['C-06', 'C-07', 'C-10'], 4: ['C-07', 'C-09', 'C-18'] };
    const dfdByStep = { 1: ['1.2'], 2: ['1.2', '1.3'], 3: ['1.3', '1.4'], 4: ['1.4'] };
    let html = UI.pageHead('เช่ารถ', 'Rent a car', 'ค้นหารถว่าง เลือกรถ ยืนยัน และชำระเงิน', 'Search, choose, confirm and pay', frsByStep[w.step], dfdByStep[w.step]) + stepBar;
    if (w.step === 1) {
      html += `<div class="card"><form class="form" id="f" novalidate><div class="form-alert"></div>
        <div class="fields">
          ${UI.field('start', 'วันเวลารับรถ', 'Pick-up date & time', `<input type="datetime-local" value="${toLocalInput(w.start)}">`, { req: true })}
          ${UI.field('end', 'วันเวลาคืนรถ', 'Return date & time', `<input type="datetime-local" value="${toLocalInput(w.end)}">`, { req: true })}
          ${UI.field('branch', 'สถานที่รับ-คืนรถ (สาขา)', 'Pick-up / return location (branch)', `<select><option value="">${tt('— เลือกสาขา —', '— Select branch —')}</option>${BRANCHES.map(b => `<option value="${b.id}" ${b.id === w.branch ? 'selected' : ''}>${esc(tt(b.th, b.en))}</option>`).join('')}</select>`, { req: true })}
          ${UI.field('type', 'ประเภทรถ', 'Car type', `<select><option value="">${tt('ทุกประเภท', 'All types')}</option>${TYPES.map(t => `<option value="${t.id}" ${t.id === w.type ? 'selected' : ''}>${esc(tt(t.th, t.en))}</option>`).join('')}</select>`)}
        </div>
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${tt('ค้นหารถว่าง', 'Search available cars')} →</button></div></form></div>`;
      el.innerHTML = html;
      const f = $('#f', el);
      f.onsubmit = e => {
        e.preventDefault(); UI.clearErrors(f);
        try {
          UI.require(f, ['start', 'end', 'branch']);
          const start = new Date($('[data-field=start] input', f).value).getTime(), end = new Date($('[data-field=end] input', f).value).getTime();
          Logic.validatePeriod(start, end);
          Object.assign(w, { start, end, branch: $('[data-field=branch] select', f).value, type: $('[data-field=type] select', f).value, step: 2, plate: null });
          App.render();
        } catch (err) { UI.showError(f, err); }
      };
      return;
    }

    if (w.step === 2) {
      const results = Logic.search({ start: w.start, end: w.end, branch: w.branch, type: w.type });
      html += `<div class="card"><div class="card-head"><div><h3>${tt('รถว่าง', 'Available cars')} · ${esc(branchName(w.branch))}</h3><div class="small muted">${fmtDT(w.start)} → ${fmtDT(w.end)}</div></div><button class="btn btn-sm" data-back>← ${tt('แก้ไขการค้นหา', 'Edit search')}</button></div>
        ${results.length ? `<div class="cars">${results.map(({ car, price }) => `<div class="car ${w.plate === car.plate ? 'selected' : ''}">${UI.carArt(car)}<div class="car-body">
          <div class="row" style="justify-content:space-between"><b>${esc(carName(car))}</b><span class="badge">${esc(typeName(car.type))}</span></div>
          <div class="specs"><span>${car.year}</span><span>${TYPES.find(t => t.id === car.type).seats} ${tt('ที่นั่ง', 'seats')}</span><span class="mono">${esc(car.plate)}</span></div>
          <div class="small muted">${money(Store.rate(car.type).daily)} / ${tt('วัน', 'day')}</div>
          <div class="price">${money(price.total)} <span class="small muted" style="font-weight:400">/ ${price.days} ${tt('วัน', 'days')}</span></div>
          <button class="btn btn-primary btn-sm" data-pick="${esc(car.plate)}" style="margin-top:auto">${tt('เลือกคันนี้', 'Choose this car')}</button></div></div>`).join('')}</div>`
        : `<div class="alert alert-warn">${tt('ไม่มีรถว่างตามเงื่อนไขนี้ ลองเปลี่ยนวันเวลา สาขา หรือประเภทรถ', 'No cars match. Try a different date, branch or type.')}</div>`}</div>`;
      el.innerHTML = html;
      $('[data-back]', el).onclick = () => { w.step = 1; App.render(); };
      $$('[data-pick]', el).forEach(b => b.onclick = () => { w.plate = b.dataset.pick; w.step = 3; App.render(); });
      return;
    }

    if (w.step === 3) {
      const car = Store.car(w.plate), p = Logic.price(car.type, w.start, w.end), u = App.user;
      html += `<div class="grid g2"><div class="card"><h3 style="margin-bottom:12px">${tt('ข้อมูลการเช่ารถ', 'Rental details')}</h3>${UI.carArt(car)}
        <dl class="kv" style="margin-top:12px">
          <dt>${tt('ผู้เช่า', 'Renter')}</dt><dd>${esc(fullName(u))}</dd>
          <dt>${tt('รถ', 'Car')}</dt><dd>${esc(carName(car))} · ${esc(typeName(car.type))}</dd>
          <dt>${tt('ทะเบียนรถ', 'Plate')}</dt><dd class="mono">${esc(car.plate)}</dd>
          <dt>${tt('วันเวลารับรถ', 'Pick-up')}</dt><dd>${fmtDT(w.start)}</dd>
          <dt>${tt('วันเวลาคืนรถ', 'Return')}</dt><dd>${fmtDT(w.end)}</dd>
          <dt>${tt('สาขา', 'Branch')}</dt><dd>${esc(branchName(car.branch))}<div class="small muted">${esc(branchAddr(car.branch))}</div></dd>
        </dl></div>
        <div class="card"><h3 style="margin-bottom:12px">${tt('ค่าใช้จ่าย', 'Cost')}</h3>
          ${p.parts.map(x => `<div class="sum-line"><span>${esc(x[0])}</span><span class="mono">${money(x[1])}</span></div>`).join('')}
          <div class="sum-line"><span><b>${tt('ค่าเช่ารวม', 'Rental total')}</b> (${p.days} ${tt('วัน', 'days')})</span><span class="mono"><b>${money(p.total)}</b></span></div>
          <div class="sum-line"><span>${tt('ค่ามัดจำ (ได้คืนเมื่อคืนรถไม่มีความเสียหาย)', 'Deposit (refunded if returned undamaged)')}</span><span class="mono">${money(p.deposit)}</span></div>
          <div class="sum-line total"><span>${tt('ยอดชำระวันนี้', 'Due today')}</span><span>${money(p.total + p.deposit)}</span></div>
          <form id="f" class="form" style="margin-top:14px" novalidate><div class="form-alert"></div>
            ${!u.nationalId || !u.license ? `<div class="alert alert-info small">${tt('บัญชีของคุณยังไม่มีข้อมูลผู้เช่า กรุณากรอกเพื่อใช้ในสัญญาเช่า', 'Your account has no renter details yet. Please add them for the rental contract.')}</div>
            <div class="fields">${UI.field('nid', 'เลขบัตรประชาชน', 'National ID', `<input inputmode="numeric" maxlength="13" value="${esc(u.nationalId || '')}">`, { req: true })}${UI.field('license', 'เลขใบขับขี่', 'Driving licence no.', `<input value="${esc(u.license || '')}">`, { req: true })}</div>` : ''}
            <div class="field" data-field="agree"><label class="check"><input type="checkbox"> <span>${tt(`ข้าพเจ้าตรวจสอบข้อมูลแล้ว และรับทราบเงื่อนไข: ยกเลิกฟรีก่อนรับรถ ${POLICY.cancelHours} ชม. · คืนช้าเกิน ${POLICY.lateGraceHours} ชม. มีค่าปรับ · ต้องชำระภายใน ${POLICY.holdMinutes} นาที`, `I have checked the details and accept the terms: free cancellation up to ${POLICY.cancelHours}h before pick-up · late return over ${POLICY.lateGraceHours}h is charged · payment within ${POLICY.holdMinutes} minutes`)}</span></label><span class="err"></span></div>
            <div class="row" style="justify-content:space-between"><button type="button" class="btn" data-back>← ${tt('ย้อนกลับ', 'Back')}</button><button class="btn btn-primary">${tt('ยืนยันและชำระเงิน', 'Confirm & pay')}</button></div>
          </form></div></div>`;
      el.innerHTML = html;
      $('[data-back]', el).onclick = () => { w.step = 2; App.render(); };
      const f = $('#f', el);
      f.onsubmit = e => {
        e.preventDefault(); UI.clearErrors(f);
        try {
          if ($('[data-field=nid]', f)) {   // staff renting for themselves: collect renter details once
            UI.require(f, ['nid', 'license']);
            const nid = $('[data-field=nid] input', f).value.trim();
            if (!validThaiId(nid)) throw new AppError(tt('เลขบัตรประชาชนไม่ถูกต้อง (ต้องเป็น 13 หลักและผ่าน checksum)', 'Invalid national ID (13 digits with valid checksum)'), 'nid');
            u.nationalId = nid; u.license = $('[data-field=license] input', f).value.trim(); Store.save();
          }
          if (!$('[data-field=agree] input', f).checked) throw new AppError(tt('กรุณายืนยันว่าตรวจสอบข้อมูลแล้ว', 'Please confirm you have checked the details'), 'agree');
          const b = Logic.createBooking({ customerId: u.id, plate: w.plate, start: w.start, end: w.end });
          w.bookingId = b.id;
          CustomerViews.pay(b, () => { w.step = 4; App.render(); });
        } catch (err) { UI.showError(f, err); }
      };
      return;
    }

    if (w.step === 4) {
      const b = Store.rental(w.bookingId);
      html += `<div class="card center" style="padding:32px">
        <div style="font-size:44px;color:var(--ok)">✓</div><h2>${tt('จองสำเร็จ', 'Booking confirmed')}</h2>
        <p class="muted">Booking ID <b class="mono">${esc(b.id)}</b> · ${tt('เลขที่ธุรกรรม', 'Transaction')} <span class="mono">${esc(b.txn || '-')}</span></p>
        <div class="alert alert-info" style="max-width:520px;margin:12px auto;text-align:left">${tt(`ระบบส่งสัญญาเช่ารถ ${b.contract.no} ไปที่กล่องข้อความของคุณแล้ว กรุณาเซ็นสัญญาก่อนวันรับรถ มิฉะนั้นพนักงานจะส่งมอบรถไม่ได้`, `Rental contract ${b.contract.no} has been sent to your inbox. Please sign it before pick-up, or staff cannot hand over the car.`)}</div>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn btn-primary" data-sign>${tt('เซ็นสัญญาตอนนี้', 'Sign contract now')}</button><button class="btn" data-detail>${tt('ดูรายละเอียดการเช่า', 'View rental')}</button><button class="btn btn-ghost" data-new>${tt('จองคันใหม่', 'New booking')}</button></div></div>`;
      el.innerHTML = html;
      $('[data-sign]', el).onclick = () => CustomerViews.contract(b.id);
      $('[data-detail]', el).onclick = () => { CustomerViews.resetWiz(); App.go('rentals'); CustomerViews.detail(b.id); };
      $('[data-new]', el).onclick = () => { CustomerViews.resetWiz(); App.render(); };
    }
  },

  pay(b, after) {
    PaymentService.open({
      bookingId: b.id, amount: b.total + b.deposit, holdUntil: b.holdUntil,
      lines: [[tt('ค่าเช่า', 'Rent'), b.total], [tt('ค่ามัดจำ', 'Deposit'), b.deposit]],
      onSuccess: res => Logic.confirmPayment(b.id, res),
      after: () => { UI.toast(tt('ชำระเงินสำเร็จ ระบบส่งสัญญาเช่าให้ทางอีเมลแล้ว', 'Payment successful — contract emailed'), 'ok'); after && after(); },
      onTimeout: () => { Logic.expirePending(b.id); UI.toast(tt('หมดเวลาการชำระ ระบบยกเลิกการจองแล้ว', 'Payment timed out — booking cancelled'), 'err'); if (CustomerViews.wiz) CustomerViews.resetWiz(); App.render(); },
      onCancel: () => { UI.toast(tt(`ยังไม่ได้ชำระเงิน — การจอง ${b.id} รอชำระใน "การเช่าของฉัน"`, `Not paid yet — booking ${b.id} is waiting in "My rentals"`), 'warn'); if (CustomerViews.wiz) CustomerViews.resetWiz(); App.go('rentals'); },
    });
  },

  /* ---------- my rentals: 2.1 view, 2.2 edit, 2.3 cancel ---------- */
  rentals(el) {
    Logic.housekeeping();
    const list = Store.db.rentals.filter(b => b.customerId === App.user.id).sort((a, b) => b.pickupAt - a.pickupAt);
    const filter = App.params.filter || 'current';
    const shown = list.filter(b => filter === 'all' || (filter === 'current' ? ACTIVE.includes(b.status) : !ACTIVE.includes(b.status)));
    el.innerHTML = UI.pageHead('การเช่าของฉัน', 'My rentals', 'ตรวจสอบ แก้ไข ยกเลิก เซ็นสัญญา และดูใบแจ้งหนี้', 'View, edit, cancel, sign and see invoices', ['C-08', 'C-11', 'C-12', 'C-13', 'C-15', 'C-16', 'C-18'], ['2.1', '2.2', '2.3'])
      + `<div class="card"><div class="card-head"><div class="seg">${[['current', 'ปัจจุบัน', 'Current'], ['past', 'ที่ผ่านมา', 'Past'], ['all', 'ทั้งหมด', 'All']].map(([k, th, en]) => `<button class="${filter === k ? 'on' : ''}" data-f="${k}">${tt(th, en)}</button>`).join('')}</div>
        <div class="row"><input id="q" placeholder="${tt('ค้นหา Booking ID', 'Search Booking ID')}" style="width:200px"><button class="btn btn-sm" id="qb">${tt('ตรวจสอบ', 'Check')}</button></div></div>
        ${UI.table([
          { h: 'Booking ID', v: b => `<span class="mono">${b.id}</span>` },
          { h: tt('รถ', 'Car'), v: b => `${esc(carName(Store.car(b.plate)))}<div class="small muted mono">${esc(b.plate)}</div>` },
          { h: tt('รับรถ', 'Pick-up'), v: b => `${fmtDT(b.pickupAt)}<div class="small muted">${esc(branchName(b.branch))}</div>` },
          { h: tt('คืนรถ', 'Return'), v: b => fmtDT(b.returnAt) },
          { h: tt('ยอดชำระ', 'Amount'), cls: 'num', v: b => money(b.total) },
          { h: tt('สถานะการเช่า', 'Status'), v: b => badge(b.status) + (b.status === 'confirmed' && b.contract && !b.contract.signed ? `<div style="margin-top:4px"><button class="btn btn-sm" data-sign="${b.id}" title="${tt('คลิกเพื่ออ่านและเซ็นสัญญา', 'Click to read and sign the contract')}" style="color:var(--warn);border-color:#f9dbaf;background:var(--warn-soft)">✍ ${tt('ยังไม่เซ็นสัญญา · เซ็นเลย', 'Contract unsigned · Sign now')}</button></div>` : '') },
          { h: '', cls: 'right', v: b => `<button class="btn btn-sm" data-d="${b.id}">${tt('รายละเอียด', 'Details')}</button>` },
        ], shown, 'ยังไม่มีการเช่าในหมวดนี้', 'No rentals here yet')}</div>`;
      $$('[data-f]', el).forEach(b => b.onclick = () => App.go('rentals', { filter: b.dataset.f }));
      $$('[data-d]', el).forEach(b => b.onclick = () => this.detail(b.dataset.d));
      $$('[data-sign]', el).forEach(b => b.onclick = () => this.contract(b.dataset.sign));
      const look = () => { const id = $('#q', el).value.trim().toUpperCase(); const b = Store.rental(id); if (!b || b.customerId !== App.user.id) UI.toast(tt('ไม่พบ Booking ID นี้ในบัญชีของคุณ', 'Booking ID not found in your account'), 'err'); else this.detail(b.id); };
      $('#qb', el).onclick = look; $('#q', el).onkeydown = e => { if (e.key === 'Enter') look(); };
  },

  detail(id) {
    const b = Store.rental(id), car = Store.car(b.plate);
    const job = b.repairJob ? Store.job(b.repairJob) : Store.db.jobs.find(j => j.bookingId === b.id);
    const canEdit = b.status === 'confirmed', canCancel = ['confirmed', 'pending_payment'].includes(b.status);
    const m = UI.modal(`<div class="modal-head"><div><h3>${tt('รายละเอียดการเช่า', 'Rental details')} <span class="mono">${b.id}</span></h3><div class="row" style="margin-top:4px">${badge(b.status)}${b.contract ? (b.contract.signed ? `<span class="badge b-ok">${tt('เซ็นสัญญาแล้ว', 'Contract signed')}</span>` : `<span class="badge b-warn">${tt('ยังไม่เซ็นสัญญา', 'Contract unsigned')}</span>`) : ''}</div></div><button class="x-btn" data-close>×</button></div>
      <div class="modal-body"><div class="grid g2">
        <dl class="kv">
          <dt>${tt('รถ', 'Car')}</dt><dd>${esc(carName(car))}<div class="small muted">${esc(typeName(car.type))} · <span class="mono">${esc(car.plate)}</span></div></dd>
          <dt>${tt('วันเวลารับรถ', 'Pick-up time')}</dt><dd>${fmtDT(b.pickupAt)}</dd>
          <dt>${tt('สถานที่รับรถ', 'Pick-up place')}</dt><dd>${esc(branchName(b.branch))}<div class="small muted">${esc(branchAddr(b.branch))}</div></dd>
          <dt>${tt('วันเวลาคืนรถ', 'Return time')}</dt><dd>${fmtDT(b.returnAt)}</dd>
          ${b.handover ? `<dt>${tt('รับรถจริง', 'Picked up')}</dt><dd>${fmtDT(b.handover.at)} · ${num(b.handover.mileage)} ${tt('กม.', 'km')}</dd>` : ''}
          ${b.returned ? `<dt>${tt('คืนรถจริง', 'Returned')}</dt><dd>${fmtDT(b.returned.at)} · ${num(b.returned.mileage)} ${tt('กม.', 'km')}</dd>` : ''}
          ${b.cancelReason ? `<dt>${tt('เหตุผลยกเลิก', 'Cancel reason')}</dt><dd>${esc(b.cancelReason)}</dd>` : ''}
        </dl>
        <div>
          <div class="sum-line"><span>${tt('ค่าเช่า', 'Rent')} (${b.days} ${tt('วัน', 'days')})</span><span class="mono">${money(b.total)}</span></div>
          <div class="sum-line"><span>${tt('ค่ามัดจำ', 'Deposit')}</span><span class="mono">${money(b.deposit)} ${badge(b.depositStatus)}</span></div>
          ${b.lateFee ? `<div class="sum-line"><span>${tt('ค่าปรับคืนช้า', 'Late fee')}</span><span class="mono">${money(b.lateFee)}</span></div>` : ''}
          ${b.damageCharge ? `<div class="sum-line"><span>${tt('ค่าซ่อมความเสียหาย', 'Damage charge')}</span><span class="mono">${money(b.damageCharge)}</span></div>` : ''}
          ${b.depositStatus === 'refunded' || b.depositStatus === 'settled' ? `<div class="sum-line"><span>${tt('คืนเงินมัดจำ', 'Deposit refunded')}</span><span class="mono">${money(b.status === 'cancelled' ? b.deposit : b.depositRefund)}</span></div>` : ''}
          ${b.refund ? `<div class="sum-line"><span>${tt('คืนเงินค่าเช่า', 'Rent refunded')}</span><span class="mono">${money(b.refund)}</span></div>` : ''}
          ${b.status === 'pending_payment' ? `<div class="alert alert-warn small" style="margin-top:10px">${tt('รอชำระเงินภายใน', 'Pay before')} ${fmtDT(b.holdUntil)}</div>` : ''}
          ${job ? `<div class="alert ${b.returned && b.returned.damaged && b.depositStatus === 'held' ? 'alert-warn' : 'alert-info'} small" style="margin-top:10px"><b>${tt('รายการซ่อม', 'Repair')}</b>: ${esc(job.damage)}<br>${tt('ค่าใช้จ่ายการซ่อมรถ', 'Repair cost')}: <b>${job.status === 'approved' ? money(Logic.jobCost(job)) : tt('อยู่ระหว่างประเมิน', 'being assessed')}</b> ${badge(job.status)}</div>` : ''}
        </div></div></div>
      <div class="modal-foot">
        ${b.status === 'pending_payment' ? `<button class="btn btn-primary" data-a="pay">${tt('ชำระเงิน', 'Pay now')}</button>` : ''}
        ${b.contract ? `<button class="btn ${b.contract.signed ? '' : 'btn-primary'}" data-a="contract">${b.contract.signed ? tt('ดูสัญญาเช่า', 'View contract') : tt('อ่านและเซ็นสัญญา', 'Read & sign contract')}</button>` : ''}
        ${b.status !== 'pending_payment' && b.status !== 'cancelled' || b.refund ? `<button class="btn" data-a="invoice">${tt('ใบแจ้งหนี้', 'Invoice')}</button>` : ''}
        ${canEdit ? `<button class="btn" data-a="edit">${tt('แก้ไขการเช่า', 'Edit rental')}</button>` : ''}
        ${canCancel ? `<button class="btn btn-danger" data-a="cancel">${b.status === 'pending_payment' ? tt('ยกเลิกการจอง', 'Cancel booking') : tt('ยกเลิกการเช่า', 'Cancel rental')}</button>` : ''}
      </div>`, { wide: true });
    const act = (a, fn) => { const x = $(`[data-a=${a}]`, m.el); if (x) x.onclick = () => { m.close(true); fn(); }; };
    act('pay', () => this.pay(b, () => App.render()));
    act('contract', () => this.contract(b.id));
    act('invoice', () => this.invoice(b.id));
    act('edit', () => this.edit(b.id));
    act('cancel', () => this.cancel(b.id));
  },

  contract(id) {
    const b = Store.rental(id), c = Store.user(b.customerId), car = Store.car(b.plate), signed = b.contract.signed;
    const m = UI.modal(`<div class="modal-head"><h3>${tt('สัญญาเช่ารถ', 'Rental contract')} <span class="mono">${b.contract.no}</span></h3><button class="x-btn" data-close>×</button></div>
      <div class="modal-body"><div class="doc" id="doc">
        <h3>${tt('สัญญาเช่ารถยนต์', 'Car Rental Agreement')}</h3><p class="center small muted">${tt('เลขที่', 'No.')} ${b.contract.no} · ${tt('ออกเมื่อ', 'issued')} ${fmtDT(b.contract.generatedAt)} · Booking ID ${b.id}</p>
        <p>${tt('สัญญานี้ทำขึ้นระหว่าง บริษัทให้เช่ารถ ("ผู้ให้เช่า") และ', 'This agreement is made between the car rental company ("Lessor") and')} <b>${esc(fullName(c))}</b> ${tt('เลขบัตรประชาชน', 'ID')} ${esc(c.nationalId || '-')} ${tt('ใบขับขี่', 'licence')} ${esc(c.license || '-')} ("${tt('ผู้เช่า', 'Renter')}")</p>
        <dl class="kv"><dt>${tt('รถ', 'Car')}</dt><dd>${esc(carName(car))} · ${esc(car.plate)}</dd><dt>${tt('ระยะเวลาเช่า', 'Period')}</dt><dd>${fmtDT(b.pickupAt)} – ${fmtDT(b.returnAt)} (${b.days} ${tt('วัน', 'days')})</dd>
          <dt>${tt('สถานที่รับ-คืน', 'Location')}</dt><dd>${esc(branchName(b.branch))}</dd><dt>${tt('ค่าเช่า / มัดจำ', 'Rent / deposit')}</dt><dd>${money(b.total)} / ${money(b.deposit)}</dd></dl>
        <ol>
          <li>${tt(`ผู้เช่าต้องคืนรถตามวันเวลาที่กำหนด หากคืนช้าเกิน ${POLICY.lateGraceHours} ชั่วโมง คิดค่าปรับชั่วโมงละ 10% ของอัตรารายวัน`, `Late return beyond ${POLICY.lateGraceHours} hour is charged at 10% of the daily rate per hour.`)}</li>
          <li>${tt('ความเสียหายที่เกิดระหว่างการเช่าจะหักจากเงินมัดจำตามค่าซ่อมจริง', 'Damage during the rental is deducted from the deposit at actual repair cost.')}</li>
          <li>${tt(`ยกเลิกได้และคืนเงินเต็มจำนวนหากยกเลิกก่อนรับรถอย่างน้อย ${POLICY.cancelHours} ชั่วโมง`, `Full refund if cancelled at least ${POLICY.cancelHours} hours before pick-up.`)}</li>
          <li>${tt('ผู้เช่าต้องแสดงบัตรประชาชนและใบขับขี่ตัวจริงในวันรับรถ', 'The renter must show the original ID card and driving licence at pick-up.')}</li>
        </ol>
        ${signed ? `<div style="margin-top:12px"><div class="small muted">${tt('ลงชื่อผู้เช่า', 'Renter signature')}</div>${b.contract.sig ? `<img src="${b.contract.sig}" alt="" style="height:70px">` : `<div style="font-family:cursive;font-size:22px">${esc(b.contract.signedName)}</div>`}<div class="small">${esc(b.contract.signedName)} · ${fmtDT(b.contract.signedAt)}</div></div>` : ''}
      </div>
      ${signed ? '' : `<form id="sf" class="form" style="margin-top:14px" novalidate><div class="form-alert"></div>
        ${UI.field('sig', 'ลายเซ็น', 'Signature', `<canvas class="sig-pad"></canvas>`, { req: true, hint: `<button type="button" class="link-btn small" id="clr">${tt('ล้างลายเซ็น', 'Clear')}</button>` })}
        ${UI.field('name', 'พิมพ์ชื่อ-นามสกุลเพื่อยืนยัน', 'Type your full name to confirm', `<input placeholder="${esc(fullName(c))}">`, { req: true })}
        <div class="field" data-field="agree"><label class="check"><input type="checkbox"> ${tt('ข้าพเจ้าได้อ่านและยอมรับเงื่อนไขในสัญญานี้', 'I have read and accept this agreement')}</label><span class="err"></span></div></form>`}
      </div>
      <div class="modal-foot"><button class="btn" data-print>${tt('พิมพ์ / บันทึก PDF', 'Print / save PDF')}</button>${signed ? `<button class="btn btn-primary" data-close>${tt('ปิด', 'Close')}</button>` : `<button class="btn btn-primary" data-sign>${tt('เซ็นสัญญา', 'Sign contract')}</button>`}</div>`, { wide: true });
    $('[data-print]', m.el).onclick = () => UI.printEl($('#doc', m.el));
    if (signed) return;
    const pad = signaturePad($('canvas', m.el));
    $('#clr', m.el).onclick = () => pad.clear();
    $('[data-sign]', m.el).onclick = () => {
      const f = $('#sf', m.el); UI.clearErrors(f);
      try {
        if (!pad.data()) throw new AppError(tt('กรุณาเซ็นชื่อในช่องลายเซ็น', 'Please sign in the signature box'), 'sig');
        UI.require(f, ['name']);
        if (!$('[data-field=agree] input', f).checked) throw new AppError(tt('กรุณายอมรับเงื่อนไขสัญญา', 'Please accept the agreement'), 'agree');
        Logic.signContract(b.id, $('[data-field=name] input', f).value, pad.data());
        m.close(true); UI.toast(tt('เซ็นสัญญาเรียบร้อย', 'Contract signed'), 'ok'); App.render();
      } catch (err) { UI.showError(f, err); }
    };
  },

  invoice(id) {
    const b = Store.rental(id), c = Store.user(b.customerId), car = Store.car(b.plate);
    const pays = Store.db.payments.filter(p => p.bookingId === b.id).sort((a, z) => a.at - z.at);
    const charged = pays.filter(p => ['rent', 'difference', 'refund_difference', 'late_fee', 'damage_charge', 'refund'].includes(p.kind)).reduce((s, p) => s + p.amount, 0);
    const m = UI.modal(`<div class="modal-head"><h3>${tt('ใบแจ้งหนี้', 'Invoice')}</h3><button class="x-btn" data-close>×</button></div>
      <div class="modal-body"><div class="doc" id="inv">
        <div class="row" style="justify-content:space-between;align-items:flex-start"><div><b>${tt('บริษัทให้เช่ารถ', 'Car Rental Co.')}</b><div class="small muted">${esc(branchName(b.branch))}<br>${esc(branchAddr(b.branch))}</div></div>
        <div class="right"><b>${tt('ใบแจ้งหนี้', 'INVOICE')}</b><div class="small mono">INV-${b.id.slice(2)}</div><div class="small">${fmtD(b.createdAt)}</div></div></div>
        <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
        <div class="small">${tt('ผู้เช่า', 'Bill to')}: <b>${esc(fullName(c))}</b> · ${esc(c.email || '')} · ${esc(c.phone || '')}</div>
        <div class="small">Booking ID ${b.id} · ${esc(carName(car))} (${esc(car.plate)}) · ${fmtDT(b.pickupAt)} – ${fmtDT(b.returnAt)}</div>
        <div style="margin-top:12px">${UI.table([
          { h: tt('วันที่', 'Date'), v: p => fmtDT(p.at) }, { h: tt('รายการ', 'Item'), v: p => esc(payKind(p.kind)) },
          { h: tt('ช่องทาง', 'Method'), v: p => esc(methodName(p.method)) }, { h: tt('เลขที่ธุรกรรม', 'Txn'), v: p => `<span class="mono small">${p.txn}</span>` },
          { h: tt('จำนวนเงิน', 'Amount'), cls: 'num', v: p => money(p.amount) }], pays)}</div>
        <div style="max-width:320px;margin-left:auto;margin-top:10px">
          <div class="sum-line"><span>${tt('ค่าบริการสุทธิ', 'Net charges')}</span><span class="mono">${money(charged)}</span></div>
          <div class="sum-line"><span>${tt('ภาษีมูลค่าเพิ่ม 7% (รวมในราคา)', 'VAT 7% (included)')}</span><span class="mono">${money(charged * 7 / 107)}</span></div>
          <div class="sum-line total"><span>${tt('รวมทั้งสิ้น', 'Total')}</span><span>${money(charged)}</span></div></div>
      </div></div>
      <div class="modal-foot"><button class="btn" data-print>${tt('พิมพ์ / บันทึก PDF', 'Print / save PDF')}</button><button class="btn btn-primary" data-close>${tt('ปิด', 'Close')}</button></div>`, { wide: true });
    $('[data-print]', m.el).onclick = () => UI.printEl($('#inv', m.el));
  },

  /* shared by customer (C-13/14) and office employee (OE-04) */
  edit(id, { staff = false } = {}) {
    const b = Store.rental(id);
    const opts = () => Store.db.cars.filter(c => c.branch === b.branch || c.plate === b.plate);
    const m = UI.modal(`<div class="modal-head"><h3>${tt('แก้ไขการเช่า', 'Edit rental')} <span class="mono">${b.id}</span></h3><button class="x-btn" data-close>×</button></div>
      <div class="modal-body"><form class="form" id="ef" novalidate><div class="form-alert"></div>
        <div class="fields">
          ${UI.field('start', 'วันเวลารับรถใหม่', 'New pick-up', `<input type="datetime-local" value="${toLocalInput(b.pickupAt)}">`, { req: true })}
          ${UI.field('end', 'วันเวลาคืนรถใหม่', 'New return', `<input type="datetime-local" value="${toLocalInput(b.returnAt)}">`, { req: true })}
          ${UI.field('plate', 'รุ่นรถ / ทะเบียนรถ', 'Car model / plate', `<select>${opts().map(c => `<option value="${esc(c.plate)}" ${c.plate === b.plate ? 'selected' : ''}>${esc(carName(c))} · ${esc(typeName(c.type))} · ${esc(c.plate)}</option>`).join('')}</select>`, { req: true, cls: 'span2', hint: tt('แสดงเฉพาะรถในสาขาเดียวกัน', 'Cars at the same branch only') })}
        </div><div id="pv"></div></form></div>
      <div class="modal-foot"><button class="btn" data-close>${tt('ยกเลิก', 'Cancel')}</button><button class="btn" data-check>${tt('คำนวณค่าใช้จ่าย', 'Calculate')}</button><button class="btn btn-primary" data-save disabled>${tt('ยืนยันการแก้ไข', 'Confirm change')}</button></div>`, { wide: true });
    const f = $('#ef', m.el); let pv = null;
    const read = () => ({ start: new Date($('[data-field=start] input', f).value).getTime(), end: new Date($('[data-field=end] input', f).value).getTime(), plate: $('[data-field=plate] select', f).value });
    const check = () => {
      UI.clearErrors(f); $('[data-save]', m.el).disabled = true; $('#pv', f).innerHTML = '';
      try {
        UI.require(f, ['start', 'end']);
        pv = Logic.previewEdit(b.id, read());
        const d = pv.diff, dd = pv.depositDiff;
        $('#pv', f).innerHTML = `<div class="card" style="box-shadow:none;margin-top:4px">
          <div class="sum-line"><span>${tt('ค่าเช่าเดิมที่ชำระแล้ว', 'Rent already paid')}</span><span class="mono">${money(pv.paid)}</span></div>
          <div class="sum-line"><span>${tt('ค่าเช่าใหม่', 'New rent')} (${pv.price.days} ${tt('วัน', 'days')}, ${esc(carName(pv.car))})</span><span class="mono">${money(pv.price.total)}</span></div>
          ${dd ? `<div class="sum-line"><span>${tt('ส่วนต่างค่ามัดจำ', 'Deposit difference')}</span><span class="mono">${money(dd)}</span></div>` : ''}
          <div class="sum-line total"><span>${d + dd > 0 ? tt('ยอดเงินส่วนต่างที่ต้องชำระเพิ่ม', 'Extra amount to pay') : d + dd < 0 ? tt('ยอดเงินที่จะได้รับคืน', 'Amount to be refunded') : tt('ไม่มีค่าใช้จ่ายเพิ่ม', 'No extra cost')}</span><span>${money(Math.abs(d + dd))}</span></div>
          <div class="small muted">${tt('หลังแก้ไข ระบบจะออกสัญญาฉบับใหม่ และต้องเซ็นใหม่อีกครั้ง', 'A new contract is issued after the change and must be signed again')}</div></div>`;
        $('[data-save]', m.el).disabled = false;
      } catch (err) { pv = null; UI.showError(f, err); }
    };
    $('[data-check]', m.el).onclick = check;
    $$('input,select', f).forEach(i => i.addEventListener('change', () => { pv = null; $('[data-save]', m.el).disabled = true; $('#pv', f).innerHTML = ''; }));
    $('[data-save]', m.el).onclick = () => {
      if (!pv) return check();
      const changes = read(), owe = pv.diff + pv.depositDiff;
      const finish = method => { try { const r = Logic.applyEdit(b.id, changes, method); UI.toast(tt(`แก้ไขการเช่าสำเร็จ (ส่วนต่าง ${money(r.diff)})`, `Rental updated (difference ${money(r.diff)})`), 'ok'); App.render(); return r.txn; } catch (err) { UI.toast(err.message, 'err'); throw err; } };
      m.close(true);
      if (owe > 0) {
        PaymentService.open({ bookingId: b.id, amount: owe, lines: [[tt('ส่วนต่างค่าเช่า', 'Rent difference'), pv.diff], ...(pv.depositDiff ? [[tt('ส่วนต่างค่ามัดจำ', 'Deposit difference'), pv.depositDiff]] : [])],
          onSuccess: r => finish(r.method), onCancel: () => UI.toast(tt('ยังไม่ได้ชำระส่วนต่าง การแก้ไขยังไม่ถูกบันทึก', 'Difference not paid — change not saved'), 'warn') });
      } else finish('refund');
    };
  },

  cancel(id, { staff = false } = {}) {
    const b = Store.rental(id);
    const unpaid = b.status === 'pending_payment';
    const late = !unpaid && b.pickupAt - Date.now() < POLICY.cancelHours * HOUR;
    const m = UI.modal(`<div class="modal-head"><h3>${unpaid ? tt('ยกเลิกการจอง', 'Cancel booking') : staff ? tt('ลบรายการเช่า', 'Delete rental') : tt('ยกเลิกการเช่า', 'Cancel rental')} <span class="mono">${b.id}</span></h3><button class="x-btn" data-close>×</button></div>
      <div class="modal-body"><form class="form" id="cf" novalidate><div class="form-alert"></div>
        ${!unpaid ? `<div class="alert ${late && !staff ? 'alert-warn' : 'alert-info'} small">${late && !staff ? tt(`เหลือเวลาก่อนรับรถไม่ถึง ${POLICY.cancelHours} ชั่วโมง ตามเงื่อนไขจะยกเลิกผ่านระบบไม่ได้`, `Less than ${POLICY.cancelHours} hours to pick-up — online cancellation is not allowed`) : tt(`ระบบจะคืนเงิน ${money(Logic.paidRent(b.id) + b.deposit)} (ค่าเช่า + มัดจำ) เข้าช่องทางเดิม`, `${money(Logic.paidRent(b.id) + b.deposit)} (rent + deposit) will be refunded to the original method`)}</div>` : ''}
        ${UI.field('reason', 'เหตุผลการยกเลิก', 'Reason for cancelling', `<select><option value="">${tt('— เลือก —', '— Select —')}</option>${[['เปลี่ยนแผนการเดินทาง', 'Change of plans'], ['ได้รถจากที่อื่น', 'Found another car'], ['จองผิดวัน/ผิดรถ', 'Booked wrong date/car'], ['อื่น ๆ', 'Other']].map(r => `<option>${tt(...r)}</option>`).join('')}</select>`, { req: true })}
        ${UI.field('note', 'รายละเอียดเพิ่มเติม', 'Details', `<textarea placeholder="${tt('ระบุรายละเอียด (ถ้ามี)', 'Optional details')}"></textarea>`)}
      </form></div>
      <div class="modal-foot"><button class="btn" data-close>${tt('ไม่ยกเลิก', 'Keep it')}</button><button class="btn btn-danger" data-go>${tt('ยืนยันการยกเลิก', 'Confirm cancellation')}</button></div>`);
    $('[data-go]', m.el).onclick = () => {
      const f = $('#cf', m.el); UI.clearErrors(f);
      try {
        const reason = $('[data-field=reason] select', f).value; const note = $('[data-field=note] textarea', f).value.trim();
        const r = Logic.cancel(b.id, reason ? reason + (note ? ' — ' + note : '') : '', staff ? 'staff' : 'customer');
        m.close(true);
        UI.toast(r.refund ? tt(`ยกเลิกสำเร็จ คืนเงิน ${money(r.refund)}`, `Cancelled — ${money(r.refund)} refunded`) : tt('ยกเลิกการจองสำเร็จ', 'Booking cancelled'), 'ok');
        App.render();
      } catch (err) { UI.showError(f, err); }
    };
  },

  inbox(el) {
    const mails = Store.db.outbox.filter(x => x.to === App.user.id);
    el.innerHTML = UI.pageHead('กล่องข้อความ (อีเมล)', 'Inbox (email)', 'อีเมลที่ระบบส่งถึงคุณ — ในต้นแบบนี้แสดงแทนการส่งอีเมลจริง', 'Emails the system sent you — shown here instead of real email in this prototype', ['C-09'], [])
      + `<div class="card">${mails.length ? mails.map(x => `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="row" style="justify-content:space-between"><b>${esc(x.subject)}</b><span class="small muted">${fmtDT(x.at)}</span></div><div class="muted" style="margin-top:4px">${esc(x.body)}</div>${x.bookingId ? `<button class="link-btn small" data-d="${x.bookingId}" style="margin-top:4px">${tt('เปิดการเช่า', 'Open rental')} ${x.bookingId} →</button>` : ''}</div>`).join('') : `<div class="empty">${tt('ยังไม่มีข้อความ', 'No messages yet')}</div>`}</div>`;
    mails.forEach(x => x.read = true); Store.save();
    $$('[data-d]', el).forEach(b => b.onclick = () => this.detail(b.dataset.d));
  },

  repairs(el) {
    const mine = Store.db.rentals.filter(b => b.customerId === App.user.id).map(b => ({ b, j: Store.db.jobs.find(j => j.bookingId === b.id) })).filter(x => x.j);
    el.innerHTML = UI.pageHead('ค่าใช้จ่ายในการซ่อมรถ', 'Repair costs', 'ความเสียหายที่พบตอนคืนรถ และค่าซ่อมที่หักจากเงินมัดจำ', 'Damage found at return and repair costs deducted from your deposit', [], ['3.4'])
      + `<div class="card">${UI.table([
        { h: 'Booking ID', v: x => `<span class="mono">${x.b.id}</span>` }, { h: tt('รถ', 'Car'), v: x => `${esc(carName(Store.car(x.b.plate)))} <span class="small mono muted">${esc(x.b.plate)}</span>` },
        { h: tt('รายการซ่อม', 'Repair items'), v: x => esc(x.j.damage) }, { h: tt('สถานะ', 'Status'), v: x => badge(x.j.status) },
        { h: tt('ค่าใช้จ่ายการซ่อมรถ', 'Repair cost'), cls: 'num', v: x => x.j.status === 'approved' ? money(Logic.jobCost(x.j)) : `<span class="muted">${tt('รอประเมิน', 'Pending')}</span>` },
        { h: tt('หักจากมัดจำ', 'From deposit'), cls: 'num', v: x => x.b.damageCharge ? money(x.b.damageCharge) : '-' }], mine, 'ไม่มีรายการซ่อมที่เกี่ยวกับการเช่าของคุณ', 'No repairs linked to your rentals')}</div>`;
  },
};

Roles.customer = {
  nav: [['rent', 'เช่ารถ', 'Rent a car', 'car'], ['rentals', 'การเช่าของฉัน', 'My rentals', 'list'], ['inbox', 'กล่องข้อความ', 'Inbox', 'mail'], ['repairs', 'ค่าใช้จ่ายการซ่อม', 'Repair costs', 'wrench']],
  badge: { inbox: () => Store.db.outbox.filter(x => x.to === App.user.id && !x.read).length },
  views: { rent: el => CustomerViews.rent(el), rentals: el => CustomerViews.rentals(el), inbox: el => CustomerViews.inbox(el), repairs: el => CustomerViews.repairs(el) },
};
