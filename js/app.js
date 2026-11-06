/* ===== App shell: routing, login (D1 ผู้ใช้), register, role navigation ===== */
const ICONS = {
  car: '<path d="M5 17h14M6 17l1-6 2-3h6l2 3 1 6"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>', return: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 9M22 21a7 7 0 0 0-4-6.3"/>', tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.3 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
  check: '<path d="m5 12 5 5L20 7"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>', gauge: '<path d="M12 14 16 9M3.3 17a9 9 0 1 1 17.4 0"/>', file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14h6M9 18h6"/>',
  logo: '<path d="M5 17h14M6 17l1-6 2-3h6l2 3 1 6"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

const DEMO = [['somchai', 'customer'], ['office1', 'office_employee'], ['manager1', 'office_manager'], ['mech1', 'mechanic'], ['mechlead', 'mechanic_manager'], ['ceo', 'big_manager']];
const SESSION_KEY = 'crms_session';

/* Everyone uses the customer app. Staff get extra "areas" from the top-right menu;
   higher roles inherit the areas of the roles below them, and the CEO gets all of them. */
const AREAS = {
  customer: ['หน้าลูกค้า (เช่ารถ)', 'Customer app', 'car'],
  big_manager: ['ภาพรวมบริษัท', 'Company overview', 'chart'],
  office_employee: ['งานออฟฟิศ', 'Office work', 'list'],
  office_manager: ['จัดการออฟฟิศ', 'Office management', 'users'],
  mechanic: ['งานช่าง', 'Mechanic work', 'wrench'],
  mechanic_manager: ['จัดการงานซ่อม', 'Repair management', 'check'],
};
const ACCESS = {
  customer: ['customer'],
  office_employee: ['customer', 'office_employee'],
  office_manager: ['customer', 'office_employee', 'office_manager'],
  mechanic: ['customer', 'mechanic'],
  mechanic_manager: ['customer', 'mechanic', 'mechanic_manager'],
  big_manager: ['customer', 'big_manager', 'office_employee', 'office_manager', 'mechanic', 'mechanic_manager'],
};
const areaName = a => tt(AREAS[a][0], AREAS[a][1]);

const App = {
  user: null, area: 'customer', view: null, params: {}, screen: 'login', loginFails: {},
  init() {
    Store.load();
    document.documentElement.lang = I18N.lang;
    let s = null; try { s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { }
    if (s && Store.user(s.id) && Store.user(s.id).status === 'active') {
      this.user = Store.user(s.id); this.screen = 'app';
      this.area = this.canUse(s.area) ? s.area : 'customer';
      this.view = s.view || Roles[this.area].nav[0][0];
    }
    this.render();
  },
  canUse(area) { return !!(this.user && area && (ACCESS[this.user.role] || []).includes(area)); },
  staffAreas() { return this.user ? (ACCESS[this.user.role] || []).filter(a => a !== 'customer') : []; },
  saveSession() { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: this.user.id, area: this.area, view: this.view })); } catch (e) { } },
  go(view, params = {}) { this.view = view; this.params = params; this.saveSession(); this.render(); window.scrollTo(0, 0); },
  enter(area, view, params = {}) {
    if (!this.canUse(area)) { UI.toast(tt('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้', 'You do not have access to this area'), 'err'); return; }
    this.area = area; this.screen = 'app';
    if (area === 'customer' && !view) CustomerViews.resetWiz();
    this.go(view || Roles[area].nav[0][0], params);
  },
  home() {
    if (this.user) this.enter('customer');
    else { this.screen = 'login'; this.render(); window.scrollTo(0, 0); }
  },
  logout() { this.user = null; this.area = 'customer'; this.screen = 'login'; try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { } CustomerViews.wiz = null; this.render(); },
  async resetData() {
    if (!(await UI.confirm(tt('รีเซ็ตข้อมูลตัวอย่าง?', 'Reset demo data?'), `<p>${tt('ข้อมูลทั้งหมดที่สร้างหรือแก้ไขจะถูกลบ และโหลดข้อมูลตัวอย่างชุดเดิมกลับมา', 'Everything you created or changed is wiped and the original demo data is reloaded.')}</p>`, { danger: true, okText: tt('รีเซ็ต', 'Reset') }))) return;
    Store.reset(); CustomerViews.wiz = null;
    if (this.user) this.user = Store.db.users.find(u => u.username === this.user.username) || null;
    if (!this.user) this.screen = this.screen === 'app' ? 'login' : this.screen;
    UI.toast(tt('รีเซ็ตข้อมูลแล้ว', 'Demo data reset'), 'ok'); this.render();
  },

  tools() {
    return `<div class="seg" title="Language"><button class="${I18N.lang === 'th' ? 'on' : ''}" data-lang="th">TH</button><button class="${I18N.lang === 'en' ? 'on' : ''}" data-lang="en">EN</button></div>
      <button class="btn btn-sm btn-ghost" data-frmap>${tt('แผนผัง FR', 'FR map')}</button>
      <button class="btn btn-sm btn-ghost" data-reset>${tt('รีเซ็ตข้อมูล', 'Reset data')}</button>`;
  },
  bindTools(root) {
    $$('[data-lang]', root).forEach(b => b.onclick = () => setLang(b.dataset.lang));
    $$('[data-home]', root).forEach(b => { b.onclick = () => this.home(); b.onkeydown = e => { if (e.key === 'Enter') this.home(); }; });
    $$('[data-reset]', root).forEach(b => b.onclick = () => this.resetData());
    $$('[data-frmap]', root).forEach(b => b.onclick = () => { this.prevScreen = this.screen; this.screen = 'frmap'; this.render(); window.scrollTo(0, 0); });
  },

  render() {
    const root = $('#app');
    document.title = tt('ระบบบริหารจัดการบริษัทให้เช่ารถ', 'Car Rental Management System');
    if (this.screen === 'app' && this.user) return this.renderApp(root);
    if (this.screen === 'frmap') {
      root.innerHTML = `<header class="topbar"><div class="brand" data-home role="button" tabindex="0" title="หน้าแรก / Home" style="cursor:pointer"><span class="brand-mark">${icon('logo')}</span>${tt('ระบบบริหารจัดการบริษัทให้เช่ารถ', 'Car Rental Management System')}</div><div class="spacer"></div>${this.tools()}<button class="btn btn-sm" data-back>← ${tt('กลับ', 'Back')}</button></header><main class="main" style="max-width:1200px;margin:0 auto" id="main"></main>`;
      this.bindTools(root);
      $('[data-back]', root).onclick = () => { this.screen = this.prevScreen === 'app' && this.user ? 'app' : 'login'; this.render(); };
      FrMap.render($('#main', root));
      return;
    }
    if (this.screen === 'register') return this.renderRegister(root);
    return this.renderLogin(root);
  },

  /* top-right menu: only for accounts with staff rights */
  staffMenu() {
    const areas = this.staffAreas();
    if (!areas.length) return '';
    const inStaff = this.area !== 'customer';
    return `<div class="dropdown"><button class="btn btn-sm ${inStaff ? 'btn-primary' : ''}" data-staffmenu aria-haspopup="true" aria-expanded="false">${icon('users')}<span>${inStaff ? esc(areaName(this.area)) : tt('พื้นที่พนักงาน', 'Staff area')}</span> ▾</button>
      <div class="dropdown-pop hidden" role="menu">
        <div class="dropdown-label">${tt('พื้นที่พนักงาน', 'Staff area')}</div>
        ${areas.map(a => `<button class="dropdown-item ${this.area === a ? 'on' : ''}" role="menuitem" data-area="${a}">${icon(AREAS[a][2])}<span>${esc(areaName(a))}</span></button>`).join('')}
        <div class="dropdown-sep"></div>
        <button class="dropdown-item ${this.area === 'customer' ? 'on' : ''}" role="menuitem" data-area="customer">${icon('car')}<span>${esc(areaName('customer'))}</span></button>
      </div></div>`;
  },
  bindStaffMenu(root) {
    const btn = $('[data-staffmenu]', root); if (!btn) return;
    const pop = btn.nextElementSibling;
    const close = () => { pop.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); };
    btn.onclick = e => {
      e.stopPropagation(); const open = pop.classList.toggle('hidden') === false; btn.setAttribute('aria-expanded', String(open));
      if (!open) return;
      // right-aligned by default; flip to left-aligned if that would spill off-screen (narrow, wrapped top bar)
      pop.style.left = ''; pop.style.right = '';
      if (pop.getBoundingClientRect().left < 8) { pop.style.right = 'auto'; pop.style.left = '0'; }
    };
    $$('[data-area]', pop).forEach(b => b.onclick = () => { close(); this.enter(b.dataset.area); });
    if (this._outside) document.removeEventListener('click', this._outside);
    this._outside = e => { if (!pop.contains(e.target) && e.target !== btn) close(); };
    document.addEventListener('click', this._outside);
    pop.onkeydown = e => { if (e.key === 'Escape') { close(); btn.focus(); } };
  },

  renderApp(root) {
    if (!this.canUse(this.area)) this.area = 'customer';
    const role = Roles[this.area];
    if (!role.views[this.view]) this.view = role.nav[0][0];
    const inStaff = this.area !== 'customer';
    root.innerHTML = `<header class="topbar"><div class="brand" data-home role="button" tabindex="0" title="หน้าแรก / Home" style="cursor:pointer"><span class="brand-mark">${icon('logo')}</span><span>${tt('ระบบบริหารจัดการบริษัทให้เช่ารถ', 'Car Rental Management System')}</span></div>
      <span class="role-pill">${esc(roleName(this.user.role))}</span><div class="spacer"></div>${this.tools()}
      ${this.staffMenu()}
      <span class="user-name">${esc(fullName(this.user))}</span><button class="btn btn-sm" data-logout>${tt('ออกจากระบบ', 'Sign out')}</button></header>
      <div class="layout"><nav class="sidebar"><div class="nav-label">${inStaff ? esc(areaName(this.area)) : tt('เมนู', 'Menu')}</div>
        ${role.nav.map(([id, th, en, ic]) => { const n = role.badge && role.badge[id] ? role.badge[id]() : 0; return `<button class="nav-item ${this.view === id ? 'active' : ''}" data-nav="${id}">${icon(ic)}<span>${esc(tt(th, en))}</span>${n ? `<span class="nav-badge">${n}</span>` : ''}</button>`; }).join('')}
      </nav><main class="main" id="main"></main></div>`;
    this.bindTools(root);
    this.bindStaffMenu(root);
    $('[data-logout]', root).onclick = () => this.logout();
    $$('[data-nav]', root).forEach(b => b.onclick = () => { if (this.area === 'customer' && b.dataset.nav === 'rent' && CustomerViews.wiz && CustomerViews.wiz.step === 4) CustomerViews.resetWiz(); this.go(b.dataset.nav); });
    this.syncTopbar();
    try { role.views[this.view]($('#main', root)); }
    catch (err) { console.error(err); $('#main', root).innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`; }
  },

  /* keep the sticky menu exactly under the (sometimes wrapping) top bar */
  syncTopbar() {
    const tb = $('.topbar'); if (!tb) return;
    document.documentElement.style.setProperty('--tb', tb.getBoundingClientRect().height + 'px');
    if (!this._tbWatch) { this._tbWatch = true; window.addEventListener('resize', () => this.syncTopbar()); }
  },

  renderLogin(root) {
    root.innerHTML = `<div class="login-wrap"><aside class="login-side">
        <div class="brand" data-home role="button" tabindex="0" title="หน้าแรก / Home" style="cursor:pointer"><span class="brand-mark">${icon('logo')}</span>${tt('ระบบบริหารจัดการบริษัทให้เช่ารถ', 'Car Rental Management System')}</div>
        <div><h1>${tt('ต้นแบบระบบให้เช่ารถ', 'Car rental system prototype')}</h1><p style="margin-top:8px;max-width:440px">${tt('ITDS262 Software Engineering Lab · Topic 4 · Section 1 Group 6 — ต้นแบบที่ใช้งานได้จริง ครอบคลุม FR ทั้ง 52 ข้อ ข้อมูลเก็บในเบราว์เซอร์ (localStorage)', 'ITDS262 Software Engineering Lab · Topic 4 · Section 1 Group 6 — a working prototype covering all 52 FRs. Data is stored in the browser (localStorage).')}</p></div>
        <div><div style="font-weight:600;margin-bottom:8px;color:#fff">${tt('บัญชีทดลอง (คลิกเพื่อกรอก) · รหัสผ่าน pass1234', 'Demo accounts (click to fill) · password pass1234')}</div>
          <div class="demo-list">${DEMO.map(([u, r]) => `<button class="demo" data-demo="${u}"><span>${esc(roleName(r))}</span><small>${u}</small></button>`).join('')}</div>
          <p class="small" style="margin-top:10px;color:#d7dfdc">${tt('บัญชี office9 ถูกระงับ ใช้ทดสอบกรณีเข้าสู่ระบบไม่ได้', 'office9 is deactivated, for testing a blocked sign-in')}</p></div>
      </aside><main class="login-main"><div class="login-box">
        <div class="login-tools">${this.tools()}</div>
        <h2>${tt('เข้าสู่ระบบ', 'Sign in')}</h2><p class="muted" style="margin:4px 0 20px">${tt('ผู้เช่ารถและพนักงานใช้หน้าเดียวกัน ระบบจะพาไปหน้าตามสิทธิ์ของบัญชี', 'Renters and staff share this page; you are routed by account role.')}</p>
        <form id="f" class="form" novalidate><div class="form-alert"></div>
          ${UI.field('username', 'Username', 'Username', '<input autocomplete="username" autocapitalize="off">', { req: true })}
          ${UI.field('password', 'Password', 'Password', '<input type="password" autocomplete="current-password">', { req: true })}
          <button class="btn btn-primary btn-block">${tt('เข้าสู่ระบบ', 'Sign in')}</button>
        </form>
        <p class="center" style="margin-top:18px">${tt('ยังไม่มีบัญชี?', 'No account yet?')} <button class="link-btn" data-reg>${tt('สมัครสมาชิกผู้เช่ารถ', 'Register as a renter')}</button></p>
      </div></main></div>`;
    this.bindTools(root);
    const f = $('#f', root);
    $$('[data-demo]', root).forEach(b => b.onclick = () => { $('[data-field=username] input', f).value = b.dataset.demo; $('[data-field=password] input', f).value = 'pass1234'; $('[data-field=password] input', f).focus(); });
    $('[data-reg]', root).onclick = () => { this.screen = 'register'; this.render(); };
    f.onsubmit = e => {
      e.preventDefault(); UI.clearErrors(f);
      try {
        UI.require(f, ['username', 'password']);
        const un = $('[data-field=username] input', f).value.trim(), pw = $('[data-field=password] input', f).value;
        const lock = this.loginFails[un];
        if (lock && lock.until > Date.now()) throw new AppError(tt(`ใส่รหัสผ่านผิดเกิน ${POLICY.maxLoginFails} ครั้ง บัญชีถูกล็อกชั่วคราว ลองใหม่ใน ${Math.ceil((lock.until - Date.now()) / 1000)} วินาที`, `Too many failed attempts. Try again in ${Math.ceil((lock.until - Date.now()) / 1000)} seconds.`));
        const u = Store.db.users.find(x => x.username === un);
        if (!u || u.password !== pw) {
          const l = this.loginFails[un] = this.loginFails[un] || { n: 0, until: 0 }; l.n++;
          if (l.n >= POLICY.maxLoginFails) { l.until = Date.now() + POLICY.lockSeconds * 1000; l.n = 0; }
          throw new AppError(tt('Username หรือ Password ไม่ถูกต้อง', 'Incorrect username or password'));
        }
        if (u.status !== 'active') throw new AppError(tt('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้จัดการออฟฟิศ', 'This account is deactivated. Please contact the Office Manager.'));
        delete this.loginFails[un];
        this.user = u; this.screen = 'app'; this.area = 'customer'; CustomerViews.resetWiz(); this.view = Roles.customer.nav[0][0]; this.params = {}; this.saveSession();
        UI.toast(tt(`ยินดีต้อนรับ คุณ${u.firstName}`, `Welcome, ${u.firstName}`), 'ok');
        this.render();
      } catch (err) { UI.showError(f, err); }
    };
  },

  renderRegister(root) {
    root.innerHTML = `<header class="topbar"><div class="brand" data-home role="button" tabindex="0" title="หน้าแรก / Home" style="cursor:pointer"><span class="brand-mark">${icon('logo')}</span>${tt('ระบบบริหารจัดการบริษัทให้เช่ารถ', 'Car Rental Management System')}</div><div class="spacer"></div>${this.tools()}</header>
      <main class="main" style="max-width:760px;margin:0 auto">${UI.pageHead('สมัครสมาชิกผู้เช่ารถ', 'Register as a renter', 'ข้อมูลนี้ใช้ในสัญญาเช่ารถ กรุณากรอกให้ตรงกับบัตรประชาชนและใบขับขี่', 'Used on your rental contract — must match your ID card and licence', ['C-01'], ['1.1'])}
      <div class="card"><form id="f" class="form" novalidate><div class="form-alert"></div><div class="fields">
        ${UI.field('first', 'ชื่อ', 'First name', '<input autocomplete="given-name">', { req: true })}${UI.field('last', 'นามสกุล', 'Last name', '<input autocomplete="family-name">', { req: true })}
        ${UI.field('nid', 'เลขบัตรประชาชน', 'National ID number', '<input inputmode="numeric" maxlength="13">', { req: true, hint: tt('13 หลัก ระบบตรวจ checksum · ตัวอย่างที่ถูกต้อง 1103700012346', '13 digits, checksum validated · valid example 1103700012346') })}
        ${UI.field('license', 'เลขใบขับขี่', 'Driving licence no.', '<input>', { req: true })}
        ${UI.field('phone', 'เบอร์โทร', 'Phone', '<input inputmode="tel" maxlength="10" placeholder="08xxxxxxxx">', { req: true })}
        ${UI.field('email', 'อีเมล', 'Email', '<input type="email" autocomplete="email">', { req: true })}
        ${UI.field('username', 'Username', 'Username', '<input autocapitalize="off" autocomplete="username">', { req: true, hint: tt('a–z, 0–9 อย่างน้อย 4 ตัว', 'a–z, 0–9, at least 4 characters') })}
        ${UI.field('password', 'Password', 'Password', '<input type="password" autocomplete="new-password">', { req: true, hint: tt('อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข', 'At least 8 characters with letters and digits') })}
        ${UI.field('confirm', 'ยืนยัน Password', 'Confirm password', '<input type="password" autocomplete="new-password">', { req: true })}
        </div><div class="field" data-field="pdpa"><label class="check"><input type="checkbox"> ${tt('ยินยอมให้เก็บข้อมูลส่วนบุคคลเพื่อใช้ในการเช่ารถ (PDPA)', 'I consent to my personal data being stored for car rental (PDPA)')}</label><span class="err"></span></div>
        <div class="row" style="justify-content:space-between"><button type="button" class="btn" data-back>← ${tt('กลับไปหน้าเข้าสู่ระบบ', 'Back to sign in')}</button><button class="btn btn-primary">${tt('สร้างบัญชี', 'Create account')}</button></div></form></div></main>`;
    this.bindTools(root);
    $('[data-back]', root).onclick = () => { this.screen = 'login'; this.render(); };
    const f = $('#f', root), v = n => $(`[data-field=${n}] input`, f).value.trim();
    f.onsubmit = e => {
      e.preventDefault(); UI.clearErrors(f);
      try {
        UI.require(f, ['first', 'last', 'nid', 'license', 'phone', 'email', 'username', 'password', 'confirm']);
        if (!validThaiId(v('nid'))) throw new AppError(tt('เลขบัตรประชาชนไม่ถูกต้อง (ต้องเป็น 13 หลักและผ่าน checksum)', 'Invalid national ID (13 digits with valid checksum)'), 'nid');
        if (Store.db.users.some(u => u.role === 'customer' && u.nationalId === v('nid') && u.username)) throw new AppError(tt('เลขบัตรประชาชนนี้มีบัญชีอยู่แล้ว', 'An account already exists for this ID'), 'nid');
        if (!/^0\d{9}$/.test(v('phone'))) throw new AppError(tt('เบอร์โทรต้องเป็นตัวเลข 10 หลักขึ้นต้นด้วย 0', 'Phone must be 10 digits starting with 0'), 'phone');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) throw new AppError(tt('รูปแบบอีเมลไม่ถูกต้อง', 'Invalid email format'), 'email');
        if (!/^[a-z0-9_.]{4,}$/i.test(v('username'))) throw new AppError(tt('Username ต้องเป็น a–z, 0–9 อย่างน้อย 4 ตัว', 'Username must be a–z, 0–9, at least 4 characters'), 'username');
        if (Store.db.users.some(u => u.username && u.username.toLowerCase() === v('username').toLowerCase())) throw new AppError(tt('Username นี้ถูกใช้แล้ว', 'Username already taken'), 'username');
        const pw = $('[data-field=password] input', f).value;
        if (pw.length < 8 || !/[a-z]/i.test(pw) || !/\d/.test(pw)) throw new AppError(tt('Password ต้องมีอย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข', 'Password needs 8+ characters with letters and digits'), 'password');
        if (pw !== $('[data-field=confirm] input', f).value) throw new AppError(tt('Password ไม่ตรงกัน', 'Passwords do not match'), 'confirm');
        if (!$('[data-field=pdpa] input', f).checked) throw new AppError(tt('กรุณายินยอมการเก็บข้อมูลส่วนบุคคล', 'Please give consent to continue'), 'pdpa');
        const walk = Store.db.users.find(u => u.role === 'customer' && u.nationalId === v('nid') && !u.username);
        const u = walk || { id: Store.next('user', 'U'), role: 'customer', status: 'active', createdAt: Date.now() };
        Object.assign(u, { firstName: v('first'), lastName: v('last'), nationalId: v('nid'), license: v('license'), phone: v('phone'), email: v('email'), username: v('username'), password: pw, walkIn: false });
        if (!walk) Store.db.users.push(u);
        Logic.mail(u.id, tt('ยินดีต้อนรับสู่ระบบเช่ารถ', 'Welcome to the car rental system'), tt('สร้างบัญชีผู้ใช้เรียบร้อยแล้ว คุณสามารถค้นหาและจองรถได้ทันที', 'Your account is ready. You can search and book cars now.'));
        Store.save();
        UI.toast(tt('สร้างบัญชีสำเร็จ กรุณาเข้าสู่ระบบ', 'Account created — please sign in'), 'ok');
        this.screen = 'login'; this.render();
        $('[data-field=username] input').value = u.username;
      } catch (err) { UI.showError(f, err); }
    };
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
