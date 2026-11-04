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

Payment Service and the Maintenance Shop (อู่บำรุงรักษารถ) are external entities, so they are simulated as windows with a dark "external system (simulated)" banner.

## Test data

| Scenario | How to trigger it |
|---|---|
| Card accepted | `4111 1111 1111 1111`, any future expiry, 3-digit CVV |
| Card declined by the bank | `4000 0000 0000 0002` |
| Payment timeout (narrative 1) | On the payment window, click "Simulate payment timeout" (the real limit is 15 minutes) |
| Cancelling inside 24 hours (narrative 3) | `somchai` › My rentals › BYD Atto 3 (pick-up tomorrow) › Cancel |
| Hand-over before the contract is signed | `office1` › Hand-over › Somchai's Toyota Camry booking |
| No car selected | `mech1` › Record car work › Save without choosing a car from the dropdown (it lists only cars with work assigned to that mechanic) |
| Incomplete inspection (narrative 2) | `mech1` › ชช 3344 › leave some pass/fail items blank, then save |
| Invalid national ID | Register with `1103700012347` (the valid one is `1103700012346`) |
| 5 wrong passwords | The account is locked for 60 seconds |

## User flows

```
Customer       Register / sign in (1.1) → choose a booking mode:
                 a) Pick-up first: date, time and branch (1.2) → only cars free for that period → choose a car
                 b) Car first: choose a car → its branch + a 28-day calendar of free days → choose pick-up and return
               → review rent + deposit → confirm (1.3)
               → Payment Service: QR or card (1.4) → Booking ID + contract by email → sign the contract
               → view / edit / cancel (2.1–2.3) → pay the difference (2.4) → invoice · repair costs (3.4)

Office         Check available cars (1.2) → create a walk-in rental (1.3) → take payment → customer signs the contract
Employee       → hand-over: odometer, fuel, time (2.5) → return: late fee, deposit refund or damage report (2.6)

Damage found at return → job waits for assignment → Mechanic Manager assigns it (3.3)
               → mechanic records inspection + maintenance (3.4) → [sent to shop → shop returns result + cost]
               → mechanic reports "done" → Mechanic Manager approves the car as ready
               → repair cost is deducted from the deposit, the rest is refunded → car is "Available" again

Office         Daily dashboard · system data · manage employees · rental rates (3.2)
Manager

Big Manager    Company overview · revenue analysis (day/month/year, car type, branch) · KPIs · reports + CSV/PDF export (4)
```

## Business rules used in the prototype

- Rent is charged per day, rounded up every 24 hours, using the cheapest mix of monthly, weekly and daily rates. Minimum rental is 4 hours, maximum 90 days.
- A booking holds the car for 15 minutes while payment is pending. If it isn't paid, the system cancels it automatically.
- Free cancellation with a full refund up to 24 hours before pick-up. Staff can cancel at any time.
- Editing a rental issues a new contract that must be signed again. A positive difference is paid through Payment Service; a negative one is refunded.
- Returning more than 1 hour late costs 10% of the daily rate per hour (capped at 150% per day), deducted from the deposit.
- The contract must be signed before hand-over. The odometer reading can't be lower than the last recorded value.
- Service is due every 6 months or 10,000 km, plus an annual inspection on the registration date.
- Revenue = rent + differences + late fees + damage charges − refunds (deposits excluded). Profit = revenue − maintenance cost.

## Gaps to fix in the diagrams (details on the "FR map" page)

These FRs work in the prototype but have no supporting use case or data flow: C-06 deposit, C-09 sending the contract, C-15 invoice, C-17 refund on cancellation, C-18 signing the contract, C-19 deposit refund, OE-03 creating a rental (no use case), MM-04 total repair costs, MM-05 maintenance schedule, MM-07 approving a car as ready.

Use cases with no FR: "ตรวจสอบค่าใช้จ่ายในการซ่อมรถ" (check repair costs, Customer) and "ดูอัตราการใช้งานของรถแต่ละคัน" (view utilisation per car, Mechanic Manager).

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
