/**
 * AI Analysis Panel
 * Displays SMC/ICT analysis powered by Claude AI.
 * Follows the same right-panel pattern as ANNScanner.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import styles from './AIAnalysisPanel.module.css';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { runAIAnalysis, AIAnalysisResult } from '../../services/aiAnalysisService';
import { SMCAnalysisResult } from '../../services/smcDetectionService';
import type { SMCOverlayData, SMCOverlayOptions } from '../../plugins/smc-overlays/SMCOverlayPrimitive';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

export interface AIAnalysisPanelProps {
  symbol: string;
  exchange: string;
  interval: string;
  chartRef: React.RefObject<any>;
  onOverlayDataReady: (smcData: SMCAnalysisResult) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  symbol,
  exchange,
  interval,
  chartRef,
  onOverlayDataReady,
}) => {
  type Status = 'idle' | 'detecting' | 'analyzing' | 'done' | 'error';

  const [status, setStatus]       = useState<Status>('idle');
  const [result, setResult]       = useState<AIAnalysisResult | null>(null);
  const [smcData, setSmcData]     = useState<SMCAnalysisResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [lastAnalyzed, setLastAnalyzed]   = useState<string | null>(null);

  const [overlayOpts, setOverlayOpts] = useState<SMCOverlayOptions>({
    showOrderBlocks: true,
    showFVGs: true,
    showStructureBreaks: true,
    showLiquidityLevels: true,
    showSwingPoints: true,
  });

  const statusMsgRef = useRef('');
  const [statusMsg, setStatusMsg] = useState('');

  // ── Run Analysis ──────────────────────────────────────────────────────────

  const handleRunAnalysis = useCallback(async () => {
    const apiKey = localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY);
    if (!apiKey) { setApiKeyMissing(true); return; }
    setApiKeyMissing(false);

    const candles = chartRef.current?.getData?.();
    if (!candles || candles.length < 50) {
      setStatus('error');
      setError('Not enough chart data. Load at least 50 candles.');
      return;
    }

    setStatus('detecting');
    setError(null);
    setStatusMsg('Running SMC detection...');

    // Allow React to paint the loading state
    await new Promise(r => setTimeout(r, 16));

    setStatus('analyzing');
    setStatusMsg('Consulting Claude AI...');

    const response = await runAIAnalysis(
      { candles, symbol, exchange, interval },
      (msg) => setStatusMsg(msg)
    );

    // Always show SMC overlays even if Claude call fails
    if (response.smcData) {
      setSmcData(response.smcData);
      onOverlayDataReady(response.smcData);
      // Push to chart overlay
      if (chartRef.current?.setSMCOverlayData) {
        const overlayData: SMCOverlayData = {
          orderBlocks: response.smcData.orderBlocks,
          fairValueGaps: response.smcData.fairValueGaps,
          structureBreaks: response.smcData.structureBreaks,
          liquidityLevels: response.smcData.liquidityLevels,
          swingPoints: response.smcData.swingPoints,
        };
        chartRef.current.setSMCOverlayData(overlayData);
      }
    }

    if (response.error) {
      if (response.error === 'NO_API_KEY') {
        setApiKeyMissing(true);
        setStatus('idle');
      } else {
        setStatus('error');
        setError(response.error);
      }
    } else {
      setStatus('done');
      setResult(response.result);
      setLastAnalyzed(new Date().toLocaleTimeString());
    }
  }, [symbol, exchange, interval, chartRef, onOverlayDataReady]);

  // ── Overlay toggle ────────────────────────────────────────────────────────

  const toggleOverlay = useCallback((key: keyof SMCOverlayOptions) => {
    setOverlayOpts(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      if (chartRef.current?.setSMCOverlayOptions) {
        chartRef.current.setSMCOverlayOptions(updated);
      }
      return updated;
    });
  }, [chartRef]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const biasPillClass =
    result?.bias === 'bullish' ? styles.biasBullish
    : result?.bias === 'bearish' ? styles.biasBearish
    : styles.biasNeutral;

  const dirBadgeClass =
    result?.tradeSetup?.direction === 'long' ? styles.dirLong
    : result?.tradeSetup?.direction === 'short' ? styles.dirShort
    : styles.dirWait;

  const fmt = (v: number | null | undefined, decimals = 2) =>
    v == null ? '—' : v.toFixed(decimals);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <Sparkles size={14} />
          AI Analysis
        </div>
        <div className={styles.headerControls}>
          {lastAnalyzed && (
            <span style={{ fontSize: 10, color: 'var(--tv-color-text-secondary, #787b86)' }}>
              {lastAnalyzed}
            </span>
          )}
          {status === 'done' && (
            <button className={styles.reanalyzeBtn} onClick={handleRunAnalysis}>
              <RefreshCw size={11} style={{ display: 'inline', marginRight: 3 }} />
              Re-analyze
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* API Key Missing */}
        {apiKeyMissing && (
          <div className={styles.apiKeyAlert}>
            <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
            Claude API key required.
            <br />
            Add it in <strong>Settings &gt; AI Analysis</strong>.
          </div>
        )}

        {/* Idle */}
        {status === 'idle' && (
          <>
            <button className={styles.runBtn} onClick={handleRunAnalysis}>
              <Sparkles size={14} />
              Analyze {symbol} ({interval})
            </button>
            <p className={styles.idleHint}>
              Detects Order Blocks, FVGs, BOS/ChoCH, Liquidity &amp; ICT setups using Claude AI.
            </p>
          </>
        )}

        {/* Loading */}
        {(status === 'detecting' || status === 'analyzing') && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div className={styles.error}>{error}</div>
            <button className={styles.runBtn} onClick={handleRunAnalysis} style={{ marginTop: 8 }}>
              Try Again
            </button>
          </>
        )}

        {/* Results */}
        {status === 'done' && result && (
          <>
            {/* Bias + Confidence */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>Market Bias</div>
              <div className={styles.biasRow}>
                <span className={`${styles.biasPill} ${biasPillClass}`}>
                  {result.bias.toUpperCase()}
                </span>
                <span className={styles.confidenceBadge}>
                  Confidence: {result.confidence}/10
                </span>
              </div>
            </div>

            {/* Market Structure */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>Market Structure</div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Trend</span>
                <span className={styles.kvVal}>{result.marketStructure.trend}</span>
              </div>
              <p style={{ margin: '6px 0', color: 'var(--tv-color-text-secondary, #787b86)', lineHeight: 1.5 }}>
                {result.marketStructure.structureDescription}
              </p>
              {result.marketStructure.keyObservations?.length > 0 && (
                <ul className={styles.obsList}>
                  {result.marketStructure.keyObservations.map((obs, i) => (
                    <li key={i}>{obs}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* SMC Context */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>SMC Context</div>
              {result.smcContext.activeOrderBlock && (
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Order Block</span>
                  <span className={styles.kvVal}>{result.smcContext.activeOrderBlock.range}</span>
                </div>
              )}
              {result.smcContext.nearestFVG && (
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Nearest FVG</span>
                  <span className={styles.kvVal}>{result.smcContext.nearestFVG.range}</span>
                </div>
              )}
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>P/D Zone</span>
                <span className={styles.kvVal}>{result.smcContext.premiumDiscount}</span>
              </div>
              {result.smcContext.liquidityTargets?.length > 0 && (
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Liquidity</span>
                  <span className={styles.kvVal}>{result.smcContext.liquidityTargets.join(', ')}</span>
                </div>
              )}
            </div>

            {/* ICT Setup */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>ICT Setup</div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Kill Zone</span>
                <span className={styles.kvVal}>{result.ictSetup.killZone}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Setup Type</span>
                <span className={styles.kvVal}>{result.ictSetup.setupType || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Valid</span>
                <span className={styles.kvVal} style={{ color: result.ictSetup.setupValid ? '#26a69a' : '#ef5350' }}>
                  {result.ictSetup.setupValid ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {/* Key Levels */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>Key Levels</div>
              <div className={styles.levelsGrid}>
                <div className={styles.levelCell}>
                  <div className={styles.levelCellLabel}>Strong Support</div>
                  <div className={`${styles.levelCellValue} ${styles.supportVal}`}>
                    {fmt(result.keyLevels.strongSupport)}
                  </div>
                </div>
                <div className={styles.levelCell}>
                  <div className={styles.levelCellLabel}>Strong Resistance</div>
                  <div className={`${styles.levelCellValue} ${styles.resistanceVal}`}>
                    {fmt(result.keyLevels.strongResistance)}
                  </div>
                </div>
                <div className={styles.levelCell}>
                  <div className={styles.levelCellLabel}>Imm. Support</div>
                  <div className={`${styles.levelCellValue} ${styles.supportVal}`}>
                    {fmt(result.keyLevels.immediateSupport)}
                  </div>
                </div>
                <div className={styles.levelCell}>
                  <div className={styles.levelCellLabel}>Imm. Resistance</div>
                  <div className={`${styles.levelCellValue} ${styles.resistanceVal}`}>
                    {fmt(result.keyLevels.immediateResistance)}
                  </div>
                </div>
              </div>
            </div>

            {/* Trade Setup */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>Trade Setup</div>
              <div className={styles.biasRow} style={{ marginBottom: 8 }}>
                <span className={`${styles.dirBadge} ${dirBadgeClass}`}>
                  {result.tradeSetup.direction.toUpperCase()}
                </span>
                {result.tradeSetup.riskRewardRatio && (
                  <span className={styles.confidenceBadge}>
                    R:R {result.tradeSetup.riskRewardRatio.toFixed(1)}
                  </span>
                )}
              </div>
              {result.tradeSetup.entryZone && (
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Entry Zone</span>
                  <span className={styles.kvVal}>{result.tradeSetup.entryZone}</span>
                </div>
              )}
              <div className={styles.kvRow}>
                <span className={styles.kvKey}>Stop Loss</span>
                <span className={styles.kvVal} style={{ color: '#ef5350' }}>{fmt(result.tradeSetup.stopLoss)}</span>
              </div>
              {result.tradeSetup.targets && result.tradeSetup.targets.length > 0 && (
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Targets</span>
                  <span className={styles.kvVal} style={{ color: '#26a69a' }}>
                    {result.tradeSetup.targets.map(t => fmt(t)).join(' / ')}
                  </span>
                </div>
              )}
              {result.tradeSetup.invalidationLevel != null && (
                <div className={styles.kvRow}>
                  <span className={styles.kvKey}>Invalidation</span>
                  <span className={styles.kvVal}>{fmt(result.tradeSetup.invalidationLevel)}</span>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>Summary</div>
              <p className={styles.summary}>{result.summary}</p>
            </div>
          </>
        )}

        {/* Overlay Controls — shown after SMC detection regardless of AI result */}
        {smcData && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Chart Overlays</div>
            {(
              [
                ['showOrderBlocks', 'Order Blocks'],
                ['showFVGs', 'Fair Value Gaps'],
                ['showStructureBreaks', 'BOS / ChoCH'],
                ['showLiquidityLevels', 'Liquidity Levels'],
                ['showSwingPoints', 'Swing Points'],
              ] as [keyof SMCOverlayOptions, string][]
            ).map(([key, label]) => (
              <div key={key} className={styles.toggleRow}>
                <span className={styles.toggleLabel}>{label}</span>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={overlayOpts[key]}
                    onChange={() => toggleOverlay(key)}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalysisPanel;
