/**
 * AI Analysis Panel
 * Displays SMC/ICT analysis powered by Claude AI.
 * Features: streaming response, follow-up chat, analysis history.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, History, BarChart2, Send } from 'lucide-react';
import styles from './AIAnalysisPanel.module.css';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import {
  runAIAnalysisStream,
  runAIChat,
  AIAnalysisResult,
  AIAnalysisResponse,
  ChatMessage,
} from '../../services/aiAnalysisService';
import { SMCAnalysisResult } from '../../services/smcDetectionService';
import type { SMCOverlayData, SMCOverlayOptions, SMCOverlayColors } from '../../plugins/smc-overlays/SMCOverlayPrimitive';

function loadStoredColors(): SMCOverlayColors | undefined {
  try {
    const s = localStorage.getItem(STORAGE_KEYS.SMC_OVERLAY_COLORS);
    return s ? JSON.parse(s) : undefined;
  } catch { return undefined; }
}

function loadSMCOptions(): Record<string, unknown> {
  try {
    const s = localStorage.getItem(STORAGE_KEYS.SMC_SETTINGS);
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface AIAnalysisPanelProps {
  symbol: string;
  exchange: string;
  interval: string;
  chartRef: React.RefObject<any>;
  onOverlayDataReady: (smcData: SMCAnalysisResult) => void;
}

interface AnalysisHistoryEntry {
  timestamp: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  confluenceScore: number;
  summary: string;
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
  type Tab = 'results' | 'history';

  const [status, setStatus]               = useState<Status>('idle');
  const [result, setResult]               = useState<AIAnalysisResult | null>(null);
  const [smcData, setSmcData]             = useState<SMCAnalysisResult | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [lastAnalyzed, setLastAnalyzed]   = useState<string | null>(null);
  const [confluenceScore, setConfluenceScore] = useState<number>(0);
  const [activeTab, setActiveTab]         = useState<Tab>('results');
  const [history, setHistory]             = useState<AnalysisHistoryEntry[]>([]);
  const isRunningRef = useRef(false);
  const abortRef     = useRef<AbortController | null>(null);

  // Streaming state
  const [streamingText, setStreamingText]   = useState('');
  const [isStreaming, setIsStreaming]       = useState(false);

  // Chat state
  const [chatMessages, setChatMessages]       = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]             = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [chatStreamText, setChatStreamText]   = useState('');
  const chatStreamRef  = useRef('');   // reliable accumulator (avoids stale closure)
  const chatInputRef   = useRef<HTMLInputElement>(null);
  const chatScrollRef  = useRef<HTMLDivElement>(null);
  const chatAbortRef   = useRef<AbortController | null>(null);

  const [overlayOpts, setOverlayOpts] = useState<SMCOverlayOptions>(() => ({
    showOrderBlocks: true,
    showFVGs: true,
    showStructureBreaks: true,
    showLiquidityLevels: true,
    showSwingPoints: true,
    showBreakerBlocks: true,
    showImpulsiveCandles: true,
    showLiquiditySweeps: true,
    colors: loadStoredColors() ?? ({} as SMCOverlayColors),
  }));

  const [statusMsg, setStatusMsg] = useState('');

  // ── Load history + chat per symbol ────────────────────────────────────────

  useEffect(() => {
    const histKey  = `claude_ai_history_${exchange}_${symbol}`;
    const chatKey  = `${STORAGE_KEYS.CLAUDE_AI_CHAT}_${exchange}_${symbol}`;
    try { setHistory(JSON.parse(localStorage.getItem(histKey) ?? '[]')); } catch { setHistory([]); }
    try { setChatMessages(JSON.parse(localStorage.getItem(chatKey) ?? '[]')); } catch { setChatMessages([]); }
  }, [symbol, exchange]);

  // Persist chat whenever it changes
  useEffect(() => {
    const chatKey = `${STORAGE_KEYS.CLAUDE_AI_CHAT}_${exchange}_${symbol}`;
    localStorage.setItem(chatKey, JSON.stringify(chatMessages.slice(-30)));
  }, [chatMessages, symbol, exchange]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatStreamText]);

  // Abort streams on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      chatAbortRef.current?.abort();
    };
  }, []);

  // ── Handle completed analysis response ────────────────────────────────────

  const handleAnalysisResponse = useCallback((response: AIAnalysisResponse) => {
    isRunningRef.current = false;
    setIsStreaming(false);

    if (response.smcData) {
      setSmcData(response.smcData);
      setConfluenceScore(response.confluenceScore);
      if (chartRef.current?.setSMCOverlayData) {
        const overlayData: SMCOverlayData = {
          orderBlocks: response.smcData.orderBlocks,
          fairValueGaps: response.smcData.fairValueGaps,
          structureBreaks: response.smcData.structureBreaks,
          liquidityLevels: response.smcData.liquidityLevels,
          swingPoints: response.smcData.swingPoints,
          breakerBlocks: response.smcData.breakerBlocks,
          impulsiveCandles: response.smcData.impulsiveCandles,
          liquiditySweeps: response.smcData.liquiditySweeps,
        };
        chartRef.current.setSMCOverlayData(overlayData);
      }
      onOverlayDataReady(response.smcData);
    }

    if (response.error) {
      if (response.error === 'NO_API_KEY') {
        setApiKeyMissing(true);
        setStatus('idle');
      } else {
        setStatus('error');
        setError(response.error);
      }
    } else if (response.result) {
      setStatus('done');
      setResult(response.result);
      const ts = new Date().toLocaleTimeString();
      setLastAnalyzed(ts);
      setActiveTab('results');

      const entry: AnalysisHistoryEntry = {
        timestamp: new Date().toLocaleString(),
        bias: response.result.bias,
        confidence: response.result.confidence,
        confluenceScore: response.confluenceScore,
        summary: response.result.summary,
      };
      const histKey = `claude_ai_history_${exchange}_${symbol}`;
      const prev: AnalysisHistoryEntry[] = (() => {
        try { return JSON.parse(localStorage.getItem(histKey) ?? '[]'); } catch { return []; }
      })();
      const updated = [entry, ...prev].slice(0, 10);
      localStorage.setItem(histKey, JSON.stringify(updated));
      setHistory(updated);
    }
  }, [chartRef, onOverlayDataReady, exchange, symbol]);

  // ── Run Analysis ──────────────────────────────────────────────────────────

  const handleRunAnalysis = useCallback(async () => {
    if (isRunningRef.current) return;

    const apiKey = localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY);
    if (!apiKey) { setApiKeyMissing(true); return; }
    setApiKeyMissing(false);

    const candles = chartRef.current?.getData?.();
    if (!candles || candles.length < 100) {
      setStatus('error');
      setError('Not enough chart data. Load at least 100 candles.');
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    isRunningRef.current = true;
    setStatus('analyzing');
    setError(null);
    setStreamingText('');
    setIsStreaming(true);
    setStatusMsg('Running SMC detection...');

    await new Promise(r => setTimeout(r, 16));

    const smcOpts = loadSMCOptions();
    await runAIAnalysisStream(
      { candles, symbol, exchange, interval, smcOptions: smcOpts },
      {
        onToken: (token) => setStreamingText(prev => prev + token),
        onProgress: (msg) => setStatusMsg(msg),
        onComplete: handleAnalysisResponse,
        onError: (errMsg) => {
          isRunningRef.current = false;
          setIsStreaming(false);
          if (errMsg === 'NO_API_KEY') {
            setApiKeyMissing(true);
            setStatus('idle');
          } else {
            setStatus('error');
            setError(errMsg);
          }
        },
      },
      abortRef.current.signal
    );
  }, [symbol, exchange, interval, chartRef, handleAnalysisResponse]);

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

  // ── Chat ──────────────────────────────────────────────────────────────────

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || isChatStreaming || !result || !smcData) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);
    setChatInput('');
    setIsChatStreaming(true);
    setChatStreamText('');
    chatStreamRef.current = '';

    chatAbortRef.current?.abort();
    chatAbortRef.current = new AbortController();

    const candles = chartRef.current?.getData?.() ?? [];
    const currentPrice = candles[candles.length - 1]?.close ?? 0;

    await runAIChat(
      {
        question: userMsg.content,
        conversationHistory: updatedHistory.slice(-10),
        analysisContext: {
          originalAnalysis: result,
          symbol,
          exchange,
          interval,
          confluenceScore,
          currentPrice,
        },
        smcData,
      },
      {
        onToken: (token) => {
          chatStreamRef.current += token;
          setChatStreamText(prev => prev + token);
        },
        onComplete: () => {
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: chatStreamRef.current,
            timestamp: new Date().toISOString(),
          };
          setChatMessages(prev => [...prev, assistantMsg]);
          setChatStreamText('');
          chatStreamRef.current = '';
          setIsChatStreaming(false);
        },
        onError: (err) => {
          setChatStreamText('');
          chatStreamRef.current = '';
          setIsChatStreaming(false);
          // Show brief inline error as assistant message
          if (err !== 'NO_API_KEY') {
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: `Error: ${err}`,
              timestamp: new Date().toISOString(),
            }]);
          }
        },
      },
      chatAbortRef.current.signal
    );
  }, [chatInput, chatMessages, isChatStreaming, result, smcData, symbol, exchange, interval, confluenceScore, chartRef]);

  const handleChatKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  }, [handleSendChat]);

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

  const isLoading = status === 'detecting' || status === 'analyzing';

  const confluenceColor =
    confluenceScore >= 70 ? '#26a69a'
    : confluenceScore >= 40 ? '#ff9800'
    : '#ef5350';

  const biasPillClassForBias = (bias: 'bullish' | 'bearish' | 'neutral') =>
    bias === 'bullish' ? styles.biasBullish
    : bias === 'bearish' ? styles.biasBearish
    : styles.biasNeutral;

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
          {(status === 'done' || status === 'error') && !isLoading && !isStreaming && (
            <button className={styles.reanalyzeBtn} onClick={handleRunAnalysis} disabled={isRunningRef.current}>
              <RefreshCw size={11} style={{ display: 'inline', marginRight: 3 }} />
              Re-analyze
            </button>
          )}
        </div>
      </div>

      {/* Tab bar — shown after at least one analysis */}
      {(status === 'done' || history.length > 0) && (
        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${activeTab === 'results' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('results')}
          >
            <BarChart2 size={11} style={{ display: 'inline', marginRight: 3 }} />
            Results
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={11} style={{ display: 'inline', marginRight: 3 }} />
            History ({history.length})
          </button>
        </div>
      )}

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

        {/* History tab */}
        {activeTab === 'history' && (
          <>
            {history.length === 0 ? (
              <p className={styles.idleHint}>No history yet for {symbol}.</p>
            ) : (
              history.map((entry, i) => (
                <div key={i} className={styles.card} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className={`${styles.biasPill} ${biasPillClassForBias(entry.bias)}`} style={{ fontSize: 10 }}>
                      {entry.bias.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--tv-color-text-secondary, #787b86)' }}>
                      {entry.timestamp}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span className={styles.confidenceBadge}>Conf: {entry.confidence}/10</span>
                    <span className={styles.confidenceBadge} style={{ color: entry.confluenceScore >= 70 ? '#26a69a' : entry.confluenceScore >= 40 ? '#ff9800' : '#ef5350' }}>
                      Score: {entry.confluenceScore}/100
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--tv-color-text-secondary, #787b86)', lineHeight: 1.4 }}>
                    {entry.summary}
                  </p>
                </div>
              ))
            )}
          </>
        )}

        {/* Results tab */}
        {activeTab === 'results' && (
          <>
            {/* Idle */}
            {status === 'idle' && !isStreaming && (
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

            {/* Streaming */}
            {isStreaming && (
              <div className={styles.streamingContainer}>
                <div className={styles.streamingHeader}>
                  <div className={styles.streamingDot} />
                  <span>{statusMsg || 'Claude is analyzing...'}</span>
                </div>
                <div className={styles.streamingText}>
                  {streamingText}
                  {streamingText.length === 0 && <span className={styles.streamingCursor} />}
                </div>
              </div>
            )}

            {/* Error */}
            {status === 'error' && !isStreaming && (
              <>
                <div className={styles.error}>{error}</div>
                <button className={styles.runBtn} onClick={handleRunAnalysis} style={{ marginTop: 8 }}>
                  Try Again
                </button>
              </>
            )}

            {/* Results */}
            {status === 'done' && result && !isStreaming && (
              <>
                {/* Bias + Confidence + Confluence Score */}
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
                  {/* Confluence Score Progress Bar */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--tv-color-text-secondary, #787b86)' }}>Confluence Score</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: confluenceColor }}>{confluenceScore}/100</span>
                    </div>
                    <div className={styles.confluenceTrack}>
                      <div
                        className={styles.confluenceFill}
                        style={{ width: `${confluenceScore}%`, backgroundColor: confluenceColor }}
                      />
                    </div>
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

                {/* Chat follow-up */}
                <div className={styles.chatSection}>
                  <div className={styles.cardTitle}>Follow-up Questions</div>

                  {chatMessages.length > 0 && (
                    <div className={styles.chatThread} ref={chatScrollRef}>
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant}
                        >
                          {msg.content}
                        </div>
                      ))}
                      {isChatStreaming && (
                        <div className={styles.chatBubbleAssistant}>
                          {chatStreamText || <span className={styles.streamingCursor} />}
                          {chatStreamText && <span className={styles.streamingCursor} />}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty state when no messages yet and streaming starts */}
                  {chatMessages.length === 0 && isChatStreaming && (
                    <div className={styles.chatThread} ref={chatScrollRef}>
                      <div className={styles.chatBubbleAssistant}>
                        {chatStreamText || <span className={styles.streamingCursor} />}
                        {chatStreamText && <span className={styles.streamingCursor} />}
                      </div>
                    </div>
                  )}

                  <div className={styles.chatInputRow}>
                    <input
                      ref={chatInputRef}
                      className={styles.chatInput}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={handleChatKeyDown}
                      placeholder="Ask a follow-up question..."
                      disabled={isChatStreaming}
                    />
                    <button
                      className={styles.chatSendBtn}
                      onClick={handleSendChat}
                      disabled={isChatStreaming || !chatInput.trim()}
                    >
                      <Send size={12} />
                    </button>
                  </div>

                  {chatMessages.length > 0 && (
                    <button
                      className={styles.clearChatBtn}
                      onClick={() => {
                        setChatMessages([]);
                        const chatKey = `${STORAGE_KEYS.CLAUDE_AI_CHAT}_${exchange}_${symbol}`;
                        localStorage.removeItem(chatKey);
                      }}
                    >
                      Clear chat
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Overlay Controls — shown after SMC detection regardless of AI result */}
        {smcData && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Chart Overlays</div>
            {(
              [
                ['showOrderBlocks',      'Order Blocks'],
                ['showBreakerBlocks',    'Breaker Blocks'],
                ['showFVGs',             'Fair Value Gaps'],
                ['showStructureBreaks',  'BOS / ChoCH'],
                ['showLiquidityLevels',  'Liquidity Levels'],
                ['showLiquiditySweeps',  'Liquidity Sweeps'],
                ['showSwingPoints',      'Swing Points'],
                ['showImpulsiveCandles', 'Impulse Candles'],
              ] as [keyof SMCOverlayOptions, string][]
            ).map(([key, label]) => (
              <div key={key} className={styles.toggleRow}>
                <span className={styles.toggleLabel}>{label}</span>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={overlayOpts[key] as boolean}
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
