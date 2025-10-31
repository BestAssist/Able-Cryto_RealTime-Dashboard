# Able — Real‑Time Crypto Dashboard (NestJS + React)

A complete solution for the **Senior Fullstack Engineer – Take‑Home Exercise**: a real‑time dashboard that streams live exchange rates for **ETH/USDC**, **ETH/USDT**, and **ETH/BTC**, calculates **hourly averages**, and renders **live charts**.

This project is productionized with **Docker** and **docker‑compose** for a one‑command start, and uses **PostgreSQL** for persistence.

---

## Quick Start (Docker)

> Prereqs: Docker & Docker Compose

1. **Set up environment variables:**
   
   Create a `.env` file in the project root with:
   ```bash
   FINNHUB_API_KEY=your_actual_api_key_here
   DATABASE_URL=postgres://able:able@db:5432/able
   VITE_WS_URL=ws://localhost:3000
   VITE_API_ORIGIN=http://localhost:3000
   ```
   
   **Get your Finnhub API key at:** https://finnhub.io (free tier available, up to 60 requests/minute)

2. **Start everything:**
   ```bash
   docker compose up --build
   ```

3. **Open the app:**
   - Frontend: http://localhost:8080
   - Backend health: http://localhost:3000/api/health

> The database persists to a local **Docker volume** (`able_db_data`).

---

## Tech Stack

- **Backend:** NestJS (TypeScript), WebSockets, PostgreSQL (`pg`), pino logging
- **Frontend:** React + Vite (TypeScript), Recharts
- **Realtime:** WebSocket (server emits ticks + hourly averages)
- **Persistence:** PostgreSQL (hourly aggregates table)
- **Docker:** Multi-stage images + `docker-compose` for backend, frontend, db

---

## What's Implemented (per spec)

- **Backend**
  - ✅ Connects to **Finnhub WebSocket API** (`wss://ws.finnhub.io`) 
  - ✅ Subscribes to real-time exchange rates:
    - **ETH/USDC**: `BINANCE:ETHUSDC`
    - **ETH/USDT**: `BINANCE:ETHUSDT`
    - **ETH/BTC**: `BINANCE:ETHBTC`
  - ✅ **Calculates and persists hourly averages** in PostgreSQL (upsert on every trade)
  - ✅ **Streams data to frontend via WebSocket** (`/ws` endpoint)
  - ✅ Handles **connection failures with exponential backoff reconnection**
  - ✅ Error handling and logging with pino
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
  - Automated tests (backend unit tests + frontend component tests)
- **Docs**
  - This README covers setup and implementation details

---

## Local Dev without Docker (optional)

- **Backend**
  ```bash
  cd backend
  # Create .env file with FINNHUB_API_KEY and DATABASE_URL
  npm install
  npm run build
  npm start
  ```

- **Frontend**
  ```bash
  cd frontend
  npm install
  npm run dev  # http://localhost:5173
  ```

> Ensure Postgres is running and `DATABASE_URL` is valid.

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

Comprehensive automated test suites are included for both backend and frontend:

- **Backend Tests** (Jest + NestJS Testing)
  - ✅ `PricesService` - Database operations, hourly averages, health checks
  - ✅ `PricesController` - API endpoints, validation, error handling
  - ✅ `FinnhubService` - WebSocket connection, reconnection logic, message handling
  - ✅ `WsGateway` - Broadcasting to clients, connection state management
  
  ```bash
  cd backend
  npm test
  ```

- **Frontend Tests** (Vitest + React Testing Library)
  - ✅ `useLivePrices` hook - WebSocket connection, state management, error handling
  - ✅ `TickerCard` component - Price display, formatting, loading states
  - ✅ `ConnectionBadge` component - Connection state rendering
  - ✅ `PairChart` component - Chart rendering with data
  - ✅ `App` component - Integration tests, loading states
  - ✅ API configuration tests
  
  ```bash
  cd frontend
  npm test
  ```

**Test Coverage Includes:**
- Unit tests for all services and components
- Integration tests for API endpoints
- WebSocket connection and reconnection scenarios
- Error handling and edge cases
- State management validation
- UI component rendering tests

---

## Troubleshooting

**401 Authentication Error:**
- Ensure `FINNHUB_API_KEY` is set in your `.env` file or environment variables
- Verify your API key is valid at https://finnhub.io
- The backend will stop retrying on 401 errors to prevent spam

**Dashboard not showing:**
- Check that the WebSocket connection is established (check browser console)
- Verify backend is running: `curl http://localhost:3000/api/health`
- Check backend logs for connection errors

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
- Includes automated tests and error handling

