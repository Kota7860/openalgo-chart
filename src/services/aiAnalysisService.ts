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

  // Last 20 candles table
  const last20 = candles.slice(-20);
  const candleRows = last20.map(c =>
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

--- OHLCV SUMMARY (last 20 candles) ---
${candleRows}

--- INDICATOR VALUES ---
RSI(14): ${n(indicators.rsi)} | ${indicators.rsiLabel}
MACD: Line=${n(indicators.macdLine, 4)}, Signal=${n(indicators.macdSignal, 4)}, Histogram=${n(indicators.macdHistogram, 4)}
EMA20: ${n(indicators.ema20)} | EMA50: ${n(indicators.ema50)} | Price vs EMAs: ${emaStatus}
BB: Upper=${n(indicators.bbUpper)}, Middle=${n(indicators.bbMiddle)}, Lower=${n(indicators.bbLower)}
ATR(14): ${n(indicators.atr)}

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
        max_tokens: 1024,
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
