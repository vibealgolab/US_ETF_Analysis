import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000/api';

export interface ETF {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  market_cap: number;
  expense_ratio: number;
  dividend_yield: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  sector: string;
  industry: string;
  volatility: number;
  avg_return_1m: number;
  avg_return_6m: number;
  avg_return_1y: number;
}

export interface ETFHistory {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function useETFs() {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  const fetchETFs = () => {
    // Fetch only ETFs from the pool (30 ETFs)
    fetch(`${API_BASE}/etfs/pool`)
      .then(res => res.json())
      .then(data => {
        setEtfs(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchETFs();
  }, []);

  const refreshData = async () => {
    setRefreshing(true);
    setRefreshProgress({ current: 0, total: 50, status: 'Starting sync...' });
    
    try {
      const response = await fetch(`${API_BASE}/admin/sync`, { method: 'POST' });
      const result = await response.json();
      
      setRefreshProgress({ 
        current: result.total || 50, 
        total: result.total || 50, 
        status: `Synced ${result.success?.length || 0} ETFs` 
      });
      
      console.log('Refresh result:', result);
      
      fetchETFs();
      
      return result;
    } catch (err: any) {
      setRefreshProgress({ current: 0, total: 50, status: 'Error: ' + err.message });
      throw err;
    } finally {
      setTimeout(() => {
        setRefreshProgress(null);
        setRefreshing(false);
      }, 2000);
    }
  };

  return { 
    etfs, 
    loading, 
    error, 
    refreshData, 
    refreshing, 
    refreshProgress,
    refetch: fetchETFs 
  };
}

export function useSectors() {
  const [sectors, setSectors] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/sectors`)
      .then(res => res.json())
      .then(data => setSectors(data));
  }, []);

  return sectors;
}

export function useFilterETFs(filters: {
  sector?: string;
  min_expense_ratio?: number;
  max_expense_ratio?: number;
  min_dividend_yield?: number;
  max_dividend_yield?: number;
  min_return_1y?: number;
  max_volatility?: number;
}) {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.sector) params.append('sector', filters.sector);
    if (filters.min_expense_ratio) params.append('min_expense_ratio', filters.min_expense_ratio.toString());
    if (filters.max_expense_ratio) params.append('max_expense_ratio', filters.max_expense_ratio.toString());
    if (filters.min_dividend_yield) params.append('min_dividend_yield', filters.min_dividend_yield.toString());
    if (filters.max_dividend_yield) params.append('max_dividend_yield', filters.max_dividend_yield.toString());
    if (filters.min_return_1y) params.append('min_return_1y', filters.min_return_1y.toString());
    if (filters.max_volatility) params.append('max_volatility', filters.max_volatility.toString());

    fetch(`${API_BASE}/etfs/filter/?${params}`)
      .then(res => res.json())
      .then(data => {
        setEtfs(data);
        setLoading(false);
      });
  }, [filters]);

  return { etfs, loading };
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<ETF[]>([]);

  const addFavorite = async (symbol: string) => {
    await fetch(`${API_BASE}/favorites/${symbol}`, { method: 'POST' });
    refresh();
  };

  const removeFavorite = async (symbol: string) => {
    await fetch(`${API_BASE}/favorites/${symbol}`, { method: 'DELETE' });
    refresh();
  };

  const refresh = () => {
    fetch(`${API_BASE}/favorites`)
      .then(res => res.json())
      .then(data => setFavorites(data));
  };

  useEffect(() => {
    refresh();
  }, []);

  return { favorites, addFavorite, removeFavorite, refresh };
}

export function useETFHistory(symbol: string | null, period: string = '1y') {
  const [history, setHistory] = useState<ETFHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    
    setLoading(true);
    setError(null);
    
    fetch(`${API_BASE}/etfs/${symbol}/history?period=${period}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
      })
      .then(data => {
        setHistory(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [symbol, period]);

  return { history, loading, error };
}

export interface SimulationParams {
  symbols: string[];
  allocations: number[];
  initial_investment: number;
  years: number;
  num_simulations?: number;
}

export interface SimulationResult {
  year: number;
  percentile_10: number;
  percentile_50: number;
  percentile_90: number;
  mean: number;
}

export interface SimulationResponse {
  initial_investment: number;
  years: number;
  num_simulations: number;
  results: SimulationResult[];
  final_percentiles: {
    p10: number;
    p50: number;
    p90: number;
    mean: number;
  };
}

export function useSimulation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResponse | null>(null);

  const runSimulation = async (params: SimulationParams) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`http://localhost:8000/api/simulation/monte-carlo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Simulation failed');
      }

      const data = await response.json();
      setResult(data);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { runSimulation, loading, error, result };
}
