# TrailSync India — Unified Group Travel Marketplace & Operator B2B SaaS

A production-grade, full-stack Indian Group Travel Marketplace and B2B SaaS platform built with **Node.js/Express**, **MySQL (InnoDB)**, and **React + Vite**.

---

## 🌟 Key Platform Features

### 1. Multi-Persona Role Architecture
- **🎒 Traveler Marketplace**: Discover verified group trips, compare itineraries side-by-side, check group vibe harmony scores, book with automated cancellation refund slabs, and trigger 24x7 Safety SOS.
- **📊 Operator B2B Console**: Live batch inventory management, offline WhatsApp/Instagram +1 seat sync, dynamic passenger manifest exports (CSV), waitlists, manual UPI verification, and review response center.
- **🏛️ Admin Governance & Escrow**: Unit economics analytics (GMV, 10% platform commission, 2% gateway fee, net margin), operator KYC verification audits, bank UTR escrow settlements, and safety incident resolutions.

### 2. High-Concurrency Inventory & Escrow Engine
- **Atomic Booking Engine**: Optimistic concurrency control via `version` numbers to prevent overbooking on concurrent checkout.
- **Milestone-Based Escrow**: Traveler funds are held in escrow and released post-departure via bank UTR tracking.
- **Automated Refund Calculation**: Tiered refund slabs based on hours remaining until departure.
- **Incident Escrow Freezing**: P0/P1 emergency safety incidents immediately freeze operator payouts pending admin investigation.

### 3. Vibe Matcher™ (Model B Compatibility Engine)
- 5-dimensional traveler personality vectors:
  - Pace (`budget` vs `luxury`)
  - Social energy (`introvert` vs `party`)
  - Wake cycle (`early_bird` vs `night_owl`)
  - Adventure tolerance (`relaxed` vs `thrill`)
  - Food flexibility (`strict_veg` vs `exploratory`)
- Computes cosine similarity against existing batch rosters to provide a compatibility match score (0–100%).

---

## 🏗️ Tech Stack

- **Backend**: Node.js, Express.js, MySQL2 (`mysql2/promise`), JWT, bcryptjs
- **Database**: MySQL 8.0 (18 relational tables, InnoDB, foreign keys, transactions)
- **Frontend**: React 18, Vite, Lucide Icons, Modern CSS Design System
- **Testing**: End-to-End automated validation suite (25/25 assertions passing)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MySQL (v8.0+)

### 1. Clone the Repository
```bash
git clone https://github.com/tanishkgupta20012004-sketch/The-tour-project.git
cd The-tour-project
```

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```

Configure your `.env` variables:
```env
PORT=5000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=tour_marketplace_db

JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=your_refresh_token_secret_key_long
REFRESH_TOKEN_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:5173
```

### 3. Install Backend & Frontend Dependencies
```bash
# Root / Backend dependencies
npm install

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 4. Database Migration & Seeding
```bash
# Run schema migrations (18 InnoDB tables)
npm run migrate

# Seed verified test operators, trips, departures, and demo users
npm run seed
```

### 5. Start Servers
```bash
# Start Backend (Port 5000)
npm run dev

# Start Frontend (Port 5173) in a separate terminal
cd frontend
npm run dev
```

Visit **http://localhost:5173** to access the application.

---

## 🧪 Automated Testing
Run the master E2E test suite covering all 6 phases:
```bash
npm run test:all
```

---

## 🔐 Demo Credentials (Seeded)

All demo accounts share the password: `Password@123`

| Role | Name | Email | Phone | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Traveler** | Aarav Verma | `aarav@example.com` | `9000000005` | `Password@123` |
| **Traveler** | Priya Nair | `priya@example.com` | `9000000006` | `Password@123` |
| **Operator (Verified)** | Vikram Singh (*Malwa Trails*) | `vikram@malwatrails.in` | `9000000003` | `Password@123` |
| **Operator (Verified)** | Rohan Mehta (*Himalayan Nomads*) | `rohan@himalayannomads.in` | `9000000002` | `Password@123` |
| **Operator (Pending KYC)** | Meera Rathore (*Royal Desert*) | `meera@royaldesert.in` | `9000000004` | `Password@123` |
| **Admin** | Platform Admin | `admin@tourmarketplace.in` | `9000000001` | `Password@123` |

---

## 📂 Project Directory Structure

```
├── database/            # MySQL migrations and seed scripts
│   ├── migrate.js
│   └── seed.js
├── src/                 # Backend source code
│   ├── config/          # Database & environment configurations
│   ├── controllers/     # Route handlers (auth, trips, bookings, escrow, reviews)
│   ├── middleware/      # Auth, RBAC, error handler, rate limiters
│   ├── routes/          # Express API router definitions
│   ├── services/        # Business logic & transaction handling
│   ├── app.js           # Express application setup
│   └── server.js        # HTTP server entry point
├── scripts/             # End-to-end verification scripts
│   └── verify-all-phases.js
├── frontend/            # React 18 + Vite frontend
│   ├── src/
│   │   ├── api.js       # Centralized API service for all 45 endpoints
│   │   ├── App.jsx      # Multi-portal role UI (Traveler, Operator, Admin)
│   │   ├── styles.css   # Modern glassmorphic design system
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 📜 License
MIT License. Built for modern group travel in India.
