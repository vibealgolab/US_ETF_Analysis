import { useState, useMemo } from 'react';
import { useETFs, useSectors, useFavorites, useSimulation, useFilterETFs } from './hooks/useETF';
import type { ETF } from './hooks/useETF';
import { SimulationModal } from './components/SimulationModal';
import { PortfolioModal } from './components/PortfolioModal';
import './App.css';

function App() {
  const { etfs, loading, error, refreshData, refreshing, refreshProgress } = useETFs();
  const sectors = useSectors();
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const { runSimulation, loading: simLoading, error: simError, result: simResult } = useSimulation();

  const [selectedSector, setSelectedSector] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('symbol');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [selectedETF, setSelectedETF] = useState<ETF | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(true);

  // Manage theme on body for full-page background
  useState(() => {
    // Initial theme
    document.body.className = 'dark';
  });

  useMemo(() => {
    document.body.className = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minExpenseRatio: '',
    maxExpenseRatio: '',
    minDividendYield: '',
    maxDividendYield: '',
    minReturn1Y: '',
    maxVolatility: '',
  });

  // Apply filters using the API
  const filterParams = {
    sector: selectedSector || undefined,
    min_expense_ratio: filters.minExpenseRatio ? parseFloat(filters.minExpenseRatio) / 100 : undefined,
    max_expense_ratio: filters.maxExpenseRatio ? parseFloat(filters.maxExpenseRatio) / 100 : undefined,
    min_dividend_yield: filters.minDividendYield ? parseFloat(filters.minDividendYield) : undefined,
    max_dividend_yield: filters.maxDividendYield ? parseFloat(filters.maxDividendYield) : undefined,
    min_return_1y: filters.minReturn1Y ? parseFloat(filters.minReturn1Y) : undefined,
    max_volatility: filters.maxVolatility ? parseFloat(filters.maxVolatility) / 100 : undefined,
  };

  const { etfs: filteredETFs, loading: filterLoading } = useFilterETFs(filterParams);

  // Use filtered results if any filter is active
  const displayETFs = showFavorites
    ? favorites
    : (Object.values(filterParams).some(v => v !== undefined) ? filteredETFs : etfs);

  const sortedETFs = [...displayETFs].sort((a, b) => {
    if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol);
    if (sortBy === 'price') return b.price - a.price;
    if (sortBy === 'change_percent') return b.change_percent - a.change_percent;
    if (sortBy === 'dividend_yield') return b.dividend_yield - a.dividend_yield;
    if (sortBy === 'expense_ratio') return a.expense_ratio - b.expense_ratio;
    if (sortBy === 'return_1y') return b.avg_return_1y - a.avg_return_1y;
    if (sortBy === 'volatility') return a.volatility - b.volatility;
    return 0;
  });

  const isFavorite = (symbol: string) => favorites.some(f => f.symbol === symbol);

  const toggleFavorite = (etf: ETF) => {
    if (isFavorite(etf.symbol)) {
      removeFavorite(etf.symbol);
    } else {
      addFavorite(etf.symbol);
    }
  };

  const openSimulation = (etf: ETF) => {
    setSelectedETF(etf);
    setShowModal(true);
  };

  const closeSimulation = () => {
    setShowModal(false);
    setSelectedETF(null);
  };

  const clearFilters = () => {
    setFilters({
      minExpenseRatio: '',
      maxExpenseRatio: '',
      minDividendYield: '',
      maxDividendYield: '',
      minReturn1Y: '',
      maxVolatility: '',
    });
    setSelectedSector('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '') || selectedSector !== '';

  // Search filter - apply on client side
  const searchedETFs = useMemo(() => {
    if (!searchQuery.trim()) return sortedETFs;
    const query = searchQuery.toLowerCase();
    return sortedETFs.filter(etf =>
      etf.symbol.toLowerCase().includes(query) ||
      etf.name.toLowerCase().includes(query)
    );
  }, [sortedETFs, searchQuery]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <header className="header">
        <div className="header-top-bar">
          <div className="header-brand">
            <h1>US ETF Analysis Tool</h1>
            <div className="pool-info">
              <div className="pool-label">Analysis Pool</div>
              <span className="pool-badge" title="Number of ETFs currently being analyzed">{etfs.length} Symbols</span>
              <div className="pool-details">
                <span className="details-label">Selection Criteria:</span>
                <span className="pool-criteria">High Volume • Low Expense • Sector Diversity</span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="refresh-btn"
              onClick={() => refreshData()}
              disabled={refreshing}
            >
              {refreshing
                ? (refreshProgress ? `↻ ${refreshProgress.status}` : '↻ Refreshing...')
                : '↻ Refresh Data'}
            </button>
            <button
              className="theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <nav className="nav-tabs">
          <button
            className={`tab-btn ${!showFavorites ? 'active' : ''}`}
            onClick={() => setShowFavorites(false)}
          >
            📋 All ETFs
          </button>
          <button
            className={`tab-btn ${showFavorites ? 'active' : ''}`}
            onClick={() => setShowFavorites(true)}
          >
            ★ Favorites ({favorites.length})
          </button>
          <div className="nav-spacer"></div>
          <button
            className="tab-btn portfolio-nav-btn"
            onClick={() => setShowPortfolioModal(true)}
          >
            💼 My Portfolio
          </button>
        </nav>
      </header>

      <div className="filter-bar">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search symbols or names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filter-group">
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
          >
            <option value="">All Sectors</option>
            {sectors.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="symbol">Sort by Symbol</option>
            <option value="price">Price (High-Low)</option>
            <option value="change_percent">Performance</option>
            <option value="dividend_yield">Yield</option>
            <option value="expense_ratio">Expense Ratio</option>
            <option value="return_1y">1Y Return</option>
            <option value="volatility">Volatility</option>
          </select>
        </div>

        <div className="action-group">
          <button
            className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            ⚙️ Advanced Filters {hasActiveFilters && <span className="filter-badge">●</span>}
          </button>

          {hasActiveFilters && (
            <button className="clear-filters-btn" onClick={clearFilters} title="Clear all filters">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="advanced-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label>Expense Ratio (%):</label>
              <div className="range-inputs">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minExpenseRatio}
                  onChange={(e) => setFilters({ ...filters, minExpenseRatio: e.target.value })}
                  min="0"
                  max="100"
                  step="0.01"
                />
                <span>to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxExpenseRatio}
                  onChange={(e) => setFilters({ ...filters, maxExpenseRatio: e.target.value })}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Dividend Yield (%):</label>
              <div className="range-inputs">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minDividendYield}
                  onChange={(e) => setFilters({ ...filters, minDividendYield: e.target.value })}
                  min="0"
                  max="100"
                  step="0.1"
                />
                <span>to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxDividendYield}
                  onChange={(e) => setFilters({ ...filters, maxDividendYield: e.target.value })}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>

            <div className="filter-group">
              <label>1Y Return (%):</label>
              <div className="range-inputs">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minReturn1Y}
                  onChange={(e) => setFilters({ ...filters, minReturn1Y: e.target.value })}
                  min="-100"
                  max="100"
                  step="0.1"
                />
                <span>to</span>
                <span className="static-value">∞</span>
              </div>
            </div>

            <div className="filter-group">
              <label>Volatility (%):</label>
              <div className="range-inputs">
                <span className="static-value">0</span>
                <span>to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxVolatility}
                  onChange={(e) => setFilters({ ...filters, maxVolatility: e.target.value })}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          {filterLoading && <div className="filter-loading">Applying filters...</div>}
          <div className="filter-results-count">
            Showing {searchedETFs.length} of {etfs.length} ETFs
          </div>
        </div>
      )}

      <div className="etf-grid">
        {searchedETFs.map((etf, index) => (
          <div key={etf.symbol} className="etf-card">
            <div className="etf-header">
              <span className="etf-rank">#{index + 1}</span>
              <span className="etf-symbol">{etf.symbol}</span>
              <button
                className={`favorite-btn ${isFavorite(etf.symbol) ? 'active' : ''}`}
                onClick={() => toggleFavorite(etf)}
              >
                {isFavorite(etf.symbol) ? '★' : '☆'}
              </button>
            </div>
            <div className="etf-name">{etf.name}</div>
            <div className="etf-price">
              ${etf.price.toFixed(2)}
              <span className={etf.change >= 0 ? 'positive' : 'negative'}>
                {etf.change >= 0 ? '+' : ''}{etf.change.toFixed(2)} ({etf.change_percent.toFixed(2)}%)
              </span>
            </div>
            <div className="etf-details">
              <div className="detail">
                <span className="label">Sector:</span>
                <span className="value">{etf.sector}</span>
              </div>
              <div className="detail">
                <span className="label">Expense Ratio:</span>
                <span className="value">{etf.expense_ratio.toFixed(2)}%</span>
              </div>
              <div className="detail">
                <span className="label">Dividend Yield:</span>
                <span className="value">{etf.dividend_yield.toFixed(2)}%</span>
              </div>
              <div className="detail">
                <span className="label">1Y Return:</span>
                <span className={etf.avg_return_1y >= 0 ? 'positive' : 'negative'}>
                  {etf.avg_return_1y >= 0 ? '+' : ''}{etf.avg_return_1y.toFixed(2)}%
                </span>
              </div>
              <div className="detail">
                <span className="label">Volatility:</span>
                <span className="value">{(etf.volatility * 100).toFixed(1)}%</span>
              </div>
              <button
                className="simulate-btn-card"
                onClick={() => openSimulation(etf)}
              >
                📊 Simulate
              </button>
            </div>
          </div>
        ))}
      </div>

      <footer className="footer">
        <p>
          Past performance does not guarantee future results.
          Hypothetical or simulated performance results have certain limitations.
        </p>
      </footer>

      <SimulationModal
        isOpen={showModal}
        onClose={closeSimulation}
        etf={selectedETF}
        onRunSimulation={runSimulation}
        loading={simLoading}
        error={simError}
        result={simResult}
      />

      <PortfolioModal
        isOpen={showPortfolioModal}
        onClose={() => setShowPortfolioModal(false)}
        etfs={etfs}
      />
    </div>
  );
}

export default App;
