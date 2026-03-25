/**
 * Trade Journal Panel
 * Local trade journal stored in localStorage with P&L tracking.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Trash2, Download, X } from 'lucide-react';
import styles from './TradeJournalPanel.module.css';

interface TradeJournalPanelProps {
  symbol: string;
  exchange: string;
}

interface TradeEntry {
  id: string;
  date: string;
  symbol: string;
  exchange: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  qty: number;
  notes: string;
  pnl: number;
  pnlPct: number;
  rr: number | null;
}

const STORAGE_KEY = 'tv_trade_journal';

function computeRR(entry: number, exit: number, stop: number | null, direction: 'long' | 'short'): number | null {
  if (stop === null) return null;
  const risk   = Math.abs(entry - stop);
  const reward = direction === 'long' ? exit - entry : entry - exit;
  if (risk === 0) return null;
  return parseFloat((reward / risk).toFixed(2));
}

const TradeJournalPanel: React.FC<TradeJournalPanelProps> = ({ symbol, exchange }) => {
  const [trades, setTrades]       = useState<TradeEntry[]>([]);
  const [showForm, setShowForm]   = useState(false);

  // Form state
  const [formSymbol,    setFormSymbol]    = useState(symbol);
  const [formExchange,  setFormExchange]  = useState(exchange);
  const [formDir,       setFormDir]       = useState<'long' | 'short'>('long');
  const [formEntry,     setFormEntry]     = useState('');
  const [formExit,      setFormExit]      = useState('');
  const [formStop,      setFormStop]      = useState('');
  const [formQty,       setFormQty]       = useState('');
  const [formNotes,     setFormNotes]     = useState('');
  const [formDate,      setFormDate]      = useState(() => new Date().toISOString().slice(0, 10));

  // Load trades from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTrades(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Sync symbol when prop changes
  useEffect(() => { setFormSymbol(symbol); setFormExchange(exchange); }, [symbol, exchange]);

  const saveTrades = useCallback((updated: TradeEntry[]) => {
    setTrades(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const handleAddTrade = useCallback(() => {
    const entry = parseFloat(formEntry);
    const exit  = parseFloat(formExit);
    const qty   = parseFloat(formQty);
    const stop  = formStop ? parseFloat(formStop) : null;

    if (isNaN(entry) || isNaN(exit) || isNaN(qty) || qty <= 0) return;

    const rawPnl    = formDir === 'long' ? (exit - entry) * qty : (entry - exit) * qty;
    const pnlPct    = ((exit - entry) / entry) * 100 * (formDir === 'short' ? -1 : 1);
    const rr        = computeRR(entry, exit, stop, formDir);

    const newTrade: TradeEntry = {
      id:       Date.now().toString(),
      date:     formDate,
      symbol:   formSymbol.trim().toUpperCase(),
      exchange: formExchange.trim().toUpperCase(),
      direction: formDir,
      entryPrice: entry,
      exitPrice: exit,
      qty,
      notes:    formNotes.trim(),
      pnl:      parseFloat(rawPnl.toFixed(2)),
      pnlPct:   parseFloat(pnlPct.toFixed(2)),
      rr,
    };

    saveTrades([newTrade, ...trades]);
    setShowForm(false);
    // Reset form
    setFormEntry(''); setFormExit(''); setFormStop(''); setFormQty(''); setFormNotes('');
  }, [formEntry, formExit, formQty, formStop, formDir, formSymbol, formExchange, formDate, formNotes, trades, saveTrades]);

  const handleDelete = useCallback((id: string) => {
    saveTrades(trades.filter(t => t.id !== id));
  }, [trades, saveTrades]);

  const handleExportCSV = useCallback(() => {
    const headers = ['Date', 'Symbol', 'Exchange', 'Direction', 'Entry', 'Exit', 'Qty', 'P&L', 'P&L%', 'R:R', 'Notes'];
    const rows = trades.map(t => [
      t.date, t.symbol, t.exchange, t.direction,
      t.entryPrice, t.exitPrice, t.qty, t.pnl, t.pnlPct,
      t.rr ?? '', t.notes.replace(/,/g, ';'),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade_journal_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [trades]);

  // Stats
  const totalPnl  = trades.reduce((s, t) => s + t.pnl, 0);
  const wins      = trades.filter(t => t.pnl > 0).length;
  const winRate   = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(0) : '—';
  const avgRR     = trades.filter(t => t.rr !== null).length > 0
    ? (trades.filter(t => t.rr !== null).reduce((s, t) => s + (t.rr ?? 0), 0) /
       trades.filter(t => t.rr !== null).length).toFixed(2)
    : '—';

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <BookOpen size={14} />
          Trade Journal
        </div>
        <div className={styles.headerControls}>
          {trades.length > 0 && (
            <button className={styles.iconBtn} onClick={handleExportCSV} title="Export CSV">
              <Download size={13} />
            </button>
          )}
          <button className={styles.addBtn} onClick={() => setShowForm(v => !v)}>
            {showForm ? <X size={12} /> : <Plus size={12} />}
            {showForm ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* Add Trade Form */}
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
                <label>Date</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className={styles.formField}>
                <label>Direction</label>
                <select value={formDir} onChange={e => setFormDir(e.target.value as 'long' | 'short')}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label>Entry Price</label>
                <input type="number" value={formEntry} onChange={e => setFormEntry(e.target.value)} placeholder="0.00" />
              </div>
              <div className={styles.formField}>
                <label>Exit Price</label>
                <input type="number" value={formExit} onChange={e => setFormExit(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label>Quantity</label>
                <input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} placeholder="0" />
              </div>
              <div className={styles.formField}>
                <label>Stop Loss (opt)</label>
                <input type="number" value={formStop} onChange={e => setFormStop(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className={styles.formField} style={{ width: '100%' }}>
              <label>Notes</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Setup notes..."
              />
            </div>
            <button
              className={styles.submitBtn}
              onClick={handleAddTrade}
              disabled={!formEntry || !formExit || !formQty}
            >
              Add Trade
            </button>
          </div>
        )}

        {/* Stats bar */}
        {trades.length > 0 && (
          <div className={styles.statsBar}>
            <div className={styles.statCell}>
              <div className={styles.statLabel}>Total P&L</div>
              <div className={`${styles.statValue} ${totalPnl >= 0 ? styles.profit : styles.loss}`}>
                {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
              </div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statLabel}>Win Rate</div>
              <div className={styles.statValue}>{winRate}{winRate !== '—' ? '%' : ''}</div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statLabel}>Avg R:R</div>
              <div className={styles.statValue}>{avgRR}</div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statLabel}>Trades</div>
              <div className={styles.statValue}>{trades.length}</div>
            </div>
          </div>
        )}

        {/* Trade list */}
        {trades.length === 0 && !showForm && (
          <p className={styles.emptyHint}>
            No trades yet. Click <strong>Add</strong> to log a trade.
          </p>
        )}

        {trades.map(trade => (
          <div
            key={trade.id}
            className={`${styles.tradeCard} ${trade.pnl >= 0 ? styles.tradeWin : styles.tradeLoss}`}
          >
            <div className={styles.tradeHeader}>
              <div className={styles.tradeSymbol}>
                <span className={`${styles.dirTag} ${trade.direction === 'long' ? styles.dirLong : styles.dirShort}`}>
                  {trade.direction === 'long' ? 'L' : 'S'}
                </span>
                <strong>{trade.symbol}</strong>
                <span className={styles.tradeDate}>{trade.date}</span>
              </div>
              <div className={styles.tradePnl}>
                <span className={trade.pnl >= 0 ? styles.profit : styles.loss}>
                  {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                </span>
                <span className={styles.pnlPct}>
                  ({trade.pnlPct >= 0 ? '+' : ''}{trade.pnlPct.toFixed(2)}%)
                </span>
              </div>
              <button className={styles.deleteBtn} onClick={() => handleDelete(trade.id)} title="Delete">
                <Trash2 size={11} />
              </button>
            </div>
            <div className={styles.tradeDetails}>
              <span>Entry: <strong>{trade.entryPrice}</strong></span>
              <span>Exit: <strong>{trade.exitPrice}</strong></span>
              <span>Qty: <strong>{trade.qty}</strong></span>
              {trade.rr !== null && <span>R:R <strong>{trade.rr}</strong></span>}
            </div>
            {trade.notes && (
              <p className={styles.tradeNotes}>{trade.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TradeJournalPanel;
