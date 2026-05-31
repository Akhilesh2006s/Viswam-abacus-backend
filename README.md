# Viswam Abacus Backend

Standalone API for **Abacus** schools, teachers, and students. Uses the **same MongoDB** as the main LMS backend.

## Setup

```bash
npm install
cp .env.example .env
# Set MONGO_URI and JWT_SECRET (must match main LMS for Super Admin tokens)
npm start
```

Runs on **port 5001** by default.

## Endpoints

| Path | Description |
|------|-------------|
| `GET /health` | Health check |
| `POST /api/auth/login` | Abacus teacher / student / super-admin login |
| `/api/abacus/*` | Super Admin — schools, teachers, students, catalog |

## Run with main LMS

Terminal 1 — main backend (port 5000):

```bash
cd backend && npm start
```

Terminal 2 — Abacus backend (port 5001):

```bash
cd abacus-backend && npm start
```

Terminal 3 — frontend:

```bash
cd client && npm run dev
```

Set in `client/.env`:

```
VITE_ABACUS_API_URL=http://localhost:5001
```
