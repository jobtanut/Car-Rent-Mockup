/* =========================================================
   Car Rental Management System — mock-up prototype
   core.js : i18n, utilities, data store (D1–D6), seed data,
             business rules, shared UI (modal, toast, payment)
   ========================================================= */

/* ---------- i18n ---------- */
const I18N = { lang: (() => { try { return localStorage.getItem('crms_lang') || 'th'; } catch (e) { return 'th'; } })() };
function tt(th, en) { return I18N.lang === 'en' ? (en ?? th) : th; }
function setLang(l) {
  I18N.lang = l;
  try { localStorage.setItem('crms_lang', l); } catch (e) { }
  document.documentElement.lang = l;
  App.render();
}

/* ---------- utilities ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function money(n) { return '฿' + Math.round(n || 0).toLocaleString('en-US'); }
function num(n) { return Math.round(n || 0).toLocaleString('en-US'); }
function pad(n) { return String(n).padStart(2, '0'); }
function fmtDT(d) { d = new Date(d); if (isNaN(d)) return '-'; return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtD(d) { d = new Date(d); if (isNaN(d)) return '-'; return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
function toLocalInput(d) { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function toDateInput(d) { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function sameDay(a, b) { a = new Date(a); b = new Date(b); return a.toDateString() === b.toDateString(); }
function startOfDay(d) { d = new Date(d); d.setHours(0, 0, 0, 0); return d; }
const HOUR = 36e5, DAY = 864e5;

class AppError extends Error { constructor(msg, field) { super(msg); this.field = field; } }

/* Thai national ID: 13 digits, last digit is a checksum */
function thaiIdCheck(id12) { let s = 0; for (let i = 0; i < 12; i++) s += +id12[i] * (13 - i); return (11 - (s % 11)) % 10; }
function validThaiId(id) { id = String(id).replace(/\D/g, ''); return id.length === 13 && thaiIdCheck(id) === +id[12]; }
/* Thai driving licence number: 13 digits (spaces and dashes ignored) */
function normLicence(v) { return String(v || '').replace(/[\s-]/g, ''); }
function validLicence(v) { return /^\d{13}$/.test(normLicence(v)); }
function luhn(n) { n = String(n).replace(/\D/g, ''); let s = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return n.length >= 13 && s % 10 === 0; }

/* ---------- reference data ---------- */
const BRANCHES = [
  { id: 'SVB', th: 'สาขาสนามบินสุวรรณภูมิ', en: 'Suvarnabhumi Airport', addrTh: 'อาคารผู้โดยสาร ชั้น 1 ประตู 8 เคาน์เตอร์ 12', addrEn: 'Passenger Terminal, Level 1, Gate 8, Counter 12' },
  { id: 'STN', th: 'สาขาสาทร', en: 'Sathorn', addrTh: '88 ถนนสาทรใต้ แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพฯ', addrEn: '88 South Sathorn Rd, Sathorn, Bangkok' },
  { id: 'CNX', th: 'สาขาเชียงใหม่', en: 'Chiang Mai', addrTh: 'ลานจอดรถ อาคาร 2 สนามบินนานาชาติเชียงใหม่', addrEn: 'Car Park Building 2, Chiang Mai Intl. Airport' },
  { id: 'HKT', th: 'สาขาภูเก็ต', en: 'Phuket', addrTh: '19 ถนนเทพกระษัตรี อ.ถลาง ภูเก็ต', addrEn: '19 Thepkasattri Rd, Thalang, Phuket' },
];
const TYPES = [
  { id: 'economy', th: 'รถเก๋งเล็ก', en: 'Economy', seats: 5 },
  { id: 'sedan', th: 'รถเก๋ง', en: 'Sedan', seats: 5 },
  { id: 'suv', th: 'รถ SUV', en: 'SUV', seats: 7 },
  { id: 'van', th: 'รถตู้', en: 'Van', seats: 12 },
  { id: 'ev', th: 'รถยนต์ไฟฟ้า', en: 'EV', seats: 5 },
];
const ROLES = {
  customer: { th: 'ผู้เช่ารถ', en: 'Customer' },
  office_employee: { th: 'พนักงานออฟฟิศ', en: 'Office Employee' },
  office_manager: { th: 'ผู้จัดการออฟฟิศ', en: 'Office Manager' },
  mechanic: { th: 'ช่างซ่อมบำรุง', en: 'Mechanic Employee' },
  mechanic_manager: { th: 'หัวหน้าช่าง', en: 'Mechanic Manager' },
  big_manager: { th: 'ผู้บริหารระดับสูง', en: 'Big Manager' },
};
const branchName = id => { const b = BRANCHES.find(x => x.id === id); return b ? tt(b.th, b.en) : id; };
const branchAddr = id => { const b = BRANCHES.find(x => x.id === id); return b ? tt(b.addrTh, b.addrEn) : ''; };
const typeName = id => { const t = TYPES.find(x => x.id === id); return t ? tt(t.th, t.en) : id; };
const roleName = id => ROLES[id] ? tt(ROLES[id].th, ROLES[id].en) : id;

const POLICY = { holdMinutes: 15, cancelHours: 24, lateGraceHours: 1, serviceMonths: 6, serviceKm: 10000, maxLoginFails: 5, lockSeconds: 60 };

/* ---------- seed data ---------- */
const Seed = {
  rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  thaiId(r) { let s = String(1 + Math.floor(r() * 8)); for (let i = 0; i < 11; i++) s += Math.floor(r() * 10); return s + thaiIdCheck(s); },
  build() {
    const r = this.rng(262);
    const now = Date.now();
    const at = (days, hour = 10) => { const d = new Date(now + days * DAY); d.setHours(hour, 0, 0, 0); return d.getTime(); };
    const db = { version: 1, counters: { booking: 1000, txn: 50000, job: 100, user: 100, contract: 500, mail: 0 }, users: [], cars: [], rates: [], rentals: [], payments: [], jobs: [], outbox: [], createdAt: now };

    /* D1 ผู้ใช้ — staff */
    const staff = [
      ['office1', 'office_employee', 'นภา', 'สุขสวัสดิ์', 'EMP-201', 'พนักงานออฟฟิศ'],
      ['office2', 'office_employee', 'ธนพล', 'ศรีสุข', 'EMP-202', 'พนักงานออฟฟิศ'],
      ['manager1', 'office_manager', 'วรรณา', 'ทองดี', 'EMP-101', 'ผู้จัดการออฟฟิศ'],
      ['mech1', 'mechanic', 'วิชัย', 'ช่างดี', 'EMP-301', 'ช่างซ่อมบำรุง'],
      ['mech2', 'mechanic', 'อนันต์', 'แก้วมณี', 'EMP-302', 'ช่างซ่อมบำรุง'],
      ['mechlead', 'mechanic_manager', 'สมศักดิ์', 'เครื่องยนต์', 'EMP-300', 'หัวหน้าช่าง'],
      ['ceo', 'big_manager', 'ปรียา', 'วัฒนกิจ', 'EMP-001', 'ผู้บริหารระดับสูง'],
      ['office9', 'office_employee', 'กิตติ', 'พ้นสภาพ', 'EMP-209', 'พนักงานออฟฟิศ'],
    ];
    staff.forEach(([u, role, fn, ln, emp, pos]) => db.users.push({ id: 'U' + (++db.counters.user), username: u, password: 'pass1234', role, firstName: fn, lastName: ln, empId: emp, position: pos, status: u === 'office9' ? 'inactive' : 'active', phone: '08' + Math.floor(10000000 + r() * 89999999), email: u + '@carrental.example', createdAt: at(-400) }));

    /* D1 ผู้ใช้ — customers */
    const custNames = [['สมชาย', 'ใจดี'], ['สุดา', 'มีสุข'], ['ณัฐ', 'วงศ์ไทย'], ['พิมพ์ชนก', 'ศรีงาม'], ['อรรถพล', 'จันทร์เพ็ญ'], ['กมลชนก', 'ใจงาม'], ['ปิยะ', 'รัตนา'], ['ศิริพร', 'บุญมา'], ['ธีรวัฒน์', 'สายสุวรรณ'], ['ชลธิชา', 'ทองคำ'], ['วีรยุทธ', 'แสงทอง'], ['มานี', 'มานะ'], ['John', 'Smith'], ['Aiko', 'Tanaka']];
    custNames.forEach(([fn, ln], i) => {
      const username = i === 0 ? 'somchai' : i === 1 ? 'suda' : 'cust' + (i + 1);
      db.users.push({ id: 'U' + (++db.counters.user), username, password: 'pass1234', role: 'customer', firstName: fn, lastName: ln, nationalId: this.thaiId(r), license: String(6100000000000 + Math.floor(r() * 899999999999)), phone: '08' + Math.floor(10000000 + r() * 89999999), email: username + '@mail.example', status: 'active', createdAt: i < 2 ? at(-200) : at(-Math.floor(r() * 170)) });
    });

    /* D3 อัตราค่าเช่า */
    db.rates = [
      { type: 'economy', daily: 900, weekly: 5600, monthly: 19000, deposit: 3000 },
      { type: 'sedan', daily: 1500, weekly: 9500, monthly: 32000, deposit: 5000 },
      { type: 'suv', daily: 2200, weekly: 14000, monthly: 48000, deposit: 8000 },
      { type: 'van', daily: 2500, weekly: 16000, monthly: 55000, deposit: 8000 },
      { type: 'ev', daily: 1800, weekly: 11500, monthly: 39000, deposit: 5000 },
    ];

    /* D2 รถ */
    const fleet = [
      ['กข 1234', 'Toyota', 'Yaris Ativ', 'economy', 'SVB', '#e11d48'], ['กข 5678', 'Honda', 'City', 'economy', 'STN', '#0ea5e9'],
      ['1กค 2468', 'Nissan', 'Almera', 'economy', 'CNX', '#64748b'], ['ขก 9012', 'Toyota', 'Camry', 'sedan', 'SVB', '#111827'],
      ['ขค 3456', 'Honda', 'Accord', 'sedan', 'STN', '#94a3b8'], ['ฆฆ 7788', 'Mazda', '3', 'sedan', 'HKT', '#b91c1c'],
      ['กง 7890', 'Toyota', 'Fortuner', 'suv', 'SVB', '#f8fafc'], ['งก 1122', 'Honda', 'CR-V', 'suv', 'CNX', '#1e3a8a'],
      ['ชช 3344', 'Mazda', 'CX-5', 'suv', 'HKT', '#7f1d1d'], ['นข 5566', 'Toyota', 'Commuter', 'van', 'SVB', '#e5e7eb'],
      ['ฮก 8899', 'Hyundai', 'H-1', 'van', 'STN', '#374151'], ['9กก 1010', 'BYD', 'Atto 3', 'ev', 'STN', '#0d9488'],
      ['9กข 2020', 'MG', 'MG4', 'ev', 'SVB', '#f59e0b'],
    ];
    fleet.forEach(([plate, brand, model, type, branch, color], i) => {
      const mileage = 12000 + Math.floor(r() * 60000);
      db.cars.push({ plate, brand, model, type, branch, color, year: 2021 + (i % 4), mileage, fuel: 8, status: 'available', registeredAt: at(-365 * (1 + (i % 3)) - Math.floor(r() * 200)), lastService: at(-30 - Math.floor(r() * 170)), lastServiceKm: mileage - Math.floor(r() * 9000) });
    });
    // force a couple of maintenance-schedule warnings for the demo
    db.cars[2].lastService = at(-200); db.cars[7].lastServiceKm = db.cars[7].mileage - 10400;

    const customers = db.users.filter(u => u.role === 'customer');
    const self = this;
    function addRental(cust, car, start, days, status, extra = {}) {
      const end = start + days * DAY;
      const price = Logic.price(car.type, start, end, db);
      const id = 'BK' + (++db.counters.booking);
      const createdAt = Math.min(start - Math.floor(1 + r() * 10) * DAY, now - HOUR);
      const rec = Object.assign({ id, customerId: cust.id, plate: car.plate, type: car.type, branch: car.branch, pickupAt: start, returnAt: end, days: price.days, total: price.total, deposit: price.deposit, status, createdAt, createdBy: cust.id, contract: null, handover: null, returned: null, lateFee: 0, damageCharge: 0, depositRefund: 0, depositStatus: 'none', refund: 0, history: [] }, extra);
      if (status !== 'pending_payment') {
        const txn = 'TXN' + (++db.counters.txn);
        db.payments.push({ txn, bookingId: id, kind: 'rent', amount: rec.total, method: r() > .5 ? 'card' : 'qr', status: 'success', at: createdAt + 600000 });
        db.payments.push({ txn, bookingId: id, kind: 'deposit', amount: rec.deposit, method: 'card', status: 'success', at: createdAt + 600000 });
        rec.depositStatus = 'held';
        rec.contract = { no: 'CT' + (++db.counters.contract), generatedAt: createdAt + 600000, signed: status !== 'confirmed' || extra.signed === true, signedName: cust.firstName + ' ' + cust.lastName, signedAt: createdAt + 900000, sig: null };
      }
      db.rentals.push(rec);
      return rec;
    }

    /* historical returned / cancelled rentals for analytics (last ~6 months) */
    for (let k = 0; k < 70; k++) {
      const car = db.cars[Math.floor(r() * db.cars.length)];
      const cust = customers[Math.floor(r() * customers.length)];
      const start = at(-180 + Math.floor(r() * 170), 9 + Math.floor(r() * 6));
      const days = 1 + Math.floor(r() * 6);
      if (start + days * DAY > now - DAY) continue;
      // avoid overlapping the same car
      if (db.rentals.some(x => x.plate === car.plate && x.status !== 'cancelled' && x.pickupAt < start + days * DAY && start < x.returnAt)) continue;
      const cancelled = r() < .1;
      const rec = addRental(cust, car, start, days, cancelled ? 'cancelled' : 'returned');
      if (cancelled) {
        rec.refund = rec.total; rec.depositStatus = 'refunded'; rec.cancelReason = 'เปลี่ยนแผนการเดินทาง'; rec.cancelledAt = start - 3 * DAY;
        db.payments.push({ txn: 'TXN' + (++db.counters.txn), bookingId: rec.id, kind: 'refund', amount: -rec.total, method: 'card', status: 'success', at: rec.cancelledAt });
        db.payments.push({ txn: 'TXN' + db.counters.txn, bookingId: rec.id, kind: 'deposit_refund', amount: -rec.deposit, method: 'card', status: 'success', at: rec.cancelledAt });
      } else {
        const late = r() < .15 ? 3 : 0;
        const mStart = car.mileage - 3000 + Math.floor(r() * 1000);
        rec.handover = { mileage: mStart, fuel: 8, at: start, by: db.users[0].id };
        rec.returned = { mileage: mStart + days * (80 + Math.floor(r() * 200)), fuel: 7, at: rec.returnAt + late * HOUR, by: db.users[0].id, damaged: false, note: '' };
        rec.lateFee = late ? Logic.lateFee(car.type, late, db) : 0;
        rec.depositRefund = rec.deposit - rec.lateFee; rec.depositStatus = 'refunded';
        if (rec.lateFee) db.payments.push({ txn: 'TXN' + (++db.counters.txn), bookingId: rec.id, kind: 'late_fee', amount: rec.lateFee, method: 'deposit', status: 'success', at: rec.returned.at });
        db.payments.push({ txn: 'TXN' + (++db.counters.txn), bookingId: rec.id, kind: 'deposit_refund', amount: -rec.depositRefund, method: 'card', status: 'success', at: rec.returned.at + HOUR });
      }
    }

    const [somchai, suda] = customers;
    const car = p => db.cars.find(c => c.plate === p);
    /* current demo bookings */
    addRental(somchai, car('ขก 9012'), at(5, 10), 3, 'confirmed', { signed: false });       // upcoming, contract not yet signed
    addRental(somchai, car('9กก 1010'), at(1, 9) - 6 * HOUR, 2, 'confirmed', { signed: true }); // within 24h → cancel blocked
    const active = addRental(suda, car('กง 7890'), at(-2, 9), 3, 'picked_up');                // on the road
    active.handover = { mileage: car('กง 7890').mileage, fuel: 8, at: active.pickupAt, by: db.users[0].id };
    car('กง 7890').status = 'rented';
    addRental(suda, car('กข 5678'), at(0, 15), 2, 'confirmed', { signed: true });              // hand over today

    /* D6 การซ่อมบำรุง */
    const mech1 = db.users.find(u => u.username === 'mech1'), mech2 = db.users.find(u => u.username === 'mech2'), lead = db.users.find(u => u.username === 'mechlead');
    const hist = [['ขค 3456', 'เปลี่ยนน้ำมันเครื่อง + ไส้กรอง', 2400, -150], ['กข 1234', 'เปลี่ยนผ้าเบรกหน้า', 3800, -120], ['งก 1122', 'ซ่อมกันชนหลัง (ส่งอู่)', 9500, -95], ['ฆฆ 7788', 'ตรวจเช็คระยะ 40,000 กม.', 4200, -70], ['นข 5566', 'เปลี่ยนยาง 4 เส้น', 14800, -45], ['กข 5678', 'ซ่อมแอร์ เติมน้ำยา', 2900, -30], ['9กข 2020', 'อัปเดตซอฟต์แวร์ + ตรวจแบตเตอรี่', 1500, -20], ['ขก 9012', 'เปลี่ยนแบตเตอรี่ 12V', 3200, -12]];
    hist.forEach(([plate, work, cost, d], i) => {
      const t = at(d);
      db.jobs.push({ id: 'MT' + (++db.counters.job), plate, bookingId: null, source: 'schedule', damage: work, assignedTo: i % 2 ? mech2.id : mech1.id, assignedBy: lead.id, assignedAt: t - 2 * DAY, mode: work.includes('อู่') ? 'shop' : 'inhouse', status: 'approved', inspection: { result: 'pass', items: {}, note: 'ผ่าน', at: t - DAY }, logs: [{ at: t - DAY, by: i % 2 ? mech2.id : mech1.id, work, parts: '-', cost }], progress: [{ at: t - DAY, status: 'done', note: 'เสร็จ' }], shop: work.includes('อู่') ? { result: 'ซ่อมเสร็จ ทำสีใหม่', cost, at: t - DAY } : null, approvedAt: t, approvedBy: lead.id });
    });
    // in-progress job for mech1
    db.jobs.push({ id: 'MT' + (++db.counters.job), plate: 'ชช 3344', bookingId: null, source: 'manager', damage: 'เสียงดังที่ช่วงล่างด้านหน้าซ้าย', assignedTo: mech1.id, assignedBy: lead.id, assignedAt: at(-1), mode: 'inhouse', status: 'in_progress', inspection: null, logs: [], progress: [{ at: at(-1, 14), status: 'in_progress', note: 'ยกรถขึ้นลิฟต์ ตรวจช่วงล่าง' }], shop: null });
    car('ชช 3344').status = 'maintenance';
    // finished job waiting for manager approval
    db.jobs.push({ id: 'MT' + (++db.counters.job), plate: 'ฮก 8899', bookingId: null, source: 'manager', damage: 'ไฟหน้าขวาไม่ติด', assignedTo: mech2.id, assignedBy: lead.id, assignedAt: at(-2), mode: 'inhouse', status: 'done', inspection: { result: 'pass', items: { tyres: true, brakes: true, lights: true, engine: true, body: true }, note: 'เปลี่ยนหลอดแล้ว ทดสอบผ่าน', at: at(-1) }, logs: [{ at: at(-1), by: mech2.id, work: 'เปลี่ยนหลอดไฟหน้า LED', parts: 'หลอด H4 LED x1', cost: 850 }], progress: [{ at: at(-1), status: 'done', note: 'ซ่อมเสร็จ รออนุมัติ' }], shop: null });
    car('ฮก 8899').status = 'maintenance';
    // damage reported on return, not yet assigned
    const dmg = addRental(customers[2], car('1กค 2468'), at(-6, 10), 4, 'returned');
    dmg.handover = { mileage: car('1กค 2468').mileage - 600, fuel: 8, at: dmg.pickupAt, by: db.users[0].id };
    dmg.returned = { mileage: car('1กค 2468').mileage, fuel: 6, at: dmg.returnAt, by: db.users[0].id, damaged: true, note: 'ประตูหลังซ้ายมีรอยบุบ' };
    dmg.depositStatus = 'held';
    db.jobs.push({ id: 'MT' + (++db.counters.job), plate: '1กค 2468', bookingId: dmg.id, source: 'return', damage: 'ประตูหลังซ้ายมีรอยบุบ (แจ้งตอนคืนรถ ' + dmg.id + ')', assignedTo: null, assignedBy: null, assignedAt: null, mode: null, status: 'unassigned', inspection: null, logs: [], progress: [], shop: null });
    car('1กค 2468').status = 'maintenance';

    db.rentals.sort((a, b) => a.createdAt - b.createdAt);
    return db;
  }
};

/* ---------- data store ---------- */
const DB_KEY = 'crms_db_v1';
const Store = {
  db: null,
  load() {
    let raw = null;
    try { raw = localStorage.getItem(DB_KEY); } catch (e) { }
    if (raw) { try { this.db = JSON.parse(raw); } catch (e) { this.db = null; } }
    if (!this.db || this.db.version !== 1) { this.db = Seed.build(); this.save(); }
    Logic.housekeeping();
  },
  save() { try { localStorage.setItem(DB_KEY, JSON.stringify(this.db)); } catch (e) { } },
  reset() { this.db = Seed.build(); this.save(); },
  next(key, prefix) { return prefix + (++this.db.counters[key]); },
  user(id) { return this.db.users.find(u => u.id === id); },
  car(plate) { return this.db.cars.find(c => c.plate === plate); },
  rental(id) { return this.db.rentals.find(b => b.id === String(id).trim().toUpperCase()); },
  rate(type) { return this.db.rates.find(r => r.type === type); },
  job(id) { return this.db.jobs.find(j => j.id === id); },
};
const fullName = u => u ? `${u.firstName} ${u.lastName}` : '-';
const carName = c => c ? `${c.brand} ${c.model}` : '-';

/* ---------- business rules ---------- */
const ACTIVE = ['pending_payment', 'confirmed', 'picked_up'];
const Logic = {
  price(type, start, end, db = Store.db) {
    const r = db.rates.find(x => x.type === type);
    const hrs = (end - start) / HOUR;
    const days = Math.max(1, Math.ceil(hrs / 24 - 1e-9));
    let rem = days, total = 0, parts = [];
    const m = Math.floor(rem / 30); if (m) { total += m * r.monthly; parts.push([tt(`รายเดือน × ${m}`, `Monthly × ${m}`), m * r.monthly]); rem -= m * 30; }
    const w = Math.floor(rem / 7); if (w) { total += w * r.weekly; parts.push([tt(`รายสัปดาห์ × ${w}`, `Weekly × ${w}`), w * r.weekly]); rem -= w * 7; }
    if (rem) { const d = Math.min(rem * r.daily, r.weekly); total += d; parts.push([tt(`รายวัน × ${rem}`, `Daily × ${rem}`), d]); }
    return { days, total, deposit: r.deposit, parts, rate: r };
  },
  lateFee(type, hoursLate, db = Store.db) {
    if (hoursLate <= POLICY.lateGraceHours) return 0;
    const r = db.rates.find(x => x.type === type);
    return Math.min(Math.ceil(hoursLate) * Math.round(r.daily / 10), Math.ceil(hoursLate / 24) * Math.round(r.daily * 1.5));
  },
  validatePeriod(start, end, { allowPast = false } = {}) {
    if (!start) throw new AppError(tt('กรุณาระบุวันเวลารับรถ', 'Please enter a pick-up date/time'), 'start');
    if (!end) throw new AppError(tt('กรุณาระบุวันเวลาคืนรถ', 'Please enter a return date/time'), 'end');
    if (!allowPast && start < Date.now() - 5 * 60000) throw new AppError(tt('วันเวลารับรถต้องไม่อยู่ในอดีต', 'Pick-up time cannot be in the past'), 'start');
    if (end <= start) throw new AppError(tt('วันเวลาคืนรถต้องหลังวันเวลารับรถ', 'Return time must be after pick-up time'), 'end');
    if (end - start < 4 * HOUR) throw new AppError(tt('ระยะเวลาเช่าขั้นต่ำ 4 ชั่วโมง', 'Minimum rental period is 4 hours'), 'end');
    if (end - start > 90 * DAY) throw new AppError(tt('เช่าได้สูงสุด 90 วันต่อการจอง', 'Maximum 90 days per booking'), 'end');
  },
  isFree(plate, start, end, excludeId) {
    const car = Store.car(plate);
    if (!car || car.status === 'maintenance') return false;
    return !Store.db.rentals.some(b => b.plate === plate && b.id !== excludeId && ACTIVE.includes(b.status) &&
      b.pickupAt < end && start < (b.status === 'picked_up' ? Math.max(b.returnAt, Date.now()) : b.returnAt));
  },
  search({ start, end, branch, type }) {
    return Store.db.cars.filter(c => (!branch || c.branch === branch) && (!type || c.type === type) && this.isFree(c.plate, start, end))
      .map(c => ({ car: c, price: this.price(c.type, start, end) }))
      .sort((a, b) => a.price.total - b.price.total);
  },
  createBooking({ customerId, plate, start, end, createdBy }) {
    this.validatePeriod(start, end);
    if (!this.isFree(plate, start, end)) throw new AppError(tt('รถคันนี้ไม่ว่างในช่วงเวลาที่เลือกแล้ว กรุณาเลือกคันอื่น', 'This car is no longer available for that period. Please choose another.'));
    const car = Store.car(plate);
    const p = this.price(car.type, start, end);
    const b = { id: Store.next('booking', 'BK'), customerId, plate, type: car.type, branch: car.branch, pickupAt: start, returnAt: end, days: p.days, total: p.total, deposit: p.deposit, status: 'pending_payment', holdUntil: Date.now() + POLICY.holdMinutes * 60000, createdAt: Date.now(), createdBy: createdBy || customerId, contract: null, handover: null, returned: null, lateFee: 0, damageCharge: 0, depositRefund: 0, depositStatus: 'none', refund: 0, history: [] };
    Store.db.rentals.push(b); Store.save();
    return b;
  },
  recordPayment(bookingId, kind, amount, method, txn) {
    txn = txn || Store.next('txn', 'TXN');
    Store.db.payments.push({ txn, bookingId, kind, amount, method, status: 'success', at: Date.now() });
    return txn;
  },
  confirmPayment(id, result) {
    const b = Store.rental(id);
    if (!b || b.status !== 'pending_payment') throw new AppError(tt('การจองนี้หมดเวลาชำระหรือถูกยกเลิกแล้ว', 'This booking has expired or been cancelled'));
    const txn = Store.next('txn', 'TXN');
    this.recordPayment(b.id, 'rent', b.total, result.method, txn);
    this.recordPayment(b.id, 'deposit', b.deposit, result.method, txn);
    b.status = 'confirmed'; b.depositStatus = 'held'; b.txn = txn; delete b.holdUntil;
    b.contract = { no: Store.next('contract', 'CT'), generatedAt: Date.now(), signed: false };
    const c = Store.user(b.customerId);
    this.mail(b.customerId, tt(`สัญญาเช่ารถ ${b.contract.no} / การจอง ${b.id}`, `Rental contract ${b.contract.no} / booking ${b.id}`),
      tt(`เรียนคุณ${c.firstName} การชำระเงินสำเร็จ (เลขที่ธุรกรรม ${txn}) กรุณาเข้าสู่ระบบเพื่ออ่านและเซ็นสัญญาเช่ารถก่อนวันรับรถ`, `Dear ${c.firstName}, payment received (transaction ${txn}). Please sign in to read and sign your rental contract before pick-up.`), b.id);
    Store.save();
    return txn;
  },
  expirePending(id, reason) {
    const b = Store.rental(id);
    if (!b || b.status !== 'pending_payment') return;
    b.status = 'cancelled'; b.cancelReason = reason || tt('หมดเวลาชำระเงิน', 'Payment time expired'); b.cancelledAt = Date.now();
    Store.save();
  },
  housekeeping() {
    let changed = false;
    Store.db.users.forEach(u => { const m = /^(?:DL)?(\d{8})$/.exec(u.license || ''); if (m) { u.license = '61000' + m[1]; changed = true; } });  // older demo data
    Store.db.rentals.forEach(b => { if (b.status === 'pending_payment' && b.holdUntil && b.holdUntil < Date.now()) { b.status = 'cancelled'; b.cancelReason = 'หมดเวลาชำระเงิน (Payment time expired)'; b.cancelledAt = Date.now(); changed = true; } });
    if (changed) Store.save();
  },
  /* FR C-08: cancel an unpaid booking — FR C-16/17: cancel a paid rental with refund */
  cancel(id, reason, actor) {
    const b = Store.rental(id);
    if (!b) throw new AppError(tt('ไม่พบ Booking ID นี้', 'Booking ID not found'));
    if (!reason || !reason.trim()) throw new AppError(tt('กรุณาระบุเหตุผลการยกเลิก', 'Please give a reason for cancelling'), 'reason');
    if (b.status === 'pending_payment') { b.status = 'cancelled'; b.cancelReason = reason; b.cancelledAt = Date.now(); Store.save(); return { refund: 0 }; }
    if (b.status !== 'confirmed') throw new AppError(tt('ยกเลิกได้เฉพาะการจองที่ยังไม่รับรถ', 'Only bookings not yet picked up can be cancelled'));
    if (actor === 'customer' && b.pickupAt - Date.now() < POLICY.cancelHours * HOUR)
      throw new AppError(tt(`เลยเวลาที่กำหนดสำหรับยกเลิกการเช่าแล้ว (ต้องยกเลิกก่อนรับรถอย่างน้อย ${POLICY.cancelHours} ชั่วโมง) กรุณาติดต่อเคาน์เตอร์สาขา`, `Cancellation window has passed (must cancel at least ${POLICY.cancelHours} hours before pick-up). Please contact the branch.`));
    const paid = this.paidRent(b.id);
    const txn = Store.next('txn', 'TXN');
    this.recordPayment(b.id, 'refund', -paid, 'refund', txn);
    this.recordPayment(b.id, 'deposit_refund', -b.deposit, 'refund', txn);
    b.status = 'cancelled'; b.cancelReason = reason; b.cancelledAt = Date.now(); b.refund = paid; b.depositStatus = 'refunded';
    this.mail(b.customerId, tt(`ยืนยันการยกเลิก ${b.id}`, `Cancellation confirmed ${b.id}`), tt(`คืนเงิน ${money(paid + b.deposit)} (ค่าเช่า + มัดจำ) เข้าช่องทางเดิมภายใน 7 วันทำการ เลขที่ธุรกรรม ${txn}`, `Refund of ${money(paid + b.deposit)} (rent + deposit) to the original method within 7 business days. Transaction ${txn}`), b.id);
    Store.save();
    return { refund: paid + b.deposit, txn };
  },
  paidRent(id) { return Store.db.payments.filter(p => p.bookingId === id && ['rent', 'difference', 'refund_difference'].includes(p.kind)).reduce((s, p) => s + p.amount, 0); },
  /* FR C-13/14, OE-04 */
  /* customers may only change a booking up to 24h before pick-up (same window as cancelling); staff can always amend */
  editLocked(b) { return b.pickupAt - Date.now() < POLICY.cancelHours * HOUR; },
  previewEdit(id, { start, end, plate }, { allowPast = false, actor = 'customer' } = {}) {
    const b = Store.rental(id);
    if (!b) throw new AppError(tt('ไม่พบ Booking ID นี้', 'Booking ID not found'));
    if (b.status !== 'confirmed') throw new AppError(tt('แก้ไขได้เฉพาะการจองที่ชำระแล้วและยังไม่รับรถ', 'Only paid bookings that have not been picked up can be edited'));
    if (actor === 'customer' && this.editLocked(b)) throw new AppError(tt(`เหลือเวลาก่อนรับรถไม่ถึง ${POLICY.cancelHours} ชั่วโมง แก้ไขการเช่าผ่านระบบไม่ได้ กรุณาติดต่อเคาน์เตอร์สาขา`, `Less than ${POLICY.cancelHours} hours to pick-up — this booking can no longer be changed online. Please contact the branch.`));
    this.validatePeriod(start, end, { allowPast });
    if (!this.isFree(plate, start, end, b.id)) throw new AppError(tt('รถที่เลือกไม่ว่างในช่วงเวลาใหม่', 'The selected car is not available for the new period'), 'plate');
    const car = Store.car(plate);
    const p = this.price(car.type, start, end);
    const paid = this.paidRent(b.id);
    return { booking: b, car, price: p, paid, diff: p.total - paid, depositDiff: p.deposit - b.deposit };
  },
  applyEdit(id, changes, method, actor = 'customer') {
    const pv = this.previewEdit(id, changes, { allowPast: true, actor });
    const b = pv.booking;
    b.history.push({ at: Date.now(), from: { plate: b.plate, pickupAt: b.pickupAt, returnAt: b.returnAt, total: b.total }, to: { plate: changes.plate, pickupAt: changes.start, returnAt: changes.end, total: pv.price.total } });
    const txn = Store.next('txn', 'TXN');
    if (pv.diff > 0) this.recordPayment(b.id, 'difference', pv.diff, method || 'card', txn);
    if (pv.diff < 0) this.recordPayment(b.id, 'refund_difference', pv.diff, 'refund', txn);
    if (pv.depositDiff) this.recordPayment(b.id, pv.depositDiff > 0 ? 'deposit' : 'deposit_refund', pv.depositDiff, method || 'refund', txn);
    Object.assign(b, { plate: changes.plate, type: pv.car.type, branch: pv.car.branch, pickupAt: changes.start, returnAt: changes.end, days: pv.price.days, total: pv.price.total, deposit: pv.price.deposit });
    if (b.contract) { b.contract = { no: Store.next('contract', 'CT'), generatedAt: Date.now(), signed: false }; }
    this.mail(b.customerId, tt(`แก้ไขการจอง ${b.id} สำเร็จ`, `Booking ${b.id} updated`), tt(`ยอดส่วนต่าง ${money(pv.diff)} สัญญาฉบับใหม่ ${b.contract.no} รอการเซ็น`, `Difference ${money(pv.diff)}. New contract ${b.contract.no} awaits signature.`), b.id);
    Store.save();
    return { diff: pv.diff, txn };
  },
  /* FR C-18 */
  signContract(id, typedName, sig) {
    const b = Store.rental(id); const c = Store.user(b.customerId);
    if (!sig) throw new AppError(tt('กรุณาเซ็นชื่อในช่องลายเซ็น', 'Please sign in the signature box'), 'sig');
    if (typedName.trim().replace(/\s+/g, ' ') !== fullName(c)) throw new AppError(tt(`ชื่อ-นามสกุลต้องตรงกับผู้เช่า (${fullName(c)})`, `Full name must match the renter (${fullName(c)})`), 'name');
    b.contract.signed = true; b.contract.signedName = fullName(c); b.contract.signedAt = Date.now(); b.contract.sig = sig;
    Store.save();
  },
  /* FR OE-06 */
  handover(id, { mileage, fuel, at, by }) {
    const b = Store.rental(id);
    if (!b) throw new AppError(tt('ไม่พบ Booking ID นี้', 'Booking ID not found'), 'id');
    if (b.status !== 'confirmed') throw new AppError(tt('ส่งมอบได้เฉพาะการจองที่ชำระเงินแล้วและยังไม่รับรถ', 'Only paid bookings awaiting pick-up can be handed over'), 'id');
    if (!b.contract || !b.contract.signed) throw new AppError(tt('ผู้เช่ายังไม่ได้เซ็นสัญญาเช่ารถ ไม่สามารถส่งมอบรถได้', 'The renter has not signed the rental contract yet — car cannot be handed over'), 'id');
    const car = Store.car(b.plate);
    if (car.status === 'maintenance') throw new AppError(tt('รถคันนี้อยู่ระหว่างซ่อมบำรุง', 'This car is under maintenance'), 'id');
    if (!(mileage >= 0) || mileage === '') throw new AppError(tt('กรุณากรอกเลขไมล์', 'Please enter the odometer reading'), 'mileage');
    if (mileage < car.mileage) throw new AppError(tt(`เลขไมล์ต้องไม่น้อยกว่าเลขไมล์ล่าสุดของรถ (${num(car.mileage)} กม.)`, `Odometer cannot be lower than the car's last reading (${num(car.mileage)} km)`), 'mileage');
    b.handover = { mileage, fuel, at, by }; b.status = 'picked_up';
    car.status = 'rented'; car.mileage = mileage; car.fuel = fuel;
    Store.save();
  },
  /* FR OE-07, C-19 */
  returnCar(id, { mileage, fuel, at, by, damaged, note }) {
    const b = Store.rental(id);
    if (!b) throw new AppError(tt('ไม่พบ Booking ID นี้', 'Booking ID not found'), 'id');
    if (b.status !== 'picked_up') throw new AppError(tt('รับคืนได้เฉพาะรถที่อยู่ระหว่างเช่า', 'Only cars currently on rent can be returned'), 'id');
    if (!(mileage >= 0) || mileage === '') throw new AppError(tt('กรุณากรอกเลขไมล์', 'Please enter the odometer reading'), 'mileage');
    if (mileage < b.handover.mileage) throw new AppError(tt(`เลขไมล์ตอนคืนต้องไม่น้อยกว่าตอนรับรถ (${num(b.handover.mileage)} กม.)`, `Return odometer cannot be lower than at pick-up (${num(b.handover.mileage)} km)`), 'mileage');
    if (damaged && !note.trim()) throw new AppError(tt('กรุณาระบุรายละเอียดความเสียหาย', 'Please describe the damage'), 'note');
    const hoursLate = (at - b.returnAt) / HOUR;
    b.lateFee = this.lateFee(b.type, hoursLate);
    b.returned = { mileage, fuel, at, by, damaged, note };
    b.status = 'returned';
    const car = Store.car(b.plate); car.mileage = mileage; car.fuel = fuel;
    const txn = Store.next('txn', 'TXN');
    if (b.lateFee) this.recordPayment(b.id, 'late_fee', b.lateFee, 'deposit', txn);
    if (damaged) {
      car.status = 'maintenance'; b.depositStatus = 'held';
      Store.db.jobs.push({ id: Store.next('job', 'MT'), plate: b.plate, bookingId: b.id, source: 'return', damage: `${note} (${tt('แจ้งตอนคืนรถ', 'reported at return')} ${b.id})`, assignedTo: null, assignedBy: null, assignedAt: null, mode: null, status: 'unassigned', inspection: null, logs: [], progress: [], shop: null });
      this.mail(b.customerId, tt(`รับคืนรถ ${b.id} — พบความเสียหาย`, `Car returned ${b.id} — damage found`), tt('ระบบถือเงินมัดจำไว้จนกว่าจะประเมินค่าซ่อมเสร็จ คุณสามารถตรวจสอบค่าใช้จ่ายการซ่อมได้ในหน้า "การเช่าของฉัน"', 'Your deposit is held until the repair cost is assessed. You can check repair costs under "My rentals".'), b.id);
    } else {
      car.status = 'available';
      b.depositRefund = Math.max(0, b.deposit - b.lateFee); b.depositStatus = 'refunded';
      this.recordPayment(b.id, 'deposit_refund', -b.depositRefund, 'refund', txn);
      this.mail(b.customerId, tt(`รับคืนรถ ${b.id} เรียบร้อย`, `Car returned ${b.id}`), tt(`คืนเงินมัดจำ ${money(b.depositRefund)}${b.lateFee ? ` (หักค่าปรับคืนช้า ${money(b.lateFee)})` : ''}`, `Deposit refund ${money(b.depositRefund)}${b.lateFee ? ` (late fee ${money(b.lateFee)} deducted)` : ''}`), b.id);
    }
    Store.save();
    return { lateFee: b.lateFee, hoursLate, refund: b.depositRefund, damaged };
  },
  jobCost(j) { return (j.logs || []).reduce((s, l) => s + (+l.cost || 0), 0) + (j.shop ? +j.shop.cost || 0 : 0); },
  /* FR MM-07 */
  approveJob(id, by) {
    const j = Store.job(id);
    if (j.status !== 'done') throw new AppError(tt('อนุมัติได้เฉพาะงานที่ช่างรายงานว่าเสร็จแล้ว', 'Only jobs reported as done can be approved'));
    if (!j.inspection || j.inspection.result !== 'pass') throw new AppError(tt('ผลตรวจสภาพยังไม่ผ่าน ไม่สามารถอนุมัติให้รถพร้อมใช้งาน', 'Inspection has not passed — the car cannot be approved as ready'));
    j.status = 'approved'; j.approvedAt = Date.now(); j.approvedBy = by;
    const car = Store.car(j.plate);
    car.status = 'available'; car.lastService = Date.now(); car.lastServiceKm = car.mileage;
    if (j.bookingId) {
      const b = Store.rental(j.bookingId);
      const cost = this.jobCost(j);
      const available = b.deposit - b.lateFee;
      b.damageCharge = Math.min(cost, available); b.repairCost = cost; b.repairJob = j.id;
      b.depositRefund = Math.max(0, available - b.damageCharge); b.depositStatus = 'settled';
      const txn = Store.next('txn', 'TXN');
      if (b.damageCharge) this.recordPayment(b.id, 'damage_charge', b.damageCharge, 'deposit', txn);
      if (b.depositRefund) this.recordPayment(b.id, 'deposit_refund', -b.depositRefund, 'refund', txn);
      this.mail(b.customerId, tt(`ค่าซ่อมรถจากการเช่า ${b.id}`, `Repair cost for rental ${b.id}`), tt(`ค่าซ่อม ${money(cost)} หักจากเงินมัดจำ ${money(b.damageCharge)} คืนมัดจำส่วนที่เหลือ ${money(b.depositRefund)}`, `Repair cost ${money(cost)}; ${money(b.damageCharge)} deducted from deposit; remaining deposit ${money(b.depositRefund)} refunded`), b.id);
    }
    Store.save();
  },
  mail(userId, subject, body, bookingId) { Store.db.outbox.unshift({ id: Store.next('mail', 'M'), to: userId, subject, body, bookingId, at: Date.now(), read: false }); },
  carStatus(car) {
    if (car.status === 'maintenance') return 'maintenance';
    if (car.status === 'rented') return 'rented';
    const now = Date.now();
    if (Store.db.rentals.some(b => b.plate === car.plate && ['confirmed', 'pending_payment'].includes(b.status) && b.pickupAt - now < DAY && b.returnAt > now)) return 'reserved';
    return 'available';
  },
  utilisation(plate, days = 90) {
    const from = Date.now() - days * DAY, to = Date.now();
    const ms = Store.db.rentals.filter(b => b.plate === plate && ['returned', 'picked_up'].includes(b.status)).reduce((s, b) => {
      const st = Math.max(b.pickupAt, from), en = Math.min(b.returned ? b.returned.at : Math.min(Date.now(), b.returnAt), to);
      return s + Math.max(0, en - st);
    }, 0);
    return Math.min(1, ms / (to - from));
  },
  schedule(car) {
    const byTime = new Date(car.lastService); byTime.setMonth(byTime.getMonth() + POLICY.serviceMonths);
    const byKm = car.lastServiceKm + POLICY.serviceKm;
    const reg = new Date(car.registeredAt); const annual = new Date(reg); annual.setFullYear(new Date().getFullYear());
    if (annual.getTime() < Date.now() - DAY) annual.setFullYear(annual.getFullYear() + 1);
    const now = Date.now();
    const st = (d, soonMs) => d < now ? 'overdue' : d - now < soonMs ? 'soon' : 'ok';
    const kmLeft = byKm - car.mileage;
    return {
      byTime: byTime.getTime(), timeStatus: st(byTime.getTime(), 14 * DAY),
      byKm, kmLeft, kmStatus: kmLeft < 0 ? 'overdue' : kmLeft < 1000 ? 'soon' : 'ok',
      annual: annual.getTime(), annualStatus: st(annual.getTime(), 30 * DAY),
    };
  },
  /* payments-based revenue (D5) */
  REVENUE_KINDS: ['rent', 'difference', 'refund', 'refund_difference', 'late_fee', 'damage_charge'],
  revenue(filter = () => true) { return Store.db.payments.filter(p => this.REVENUE_KINDS.includes(p.kind) && filter(p)).reduce((s, p) => s + p.amount, 0); },
};

/* ---------- status labels ---------- */
const STATUS = {
  pending_payment: ['รอชำระเงิน', 'Awaiting payment', 'b-warn'], confirmed: ['ยืนยันแล้ว', 'Confirmed', 'b-info'], picked_up: ['กำลังเช่า', 'On rent', 'b-violet'],
  returned: ['คืนรถแล้ว', 'Returned', 'b-ok'], cancelled: ['ยกเลิก', 'Cancelled', 'b-danger'],
  available: ['ว่าง', 'Available', 'b-ok'], rented: ['ถูกเช่า', 'Rented', 'b-violet'], reserved: ['ถูกจอง (24 ชม.)', 'Reserved (24h)', 'b-info'], maintenance: ['ซ่อมบำรุง', 'Maintenance', 'b-warn'],
  unassigned: ['รอมอบหมาย', 'Unassigned', 'b-danger'], assigned: ['มอบหมายแล้ว', 'Assigned', 'b-info'], in_progress: ['กำลังดำเนินการ', 'In progress', 'b-violet'], sent_to_shop: ['ส่งอู่', 'At repair shop', 'b-warn'], done: ['เสร็จ รออนุมัติ', 'Done, awaiting approval', 'b-warn'], approved: ['อนุมัติ พร้อมใช้', 'Approved, ready', 'b-ok'],
  active: ['ใช้งาน', 'Active', 'b-ok'], inactive: ['ระงับ', 'Inactive', 'b-danger'],
  overdue: ['เลยกำหนด', 'Overdue', 'b-danger'], soon: ['ใกล้ถึง', 'Due soon', 'b-warn'], ok: ['ปกติ', 'OK', 'b-ok'],
  held: ['ถือไว้', 'Held', 'b-warn'], refunded: ['คืนแล้ว', 'Refunded', 'b-ok'], settled: ['หักค่าซ่อมแล้ว', 'Settled', 'b-ok'], none: ['-', '-', 'b-gray'],
};
function badge(s) { const x = STATUS[s] || [s, s, 'b-gray']; return `<span class="badge ${x[2]}">${esc(tt(x[0], x[1]))}</span>`; }
const PAY_KIND = { rent: ['ค่าเช่า', 'Rent'], deposit: ['เงินมัดจำ', 'Deposit'], difference: ['ส่วนต่างแก้ไขการเช่า', 'Edit difference'], refund_difference: ['คืนส่วนต่าง', 'Difference refund'], refund: ['คืนเงินค่าเช่า', 'Rent refund'], deposit_refund: ['คืนเงินมัดจำ', 'Deposit refund'], late_fee: ['ค่าปรับคืนช้า', 'Late fee'], damage_charge: ['ค่าซ่อมความเสียหาย', 'Damage charge'] };
const payKind = k => PAY_KIND[k] ? tt(...PAY_KIND[k]) : k;
const METHOD = { card: ['บัตรเครดิต', 'Credit card'], qr: ['QR พร้อมเพย์', 'QR PromptPay'], refund: ['คืนเข้าช่องทางเดิม', 'Back to original method'], deposit: ['หักจากมัดจำ', 'From deposit'], counter: ['เคาน์เตอร์', 'Counter'] };
const methodName = m => METHOD[m] ? tt(...METHOD[m]) : m;

/* ---------- shared UI ---------- */
const UI = {
  toast(msg, type = '') {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  },
  modal(html, { wide = false, onClose, banner } = {}) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${banner ? `<div class="ext-banner"><span class="dot"></span>${banner}</div>` : ''}${html}</div>`;
    document.body.appendChild(ov);
    const api = {
      el: ov, closed: false,
      close(silent) { if (api.closed) return; api.closed = true; ov.remove(); document.removeEventListener('keydown', onKey); if (!silent && onClose) onClose(); },
    };
    const onKey = e => { if (e.key === 'Escape') api.close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('mousedown', e => { if (e.target === ov) api.close(); });
    $$('[data-close]', ov).forEach(b => b.addEventListener('click', () => api.close()));
    return api;
  },
  confirm(title, body, { okText, danger } = {}) {
    return new Promise(res => {
      const m = UI.modal(`<div class="modal-head"><h3>${esc(title)}</h3><button class="x-btn" data-close>×</button></div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot"><button class="btn" data-close>${tt('ยกเลิก', 'Cancel')}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText || tt('ยืนยัน', 'Confirm'))}</button></div>`, { onClose: () => res(false) });
      $('[data-ok]', m.el).onclick = () => { m.close(true); res(true); };
    });
  },
  /* form helpers: show an AppError next to its field */
  clearErrors(root) { $$('.field.invalid', root).forEach(f => f.classList.remove('invalid')); $$('.err', root).forEach(e => e.textContent = ''); $$('.form-alert', root).forEach(e => e.innerHTML = ''); },
  showError(root, err) {
    if (!(err instanceof AppError)) { console.error(err); err = new AppError(String(err.message || err)); }
    const f = err.field && $(`[data-field="${err.field}"]`, root);
    if (f) { f.classList.add('invalid'); const e = $('.err', f); if (e) e.textContent = err.message; const inp = $('input,select,textarea,canvas', f); if (inp && inp.focus) inp.focus(); }
    else { const a = $('.form-alert', root); if (a) a.innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`; else UI.toast(err.message, 'err'); }
  },
  require(root, names) {
    for (const n of names) {
      const f = $(`[data-field="${n}"]`, root); const inp = f && $('input,select,textarea', f);
      if (inp && !String(inp.value).trim()) throw new AppError(tt('กรุณากรอกข้อมูลช่องนี้', 'This field is required'), n);
    }
  },
  field(name, labelTh, labelEn, input, { req, hint, cls = '' } = {}) {
    return `<div class="field ${cls}" data-field="${name}"><label class="lbl">${esc(tt(labelTh, labelEn))}${req ? ' <span class="req">*</span>' : ''}</label>${input}${hint ? `<span class="hint">${hint}</span>` : ''}<span class="err"></span></div>`;
  },
  pageHead(titleTh, titleEn, descTh, descEn, frs = [], dfd = [], actions = '') {
    return `<div class="page-head"><div><h1>${esc(tt(titleTh, titleEn))}</h1>${descTh ? `<p>${esc(tt(descTh, descEn))}</p>` : ''}</div><div class="row">${actions}</div></div>`;
  },
  table(cols, rows, emptyTh = 'ไม่มีข้อมูล', emptyEn = 'No data') {
    if (!rows.length) return `<div class="table-wrap"><div class="empty">${esc(tt(emptyTh, emptyEn))}</div></div>`;
    return `<div class="table-wrap"><table><thead><tr>${cols.map(c => `<th class="${c.cls || ''}">${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.cls || ''}">${c.v(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },
  bars(data, fmt = money) {
    const max = Math.max(1, ...data.map(d => d.value));
    return `<div class="bars">${data.map(d => `<div class="bar-col"><div class="bar" style="height:${Math.max(1, d.value / max * 100)}%"><span class="tip">${esc(d.label)}: ${fmt(d.value)}</span></div></div>`).join('')}</div>
      <div class="bar-labels">${data.map(d => `<span title="${esc(d.label)}">${esc(d.label)}</span>`).join('')}</div>`;
  },
  hbars(data, fmt = money) {
    const max = Math.max(1, ...data.map(d => d.value));
    return data.map(d => `<div class="hbar"><span>${esc(d.label)}</span><div class="track"><div class="fill" style="width:${d.value / max * 100}%"></div></div><span class="right mono small">${fmt(d.value)}</span></div>`).join('');
  },
  carArt(car) {
    const c = car.color || '#64748b';
    const tall = car.type === 'suv' || car.type === 'van';
    return `<div class="car-art" style="background:linear-gradient(180deg,#f8fafc,#eef2f6)"><svg viewBox="0 0 160 70" aria-hidden="true">
      <path d="M12 50 L14 ${tall ? 26 : 34} Q16 ${tall ? 18 : 28} 30 ${tall ? 16 : 26} L${tall ? 50 : 52} ${tall ? 14 : 24} Q60 ${tall ? 8 : 12} 78 ${tall ? 8 : 12} L${tall ? 118 : 104} ${tall ? 8 : 12} Q${tall ? 132 : 120} ${tall ? 10 : 14} 136 ${tall ? 24 : 26} L146 32 Q150 36 150 44 L150 50 Z" fill="${c}" stroke="#0f172a" stroke-opacity=".25"/>
      <path d="M${tall ? 54 : 56} ${tall ? 16 : 25} Q64 ${tall ? 12 : 16} 78 ${tall ? 12 : 16} L${tall ? 116 : 102} ${tall ? 12 : 16} Q${tall ? 126 : 114} ${tall ? 14 : 18} ${tall ? 130 : 124} 26 Z" fill="#cbd5e1" opacity=".85"/>
      <circle cx="40" cy="52" r="10" fill="#1f2937"/><circle cx="40" cy="52" r="4" fill="#9ca3af"/>
      <circle cx="122" cy="52" r="10" fill="#1f2937"/><circle cx="122" cy="52" r="4" fill="#9ca3af"/>
      ${car.type === 'ev' ? '<path d="M84 30 l-6 9 h5 l-3 8 l8 -11 h-5 l3 -6 z" fill="#fff"/>' : ''}</svg></div>`;
  },
  csv(filename, rows) {
    const text = '﻿' + rows.map(r => r.map(v => { v = String(v ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },
  printEl(el) { el.classList.add('print-area'); window.print(); setTimeout(() => el.classList.remove('print-area'), 500); },
};

/* ---------- Payment Service (external entity, simulated) ---------- */
const PaymentService = {
  /* opts: { bookingId, amount, lines, holdUntil, onSuccess(result), onCancel(), onTimeout() } */
  open(opts) {
    let timer = null, done = false;
    const m = UI.modal(`<div class="modal-head"><div><h3>${tt('ชำระเงิน', 'Payment')}</h3><div class="small muted">Booking ID <span class="mono">${esc(opts.bookingId)}</span></div></div><button class="x-btn" data-close>×</button></div>
      <div class="modal-body" id="payBody"></div>`, {
      banner: tt('Payment Service — ระบบภายนอก (จำลอง)', 'Payment Service — external system (simulated)'),
      onClose: () => { clearInterval(timer); if (!done && opts.onCancel) opts.onCancel(); }
    });
    const body = $('#payBody', m.el);
    const summary = () => `<div class="card" style="padding:12px 14px;margin-bottom:14px;box-shadow:none">${(opts.lines || []).map(l => `<div class="sum-line"><span>${esc(l[0])}</span><span class="mono">${money(l[1])}</span></div>`).join('')}
      <div class="sum-line total"><span>${tt('ยอดชำระ', 'Amount due')}</span><span>${money(opts.amount)}</span></div>
      ${opts.holdUntil ? `<div class="small muted">${tt('กรุณาชำระภายใน', 'Please pay within')} <span class="countdown" id="cd">--:--</span> ${tt('มิฉะนั้นระบบจะยกเลิกการจอง', 'or the booking will be cancelled')}</div>` : ''}</div>`;
    const tick = () => {
      if (!opts.holdUntil) return;
      const left = opts.holdUntil - Date.now(); const el = $('#cd', m.el);
      if (left <= 0) return timeout();
      if (el) el.textContent = `${pad(Math.floor(left / 60000))}:${pad(Math.floor(left / 1000) % 60)}`;
    };
    const timeout = () => {
      clearInterval(timer); done = true;
      body.innerHTML = `<div class="alert alert-danger"><b>${tt('หมดเวลาการชำระแล้ว', 'Payment time has expired')}</b><br>${tt('ระบบยกเลิกการจองนี้แล้ว กรุณาทำการจองใหม่อีกครั้ง', 'This booking has been cancelled. Please make a new booking.')}</div>`;
      $('.modal-foot', m.el)?.remove();
      m.el.querySelector('.modal').insertAdjacentHTML('beforeend', `<div class="modal-foot"><button class="btn btn-primary" data-x>${tt('ตกลง', 'OK')}</button></div>`);
      $('[data-x]', m.el).onclick = () => m.close(true);
      if (opts.onTimeout) opts.onTimeout();
    };
    const choose = () => {
      body.innerHTML = summary() + `<div class="lbl" style="margin-bottom:8px">${tt('เลือกช่องทางการชำระเงิน', 'Choose a payment method')}</div>
        <div class="pay-methods">
          <button class="pay-method" data-m="qr"><b>QR PromptPay</b><span class="small muted">${tt('สแกนจ่ายผ่านแอปธนาคาร', 'Scan with a banking app')}</span></button>
          <button class="pay-method" data-m="card"><b>${tt('บัตรเครดิต / เดบิต', 'Credit / debit card')}</b><span class="small muted">Visa · Mastercard · JCB</span></button>
        </div>
        ${opts.holdUntil ? `<div class="small" style="margin-top:14px"><button class="link-btn small" data-sim-timeout>⏱ ${tt('จำลองหมดเวลาชำระ (สำหรับทดสอบ)', 'Simulate payment timeout (for testing)')}</button></div>` : ''}`;
      $$('[data-m]', body).forEach(b => b.onclick = () => b.dataset.m === 'qr' ? qr() : card());
      const st = $('[data-sim-timeout]', body); if (st) st.onclick = () => { opts.holdUntil = Date.now() - 1; timeout(); };
      tick();
    };
    const qr = () => {
      const ref = 'QR' + Date.now().toString().slice(-8);
      body.innerHTML = summary() + `<div class="qr">${PaymentService.qrSvg(ref + opts.amount)}<div class="small muted mono">${ref}</div></div>
        <div class="alert alert-info small">${tt('ในระบบจริงผู้เช่าจะสแกน QR นี้ด้วยแอปธนาคาร ในต้นแบบให้กดปุ่มด้านล่างเพื่อจำลองผลจาก Payment Service', 'In production the renter scans this with a banking app. In this prototype, use the buttons below to simulate the Payment Service response.')}</div>
        <div class="row" style="margin-top:14px;justify-content:space-between"><button class="btn" data-back>← ${tt('เปลี่ยนช่องทาง', 'Change method')}</button>
        <div class="row"><button class="btn btn-danger" data-fail>${tt('จำลอง: ชำระไม่สำเร็จ', 'Simulate: failed')}</button><button class="btn btn-primary" data-ok>${tt('จำลอง: สแกนจ่ายสำเร็จ', 'Simulate: paid')}</button></div></div>`;
      $('[data-back]', body).onclick = choose;
      $('[data-fail]', body).onclick = () => UI.toast(tt('Payment Service: ชำระเงินไม่สำเร็จ กรุณาลองใหม่', 'Payment Service: payment failed, please try again'), 'err');
      $('[data-ok]', body).onclick = () => success({ method: 'qr' });
      tick();
    };
    const card = () => {
      body.innerHTML = summary() + `<form class="form" novalidate>
        <div class="form-alert"></div>
        ${UI.field('cardNo', 'หมายเลขบัตรเครดิต', 'Card number', `<input inputmode="numeric" autocomplete="off" maxlength="19" placeholder="4111 1111 1111 1111">`, { req: true, hint: tt('ทดสอบ: 4111 1111 1111 1111 = สำเร็จ · 4000 0000 0000 0002 = ธนาคารปฏิเสธ', 'Test: 4111 1111 1111 1111 = success · 4000 0000 0000 0002 = declined') })}
        ${UI.field('holder', 'ชื่อผู้ถือบัตร', 'Cardholder name', `<input autocomplete="off" placeholder="SOMCHAI JAIDEE">`, { req: true })}
        <div class="fields">${UI.field('exp', 'วันหมดอายุ (MM/YY)', 'Expiry (MM/YY)', `<input maxlength="5" placeholder="12/28" autocomplete="off">`, { req: true })}
        ${UI.field('cvv', 'CVV', 'CVV', `<input inputmode="numeric" maxlength="3" placeholder="123" autocomplete="off" type="password">`, { req: true })}</div>
        <div class="row" style="justify-content:space-between"><button type="button" class="btn" data-back>← ${tt('เปลี่ยนช่องทาง', 'Change method')}</button><button class="btn btn-primary">${tt('ชำระเงิน', 'Pay')} ${money(opts.amount)}</button></div></form>`;
      const f = $('form', body);
      const cn = $('[data-field=cardNo] input', f);
      cn.addEventListener('input', () => { cn.value = cn.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); });
      const ex = $('[data-field=exp] input', f);
      ex.addEventListener('input', () => { let v = ex.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); ex.value = v; });
      $('[data-back]', f).onclick = choose;
      f.onsubmit = e => {
        e.preventDefault(); UI.clearErrors(f);
        try {
          UI.require(f, ['cardNo', 'holder', 'exp', 'cvv']);
          const n = cn.value.replace(/\D/g, '');
          if (n.length !== 16 || !luhn(n)) throw new AppError(tt('หมายเลขบัตรไม่ถูกต้อง', 'Invalid card number'), 'cardNo');
          const [mm, yy] = ex.value.split('/').map(Number);
          if (!(mm >= 1 && mm <= 12) || isNaN(yy)) throw new AppError(tt('รูปแบบวันหมดอายุไม่ถูกต้อง', 'Invalid expiry format'), 'exp');
          if (new Date(2000 + yy, mm, 1) <= new Date()) throw new AppError(tt('บัตรหมดอายุแล้ว', 'Card has expired'), 'exp');
          if (!/^\d{3}$/.test($('[data-field=cvv] input', f).value)) throw new AppError(tt('CVV ต้องเป็นตัวเลข 3 หลัก', 'CVV must be 3 digits'), 'cvv');
          if (n === '4000000000000002') throw new AppError(tt('Payment Service: ธนาคารผู้ออกบัตรปฏิเสธรายการ กรุณาใช้บัตรอื่น', 'Payment Service: card declined by the issuing bank. Please use another card.'));
          success({ method: 'card', last4: n.slice(-4) });
        } catch (err) { UI.showError(f, err); }
      };
      tick();
    };
    const success = result => {
      if (opts.holdUntil && Date.now() > opts.holdUntil) return timeout();
      clearInterval(timer);
      let txn;
      try { txn = opts.onSuccess(result); } catch (err) { UI.showError(body, err); return; }
      done = true;
      body.innerHTML = `<div class="center" style="padding:10px 0"><div style="font-size:40px">✓</div><h3>${tt('ชำระเงินสำเร็จ', 'Payment successful')}</h3>
        <p class="muted">${tt('เลขที่ธุรกรรม', 'Transaction no.')} <span class="mono">${esc(txn || '-')}</span><br>${tt('ช่องทาง', 'Method')}: ${methodName(result.method)}${result.last4 ? ' •••• ' + result.last4 : ''}</p></div>
        <button class="btn btn-primary btn-block" data-x>${tt('กลับสู่ระบบ', 'Return to system')}</button>`;
      $('[data-x]', body).onclick = () => { m.close(true); if (opts.after) opts.after(txn); };
    };
    choose();
    if (opts.holdUntil) timer = setInterval(tick, 1000);
    return m;
  },
  qrSvg(seed) {
    let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const r = Seed.rng(h), N = 25; let cells = '';
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#000"/>`;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const inF = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      if (!inF && r() > .52) cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="#000"/>`;
    }
    return `<svg viewBox="-2 -2 ${N + 4} ${N + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${N + 4}" height="${N + 4}" fill="#fff"/>${cells}${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}</svg>`;
  }
};

/* ---------- signature pad ---------- */
function signaturePad(canvas) {
  const ctx = canvas.getContext('2d'); let drawing = false, dirty = false;
  const fit = () => { const r = canvas.getBoundingClientRect(); canvas.width = r.width * 2; canvas.height = r.height * 2; ctx.scale(2, 2); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a'; };
  fit();
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => { drawing = true; canvas.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
  canvas.addEventListener('pointermove', e => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); dirty = true; });
  canvas.addEventListener('pointerup', () => drawing = false);
  return { clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; }, data() { return dirty ? canvas.toDataURL('image/png') : null; } };
}
