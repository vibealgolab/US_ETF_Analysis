from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from database import (
    init_db,
    load_mock_data_to_db,
    save_etf_data,
    get_all_etfs,
    get_etf_by_symbol,
    filter_etfs,
    add_favorite,
    remove_favorite,
    get_favorites,
    get_etf_pool,
    add_to_etf_pool,
    remove_from_etf_pool,
    get_etf_pool_symbols,
    initialize_default_etf_pool,
    log_sync,
    get_sync_history,
    get_pool_stats
)

from services import yfinance_service

app = FastAPI(title="US ETF Analysis API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()
initialize_default_etf_pool()

@app.on_event("startup")
async def startup_event():
    load_mock_data_to_db()

class ETFSummary(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    sector: str

class SimulationParams(BaseModel):
    symbols: List[str]
    allocations: List[float]
    initial_investment: float
    years: int
    num_simulations: int = 1000

class SimulationResult(BaseModel):
    year: int
    percentile_10: float
    percentile_50: float
    percentile_90: float
    mean: float

class SimulationResponse(BaseModel):
    initial_investment: float
    years: int
    num_simulations: int
    results: List[SimulationResult]
    final_percentiles: dict

@app.get("/")
def read_root():
    return {"message": "US ETF Analysis API", "version": "1.0.0"}

@app.get("/api/etfs", response_model=List[dict])
def get_etfs(pool_only: bool = False):
    if pool_only:
        pool_symbols = get_etf_pool_symbols()
        all_etfs = get_all_etfs()
        return [etf for etf in all_etfs if etf['symbol'] in pool_symbols]
    return get_all_etfs()

@app.get("/api/etfs/pool", response_model=List[dict])
def get_etfs_from_pool():
    """Get only ETFs that are in the pool."""
    pool_symbols = get_etf_pool_symbols()
    all_etfs = get_all_etfs()
    return [etf for etf in all_etfs if etf['symbol'] in pool_symbols]

@app.get("/api/etfs/summary", response_model=List[ETFSummary])
def get_etfs_summary():
    etfs = get_all_etfs()
    return [ETFSummary(**{k: etf[k] for k in ['symbol', 'name', 'price', 'change', 'change_percent', 'sector']}) for etf in etfs]

@app.get("/api/etfs/{symbol}")
def get_etf(symbol: str):
    etf = get_etf_by_symbol(symbol.upper())
    if not etf:
        raise HTTPException(status_code=404, detail="ETF not found")
    return etf

@app.get("/api/etfs/{symbol}/history")
def get_etf_history(symbol: str, period: str = "1y"):
    """Get historical price data for an ETF."""
    history = yfinance_service.fetch_etf_history(symbol.upper(), period)
    if not history:
        raise HTTPException(status_code=404, detail=f"Failed to fetch history for {symbol}")
    return history

@app.get("/api/etfs/filter/")
def filter_etfs_endpoint(
    sector: Optional[str] = None,
    min_expense_ratio: Optional[float] = Query(None, ge=0, le=1),
    max_expense_ratio: Optional[float] = Query(None, ge=0, le=1),
    min_dividend_yield: Optional[float] = Query(None, ge=0),
    max_dividend_yield: Optional[float] = Query(None, ge=0),
    min_return_1y: Optional[float] = Query(None, ge=-100),
    max_volatility: Optional[float] = Query(None, ge=0, le=1)
):
    return filter_etfs(
        sector=sector,
        min_expense_ratio=min_expense_ratio,
        max_expense_ratio=max_expense_ratio,
        min_dividend_yield=min_dividend_yield,
        max_dividend_yield=max_dividend_yield,
        min_return_1y=min_return_1y,
        max_volatility=max_volatility
    )

@app.get("/api/sectors")
def get_sectors():
    etfs = get_all_etfs()
    sectors = list(set(etf["sector"] for etf in etfs if etf["sector"]))
    return sorted(sectors)

@app.post("/api/favorites/{symbol}")
def add_favorite_endpoint(symbol: str):
    add_favorite(symbol.upper())
    return {"message": "Added to favorites", "symbol": symbol.upper()}

@app.delete("/api/favorites/{symbol}")
def remove_favorite_endpoint(symbol: str):
    remove_favorite(symbol.upper())
    return {"message": "Removed from favorites", "symbol": symbol.upper()}

@app.get("/api/favorites", response_model=List[dict])
def get_favorites_endpoint():
    return get_favorites()

@app.post("/api/refresh")
def refresh_etf_data():
    """Refresh ETF data from yfinance."""
    import time
    
    symbols = yfinance_service.get_etf_list()
    results = {"success": [], "failed": []}
    
    for i, symbol in enumerate(symbols):
        data = yfinance_service.fetch_etf_data(symbol)
        if data:
            save_etf_data(data)
            results["success"].append(symbol)
        else:
            results["failed"].append(symbol)
        time.sleep(1)
    
    return {
        "message": f"Refreshed {len(results['success'])} ETFs",
        "success": results["success"],
        "failed": results["failed"]
    }

@app.post("/api/refresh/{symbol}")
def refresh_single_etf(symbol: str):
    """Refresh a single ETF from yfinance."""
    data = yfinance_service.fetch_etf_data(symbol.upper())
    if not data:
        raise HTTPException(status_code=404, detail=f"Failed to fetch data for {symbol}")
    
    save_etf_data(data)
    return {"message": f"Refreshed {symbol}", "data": data}

@app.post("/api/simulation/monte-carlo", response_model=SimulationResponse)
def run_monte_carlo_simulation(params: SimulationParams):
    """Run Monte Carlo simulation for portfolio returns with correlation matrix."""
    # Validate inputs
    if len(params.symbols) != len(params.allocations):
        raise HTTPException(status_code=400, detail="Symbols and allocations must have same length")
    
    if abs(sum(params.allocations) - 1.0) > 0.01:
        raise HTTPException(status_code=400, detail="Allocations must sum to 1.0")
    
    # Get ETF data for each symbol
    etfs_data = {}
    for symbol in params.symbols:
        etf = get_etf_by_symbol(symbol.upper())
        if not etf:
            raise HTTPException(status_code=404, detail=f"ETF {symbol} not found")
        etfs_data[symbol.upper()] = etf
    
    # Build correlation matrix based on sectors
    # Same sector = 0.7 correlation, different sector = 0.3 correlation (default)
    n = len(params.symbols)
    
    # Get sector for each ETF
    sectors = [etfs_data[s.upper()]["sector"] for s in params.symbols]
    
    # Build correlation matrix
    correlation_matrix = np.ones((n, n))
    for i in range(n):
        for j in range(n):
            if i == j:
                correlation_matrix[i, j] = 1.0
            elif sectors[i] == sectors[j]:
                # Same sector - higher correlation
                correlation_matrix[i, j] = 0.7
            else:
                # Different sector - lower correlation
                correlation_matrix[i, j] = 0.3
    
    # Get returns and volatilities
    returns = np.array([etfs_data[s.upper()]["avg_return_1y"] / 100.0 for s in params.symbols])
    volatilities = np.array([etfs_data[s.upper()]["volatility"] for s in params.symbols])
    allocations = np.array(params.allocations)
    
    # Calculate portfolio return and volatility using correlation matrix
    # Portfolio variance = w' * Cov * w
    # Cov(i,j) = corr(i,j) * vol(i) * vol(j)
    cov_matrix = np.outer(volatilities, volatilities) * correlation_matrix
    portfolio_variance = allocations @ cov_matrix @ allocations
    portfolio_volatility = np.sqrt(portfolio_variance)
    
    # Portfolio return (weighted average)
    portfolio_return = np.sum(allocations * returns)
    
    # Run Monte Carlo simulation with correlated returns
    num_simulations = min(params.num_simulations, 10000)
    years = params.years
    initial = params.initial_investment
    
    # Use Cholesky decomposition for correlated random numbers
    try:
        L = np.linalg.cholesky(correlation_matrix)
        use_correlation = True
    except np.linalg.LinAlgError:
        # If correlation matrix is not positive definite, use uncorrelated
        use_correlation = False
    
    np.random.seed(42)
    
    results = []
    
    for year in range(1, years + 1):
        sim_values = []
        
        for _ in range(num_simulations):
            # Generate correlated random returns
            if use_correlation:
                uncorrelated = np.random.standard_normal(n)
                correlated_returns = L @ uncorrelated
                # Scale by volatility and add mean return
                random_returns = returns + correlated_returns * volatilities
                # Portfolio return
                portfolio_sim_return = np.sum(allocations * random_returns)
            else:
                # Uncorrelated approximation
                portfolio_sim_return = np.random.normal(portfolio_return, portfolio_volatility)
            
            value = initial * (1 + portfolio_sim_return) ** year
            sim_values.append(value)
        
        sim_values = np.array(sim_values)
        
        results.append(SimulationResult(
            year=year,
            percentile_10=float(np.percentile(sim_values, 10)),
            percentile_50=float(np.percentile(sim_values, 50)),
            percentile_90=float(np.percentile(sim_values, 90)),
            mean=float(np.mean(sim_values))
        ))
    
    final_values = results[-1]
    final_percentiles = {
        "p10": final_values.percentile_10,
        "p50": final_values.percentile_50,
        "p90": final_values.percentile_90,
        "mean": final_values.mean
    }
    
    return SimulationResponse(
        initial_investment=initial,
        years=years,
        num_simulations=num_simulations,
        results=results,
        final_percentiles=final_percentiles
    )

# Admin API - ETF Pool Management

@app.get("/api/admin/pool")
def get_etf_pool_endpoint():
    return get_etf_pool()

@app.get("/api/admin/pool/symbols")
def get_etf_pool_symbols_endpoint():
    return get_etf_pool_symbols()

@app.post("/api/admin/pool/{symbol}")
def add_etf_to_pool(symbol: str, name: str = None, sector: str = None):
    add_to_etf_pool(symbol.upper(), name, sector)
    return {"message": f"Added {symbol} to pool"}

@app.delete("/api/admin/pool/{symbol}")
def remove_etf_from_pool(symbol: str):
    remove_from_etf_pool(symbol.upper())
    return {"message": f"Removed {symbol} from pool"}

@app.get("/api/admin/stats")
def get_pool_stats_endpoint():
    return get_pool_stats()

@app.get("/api/admin/sync-history")
def get_sync_history_endpoint(limit: int = 10):
    return get_sync_history(limit)

@app.post("/api/admin/initialize-pool")
def initialize_pool_endpoint():
    initialize_default_etf_pool()
    return {"message": "ETF pool initialized with default ETFs"}

@app.post("/api/admin/sync")
def sync_pool_etfs():
    import time
    
    initialize_default_etf_pool()
    
    symbols = get_etf_pool_symbols()
    results = {"success": [], "failed": []}
    
    for i, symbol in enumerate(symbols):
        data = yfinance_service.fetch_etf_data(symbol)
        if data:
            save_etf_data(data)
            results["success"].append(symbol)
        else:
            results["failed"].append(symbol)
        time.sleep(1)
    
    log_sync(
        sync_type="pool_sync",
        status="completed",
        total=len(symbols),
        success=len(results["success"]),
        failed=len(results["failed"]),
        message=f"Synced {len(results['success'])} ETFs from pool"
    )
    
    return {
        "message": f"Synced {len(results['success'])} ETFs from pool",
        "total": len(symbols),
        "success": results["success"],
        "failed": results["failed"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
