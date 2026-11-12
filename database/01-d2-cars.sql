-- =============================================================================
-- ITDS262 · Section 1 · Group 6 · Car Rental Management System
-- D2 รถ (Cars) — car management data, MySQL 8.0+ / MariaDB 10.4+
--
-- Matches the mock-up's car store (Mock-up/js/core.js, D2) and DFD process 3 จัดการรถ:
--   ทะเบียนรถ, ยี่ห้อรถ, ประเภทรถ, สาขา, สถานะรถ, เลขไมล์, ประวัติเช็คระยะ
-- Seed data = the mock-up's 13 demo cars as of 2026-11-08 (Bangkok dates).
-- D1 and D3–D6 are in 02-d1-d3-d6.sql (load this file first).
--
-- Run:  mysql --default-character-set=utf8mb4 -u root -p < 01-d2-cars.sql
--       (or import it in phpMyAdmin). Keep utf8mb4 on the client too, or Thai shows as "???".
-- =============================================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS car_rental
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE car_rental;

SET FOREIGN_KEY_CHECKS = 0;   -- D4/D6 tables may point at these; reloading keeps the same keys
DROP VIEW  IF EXISTS v_car_service_due;
DROP VIEW  IF EXISTS v_fleet_status;
DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS car_types;
DROP TABLE IF EXISTS branches;
SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- Lookup: branches (สาขา)
-- -----------------------------------------------------------------------------
CREATE TABLE branches (
  branch_id   CHAR(3)      NOT NULL,              -- SVB, STN, CNX, HKT
  name_th     VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100) NOT NULL,
  address_th  VARCHAR(255) NOT NULL,
  address_en  VARCHAR(255) NOT NULL,
  PRIMARY KEY (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Lookup: car types (ประเภทรถ) — the rental rate per type lives in D3
-- -----------------------------------------------------------------------------
CREATE TABLE car_types (
  type_id   VARCHAR(10)  NOT NULL,                -- economy, sedan, suv, van, ev
  name_th   VARCHAR(50)  NOT NULL,
  name_en   VARCHAR(50)  NOT NULL,
  seats     TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (type_id),
  CONSTRAINT chk_car_types_seats CHECK (seats BETWEEN 2 AND 15)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- D2 รถ (cars)
--   status is the car's physical state, set by hand-over (2.6), return (2.7)
--   and repair approval (3.5). "Reserved" is not stored: it is derived from
--   D4 bookings, as in the mock-up.
-- -----------------------------------------------------------------------------
CREATE TABLE cars (
  plate            VARCHAR(12)  NOT NULL,                     -- ทะเบียนรถ, e.g. 'กข 1234'
  brand            VARCHAR(40)  NOT NULL,                     -- ยี่ห้อ
  model            VARCHAR(40)  NOT NULL,                     -- รุ่น
  type_id          VARCHAR(10)  NOT NULL,                     -- ประเภทรถ
  branch_id        CHAR(3)      NOT NULL,                     -- สาขาที่รถประจำอยู่
  color_hex        CHAR(7)      NOT NULL DEFAULT '#94a3b8',   -- display colour in the mock-up
  model_year       SMALLINT UNSIGNED NOT NULL,
  mileage_km       INT UNSIGNED NOT NULL DEFAULT 0,           -- เลขไมล์ปัจจุบัน
  fuel_eighths     TINYINT UNSIGNED NOT NULL DEFAULT 8,       -- ระดับน้ำมัน 0–8 (8 = เต็มถัง)
  status           ENUM('available','rented','maintenance') NOT NULL DEFAULT 'available', -- สถานะรถ
  registered_at    DATE         NOT NULL,                     -- วันจดทะเบียน (ใช้คำนวณตรวจสภาพประจำปี)
  last_service_at  DATE         NOT NULL,                     -- วันเช็คระยะล่าสุด
  last_service_km  INT UNSIGNED NOT NULL,                     -- เลขไมล์ตอนเช็คระยะล่าสุด
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (plate),
  KEY idx_cars_search (branch_id, type_id, status),           -- search for free cars (DFD 1.2)
  KEY idx_cars_status (status),
  CONSTRAINT fk_cars_type   FOREIGN KEY (type_id)   REFERENCES car_types (type_id) ON UPDATE CASCADE,
  CONSTRAINT fk_cars_branch FOREIGN KEY (branch_id) REFERENCES branches (branch_id) ON UPDATE CASCADE,
  CONSTRAINT chk_cars_fuel      CHECK (fuel_eighths BETWEEN 0 AND 8),
  CONSTRAINT chk_cars_year      CHECK (model_year BETWEEN 1990 AND 2100),
  CONSTRAINT chk_cars_color     CHECK (color_hex REGEXP '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT chk_cars_service   CHECK (last_service_km <= mileage_km),
  CONSTRAINT chk_cars_svc_date  CHECK (last_service_at >= registered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Seed data (same as the mock-up)
-- -----------------------------------------------------------------------------
INSERT INTO branches (branch_id, name_th, name_en, address_th, address_en) VALUES
  ('SVB', 'สาขาสนามบินสุวรรณภูมิ', 'Suvarnabhumi Airport', 'อาคารผู้โดยสาร ชั้น 1 ประตู 8 เคาน์เตอร์ 12', 'Passenger Terminal, Level 1, Gate 8, Counter 12'),
  ('STN', 'สาขาสาทร',             'Sathorn',              '88 ถนนสาทรใต้ แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพฯ', '88 South Sathorn Rd, Sathorn, Bangkok'),
  ('CNX', 'สาขาเชียงใหม่',         'Chiang Mai',           'ลานจอดรถ อาคาร 2 สนามบินนานาชาติเชียงใหม่', 'Car Park Building 2, Chiang Mai Intl. Airport'),
  ('HKT', 'สาขาภูเก็ต',            'Phuket',               '19 ถนนเทพกระษัตรี อ.ถลาง ภูเก็ต', '19 Thepkasattri Rd, Thalang, Phuket');

INSERT INTO car_types (type_id, name_th, name_en, seats) VALUES
  ('economy', 'รถเก๋งเล็ก',   'Economy', 5),
  ('sedan',   'รถเก๋ง',       'Sedan',   5),
  ('suv',     'รถ SUV',       'SUV',     7),
  ('van',     'รถตู้',         'Van',    12),
  ('ev',      'รถยนต์ไฟฟ้า',  'EV',      5);

INSERT INTO cars (plate, brand, model, type_id, branch_id, color_hex, model_year, mileage_km, fuel_eighths, status, registered_at, last_service_at, last_service_km) VALUES
  ('กข 1234', 'Toyota', 'Yaris Ativ', 'economy', 'SVB', '#e11d48', 2021, 37193, 8, 'available', '2025-07-13', '2026-10-03', 33816),
  ('กข 5678', 'Honda', 'City', 'economy', 'STN', '#0ea5e9', 2022, 28605, 8, 'available', '2024-08-25', '2026-06-05', 22732),
  ('1กค 2468', 'Nissan', 'Almera', 'economy', 'CNX', '#64748b', 2023, 22808, 8, 'maintenance', '2023-11-08', '2026-04-22', 15522),
  ('ขก 9012', 'Toyota', 'Camry', 'sedan', 'SVB', '#111827', 2024, 19137, 8, 'available', '2025-08-08', '2026-08-13', 10972),
  ('ขค 3456', 'Honda', 'Accord', 'sedan', 'STN', '#94a3b8', 2021, 50695, 8, 'available', '2024-10-11', '2026-07-16', 43280),
  ('ฆฆ 7788', 'Mazda', '3', 'sedan', 'HKT', '#b91c1c', 2022, 24909, 8, 'available', '2023-06-05', '2026-08-29', 20207),
  ('กง 7890', 'Toyota', 'Fortuner', 'suv', 'SVB', '#f8fafc', 2023, 22653, 8, 'rented', '2025-08-27', '2026-08-18', 14029),
  ('งก 1122', 'Honda', 'CR-V', 'suv', 'CNX', '#1e3a8a', 2024, 42981, 8, 'available', '2024-09-07', '2026-07-24', 32581),
  ('ชช 3344', 'Mazda', 'CX-5', 'suv', 'HKT', '#7f1d1d', 2021, 59148, 8, 'maintenance', '2023-06-02', '2026-09-05', 50741),
  ('นข 5566', 'Toyota', 'Commuter', 'van', 'SVB', '#e5e7eb', 2022, 45522, 8, 'available', '2025-08-06', '2026-07-09', 40632),
  ('ฮก 8899', 'Hyundai', 'H-1', 'van', 'STN', '#374151', 2023, 30799, 8, 'maintenance', '2024-08-06', '2026-08-28', 23370),
  ('9กก 1010', 'BYD', 'Atto 3', 'ev', 'STN', '#0d9488', 2024, 33183, 8, 'available', '2023-07-07', '2026-08-14', 26648),
  ('9กข 2020', 'MG', 'MG4', 'ev', 'SVB', '#f59e0b', 2021, 52965, 8, 'available', '2025-06-15', '2026-09-11', 50768);

-- -----------------------------------------------------------------------------
-- View: fleet status (Mechanic Manager "สถานะรถทั้งหมด", DFD 3.5)
-- -----------------------------------------------------------------------------
CREATE VIEW v_fleet_status AS
SELECT
  b.branch_id,
  b.name_th                                AS branch_th,
  COUNT(*)                                 AS total_cars,
  SUM(c.status = 'available')              AS available,
  SUM(c.status = 'rented')                 AS rented,
  SUM(c.status = 'maintenance')            AS in_maintenance
FROM cars c
JOIN branches b ON b.branch_id = c.branch_id
GROUP BY b.branch_id, b.name_th;

-- -----------------------------------------------------------------------------
-- View: maintenance schedule (MM-05) — same rule as the mock-up's Logic.schedule:
--   service every 6 months or 10,000 km, whichever comes first,
--   plus an annual inspection on the registration anniversary.
--   status: overdue / soon (14 days, 1,000 km, 30 days for the annual check) / ok
-- -----------------------------------------------------------------------------
CREATE VIEW v_car_service_due AS
SELECT
  s.plate, s.brand, s.model, s.branch_id, s.status AS car_status,
  s.next_service_date,
  CASE WHEN s.next_service_date < CURDATE() THEN 'overdue'
       WHEN s.next_service_date < CURDATE() + INTERVAL 14 DAY THEN 'soon'
       ELSE 'ok' END                                            AS time_status,
  s.next_service_km,
  CAST(s.next_service_km AS SIGNED) - CAST(s.mileage_km AS SIGNED) AS km_left,
  CASE WHEN s.mileage_km > s.next_service_km THEN 'overdue'
       WHEN s.next_service_km - s.mileage_km < 1000 THEN 'soon'
       ELSE 'ok' END                                            AS km_status,
  s.next_annual_check,
  CASE WHEN s.next_annual_check < CURDATE() + INTERVAL 30 DAY THEN 'soon'
       ELSE 'ok' END                                            AS annual_status
FROM (
  SELECT
    c.*,
    c.last_service_at + INTERVAL 6 MONTH                        AS next_service_date,
    c.last_service_km + 10000                                   AS next_service_km,
    -- this year's anniversary; if it is already more than a day past, next year's
    CASE WHEN c.registered_at + INTERVAL (YEAR(CURDATE()) - YEAR(c.registered_at)) YEAR < CURDATE() - INTERVAL 1 DAY
         THEN c.registered_at + INTERVAL (YEAR(CURDATE()) - YEAR(c.registered_at) + 1) YEAR
         ELSE c.registered_at + INTERVAL (YEAR(CURDATE()) - YEAR(c.registered_at)) YEAR
    END                                                         AS next_annual_check
  FROM cars c
) s;

-- -----------------------------------------------------------------------------
-- Example queries (uncomment to try)
-- -----------------------------------------------------------------------------
-- All cars with branch and type names
-- SELECT c.plate, CONCAT(c.brand, ' ', c.model) AS car, t.name_th AS type, b.name_th AS branch, c.status, c.mileage_km
-- FROM cars c JOIN car_types t USING (type_id) JOIN branches b USING (branch_id)
-- ORDER BY b.branch_id, t.type_id;

-- Cars currently available at one branch and type (DFD 1.2 — D4 bookings would also be checked)
-- SELECT plate, brand, model FROM cars WHERE branch_id = 'SVB' AND type_id = 'sedan' AND status = 'available';

-- Cars that need service now or soon
-- SELECT * FROM v_car_service_due WHERE 'overdue' IN (time_status, km_status) OR 'soon' IN (time_status, km_status, annual_status);

-- Hand-over (DFD 2.6): car leaves, odometer recorded
-- UPDATE cars SET status = 'rented', mileage_km = 37200 WHERE plate = 'กข 1234' AND status = 'available';

-- Repair approved by the Mechanic Manager (DFD 3.5): car is ready again
-- UPDATE cars SET status = 'available', last_service_at = CURDATE(), last_service_km = mileage_km WHERE plate = 'ชช 3344';
