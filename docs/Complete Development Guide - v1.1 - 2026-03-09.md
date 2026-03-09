# Complete Development Guide: US ETF Analysis Dashboard (v1.1)

## A Step-by-Step Tutorial for Building a Professional ETF Analytics Application

**Last Updated**: 2026-03-09
**Revision**: v1.1 (Modern Header & Enhanced Simulation Update)

---

## 🆕 What's New in v1.1

- **3-Layer Header Architecture**: Optimized layout for brand identity, navigation, and filtering.
- **Robust Data Fetching**: Integration of `yahooquery` as a backup to `yfinance` for higher reliability in 2026.
- **Enhanced Monte Carlo UI**: Educational help sections, input validation ranges, and improved visual hierarchy.
- **Full-Page Theming**: Migrated theme management to `document.body` for consistent background coverage across all resolutions.
- **Advanced Filtering**: Consolidated filter bar with collapsible advanced options.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Prerequisites & Setup](#2-prerequisites--setup)
3. [Project Structure](#3-project-structure)
4. [Backend Development](#4-backend-development)
5. [Frontend Development](#5-frontend-development)
6. [Running the Application](#6-running-the-application)
7. [Key Features Explained](#7-key-features-explained)
8. [2026 Best Practices](#8-2026-best-practices)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Project Overview

### What We Are Building

A professional-grade **US ETF (Exchange-Traded Fund) Analysis Dashboard** featuring:

- **Analysis Pool Management**: Track a curated list of high-volume US ETFs.
- **Real-time Metrics**: Live prices, returns, and fundamentals via parallel API fetching.
- **Advanced Simulation**: High-fidelity Monte Carlo projections with educational guidance.
- **Modern UI/UX**: Dark mode by default, glassmorphism elements, and responsive layout.

### Technology Stack (2026 Edition)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18+ / TypeScript / Vite | Modern, typed UI component architecture |
| **Backend** | FastAPI (Python 3.12+) | High-performance asynchronous REST API |
| **Database** | SQLite + SQLAlchemy | Lightweight persistent storage for favorites/pool |
| **Data Engine** | yfinance + yahooquery | Hybrid data retrieval for maximum uptime |
| **Styling** | Vanilla CSS (Tokens) | Flexible, high-performance design system |

---

## 2. Prerequisites & Setup

### Environment Requirements

- **Node.js**: v20 or higher (LTS recommended)
- **Python**: v3.12 or higher
- **Browser**: Modern evergreen browser (Chrome, Edge, Safari)

### Project directory

Our project is located at:
`d:\z_AI_Project\US_ETF_Analysis`

---

## 3. Project Structure

```text
US_ETF_Analysis/
├── backend/
│   ├── src/
│   │   ├── main.py             # App entry, Routes, Middleware
│   │   ├── database.py         # DB Schema & SQLite operations
│   │   └── services/
│   │       ├── yfinance_service.py # Hybrid fetching (yf + yq)
│   │       └── pool_manager.py    # ETF Pool logic
│   └── requirements.txt        # Updated dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SimulationModal.tsx  # Enhanced with help sections
│   │   │   ├── PortfolioModal.tsx
│   │   │   └── PriceChart.tsx       # Lightweight Charts integration
│   │   ├── hooks/
│   │   │   └── useETF.ts            # State hooks for favorites/data
│   │   ├── App.tsx                  # New 3-Layer Header root
│   │   └── App.css                  # Modernized CSS tokens
│   └── package.json
└── data/
    └── etf_analysis.db              # SQLite Database
```

---

## 4. Backend Development

### Step 4.1: Updated requirements.txt

Include `yahooquery` for 2026 metadata robustness.

```txt
fastapi>=0.110.0
uvicorn>=0.29.0
yfinance>=0.2.36
yahooquery>=2.3.7
pandas>=2.2.0
numpy>=1.26.0
sqlalchemy>=2.0.0
```

### Step 4.2: Hybrid Data Service (yfinance_service.py)

In v1.1, we use `yahooquery` as a fallback or for specific metadata like sector allocations.

```python
import yfinance as yf
from yahooquery import Ticker as YTicker

def get_etf_reliable_data(symbol: str):
    # Try yfinance first
    ticker = yf.Ticker(symbol)
    info = ticker.info
    
    # Fallback/Supplemental info via yahooquery
    if not info.get('sector'):
        yq_ticker = YTicker(symbol)
        yq_info = yq_ticker.asset_profile.get(symbol, {})
        # ... merge logic
```

### Step 4.3: Database Migrations

The v1.1 database includes `pool_stats` to track when we last synced the entire market list.

---

## 5. Frontend Development

### Step 5.1: The 3-Layer Header (App.tsx)

The header is now organized into three distinct functional layers:

1. **Top Bar** (`.header-top-bar`): Brand, Sync status, and Global actions (Theme/Refresh).
2. **Nav Tabs** (`.nav-tabs`): View switching (All, Favorites, My Portfolio).
3. **Filter Bar** (`.filter-bar`): Search, Sector Selection, Sort, and Advanced Filter toggle.

### Step 5.2: Theme Management

For a premium experience, theme classes are applied to the `document.body` to prevent "white-edge" flickering on large monitors.

```typescript
// App.tsx
useMemo(() => {
  document.body.className = darkMode ? 'dark' : 'light';
}, [darkMode]);
```

### Step 5.3: Enhanced SimulationModal

The Simulation Modal now includes a "Help & Instructions" section to guide users through the Monte Carlo parameters.

- **Help Text**: Side-by-side with inputs explaining "Initial Investment", "Years", etc.
- **Ranges**: Explicitly mentioning input limits (e.g., Min $1K, Max 30 years).

---

## 6. Running the Application

1. **Backend**: `python -m src.main` (Port 8000)
2. **Frontend**: `npm run dev` (Port 5173/5174)

---

## 7. Key Features Explained

### 7.1 Analysis Pool

Unlike generic tools, we analyze a curated "Pool". This ensures data quality and performance, focusing on the most relevant ETFs for US investors.

### 7.2 Monte Carlo Logic

We use **Geometric Brownian Motion (GBM)** to simulate price paths.

- **P10 (Pessimistic)**: The bottom 10% of outcomes.
- **P50 (Median)**: The most likely middle ground.
- **P90 (Optimistic)**: The top 10% of outcomes.

---

## 8. 2026 Best Practices (Supplementary)

### UI/UX Trends

- **Information Hierarchy**: Use font-weight and opacity rather than just color to emphasize levels of importance.
- **Micro-interactions**: Subtle scale-up on card hover (1.02x) for tactile feedback.
- **Glassmorphism**: Use `backdrop-filter: blur(8px)` on modals for a modern "premium" feel.

### Financial Analysis Trends

- **Data Redundancy**: Always use multiple free APIs (yfinance + yahooquery) to mitigate endpoint downtime.
- **Fat-Tail Modeling**: Consider replacing the normal distribution in simulations with a Students-t distribution for better crash prediction (Future Goal).

---

## 9. Troubleshooting

- **CORS Errors**: Ensure the backend's `allow_origins` includes your Vite dev port.
- **Sync Failures**: If yfinance fails, check your VPN/Proxy status as Yahoo Finance can be geolocation-sensitive.
- **Style Gaps**: If white space appears on the right, ensure `document.body` has the theme class applied correctly.

---

**Document Version**: 1.1
**Today's Date**: 2026-03-09
**Status**: ACTIVE
