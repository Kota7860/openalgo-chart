/**
 * MTF Bias Panel
 * Shows SMC trend bias across multiple timeframes for the current symbol.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layers2, RefreshCw, AlertTriangle } from 'lucide-react';
import styles from './MTFBiasPanel.module.css';
import { getKlines } from '../../services/openalgo';
import { runFullSMCAnalysis } from '../../services/smcDetectionService';

interface MTFBiasPanelProps {
  symbol: string;
  exchange: string;
}

interface TimeframeBias {
  interval: string;
  label: string;
  trend: 'bullish' | 'bearish' | 'ranging' | 'loading' | 'error';
  lastBOS: string;
  bosCount: number;
}

const TIMEFRAMES = [
  { interval: '1',   label: '1m'  },
  { interval: '5',   label: '5m'  },
  { interval: '15',  label: '15m' },
  { interval: '60',  label: '1h'  },
  { interval: '240', label: '4h'  },
  { interval: 'D',   label: '1D'  },
];

const MTFBiasPanel: React.FC<MTFBiasPanelProps> = ({ symbol, exchange }) => {
  const [rows, setRows]       = useState<TimeframeBias[]>(
    TIMEFRAMES.map(tf => ({ interval: tf.interval, label: tf.label, trend: 'loading', lastBOS: '—', bosCount: 0 }))
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Reset to loading state
    setRows(TIMEFRAMES.map(tf => ({ interval: tf.interval, label: tf.label, trend: 'loading', lastBOS: '—', bosCount: 0 })));

    const results = await Promise.allSettled(
      TIMEFRAMES.map(async (tf) => {
        const data = await getKlines(symbol, exchange, tf.interval, 200, controller.signal);
        if (!Array.isArray(data) || data.length < 50) {
          return { interval: tf.interval, label: tf.label, trend: 'ranging' as const, lastBOS: '—', bosCount: 0 };
        }
        const candles = data.map((c: any) => ({
          time:   c.time ?? c.timestamp,
          open:   Number(c.open),
          high:   Number(c.high),
          low:    Number(c.low),
          close:  Number(c.close),
          volume: Number(c.volume ?? 0),
        }));
        const smc = runFullSMCAnalysis(candles);
        const recentBOS = smc.structureBreaks.slice(-1)[0];
        const lastBOSStr = recentBOS
          ? `${recentBOS.type} ${recentBOS.direction === 'bullish' ? '▲' : '▼'}`
          : '—';
        return {
          interval: tf.interval,
          label: tf.label,
          trend: smc.currentTrend,
          lastBOS: lastBOSStr,
          bosCount: smc.structureBreaks.length,
        };
      })
    );

    if (controller.signal.aborted) return;

    const updated: TimeframeBias[] = results.map((res, i) => {
      const tf = TIMEFRAMES[i];
      if (res.status === 'fulfilled') return res.value as TimeframeBias;
      return { interval: tf.interval, label: tf.label, trend: 'error' as const, lastBOS: '—', bosCount: 0 };
    });

    setRows(updated);
    setLastUpdated(new Date().toLocaleTimeString());
    setIsLoading(false);
  }, [symbol, exchange, isLoading]);

  // Auto-fetch when symbol/exchange changes
  useEffect(() => {
    fetchAll();
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, exchange]);

  const bullishCount = rows.filter(r => r.trend === 'bullish').length;
  const bearishCount = rows.filter(r => r.trend === 'bearish').length;
  const overallBias  = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'ranging';

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <Layers2 size={14} />
          MTF Bias — {symbol}
        </div>
        <div className={styles.headerControls}>
          {lastUpdated && (
            <span className={styles.timestamp}>{lastUpdated}</span>
          )}
          <button
            className={styles.refreshBtn}
            onClick={fetchAll}
            disabled={isLoading}
            title="Refresh all timeframes"
          >
            <RefreshCw size={12} className={isLoading ? styles.spinning : ''} />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* Overall bias summary */}
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Overall Bias</span>
          <span className={`${styles.biasPill} ${
            overallBias === 'bullish' ? styles.biasBull
            : overallBias === 'bearish' ? styles.biasBear
            : styles.biasRange
          }`}>
            {overallBias.toUpperCase()}
          </span>
          <span className={styles.summaryCount}>
            {bullishCount}↑ / {bearishCount}↓
          </span>
        </div>

        {/* Timeframe grid */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>TF</th>
              <th>Trend</th>
              <th>Last BOS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.interval}>
                <td className={styles.tfCell}>{row.label}</td>
                <td>
                  {row.trend === 'loading' ? (
                    <span className={styles.loadingDot} />
                  ) : row.trend === 'error' ? (
                    <span className={styles.errorBadge}><AlertTriangle size={10} /></span>
                  ) : (
                    <span className={`${styles.trendBadge} ${
                      row.trend === 'bullish' ? styles.trendBull
                      : row.trend === 'bearish' ? styles.trendBear
                      : styles.trendRange
                    }`}>
                      {row.trend === 'bullish' ? '▲ Bull' : row.trend === 'bearish' ? '▼ Bear' : '— Range'}
                    </span>
                  )}
                </td>
                <td className={styles.bosCell}>{row.lastBOS}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className={styles.hint}>
          Based on SMC structure breaks across last 200 candles per timeframe.
        </p>
      </div>
    </div>
  );
};

export default MTFBiasPanel;
