/**
 * AI Analysis Service
 * Builds a prompt from SMC-detected data + indicators, then calls Claude API.
 */

import { STORAGE_KEYS } from '../constants/storageKeys';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateEMA,
  calculateStochastic,
  calculateVWAP,
  calculateVolumeMA,
} from '../utils/indicators';
import {
  OHLCCandle,
  SMCAnalysisResult,
  runFullSMCAnalysis,
} from './smcDetectionService';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface AIAnalysisRequest {
  candles: OHLCCandle[];
  symbol: string;
  exchange: string;
  interval: string;
  smcOptions?: Record<string, unknown>;
}

export interface AIAnalysisResult {
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  marketStructure: {
    trend: string;
    structureDescription: string;
    keyObservations: string[];
  };
  smcContext: {
    activeOrderBlock: { direction: string; range: string; note: string } | null;
    nearestFVG: { direction: string; range: string } | null;
    liquidityTargets: string[];
    premiumDiscount: 'premium' | 'discount' | 'equilibrium';
  };
  ictSetup: {
    killZone: string;
    setupType: string;
    setupValid: boolean;
  };
  keyLevels: {
    strongSupport: number | null;
    strongResistance: number | null;
    immediateSupport: number | null;
    immediateResistance: number | null;
  };
  tradeSetup: {
    direction: 'long' | 'short' | 'wait';
    entryZone: string | null;
    stopLoss: number | null;
    targets: number[] | null;
    riskRewardRatio: number | null;
    invalidationLevel: number | null;
  };
  summary: string;
}

export interface AIAnalysisResponse {
  result: AIAnalysisResult | null;
  error: string | null;
  smcData: SMCAnalysisResult;
  confluenceScore: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Indicator Snapshot
// ────────────────────────────────────────────────────────────────────────────

interface IndicatorSnapshot {
  rsi: number | null;
  rsiLabel: string;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  ema20: number | null;
  ema50: number | null;
  atr: number | null;
  stochK: number | null;
  stochD: number | null;
  stochLabel: string;
  vwap: number | null;
  vwapRelation: 'above' | 'below' | 'at' | 'unavailable';
  volumeSma20: number | null;
  currentVolume: number | null;
  relativeVolume: number | null;
  volumeLabel: string;
}

function buildIndicatorSnapshot(candles: OHLCCandle[]): IndicatorSnapshot {
  const last = <T extends { value: number }>(arr: T[]): number | null =>
    arr.length > 0 ? arr[arr.length - 1].value : null;

  const rsiArr = calculateRSI(candles as any, 14);
  const rsiVal = last(rsiArr);
  const rsiLabel = rsiVal === null ? 'neutral'
    : rsiVal > 70 ? 'overbought'
    : rsiVal < 30 ? 'oversold'
    : 'neutral';

  const macdResult = calculateMACD(candles as any, 12, 26, 9);
  const bbResult   = calculateBollingerBands(candles as any, 20, 2);
  const ema20Arr   = calculateEMA(candles as any, 20);
  const ema50Arr   = calculateEMA(candles as any, 50);
  const atrArr     = calculateATR(candles as any, 14);

  // Stochastic (14, 3, 3)
  const stochResult = calculateStochastic(candles as any, 14, 3, 3);
  const stochK = stochResult.kLine.length > 0
    ? stochResult.kLine[stochResult.kLine.length - 1].value : null;
  const stochD = stochResult.dLine.length > 0
    ? stochResult.dLine[stochResult.dLine.length - 1].value : null;
  const stochLabel = stochK === null ? 'neutral'
    : stochK > 80 ? 'overbought'
    : stochK < 20 ? 'oversold'
    : 'neutral';

  // VWAP
  const vwapArr = calculateVWAP(candles as any, { resetDaily: true });
  const vwapVal = vwapArr.length > 0 ? vwapArr[vwapArr.length - 1].value : null;
  const latestClose = candles[candles.length - 1]?.close ?? 0;
  const atrVal = last(atrArr) ?? 1;
  const vwapRelation: 'above' | 'below' | 'at' | 'unavailable' =
    vwapVal === null ? 'unavailable'
    : Math.abs(latestClose - vwapVal) < atrVal * 0.2 ? 'at'
    : latestClose > vwapVal ? 'above' : 'below';

  // Volume analysis (20-period SMA)
  const volumeMAArr = calculateVolumeMA(candles as any, 20);
  const volumeSma20 = volumeMAArr.length > 0 ? volumeMAArr[volumeMAArr.length - 1].value : null;
  const currentVolume = candles[candles.length - 1]?.volume ?? null;
  const relativeVolume = (volumeSma20 && currentVolume && volumeSma20 > 0)
    ? currentVolume / volumeSma20 : null;
  const volumeLabel = relativeVolume === null ? 'N/A'
    : relativeVolume > 1.5 ? 'high'
    : relativeVolume < 0.5 ? 'low'
    : 'normal';

  return {
    rsi: rsiVal,
    rsiLabel,
    macdLine:      last(macdResult.macdLine),
    macdSignal:    last(macdResult.signalLine),
    macdHistogram: last(macdResult.histogram),
    bbUpper:       last(bbResult.upper),
    bbMiddle:      last(bbResult.middle),
    bbLower:       last(bbResult.lower),
    ema20:         last(ema20Arr),
    ema50:         last(ema50Arr),
    atr:           last(atrArr),
    stochK,
    stochD,
    stochLabel,
    vwap: vwapVal,
    vwapRelation,
    volumeSma20,
    currentVolume: currentVolume ?? null,
    relativeVolume,
    volumeLabel,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Confluence Score
// ────────────────────────────────────────────────────────────────────────────

export function calculateConfluenceScore(
  smcData: SMCAnalysisResult,
  indicators: IndicatorSnapshot,
  candles: OHLCCandle[]
): number {
  if (!candles || candles.length === 0) return 0;
  const lastCandle = candles[candles.length - 1];
  if (!lastCandle || !isFinite(lastCandle.close)) return 0;

  let score = 0;
  const latestClose = lastCandle.close;
  const atr = (indicators.atr != null && isFinite(indicators.atr) && indicators.atr > 0)
    ? indicators.atr : 1;
  const trend = smcData.currentTrend;

  // +20: price near OB (within ATR)
  const nearOB = smcData.orderBlocks.some(
    ob => Math.abs(latestClose - (ob.high + ob.low) / 2) < atr
  );
  if (nearOB) score += 20;

  // +15: unfilled FVG nearby (within ATR)
  const nearFVG = smcData.fairValueGaps.some(
    fvg => latestClose >= fvg.low - atr && latestClose <= fvg.top + atr
  );
  if (nearFVG) score += 15;

  // +15: RSI aligned with bias
  if (indicators.rsi !== null) {
    if (trend === 'bullish' && indicators.rsi > 50) score += 15;
    else if (trend === 'bearish' && indicators.rsi < 50) score += 15;
  }

  // +15: EMA alignment with bias
  if (indicators.ema20 !== null && indicators.ema50 !== null) {
    if (trend === 'bullish' && indicators.ema20 > indicators.ema50) score += 15;
    else if (trend === 'bearish' && indicators.ema20 < indicators.ema50) score += 15;
  }

  // +10: Recent BOS in bias direction
  const recentBOS = smcData.structureBreaks.slice(-3).some(
    sb => sb.direction === trend
  );
  if (recentBOS) score += 10;

  // +10: In kill zone
  if (smcData.killZone !== null) score += 10;

  // +5: Price in discount zone for long / premium for short
  if (smcData.premiumDiscountLevel > 0) {
    if (trend === 'bullish' && latestClose < smcData.premiumDiscountLevel) score += 5;
    else if (trend === 'bearish' && latestClose > smcData.premiumDiscountLevel) score += 5;
  }

  const result = Math.min(100, score);
  return isNaN(result) ? 0 : result;
}

// ────────────────────────────────────────────────────────────────────────────
// Prompt Builder
// ────────────────────────────────────────────────────────────────────────────

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function n(val: number | null, decimals = 2): string {
  return val === null ? 'N/A' : val.toFixed(decimals);
}

function buildPrompt(
  request: AIAnalysisRequest,
  smcData: SMCAnalysisResult,
  indicators: IndicatorSnapshot,
  confluenceScore: number
): string {
  const { candles, symbol, exchange, interval } = request;
  const latestCandle = candles[candles.length - 1];
  const latestClose  = latestCandle?.close ?? 0;
  const dateStr      = latestCandle ? formatDate(latestCandle.time) : 'N/A';

  // Last 50 candles table
  const last50 = candles.slice(-50);
  const candleRows = last50.map(c =>
    `${formatDate(c.time)} | O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume ?? 0}`
  ).join('\n');

  // EMA price relationship
  const emaStatus =
    indicators.ema20 === null ? 'N/A'
    : latestClose > (indicators.ema20 ?? 0) && latestClose > (indicators.ema50 ?? 0) ? 'above both EMAs'
    : latestClose < (indicators.ema20 ?? 0) && latestClose < (indicators.ema50 ?? 0) ? 'below both EMAs'
    : 'between EMAs';

  // Order blocks summary
  const obSummary = smcData.orderBlocks.slice(0, 3).map(ob =>
    `${ob.type.toUpperCase()} OB: ${ob.low.toFixed(2)}-${ob.high.toFixed(2)} (strength: ${ob.strength})`
  ).join('; ') || 'None detected';

  // FVG summary
  const fvgSummary = smcData.fairValueGaps.slice(0, 3).map(fvg =>
    `${fvg.type.toUpperCase()} FVG: ${fvg.low.toFixed(2)}-${fvg.top.toFixed(2)}`
  ).join('; ') || 'None detected';

  // Structure breaks
  const sbSummary = smcData.structureBreaks.slice(-2).map(sb =>
    `${sb.type} ${sb.direction} @ ${sb.level.toFixed(2)} (${formatDate(sb.time)})`
  ).join('; ') || 'None detected';

  // Liquidity
  const liqSummary = smcData.liquidityLevels.slice(0, 4).map(l =>
    `${l.type === 'equal_highs' ? 'EQH' : 'EQL'} @ ${l.price.toFixed(2)} (${l.touchCount} touches)`
  ).join('; ') || 'None detected';

  // Breaker blocks
  const bbSummary = smcData.breakerBlocks.slice(0, 3).map(bb =>
    `${bb.type.toUpperCase()} BB: ${bb.low.toFixed(2)}-${bb.high.toFixed(2)}`
  ).join('; ') || 'None detected';

  // Price action patterns
  const patternSummary = smcData.priceActionPatterns.slice(-5).map(p =>
    `${p.type} @ ${p.price.toFixed(2)}`
  ).join('; ') || 'None';

  // S/R
  const srSummary = smcData.supportResistance.slice(0, 5).map(l =>
    `${l.type} @ ${l.price.toFixed(2)} (${l.strength})`
  ).join('; ') || 'None detected';

  return `SYMBOL: ${symbol} | EXCHANGE: ${exchange} | TIMEFRAME: ${interval}
CURRENT PRICE: ${latestClose.toFixed(2)}
DATE/TIME: ${dateStr}
KILL ZONE: ${smcData.killZone ?? 'None'}
CONFLUENCE SCORE: ${confluenceScore}/100

--- OHLCV SUMMARY (last 50 candles) ---
${candleRows}

--- INDICATOR VALUES ---
RSI(14): ${n(indicators.rsi)} | ${indicators.rsiLabel}
MACD: Line=${n(indicators.macdLine, 4)}, Signal=${n(indicators.macdSignal, 4)}, Histogram=${n(indicators.macdHistogram, 4)}
EMA20: ${n(indicators.ema20)} | EMA50: ${n(indicators.ema50)} | Price vs EMAs: ${emaStatus}
BB: Upper=${n(indicators.bbUpper)}, Middle=${n(indicators.bbMiddle)}, Lower=${n(indicators.bbLower)}
ATR(14): ${n(indicators.atr)}
Stochastic(14,3): %K=${n(indicators.stochK)} %D=${n(indicators.stochD)} | ${indicators.stochLabel}
VWAP: ${n(indicators.vwap)} | Price is ${indicators.vwapRelation} VWAP
Volume: Current=${indicators.currentVolume ?? 'N/A'} | 20-SMA=${n(indicators.volumeSma20)} | Relative=${n(indicators.relativeVolume, 2)}x | ${indicators.volumeLabel}

--- SMC/ICT STRUCTURES DETECTED ---
Trend: ${smcData.currentTrend}
Order Blocks: ${obSummary}
Breaker Blocks: ${bbSummary}
Fair Value Gaps: ${fvgSummary}
Structure Breaks: ${sbSummary}
Liquidity Levels: ${liqSummary}
Premium/Discount 50% level: ${n(smcData.premiumDiscountLevel)}

--- PRICE ACTION PATTERNS (last 10 candles) ---
${patternSummary}

--- SUPPORT/RESISTANCE ---
${srSummary}

Respond with ONLY this exact JSON schema (no markdown, no extra text):
{
  "bias": "bullish|bearish|neutral",
  "confidence": 1,
  "marketStructure": {
    "trend": "",
    "structureDescription": "",
    "keyObservations": ["", "", ""]
  },
  "smcContext": {
    "activeOrderBlock": { "direction": "bullish|bearish", "range": "price-price", "note": "" },
    "nearestFVG": { "direction": "bullish|bearish", "range": "price-price" },
    "liquidityTargets": [""],
    "premiumDiscount": "premium|discount|equilibrium"
  },
  "ictSetup": {
    "killZone": "asia|london|ny|none",
    "setupType": "",
    "setupValid": true
  },
  "keyLevels": {
    "strongSupport": null,
    "strongResistance": null,
    "immediateSupport": null,
    "immediateResistance": null
  },
  "tradeSetup": {
    "direction": "long|short|wait",
    "entryZone": null,
    "stopLoss": null,
    "targets": [],
    "riskRewardRatio": null,
    "invalidationLevel": null
  },
  "summary": ""
}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert technical analyst specializing in SMC (Smart Money Concepts) and ICT (Inner Circle Trader) methodology. Analyze the provided chart data and return ONLY a valid JSON object matching the specified schema. Do not include any text outside the JSON.`;

function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY);
}

function getModel(): string {
  return localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL) ?? 'claude-sonnet-4-6';
}

/** Extract the first complete JSON object from a string (handles extra text/markdown). */
function extractJSON(text: string): string {
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1);
  }
  return text.trim();
}

/** Fetch with retry on 429 / 5xx — max 2 retries, 1 s delay per attempt. */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastResponse!: Response;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
    lastResponse = await fetch(url, options);
    const { status } = lastResponse;
    if (status !== 429 && status < 500) break;
  }
  return lastResponse;
}

// ────────────────────────────────────────────────────────────────────────────
// Streaming types
// ────────────────────────────────────────────────────────────────────────────

export interface StreamingCallbacks {
  onToken: (text: string) => void;
  onComplete: (result: AIAnalysisResponse) => void;
  onError: (error: string) => void;
  onProgress?: (status: string) => void;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  question: string;
  conversationHistory: ChatMessage[];
  analysisContext: {
    originalAnalysis: AIAnalysisResult;
    symbol: string;
    exchange: string;
    interval: string;
    confluenceScore: number;
    currentPrice: number;
  };
  smcData: SMCAnalysisResult;
}

// ────────────────────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────────────────────

export async function runAIAnalysis(
  request: AIAnalysisRequest,
  onProgress?: (status: string) => void
): Promise<AIAnalysisResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    const smcData = runFullSMCAnalysis(request.candles);
    return { result: null, error: 'NO_API_KEY', smcData, confluenceScore: 0 };
  }

  // Run local detection first (sync, fast)
  onProgress?.('Running SMC detection...');
  const smcData = runFullSMCAnalysis(request.candles, (request.smcOptions ?? {}) as any);

  // Build indicator snapshot
  const indicators = buildIndicatorSnapshot(request.candles);

  // Compute confluence score locally
  const confluenceScore = calculateConfluenceScore(smcData, indicators, request.candles);

  // Build prompt
  const userPrompt = buildPrompt(request, smcData, indicators, confluenceScore);

  onProgress?.('Consulting Claude AI...');

  try {
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorMap: Record<number, string> = {
        401: 'Invalid Claude API key. Check Settings > AI Analysis.',
        429: 'Rate limit reached. Wait a moment and try again.',
        500: 'Claude API server error. Try again.',
      };
      const msg = errorMap[response.status] ?? `Claude API error (${response.status}). Try again.`;
      return { result: null, error: msg, smcData, confluenceScore };
    }

    const data = await response.json();
    const rawText: string = data?.content?.[0]?.text ?? '';

    // Robust JSON extraction: find first { to last } regardless of surrounding text
    const cleaned = extractJSON(rawText);

    const parsed: AIAnalysisResult = JSON.parse(cleaned);
    return { result: parsed, error: null, smcData, confluenceScore };

  } catch (err: any) {
    const isParseError = err instanceof SyntaxError;
    const msg = isParseError
      ? 'AI returned an unexpected response. Try again.'
      : `Network error: ${err?.message ?? 'Unknown error'}`;
    return { result: null, error: msg, smcData, confluenceScore };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Streaming analysis
// ────────────────────────────────────────────────────────────────────────────

/** Read Anthropic SSE stream and call onToken for each text delta. Returns accumulated text. */
async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onToken: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const dataLine = event.split('\n').find(l => l.startsWith('data: '));
        if (!dataLine) continue;
        const json = dataLine.slice(6).trim();
        if (json === '[DONE]') continue;
        try {
          const parsed = JSON.parse(json);
          if (
            parsed.type === 'content_block_delta' &&
            parsed.delta?.type === 'text_delta'
          ) {
            const token: string = parsed.delta.text;
            accumulatedText += token;
            onToken(token);
          }
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return accumulatedText;
}

export async function runAIAnalysisStream(
  request: AIAnalysisRequest,
  callbacks: StreamingCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    callbacks.onError('NO_API_KEY');
    return;
  }

  callbacks.onProgress?.('Running SMC detection...');
  const smcData = runFullSMCAnalysis(request.candles, (request.smcOptions ?? {}) as any);
  const indicators = buildIndicatorSnapshot(request.candles);
  const confluenceScore = calculateConfluenceScore(smcData, indicators, request.candles);
  const userPrompt = buildPrompt(request, smcData, indicators, confluenceScore);

  callbacks.onProgress?.('Consulting Claude AI...');

  const errorMap: Record<number, string> = {
    401: 'Invalid Claude API key. Check Settings > AI Analysis.',
    429: 'Rate limit reached. Wait a moment and try again.',
    500: 'Claude API server error. Try again.',
  };

  let attempt = 0;
  while (attempt <= 1) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: getModel(),
          max_tokens: 2048,
          stream: true,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal,
      });

      if (!response.ok) {
        const msg = errorMap[response.status] ?? `Claude API error (${response.status}). Try again.`;
        callbacks.onError(msg);
        return;
      }

      if (!response.body) {
        callbacks.onError('No response body from Claude API.');
        return;
      }

      const accumulatedText = await readSSEStream(response.body, callbacks.onToken, signal);

      if (signal?.aborted) return;

      try {
        const cleaned = extractJSON(accumulatedText);
        const parsed: AIAnalysisResult = JSON.parse(cleaned);
        callbacks.onComplete({ result: parsed, error: null, smcData, confluenceScore });
      } catch {
        callbacks.onError('AI returned an unexpected response. Try again.');
      }
      return;

    } catch (err: any) {
      if (signal?.aborted) return;
      if (attempt === 0) {
        attempt++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      callbacks.onError(`Network error: ${err?.message ?? 'Unknown error'}`);
      return;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// AI Chat follow-up
// ────────────────────────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `You are an expert technical analyst specializing in SMC (Smart Money Concepts) and ICT (Inner Circle Trader) methodology. Answer the trader's follow-up question concisely using the provided analysis context. Be specific, reference key levels and structures. Keep answers to 2-4 sentences unless a detailed breakdown is requested.`;

export async function runAIChat(
  request: ChatRequest,
  callbacks: StreamingCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    callbacks.onError('NO_API_KEY');
    return;
  }

  const { analysisContext, smcData, conversationHistory, question } = request;
  const { originalAnalysis, symbol, exchange, interval, confluenceScore, currentPrice } = analysisContext;

  // Build compact context message
  const obSummary = smcData.orderBlocks.slice(0, 3).map(ob =>
    `${ob.type.toUpperCase()} OB: ${ob.low.toFixed(2)}-${ob.high.toFixed(2)}`
  ).join('; ') || 'None';
  const fvgSummary = smcData.fairValueGaps.slice(0, 3).map(fvg =>
    `${fvg.type.toUpperCase()} FVG: ${fvg.low.toFixed(2)}-${fvg.top.toFixed(2)}`
  ).join('; ') || 'None';

  const contextMessage = `CURRENT CONTEXT:
Symbol: ${symbol} | Exchange: ${exchange} | Interval: ${interval}
Current Price: ${currentPrice.toFixed(2)}
Confluence Score: ${confluenceScore}/100
Previous Analysis Bias: ${originalAnalysis.bias} (confidence: ${originalAnalysis.confidence}/10)
Trade Setup: ${originalAnalysis.tradeSetup.direction} | Entry: ${originalAnalysis.tradeSetup.entryZone ?? 'N/A'}
Stop Loss: ${originalAnalysis.tradeSetup.stopLoss ?? 'N/A'} | Targets: ${(originalAnalysis.tradeSetup.targets ?? []).join(', ') || 'N/A'}
Summary: ${originalAnalysis.summary}

Active SMC Structures:
Order Blocks: ${obSummary}
Fair Value Gaps: ${fvgSummary}`;

  // Build messages array: context first, then history, then new question
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: contextMessage },
    { role: 'assistant', content: 'Understood. I have the full context. What would you like to know?' },
    ...conversationHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: 1024,
        stream: true,
        system: CHAT_SYSTEM_PROMPT,
        messages,
      }),
      signal,
    });

    if (!response.ok) {
      const errorMap: Record<number, string> = {
        401: 'Invalid Claude API key.',
        429: 'Rate limit reached. Wait a moment.',
        500: 'Claude API server error.',
      };
      callbacks.onError(errorMap[response.status] ?? `API error (${response.status}).`);
      return;
    }

    if (!response.body) {
      callbacks.onError('No response body.');
      return;
    }

    await readSSEStream(response.body, callbacks.onToken, signal);
    if (signal?.aborted) return;
    // result is null for chat — caller reads accumulated text from their own ref
    callbacks.onComplete({ result: null, error: null, smcData, confluenceScore });

  } catch (err: any) {
    if (signal?.aborted) return;
    callbacks.onError(`Network error: ${err?.message ?? 'Unknown error'}`);
  }
}
