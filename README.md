<<<<<<< HEAD
# 🔬 SmartLab OS - Smart Lab Resource Management System

A high-tech, production-grade **Smart Laboratory Resource Management System** with full **Frontend-to-Backend** implementation in HTML5, CSS3, JavaScript, and Python REST API.

---

## 🌟 Key Features

### 1. 📊 Real-Time IoT Facility & Environmental Telemetry
- Autonomous monitoring of temperature (°C), relative humidity (%), CO2 / Air Quality Index (ppm), power draw (kW), and room occupancy across multiple laboratory wings (*Spectroscopy & Optics, Bio-Molecular, Organic Synthesis, Robotics & IoT*).
- Live interactive time-series telemetry charts powered by **Chart.js**.
- Automatic threshold anomaly alerts with safety indicators.

### 2. 🔬 Precision Instrument & Equipment Catalog
- Multi-category equipment catalog (*Analytical, Imaging, Bio-Process, Optics, Fabrication*).
- Real-time status indicators: `Available`, `In Use`, `Under Maintenance`.
- Integrated Digital **QR Code Pass Generator** for quick check-in / check-out.
- Add and configure new instruments with specifications, calibration schedules, and hourly credit rates.

### 3. 📅 Conflict-Aware Smart Slot Booking
- Precise time-slot reservation system with instant overlap and collision detection.
- Dynamic duration and cost calculation.
- Lifecycle tracking: `Pending Approval`, `Confirmed`, `In-Session`, `Completed`.
- Role-based approvals for student reservations vs faculty requests.

### 4. 🧪 Hazardous Chemical & Reagent Inventory
- **NFPA 704 Standard Fire Diamond** visualizer (Health, Flammability, Instability, Special Hazards).
- Stock monitoring with threshold progress bars, batch numbers, CAS IDs, and expiration dates.
- Quick consumption logger and one-click restock actions.

### 5. 🛠️ Preventive Maintenance & Incident Work Orders
- Scheduled preventive calibration reminders and breakdown ticketing.
- Severity levels (`Low`, `Medium`, `High`, `Critical Emergency`) and technician assignments.
- One-click work order resolution returning instruments to operational status.

### 6. 🪪 Smart RFID Access Control Simulator
- Virtual RFID Keycard swipe console with department clearance validation.
- Live room occupancy tracking and security clearance logging.

### 7. 👥 Role-Based Access Control (RBAC) Switcher
- Instant 1-click persona switcher:
  - **Dr. Sarah Vance** (Lab Director / Admin)
  - **Markus Reed** (Chief Technician)
  - **Elena Rostova** (PhD Researcher / Student)

### 8. 📈 Audit Trail & Data Export
- Tamper-evident, chronological log of all laboratory events.
- One-click **CSV export** and print-ready laboratory compliance reports.

---

## 🚀 Getting Started

### Option 1: Full-Stack Mode (Python REST Backend + Frontend)
Run the built-in REST API server (requires Python 3):

```bash
python server.py
```

Then open your browser and navigate to:
```
http://localhost:8000
```

### Option 2: Standalone / Offline Mode
The frontend includes an intelligent **Dual-Engine Adapter (`api.js`)**. You can open `index.html` directly in any web browser (`file:///...` or static web server). If the Python backend is offline, the client automatically synchronizes with HTML5 LocalStorage without losing any interactive functionality!

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health check & server status |
| `GET` | `/api/summary` | Dashboard KPI metrics aggregation |
| `GET` | `/api/rooms` | Live IoT sensor data for all laboratory wings |
| `GET` | `/api/telemetry` | Time-series environmental data for Chart.js |
| `GET` | `/api/equipment` | Retrieve instrument catalog with filters (`category`, `status`, `q`) |
| `POST` | `/api/equipment` | Register a new laboratory instrument |
| `PUT` | `/api/equipment/:id` | Update equipment parameters or status |
| `DELETE` | `/api/equipment/:id` | Remove equipment from directory |
| `GET` | `/api/bookings` | Retrieve slot reservations |
| `POST` | `/api/bookings` | Create a new reservation with conflict validation |
| `POST` | `/api/bookings/:id/checkin` | Check in and start an active instrument session |
| `POST` | `/api/bookings/:id/checkout` | Complete session and release instrument |
| `GET` | `/api/inventory` | List chemicals, solvents, and consumables |
| `POST` | `/api/inventory/consume` | Deduct reagent quantity for an experiment |
| `POST` | `/api/inventory/restock` | Replenish inventory stock |
| `GET` | `/api/maintenance` | Retrieve maintenance and breakdown work orders |
| `POST` | `/api/maintenance` | Submit an incident breakdown ticket |
| `PUT` | `/api/maintenance/:id/resolve`| Resolve maintenance and restore instrument to Available |
| `POST` | `/api/access/swipe` | Simulate RFID badge door entry validation |
| `GET` | `/api/logs` | Fetch comprehensive audit trail and door access logs |

---

## 📂 Project Architecture

```
Website/
├── index.html            # Semantic single-page application structure & modals
├── index.css             # High-tech Cyber Slate Lab design system & theme tokens
├── app.js                # Core UI engine, Chart.js graphs, QR code passes, Web Audio FX
├── api.js                # Dual-mode API adapter (REST backend + offline fallback)
├── server.py             # Native Python HTTP & REST API server
├── data/
│   ├── initial_data.json # Seed database for instruments, chemicals, rooms, bookings
│   └── lab_data.json     # Persistent operational database
└── README.md             # Complete system documentation
```

---

## 💻 Tech Stack
- **Frontend**: HTML5 Semantic Elements, Modern CSS3 (Grid, Flexbox, Custom Properties, Blur Glassmorphism), Modular Vanilla JavaScript (ES6+).
- **Libraries (CDN)**: Chart.js, QRCode.js, FontAwesome 6, Google Fonts (Plus Jakarta Sans & JetBrains Mono).
- **Backend**: Python 3 Standard Library (`http.server`, `urllib.parse`, `json`, `os`, `time`, `random`).
- **Database**: Persistent JSON document store (`data/lab_data.json`) with atomic write updates.
=======
# Impact_Project
This project is based on the smart lab resource management system which will help the users to manage the resource and allocate the resource wisely to the usres and other customers who wanted to use the equipments.
>>>>>>> 9a6a92299f38dac2f6cb942a94f86019439b5c1b
