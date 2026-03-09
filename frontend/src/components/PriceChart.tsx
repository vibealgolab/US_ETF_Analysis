import { useEffect, useRef } from 'react';
import { createChart, LineSeries, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';

interface PriceChartProps {
  data?: { year: number; p10: number; p50: number; p90: number }[];
  historyData?: { time: string; open: number; high: number; low: number; close: number }[];
  chartType?: 'simulation' | 'candlestick' | 'line';
  symbol?: string;
}

export function PriceChart({ data, historyData, chartType = 'simulation', symbol }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Cleanup previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart with dark theme
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: '#161b22' },
        textColor: '#c9d1d9',
      },
      grid: {
        vertLines: { color: '#30363d' },
        horzLines: { color: '#30363d' },
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#30363d',
      },
    });

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Render based on chart type
    if (chartType === 'simulation' && data && data.length > 0) {
      // Monte Carlo simulation results - area chart
      const p10Series = chart.addSeries(LineSeries, {
        color: '#f85149',
        lineWidth: 2,
        lineStyle: 2, // Dashed
      });
      
      const p50Series = chart.addSeries(LineSeries, {
        color: '#58a6ff',
        lineWidth: 2,
      });
      
      const p90Series = chart.addSeries(LineSeries, {
        color: '#3fb950',
        lineWidth: 2,
        lineStyle: 2, // Dashed
      });

      const chartDataP10 = data.map((d) => ({
        time: d.year as unknown as 'Time',
        value: d.p10,
      }));
      const chartDataP50 = data.map((d) => ({
        time: d.year as unknown as 'Time',
        value: d.p50,
      }));
      const chartDataP90 = data.map((d) => ({
        time: d.year as unknown as 'Time',
        value: d.p90,
      }));

      p10Series.setData(chartDataP10);
      p50Series.setData(chartDataP50);
      p90Series.setData(chartDataP90);

      // Add legend
      const legend = document.createElement('div');
      legend.style.cssText = 'position: absolute; top: 10px; left: 10px; color: #c9d1d9; font-size: 12px;';
      legend.innerHTML = `
        <span style="color: #f85149;">--- Pessimistic</span>
        <span style="color: #58a6ff; margin-left: 10px;">— Median</span>
        <span style="color: #3fb950; margin-left: 10px;">--- Optimistic</span>
      `;
      chartContainerRef.current.appendChild(legend);

    } else if ((chartType === 'candlestick' || chartType === 'line') && historyData && historyData.length > 0) {
      // Historical price data
      if (chartType === 'candlestick') {
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#3fb950',
          downColor: '#f85149',
          borderUpColor: '#3fb950',
          borderDownColor: '#f85149',
          wickUpColor: '#3fb950',
          wickDownColor: '#f85149',
        });

        const candleData = historyData.map((d) => ({
          time: d.time as unknown as 'Time',
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));

        candleSeries.setData(candleData);
      } else {
        const lineSeries = chart.addSeries(LineSeries, {
          color: '#58a6ff',
          lineWidth: 2,
        });

        const lineData = historyData.map((d) => ({
          time: d.time as unknown as 'Time',
          value: d.close,
        }));

        lineSeries.setData(lineData);
      }

      // Add legend with current price
      if (symbol && historyData.length > 0) {
        const latestPrice = historyData[historyData.length - 1].close;
        const legend = document.createElement('div');
        legend.style.cssText = 'position: absolute; top: 10px; left: 10px; color: #c9d1d9; font-size: 12px;';
        legend.innerHTML = `<span>${symbol}</span>: <span style="color: #58a6ff; font-weight: bold;">$${latestPrice.toFixed(2)}</span>`;
        chartContainerRef.current.appendChild(legend);
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, historyData, chartType, symbol]);

  // Guard: no data
  const hasData = (data && data.length > 0) || (historyData && historyData.length > 0);
  
  if (!hasData) {
    return (
      <div style={{
        width: '100%',
        height: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8b949e',
        background: '#161b22',
        borderRadius: '8px',
      }}>
        No chart data available
      </div>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      style={{ width: '100%', height: '300px', position: 'relative' }}
    />
  );
}
