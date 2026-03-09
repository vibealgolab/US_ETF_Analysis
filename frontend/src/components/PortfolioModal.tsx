import { useState } from 'react';
import type { ETF } from '../hooks/useETF';
import { PriceChart } from './PriceChart';

// Format number with thousand separators
const formatNumberWithCommas = (value: number): string => {
  return value.toLocaleString('en-US');
};

// Parse number from string
const parseNumberFromString = (value: string): number => {
  return Number(value.replace(/,/g, ''));
};

interface PortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  etfs: ETF[];
}

interface PortfolioItem {
  symbol: string;
  name: string;
  allocation: number;
}

export function PortfolioModal({ isOpen, onClose, etfs }: PortfolioModalProps) {
  const [investment, setInvestment] = useState(10000);
  const [years, setYears] = useState(10);
  const [simulations, setSimulations] = useState(1000);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [showETFSelect, setShowETFSelect] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const addToPortfolio = (etf: ETF) => {
    if (portfolio.find(p => p.symbol === etf.symbol)) return;
    const newItem: PortfolioItem = {
      symbol: etf.symbol,
      name: etf.name,
      allocation: 0,
    };
    setPortfolio([...portfolio, newItem]);
    setShowETFSelect(false);
  };

  const removeFromPortfolio = (symbol: string) => {
    setPortfolio(portfolio.filter(p => p.symbol !== symbol));
  };

  const updateAllocation = (symbol: string, value: number) => {
    setPortfolio(portfolio.map(p => 
      p.symbol === symbol ? { ...p, allocation: value } : p
    ));
  };

  const totalAllocation = portfolio.reduce((sum, p) => sum + p.allocation, 0);

  const normalizeAllocations = () => {
    if (totalAllocation === 0) return;
    const factor = 100 / totalAllocation;
    setPortfolio(portfolio.map(p => ({
      ...p,
      allocation: Math.round(p.allocation * factor * 10) / 10
    })));
  };

  const handleSimulate = async () => {
    if (portfolio.length === 0) {
      setError('Please select at least one ETF');
      return;
    }
    if (Math.abs(totalAllocation - 100) > 0.1) {
      setError(`Allocations must sum to 100% (currently ${totalAllocation.toFixed(1)}%)`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/api/simulation/monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: portfolio.map(p => p.symbol),
          allocations: portfolio.map(p => p.allocation / 100),
          initial_investment: investment,
          years,
          num_simulations: simulations,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Simulation failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Portfolio Simulation</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Investment Settings */}
          <div className="simulation-inputs">
            <div className="input-group">
              <label>Initial Investment ($)</label>
              <input
                type="text"
                value={formatNumberWithCommas(investment)}
                onChange={(e) => setInvestment(parseNumberFromString(e.target.value))}
              />
            </div>
            <div className="input-group">
              <label>Years</label>
              <input
                type="number"
                value={years}
                onChange={(e) => setYears(parseNumberFromString(e.target.value))}
                min={1}
                max={30}
              />
            </div>
            <div className="input-group">
              <label>Simulations</label>
              <input
                type="number"
                value={simulations}
                onChange={(e) => setSimulations(parseNumberFromString(e.target.value))}
                min={100}
                max={10000}
              />
            </div>
          </div>

          {/* Portfolio Selection */}
          <div className="portfolio-section">
            <div className="portfolio-header">
              <h3>Portfolio Allocation</h3>
              <button 
                className="add-etf-btn"
                onClick={() => setShowETFSelect(!showETFSelect)}
              >
                + Add ETF
              </button>
            </div>

            {/* ETF Selection Dropdown */}
            {showETFSelect && (
              <div className="etf-select-dropdown">
                <div className="etf-select-list">
                  {etfs.filter(etf => !portfolio.find(p => p.symbol === etf.symbol)).map(etf => (
                    <div
                      key={etf.symbol}
                      className="etf-select-item"
                      onClick={() => addToPortfolio(etf)}
                    >
                      <span className="etf-symbol">{etf.symbol}</span>
                      <span className="etf-name">{etf.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio Items */}
            {portfolio.length === 0 ? (
              <div className="empty-portfolio">
                No ETFs selected. Click "Add ETF" to build your portfolio.
              </div>
            ) : (
              <div className="portfolio-items">
                {portfolio.map((item) => {
                  const etf = etfs.find(e => e.symbol === item.symbol);
                  return (
                    <div key={item.symbol} className="portfolio-item">
                      <div className="portfolio-item-info">
                        <span className="symbol">{item.symbol}</span>
                        <span className="name">{etf?.name || item.name}</span>
                      </div>
                      <div className="portfolio-item-allocation">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.5"
                          value={item.allocation}
                          onChange={(e) => updateAllocation(item.symbol, parseFloat(e.target.value))}
                          className="allocation-slider"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={item.allocation}
                          onChange={(e) => updateAllocation(item.symbol, parseFloat(e.target.value) || 0)}
                          className="allocation-input"
                        />
                        <span className="percent">%</span>
                        <button
                          className="remove-btn"
                          onClick={() => removeFromPortfolio(item.symbol)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sector Analysis */}
            {portfolio.length > 0 && (
              <div className="sector-analysis">
                <h3>Sector Allocation</h3>
                <div className="sector-bars">
                  {Object.entries(
                    portfolio.reduce((acc, item) => {
                      const etf = etfs.find(e => e.symbol === item.symbol);
                      const sector = etf?.sector || 'Unknown';
                      acc[sector] = (acc[sector] || 0) + item.allocation;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([sector, allocation]) => (
                    <div key={sector} className="sector-bar-container">
                      <div className="sector-bar-label">
                        <span className="sector-name">{sector}</span>
                        <span className="sector-percent">{allocation.toFixed(1)}%</span>
                      </div>
                      <div className="sector-bar-track">
                        <div 
                          className="sector-bar-fill" 
                          style={{ width: `${allocation}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Allocation Summary */}
            <div className={`allocation-summary ${totalAllocation === 100 ? 'valid' : 'invalid'}`}>
              <span>Total Allocation:</span>
              <span className={`total ${totalAllocation === 100 ? 'valid' : 'invalid'}`}>
                {totalAllocation.toFixed(1)}%
              </span>
              {totalAllocation !== 100 && (
                <button className="normalize-btn" onClick={normalizeAllocations}>
                  Auto-normalize to 100%
                </button>
              )}
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            className="simulate-btn"
            onClick={handleSimulate}
            disabled={loading || portfolio.length === 0}
          >
            {loading ? 'Running Simulation...' : 'Run Portfolio Simulation'}
          </button>

          {/* Results */}
          {result && (
            <div className="simulation-results">
              <h4>Results ({result.num_simulations} simulations)</h4>
              
              <div className="final-results">
                <div className="result-item pessimistic">
                  <span className="label">Pessimistic (10th)</span>
                  <span className="value">{formatCurrency(result.final_percentiles.p10)}</span>
                  <span className="change">
                    {((result.final_percentiles.p10 / result.initial_investment - 1) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="result-item median">
                  <span className="label">Median (50th)</span>
                  <span className="value">{formatCurrency(result.final_percentiles.p50)}</span>
                  <span className="change">
                    {((result.final_percentiles.p50 / result.initial_investment - 1) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="result-item optimistic">
                  <span className="label">Optimistic (90th)</span>
                  <span className="value">{formatCurrency(result.final_percentiles.p90)}</span>
                  <span className="change">
                    {((result.final_percentiles.p90 / result.initial_investment - 1) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <PriceChart
                data={result.results.map((r: any) => ({
                  year: r.year,
                  p10: r.percentile_10,
                  p50: r.percentile_50,
                  p90: r.percentile_90,
                }))}
              />
              
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Pessimistic</th>
                    <th>Median</th>
                    <th>Optimistic</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r: any) => (
                    <tr key={r.year}>
                      <td>{r.year}</td>
                      <td>{formatCurrency(r.percentile_10)}</td>
                      <td>{formatCurrency(r.percentile_50)}</td>
                      <td>{formatCurrency(r.percentile_90)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="disclaimer">
            For informational purposes only. This is a hypothetical simulation 
            based on historical data and does not guarantee future results.
          </p>
        </div>
      </div>
    </div>
  );
}
