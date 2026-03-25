/**
 * SMC Alert Panel
 * Create and monitor SMC pattern-based alerts (Order Blocks, FVGs, BOS, ChoCH, Liquidity Sweeps).
 * Self-contained: uses its own polling loop with the getKlines API.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Plus, Trash2, X, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import styles from './SMCAlertPanel.module.css';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { getKlines } from '../../services/openalgo';
import { runFullSMCAnalysis, OHLCCandle } from '../../services/smcDetectionService';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type SMCPatternType =
  | 'new_order_block'
  | 'price_in_fvg'
  | 'bos_confirmed'
  | 'choch_confirmed'
  | 'liquidity_swept';

const PATTERN_LABELS: Record<SMCPatternType, string> = {
  new_order_block:  'New Order Block',
  price_in_fvg:     'Price in FVG',
  bos_confirmed:    'BOS Confirmed',
  choch_confirmed:  'ChoCH Confirmed',
  liquidity_swept:  'Liquidity Swept',
};

type Direction = 'bullish' | 'bearish' | 'any';

export interface SMCAlert {
  id: string;
  symbol: string;
  exchange: string;
  interval: string;
  patternType: SMCPatternType;
  direction: Direction;
  status: 'active' | 'triggered' | 'paused';
  createdAt: number;
  triggeredAt?: number;
  triggerMessage?: string;
  lastStateHash?: string;     // deduplication key
  initDone?: boolean;         // skip first check (avoid false positives on create)
}

const TIMEFRAMES = [
  { value: '1',   label: '1m'  },
  { value: '5',   label: '5m'  },
  { value: '15',  label: '15m' },
  { value: '60',  label: '1h'  },
  { value: '240', label: '4h'  },
  { value: 'D',   label: '1D'  },
];

interface SMCAlertPanelProps {
  symbol: string;
  exchange: string;
  interval: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ────────────────────────────────────────────────────────────────────────────

function loadAlerts(): SMCAlert[] {
  try {
    const s = localStorage.getItem(STORAGE_KEYS.SMC_ALERTS);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function saveAlerts(alerts: SMCAlert[]) {
  localStorage.setItem(STORAGE_KEYS.SMC_ALERTS, JSON.stringify(alerts));
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const SMCAlertPanel: React.FC<SMCAlertPanelProps> = ({ symbol, exchange, interval }) => {
  const [alerts, setAlerts]     = useState<SMCAlert[]>(loadAlerts);
  const [showForm, setShowForm] = useState(false);
  const alertsRef = useRef<SMCAlert[]>(alerts);
  alertsRef.current = alerts;

  // Form state
  const [formSymbol,    setFormSymbol]    = useState(symbol);
  const [formExchange,  setFormExchange]  = useState(exchange);
  const [formInterval,  setFormInterval]  = useState(interval || '15');
  const [formPattern,   setFormPattern]   = useState<SMCPatternType>('new_order_block');
  const [formDirection, setFormDirection] = useState<Direction>('any');

  // Sync symbol defaults when prop changes
  useEffect(() => {
    setFormSymbol(symbol);
    setFormExchange(exchange);
    setFormInterval(interval || '15');
  }, [symbol, exchange, interval]);

  const persistAlerts = useCallback((updated: SMCAlert[]) => {
    setAlerts(updated);
    saveAlerts(updated);
  }, []);

  // ── Add alert ──────────────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    const newAlert: SMCAlert = {
      id:           Date.now().toString(),
      symbol:       formSymbol.trim().toUpperCase(),
      exchange:     formExchange.trim().toUpperCase(),
      interval:     formInterval,
      patternType:  formPattern,
      direction:    formDirection,
      status:       'active',
      createdAt:    Date.now(),
      initDone:     false,
    };
    persistAlerts([newAlert, ...alertsRef.current]);
    setShowForm(false);
  }, [formSymbol, formExchange, formInterval, formPattern, formDirection, persistAlerts]);

  // ── Delete / Pause / Resume ───────────────────────────────────────────────

  const handleDelete = useCallback((id: string) => {
    persistAlerts(alertsRef.current.filter(a => a.id !== id));
  }, [persistAlerts]);

  const togglePause = useCallback((id: string) => {
    persistAlerts(alertsRef.current.map(a =>
      a.id === id ? { ...a, status: a.status === 'paused' ? 'active' : 'paused' } : a
    ));
  }, [persistAlerts]);

  const handleReactivate = useCallback((id: string) => {
    persistAlerts(alertsRef.current.map(a =>
      a.id === id ? { ...a, status: 'active', triggeredAt: undefined, triggerMessage: undefined, lastStateHash: undefined, initDone: false } : a
    ));
  }, [persistAlerts]);

  // ── Polling loop ──────────────────────────────────────────────────────────

  useEffect(() => {
    const CHECK_INTERVAL = 30_000; // 30 seconds

    const evaluate = async () => {
      const current = alertsRef.current.filter(a => a.status === 'active');
      if (current.length === 0) return;

      const updated: SMCAlert[] = [...alertsRef.current];
      let changed = false;

      for (const alert of current) {
        try {
          const raw = await getKlines(alert.symbol, alert.exchange, alert.interval, 200);
          if (!Array.isArray(raw) || raw.length < 50) continue;

          const candles: OHLCCandle[] = raw.map((c: any) => ({
            time:   c.time ?? c.timestamp,
            open:   Number(c.open),
            high:   Number(c.high),
            low:    Number(c.low),
            close:  Number(c.close),
            volume: Number(c.volume ?? 0),
          }));

          const smc = runFullSMCAnalysis(candles);
          const lastClose = candles[candles.length - 1]?.close ?? 0;

          let stateHash: string | null = null;
          let message: string | null = null;

          switch (alert.patternType) {
            case 'new_order_block': {
              const obs = smc.orderBlocks.filter(
                ob => alert.direction === 'any' || ob.type === alert.direction
              );
              if (obs.length > 0) {
                const latest = obs[obs.length - 1];
                stateHash = `${latest.startTime}:${latest.type}`;
                if (stateHash !== alert.lastStateHash && alert.initDone) {
                  message = `New ${latest.type} OB @ ${latest.low.toFixed(2)}–${latest.high.toFixed(2)}`;
                }
              }
              break;
            }
            case 'price_in_fvg': {
              const fvg = smc.fairValueGaps.find(f =>
                lastClose >= f.low && lastClose <= f.top &&
                (alert.direction === 'any' || f.type === alert.direction)
              );
              if (fvg) {
                stateHash = `${fvg.time}:${lastClose.toFixed(2)}`;
                if (stateHash !== alert.lastStateHash) {
                  message = `Price (${lastClose.toFixed(2)}) inside ${fvg.type} FVG ${fvg.low.toFixed(2)}–${fvg.top.toFixed(2)}`;
                }
              }
              break;
            }
            case 'bos_confirmed':
            case 'choch_confirmed': {
              const type = alert.patternType === 'bos_confirmed' ? 'BOS' : 'ChoCH';
              const recent = smc.structureBreaks
                .filter(sb => sb.type === type &&
                  (alert.direction === 'any' || sb.direction === alert.direction))
                .at(-1);
              if (recent) {
                stateHash = `${recent.time}:${recent.type}:${recent.direction}`;
                if (stateHash !== alert.lastStateHash && alert.initDone) {
                  message = `${type} ${recent.direction} @ ${recent.level.toFixed(2)}`;
                }
              }
              break;
            }
            case 'liquidity_swept': {
              const sweep = smc.liquiditySweeps
                .filter(s => alert.direction === 'any' ||
                  (alert.direction === 'bullish' && s.type === 'low_sweep') ||
                  (alert.direction === 'bearish' && s.type === 'high_sweep'))
                .at(-1);
              if (sweep) {
                stateHash = `${sweep.time}:${sweep.type}`;
                if (stateHash !== alert.lastStateHash && alert.initDone) {
                  const dir = sweep.type === 'high_sweep' ? 'high' : 'low';
                  message = `Liquidity ${dir} swept @ ${sweep.price.toFixed(2)} (${sweep.strength})`;
                }
              }
              break;
            }
          }

          const idx = updated.findIndex(a => a.id === alert.id);
          if (idx === -1) continue;

          if (!alert.initDone) {
            // First check: record state, don't fire
            updated[idx] = { ...updated[idx], initDone: true, lastStateHash: stateHash ?? undefined };
            changed = true;
          } else if (message && stateHash !== alert.lastStateHash) {
            // Fire!
            updated[idx] = {
              ...updated[idx],
              status: 'triggered',
              triggeredAt: Date.now(),
              triggerMessage: `${PATTERN_LABELS[alert.patternType]} on ${alert.symbol} (${alert.interval}): ${message}`,
              lastStateHash: stateHash ?? undefined,
            };
            changed = true;
          } else if (stateHash && stateHash !== alert.lastStateHash) {
            updated[idx] = { ...updated[idx], lastStateHash: stateHash };
            changed = true;
          }
        } catch { /* ignore network errors for individual alerts */ }
      }

      if (changed) {
        persistAlerts(updated);
      }
    };

    evaluate(); // immediate first check
    const id = setInterval(evaluate, CHECK_INTERVAL);
    return () => clearInterval(id);
  }, [persistAlerts]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const activeCount    = alerts.filter(a => a.status === 'active').length;
  const triggeredCount = alerts.filter(a => a.status === 'triggered').length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <Bell size={14} />
          SMC Alerts
          {triggeredCount > 0 && (
            <span className={styles.badge}>{triggeredCount}</span>
          )}
        </div>
        <button className={styles.addBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? 'Cancel' : 'New'}
        </button>
      </div>

      <div className={styles.body}>
        {/* Add Alert Form */}
        {showForm && (
          <div className={styles.formCard}>
            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label>Symbol</label>
                <input value={formSymbol} onChange={e => setFormSymbol(e.target.value)} />
              </div>
              <div className={styles.formField}>
                <label>Exchange</label>
                <input value={formExchange} onChange={e => setFormExchange(e.target.value)} />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label>Timeframe</label>
                <select value={formInterval} onChange={e => setFormInterval(e.target.value)}>
                  {TIMEFRAMES.map(tf => (
                    <option key={tf.value} value={tf.value}>{tf.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formField}>
                <label>Direction</label>
                <select value={formDirection} onChange={e => setFormDirection(e.target.value as Direction)}>
                  <option value="any">Any</option>
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                </select>
              </div>
            </div>
            <div className={styles.formField} style={{ width: '100%' }}>
              <label>Pattern</label>
              <select value={formPattern} onChange={e => setFormPattern(e.target.value as SMCPatternType)}>
                {(Object.keys(PATTERN_LABELS) as SMCPatternType[]).map(p => (
                  <option key={p} value={p}>{PATTERN_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <button className={styles.submitBtn} onClick={handleAdd}>
              Create Alert
            </button>
          </div>
        )}

        {/* Stats row */}
        {alerts.length > 0 && (
          <div className={styles.statsRow}>
            <span className={styles.statChip}>
              <Clock size={10} />
              {activeCount} Active
            </span>
            {triggeredCount > 0 && (
              <span className={`${styles.statChip} ${styles.statTriggered}`}>
                <CheckCircle size={10} />
                {triggeredCount} Triggered
              </span>
            )}
          </div>
        )}

        {/* Empty state */}
        {alerts.length === 0 && !showForm && (
          <p className={styles.emptyHint}>
            No SMC alerts. Click <strong>New</strong> to monitor an SMC pattern.
          </p>
        )}

        {/* Alert list */}
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`${styles.alertCard} ${
              alert.status === 'triggered' ? styles.alertTriggered
              : alert.status === 'paused'  ? styles.alertPaused
              : styles.alertActive
            }`}
          >
            <div className={styles.alertHeader}>
              <div className={styles.alertInfo}>
                {alert.status === 'triggered' ? <CheckCircle size={12} style={{ color: '#26a69a' }} />
                  : alert.status === 'paused' ? <AlertCircle size={12} style={{ color: '#787b86' }} />
                  : <Clock size={12} style={{ color: '#2962ff' }} />}
                <span className={styles.alertSymbol}>{alert.symbol}</span>
                <span className={styles.alertMeta}>
                  {TIMEFRAMES.find(t => t.value === alert.interval)?.label ?? alert.interval}
                </span>
              </div>
              <div className={styles.alertActions}>
                {alert.status === 'triggered' ? (
                  <button className={styles.actionBtn} onClick={() => handleReactivate(alert.id)} title="Reactivate">
                    ↺
                  </button>
                ) : (
                  <button className={styles.actionBtn} onClick={() => togglePause(alert.id)} title={alert.status === 'paused' ? 'Resume' : 'Pause'}>
                    {alert.status === 'paused' ? '▶' : '⏸'}
                  </button>
                )}
                <button className={styles.actionBtn} onClick={() => handleDelete(alert.id)} title="Delete" style={{ color: '#ef5350' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            <div className={styles.alertPattern}>
              <span className={`${styles.patternBadge} ${
                alert.direction === 'bullish' ? styles.patternBull
                : alert.direction === 'bearish' ? styles.patternBear
                : styles.patternAny
              }`}>
                {alert.direction !== 'any' ? alert.direction + ' ' : ''}{PATTERN_LABELS[alert.patternType]}
              </span>
            </div>

            {alert.triggerMessage && (
              <p className={styles.triggerMsg}>{alert.triggerMessage}</p>
            )}
            {alert.triggeredAt && (
              <p className={styles.triggerTime}>
                Triggered: {new Date(alert.triggeredAt).toLocaleString()}
              </p>
            )}
          </div>
        ))}

        <p className={styles.hint}>Checks every 30 seconds. Alerts trigger once then pause.</p>
      </div>
    </div>
  );
};

export default SMCAlertPanel;
