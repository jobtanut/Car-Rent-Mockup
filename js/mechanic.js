/* ===== ช่างซ่อมบำรุง (Mechanic Employee) + หัวหน้าช่าง (Mechanic Manager) — DFD process 3 ===== */
const CHECK_ITEMS = [['tyres', 'ยางและล้อ', 'Tyres & wheels'], ['brakes', 'ระบบเบรก', 'Brakes'], ['lights', 'ไฟส่องสว่าง', 'Lights'], ['engine', 'เครื่องยนต์ / ของเหลว', 'Engine / fluids'], ['body', 'ตัวถังและกระจก', 'Body & glass']];

const mineOrAll = j => App.user.role !== 'mechanic' || j.assignedTo === App.user.id;

const MechViews = {
  jobCard(j, { manager = false } = {}) {
    const car = Store.car(j.plate), mech = j.assignedTo && Store.user(j.assignedTo);
    if (manager) {
      /* minimal card for the approve page: status on top, then one line per fact */
      const line = (k, v) => v ? `<dt>${k}</dt><dd style="overflow-wrap:anywhere">${v}</dd>` : '';
      const insp = j.inspection ? `${j.inspection.result === 'pass' ? `<span class="badge b-ok">${tt('ผ่าน', 'Pass')}</span>` : `<span class="badge b-danger">${tt('ไม่ผ่าน', 'Fail')}</span>`}<div><button class="link-btn small" data-insp="${j.id}">${tt('ดูรายละเอียด', 'Details')} →</button></div>` : `<span class="muted">${tt('ยังไม่ตรวจ', 'Not inspected')}</span>`;
      return `<div class="card" style="box-shadow:none"><div class="card-head" style="margin-bottom:10px"><div><b>${esc(carName(car))}</b> <span class="mono muted small">${esc(j.plate)} · ${j.id}</span></div>${badge(j.status)}</div>
        <dl class="kv" style="grid-template-columns:110px minmax(0,1fr)">
          ${line(tt('ความเสียหาย', 'Damage'), esc(j.damage))}
          ${line(tt('ผลตรวจสภาพ', 'Inspection'), insp)}
          ${line(tt('งานที่ทำ', 'Work done'), j.logs.map(l => esc(l.work)).join(', '))}
          ${line(tt('ผลจากอู่', 'Shop result'), j.shop && esc(j.shop.result))}
          ${line(tt('ช่าง', 'Mechanic'), mech && esc(fullName(mech)))}
          ${line(tt('ค่าใช้จ่าย', 'Cost'), `<b>${money(Logic.jobCost(j))}</b>`)}
        </dl><div class="row" style="margin-top:12px" data-actions="${j.id}"></div></div>`;
    }
    return `<div class="card" style="box-shadow:none"><div class="card-head" style="margin-bottom:8px"><div><b class="mono">${j.id}</b> · ${esc(carName(car))} <span class="mono muted">${esc(j.plate)}</span></div>${badge(j.status)}</div>
      <div class="small"><b>${tt('รายการความเสียหาย', 'Damage / work')}</b>: ${esc(j.damage)}</div>
      <div class="small muted">${j.mode ? (j.mode === 'shop' ? tt('ส่งอู่บำรุงรักษารถ', 'Sent to repair shop') : tt('ซ่อมภายใน', 'In-house')) + ' · ' : ''}${mech ? tt('ช่าง', 'Mechanic') + ': ' + esc(fullName(mech)) + ' · ' : ''}${j.assignedAt ? tt('มอบหมาย', 'assigned') + ' ' + fmtDT(j.assignedAt) : ''}</div>
      ${j.inspection ? `<div class="small" style="margin-top:6px">${tt('ผลการตรวจสภาพรถ', 'Inspection')}: ${j.inspection.result === 'pass' ? `<span class="badge b-ok">${tt('ผ่าน', 'Pass')}</span>` : `<span class="badge b-danger">${tt('ไม่ผ่าน', 'Fail')}</span>`} ${esc(j.inspection.note)}</div>` : ''}
      ${j.logs.length ? `<div class="small" style="margin-top:6px">${tt('ข้อมูลการบำรุงรักษา', 'Maintenance')}: ${j.logs.map(l => `${esc(l.work)} (${money(l.cost)})`).join(' · ')}</div>` : ''}
      ${j.shop ? `<div class="small" style="margin-top:6px">${tt('ผลจากอู่', 'Shop result')}: ${esc(j.shop.result)} (${money(j.shop.cost)})</div>` : ''}
      ${j.progress.length ? `<div class="small muted" style="margin-top:6px">${tt('ความคืบหน้าล่าสุด', 'Latest progress')}: ${esc(j.progress[j.progress.length - 1].note)} · ${fmtDT(j.progress[j.progress.length - 1].at)}</div>` : ''}
      <div class="small" style="margin-top:6px">${tt('ค่าใช้จ่ายรวม', 'Total cost')}: <b>${money(Logic.jobCost(j))}</b></div>
      <div class="row" style="margin-top:10px" data-actions="${j.id}"></div></div>`;
  },

  /* full inspection record, opened from the approve page */
  inspectionDetail(id) {
    const j = Store.job(id), i = j.inspection, by = i.by && Store.user(i.by);
    UI.modal(`<div class="modal-head"><div><h3>${tt('ผลการตรวจสภาพรถ', 'Inspection result')}</h3><div class="small muted"><span class="mono">${esc(j.plate)} · ${j.id}</span></div></div><button class="x-btn" data-close>×</button></div>
      <div class="modal-body">
        <div style="margin-bottom:12px">${i.result === 'pass' ? `<span class="badge b-ok">${tt('ผ่าน', 'Pass')}</span>` : `<span class="badge b-danger">${tt('ไม่ผ่าน', 'Fail')}</span>`}</div>
        ${Object.keys(i.items || {}).length ? UI.table([{ h: tt('รายการตรวจ', 'Check item'), v: c => tt(c[1], c[2]) }, { h: tt('ผล', 'Result'), v: c => i.items[c[0]] === true ? `<span class="badge b-ok">${tt('ผ่าน', 'Pass')}</span>` : i.items[c[0]] === false ? `<span class="badge b-danger">${tt('ไม่ผ่าน', 'Fail')}</span>` : '-' }], CHECK_ITEMS) : ''}
        <dl class="kv" style="margin-top:14px">
          <dt>${tt('สรุปผล', 'Summary')}</dt><dd style="overflow-wrap:anywhere">${esc(i.note || '-')}</dd>
          <dt>${tt('ความเสียหายที่พบ', 'Damage found')}</dt><dd style="overflow-wrap:anywhere">${esc(i.damage || '-')}</dd>
          <dt>${tt('ผู้ตรวจ', 'Inspected by')}</dt><dd>${by ? esc(fullName(by)) : esc(fullName(Store.user(j.assignedTo)))}</dd>
          <dt>${tt('วันเวลาตรวจ', 'Inspected at')}</dt><dd>${fmtDT(i.at)}</dd>
        </dl></div>
      <div class="modal-foot"><button class="btn btn-primary" data-close>${tt('ปิด', 'Close')}</button></div>`);
  },

  /* ME-02, ME-05 */
  jobs(el) {
    const mine = Store.db.jobs.filter(j => j.assignedTo && mineOrAll(j) && j.status !== 'approved').sort((a, b) => (a.assignedAt || 0) - (b.assignedAt || 0));
    el.innerHTML = UI.pageHead('รายการรถที่ได้รับมอบหมาย', 'Assigned cars', 'งานตรวจสอบและซ่อมที่หัวหน้าช่างมอบหมายให้คุณ', 'Inspection and repair work assigned to you', ['ME-02', 'ME-05'], ['3.4'])
      + (mine.length ? `<div class="grid g2">${mine.map(j => this.jobCard(j)).join('')}</div>` : `<div class="card empty">${tt('ไม่มีงานค้าง', 'No open jobs')}</div>`);
    mine.forEach(j => {
      const box = $(`[data-actions="${j.id}"]`, el);
      box.innerHTML = `<button class="btn btn-sm btn-primary" data-rec>${tt('บันทึกข้อมูลรถ', 'Record work')}</button><button class="btn btn-sm" data-prog>${tt('รายงานความคืบหน้า', 'Report progress')}</button>${j.mode === 'shop' && !j.shop ? `<button class="btn btn-sm" data-shop>${tt('รับผลจากอู่', 'Receive shop result')}</button>` : ''}`;
      $('[data-rec]', box).onclick = () => App.go('record', { plate: j.plate, job: j.id });
      $('[data-prog]', box).onclick = () => this.progress(j.id);
      const s = $('[data-shop]', box); if (s) s.onclick = () => this.shopResult(j.id);
    });
  },

  progress(id) {
    const j = Store.job(id);
    const m = UI.modal(`<div class="modal-head"><h3>${tt('รายงานสถานะความคืบหน้า', 'Report progress')} <span class="mono">${j.id}</span></h3><button class="x-btn" data-close>×</button></div>
      <div class="modal-body"><form id="f" class="form" novalidate><div class="form-alert"></div>
        ${UI.field('status', 'สถานะความคืบหน้า', 'Progress status', `<select>${['in_progress', ...(j.mode === 'shop' ? ['sent_to_shop'] : []), 'done'].map(s => `<option value="${s}" ${j.status === s ? 'selected' : ''}>${esc(tt(STATUS[s][0], STATUS[s][1]))}</option>`).join('')}</select>`, { req: true })}
        ${UI.field('note', 'รายละเอียด', 'Details', '<textarea></textarea>', { req: true })}
        <div class="small muted">${tt('เลือก "เสร็จ รออนุมัติ" ได้เมื่อบันทึกผลตรวจสภาพที่ผ่านแล้วเท่านั้น', '"Done" requires a passed inspection record')}</div></form></div>
      <div class="modal-foot"><button class="btn" data-close>${tt('ยกเลิก', 'Cancel')}</button><button class="btn btn-primary" data-save>${tt('ส่งรายงาน', 'Submit')}</button></div>`);
    $('[data-save]', m.el).onclick = () => {
      const f = $('#f', m.el); UI.clearErrors(f);
      try {
        UI.require(f, ['status', 'note']);
        const s = $('[data-field=status] select', f).value;
        if (s === 'done' && (!j.inspection || j.inspection.result !== 'pass')) throw new AppError(tt('ยังไม่มีผลตรวจสภาพที่ผ่าน กรุณาบันทึกผลการตรวจสอบรถก่อน', 'No passed inspection yet — record the inspection first'), 'status');
        if (s === 'done' && j.mode === 'shop' && !j.shop) throw new AppError(tt('ยังไม่ได้รับผลการซ่อมจากอู่', 'Shop result not received yet'), 'status');
        j.status = s; j.progress.push({ at: Date.now(), status: s, note: $('[data-field=note] textarea', f).value.trim(), by: App.user.id });
        Store.save(); m.close(true); UI.toast(tt('ส่งรายงานความคืบหน้าแล้ว', 'Progress reported'), 'ok'); App.render();
      } catch (err) { UI.showError(f, err); }
    };
  },

  /* external: อู่บำรุงรักษารถ (Maintenance Shop) → 3.4 ผลการซ่อม, ค่าซ่อม */
  shopResult(id) {
    const j = Store.job(id);
    const m = UI.modal(`<div class="modal-head"><h3>${tt('ผลการซ่อมจากอู่', 'Repair shop result')} <span class="mono">${j.id}</span></h3><button class="x-btn" data-close>×</button></div>
      <div class="modal-body"><p class="small muted">${tt('งานที่ส่งไป', 'Sent')}: <span class="mono">${esc(j.plate)}</span> — ${esc(j.damage)}</p><form id="f" class="form" novalidate><div class="form-alert"></div>
        ${UI.field('result', 'ผลการซ่อม', 'Repair result', '<textarea></textarea>', { req: true })}
        ${UI.field('cost', 'ค่าซ่อม (บาท)', 'Repair cost (THB)', '<input type="number" min="0">', { req: true })}</form></div>
      <div class="modal-foot"><button class="btn" data-close>${tt('ยกเลิก', 'Cancel')}</button><button class="btn btn-primary" data-save>${tt('บันทึกผลจากอู่', 'Save shop result')}</button></div>`, { banner: tt('อู่บำรุงรักษารถ (Maintenance Shop) — ระบบภายนอก (จำลอง)', 'Maintenance Shop — external party (simulated)') });
    $('[data-save]', m.el).onclick = () => {
      const f = $('#f', m.el); UI.clearErrors(f);
      try {
        UI.require(f, ['result', 'cost']);
        const cost = Number($('[data-field=cost] input', f).value);
        if (!(cost >= 0)) throw new AppError(tt('ค่าซ่อมต้องเป็นตัวเลขไม่ติดลบ', 'Cost must be a non-negative number'), 'cost');
        j.shop = { result: $('[data-field=result] textarea', f).value.trim(), cost, at: Date.now() };
        j.progress.push({ at: Date.now(), status: j.status, note: tt('ได้รับผลการซ่อมจากอู่', 'Shop result received'), by: App.user.id });
        Store.save(); m.close(true); UI.toast(tt('บันทึกผลการซ่อมจากอู่แล้ว', 'Shop result saved'), 'ok'); App.render();
      } catch (err) { UI.showError(f, err); }
    };
  },

  /* ME-03, ME-04 — use case narrative 2 "บันทึกข้อมูลการจัดการรถ" */
  record(el) {
    const p = App.params;
    /* only cars with an open job assigned to this mechanic */
    const todo = [...new Map(Store.db.jobs.filter(j => j.assignedTo && mineOrAll(j) && !['approved', 'done'].includes(j.status))
      .map(j => [j.plate, { plate: j.plate, label: carName(Store.car(j.plate)) }])).values()];
    el.innerHTML = UI.pageHead('บันทึกข้อมูลการจัดการรถ', 'Record car work', 'เลือกรถที่ต้องทำงาน แล้วบันทึกผลการตรวจสอบและข้อมูลการบำรุงรักษา', 'Choose a car that needs work, then record inspection results and maintenance', ['ME-03', 'ME-04'], ['3.4'])
      + `<div class="card"><form id="sf" class="form" novalidate><div class="form-alert"></div>
        ${todo.length ? UI.field('plate', 'รถที่ต้องทำงาน', 'Car needing work', `<select><option value="">${tt('— เลือกรถ —', '— Select a car —')}</option>${todo.map(x => `<option value="${esc(x.plate)}" ${x.plate === p.plate ? 'selected' : ''}>${esc(x.plate)} · ${esc(x.label)}</option>`).join('')}</select>`, { req: true, hint: tt(`${todo.length} คันที่มีงานมอบหมายให้คุณ`, `${todo.length} car(s) with work assigned to you`) })
          : `<div class="alert alert-info">${tt('ไม่มีรถที่ต้องทำงานในตอนนี้', 'No cars need work from you right now')}</div>`}
        </form></div><div id="work"></div>`;
    const sf = $('#sf', el), sel = $('[data-field=plate] select', sf);
    const find = () => {
      UI.clearErrors(sf); $('#work', el).innerHTML = '';
      try {
        UI.require(sf, ['plate']);
        const car = Store.car(sel.value);
        if (!car) throw new AppError(tt('ไม่มีข้อมูลรถคันนี้ในระบบ', 'No such car in the system'), 'plate');
        const jobs = Store.db.jobs.filter(j => j.plate === car.plate && j.assignedTo && mineOrAll(j) && !['approved', 'done'].includes(j.status));
        if (!jobs.length) throw new AppError(tt('รถคันนี้ไม่มีงานที่มอบหมายให้คุณ (หรือส่งรออนุมัติแล้ว)', 'No open job on this car is assigned to you (or it is awaiting approval)'), 'plate');
        App.params = { plate: car.plate };
        this.workForms($('#work', el), car, jobs.find(j => j.id === p.job) || jobs[0]);
      } catch (err) { UI.showError(sf, err); }
    };
    if (sel) { sel.onchange = () => sel.value ? find() : ($('#work', el).innerHTML = ''); }
    sf.onsubmit = e => { e.preventDefault(); find(); };
    if (sel && sel.value) find();
  },
  workForms(box, car, j) {
    const tab = this._tab || 'inspect';
    box.innerHTML = `<div class="card"><div class="card-head"><div><h3>${esc(carName(car))} <span class="mono muted">${esc(car.plate)}</span></h3><div class="small muted">${tt('งาน', 'Job')} <span class="mono">${j.id}</span> · ${esc(j.damage)} · ${tt('เลขไมล์', 'odometer')} ${num(car.mileage)} km</div></div>${badge(j.status)}</div>
      <div class="tabs"><button class="tab ${tab === 'inspect' ? 'on' : ''}" data-t="inspect">${tt('ผลการตรวจสอบรถ', 'Inspection result')}</button><button class="tab ${tab === 'maint' ? 'on' : ''}" data-t="maint">${tt('ข้อมูลการบำรุงรักษา', 'Maintenance data')}</button></div>
      ${tab === 'inspect' ? `<form id="if" class="form" novalidate><div class="form-alert"></div>
        <div class="table-wrap"><table><thead><tr><th>${tt('รายการตรวจ', 'Check item')}</th><th>${tt('ผ่าน', 'Pass')}</th><th>${tt('ไม่ผ่าน', 'Fail')}</th></tr></thead><tbody>
        ${CHECK_ITEMS.map(([k, th, en]) => `<tr><td>${tt(th, en)}</td><td><input type="radio" name="${k}" value="1" style="width:auto" ${j.inspection && j.inspection.items[k] === true ? 'checked' : ''}></td><td><input type="radio" name="${k}" value="0" style="width:auto" ${j.inspection && j.inspection.items[k] === false ? 'checked' : ''}></td></tr>`).join('')}</tbody></table></div>
        <div data-field="items"><span class="err"></span></div>
        ${UI.field('damage', 'รายการความเสียหายที่พบ', 'Damage found', `<textarea>${esc(j.inspection ? j.inspection.damage || '' : '')}</textarea>`, { hint: tt('เว้นว่างได้ถ้าไม่พบ', 'Leave blank if none') })}
        ${UI.field('note', 'สรุปผลการตรวจสภาพรถ', 'Inspection summary', `<textarea>${esc(j.inspection ? j.inspection.note : '')}</textarea>`, { req: true })}
        ${UI.field('carStatus', 'สถานะของรถ', 'Car status', `<select><option value="maintenance">${tt('ยังต้องซ่อม / ไม่พร้อมใช้งาน', 'Still needs work / not ready')}</option><option value="ready">${tt('ตรวจผ่าน รอหัวหน้าช่างอนุมัติ', 'Passed, awaiting manager approval')}</option></select>`, { req: true })}
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${tt('ยืนยันการบันทึก', 'Confirm & save')}</button></div></form>`
      : `<form id="mf" class="form" novalidate><div class="form-alert"></div><div class="fields">
        ${UI.field('work', 'งานที่ทำ', 'Work performed', '<textarea></textarea>', { req: true, cls: 'span2' })}
        ${UI.field('parts', 'อะไหล่ที่ใช้', 'Parts used', '<input placeholder="-">')}
        ${UI.field('cost', 'ค่าใช้จ่ายการบำรุงรักษา (บาท)', 'Maintenance cost (THB)', '<input type="number" min="0" step="1">', { req: true })}
        </div>${j.logs.length ? `<div>${UI.table([{ h: tt('วันที่', 'Date'), v: l => fmtDT(l.at) }, { h: tt('งาน', 'Work'), v: l => esc(l.work) }, { h: tt('อะไหล่', 'Parts'), v: l => esc(l.parts) }, { h: tt('ค่าใช้จ่าย', 'Cost'), cls: 'num', v: l => money(l.cost) }], j.logs)}</div>` : ''}
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${tt('บันทึกข้อมูลการบำรุงรักษา', 'Save maintenance record')}</button></div></form>`}</div>`;
    $$('[data-t]', box).forEach(b => b.onclick = () => { this._tab = b.dataset.t; this.workForms(box, car, j); });
    const iF = $('#if', box);
    if (iF) iF.onsubmit = e => {
      e.preventDefault(); UI.clearErrors(iF);
      try {
        const items = {};
        for (const [k] of CHECK_ITEMS) { const r = $(`input[name=${k}]:checked`, iF); if (!r) throw new AppError(tt('กรอกข้อมูลไม่ครบถ้วน: กรุณาเลือกผลให้ครบทุกรายการตรวจ', 'Incomplete: choose pass/fail for every check item'), 'items'); items[k] = r.value === '1'; }
        UI.require(iF, ['note']);
        const pass = Object.values(items).every(Boolean), wantReady = $('[data-field=carStatus] select', iF).value === 'ready';
        if (wantReady && !pass) throw new AppError(tt('มีรายการตรวจที่ไม่ผ่าน ไม่สามารถตั้งสถานะว่าพร้อมใช้งาน', 'Some checks failed — the car cannot be marked ready'), 'carStatus');
        j.inspection = { items, result: pass ? 'pass' : 'fail', note: $('[data-field=note] textarea', iF).value.trim(), damage: $('[data-field=damage] textarea', iF).value.trim(), at: Date.now(), by: App.user.id };
        if (j.status === 'assigned') j.status = 'in_progress';
        if (wantReady && (j.mode !== 'shop' || j.shop)) { j.status = 'done'; j.progress.push({ at: Date.now(), status: 'done', note: tt('ตรวจผ่าน รออนุมัติ', 'Passed, awaiting approval'), by: App.user.id }); }
        Store.save(); UI.toast(tt('บันทึกผลการตรวจสอบรถแล้ว', 'Inspection saved'), 'ok'); this.workForms(box, car, j);
      } catch (err) { UI.showError(iF, err); }
    };
    const mF = $('#mf', box);
    if (mF) mF.onsubmit = e => {
      e.preventDefault(); UI.clearErrors(mF);
      try {
        UI.require(mF, ['work', 'cost']);
        const cost = Number($('[data-field=cost] input', mF).value);
        if (!(cost >= 0) || !Number.isFinite(cost)) throw new AppError(tt('ค่าใช้จ่ายต้องเป็นตัวเลขไม่ติดลบ', 'Cost must be a non-negative number'), 'cost');
        j.logs.push({ at: Date.now(), by: App.user.id, work: $('[data-field=work] textarea', mF).value.trim(), parts: $('[data-field=parts] input', mF).value.trim() || '-', cost });
        if (j.status === 'assigned') j.status = 'in_progress';
        Store.save(); UI.toast(tt('บันทึกข้อมูลการบำรุงรักษาแล้ว', 'Maintenance record saved'), 'ok'); this.workForms(box, car, j);
      } catch (err) { UI.showError(mF, err); }
    };
  },

  /* ME-06 */
  costs(el) {
    const mine = Store.db.jobs.filter(j => j.assignedTo && mineOrAll(j));
    const rows = mine.flatMap(j => [...j.logs.map(l => ({ j, at: l.at, item: l.work, parts: l.parts, cost: l.cost, src: tt('ซ่อมภายใน', 'In-house') })), ...(j.shop ? [{ j, at: j.shop.at, item: j.shop.result, parts: '-', cost: j.shop.cost, src: tt('อู่ภายนอก', 'Repair shop') }] : [])]).sort((a, b) => b.at - a.at);
    const total = rows.reduce((s, r) => s + r.cost, 0);
    el.innerHTML = UI.pageHead('ค่าใช้จ่ายการบำรุงรักษา', 'Maintenance costs', 'ค่าใช้จ่ายจากงานที่คุณรับผิดชอบ', 'Costs from jobs you worked on', ['ME-06'], ['3.4'])
      + `<div class="grid g3" style="margin-bottom:16px"><div class="stat"><div class="label">${tt('ค่าใช้จ่ายรวม', 'Total cost')}</div><div class="value">${money(total)}</div></div><div class="stat"><div class="label">${tt('จำนวนงาน', 'Jobs')}</div><div class="value">${mine.length}</div></div><div class="stat"><div class="label">${tt('เฉลี่ยต่องาน', 'Average per job')}</div><div class="value">${money(mine.length ? total / mine.length : 0)}</div></div></div>
      <div class="card">${UI.table([{ h: tt('วันที่', 'Date'), v: r => fmtDT(r.at) }, { h: tt('งาน', 'Job'), v: r => `<span class="mono">${r.j.id}</span>` }, { h: tt('ทะเบียน', 'Plate'), v: r => `<span class="mono">${esc(r.j.plate)}</span>` }, { h: tt('รายการ', 'Item'), v: r => esc(r.item) }, { h: tt('แหล่ง', 'Source'), v: r => r.src }, { h: tt('ค่าใช้จ่าย', 'Cost'), cls: 'num', v: r => money(r.cost) }], rows)}</div>`;
  },

  /* ===== Mechanic Manager ===== */
  fleet(el) {
    const cars = Store.db.cars.map(c => ({ c, s: Logic.carStatus(c), u: Logic.utilisation(c.plate) }));
    const count = s => cars.filter(x => x.s === s).length;
    const repairJobs = Store.db.jobs.filter(j => j.status !== 'approved').length;
    el.innerHTML = UI.pageHead('สถานะรถทั้งหมด', 'Fleet status', 'สถานะรถทุกคัน จำนวนรถที่ซ่อม และอัตราการใช้งานรถแต่ละคัน (90 วัน)', 'Every car\'s status, cars in repair and per-car utilisation (90 days)', ['MM-02', 'MM-03'], ['3.5'])
      + `<div class="grid g4" style="margin-bottom:16px">
        <div class="stat"><div class="label">${tt('รถทั้งหมด', 'Total cars')}</div><div class="value">${cars.length}</div></div>
        <div class="stat"><div class="label">${tt('จำนวนรถที่ซ่อมทั้งหมด', 'Cars in repair')}</div><div class="value" style="color:var(--warn)">${count('maintenance')}</div><div class="sub">${repairJobs} ${tt('งานซ่อมที่เปิดอยู่', 'open repair jobs')}</div></div>
        <div class="stat"><div class="label">${tt('ถูกเช่า', 'Rented')}</div><div class="value">${count('rented')}</div></div>
        <div class="stat"><div class="label">${tt('ว่าง / ถูกจอง', 'Available / reserved')}</div><div class="value">${count('available')} / ${count('reserved')}</div></div></div>
      <div class="card">${UI.table([
        { h: tt('ทะเบียนรถ', 'Plate'), v: x => `<span class="mono">${esc(x.c.plate)}</span>` }, { h: tt('รถ', 'Car'), v: x => esc(carName(x.c)) }, { h: tt('สาขา', 'Branch'), v: x => esc(branchName(x.c.branch)) },
        { h: tt('เลขไมล์', 'Odometer'), cls: 'num', v: x => num(x.c.mileage) }, { h: tt('สถานะรถ', 'Status'), v: x => badge(x.s) },
        { h: tt('อัตราการใช้งาน', 'Utilisation'), v: x => `<div class="row" style="gap:8px;flex-wrap:nowrap"><div class="meter" style="flex:1"><span style="width:${Math.round(x.u * 100)}%"></span></div><span class="small mono">${Math.round(x.u * 100)}%</span></div>` },
      ], cars.sort((a, b) => b.u - a.u))}<div class="small muted" style="margin-top:8px">${tt('อัตราการใช้งาน = เวลาที่ถูกเช่าจริงใน 90 วันล่าสุด ÷ 90 วัน', 'Utilisation = time actually on rent in the last 90 days ÷ 90 days')}</div></div>`;
  },

  assign(el) {
    const open = Store.db.jobs.filter(j => j.status === 'unassigned');
    const mechs = Store.db.users.filter(u => u.role === 'mechanic' && u.status === 'active');
    const pre = App.params.plate || '';
    el.innerHTML = UI.pageHead('มอบหมายงานซ่อม', 'Assign repair jobs', 'มอบหมายงานให้ช่าง หรือส่งต่ออู่บำรุงรักษารถ', 'Assign work to a mechanic or send it to the repair shop', ['MM-06'], ['3.3'])
      + `<div class="grid g2"><div class="card"><h3 style="margin-bottom:12px">${tt('งานรอมอบหมาย', 'Waiting to be assigned')} (${open.length})</h3>
        ${open.length ? open.map(j => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="row" style="justify-content:space-between"><b class="mono">${j.id}</b>${badge(j.status)}</div><div class="small"><span class="mono">${esc(j.plate)}</span> · ${esc(j.damage)}</div><button class="btn btn-sm" style="margin-top:6px" data-use="${j.id}">${tt('มอบหมายงานนี้', 'Assign this')} →</button></div>`).join('') : `<div class="empty">${tt('ไม่มีงานค้าง', 'Nothing waiting')}</div>`}</div>
      <div class="card"><h3 style="margin-bottom:12px">${tt('มอบหมายงาน', 'Assign')}</h3><form id="f" class="form" novalidate><div class="form-alert"></div>
        <input type="hidden" id="jobId">
        ${UI.field('plate', 'ทะเบียนรถ', 'Plate', `<select><option value="">—</option>${Store.db.cars.map(c => `<option value="${esc(c.plate)}" ${c.plate === pre ? 'selected' : ''}>${esc(c.plate)} · ${esc(carName(c))} (${esc(tt(STATUS[Logic.carStatus(c)][0], STATUS[Logic.carStatus(c)][1]))})</option>`).join('')}</select>`, { req: true })}
        ${UI.field('mech', 'รหัสช่าง (ผู้รับผิดชอบ)', 'Mechanic', `<select><option value="">—</option>${mechs.map(u => `<option value="${u.id}">${esc(u.empId)} · ${esc(fullName(u))} (${Store.db.jobs.filter(j => j.assignedTo === u.id && !['approved'].includes(j.status)).length} ${tt('งานค้าง', 'open')})</option>`).join('')}</select>`, { req: true })}
        ${UI.field('damage', 'ข้อมูลความเสียหายของรถ / รายการซ่อม', 'Damage / repair items', `<textarea>${esc(App.params.damage || '')}</textarea>`, { req: true })}
        ${UI.field('mode', 'ซ่อมที่', 'Repair at', `<select><option value="inhouse">${tt('ซ่อมภายใน', 'In-house')}</option><option value="shop">${tt('ส่งอู่บำรุงรักษารถ (ภายนอก)', 'External repair shop')}</option></select>`)}
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary">${tt('มอบหมายงาน', 'Assign job')}</button></div></form></div></div>`;
    const f = $('#f', el);
    $$('[data-use]', el).forEach(b => b.onclick = () => { const j = Store.job(b.dataset.use); $('#jobId', f).value = j.id; $('[data-field=plate] select', f).value = j.plate; $('[data-field=damage] textarea', f).value = j.damage; $('[data-field=plate] select', f).disabled = true; });
    f.onsubmit = e => {
      e.preventDefault(); UI.clearErrors(f);
      try {
        UI.require(f, ['plate', 'mech', 'damage']);
        const plate = $('[data-field=plate] select', f).value, car = Store.car(plate), mech = $('[data-field=mech] select', f).value, mode = $('[data-field=mode] select', f).value;
        const existing = $('#jobId', f).value && Store.job($('#jobId', f).value);
        if (!existing && car.status === 'rented') throw new AppError(tt('รถคันนี้กำลังถูกเช่า มอบหมายงานได้หลังรับคืนรถ', 'This car is on rent — assign after it is returned'), 'plate');
        if (!existing && Store.db.jobs.some(j => j.plate === plate && !['approved'].includes(j.status))) throw new AppError(tt('รถคันนี้มีงานซ่อมที่ยังเปิดอยู่แล้ว', 'This car already has an open repair job'), 'plate');
        const job = existing || { id: Store.next('job', 'MT'), plate, bookingId: null, source: 'manager', inspection: null, logs: [], progress: [], shop: null };
        Object.assign(job, { damage: $('[data-field=damage] textarea', f).value.trim(), assignedTo: mech, assignedBy: App.user.id, assignedAt: Date.now(), mode, status: mode === 'shop' ? 'sent_to_shop' : 'assigned' });
        if (!existing) Store.db.jobs.push(job);
        car.status = 'maintenance';
        const clash = Store.db.rentals.filter(b => b.plate === plate && b.status === 'confirmed' && b.pickupAt - Date.now() < 3 * DAY);
        Store.save();
        UI.toast(mode === 'shop' ? tt(`ส่ง รหัสรถ ${plate} และรายการซ่อม ไปที่อู่บำรุงรักษารถแล้ว (${job.id})`, `Plate ${plate} and repair list sent to the repair shop (${job.id})`) : tt(`มอบหมายงาน ${job.id} แล้ว`, `Job ${job.id} assigned`), 'ok');
        if (clash.length) UI.toast(tt(`คำเตือน: มีการจองที่จะรับรถภายใน 3 วัน (${clash.map(b => b.id).join(', ')}) — แจ้งพนักงานออฟฟิศเปลี่ยนรถ`, `Warning: pick-up within 3 days (${clash.map(b => b.id).join(', ')}) — ask the office to swap cars`), 'warn');
        App.go('assign');
      } catch (err) { UI.showError(f, err); }
    };
  },

  approve(el) {
    const done = Store.db.jobs.filter(j => j.status === 'done');
    const inprog = Store.db.jobs.filter(j => ['assigned', 'in_progress', 'sent_to_shop'].includes(j.status));
    el.innerHTML = UI.pageHead('อนุมัติรถพร้อมใช้งาน', 'Approve cars as ready', 'ตรวจสอบผลซ่อมแล้วอนุมัติให้รถกลับมาให้เช่าได้', 'Review the repair, then release the car for rental', ['MM-07'], [])
      + `<h3 style="margin-bottom:10px">${tt('รออนุมัติ', 'Awaiting approval')} (${done.length})</h3>${done.length ? `<div class="grid g2">${done.map(j => this.jobCard(j, { manager: true })).join('')}</div>` : `<div class="card empty">${tt('ไม่มีงานรออนุมัติ', 'Nothing awaiting approval')}</div>`}
      <h3 style="margin:22px 0 10px">${tt('กำลังดำเนินการ', 'In progress')} (${inprog.length})</h3>${inprog.length ? `<div class="grid g2">${inprog.map(j => this.jobCard(j, { manager: true })).join('')}</div>` : `<div class="card empty">-</div>`}`;
    $$('[data-insp]', el).forEach(b => b.onclick = () => this.inspectionDetail(b.dataset.insp));
    done.forEach(j => {
      const box = $(`[data-actions="${j.id}"]`, el);
      box.innerHTML = `<button class="btn btn-sm btn-primary" data-ok>${tt('อนุมัติ รถพร้อมใช้งาน', 'Approve — ready')}</button><button class="btn btn-sm btn-danger" data-no>${tt('ส่งกลับแก้ไข', 'Send back')}</button>`;
      $('[data-ok]', box).onclick = async () => {
        const ok = await UI.confirm(tt('อนุมัติรถพร้อมใช้งาน?', 'Approve car as ready?'), `<p><span class="mono">${esc(j.plate)}</span> ${tt('จะกลับเป็นสถานะ "ว่าง" และรับจองได้ทันที', 'will become "Available" and bookable immediately')}.</p>${j.bookingId ? `<p class="small muted">${tt(`ค่าซ่อม ${money(Logic.jobCost(j))} จะหักจากเงินมัดจำของ ${j.bookingId}`, `Repair cost ${money(Logic.jobCost(j))} will be deducted from the deposit of ${j.bookingId}`)}</p>` : ''}`);
        if (!ok) return;
        try { Logic.approveJob(j.id, App.user.id); UI.toast(tt(`อนุมัติแล้ว ${j.plate} พร้อมใช้งาน`, `Approved — ${j.plate} is ready`), 'ok'); App.render(); } catch (err) { UI.toast(err.message, 'err'); }
      };
      $('[data-no]', box).onclick = () => {
        const m = UI.modal(`<div class="modal-head"><h3>${tt('ส่งกลับให้ช่างแก้ไข', 'Send back to mechanic')}</h3><button class="x-btn" data-close>×</button></div><div class="modal-body"><form id="f" class="form" novalidate>${UI.field('note', 'เหตุผล', 'Reason', '<textarea></textarea>', { req: true })}</form></div><div class="modal-foot"><button class="btn" data-close>${tt('ยกเลิก', 'Cancel')}</button><button class="btn btn-danger" data-go>${tt('ส่งกลับ', 'Send back')}</button></div>`);
        $('[data-go]', m.el).onclick = () => { const f = $('#f', m.el); UI.clearErrors(f); try { UI.require(f, ['note']); j.status = 'in_progress'; j.progress.push({ at: Date.now(), status: 'in_progress', note: tt('หัวหน้าช่างส่งกลับ: ', 'Sent back: ') + $('textarea', f).value.trim(), by: App.user.id }); Store.save(); m.close(true); App.render(); } catch (err) { UI.showError(f, err); } };
      };
    });
  },

  history(el) {
    const plate = App.params.plate || '';
    const rows = Store.db.jobs.filter(j => j.status === 'approved' && (!plate || j.plate === plate)).sort((a, b) => b.approvedAt - a.approvedAt);
    el.innerHTML = UI.pageHead('ประวัติการซ่อมแซมรถ', 'Repair history', 'ตรวจสอบและจัดการประวัติการซ่อมของรถแต่ละคัน', 'Review and manage each car\'s repair history', ['MM-08'], ['3.5'])
      + `<div class="card"><div class="card-head"><select id="pl" style="width:auto"><option value="">${tt('ทุกคัน', 'All cars')}</option>${Store.db.cars.map(c => `<option value="${esc(c.plate)}" ${c.plate === plate ? 'selected' : ''}>${esc(c.plate)} · ${esc(carName(c))}</option>`).join('')}</select>
        <span class="small muted">${rows.length} ${tt('รายการ', 'records')} · ${tt('รวม', 'total')} ${money(rows.reduce((s, j) => s + Logic.jobCost(j), 0))}</span></div>
        ${UI.table([{ h: tt('วันที่ปิดงาน', 'Closed'), v: j => fmtD(j.approvedAt) }, { h: tt('งาน', 'Job'), v: j => `<span class="mono">${j.id}</span>` }, { h: tt('ทะเบียน', 'Plate'), v: j => `<span class="mono">${esc(j.plate)}</span>` }, { h: tt('รายการซ่อม', 'Repair'), v: j => esc(j.damage) }, { h: tt('ช่าง', 'Mechanic'), v: j => esc(fullName(Store.user(j.assignedTo))) }, { h: tt('ซ่อมที่', 'Where'), v: j => j.mode === 'shop' ? tt('อู่', 'Shop') : tt('ภายใน', 'In-house') }, { h: tt('ค่าซ่อม', 'Cost'), cls: 'num', v: j => money(Logic.jobCost(j)) }, { h: '', cls: 'right nowrap', v: j => `<button class="btn btn-sm" data-e="${j.id}">${tt('แก้ไข', 'Edit')}</button> <button class="btn btn-sm btn-danger" data-x="${j.id}">${tt('ลบ', 'Delete')}</button>` }], rows, 'ไม่มีประวัติการซ่อม', 'No repair history')}</div>`;
    $('#pl', el).onchange = e => App.go('history', { plate: e.target.value });
    $$('[data-x]', el).forEach(b => b.onclick = async () => { if (await UI.confirm(tt('ลบประวัติการซ่อม?', 'Delete repair record?'), `<p class="mono">${b.dataset.x}</p><p class="muted small">${tt('ลบแล้วกู้คืนไม่ได้', 'This cannot be undone')}</p>`, { danger: true, okText: tt('ลบ', 'Delete') })) { Store.db.jobs = Store.db.jobs.filter(j => j.id !== b.dataset.x); Store.save(); App.render(); } });
    $$('[data-e]', el).forEach(b => b.onclick = () => {
      const j = Store.job(b.dataset.e);
      const m = UI.modal(`<div class="modal-head"><h3>${tt('แก้ไขประวัติการซ่อม', 'Edit repair record')} <span class="mono">${j.id}</span></h3><button class="x-btn" data-close>×</button></div><div class="modal-body"><form id="f" class="form" novalidate><div class="form-alert"></div>
        ${UI.field('damage', 'รายการซ่อม', 'Repair', `<textarea>${esc(j.damage)}</textarea>`, { req: true })}
        ${j.logs.map((l, i) => UI.field('cost' + i, `ค่าใช้จ่าย: ${l.work}`, `Cost: ${l.work}`, `<input type="number" min="0" value="${l.cost}">`, { req: true })).join('')}
        ${j.shop ? UI.field('shop', 'ค่าซ่อมจากอู่', 'Shop cost', `<input type="number" min="0" value="${j.shop.cost}">`, { req: true }) : ''}</form></div>
        <div class="modal-foot"><button class="btn" data-close>${tt('ยกเลิก', 'Cancel')}</button><button class="btn btn-primary" data-save>${tt('บันทึก', 'Save')}</button></div>`);
      $('[data-save]', m.el).onclick = () => {
        const f = $('#f', m.el); UI.clearErrors(f);
        try {
          UI.require(f, ['damage']);
          const vals = j.logs.map((_, i) => { const v = Number($(`[data-field=cost${i}] input`, f).value); if (!(v >= 0) || $(`[data-field=cost${i}] input`, f).value === '') throw new AppError(tt('ค่าใช้จ่ายต้องเป็นตัวเลขไม่ติดลบ', 'Cost must be a non-negative number'), 'cost' + i); return v; });
          let sv; if (j.shop) { sv = Number($('[data-field=shop] input', f).value); if (!(sv >= 0)) throw new AppError(tt('ค่าใช้จ่ายต้องเป็นตัวเลขไม่ติดลบ', 'Cost must be a non-negative number'), 'shop'); }
          j.damage = $('[data-field=damage] textarea', f).value.trim(); vals.forEach((v, i) => j.logs[i].cost = v); if (j.shop) j.shop.cost = sv;
          Store.save(); m.close(true); UI.toast(tt('บันทึกแล้ว', 'Saved'), 'ok'); App.render();
        } catch (err) { UI.showError(f, err); }
      };
    });
  },

  /* MM-04 */
  repairCosts(el) {
    const jobs = Store.db.jobs;
    const total = jobs.reduce((s, j) => s + Logic.jobCost(j), 0);
    const byCar = Store.db.cars.map(c => ({ label: `${c.plate}`, value: jobs.filter(j => j.plate === c.plate).reduce((s, j) => s + Logic.jobCost(j), 0) })).filter(x => x.value).sort((a, b) => b.value - a.value);
    const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); const m = d.getMonth(), y = d.getFullYear(); return { label: `${pad(m + 1)}/${String(y).slice(2)}`, value: jobs.filter(j => { const t = new Date(j.approvedAt || j.assignedAt || 0); return t.getMonth() === m && t.getFullYear() === y; }).reduce((s, j) => s + Logic.jobCost(j), 0) }; });
    const shop = jobs.filter(j => j.shop).reduce((s, j) => s + (+j.shop.cost || 0), 0);
    el.innerHTML = UI.pageHead('ค่าใช้จ่ายด้านการซ่อมทั้งหมด', 'Total repair costs', 'สรุปค่าซ่อมทั้งหมด แยกตามรถและตามเดือน', 'All repair spend, by car and by month', ['MM-04'], [])
      + `<div class="grid g3" style="margin-bottom:16px"><div class="stat"><div class="label">${tt('ค่าใช้จ่ายการซ่อมรวม', 'Total repair cost')}</div><div class="value">${money(total)}</div></div><div class="stat"><div class="label">${tt('ซ่อมภายใน', 'In-house')}</div><div class="value">${money(total - shop)}</div></div><div class="stat"><div class="label">${tt('อู่ภายนอก', 'External shop')}</div><div class="value">${money(shop)}</div></div></div>
      <div class="grid g2"><div class="card"><h3 style="margin-bottom:8px">${tt('ตามเดือน (6 เดือน)', 'By month (6 months)')}</h3>${UI.bars(months)}</div><div class="card"><h3 style="margin-bottom:10px">${tt('ตามรถ', 'By car')}</h3>${UI.hbars(byCar)}</div></div>`;
  },

  /* MM-05 */
  schedule(el) {
    const rows = Store.db.cars.map(c => ({ c, s: Logic.schedule(c) }));
    const worst = x => ['overdue', 'soon', 'ok'].indexOf([x.s.timeStatus, x.s.kmStatus, x.s.annualStatus].sort((a, b) => ['overdue', 'soon', 'ok'].indexOf(a) - ['overdue', 'soon', 'ok'].indexOf(b))[0]);
    rows.sort((a, b) => worst(a) - worst(b));
    el.innerHTML = UI.pageHead('ตารางการบำรุงรักษารถ', 'Maintenance schedule', `เช็คระยะทุก ${POLICY.serviceMonths} เดือน หรือ ${num(POLICY.serviceKm)} กม. (แล้วแต่อย่างใดถึงก่อน) และตรวจสภาพประจำปี`, `Service every ${POLICY.serviceMonths} months or ${num(POLICY.serviceKm)} km (whichever first) plus annual inspection`, ['MM-05'], [])
      + `<div class="card">${UI.table([
        { h: tt('ทะเบียน', 'Plate'), v: x => `<span class="mono">${esc(x.c.plate)}</span><div class="small muted">${esc(carName(x.c))}</div>` },
        { h: tt('เช็คล่าสุด', 'Last service'), v: x => `${fmtD(x.c.lastService)}<div class="small muted">${num(x.c.lastServiceKm)} km</div>` },
        { h: tt('ตามระยะเวลา', 'By time'), v: x => `${fmtD(x.s.byTime)} ${badge(x.s.timeStatus)}` },
        { h: tt('ตามระยะทาง', 'By distance'), v: x => `${num(x.s.byKm)} km ${badge(x.s.kmStatus)}<div class="small muted">${x.s.kmLeft >= 0 ? tt(`เหลือ ${num(x.s.kmLeft)} กม.`, `${num(x.s.kmLeft)} km left`) : tt(`เกิน ${num(-x.s.kmLeft)} กม.`, `${num(-x.s.kmLeft)} km over`)}</div>` },
        { h: tt('ตรวจสภาพรายปี', 'Annual inspection'), v: x => `${fmtD(x.s.annual)} ${badge(x.s.annualStatus)}` },
        { h: '', cls: 'right', v: x => [x.s.timeStatus, x.s.kmStatus, x.s.annualStatus].some(s => s !== 'ok') ? `<button class="btn btn-sm" data-mk="${esc(x.c.plate)}">${tt('สร้างงาน', 'Create job')}</button>` : '' },
      ], rows)}</div>`;
    $$('[data-mk]', el).forEach(b => b.onclick = () => App.go('assign', { plate: b.dataset.mk, damage: tt('บำรุงรักษาตามกำหนด (เช็คระยะ / ตรวจสภาพประจำปี)', 'Scheduled maintenance (service / annual inspection)') }));
  },
};

Roles.mechanic = {
  nav: [['jobs', 'งานที่ได้รับมอบหมาย', 'Assigned jobs', 'list'], ['record', 'บันทึกข้อมูลการจัดการรถ', 'Record car work', 'wrench'], ['costs', 'ค่าใช้จ่ายการบำรุงรักษา', 'Maintenance costs', 'coin']],
  badge: { jobs: () => Store.db.jobs.filter(j => j.assignedTo && mineOrAll(j) && ['assigned', 'sent_to_shop', 'in_progress'].includes(j.status)).length },
  views: { jobs: el => MechViews.jobs(el), record: el => MechViews.record(el), costs: el => MechViews.costs(el) },
};
Roles.mechanic_manager = {
  nav: [['fleet', 'สถานะรถทั้งหมด', 'Fleet status', 'car'], ['assign', 'มอบหมายงาน', 'Assign jobs', 'users'], ['approve', 'อนุมัติรถพร้อมใช้', 'Approve ready', 'check'], ['history', 'ประวัติการซ่อม', 'Repair history', 'list'], ['rcosts', 'ค่าใช้จ่ายการซ่อม', 'Repair costs', 'coin'], ['schedule', 'ตารางบำรุงรักษา', 'Maintenance schedule', 'calendar']],
  badge: { assign: () => Store.db.jobs.filter(j => j.status === 'unassigned').length, approve: () => Store.db.jobs.filter(j => j.status === 'done').length },
  views: { fleet: el => MechViews.fleet(el), assign: el => MechViews.assign(el), approve: el => MechViews.approve(el), history: el => MechViews.history(el), rcosts: el => MechViews.repairCosts(el), schedule: el => MechViews.schedule(el) },
};
