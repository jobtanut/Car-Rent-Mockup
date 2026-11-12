-- =============================================================================
-- ITDS262 · Section 1 · Group 6 · Car Rental Management System
-- D1 ผู้ใช้ · D3 อัตราค่าเช่า · D4 การเช่า · D5 การชำระเงิน · D6 การซ่อมบำรุง
-- MySQL 8.0.16+ / MariaDB 10.4+
--
-- Load 01-d2-cars.sql FIRST (it creates the database, branches, car_types and cars),
-- then this file:
--   mysql --default-character-set=utf8mb4 -u root -p < 01-d2-cars.sql
--   mysql --default-character-set=utf8mb4 -u root -p < 02-d1-d3-d6.sql
--
-- Seed data = the mock-up's demo data (Seed.build in Mock-up/js/core.js) as of 2026-11-08,
-- times in Bangkok local time.
-- =============================================================================

SET NAMES utf8mb4;
USE car_rental;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW  IF EXISTS v_daily_revenue;
DROP VIEW  IF EXISTS v_repair_cost_per_car;
DROP VIEW  IF EXISTS v_rental_detail;
DROP TABLE IF EXISTS job_progress;
DROP TABLE IF EXISTS maintenance_logs;
DROP TABLE IF EXISTS inspection_items;
DROP TABLE IF EXISTS maintenance_jobs;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS rentals;
DROP TABLE IF EXISTS rates;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- D1 ผู้ใช้ (users) — customers and staff in one table, told apart by role.
--   Walk-in customers created at the counter (DFD 1.3) have no login.
--   Staff who rent a car for themselves add their ID and licence once.
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  user_id        VARCHAR(10)  NOT NULL,              -- 'U101'
  username       VARCHAR(30)  NULL,
  password_hash  CHAR(64)     NULL,                  -- SHA-256 hex (demo); use bcrypt/argon2 in production
  role           ENUM('customer','office_employee','office_manager','mechanic','mechanic_manager','big_manager') NOT NULL,
  first_name     VARCHAR(60)  NOT NULL,
  last_name      VARCHAR(60)  NOT NULL,
  national_id    CHAR(13)     NULL,                  -- เลขบัตรประชาชน
  licence_no     CHAR(13)     NULL,                  -- เลขใบขับขี่
  phone          CHAR(10)     NULL,
  email          VARCHAR(120) NULL,
  emp_id         VARCHAR(10)  NULL,                  -- รหัสพนักงาน (staff only)
  position       VARCHAR(60)  NULL,                  -- ตำแหน่ง (staff only)
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_walk_in     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_national_id (national_id),
  UNIQUE KEY uq_users_emp_id (emp_id),
  KEY idx_users_role (role, status),
  CONSTRAINT chk_users_login     CHECK ((username IS NULL) = (password_hash IS NULL)),
  CONSTRAINT chk_users_national  CHECK (national_id IS NULL OR national_id REGEXP '^[0-9]{13}$'),
  CONSTRAINT chk_users_licence   CHECK (licence_no  IS NULL OR licence_no  REGEXP '^[0-9]{13}$'),
  CONSTRAINT chk_users_phone     CHECK (phone IS NULL OR phone REGEXP '^0[0-9]{9}$'),
  CONSTRAINT chk_users_customer  CHECK (role <> 'customer' OR (national_id IS NOT NULL AND licence_no IS NOT NULL)),
  CONSTRAINT chk_users_staff     CHECK (role = 'customer' OR emp_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- D3 อัตราค่าเช่า (rates) — one row per car type, set by the Office Manager (DFD 3.2)
-- -----------------------------------------------------------------------------
CREATE TABLE rates (
  type_id       VARCHAR(10)   NOT NULL,
  daily_rate    DECIMAL(10,2) NOT NULL,              -- รายวัน
  weekly_rate   DECIMAL(10,2) NOT NULL,              -- รายสัปดาห์
  monthly_rate  DECIMAL(10,2) NOT NULL,              -- รายเดือน
  deposit       DECIMAL(10,2) NOT NULL,              -- ค่ามัดจำ
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (type_id),
  CONSTRAINT fk_rates_type FOREIGN KEY (type_id) REFERENCES car_types (type_id) ON UPDATE CASCADE,
  CONSTRAINT chk_rates_positive CHECK (daily_rate > 0 AND weekly_rate > 0 AND monthly_rate > 0 AND deposit >= 0),
  CONSTRAINT chk_rates_weekly   CHECK (weekly_rate  <= daily_rate * 7),    -- a week never costs more than 7 days
  CONSTRAINT chk_rates_monthly  CHECK (monthly_rate <= daily_rate * 30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- D4 การเช่า (rentals) — booking + contract (1.5) + hand-over (2.6) + return (2.7)
-- -----------------------------------------------------------------------------
CREATE TABLE rentals (
  booking_id            VARCHAR(10)   NOT NULL,      -- 'BK1001'
  customer_id           VARCHAR(10)   NOT NULL,
  plate                 VARCHAR(12)   NOT NULL,
  type_id               VARCHAR(10)   NOT NULL,      -- car type at booking time (prices are per type)
  branch_id             CHAR(3)       NOT NULL,
  pickup_at             DATETIME      NOT NULL,      -- วันเวลารับรถ
  return_at             DATETIME      NOT NULL,      -- วันเวลาคืนรถ (ตามสัญญา)
  rental_days           SMALLINT UNSIGNED NOT NULL,
  rent_total            DECIMAL(10,2) NOT NULL,      -- ค่าเช่า
  deposit               DECIMAL(10,2) NOT NULL,      -- ค่ามัดจำ
  status                ENUM('pending_payment','confirmed','picked_up','returned','cancelled') NOT NULL DEFAULT 'pending_payment',
  hold_until            DATETIME      NULL,          -- 15-minute payment hold
  -- contract (DFD 1.5)
  contract_no           VARCHAR(10)   NULL,
  contract_generated_at DATETIME      NULL,
  contract_signed_at    DATETIME      NULL,
  contract_signed_name  VARCHAR(120)  NULL,
  -- hand-over (DFD 2.6)
  handover_at           DATETIME      NULL,
  handover_by           VARCHAR(10)   NULL,
  handover_mileage_km   INT UNSIGNED  NULL,
  handover_fuel         TINYINT UNSIGNED NULL,       -- eighths of a tank
  -- return (DFD 2.7)
  returned_at           DATETIME      NULL,
  returned_by           VARCHAR(10)   NULL,
  return_mileage_km     INT UNSIGNED  NULL,
  return_fuel           TINYINT UNSIGNED NULL,
  return_damaged        TINYINT(1)    NULL,
  return_note           VARCHAR(255)  NULL,
  late_fee              DECIMAL(10,2) NOT NULL DEFAULT 0,   -- ค่าปรับคืนช้า
  damage_charge         DECIMAL(10,2) NOT NULL DEFAULT 0,   -- ค่าความเสียหาย
  deposit_refund        DECIMAL(10,2) NOT NULL DEFAULT 0,
  deposit_status        ENUM('none','held','refunded','settled') NOT NULL DEFAULT 'none',
  -- cancellation (DFD 2.4)
  cancel_refund         DECIMAL(10,2) NOT NULL DEFAULT 0,
  cancel_reason         VARCHAR(255)  NULL,
  cancelled_at          DATETIME      NULL,
  created_by            VARCHAR(10)   NOT NULL,      -- the customer, or the office employee for walk-ins
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (booking_id),
  UNIQUE KEY uq_rentals_contract (contract_no),
  KEY idx_rentals_car_period (plate, pickup_at, return_at),      -- availability check (DFD 1.2)
  KEY idx_rentals_customer (customer_id, pickup_at),
  KEY idx_rentals_status (status, pickup_at),
  CONSTRAINT fk_rentals_customer FOREIGN KEY (customer_id) REFERENCES users (user_id),
  CONSTRAINT fk_rentals_car      FOREIGN KEY (plate)       REFERENCES cars (plate) ON UPDATE CASCADE,
  CONSTRAINT fk_rentals_type     FOREIGN KEY (type_id)     REFERENCES car_types (type_id) ON UPDATE CASCADE,
  CONSTRAINT fk_rentals_branch   FOREIGN KEY (branch_id)   REFERENCES branches (branch_id) ON UPDATE CASCADE,
  CONSTRAINT fk_rentals_handover FOREIGN KEY (handover_by) REFERENCES users (user_id),
  CONSTRAINT fk_rentals_returner FOREIGN KEY (returned_by) REFERENCES users (user_id),
  CONSTRAINT fk_rentals_creator  FOREIGN KEY (created_by)  REFERENCES users (user_id),
  CONSTRAINT chk_rentals_period   CHECK (return_at > pickup_at),
  CONSTRAINT chk_rentals_days     CHECK (rental_days BETWEEN 1 AND 90),
  CONSTRAINT chk_rentals_money    CHECK (rent_total >= 0 AND deposit >= 0 AND late_fee >= 0 AND damage_charge >= 0 AND deposit_refund >= 0 AND cancel_refund >= 0),
  CONSTRAINT chk_rentals_fuel     CHECK ((handover_fuel IS NULL OR handover_fuel <= 8) AND (return_fuel IS NULL OR return_fuel <= 8)),
  CONSTRAINT chk_rentals_odometer CHECK (return_mileage_km IS NULL OR handover_mileage_km IS NULL OR return_mileage_km >= handover_mileage_km),
  CONSTRAINT chk_rentals_handover CHECK (status NOT IN ('picked_up','returned') OR handover_at IS NOT NULL),
  CONSTRAINT chk_rentals_returned CHECK (status <> 'returned'  OR returned_at  IS NOT NULL),
  CONSTRAINT chk_rentals_cancel   CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- D5 การชำระเงิน (payments) — one row per amount charged or refunded.
--   One Payment Service transaction can carry several rows (rent + deposit share
--   one txn_id), so txn_id is unique only together with kind.
--   Money in is positive; money back to the customer (refunds) is negative.
--   method 'deposit' = deducted from the deposit the company already holds.
-- -----------------------------------------------------------------------------
CREATE TABLE payments (
  payment_id  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  txn_id      VARCHAR(12)   NOT NULL,                -- 'TXN50001' from Payment Service
  booking_id  VARCHAR(10)   NOT NULL,
  kind        ENUM('rent','deposit','difference','refund_difference','refund','deposit_refund','late_fee','damage_charge') NOT NULL,
  method      ENUM('card','qr','counter','deposit','refund') NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  status      ENUM('success','failed') NOT NULL DEFAULT 'success',
  paid_at     DATETIME      NOT NULL,
  PRIMARY KEY (payment_id),
  UNIQUE KEY uq_payments_txn_kind (txn_id, kind),
  KEY idx_payments_booking (booking_id),
  KEY idx_payments_date (paid_at, kind),
  CONSTRAINT fk_payments_rental FOREIGN KEY (booking_id) REFERENCES rentals (booking_id) ON UPDATE CASCADE,
  CONSTRAINT chk_payments_sign CHECK (
       (kind IN ('refund','refund_difference','deposit_refund') AND amount < 0)
    OR (kind NOT IN ('refund','refund_difference','deposit_refund') AND amount > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- D6 การซ่อมบำรุง (maintenance) — DFD 3.3 assign · 3.4 inspect/repair · 3.5 approve
-- -----------------------------------------------------------------------------
CREATE TABLE maintenance_jobs (
  job_id             VARCHAR(10)   NOT NULL,         -- 'MT101'
  plate              VARCHAR(12)   NOT NULL,
  booking_id         VARCHAR(10)   NULL,             -- set when the damage was found at a return
  source             ENUM('return','manager','schedule') NOT NULL,
  damage             VARCHAR(255)  NOT NULL,         -- ข้อมูลความเสียหาย / งานที่ต้องทำ
  status             ENUM('unassigned','assigned','in_progress','sent_to_shop','done','approved') NOT NULL DEFAULT 'unassigned',
  repair_mode        ENUM('inhouse','shop') NULL,    -- ซ่อมภายใน / ส่งอู่
  assigned_to        VARCHAR(10)   NULL,             -- mechanic
  assigned_by        VARCHAR(10)   NULL,             -- mechanic manager
  assigned_at        DATETIME      NULL,
  inspection_result  ENUM('pass','fail') NULL,
  inspection_note    VARCHAR(255)  NULL,
  inspection_damage  VARCHAR(255)  NULL,
  inspected_at       DATETIME      NULL,
  inspected_by       VARCHAR(10)   NULL,
  shop_result        VARCHAR(255)  NULL,             -- ผลการซ่อมจากอู่
  shop_cost          DECIMAL(10,2) NULL,             -- ค่าซ่อมจากอู่
  shop_returned_at   DATETIME      NULL,
  approved_by        VARCHAR(10)   NULL,             -- การอนุมัติการใช้งานรถ (3.5)
  approved_at        DATETIME      NULL,
  PRIMARY KEY (job_id),
  KEY idx_jobs_car (plate, status),
  KEY idx_jobs_mechanic (assigned_to, status),
  CONSTRAINT fk_jobs_car       FOREIGN KEY (plate)        REFERENCES cars (plate) ON UPDATE CASCADE,
  CONSTRAINT fk_jobs_rental    FOREIGN KEY (booking_id)   REFERENCES rentals (booking_id) ON UPDATE CASCADE,
  CONSTRAINT fk_jobs_mechanic  FOREIGN KEY (assigned_to)  REFERENCES users (user_id),
  CONSTRAINT fk_jobs_assigner  FOREIGN KEY (assigned_by)  REFERENCES users (user_id),
  CONSTRAINT fk_jobs_inspector FOREIGN KEY (inspected_by) REFERENCES users (user_id),
  CONSTRAINT fk_jobs_approver  FOREIGN KEY (approved_by)  REFERENCES users (user_id),
  CONSTRAINT chk_jobs_assigned CHECK (status = 'unassigned' OR (assigned_to IS NOT NULL AND repair_mode IS NOT NULL)),
  CONSTRAINT chk_jobs_approved CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT chk_jobs_shopcost CHECK (shop_cost IS NULL OR shop_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- pass/fail per check item (ยางและล้อ, ระบบเบรก, ไฟส่องสว่าง, เครื่องยนต์/ของเหลว, ตัวถังและกระจก)
CREATE TABLE inspection_items (
  job_id  VARCHAR(10) NOT NULL,
  item    ENUM('tyres','brakes','lights','engine','body') NOT NULL,
  passed  TINYINT(1)  NOT NULL,
  PRIMARY KEY (job_id, item),
  CONSTRAINT fk_items_job FOREIGN KEY (job_id) REFERENCES maintenance_jobs (job_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ข้อมูลการบำรุงรักษา: each piece of work recorded by a mechanic, with its cost
CREATE TABLE maintenance_logs (
  log_id     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  job_id     VARCHAR(10)   NOT NULL,
  logged_at  DATETIME      NOT NULL,
  logged_by  VARCHAR(10)   NOT NULL,
  work       VARCHAR(255)  NOT NULL,
  parts      VARCHAR(255)  NULL,
  cost       DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (log_id),
  KEY idx_logs_job (job_id),
  CONSTRAINT fk_logs_job FOREIGN KEY (job_id)    REFERENCES maintenance_jobs (job_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_logs_by  FOREIGN KEY (logged_by) REFERENCES users (user_id),
  CONSTRAINT chk_logs_cost CHECK (cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- สถานะความคืบหน้า: progress updates reported on a job
CREATE TABLE job_progress (
  progress_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id       VARCHAR(10)  NOT NULL,
  reported_at  DATETIME     NOT NULL,
  reported_by  VARCHAR(10)  NULL,
  status       ENUM('unassigned','assigned','in_progress','sent_to_shop','done','approved') NOT NULL,
  note         VARCHAR(255) NULL,
  PRIMARY KEY (progress_id),
  KEY idx_progress_job (job_id, reported_at),
  CONSTRAINT fk_progress_job FOREIGN KEY (job_id)      REFERENCES maintenance_jobs (job_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_progress_by  FOREIGN KEY (reported_by) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Seed data (generated from the mock-up)
-- =============================================================================
-- D1 ผู้ใช้ (users) — demo password for every account: pass1234 (stored as SHA-256 for the demo only)
INSERT INTO users (user_id, username, password_hash, role, first_name, last_name, national_id, licence_no, phone, email, emp_id, position, status, is_walk_in, created_at) VALUES
  ('U101', 'office1', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'office_employee', 'นภา', 'สุขสวัสดิ์', NULL, NULL, '0861355241', 'office1@carrental.example', 'EMP-201', 'พนักงานออฟฟิศ', 'active', 0, '2025-10-04 10:00:00'),
  ('U102', 'office2', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'office_employee', 'ธนพล', 'ศรีสุข', NULL, NULL, '0851694514', 'office2@carrental.example', 'EMP-202', 'พนักงานออฟฟิศ', 'active', 0, '2025-10-04 10:00:00'),
  ('U103', 'manager1', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'office_manager', 'วรรณา', 'ทองดี', NULL, NULL, '0872699929', 'manager1@carrental.example', 'EMP-101', 'ผู้จัดการออฟฟิศ', 'active', 0, '2025-10-04 10:00:00'),
  ('U104', 'mech1', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'mechanic', 'วิชัย', 'ช่างดี', NULL, NULL, '0860530419', 'mech1@carrental.example', 'EMP-301', 'ช่างซ่อมบำรุง', 'active', 0, '2025-10-04 10:00:00'),
  ('U105', 'mech2', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'mechanic', 'อนันต์', 'แก้วมณี', NULL, NULL, '0842982916', 'mech2@carrental.example', 'EMP-302', 'ช่างซ่อมบำรุง', 'active', 0, '2025-10-04 10:00:00'),
  ('U106', 'mechlead', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'mechanic_manager', 'สมศักดิ์', 'เครื่องยนต์', NULL, NULL, '0813840764', 'mechlead@carrental.example', 'EMP-300', 'หัวหน้าช่าง', 'active', 0, '2025-10-04 10:00:00'),
  ('U107', 'ceo', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'big_manager', 'ปรียา', 'วัฒนกิจ', NULL, NULL, '0856326041', 'ceo@carrental.example', 'EMP-001', 'ผู้บริหารระดับสูง', 'active', 0, '2025-10-04 10:00:00'),
  ('U108', 'office9', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'office_employee', 'กิตติ', 'พ้นสภาพ', NULL, NULL, '0823440635', 'office9@carrental.example', 'EMP-209', 'พนักงานออฟฟิศ', 'inactive', 0, '2025-10-04 10:00:00'),
  ('U109', 'somchai', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'สมชาย', 'ใจดี', '4157980195631', '6547046811389', '0893660846', 'somchai@mail.example', NULL, NULL, 'active', 0, '2026-04-22 10:00:00'),
  ('U110', 'suda', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'สุดา', 'มีสุข', '2974463210109', '6129441443690', '0818965893', 'suda@mail.example', NULL, NULL, 'active', 0, '2026-04-22 10:00:00'),
  ('U111', 'cust3', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'ณัฐ', 'วงศ์ไทย', '3480997697513', '6360154544072', '0848938963', 'cust3@mail.example', NULL, NULL, 'active', 0, '2026-07-04 10:00:00'),
  ('U112', 'cust4', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'พิมพ์ชนก', 'ศรีงาม', '2283940787005', '6569499062117', '0813150606', 'cust4@mail.example', NULL, NULL, 'active', 0, '2026-08-22 10:00:00'),
  ('U113', 'cust5', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'อรรถพล', 'จันทร์เพ็ญ', '2696163528205', '6279599383752', '0848728506', 'cust5@mail.example', NULL, NULL, 'active', 0, '2026-10-28 10:00:00'),
  ('U114', 'cust6', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'กมลชนก', 'ใจงาม', '6271905349995', '6573027508914', '0811582900', 'cust6@mail.example', NULL, NULL, 'active', 0, '2026-10-11 10:00:00'),
  ('U115', 'cust7', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'ปิยะ', 'รัตนา', '6010422442843', '6310586730553', '0838065453', 'cust7@mail.example', NULL, NULL, 'active', 0, '2026-10-28 10:00:00'),
  ('U116', 'cust8', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'ศิริพร', 'บุญมา', '2288318096457', '6318925119912', '0841143735', 'cust8@mail.example', NULL, NULL, 'active', 0, '2026-08-13 10:00:00'),
  ('U117', 'cust9', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'ธีรวัฒน์', 'สายสุวรรณ', '3887564453025', '6799429488251', '0839076110', 'cust9@mail.example', NULL, NULL, 'active', 0, '2026-06-06 10:00:00'),
  ('U118', 'cust10', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'ชลธิชา', 'ทองคำ', '1371037093939', '6187822525808', '0810443860', 'cust10@mail.example', NULL, NULL, 'active', 0, '2026-10-23 10:00:00'),
  ('U119', 'cust11', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'วีรยุทธ', 'แสงทอง', '7077844878662', '6417961681657', '0827027941', 'cust11@mail.example', NULL, NULL, 'active', 0, '2026-09-09 10:00:00'),
  ('U120', 'cust12', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'มานี', 'มานะ', '1995313342452', '6913472039018', '0876310113', 'cust12@mail.example', NULL, NULL, 'active', 0, '2026-11-07 10:00:00'),
  ('U121', 'cust13', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'John', 'Smith', '1475367118946', '6544593673711', '0899965149', 'cust13@mail.example', NULL, NULL, 'active', 0, '2026-11-01 10:00:00'),
  ('U122', 'cust14', 'bd94dcda26fccb4e68d6a31f9b5aac0b571ae266d822620e901ef7ebe3a11d4f', 'customer', 'Aiko', 'Tanaka', '1629620417448', '6428512145578', '0856821481', 'cust14@mail.example', NULL, NULL, 'active', 0, '2026-09-07 10:00:00');

-- D3 อัตราค่าเช่า (rates)
INSERT INTO rates (type_id, daily_rate, weekly_rate, monthly_rate, deposit) VALUES
  ('economy', 900, 5600, 19000, 3000),
  ('sedan', 1500, 9500, 32000, 5000),
  ('suv', 2200, 14000, 48000, 8000),
  ('van', 2500, 16000, 55000, 8000),
  ('ev', 1800, 11500, 39000, 5000);

-- D4 การเช่า (rentals)
INSERT INTO rentals (booking_id, customer_id, plate, type_id, branch_id, pickup_at, return_at, rental_days, rent_total, deposit, status, hold_until, contract_no, contract_generated_at, contract_signed_at, contract_signed_name, handover_at, handover_by, handover_mileage_km, handover_fuel, returned_at, returned_by, return_mileage_km, return_fuel, return_damaged, return_note, late_fee, damage_charge, deposit_refund, deposit_status, cancel_refund, cancel_reason, cancelled_at, created_by, created_at) VALUES
  ('BK1021', 'U120', 'กง 7890', 'suv', 'SVB', '2026-05-17 11:00:00', '2026-05-21 11:00:00', 4, 8800, 8000, 'returned', NULL, 'CT521', '2026-05-08 11:10:00', '2026-05-08 11:15:00', 'มานี มานะ', '2026-05-17 11:00:00', 'U101', 19811, 8, '2026-05-21 11:00:00', 'U101', 20243, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U120', '2026-05-08 11:00:00'),
  ('BK1018', 'U114', 'ขค 3456', 'sedan', 'STN', '2026-05-13 13:00:00', '2026-05-16 13:00:00', 3, 4500, 5000, 'returned', NULL, 'CT518', '2026-05-12 13:10:00', '2026-05-12 13:15:00', 'กมลชนก ใจงาม', '2026-05-13 13:00:00', 'U101', 48494, 8, '2026-05-16 13:00:00', 'U101', 48782, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U114', '2026-05-12 13:00:00'),
  ('BK1008', 'U119', 'นข 5566', 'van', 'SVB', '2026-05-18 12:00:00', '2026-05-24 12:00:00', 6, 15000, 8000, 'returned', NULL, 'CT508', '2026-05-15 12:10:00', '2026-05-15 12:15:00', 'วีรยุทธ แสงทอง', '2026-05-18 12:00:00', 'U101', 43433, 8, '2026-05-24 12:00:00', 'U101', 44879, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U119', '2026-05-15 12:00:00'),
  ('BK1057', 'U112', 'กข 5678', 'economy', 'STN', '2026-05-17 12:00:00', '2026-05-20 12:00:00', 3, 2700, 3000, 'returned', NULL, 'CT557', '2026-05-16 12:10:00', '2026-05-16 12:15:00', 'พิมพ์ชนก ศรีงาม', '2026-05-17 12:00:00', 'U101', 26081, 8, '2026-05-20 12:00:00', 'U101', 26441, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U112', '2026-05-16 12:00:00'),
  ('BK1043', 'U117', '9กข 2020', 'ev', 'SVB', '2026-05-19 12:00:00', '2026-05-21 12:00:00', 2, 3600, 5000, 'returned', NULL, 'CT543', '2026-05-17 12:10:00', '2026-05-17 12:15:00', 'ธีรวัฒน์ สายสุวรรณ', '2026-05-19 12:00:00', 'U101', 50724, 8, '2026-05-21 12:00:00', 'U101', 50994, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U117', '2026-05-17 12:00:00'),
  ('BK1005', 'U113', 'ขค 3456', 'sedan', 'STN', '2026-05-21 11:00:00', '2026-05-27 11:00:00', 6, 9000, 5000, 'returned', NULL, 'CT505', '2026-05-19 11:10:00', '2026-05-19 11:15:00', 'อรรถพล จันทร์เพ็ญ', '2026-05-21 11:00:00', 'U101', 48055, 8, '2026-05-27 11:00:00', 'U101', 49039, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U113', '2026-05-19 11:00:00'),
  ('BK1002', 'U109', '9กก 1010', 'ev', 'STN', '2026-05-29 09:00:00', '2026-06-03 09:00:00', 5, 9000, 5000, 'returned', NULL, 'CT502', '2026-05-20 09:10:00', '2026-05-20 09:15:00', 'สมชาย ใจดี', '2026-05-29 09:00:00', 'U101', 30616, 8, '2026-06-03 09:00:00', 'U101', 31296, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U109', '2026-05-20 09:00:00'),
  ('BK1039', 'U109', 'ฆฆ 7788', 'sedan', 'HKT', '2026-05-25 09:00:00', '2026-05-29 09:00:00', 4, 6000, 5000, 'cancelled', NULL, 'CT539', '2026-05-20 09:10:00', '2026-05-20 09:15:00', 'สมชาย ใจดี', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'refunded', 6000, 'เปลี่ยนแผนการเดินทาง', '2026-05-22 09:00:00', 'U109', '2026-05-20 09:00:00'),
  ('BK1050', 'U116', 'ชช 3344', 'suv', 'HKT', '2026-05-29 10:00:00', '2026-06-01 10:00:00', 3, 6600, 8000, 'returned', NULL, 'CT550', '2026-05-20 10:10:00', '2026-05-20 10:15:00', 'ศิริพร บุญมา', '2026-05-29 10:00:00', 'U101', 56689, 8, '2026-06-01 10:00:00', 'U101', 57055, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U116', '2026-05-20 10:00:00'),
  ('BK1015', 'U112', 'กข 1234', 'economy', 'SVB', '2026-05-31 13:00:00', '2026-06-01 13:00:00', 1, 900, 3000, 'cancelled', NULL, 'CT515', '2026-05-21 13:10:00', '2026-05-21 13:15:00', 'พิมพ์ชนก ศรีงาม', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'refunded', 900, 'เปลี่ยนแผนการเดินทาง', '2026-05-28 13:00:00', 'U112', '2026-05-21 13:00:00'),
  ('BK1058', 'U111', 'ขค 3456', 'sedan', 'STN', '2026-06-01 12:00:00', '2026-06-04 12:00:00', 3, 4500, 5000, 'cancelled', NULL, 'CT558', '2026-05-22 12:10:00', '2026-05-22 12:15:00', 'ณัฐ วงศ์ไทย', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'refunded', 4500, 'เปลี่ยนแผนการเดินทาง', '2026-05-29 12:00:00', 'U111', '2026-05-22 12:00:00'),
  ('BK1012', 'U112', 'งก 1122', 'suv', 'CNX', '2026-06-03 10:00:00', '2026-06-06 10:00:00', 3, 6600, 8000, 'returned', NULL, 'CT512', '2026-05-29 10:10:00', '2026-05-29 10:15:00', 'พิมพ์ชนก ศรีงาม', '2026-06-03 10:00:00', 'U101', 40213, 8, '2026-06-06 10:00:00', 'U101', 40675, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U112', '2026-05-29 10:00:00'),
  ('BK1025', 'U118', '1กค 2468', 'economy', 'CNX', '2026-06-02 10:00:00', '2026-06-06 10:00:00', 4, 3600, 3000, 'returned', NULL, 'CT525', '2026-05-31 10:10:00', '2026-05-31 10:15:00', 'ชลธิชา ทองคำ', '2026-06-02 10:00:00', 'U101', 19908, 8, '2026-06-06 10:00:00', 'U101', 20892, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U118', '2026-05-31 10:00:00'),
  ('BK1032', 'U111', '9กข 2020', 'ev', 'SVB', '2026-06-05 09:00:00', '2026-06-09 09:00:00', 4, 7200, 5000, 'returned', NULL, 'CT532', '2026-06-02 09:10:00', '2026-06-02 09:15:00', 'ณัฐ วงศ์ไทย', '2026-06-05 09:00:00', 'U101', 50574, 8, '2026-06-09 09:00:00', 'U101', 51010, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U111', '2026-06-02 09:00:00'),
  ('BK1052', 'U121', 'กข 5678', 'economy', 'STN', '2026-06-05 13:00:00', '2026-06-06 13:00:00', 1, 900, 3000, 'returned', NULL, 'CT552', '2026-06-04 13:10:00', '2026-06-04 13:15:00', 'John Smith', '2026-06-05 13:00:00', 'U101', 25806, 8, '2026-06-06 13:00:00', 'U101', 25956, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U121', '2026-06-04 13:00:00'),
  ('BK1010', 'U115', '1กค 2468', 'economy', 'CNX', '2026-06-15 10:00:00', '2026-06-16 10:00:00', 1, 900, 3000, 'returned', NULL, 'CT510', '2026-06-12 10:10:00', '2026-06-12 10:15:00', 'ปิยะ รัตนา', '2026-06-15 10:00:00', 'U101', 19888, 8, '2026-06-16 10:00:00', 'U101', 20035, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U115', '2026-06-12 10:00:00'),
  ('BK1062', 'U116', 'ชช 3344', 'suv', 'HKT', '2026-06-18 12:00:00', '2026-06-23 12:00:00', 5, 11000, 8000, 'returned', NULL, 'CT562', '2026-06-12 12:10:00', '2026-06-12 12:15:00', 'ศิริพร บุญมา', '2026-06-18 12:00:00', 'U101', 56840, 8, '2026-06-23 15:00:00', 'U101', 57730, 7, 0, NULL, 660, 0, 7340, 'refunded', 0, NULL, NULL, 'U116', '2026-06-12 12:00:00'),
  ('BK1017', 'U119', 'นข 5566', 'van', 'SVB', '2026-06-19 13:00:00', '2026-06-24 13:00:00', 5, 12500, 8000, 'returned', NULL, 'CT517', '2026-06-14 13:10:00', '2026-06-14 13:15:00', 'วีรยุทธ แสงทอง', '2026-06-19 13:00:00', 'U101', 42834, 8, '2026-06-24 16:00:00', 'U101', 43444, 7, 0, NULL, 750, 0, 7250, 'refunded', 0, NULL, NULL, 'U119', '2026-06-14 13:00:00'),
  ('BK1009', 'U117', 'ชช 3344', 'suv', 'HKT', '2026-06-24 13:00:00', '2026-06-27 13:00:00', 3, 6600, 8000, 'returned', NULL, 'CT509', '2026-06-21 13:10:00', '2026-06-21 13:15:00', 'ธีรวัฒน์ สายสุวรรณ', '2026-06-24 13:00:00', 'U101', 56625, 8, '2026-06-27 13:00:00', 'U101', 57042, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U117', '2026-06-21 13:00:00'),
  ('BK1007', 'U112', 'นข 5566', 'van', 'SVB', '2026-07-01 11:00:00', '2026-07-06 11:00:00', 5, 12500, 8000, 'cancelled', NULL, 'CT507', '2026-06-23 11:10:00', '2026-06-23 11:15:00', 'พิมพ์ชนก ศรีงาม', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'refunded', 12500, 'เปลี่ยนแผนการเดินทาง', '2026-06-28 11:00:00', 'U112', '2026-06-23 11:00:00'),
  ('BK1030', 'U120', 'ฆฆ 7788', 'sedan', 'HKT', '2026-06-29 12:00:00', '2026-07-05 12:00:00', 6, 9000, 5000, 'returned', NULL, 'CT530', '2026-06-27 12:10:00', '2026-06-27 12:15:00', 'มานี มานะ', '2026-06-29 12:00:00', 'U101', 22702, 8, '2026-07-05 15:00:00', 'U101', 23248, 7, 0, NULL, 450, 0, 4550, 'refunded', 0, NULL, NULL, 'U120', '2026-06-27 12:00:00'),
  ('BK1023', 'U122', 'กง 7890', 'suv', 'SVB', '2026-07-05 11:00:00', '2026-07-09 11:00:00', 4, 8800, 8000, 'cancelled', NULL, 'CT523', '2026-06-28 11:10:00', '2026-06-28 11:15:00', 'Aiko Tanaka', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'refunded', 8800, 'เปลี่ยนแผนการเดินทาง', '2026-07-02 11:00:00', 'U122', '2026-06-28 11:00:00'),
  ('BK1035', 'U114', 'กข 1234', 'economy', 'SVB', '2026-07-07 10:00:00', '2026-07-10 10:00:00', 3, 2700, 3000, 'returned', NULL, 'CT535', '2026-06-29 10:10:00', '2026-06-29 10:15:00', 'กมลชนก ใจงาม', '2026-07-07 10:00:00', 'U101', 34900, 8, '2026-07-10 10:00:00', 'U101', 35383, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U114', '2026-06-29 10:00:00'),
  ('BK1045', 'U112', 'ฮก 8899', 'van', 'STN', '2026-07-06 14:00:00', '2026-07-12 14:00:00', 6, 15000, 8000, 'returned', NULL, 'CT545', '2026-07-03 14:10:00', '2026-07-03 14:15:00', 'พิมพ์ชนก ศรีงาม', '2026-07-06 14:00:00', 'U101', 28701, 8, '2026-07-12 14:00:00', 'U101', 29925, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U112', '2026-07-03 14:00:00'),
  ('BK1044', 'U117', 'ฆฆ 7788', 'sedan', 'HKT', '2026-07-11 11:00:00', '2026-07-12 11:00:00', 1, 1500, 5000, 'cancelled', NULL, 'CT544', '2026-07-05 11:10:00', '2026-07-05 11:15:00', 'ธีรวัฒน์ สายสุวรรณ', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'refunded', 1500, 'เปลี่ยนแผนการเดินทาง', '2026-07-08 11:00:00', 'U117', '2026-07-05 11:00:00'),
  ('BK1004', 'U122', 'ขก 9012', 'sedan', 'SVB', '2026-07-11 13:00:00', '2026-07-13 13:00:00', 2, 3000, 5000, 'returned', NULL, 'CT504', '2026-07-10 13:10:00', '2026-07-10 13:15:00', 'Aiko Tanaka', '2026-07-11 13:00:00', 'U101', 16836, 8, '2026-07-13 13:00:00', 'U101', 17146, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U122', '2026-07-10 13:00:00'),
  ('BK1038', 'U109', 'ขก 9012', 'sedan', 'SVB', '2026-07-18 14:00:00', '2026-07-19 14:00:00', 1, 1500, 5000, 'returned', NULL, 'CT538', '2026-07-10 14:10:00', '2026-07-10 14:15:00', 'สมชาย ใจดี', '2026-07-18 14:00:00', 'U101', 16240, 8, '2026-07-19 14:00:00', 'U101', 16434, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U109', '2026-07-10 14:00:00'),
  ('BK1020', 'U113', 'กข 5678', 'economy', 'STN', '2026-07-17 12:00:00', '2026-07-21 12:00:00', 4, 3600, 3000, 'returned', NULL, 'CT520', '2026-07-11 12:10:00', '2026-07-11 12:15:00', 'อรรถพล จันทร์เพ็ญ', '2026-07-17 12:00:00', 'U101', 25985, 8, '2026-07-21 12:00:00', 'U101', 26729, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U113', '2026-07-11 12:00:00'),
  ('BK1041', 'U113', '1กค 2468', 'economy', 'CNX', '2026-07-29 14:00:00', '2026-08-03 14:00:00', 5, 4500, 3000, 'cancelled', NULL, 'CT541', '2026-07-20 14:10:00', '2026-07-20 14:15:00', 'อรรถพล จันทร์เพ็ญ', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'refunded', 4500, 'เปลี่ยนแผนการเดินทาง', '2026-07-26 14:00:00', 'U113', '2026-07-20 14:00:00'),
  ('BK1046', 'U116', 'กข 5678', 'economy', 'STN', '2026-07-22 09:00:00', '2026-07-28 09:00:00', 6, 5400, 3000, 'returned', NULL, 'CT546', '2026-07-21 09:10:00', '2026-07-21 09:15:00', 'ศิริพร บุญมา', '2026-07-22 09:00:00', 'U101', 26080, 8, '2026-07-28 09:00:00', 'U101', 26854, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U116', '2026-07-21 09:00:00'),
  ('BK1036', 'U119', 'งก 1122', 'suv', 'CNX', '2026-07-27 09:00:00', '2026-07-28 09:00:00', 1, 2200, 8000, 'returned', NULL, 'CT536', '2026-07-22 09:10:00', '2026-07-22 09:15:00', 'วีรยุทธ แสงทอง', '2026-07-27 09:00:00', 'U101', 40333, 8, '2026-07-28 12:00:00', 'U101', 40527, 7, 0, NULL, 660, 0, 7340, 'refunded', 0, NULL, NULL, 'U119', '2026-07-22 09:00:00'),
  ('BK1022', 'U121', 'ขค 3456', 'sedan', 'STN', '2026-08-02 12:00:00', '2026-08-07 12:00:00', 5, 7500, 5000, 'returned', NULL, 'CT522', '2026-07-25 12:10:00', '2026-07-25 12:15:00', 'John Smith', '2026-08-02 12:00:00', 'U101', 47787, 8, '2026-08-07 12:00:00', 'U101', 48607, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U121', '2026-07-25 12:00:00'),
  ('BK1056', 'U118', 'นข 5566', 'van', 'SVB', '2026-07-29 11:00:00', '2026-08-02 11:00:00', 4, 10000, 8000, 'returned', NULL, 'CT556', '2026-07-26 11:10:00', '2026-07-26 11:15:00', 'ชลธิชา ทองคำ', '2026-07-29 11:00:00', 'U101', 42811, 8, '2026-08-02 11:00:00', 'U101', 43659, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U118', '2026-07-26 11:00:00'),
  ('BK1031', 'U109', 'นข 5566', 'van', 'SVB', '2026-08-03 12:00:00', '2026-08-08 12:00:00', 5, 12500, 8000, 'returned', NULL, 'CT531', '2026-07-26 12:10:00', '2026-07-26 12:15:00', 'สมชาย ใจดี', '2026-08-03 12:00:00', 'U101', 42648, 8, '2026-08-08 12:00:00', 'U101', 43958, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U109', '2026-07-26 12:00:00'),
  ('BK1006', 'U117', 'ฮก 8899', 'van', 'STN', '2026-08-03 11:00:00', '2026-08-08 11:00:00', 5, 12500, 8000, 'returned', NULL, 'CT506', '2026-07-30 11:10:00', '2026-07-30 11:15:00', 'ธีรวัฒน์ สายสุวรรณ', '2026-08-03 11:00:00', 'U101', 28795, 8, '2026-08-08 11:00:00', 'U101', 29245, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U117', '2026-07-30 11:00:00'),
  ('BK1040', 'U110', 'กง 7890', 'suv', 'SVB', '2026-08-03 09:00:00', '2026-08-08 09:00:00', 5, 11000, 8000, 'returned', NULL, 'CT540', '2026-08-02 09:10:00', '2026-08-02 09:15:00', 'สุดา มีสุข', '2026-08-03 09:00:00', 'U101', 20131, 8, '2026-08-08 09:00:00', 'U101', 20801, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U110', '2026-08-02 09:00:00'),
  ('BK1048', 'U109', 'ขก 9012', 'sedan', 'SVB', '2026-08-10 11:00:00', '2026-08-15 11:00:00', 5, 7500, 5000, 'returned', NULL, 'CT548', '2026-08-05 11:10:00', '2026-08-05 11:15:00', 'สมชาย ใจดี', '2026-08-10 11:00:00', 'U101', 16145, 8, '2026-08-15 11:00:00', 'U101', 17250, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U109', '2026-08-05 11:00:00'),
  ('BK1026', 'U110', '1กค 2468', 'economy', 'CNX', '2026-08-13 13:00:00', '2026-08-16 13:00:00', 3, 2700, 3000, 'returned', NULL, 'CT526', '2026-08-07 13:10:00', '2026-08-07 13:15:00', 'สุดา มีสุข', '2026-08-13 13:00:00', 'U101', 20315, 8, '2026-08-16 13:00:00', 'U101', 21023, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U110', '2026-08-07 13:00:00'),
  ('BK1013', 'U118', 'งก 1122', 'suv', 'CNX', '2026-08-16 13:00:00', '2026-08-19 13:00:00', 3, 6600, 8000, 'returned', NULL, 'CT513', '2026-08-13 13:10:00', '2026-08-13 13:15:00', 'ชลธิชา ทองคำ', '2026-08-16 13:00:00', 'U101', 40798, 8, '2026-08-19 16:00:00', 'U101', 41122, 7, 0, NULL, 660, 0, 7340, 'refunded', 0, NULL, NULL, 'U118', '2026-08-13 13:00:00'),
  ('BK1060', 'U117', 'ชช 3344', 'suv', 'HKT', '2026-08-22 13:00:00', '2026-08-27 13:00:00', 5, 11000, 8000, 'returned', NULL, 'CT560', '2026-08-14 13:10:00', '2026-08-14 13:15:00', 'ธีรวัฒน์ สายสุวรรณ', '2026-08-22 13:00:00', 'U101', 56927, 8, '2026-08-27 16:00:00', 'U101', 57327, 7, 0, NULL, 660, 0, 7340, 'refunded', 0, NULL, NULL, 'U117', '2026-08-14 13:00:00'),
  ('BK1033', 'U122', 'นข 5566', 'van', 'SVB', '2026-08-20 11:00:00', '2026-08-22 11:00:00', 2, 5000, 8000, 'returned', NULL, 'CT533', '2026-08-17 11:10:00', '2026-08-17 11:15:00', 'Aiko Tanaka', '2026-08-20 11:00:00', 'U101', 42755, 8, '2026-08-22 11:00:00', 'U101', 42987, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U122', '2026-08-17 11:00:00'),
  ('BK1028', 'U110', '9กข 2020', 'ev', 'SVB', '2026-08-23 10:00:00', '2026-08-25 10:00:00', 2, 3600, 5000, 'returned', NULL, 'CT528', '2026-08-19 10:10:00', '2026-08-19 10:15:00', 'สุดา มีสุข', '2026-08-23 10:00:00', 'U101', 50770, 8, '2026-08-25 10:00:00', 'U101', 51280, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U110', '2026-08-19 10:00:00'),
  ('BK1063', 'U119', '1กค 2468', 'economy', 'CNX', '2026-09-01 10:00:00', '2026-09-04 10:00:00', 3, 2700, 3000, 'returned', NULL, 'CT563', '2026-08-22 10:10:00', '2026-08-22 10:15:00', 'วีรยุทธ แสงทอง', '2026-09-01 10:00:00', 'U101', 20190, 8, '2026-09-04 10:00:00', 'U101', 20904, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U119', '2026-08-22 10:00:00'),
  ('BK1051', 'U111', 'กข 5678', 'economy', 'STN', '2026-08-27 10:00:00', '2026-09-01 10:00:00', 5, 4500, 3000, 'returned', NULL, 'CT551', '2026-08-24 10:10:00', '2026-08-24 10:15:00', 'ณัฐ วงศ์ไทย', '2026-08-27 10:00:00', 'U101', 26156, 8, '2026-09-01 10:00:00', 'U101', 26576, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U111', '2026-08-24 10:00:00'),
  ('BK1016', 'U110', 'กง 7890', 'suv', 'SVB', '2026-09-04 14:00:00', '2026-09-09 14:00:00', 5, 11000, 8000, 'returned', NULL, 'CT516', '2026-09-03 14:10:00', '2026-09-03 14:15:00', 'สุดา มีสุข', '2026-09-04 14:00:00', 'U101', 20050, 8, '2026-09-09 14:00:00', 'U101', 21260, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U110', '2026-09-03 14:00:00'),
  ('BK1053', 'U116', 'กข 5678', 'economy', 'STN', '2026-09-16 09:00:00', '2026-09-17 09:00:00', 1, 900, 3000, 'returned', NULL, 'CT553', '2026-09-09 09:10:00', '2026-09-09 09:15:00', 'ศิริพร บุญมา', '2026-09-16 09:00:00', 'U101', 26476, 8, '2026-09-17 09:00:00', 'U101', 26631, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U116', '2026-09-09 09:00:00'),
  ('BK1003', 'U115', '9กข 2020', 'ev', 'SVB', '2026-09-22 11:00:00', '2026-09-27 11:00:00', 5, 9000, 5000, 'returned', NULL, 'CT503', '2026-09-13 11:10:00', '2026-09-13 11:15:00', 'ปิยะ รัตนา', '2026-09-22 11:00:00', 'U101', 50788, 8, '2026-09-27 14:00:00', 'U101', 51228, 7, 0, NULL, 540, 0, 4460, 'refunded', 0, NULL, NULL, 'U115', '2026-09-13 11:00:00'),
  ('BK1011', 'U111', 'กข 1234', 'economy', 'SVB', '2026-09-24 13:00:00', '2026-09-29 13:00:00', 5, 4500, 3000, 'cancelled', NULL, 'CT511', '2026-09-15 13:10:00', '2026-09-15 13:15:00', 'ณัฐ วงศ์ไทย', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'refunded', 4500, 'เปลี่ยนแผนการเดินทาง', '2026-09-21 13:00:00', 'U111', '2026-09-15 13:00:00'),
  ('BK1047', 'U121', 'กข 5678', 'economy', 'STN', '2026-09-21 10:00:00', '2026-09-26 10:00:00', 5, 4500, 3000, 'returned', NULL, 'CT547', '2026-09-17 10:10:00', '2026-09-17 10:15:00', 'John Smith', '2026-09-21 10:00:00', 'U101', 26246, 8, '2026-09-26 10:00:00', 'U101', 26706, 7, 0, NULL, 0, 0, 3000, 'refunded', 0, NULL, NULL, 'U121', '2026-09-17 10:00:00'),
  ('BK1014', 'U115', 'นข 5566', 'van', 'SVB', '2026-09-28 09:00:00', '2026-10-03 09:00:00', 5, 12500, 8000, 'returned', NULL, 'CT514', '2026-09-18 09:10:00', '2026-09-18 09:15:00', 'ปิยะ รัตนา', '2026-09-28 09:00:00', 'U101', 42745, 8, '2026-10-03 09:00:00', 'U101', 43835, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U115', '2026-09-18 09:00:00'),
  ('BK1024', 'U114', 'กง 7890', 'suv', 'SVB', '2026-09-24 10:00:00', '2026-09-25 10:00:00', 1, 2200, 8000, 'returned', NULL, 'CT524', '2026-09-22 10:10:00', '2026-09-22 10:15:00', 'กมลชนก ใจงาม', '2026-09-24 10:00:00', 'U101', 20531, 8, '2026-09-25 10:00:00', 'U101', 20766, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U114', '2026-09-22 10:00:00'),
  ('BK1055', 'U110', 'นข 5566', 'van', 'SVB', '2026-10-07 09:00:00', '2026-10-12 09:00:00', 5, 12500, 8000, 'returned', NULL, 'CT555', '2026-09-27 09:10:00', '2026-09-27 09:15:00', 'สุดา มีสุข', '2026-10-07 09:00:00', 'U101', 43283, 8, '2026-10-12 09:00:00', 'U101', 44503, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U110', '2026-09-27 09:00:00'),
  ('BK1054', 'U112', 'ขค 3456', 'sedan', 'STN', '2026-10-09 13:00:00', '2026-10-10 13:00:00', 1, 1500, 5000, 'returned', NULL, 'CT554', '2026-09-29 13:10:00', '2026-09-29 13:15:00', 'พิมพ์ชนก ศรีงาม', '2026-10-09 13:00:00', 'U101', 47990, 8, '2026-10-10 13:00:00', 'U101', 48222, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U112', '2026-09-29 13:00:00'),
  ('BK1042', 'U109', '9กก 1010', 'ev', 'STN', '2026-10-05 09:00:00', '2026-10-09 09:00:00', 4, 7200, 5000, 'returned', NULL, 'CT542', '2026-10-01 09:10:00', '2026-10-01 09:15:00', 'สมชาย ใจดี', '2026-10-05 09:00:00', 'U101', 30802, 8, '2026-10-09 09:00:00', 'U101', 31494, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U109', '2026-10-01 09:00:00'),
  ('BK1061', 'U116', 'กข 1234', 'economy', 'SVB', '2026-10-02 14:00:00', '2026-10-07 14:00:00', 5, 4500, 3000, 'returned', NULL, 'CT561', '2026-10-01 14:10:00', '2026-10-01 14:15:00', 'ศิริพร บุญมา', '2026-10-02 14:00:00', 'U101', 34243, 8, '2026-10-07 17:00:00', 'U101', 35048, 7, 0, NULL, 270, 0, 2730, 'refunded', 0, NULL, NULL, 'U116', '2026-10-01 14:00:00'),
  ('BK1049', 'U121', 'ขก 9012', 'sedan', 'SVB', '2026-10-08 09:00:00', '2026-10-14 09:00:00', 6, 9000, 5000, 'returned', NULL, 'CT549', '2026-10-03 09:10:00', '2026-10-03 09:15:00', 'John Smith', '2026-10-08 09:00:00', 'U101', 16450, 8, '2026-10-14 09:00:00', 'U101', 17950, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U121', '2026-10-03 09:00:00'),
  ('BK1027', 'U115', 'กง 7890', 'suv', 'SVB', '2026-10-08 11:00:00', '2026-10-11 11:00:00', 3, 6600, 8000, 'returned', NULL, 'CT527', '2026-10-05 11:10:00', '2026-10-05 11:15:00', 'ปิยะ รัตนา', '2026-10-08 11:00:00', 'U101', 20192, 8, '2026-10-11 11:00:00', 'U101', 20615, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U115', '2026-10-05 11:00:00'),
  ('BK1019', 'U110', 'ขก 9012', 'sedan', 'SVB', '2026-10-15 14:00:00', '2026-10-21 14:00:00', 6, 9000, 5000, 'returned', NULL, 'CT519', '2026-10-11 14:10:00', '2026-10-11 14:15:00', 'สุดา มีสุข', '2026-10-15 14:00:00', 'U101', 16335, 8, '2026-10-21 14:00:00', 'U101', 17001, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U110', '2026-10-11 14:00:00'),
  ('BK1034', 'U116', 'ขค 3456', 'sedan', 'STN', '2026-10-19 09:00:00', '2026-10-24 09:00:00', 5, 7500, 5000, 'returned', NULL, 'CT534', '2026-10-12 09:10:00', '2026-10-12 09:15:00', 'ศิริพร บุญมา', '2026-10-19 09:00:00', 'U101', 48569, 8, '2026-10-24 09:00:00', 'U101', 49274, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U116', '2026-10-12 09:00:00'),
  ('BK1001', 'U121', 'ฮก 8899', 'van', 'STN', '2026-10-22 14:00:00', '2026-10-26 14:00:00', 4, 10000, 8000, 'returned', NULL, 'CT501', '2026-10-12 14:10:00', '2026-10-12 14:15:00', 'John Smith', '2026-10-22 14:00:00', 'U101', 27879, 8, '2026-10-26 14:00:00', 'U101', 28447, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U121', '2026-10-12 14:00:00'),
  ('BK1059', 'U110', 'ฆฆ 7788', 'sedan', 'HKT', '2026-10-21 09:00:00', '2026-10-25 09:00:00', 4, 6000, 5000, 'returned', NULL, 'CT559', '2026-10-19 09:10:00', '2026-10-19 09:15:00', 'สุดา มีสุข', '2026-10-21 09:00:00', 'U101', 22757, 8, '2026-10-25 09:00:00', 'U101', 23093, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U110', '2026-10-19 09:00:00'),
  ('BK1029', 'U110', 'ขก 9012', 'sedan', 'SVB', '2026-10-28 11:00:00', '2026-10-30 11:00:00', 2, 3000, 5000, 'returned', NULL, 'CT529', '2026-10-22 11:10:00', '2026-10-22 11:15:00', 'สุดา มีสุข', '2026-10-28 11:00:00', 'U101', 16241, 8, '2026-10-30 11:00:00', 'U101', 16619, 7, 0, NULL, 0, 0, 5000, 'refunded', 0, NULL, NULL, 'U110', '2026-10-22 11:00:00'),
  ('BK1037', 'U118', 'ฮก 8899', 'van', 'STN', '2026-10-28 11:00:00', '2026-11-01 11:00:00', 4, 10000, 8000, 'returned', NULL, 'CT537', '2026-10-22 11:10:00', '2026-10-22 11:15:00', 'ชลธิชา ทองคำ', '2026-10-28 11:00:00', 'U101', 28081, 8, '2026-11-01 11:00:00', 'U101', 28589, 7, 0, NULL, 0, 0, 8000, 'refunded', 0, NULL, NULL, 'U118', '2026-10-22 11:00:00'),
  ('BK1068', 'U111', '1กค 2468', 'economy', 'CNX', '2026-11-02 10:00:00', '2026-11-06 10:00:00', 4, 3600, 3000, 'returned', NULL, 'CT568', '2026-10-29 10:10:00', '2026-10-29 10:15:00', 'ณัฐ วงศ์ไทย', '2026-11-02 10:00:00', 'U101', 22208, 8, '2026-11-06 10:00:00', 'U101', 22808, 6, 1, 'ประตูหลังซ้ายมีรอยบุบ', 0, 0, 0, 'held', 0, NULL, NULL, 'U111', '2026-10-29 10:00:00'),
  ('BK1067', 'U110', 'กข 5678', 'economy', 'STN', '2026-11-08 15:00:00', '2026-11-10 15:00:00', 2, 1800, 3000, 'confirmed', NULL, 'CT567', '2026-10-29 15:10:00', '2026-10-29 15:15:00', 'สุดา มีสุข', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'held', 0, NULL, NULL, 'U110', '2026-10-29 15:00:00'),
  ('BK1065', 'U109', '9กก 1010', 'ev', 'STN', '2026-11-09 03:00:00', '2026-11-11 03:00:00', 2, 3600, 5000, 'confirmed', NULL, 'CT565', '2026-10-30 03:10:00', '2026-10-30 03:15:00', 'สมชาย ใจดี', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'held', 0, NULL, NULL, 'U109', '2026-10-30 03:00:00'),
  ('BK1066', 'U110', 'กง 7890', 'suv', 'SVB', '2026-11-06 09:00:00', '2026-11-09 09:00:00', 3, 6600, 8000, 'picked_up', NULL, 'CT566', '2026-11-05 09:10:00', '2026-11-05 09:15:00', 'สุดา มีสุข', '2026-11-06 09:00:00', 'U101', 22653, 8, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'held', 0, NULL, NULL, 'U110', '2026-11-05 09:00:00'),
  ('BK1064', 'U109', 'ขก 9012', 'sedan', 'SVB', '2026-11-13 10:00:00', '2026-11-16 10:00:00', 3, 4500, 5000, 'confirmed', NULL, 'CT564', '2026-11-05 10:10:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 0, 'held', 0, NULL, NULL, 'U109', '2026-11-05 10:00:00');

-- D5 การชำระเงิน (payments) — money out of the company (refunds) is negative
INSERT INTO payments (txn_id, booking_id, kind, method, amount, status, paid_at) VALUES
  ('TXN50001', 'BK1001', 'rent', 'card', 10000, 'success', '2026-10-12 14:10:00'),
  ('TXN50001', 'BK1001', 'deposit', 'card', 8000, 'success', '2026-10-12 14:10:00'),
  ('TXN50002', 'BK1001', 'deposit_refund', 'card', -8000, 'success', '2026-10-26 15:00:00'),
  ('TXN50003', 'BK1002', 'rent', 'card', 9000, 'success', '2026-05-20 09:10:00'),
  ('TXN50003', 'BK1002', 'deposit', 'card', 5000, 'success', '2026-05-20 09:10:00'),
  ('TXN50004', 'BK1002', 'deposit_refund', 'card', -5000, 'success', '2026-06-03 10:00:00'),
  ('TXN50005', 'BK1003', 'rent', 'qr', 9000, 'success', '2026-09-13 11:10:00'),
  ('TXN50005', 'BK1003', 'deposit', 'card', 5000, 'success', '2026-09-13 11:10:00'),
  ('TXN50006', 'BK1003', 'late_fee', 'deposit', 540, 'success', '2026-09-27 14:00:00'),
  ('TXN50007', 'BK1003', 'deposit_refund', 'card', -4460, 'success', '2026-09-27 15:00:00'),
  ('TXN50008', 'BK1004', 'rent', 'qr', 3000, 'success', '2026-07-10 13:10:00'),
  ('TXN50008', 'BK1004', 'deposit', 'card', 5000, 'success', '2026-07-10 13:10:00'),
  ('TXN50009', 'BK1004', 'deposit_refund', 'card', -5000, 'success', '2026-07-13 14:00:00'),
  ('TXN50010', 'BK1005', 'rent', 'qr', 9000, 'success', '2026-05-19 11:10:00'),
  ('TXN50010', 'BK1005', 'deposit', 'card', 5000, 'success', '2026-05-19 11:10:00'),
  ('TXN50011', 'BK1005', 'deposit_refund', 'card', -5000, 'success', '2026-05-27 12:00:00'),
  ('TXN50012', 'BK1006', 'rent', 'qr', 12500, 'success', '2026-07-30 11:10:00'),
  ('TXN50012', 'BK1006', 'deposit', 'card', 8000, 'success', '2026-07-30 11:10:00'),
  ('TXN50013', 'BK1006', 'deposit_refund', 'card', -8000, 'success', '2026-08-08 12:00:00'),
  ('TXN50014', 'BK1007', 'rent', 'card', 12500, 'success', '2026-06-23 11:10:00'),
  ('TXN50014', 'BK1007', 'deposit', 'card', 8000, 'success', '2026-06-23 11:10:00'),
  ('TXN50015', 'BK1007', 'refund', 'card', -12500, 'success', '2026-06-28 11:00:00'),
  ('TXN50015', 'BK1007', 'deposit_refund', 'card', -8000, 'success', '2026-06-28 11:00:00'),
  ('TXN50016', 'BK1008', 'rent', 'card', 15000, 'success', '2026-05-15 12:10:00'),
  ('TXN50016', 'BK1008', 'deposit', 'card', 8000, 'success', '2026-05-15 12:10:00'),
  ('TXN50017', 'BK1008', 'deposit_refund', 'card', -8000, 'success', '2026-05-24 13:00:00'),
  ('TXN50018', 'BK1009', 'rent', 'card', 6600, 'success', '2026-06-21 13:10:00'),
  ('TXN50018', 'BK1009', 'deposit', 'card', 8000, 'success', '2026-06-21 13:10:00'),
  ('TXN50019', 'BK1009', 'deposit_refund', 'card', -8000, 'success', '2026-06-27 14:00:00'),
  ('TXN50020', 'BK1010', 'rent', 'card', 900, 'success', '2026-06-12 10:10:00'),
  ('TXN50020', 'BK1010', 'deposit', 'card', 3000, 'success', '2026-06-12 10:10:00'),
  ('TXN50021', 'BK1010', 'deposit_refund', 'card', -3000, 'success', '2026-06-16 11:00:00'),
  ('TXN50022', 'BK1011', 'rent', 'qr', 4500, 'success', '2026-09-15 13:10:00'),
  ('TXN50022', 'BK1011', 'deposit', 'card', 3000, 'success', '2026-09-15 13:10:00'),
  ('TXN50023', 'BK1011', 'refund', 'card', -4500, 'success', '2026-09-21 13:00:00'),
  ('TXN50023', 'BK1011', 'deposit_refund', 'card', -3000, 'success', '2026-09-21 13:00:00'),
  ('TXN50024', 'BK1012', 'rent', 'qr', 6600, 'success', '2026-05-29 10:10:00'),
  ('TXN50024', 'BK1012', 'deposit', 'card', 8000, 'success', '2026-05-29 10:10:00'),
  ('TXN50025', 'BK1012', 'deposit_refund', 'card', -8000, 'success', '2026-06-06 11:00:00'),
  ('TXN50026', 'BK1013', 'rent', 'card', 6600, 'success', '2026-08-13 13:10:00'),
  ('TXN50026', 'BK1013', 'deposit', 'card', 8000, 'success', '2026-08-13 13:10:00'),
  ('TXN50027', 'BK1013', 'late_fee', 'deposit', 660, 'success', '2026-08-19 16:00:00'),
  ('TXN50028', 'BK1013', 'deposit_refund', 'card', -7340, 'success', '2026-08-19 17:00:00'),
  ('TXN50029', 'BK1014', 'rent', 'qr', 12500, 'success', '2026-09-18 09:10:00'),
  ('TXN50029', 'BK1014', 'deposit', 'card', 8000, 'success', '2026-09-18 09:10:00'),
  ('TXN50030', 'BK1014', 'deposit_refund', 'card', -8000, 'success', '2026-10-03 10:00:00'),
  ('TXN50031', 'BK1015', 'rent', 'card', 900, 'success', '2026-05-21 13:10:00'),
  ('TXN50031', 'BK1015', 'deposit', 'card', 3000, 'success', '2026-05-21 13:10:00'),
  ('TXN50032', 'BK1015', 'refund', 'card', -900, 'success', '2026-05-28 13:00:00'),
  ('TXN50032', 'BK1015', 'deposit_refund', 'card', -3000, 'success', '2026-05-28 13:00:00'),
  ('TXN50033', 'BK1016', 'rent', 'card', 11000, 'success', '2026-09-03 14:10:00'),
  ('TXN50033', 'BK1016', 'deposit', 'card', 8000, 'success', '2026-09-03 14:10:00'),
  ('TXN50034', 'BK1016', 'deposit_refund', 'card', -8000, 'success', '2026-09-09 15:00:00'),
  ('TXN50035', 'BK1017', 'rent', 'qr', 12500, 'success', '2026-06-14 13:10:00'),
  ('TXN50035', 'BK1017', 'deposit', 'card', 8000, 'success', '2026-06-14 13:10:00'),
  ('TXN50036', 'BK1017', 'late_fee', 'deposit', 750, 'success', '2026-06-24 16:00:00'),
  ('TXN50037', 'BK1017', 'deposit_refund', 'card', -7250, 'success', '2026-06-24 17:00:00'),
  ('TXN50038', 'BK1018', 'rent', 'card', 4500, 'success', '2026-05-12 13:10:00'),
  ('TXN50038', 'BK1018', 'deposit', 'card', 5000, 'success', '2026-05-12 13:10:00'),
  ('TXN50039', 'BK1018', 'deposit_refund', 'card', -5000, 'success', '2026-05-16 14:00:00'),
  ('TXN50040', 'BK1019', 'rent', 'qr', 9000, 'success', '2026-10-11 14:10:00'),
  ('TXN50040', 'BK1019', 'deposit', 'card', 5000, 'success', '2026-10-11 14:10:00'),
  ('TXN50041', 'BK1019', 'deposit_refund', 'card', -5000, 'success', '2026-10-21 15:00:00'),
  ('TXN50042', 'BK1020', 'rent', 'card', 3600, 'success', '2026-07-11 12:10:00'),
  ('TXN50042', 'BK1020', 'deposit', 'card', 3000, 'success', '2026-07-11 12:10:00'),
  ('TXN50043', 'BK1020', 'deposit_refund', 'card', -3000, 'success', '2026-07-21 13:00:00'),
  ('TXN50044', 'BK1021', 'rent', 'card', 8800, 'success', '2026-05-08 11:10:00'),
  ('TXN50044', 'BK1021', 'deposit', 'card', 8000, 'success', '2026-05-08 11:10:00'),
  ('TXN50045', 'BK1021', 'deposit_refund', 'card', -8000, 'success', '2026-05-21 12:00:00'),
  ('TXN50046', 'BK1022', 'rent', 'card', 7500, 'success', '2026-07-25 12:10:00'),
  ('TXN50046', 'BK1022', 'deposit', 'card', 5000, 'success', '2026-07-25 12:10:00'),
  ('TXN50047', 'BK1022', 'deposit_refund', 'card', -5000, 'success', '2026-08-07 13:00:00'),
  ('TXN50048', 'BK1023', 'rent', 'qr', 8800, 'success', '2026-06-28 11:10:00'),
  ('TXN50048', 'BK1023', 'deposit', 'card', 8000, 'success', '2026-06-28 11:10:00'),
  ('TXN50049', 'BK1023', 'refund', 'card', -8800, 'success', '2026-07-02 11:00:00'),
  ('TXN50049', 'BK1023', 'deposit_refund', 'card', -8000, 'success', '2026-07-02 11:00:00'),
  ('TXN50050', 'BK1024', 'rent', 'card', 2200, 'success', '2026-09-22 10:10:00'),
  ('TXN50050', 'BK1024', 'deposit', 'card', 8000, 'success', '2026-09-22 10:10:00'),
  ('TXN50051', 'BK1024', 'deposit_refund', 'card', -8000, 'success', '2026-09-25 11:00:00'),
  ('TXN50052', 'BK1025', 'rent', 'card', 3600, 'success', '2026-05-31 10:10:00'),
  ('TXN50052', 'BK1025', 'deposit', 'card', 3000, 'success', '2026-05-31 10:10:00'),
  ('TXN50053', 'BK1025', 'deposit_refund', 'card', -3000, 'success', '2026-06-06 11:00:00'),
  ('TXN50054', 'BK1026', 'rent', 'card', 2700, 'success', '2026-08-07 13:10:00'),
  ('TXN50054', 'BK1026', 'deposit', 'card', 3000, 'success', '2026-08-07 13:10:00'),
  ('TXN50055', 'BK1026', 'deposit_refund', 'card', -3000, 'success', '2026-08-16 14:00:00'),
  ('TXN50056', 'BK1027', 'rent', 'card', 6600, 'success', '2026-10-05 11:10:00'),
  ('TXN50056', 'BK1027', 'deposit', 'card', 8000, 'success', '2026-10-05 11:10:00'),
  ('TXN50057', 'BK1027', 'deposit_refund', 'card', -8000, 'success', '2026-10-11 12:00:00'),
  ('TXN50058', 'BK1028', 'rent', 'qr', 3600, 'success', '2026-08-19 10:10:00'),
  ('TXN50058', 'BK1028', 'deposit', 'card', 5000, 'success', '2026-08-19 10:10:00'),
  ('TXN50059', 'BK1028', 'deposit_refund', 'card', -5000, 'success', '2026-08-25 11:00:00'),
  ('TXN50060', 'BK1029', 'rent', 'card', 3000, 'success', '2026-10-22 11:10:00'),
  ('TXN50060', 'BK1029', 'deposit', 'card', 5000, 'success', '2026-10-22 11:10:00'),
  ('TXN50061', 'BK1029', 'deposit_refund', 'card', -5000, 'success', '2026-10-30 12:00:00'),
  ('TXN50062', 'BK1030', 'rent', 'card', 9000, 'success', '2026-06-27 12:10:00'),
  ('TXN50062', 'BK1030', 'deposit', 'card', 5000, 'success', '2026-06-27 12:10:00'),
  ('TXN50063', 'BK1030', 'late_fee', 'deposit', 450, 'success', '2026-07-05 15:00:00'),
  ('TXN50064', 'BK1030', 'deposit_refund', 'card', -4550, 'success', '2026-07-05 16:00:00'),
  ('TXN50065', 'BK1031', 'rent', 'card', 12500, 'success', '2026-07-26 12:10:00'),
  ('TXN50065', 'BK1031', 'deposit', 'card', 8000, 'success', '2026-07-26 12:10:00'),
  ('TXN50066', 'BK1031', 'deposit_refund', 'card', -8000, 'success', '2026-08-08 13:00:00'),
  ('TXN50067', 'BK1032', 'rent', 'card', 7200, 'success', '2026-06-02 09:10:00'),
  ('TXN50067', 'BK1032', 'deposit', 'card', 5000, 'success', '2026-06-02 09:10:00'),
  ('TXN50068', 'BK1032', 'deposit_refund', 'card', -5000, 'success', '2026-06-09 10:00:00'),
  ('TXN50069', 'BK1033', 'rent', 'qr', 5000, 'success', '2026-08-17 11:10:00'),
  ('TXN50069', 'BK1033', 'deposit', 'card', 8000, 'success', '2026-08-17 11:10:00'),
  ('TXN50070', 'BK1033', 'deposit_refund', 'card', -8000, 'success', '2026-08-22 12:00:00'),
  ('TXN50071', 'BK1034', 'rent', 'card', 7500, 'success', '2026-10-12 09:10:00'),
  ('TXN50071', 'BK1034', 'deposit', 'card', 5000, 'success', '2026-10-12 09:10:00'),
  ('TXN50072', 'BK1034', 'deposit_refund', 'card', -5000, 'success', '2026-10-24 10:00:00'),
  ('TXN50073', 'BK1035', 'rent', 'qr', 2700, 'success', '2026-06-29 10:10:00'),
  ('TXN50073', 'BK1035', 'deposit', 'card', 3000, 'success', '2026-06-29 10:10:00'),
  ('TXN50074', 'BK1035', 'deposit_refund', 'card', -3000, 'success', '2026-07-10 11:00:00'),
  ('TXN50075', 'BK1036', 'rent', 'qr', 2200, 'success', '2026-07-22 09:10:00'),
  ('TXN50075', 'BK1036', 'deposit', 'card', 8000, 'success', '2026-07-22 09:10:00'),
  ('TXN50076', 'BK1036', 'late_fee', 'deposit', 660, 'success', '2026-07-28 12:00:00'),
  ('TXN50077', 'BK1036', 'deposit_refund', 'card', -7340, 'success', '2026-07-28 13:00:00'),
  ('TXN50078', 'BK1037', 'rent', 'qr', 10000, 'success', '2026-10-22 11:10:00'),
  ('TXN50078', 'BK1037', 'deposit', 'card', 8000, 'success', '2026-10-22 11:10:00'),
  ('TXN50079', 'BK1037', 'deposit_refund', 'card', -8000, 'success', '2026-11-01 12:00:00'),
  ('TXN50080', 'BK1038', 'rent', 'card', 1500, 'success', '2026-07-10 14:10:00'),
  ('TXN50080', 'BK1038', 'deposit', 'card', 5000, 'success', '2026-07-10 14:10:00'),
  ('TXN50081', 'BK1038', 'deposit_refund', 'card', -5000, 'success', '2026-07-19 15:00:00'),
  ('TXN50082', 'BK1039', 'rent', 'card', 6000, 'success', '2026-05-20 09:10:00'),
  ('TXN50082', 'BK1039', 'deposit', 'card', 5000, 'success', '2026-05-20 09:10:00'),
  ('TXN50083', 'BK1039', 'refund', 'card', -6000, 'success', '2026-05-22 09:00:00'),
  ('TXN50083', 'BK1039', 'deposit_refund', 'card', -5000, 'success', '2026-05-22 09:00:00'),
  ('TXN50084', 'BK1040', 'rent', 'card', 11000, 'success', '2026-08-02 09:10:00'),
  ('TXN50084', 'BK1040', 'deposit', 'card', 8000, 'success', '2026-08-02 09:10:00'),
  ('TXN50085', 'BK1040', 'deposit_refund', 'card', -8000, 'success', '2026-08-08 10:00:00'),
  ('TXN50086', 'BK1041', 'rent', 'qr', 4500, 'success', '2026-07-20 14:10:00'),
  ('TXN50086', 'BK1041', 'deposit', 'card', 3000, 'success', '2026-07-20 14:10:00'),
  ('TXN50087', 'BK1041', 'refund', 'card', -4500, 'success', '2026-07-26 14:00:00'),
  ('TXN50087', 'BK1041', 'deposit_refund', 'card', -3000, 'success', '2026-07-26 14:00:00'),
  ('TXN50088', 'BK1042', 'rent', 'card', 7200, 'success', '2026-10-01 09:10:00'),
  ('TXN50088', 'BK1042', 'deposit', 'card', 5000, 'success', '2026-10-01 09:10:00'),
  ('TXN50089', 'BK1042', 'deposit_refund', 'card', -5000, 'success', '2026-10-09 10:00:00'),
  ('TXN50090', 'BK1043', 'rent', 'card', 3600, 'success', '2026-05-17 12:10:00'),
  ('TXN50090', 'BK1043', 'deposit', 'card', 5000, 'success', '2026-05-17 12:10:00'),
  ('TXN50091', 'BK1043', 'deposit_refund', 'card', -5000, 'success', '2026-05-21 13:00:00'),
  ('TXN50092', 'BK1044', 'rent', 'card', 1500, 'success', '2026-07-05 11:10:00'),
  ('TXN50092', 'BK1044', 'deposit', 'card', 5000, 'success', '2026-07-05 11:10:00'),
  ('TXN50093', 'BK1044', 'refund', 'card', -1500, 'success', '2026-07-08 11:00:00'),
  ('TXN50093', 'BK1044', 'deposit_refund', 'card', -5000, 'success', '2026-07-08 11:00:00'),
  ('TXN50094', 'BK1045', 'rent', 'qr', 15000, 'success', '2026-07-03 14:10:00'),
  ('TXN50094', 'BK1045', 'deposit', 'card', 8000, 'success', '2026-07-03 14:10:00'),
  ('TXN50095', 'BK1045', 'deposit_refund', 'card', -8000, 'success', '2026-07-12 15:00:00'),
  ('TXN50096', 'BK1046', 'rent', 'qr', 5400, 'success', '2026-07-21 09:10:00'),
  ('TXN50096', 'BK1046', 'deposit', 'card', 3000, 'success', '2026-07-21 09:10:00'),
  ('TXN50097', 'BK1046', 'deposit_refund', 'card', -3000, 'success', '2026-07-28 10:00:00'),
  ('TXN50098', 'BK1047', 'rent', 'qr', 4500, 'success', '2026-09-17 10:10:00'),
  ('TXN50098', 'BK1047', 'deposit', 'card', 3000, 'success', '2026-09-17 10:10:00'),
  ('TXN50099', 'BK1047', 'deposit_refund', 'card', -3000, 'success', '2026-09-26 11:00:00'),
  ('TXN50100', 'BK1048', 'rent', 'card', 7500, 'success', '2026-08-05 11:10:00'),
  ('TXN50100', 'BK1048', 'deposit', 'card', 5000, 'success', '2026-08-05 11:10:00'),
  ('TXN50101', 'BK1048', 'deposit_refund', 'card', -5000, 'success', '2026-08-15 12:00:00'),
  ('TXN50102', 'BK1049', 'rent', 'card', 9000, 'success', '2026-10-03 09:10:00'),
  ('TXN50102', 'BK1049', 'deposit', 'card', 5000, 'success', '2026-10-03 09:10:00'),
  ('TXN50103', 'BK1049', 'deposit_refund', 'card', -5000, 'success', '2026-10-14 10:00:00'),
  ('TXN50104', 'BK1050', 'rent', 'card', 6600, 'success', '2026-05-20 10:10:00'),
  ('TXN50104', 'BK1050', 'deposit', 'card', 8000, 'success', '2026-05-20 10:10:00'),
  ('TXN50105', 'BK1050', 'deposit_refund', 'card', -8000, 'success', '2026-06-01 11:00:00'),
  ('TXN50106', 'BK1051', 'rent', 'qr', 4500, 'success', '2026-08-24 10:10:00'),
  ('TXN50106', 'BK1051', 'deposit', 'card', 3000, 'success', '2026-08-24 10:10:00'),
  ('TXN50107', 'BK1051', 'deposit_refund', 'card', -3000, 'success', '2026-09-01 11:00:00'),
  ('TXN50108', 'BK1052', 'rent', 'card', 900, 'success', '2026-06-04 13:10:00'),
  ('TXN50108', 'BK1052', 'deposit', 'card', 3000, 'success', '2026-06-04 13:10:00'),
  ('TXN50109', 'BK1052', 'deposit_refund', 'card', -3000, 'success', '2026-06-06 14:00:00'),
  ('TXN50110', 'BK1053', 'rent', 'qr', 900, 'success', '2026-09-09 09:10:00'),
  ('TXN50110', 'BK1053', 'deposit', 'card', 3000, 'success', '2026-09-09 09:10:00'),
  ('TXN50111', 'BK1053', 'deposit_refund', 'card', -3000, 'success', '2026-09-17 10:00:00'),
  ('TXN50112', 'BK1054', 'rent', 'qr', 1500, 'success', '2026-09-29 13:10:00'),
  ('TXN50112', 'BK1054', 'deposit', 'card', 5000, 'success', '2026-09-29 13:10:00'),
  ('TXN50113', 'BK1054', 'deposit_refund', 'card', -5000, 'success', '2026-10-10 14:00:00'),
  ('TXN50114', 'BK1055', 'rent', 'card', 12500, 'success', '2026-09-27 09:10:00'),
  ('TXN50114', 'BK1055', 'deposit', 'card', 8000, 'success', '2026-09-27 09:10:00'),
  ('TXN50115', 'BK1055', 'deposit_refund', 'card', -8000, 'success', '2026-10-12 10:00:00'),
  ('TXN50116', 'BK1056', 'rent', 'card', 10000, 'success', '2026-07-26 11:10:00'),
  ('TXN50116', 'BK1056', 'deposit', 'card', 8000, 'success', '2026-07-26 11:10:00'),
  ('TXN50117', 'BK1056', 'deposit_refund', 'card', -8000, 'success', '2026-08-02 12:00:00'),
  ('TXN50118', 'BK1057', 'rent', 'card', 2700, 'success', '2026-05-16 12:10:00'),
  ('TXN50118', 'BK1057', 'deposit', 'card', 3000, 'success', '2026-05-16 12:10:00'),
  ('TXN50119', 'BK1057', 'deposit_refund', 'card', -3000, 'success', '2026-05-20 13:00:00'),
  ('TXN50120', 'BK1058', 'rent', 'card', 4500, 'success', '2026-05-22 12:10:00'),
  ('TXN50120', 'BK1058', 'deposit', 'card', 5000, 'success', '2026-05-22 12:10:00'),
  ('TXN50121', 'BK1058', 'refund', 'card', -4500, 'success', '2026-05-29 12:00:00'),
  ('TXN50121', 'BK1058', 'deposit_refund', 'card', -5000, 'success', '2026-05-29 12:00:00'),
  ('TXN50122', 'BK1059', 'rent', 'card', 6000, 'success', '2026-10-19 09:10:00'),
  ('TXN50122', 'BK1059', 'deposit', 'card', 5000, 'success', '2026-10-19 09:10:00'),
  ('TXN50123', 'BK1059', 'deposit_refund', 'card', -5000, 'success', '2026-10-25 10:00:00'),
  ('TXN50124', 'BK1060', 'rent', 'card', 11000, 'success', '2026-08-14 13:10:00'),
  ('TXN50124', 'BK1060', 'deposit', 'card', 8000, 'success', '2026-08-14 13:10:00'),
  ('TXN50125', 'BK1060', 'late_fee', 'deposit', 660, 'success', '2026-08-27 16:00:00'),
  ('TXN50126', 'BK1060', 'deposit_refund', 'card', -7340, 'success', '2026-08-27 17:00:00'),
  ('TXN50127', 'BK1061', 'rent', 'card', 4500, 'success', '2026-10-01 14:10:00'),
  ('TXN50127', 'BK1061', 'deposit', 'card', 3000, 'success', '2026-10-01 14:10:00'),
  ('TXN50128', 'BK1061', 'late_fee', 'deposit', 270, 'success', '2026-10-07 17:00:00'),
  ('TXN50129', 'BK1061', 'deposit_refund', 'card', -2730, 'success', '2026-10-07 18:00:00'),
  ('TXN50130', 'BK1062', 'rent', 'card', 11000, 'success', '2026-06-12 12:10:00'),
  ('TXN50130', 'BK1062', 'deposit', 'card', 8000, 'success', '2026-06-12 12:10:00'),
  ('TXN50131', 'BK1062', 'late_fee', 'deposit', 660, 'success', '2026-06-23 15:00:00'),
  ('TXN50132', 'BK1062', 'deposit_refund', 'card', -7340, 'success', '2026-06-23 16:00:00'),
  ('TXN50133', 'BK1063', 'rent', 'card', 2700, 'success', '2026-08-22 10:10:00'),
  ('TXN50133', 'BK1063', 'deposit', 'card', 3000, 'success', '2026-08-22 10:10:00'),
  ('TXN50134', 'BK1063', 'deposit_refund', 'card', -3000, 'success', '2026-09-04 11:00:00'),
  ('TXN50135', 'BK1064', 'rent', 'card', 4500, 'success', '2026-11-05 10:10:00'),
  ('TXN50135', 'BK1064', 'deposit', 'card', 5000, 'success', '2026-11-05 10:10:00'),
  ('TXN50136', 'BK1065', 'rent', 'qr', 3600, 'success', '2026-10-30 03:10:00'),
  ('TXN50136', 'BK1065', 'deposit', 'card', 5000, 'success', '2026-10-30 03:10:00'),
  ('TXN50137', 'BK1066', 'rent', 'qr', 6600, 'success', '2026-11-05 09:10:00'),
  ('TXN50137', 'BK1066', 'deposit', 'card', 8000, 'success', '2026-11-05 09:10:00'),
  ('TXN50138', 'BK1067', 'rent', 'qr', 1800, 'success', '2026-10-29 15:10:00'),
  ('TXN50138', 'BK1067', 'deposit', 'card', 3000, 'success', '2026-10-29 15:10:00'),
  ('TXN50139', 'BK1068', 'rent', 'qr', 3600, 'success', '2026-10-29 10:10:00'),
  ('TXN50139', 'BK1068', 'deposit', 'card', 3000, 'success', '2026-10-29 10:10:00');

-- D6 การซ่อมบำรุง (maintenance jobs)
INSERT INTO maintenance_jobs (job_id, plate, booking_id, source, damage, status, repair_mode, assigned_to, assigned_by, assigned_at, inspection_result, inspection_note, inspection_damage, inspected_at, inspected_by, shop_result, shop_cost, shop_returned_at, approved_by, approved_at) VALUES
  ('MT101', 'ขค 3456', NULL, 'schedule', 'เปลี่ยนน้ำมันเครื่อง + ไส้กรอง', 'approved', 'inhouse', 'U104', 'U106', '2026-06-09 10:00:00', 'pass', 'ผ่าน', NULL, '2026-06-10 10:00:00', NULL, NULL, NULL, NULL, 'U106', '2026-06-11 10:00:00'),
  ('MT102', 'กข 1234', NULL, 'schedule', 'เปลี่ยนผ้าเบรกหน้า', 'approved', 'inhouse', 'U105', 'U106', '2026-07-09 10:00:00', 'pass', 'ผ่าน', NULL, '2026-07-10 10:00:00', NULL, NULL, NULL, NULL, 'U106', '2026-07-11 10:00:00'),
  ('MT103', 'งก 1122', NULL, 'schedule', 'ซ่อมกันชนหลัง (ส่งอู่)', 'approved', 'shop', 'U104', 'U106', '2026-08-03 10:00:00', 'pass', 'ผ่าน', NULL, '2026-08-04 10:00:00', NULL, 'ซ่อมเสร็จ ทำสีใหม่', 9500, '2026-08-04 10:00:00', 'U106', '2026-08-05 10:00:00'),
  ('MT104', 'ฆฆ 7788', NULL, 'schedule', 'ตรวจเช็คระยะ 40,000 กม.', 'approved', 'inhouse', 'U105', 'U106', '2026-08-28 10:00:00', 'pass', 'ผ่าน', NULL, '2026-08-29 10:00:00', NULL, NULL, NULL, NULL, 'U106', '2026-08-30 10:00:00'),
  ('MT105', 'นข 5566', NULL, 'schedule', 'เปลี่ยนยาง 4 เส้น', 'approved', 'inhouse', 'U104', 'U106', '2026-09-22 10:00:00', 'pass', 'ผ่าน', NULL, '2026-09-23 10:00:00', NULL, NULL, NULL, NULL, 'U106', '2026-09-24 10:00:00'),
  ('MT106', 'กข 5678', NULL, 'schedule', 'ซ่อมแอร์ เติมน้ำยา', 'approved', 'inhouse', 'U105', 'U106', '2026-10-07 10:00:00', 'pass', 'ผ่าน', NULL, '2026-10-08 10:00:00', NULL, NULL, NULL, NULL, 'U106', '2026-10-09 10:00:00'),
  ('MT107', '9กข 2020', NULL, 'schedule', 'อัปเดตซอฟต์แวร์ + ตรวจแบตเตอรี่', 'approved', 'inhouse', 'U104', 'U106', '2026-10-17 10:00:00', 'pass', 'ผ่าน', NULL, '2026-10-18 10:00:00', NULL, NULL, NULL, NULL, 'U106', '2026-10-19 10:00:00'),
  ('MT108', 'ขก 9012', NULL, 'schedule', 'เปลี่ยนแบตเตอรี่ 12V', 'approved', 'inhouse', 'U105', 'U106', '2026-10-25 10:00:00', 'pass', 'ผ่าน', NULL, '2026-10-26 10:00:00', NULL, NULL, NULL, NULL, 'U106', '2026-10-27 10:00:00'),
  ('MT109', 'ชช 3344', NULL, 'manager', 'เสียงดังที่ช่วงล่างด้านหน้าซ้าย', 'in_progress', 'inhouse', 'U104', 'U106', '2026-11-07 10:00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('MT110', 'ฮก 8899', NULL, 'manager', 'ไฟหน้าขวาไม่ติด', 'done', 'inhouse', 'U105', 'U106', '2026-11-06 10:00:00', 'pass', 'เปลี่ยนหลอดแล้ว ทดสอบผ่าน', NULL, '2026-11-07 10:00:00', NULL, NULL, NULL, NULL, NULL, NULL),
  ('MT111', '1กค 2468', 'BK1068', 'return', 'ประตูหลังซ้ายมีรอยบุบ (แจ้งตอนคืนรถ BK1068)', 'unassigned', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

INSERT INTO inspection_items (job_id, item, passed) VALUES
  ('MT110', 'tyres', 1),
  ('MT110', 'brakes', 1),
  ('MT110', 'lights', 1),
  ('MT110', 'engine', 1),
  ('MT110', 'body', 1);

INSERT INTO maintenance_logs (job_id, logged_at, logged_by, work, parts, cost) VALUES
  ('MT101', '2026-06-10 10:00:00', 'U104', 'เปลี่ยนน้ำมันเครื่อง + ไส้กรอง', '-', 2400),
  ('MT102', '2026-07-10 10:00:00', 'U105', 'เปลี่ยนผ้าเบรกหน้า', '-', 3800),
  ('MT103', '2026-08-04 10:00:00', 'U104', 'ซ่อมกันชนหลัง (ส่งอู่)', '-', 9500),
  ('MT104', '2026-08-29 10:00:00', 'U105', 'ตรวจเช็คระยะ 40,000 กม.', '-', 4200),
  ('MT105', '2026-09-23 10:00:00', 'U104', 'เปลี่ยนยาง 4 เส้น', '-', 14800),
  ('MT106', '2026-10-08 10:00:00', 'U105', 'ซ่อมแอร์ เติมน้ำยา', '-', 2900),
  ('MT107', '2026-10-18 10:00:00', 'U104', 'อัปเดตซอฟต์แวร์ + ตรวจแบตเตอรี่', '-', 1500),
  ('MT108', '2026-10-26 10:00:00', 'U105', 'เปลี่ยนแบตเตอรี่ 12V', '-', 3200),
  ('MT110', '2026-11-07 10:00:00', 'U105', 'เปลี่ยนหลอดไฟหน้า LED', 'หลอด H4 LED x1', 850);

INSERT INTO job_progress (job_id, reported_at, reported_by, status, note) VALUES
  ('MT101', '2026-06-10 10:00:00', NULL, 'done', 'เสร็จ'),
  ('MT102', '2026-07-10 10:00:00', NULL, 'done', 'เสร็จ'),
  ('MT103', '2026-08-04 10:00:00', NULL, 'done', 'เสร็จ'),
  ('MT104', '2026-08-29 10:00:00', NULL, 'done', 'เสร็จ'),
  ('MT105', '2026-09-23 10:00:00', NULL, 'done', 'เสร็จ'),
  ('MT106', '2026-10-08 10:00:00', NULL, 'done', 'เสร็จ'),
  ('MT107', '2026-10-18 10:00:00', NULL, 'done', 'เสร็จ'),
  ('MT108', '2026-10-26 10:00:00', NULL, 'done', 'เสร็จ'),
  ('MT109', '2026-11-07 14:00:00', NULL, 'in_progress', 'ยกรถขึ้นลิฟต์ ตรวจช่วงล่าง'),
  ('MT110', '2026-11-07 10:00:00', NULL, 'done', 'ซ่อมเสร็จ รออนุมัติ');

-- =============================================================================
-- Views
-- =============================================================================

-- Rentals with names, for the booking list and reports (DFD 2.2, 4)
CREATE VIEW v_rental_detail AS
SELECT r.booking_id, r.status,
       CONCAT(u.first_name, ' ', u.last_name) AS customer,
       r.plate, CONCAT(c.brand, ' ', c.model) AS car, t.name_th AS car_type, b.name_th AS branch,
       r.pickup_at, r.return_at, r.rental_days, r.rent_total, r.deposit, r.late_fee, r.damage_charge,
       r.contract_no, (r.contract_signed_at IS NOT NULL) AS contract_signed
FROM rentals r
JOIN users u     ON u.user_id   = r.customer_id
JOIN cars c      ON c.plate     = r.plate
JOIN car_types t ON t.type_id   = r.type_id
JOIN branches b  ON b.branch_id = r.branch_id;

-- Daily revenue, same rule as the mock-up: rent + differences + late fees + damage
-- charges − refunds; deposits are not revenue (Big Manager, DFD 4)
CREATE VIEW v_daily_revenue AS
SELECT DATE(p.paid_at) AS day,
       SUM(p.amount)   AS revenue,
       COUNT(DISTINCT CASE WHEN p.kind = 'rent' THEN p.booking_id END) AS paid_rentals
FROM payments p
WHERE p.status = 'success'
  AND p.kind IN ('rent','difference','refund','refund_difference','late_fee','damage_charge')
GROUP BY DATE(p.paid_at);

-- Repair cost per car (MM-04, "ตรวจสอบค่าใช้จ่ายในการซ่อมรถ"):
-- recorded maintenance work + the shop's bill, as in the mock-up's Logic.jobCost
CREATE VIEW v_repair_cost_per_car AS
SELECT c.plate, CONCAT(c.brand, ' ', c.model) AS car,
       COUNT(j.job_id) AS jobs,
       COALESCE(SUM(l.log_cost), 0) + COALESCE(SUM(j.shop_cost), 0) AS total_cost
FROM cars c
LEFT JOIN maintenance_jobs j ON j.plate = c.plate
LEFT JOIN (SELECT job_id, SUM(cost) AS log_cost FROM maintenance_logs GROUP BY job_id) l ON l.job_id = j.job_id
GROUP BY c.plate, c.brand, c.model;

-- =============================================================================
-- Example queries (uncomment to try)
-- =============================================================================
-- Free cars for a period at one branch (DFD 1.2): not in maintenance, no overlapping active booking
-- SET @start = '2026-11-20 09:00', @end = '2026-11-23 09:00';
-- SELECT c.plate, c.brand, c.model, t.name_th, ra.daily_rate
-- FROM cars c JOIN car_types t USING (type_id) JOIN rates ra USING (type_id)
-- WHERE c.branch_id = 'SVB' AND c.status <> 'maintenance'
--   AND NOT EXISTS (SELECT 1 FROM rentals r
--                   WHERE r.plate = c.plate AND r.status IN ('pending_payment','confirmed','picked_up')
--                     AND r.pickup_at < @end AND @start < r.return_at);

-- A customer's rentals (DFD 2.2)
-- SELECT * FROM v_rental_detail WHERE customer = 'สมชาย ใจดี' ORDER BY pickup_at DESC;

-- Monthly revenue (DFD 4)
-- SELECT DATE_FORMAT(day, '%Y-%m') AS month, SUM(revenue) AS revenue FROM v_daily_revenue GROUP BY month ORDER BY month;

-- Jobs waiting for the Mechanic Manager (DFD 3.3 assign, 3.5 approve)
-- SELECT job_id, plate, damage, status FROM maintenance_jobs WHERE status IN ('unassigned','done');
