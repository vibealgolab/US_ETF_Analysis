import { useState } from 'react';
import type { ETF, SimulationResponse } from '../hooks/useETF';
import { useETFHistory } from '../hooks/useETF';
import { PriceChart } from './PriceChart';

// Format number with thousand separators
const formatNumberWithCommas = (value: number): string => {
  return value.toLocaleString('en-US');
};

// Parse number from string (removes commas)
const parseNumberFromString = (value: string): number => {
  return Number(value.replace(/,/g, ''));
};

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  etf: ETF | null;
  onRunSimulation: (params: {
    symbols: string[];
    allocations: number[];
    initial_investment: number;
    years: number;
    num_simulations?: number;
  }) => Promise<SimulationResponse>;
  loading: boolean;
  error: string | null;
  result: SimulationResponse | null;
}

export function SimulationModal({
  isOpen,
  onClose,
  etf,
  onRunSimulation,
  loading,
  error,
  result,
}: SimulationModalProps) {
  const [investment, setInvestment] = useState(10000);
  const [years, setYears] = useState(10);
  const [simulations, setSimulations] = useState(1000);
  const [chartType, setChartType] = useState<'history' | 'simulation'>('history');

  // Fetch ETF history
  const { history, loading: historyLoading, error: historyError } = useETFHistory(
    etf?.symbol || null,
    '1y'
  );

  if (!isOpen || !etf) return null;

  const handleSimulate = async () => {
    await onRunSimulation({
      symbols: [etf.symbol],
      allocations: [1.0],
      initial_investment: investment,
      years,
      num_simulations: simulations,
    });
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
          <h2>ETF Analysis: {etf.symbol}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="selected-etf">
            <h3>{etf.name}</h3>
            <p className="etf-stats">
              Current Price: ${etf.price.toFixed(2)} |
              1Y Return: {etf.avg_return_1y.toFixed(2)}% |
              Volatility: {(etf.volatility * 100).toFixed(1)}%
            </p>
          </div>

          {/* Chart Type Toggle */}
          <div className="chart-toggle">
            <button
              className={`toggle-btn ${chartType === 'history' ? 'active' : ''}`}
              onClick={() => setChartType('history')}
            >
              📈 Price History
            </button>
            <button
              className={`toggle-btn ${chartType === 'simulation' ? 'active' : ''}`}
              onClick={() => setChartType('simulation')}
            >
              🎲 Monte Carlo
            </button>
          </div>

          {/* Charts */}
          <div className="chart-section">
            {chartType === 'history' && (
              <div className="history-chart">
                {historyLoading && <div className="loading">Loading chart...</div>}
                {historyError && <div className="error-message">{historyError}</div>}
                {history && history.length > 0 && (
                  <PriceChart
                    historyData={history}
                    chartType="line"
                    symbol={etf.symbol}
                  />
                )}
              </div>
            )}

            {chartType === 'simulation' && (
              <div className="simulation-section">
                <div className="simulation-info">
                  <h4>What is Monte Carlo Simulation?</h4>
                  <p>
                    Monte Carlo simulation is a mathematical technique used to estimate the possible outcomes of an uncertain event.
                    By running thousands of simulations based on historical volatility and returns, it provides a probabilistic
                    range of future results (Pessimistic, Median, and Optimistic scenarios).
                  </p>
                </div>

                <div className="simulation-inputs">
                  <div className="input-group">
                    <label>Initial Investment ($)</label>
                    <div className="input-container">
                      <input
                        type="text"
                        value={formatNumberWithCommas(investment)}
                        onChange={(e) => setInvestment(parseNumberFromString(e.target.value))}
                        min={100}
                      />
                      <span className="help-text">Range: $100 - $1.0M (Starting capital)</span>
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Investment Period (Years)</label>
                    <div className="input-container">
                      <input
                        type="text"
                        value={years}
                        onChange={(e) => setYears(parseNumberFromString(e.target.value))}
                        min={1}
                        max={30}
                      />
                      <span className="help-text">Range: 1 - 30 years (Investment duration)</span>
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Number of Simulations</label>
                    <div className="input-container">
                      <input
                        type="text"
                        value={formatNumberWithCommas(simulations)}
                        onChange={(e) => setSimulations(parseNumberFromString(e.target.value))}
                        min={100}
                        max={10000}
                      />
                      <span className="help-text">Range: 100 - 10,000 (Simulation count)</span>
                    </div>
                  </div>
                </div>

                <button
                  className="simulate-btn"
                  onClick={handleSimulate}
                  disabled={loading}
                >
                  {loading ? 'Running Simulation...' : 'Run Simulation'}
                </button>

                {error && <div className="error-message">{error}</div>}

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
                      data={result.results.map(r => ({
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
                        {result.results.map((r) => (
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
            )}
          </div>
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
