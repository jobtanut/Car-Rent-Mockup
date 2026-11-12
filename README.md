# Car Rental Management System: Mock-up Prototype (ITDS262)

A working prototype in plain HTML, CSS and JavaScript that covers all 52 functional requirements from Lab 5. It needs no server. Data is stored in the browser's `localStorage`, which stands in for data stores D1–D6.

## How to open

Double-click `index.html` (Chrome, Edge or Safari). If the data gets messy during a demo, press **Reset data** in the top-right corner.

| Top bar control | What it does |
|---|---|
| TH / EN | Switches the language |
| Logo | Returns to the home page for the signed-in account |
| FR map | FR ↔ screen ↔ DFD ↔ use case table, with the gaps that still need fixing |
| Reset data | Reloads the original demo data |

## Demo accounts (password `pass1234` for all)

| Actor | Username |
|---|---|
| Customer (ผู้เช่ารถ) | `somchai`, `suda` |
| Office Employee (พนักงานออฟฟิศ) | `office1` |
| Office Manager (ผู้จัดการออฟฟิศ) | `manager1` |
| Mechanic Employee (ช่างซ่อมบำรุง) | `mech1`, `mech2` |
| Mechanic Manager (หัวหน้าช่าง) | `mechlead` |
| Big Manager (ผู้บริหารระดับสูง) | `ceo` |
| Deactivated account (unhappy-path testing) | `office9` |

## Access by role

It's one app for everyone. Every account signs in to the customer pages (Rent a car, My rentals, Inbox, Repair costs). Staff accounts also get a **Staff area** menu in the top-right that opens the employee pages, and higher roles inherit the areas of the roles below them.

| Role | Staff area menu |
|---|---|
| Customer | none |
| Office Employee | Office work |
| Office Manager | Office work, Office management |
| Mechanic Employee | Mechanic work (own jobs only) |
| Mechanic Manager | Mechanic work (all jobs), Repair management |
| Big Manager (CEO) | Company overview, Office work, Office management, Mechanic work, Repair management |

A staff member who rents a car for themselves is asked once for their national ID and licence number, which go on the rental contract.

Payment Service and the Maintenance Shop (อู่บำรุงรักษารถ) are external entities, so they are simulated as windows with a dark "external system (simulated)" banner.

## Test data

| Scenario | How to trigger it |
|---|---|
| Card accepted | `4111 1111 1111 1111`, any future expiry, 3-digit CVV |
| Card declined by the bank | `4000 0000 0000 0002` |
| Payment timeout (narrative 1) | On the payment window, click "Simulate payment timeout" (the real limit is 15 minutes) |
| Cancelling inside 24 hours (narrative 3) | `somchai` › My rentals › BYD Atto 3 (pick-up tomorrow) › Cancel |
| Editing inside 24 hours | `somchai` › My rentals › BYD Atto 3 › the Edit button is locked with a notice |
| Hand-over before the contract is signed | `office1` › Hand-over › Somchai's Toyota Camry booking |
| No car selected | `mech1` › Record car work › Save without choosing a car from the dropdown (it lists only cars with work assigned to that mechanic) |
| Incomplete inspection (narrative 2) | `mech1` › ชช 3344 › leave some pass/fail items blank, then save |
| Invalid national ID | Register with `1103700012347` (the valid one is `1103700012346`) |
| Invalid licence number | Register (or create a walk-in rental) with `000`; a valid one is 13 digits, e.g. `6100012345678` |
| 5 wrong passwords | The account is locked for 60 seconds |

## User flows

```
Customer       Register / sign in (1.1) → pick-up and return date, time and branch (1.2)
               → only the cars free for that period → choose a car
               → review rent + deposit → confirm (1.3)
               → Payment Service: QR or card (1.4) → Booking ID + contract by email → sign the contract
               → view / edit / cancel (2.1–2.3) → pay the difference (2.4) → invoice · repair costs (3.4)

Office         Check available cars by date and type (1.2) → create a walk-in rental by car make; the system assigns a free car (1.3)
Employee       → take payment → customer signs the contract
               → hand-over: odometer, fuel, time (2.6) → return: late fee, deposit refund or damage report (2.7)

Damage found at return → job waits for assignment → Mechanic Manager assigns it (3.3)
               → mechanic records inspection + maintenance (3.4) → [sent to shop → shop returns result + cost]
               → mechanic reports "done" → Mechanic Manager approves the car as ready
               → repair cost is deducted from the deposit, the rest is refunded → car is "Available" again

Office         Daily dashboard · system data · manage employees · rental rates (3.2)
Manager

Big Manager    Company overview + per-car lookup by plate · revenue analysis (day/month/year, car type, branch) · KPIs
               · reports filtered by period and plate + CSV/PDF export (4)
```

## Business rules used in the prototype

- Rent is charged per day, rounded up every 24 hours, using the cheapest mix of monthly, weekly and daily rates. Minimum rental is 4 hours, maximum 90 days.
- A booking holds the car for 15 minutes while payment is pending. If it isn't paid, the system cancels it automatically.
- Free cancellation with a full refund up to 24 hours before pick-up. Staff can cancel at any time.
- Customers can't edit a booking within 24 hours of pick-up (the same window as cancelling); office staff can still amend it at the counter.
- Editing a rental issues a new contract that must be signed again. A positive difference is paid through Payment Service; a negative one is refunded.
- Returning more than 1 hour late costs 10% of the daily rate per hour (capped at 150% per day), deducted from the deposit.
- The contract must be signed before hand-over. The odometer reading can't be lower than the last recorded value.
- Service is due every 6 months or 10,000 km, plus an annual inspection on the registration date.
- Revenue = rent + differences + late fees + damage charges − refunds (deposits excluded). Profit = revenue − maintenance cost.

## Gaps to fix in the diagrams (details on the "FR map" page)

These FRs work in the prototype but have no supporting use case or data flow: C-06 deposit, C-09 sending the contract, C-15 invoice, C-17 refund on cancellation, C-18 signing the contract, C-19 deposit refund, OE-03 creating a rental (no use case), MM-04 total repair costs, MM-05 maintenance schedule, MM-07 approving a car as ready.

Use cases with no FR: "ตรวจสอบค่าใช้จ่ายในการซ่อมรถ" (check repair costs, Customer) and "ดูอัตราการใช้งานของรถแต่ละคัน" (view utilisation per car, Mechanic Manager).

### Created by inherited access

The DFD as drawn gives each role only its own processes. Inherited access means these flows now exist in the prototype but not in the diagrams:

| Role | New processes it reaches | Flows to add |
|---|---|---|
| Office Manager | 1.2, 1.3, 1.4, 2.1–2.6 | Copy every Office Employee flow (availability, create rental, edit, delete, hand-over, return) |
| Mechanic Manager | 3.4 | Copy the Mechanic Employee flows (assigned cars, inspection, maintenance, progress, costs) |
| Big Manager | 1.2–1.4, 2.1–2.6, 3.2–3.5 | All Office Employee, Office Manager, Mechanic Employee and Mechanic Manager flows |
| All staff | 1.1–1.4, 2.1–2.4 as a renter | None if the staff member is drawn as the Customer entity; their ID and licence go to D1 like any customer |

Either add these flows (and «extends»/generalisation links between the actors on the use case diagram), or note in the report that managers act as the lower role when they use those pages.

## Database (MySQL)

The prototype keeps its data in the browser, but `database/` has the same data stores as a MySQL 8 / MariaDB schema, seeded with the prototype's demo data.

```
mysql --default-character-set=utf8mb4 -u root -p < database/01-d2-cars.sql
mysql --default-character-set=utf8mb4 -u root -p < database/02-d1-d3-d6.sql
```

Load them in that order (or import both in phpMyAdmin). Keep the client on utf8mb4, or Thai text shows as "???". Every demo account's password is `pass1234`, stored as SHA-256 for the demo only.

| DFD data store | Tables |
|---|---|
| D1 ผู้ใช้ | `users` |
| D2 รถ | `cars`, with lookup tables `branches` and `car_types` |
| D3 อัตราค่าเช่า | `rates` |
| D4 การเช่า | `rentals` (contract, hand-over and return are columns) |
| D5 การชำระเงิน | `payments` (refunds are negative amounts) |
| D6 การซ่อมบำรุง | `maintenance_jobs`, `inspection_items`, `maintenance_logs`, `job_progress` |

Views: `v_fleet_status`, `v_car_service_due` (maintenance schedule), `v_rental_detail`, `v_daily_revenue`, `v_repair_cost_per_car`.

## File structure

| File | Contents |
|---|---|
| `index.html` | Single page that loads the scripts in order |
| `css/style.css` | All styles, including mobile layout and print styles (contract, invoice, reports) |
| `js/core.js` | i18n, data stores D1–D6, demo data, business rules, simulated Payment Service |
| `js/frs.js` | All 52 FRs with their screen, DFD and use case mapping |
| `js/customer.js` | Customer screens |
| `js/office.js` | Office Employee and Office Manager screens |
| `js/mechanic.js` | Mechanic and Mechanic Manager screens, including the simulated Maintenance Shop |
| `js/exec.js` | Big Manager screens and the FR map |
| `js/app.js` | Sign-in, registration and role-based menus |
| `database/01-d2-cars.sql` | MySQL schema and demo data for D2 รถ (cars, branches, car types) |
| `database/02-d1-d3-d6.sql` | MySQL schema and demo data for D1, D3, D4, D5 and D6 |
