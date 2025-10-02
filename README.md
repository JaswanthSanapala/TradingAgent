# Welcome to AI Trading Platform

A modern, production-ready web application codebase powered by cutting-edge technologies, designed to accelerate your trading with AI-powered analysis assistance.

## Overview

This TypeScript-first trading research platform combines a modern Next.js UI with a strong backend: a custom Socket.IO server, Prisma/SQLite database, and a modular core for strategies, indicators, and backtests.

Key capabilities:

- Backtesting with detailed metrics (PnL, win-rate, drawdown, Sharpe, profit factor)
- Technical indicators and patterns (RSI, MACD, Bollinger Bands, ATR, CCI, SMA, candlestick patterns)
- Data pipeline with pluggable sources (ships with mock data; add real providers easily)
- Real-time app updates via Socket.IO
- Comprehensive Prisma schema for agents, strategies, trades, backtests, and more

Note: Live trading, real broker connections, and production-grade ML are not enabled by default. The codebase includes stubs and structure to integrate them.

---

## Tech Stack

- Next.js 15 (App Router), React 19, TypeScript 5
- Tailwind CSS 4, shadcn/ui, Lucide icons
- Prisma ORM (SQLite)
- Socket.IO (server + client)
- Nodemon + tsx custom server

---

## Folder Structure

```
.
├─ prisma/
│  └─ schema.prisma            # Database schema (SQLite)
├─ public/                     # Static assets
├─ src/
│  ├─ app/                     # Next.js App Router
│  ├─ components/              # UI components (incl. shadcn/ui wrappers)
│  ├─ hooks/                   # Custom hooks
│  ├─ lib/                     # Core domain logic
│  └─ workers/                 # Background workers
├─ server.ts                   # Custom Next.js + Socket.IO server
├─ next.config.ts              # Next.js configuration
├─ package.json                # Scripts and dependencies
├─ tsconfig.json               # TypeScript configuration
├─ tailwind.config.ts          # Tailwind configuration
└─ .gitignore                  # Excludes node_modules, .env*, .next, etc.
```

---

## Environment Variables

Create a `.env` file in the project root. Required by `src/lib/config.ts`:

Example .env:
```dotenv
NODE_ENV=
HOSTNAME=
PORT=
SCHEDULER_ENABLED=
SCHEDULER_TICK_MS=
REDIS_ENABLED=
REDIS_URL=
SUPERVISED_WORKER_ENABLED=
SUPERVISED_WORKER_ENABLED=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SOCKET_PATH=
NEWS_FEEDS=
DATABASE_URL=
EXCHANGE_ID=
EXCHANGE_API_KEY=
EXCHANGE_SECRET=
EXCHANGE_SANDBOX=
EXECUTION_ENABLED=
RISK_PER_TRADE_PCT=
QUOTE_CURRENCY=
ORDER_POLL_MS=
PREDICTION_MIN_CONF=
PREDICTION_COOLDOWN_SEC=
DO_NOT_TRADE=
SYMBOLS=
TIMEFRAMES=
```

---

## Setup & Installation

```bash
# 1) Install dependencies
npm install

# 2) Generate Prisma client and create the SQLite schema
npm run db:generate
npm run db:push
```

This creates `db/custom.db` and generates the Prisma client.

---

## Development

Runs a custom Next.js server with Socket.IO via `server.ts`.

```bash
npm run dev
```

Open http://localhost:3000

---

## Production

Build Next.js, then start the custom server.

```bash
# Build Next.js
npm run build

# Start (POSIX shells)
npm start
```

Windows PowerShell:

```powershell
$env:NODE_ENV = 'production'; npx tsx server.ts
# or
$env:NODE_ENV = 'production'; node --loader tsx server.ts
```

---

## Useful Scripts

```bash
# Prisma
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:reset

# Lint
npm run lint
```

---

## Features Summary

- Strategy-driven AI agents (pluggable training/inference)
- Backtesting with rich metrics
- Risk & money management in simulations
- Indicators & candlestick patterns built-in
- Data pipeline with indicator calculation
- Real-time updates via Socket.IO
- API-first architecture with Next.js routes
- Modern UI/UX with shadcn/ui + Tailwind

---

## Troubleshooting

- If `SYMBOLS` or `TIMEFRAMES` are missing, the server will throw on startup. Define them in `.env`.
- On Windows production start, prefer the PowerShell command over `npm start`.
- Ensure you ran `npm run build` before production start.
- `.gitignore` excludes `.env*`, `.next/`, `node_modules/`, `/data`, logs, etc. After cloning, follow Setup to recreate what's needed.

---
