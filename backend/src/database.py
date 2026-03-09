import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "data" / "etf_analysis.db"

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Main ETF data table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS etf_data (
            symbol TEXT PRIMARY KEY,
            name TEXT,
            price REAL,
            change REAL,
            change_percent REAL,
            volume INTEGER,
            market_cap INTEGER,
            expense_ratio REAL,
            dividend_yield REAL,
            fifty_two_week_high REAL,
            fifty_two_week_low REAL,
            sector TEXT,
            industry TEXT,
            volatility REAL,
            avg_return_1m REAL,
            avg_return_6m REAL,
            avg_return_1y REAL,
            updated_at TEXT
        )
    """)
    
    # ETF Pool - managed list of ETFs to track
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS etf_pool (
            symbol TEXT PRIMARY KEY,
            name TEXT,
            sector TEXT,
            added_at TEXT,
            added_by TEXT DEFAULT 'system',
            is_active INTEGER DEFAULT 1
        )
    """)
    
    # Favorites table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            symbol TEXT PRIMARY KEY,
            added_at TEXT
        )
    """)
    
    # Sync log
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sync_type TEXT,
            status TEXT,
            total_etfs INTEGER,
            success_count INTEGER,
            failed_count INTEGER,
            message TEXT,
            created_at TEXT
        )
    """)
    
    conn.commit()
    conn.close()


def load_mock_data_to_db():
    from services.mock_data import etf_data
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    for etf in etf_data:
        etf["updated_at"] = datetime.now().isoformat()
        cursor.execute("""
            INSERT OR REPLACE INTO etf_data 
            (symbol, name, price, change, change_percent, volume, market_cap,
             expense_ratio, dividend_yield, fifty_two_week_high, fifty_two_week_low,
             sector, industry, volatility, avg_return_1m, avg_return_6m, avg_return_1y, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, tuple(etf.values()))
    
    conn.commit()
    conn.close()


def save_etf_data(etf_data: dict):
    """Save ETF data from yfinance to database."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    etf_data["updated_at"] = datetime.now().isoformat()
    cursor.execute("""
        INSERT OR REPLACE INTO etf_data 
        (symbol, name, price, change, change_percent, volume, market_cap,
         expense_ratio, dividend_yield, fifty_two_week_high, fifty_two_week_low,
         sector, industry, volatility, avg_return_1m, avg_return_6m, avg_return_1y, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        etf_data.get("symbol"),
        etf_data.get("name"),
        etf_data.get("price", 0),
        etf_data.get("change", 0),
        etf_data.get("change_percent", 0),
        etf_data.get("volume", 0),
        etf_data.get("market_cap", 0),
        etf_data.get("expense_ratio", 0),
        etf_data.get("dividend_yield", 0),
        etf_data.get("fifty_two_week_high", 0),
        etf_data.get("fifty_two_week_low", 0),
        etf_data.get("sector", "N/A"),
        etf_data.get("industry", "N/A"),
        etf_data.get("volatility", 0),
        etf_data.get("avg_return_1m", 0),
        etf_data.get("avg_return_6m", 0),
        etf_data.get("avg_return_1y", 0),
        etf_data.get("updated_at")
    ))
    
    conn.commit()
    conn.close()


def get_all_etfs():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM etf_data ORDER BY symbol")
    rows = cursor.fetchall()
    
    result = [dict(row) for row in rows]
    conn.close()
    return result


def get_etf_by_symbol(symbol: str):
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM etf_data WHERE symbol = ?", (symbol,))
    row = cursor.fetchone()
    
    result = dict(row) if row else None
    conn.close()
    return result


def filter_etfs(
    sector: str = None,
    min_expense_ratio: float = None,
    max_expense_ratio: float = None,
    min_dividend_yield: float = None,
    max_dividend_yield: float = None,
    min_return_1y: float = None,
    max_volatility: float = None
):
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = "SELECT * FROM etf_data WHERE 1=1"
    params = []
    
    if sector:
        query += " AND sector = ?"
        params.append(sector)
    if min_expense_ratio is not None:
        query += " AND expense_ratio >= ?"
        params.append(min_expense_ratio)
    if max_expense_ratio is not None:
        query += " AND expense_ratio <= ?"
        params.append(max_expense_ratio)
    if min_dividend_yield is not None:
        query += " AND dividend_yield >= ?"
        params.append(min_dividend_yield)
    if max_dividend_yield is not None:
        query += " AND dividend_yield <= ?"
        params.append(max_dividend_yield)
    if min_return_1y is not None:
        query += " AND avg_return_1y >= ?"
        params.append(min_return_1y)
    if max_volatility is not None:
        query += " AND volatility <= ?"
        params.append(max_volatility)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    result = [dict(row) for row in rows]
    conn.close()
    return result


def add_favorite(symbol: str):
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("INSERT OR IGNORE INTO favorites (symbol, added_at) VALUES (?, ?)",
                   (symbol, datetime.now().isoformat()))
    conn.commit()
    conn.close()


def remove_favorite(symbol: str):
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM favorites WHERE symbol = ?", (symbol,))
    conn.commit()
    conn.close()


def get_favorites():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT e.* FROM etf_data e
        INNER JOIN favorites f ON e.symbol = f.symbol
        ORDER BY f.added_at DESC
    """)
    rows = cursor.fetchall()
    
    result = [dict(row) for row in rows]
    conn.close()
    return result


# ============================================
# ETF Pool Management Functions
# ============================================

def get_etf_pool():
    """Get all ETFs in the pool."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM etf_pool WHERE is_active = 1 ORDER BY symbol")
    rows = cursor.fetchall()
    
    result = [dict(row) for row in rows]
    conn.close()
    return result


def add_to_etf_pool(symbol: str, name: str = None, sector: str = None, added_by: str = "user"):
    """Add ETF to the pool."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT OR REPLACE INTO etf_pool (symbol, name, sector, added_at, added_by, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
    """, (symbol.upper(), name or symbol.upper(), sector or "Unknown", 
           datetime.now().isoformat(), added_by))
    
    conn.commit()
    conn.close()


def remove_from_etf_pool(symbol: str):
    """Remove ETF from the pool (soft delete)."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("UPDATE etf_pool SET is_active = 0 WHERE symbol = ?", (symbol.upper(),))
    
    conn.commit()
    conn.close()


def is_in_etf_pool(symbol: str) -> bool:
    """Check if ETF is in the pool."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("SELECT 1 FROM etf_pool WHERE symbol = ? AND is_active = 1", (symbol.upper(),))
    result = cursor.fetchone() is not None
    
    conn.close()
    return result


def get_etf_pool_symbols():
    """Get list of symbols in the pool."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("SELECT symbol FROM etf_pool WHERE is_active = 1 ORDER BY symbol")
    rows = cursor.fetchall()
    
    result = [row[0] for row in rows]
    conn.close()
    return result


def initialize_default_etf_pool():
    """Initialize pool with default popular ETFs (30 ETFs)."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Add default popular ETFs (30 ETFs) - representative from each sector
    default_etfs = [
        # US Large Cap (3)
        ("SPY", "SPDR S&P 500 ETF Trust", "US Large Cap"),
        ("VOO", "Vanguard S&P 500 ETF", "US Large Cap"),
        ("VTI", "Vanguard Total Stock Market ETF", "US Total Market"),
        
        # Growth / Value (2)
        ("VUG", "Vanguard Growth ETF", "US Growth"),
        ("VTV", "Vanguard Value ETF", "US Value"),
        
        # Technology (3)
        ("QQQ", "Invesco QQQ Trust", "Technology"),
        ("VGT", "Vanguard Information Technology ETF", "Technology"),
        ("XLK", "Technology Select Sector SPDR Fund", "Technology"),
        
        # International (3)
        ("VEA", "Vanguard FTSE Developed Markets ETF", "International"),
        ("VWO", "Vanguard FTSE Emerging Markets ETF", "Emerging Markets"),
        ("VXUS", "Vanguard Total International Stock ETF", "International"),
        
        # Bonds (4)
        ("BND", "Vanguard Total Bond Market ETF", "Bonds"),
        ("AGG", "iShares Core US Aggregate Bond ETF", "Bonds"),
        ("TLT", "iShares 20+ Year Treasury Bond ETF", "Bonds"),
        ("SHY", "iShares 1-3 Year Treasury Bond ETF", "Bonds"),
        
        # Dividend (4)
        ("VIG", "Vanguard Dividend Appreciation ETF", "Dividend"),
        ("SCHD", "Schwab US Dividend Equity ETF", "Dividend"),
        ("VYM", "Vanguard High Dividend Yield ETF", "Dividend"),
        ("JEPI", "JPMorgan Equity Premium Income ETF", "Dividend"),
        
        # Sector ETFs (11)
        ("XLF", "Financial Select Sector SPDR Fund", "Financials"),
        ("XLE", "Energy Select Sector SPDR Fund", "Energy"),
        ("XLV", "Health Care Select Sector SPDR Fund", "Healthcare"),
        ("XLI", "Industrial Select Sector SPDR Fund", "Industrials"),
        ("XLP", "Consumer Staples Select Sector SPDR Fund", "Consumer Staples"),
        ("XLY", "Consumer Discretionary Select Sector SPDR Fund", "Consumer Discretionary"),
        ("XLC", "Communication Services Select Sector SPDR Fund", "Communications"),
        ("XLU", "Utilities Select Sector SPDR Fund", "Utilities"),
        ("XLB", "Materials Select Sector SPDR Fund", "Materials"),
        ("VNQ", "Vanguard Real Estate ETF", "Real Estate"),
        ("IWM", "iShares Russell 2000 ETF", "US Small Cap"),
    ]
    
    for symbol, name, sector in default_etfs:
        cursor.execute("""
            INSERT OR IGNORE INTO etf_pool (symbol, name, sector, added_at, added_by, is_active)
            VALUES (?, ?, ?, ?, 'system', 1)
        """, (symbol, name, sector, datetime.now().isoformat()))
    
    conn.commit()
    conn.close()


def log_sync(sync_type: str, status: str, total: int, success: int, failed: int, message: str):
    """Log sync operation."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO sync_log (sync_type, status, total_etfs, success_count, failed_count, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (sync_type, status, total, success, failed, message, datetime.now().isoformat()))
    
    conn.commit()
    conn.close()


def get_sync_history(limit: int = 10):
    """Get recent sync history."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM sync_log ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    
    result = [dict(row) for row in rows]
    conn.close()
    return result


def get_pool_stats():
    """Get ETF pool statistics."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM etf_pool WHERE is_active = 1")
    pool_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM etf_data")
    data_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(DISTINCT sector) FROM etf_data WHERE sector IS NOT NULL")
    sector_count = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        "pool_count": pool_count,
        "data_count": data_count,
        "sector_count": sector_count
    }


if __name__ == "__main__":
    init_db()
    load_mock_data_to_db()
