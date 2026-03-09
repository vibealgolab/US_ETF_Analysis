import yfinance as yf
import yahooquery as yq
import pandas as pd
import time
from datetime import datetime


def get_etf_list():
    """List of popular US ETFs."""
    popular_etfs = [
        "SPY", "VOO", "IVV", "VTI", "QQQ", 
        "IWM", "VEA", "VWO", "BND", "GLD",
        "VIG", "SCHD", "VYM", "DVY", "JEPI",
        "VGT", "XLK", "XLF", "XLE", "XLV",
        "XLI", "XLP", "XLY", "XLC", "XLU",
        "VNQ", "BNDX", "VXUS", "IJH", "VTV"
    ]
    return popular_etfs


# ETF sector mapping - since Yahoo Finance often returns N/A for ETFs
ETF_SECTOR_MAP = {
    # US Market
    "SPY": "US Large Cap",
    "VOO": "US Large Cap", 
    "IVV": "US Large Cap",
    "VTI": "US Total Market",
    "QQQ": "Technology",
    "IWM": "US Small Cap",
    
    # International
    "VEA": "International",
    "VWO": "Emerging Markets",
    "VXUS": "International",
    
    # Bonds
    "BND": "Bonds",
    "BNDX": "Bonds",
    
    # Commodities
    "GLD": "Commodities",
    
    # Dividend
    "VIG": "Dividend",
    "SCHD": "Dividend",
    "VYM": "Dividend",
    "DVY": "Dividend",
    "JEPI": "Dividend",
    "VTV": "Dividend",
    
    # Sector - Technology
    "VGT": "Technology",
    "XLK": "Technology",
    
    # Sector - Financials
    "XLF": "Financials",
    
    # Sector - Energy
    "XLE": "Energy",
    
    # Sector - Healthcare
    "XLV": "Healthcare",
    
    # Sector - Industrials
    "XLI": "Industrials",
    
    # Sector - Consumer Staples
    "XLP": "Consumer Staples",
    
    # Sector - Consumer Discretionary
    "XLY": "Consumer Discretionary",
    
    # Sector - Communications
    "XLC": "Communications",
    
    # Sector - Utilities
    "XLU": "Utilities",
    
    # Real Estate
    "VNQ": "Real Estate",
    
    # Mid Cap
    "IJH": "US Mid Cap",
}


def fetch_etf_data(ticker_symbol: str):
    """Fetch ETF data using yahooquery (different API, may bypass rate limit)."""
    
    # Get sector from mapping
    sector = ETF_SECTOR_MAP.get(ticker_symbol, "Diversified")
    
    # Try yahooquery first (different backend)
    try:
        ticker = yq.Ticker(ticker_symbol)
        
        # Get price info
        price_info = ticker.price
        
        if ticker_symbol not in price_info or not price_info[ticker_symbol]:
            pass  # No price data from yahooquery
        else:
            info = price_info[ticker_symbol]
            
            # Get historical data for calculations
            hist = ticker.history(period="1y")
            
            if hist.empty or len(hist) < 50:
                pass  # Insufficient historical data
            else:
                close_prices = hist['close'] if 'close' in hist.columns else hist.iloc[:, 0]
                
                latest_close = close_prices.iloc[-1]
                prev_close = close_prices.iloc[-2] if len(close_prices) > 1 else latest_close
                
                returns = close_prices.pct_change().dropna()
                
                if len(returns) < 20:
                    pass  # Not enough return data
                else:
                    volatility = returns.std() * (252 ** 0.5)
                    avg_return_1m = float((1 + returns.tail(21).mean()) ** 21 - 1) * 100 if len(returns) >= 21 else 0
                    avg_return_6m = float((1 + returns.tail(126).mean()) ** 126 - 1) * 100 if len(returns) >= 126 else 0
                    avg_return_1y = float((1 + returns.mean()) ** 252 - 1) * 100
                    
                    etf_data = {
                        "symbol": ticker_symbol,
                        "name": info.get('shortName', info.get('longName', ticker_symbol)),
                        "price": info.get('regularMarketPrice', latest_close) or float(latest_close),
                        "change": info.get('regularMarketChange', float(latest_close - prev_close)) or float(latest_close - prev_close),
                        "change_percent": info.get('regularMarketChangePercent', float((latest_close - prev_close) / prev_close * 100)) or float((latest_close - prev_close) / prev_close * 100),
                        "volume": info.get('regularMarketVolume', 0) or 0,
                        "market_cap": info.get('marketCap', 0) or 0,
                        "expense_ratio": 0,
                        "dividend_yield": (info.get('dividendYield', 0) or 0) * 100,
                        "fifty_two_week_high": float(close_prices.max()),
                        "fifty_two_week_low": float(close_prices.min()),
                        "sector": sector,  # Use mapped sector
                        "industry": info.get('industry', 'N/A') or 'N/A',
                        "volatility": float(volatility),
                        "avg_return_1m": avg_return_1m,
                        "avg_return_6m": avg_return_6m,
                        "avg_return_1y": avg_return_1y,
                    }
                    
                    return etf_data
                    
    except Exception as e:
        pass  # yahooquery failed
    
    # Fallback to yfinance
    try:
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(period="1y")
        
        if hist.empty or len(hist) < 50:
            return None
        
        close_prices = hist['Close'] if 'Close' in hist.columns else hist.iloc[:, 0]
        latest_close = close_prices.iloc[-1]
        prev_close = close_prices.iloc[-2] if len(close_prices) > 1 else latest_close
        
        returns = close_prices.pct_change().dropna()
        
        volatility = returns.std() * (252 ** 0.5)
        
        etf_data = {
            "symbol": ticker_symbol,
            "name": ticker_symbol,
            "price": float(latest_close),
            "change": float(latest_close - prev_close),
            "change_percent": float((latest_close - prev_close) / prev_close * 100) if prev_close != 0 else 0,
            "volume": 0,
            "market_cap": 0,
            "expense_ratio": 0,
            "dividend_yield": 0,
            "fifty_two_week_high": float(close_prices.max()),
            "fifty_two_week_low": float(close_prices.min()),
            "sector": sector,  # Use mapped sector
            "industry": "N/A",
            "volatility": float(volatility),
            "avg_return_1m": float((1 + returns.tail(21).mean()) ** 21 - 1) * 100 if len(returns) >= 21 else 0,
            "avg_return_6m": float((1 + returns.tail(126).mean()) ** 126 - 1) * 100 if len(returns) >= 126 else 0,
            "avg_return_1y": float((1 + returns.mean()) ** 252 - 1) * 100,
        }
        
        return etf_data
        
    except Exception as e:
        return None


def fetch_etf_history(ticker_symbol: str, period: str = "1y") -> list | None:
    """Fetch historical price data for charting."""
    try:
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(period=period)
        
        if hist.empty:
            return None
        
        # Convert to format suitable for charting
        result = []
        for idx, row in hist.iterrows():
            result.append({
                "time": idx.strftime("%Y-%m-%d"),
                "open": float(row.get("Open", row.get("Close", 0))),
                "high": float(row.get("High", 0)),
                "low": float(row.get("Low", 0)),
                "close": float(row.get("Close", 0)),
                "volume": int(row.get("Volume", 0))
            })
        
        return result
    except Exception as e:
        return None


def fetch_all_etfs():
    """Fetch all ETFs."""
    symbols = get_etf_list()
    etf_list = []
    
    for i, symbol in enumerate(symbols):
        data = fetch_etf_data(symbol)
        
        if data:
            etf_list.append(data)
        
        # Rate limiting
        time.sleep(1.5)
    
    return pd.DataFrame(etf_list)


if __name__ == "__main__":
    df = fetch_all_etfs()
