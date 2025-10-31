# Able — Real‑Time Crypto Dashboard (NestJS + React)

A complete solution for the **Senior Fullstack Engineer – Take‑Home Exercise**: a real‑time dashboard that streams live exchange rates for **ETH/USDC**, **ETH/USDT**, and **ETH/BTC**, calculates **hourly averages**, and renders **live charts**.

This project is productionized with **Docker** and **docker‑compose** for a one‑command start, and uses **PostgreSQL** for persistence.

---

## Tech Stack

- **Backend:** NestJS (TypeScript), WebSockets, PostgreSQL (`pg`), pino logging
- **Frontend:** React + Vite (TypeScript), Recharts
- **Realtime:** WebSocket (server emits ticks + hourly averages)
- **Persistence:** PostgreSQL (hourly aggregates table)
- **Docker:** Multi-stage images + `docker-compose` for backend, frontend, db

---

## Quick Start (Docker)

> Prereqs: Docker & Docker Compose

1. Copy `.env.example` to `.env` and set your **Finnhub API key**:
   ```bash
   cp .env.example .env
   # then edit .env and set FINNHUB_API_KEY=your_key_here
   ```

2. Start everything:
   ```bash
   docker compose up --build
   ```

3. Open the app:
   - Frontend: http://localhost:8080
   - Backend health: http://localhost:3000/api/health

> The database persists to a local **Docker volume** (`able_db_data`).

---

## What’s Implemented (per spec)

- **Backend**
  - Connects to **Finnhub WebSocket** and subscribes to:  
    `BINANCE:ETHUSDC`, `BINANCE:ETHUSDT`, `BINANCE:ETHBTC`  
    (maps to ETH/USDC, ETH/USDT, ETH/BTC respectively)
  - Handles **reconnect with exponential backoff** and logs connection states
  - **Streams** normalized tick messages over **WebSocket** to the frontend
  - **Computes + persists hourly averages** in Postgres (upsert on every tick)
  - Exposes REST endpoints:
    - `GET /api/health`
    - `GET /api/pairs` – list supported pairs + symbols
    - `GET /api/averages?pair=ETH/USDT&hours=24` – hourly history
- **Frontend**
  - React dashboard with **live charts** (Recharts) for the 3 pairs
  - Shows **current price**, **last update timestamp**, and **hourly avg**
  - **Connection badge** for connecting/connected/disconnected
  - **Graceful errors** if backend is unavailable (auto‑retry + UI cue)
- **Code Quality**
  - Clean TypeScript types, separation of concerns
  - Basic logging
  - A couple of **automated tests** (backend unit test + frontend component test)
- **Docs**
  - This README covers setup and implementation details

---

## Finnhub API Key

Sign up at https://finnhub.io (free tier supports up to 60 req/min).  
Set the key in `.env` as `FINNHUB_API_KEY`.

> We subscribe to **Binance** symbols which correspond to the requested pairs:
> - ETH/USDC → `BINANCE:ETHUSDC`
> - ETH/USDT → `BINANCE:ETHUSDT`
> - ETH/BTC  → `BINANCE:ETHBTC`

---

## Local Dev without Docker (optional)

- **Backend**
  ```bash
  cd backend
  cp .env.example .env   # set FINNHUB_API_KEY and DATABASE_URL
  npm ci
  npm run dev
  ```

- **Frontend**
  ```bash
  cd frontend
  npm ci
  npm run dev  # http://localhost:5173
  ```

> Ensure Postgres is running and `DATABASE_URL` is valid (see `.env.example`).

---

## Architecture & Realtime Strategy

- **Inbound Realtime:** Single **Finnhub WS** client subscribes to target symbols.  
  Messages of type `trade` are normalized to `{ pair, price, ts, hourlyAvg }`.
- **Aggregation:** Each tick is **upserted** into an hourly bucket in Postgres  
  (`hour_start` rounded down to the hour) by updating `sum` and `count`; read‑time
  average is `sum / count`.
- **Outbound Realtime:** Nest **WebSocketGateway** broadcasts every normalized tick
  to connected clients. Frontend keeps **in‑memory series** per pair and updates charts.
- **Resilience:** On Finnhub WS close/error, we **reconnect** with capped backoff.  
  Frontend shows connection status and **auto‑retries** WS if backend restarts.

---

## Endpoints

- `GET /api/health` → `{ ok: true }`
- `GET /api/pairs` → mapping of pairs to provider symbols
- `GET /api/averages?pair=ETH/USDT&hours=24`
  ```json
  [
    { "pair":"ETH/USDT", "hourStart": 1730160000000, "avg": 3431.22, "count": 98 }
  ]
  ```

---

## Testing

- **Backend**
  ```bash
  cd backend
  npm test
  ```

- **Frontend**
  ```bash
  cd frontend
  npm test
  ```

---

## Notes

- Docker images are **multi‑stage** for small runtime images.
- CORS and WS are configured for `http://localhost:8080` and `http://localhost:5173`.
- If you need to reset the DB volume:
  ```bash
  docker compose down -v
  docker compose up --build
  ```

---

## Submission

- Code runs via `docker compose up --build`
- Architecture + decisions documented here
- Includes basic tests and error handling

