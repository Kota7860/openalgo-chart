/**
 * SMC (Smart Money Concepts) & ICT Detection Service
 * Pure TypeScript — no React, no chart library dependencies.
 * Detects: Swing Points, Order Blocks, Fair Value Gaps, Break of Structure / ChoCH,
 * Liquidity Levels, Price Action Patterns, Support/Resistance, Kill Zones.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface OHLCCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SwingPoint {
  type: 'high' | 'low';
  time: number;
  price: number;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  startTime: number;
  endTime: number;
  high: number;
  low: number;
  strength: number; // 1–3
  mitigated: boolean;
}

export interface FairValueGap {
  type: 'bullish' | 'bearish';
  time: number; // middle candle's time
  top: number;
  low: number;
  filled: boolean;
}

export interface StructureBreak {
  type: 'BOS' | 'ChoCH';
  direction: 'bullish' | 'bearish';
  time: number;
  level: number;
  prevSwingTime: number;
}

export interface LiquidityLevel {
  type: 'equal_highs' | 'equal_lows';
  price: number;
  touchCount: number;
  times: number[];
}

export interface PriceActionPattern {
  type:
    | 'bullish_engulfing'
    | 'bearish_engulfing'
    | 'doji'
    | 'hammer'
    | 'shooting_star'
    | 'pin_bar_bull'
    | 'pin_bar_bear'
    | 'inside_bar';
  time: number;
  price: number;
  significance: 'high' | 'medium' | 'low';
}

export interface SupportResistanceLevel {
  price: number;
  type: 'support' | 'resistance';
  touchCount: number;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface SMCAnalysisResult {
  swingPoints: SwingPoint[];
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  structureBreaks: StructureBreak[];
  liquidityLevels: LiquidityLevel[];
  priceActionPatterns: PriceActionPattern[];
  supportResistance: SupportResistanceLevel[];
  currentTrend: 'bullish' | 'bearish' | 'ranging';
  premiumDiscountLevel: number;
  killZone: 'asia' | 'london' | 'ny' | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Swing Points
// ────────────────────────────────────────────────────────────────────────────

export function detectSwingPoints(
  candles: OHLCCandle[],
  leftBars = 3,
  rightBars = 3
): SwingPoint[] {
  const swings: SwingPoint[] = [];
  const len = candles.length;

  for (let i = leftBars; i < len - rightBars; i++) {
    // Check swing high
    let isHigh = true;
    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) { isHigh = false; break; }
    }
    if (isHigh) {
      swings.push({ type: 'high', time: candles[i].time, price: candles[i].high });
    }

    // Check swing low
    let isLow = true;
    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue;
      if (candles[j].low <= candles[i].low) { isLow = false; break; }
    }
    if (isLow) {
      swings.push({ type: 'low', time: candles[i].time, price: candles[i].low });
    }
  }

  // Return last 30 swings
  return swings.slice(-30);
}

// ────────────────────────────────────────────────────────────────────────────
// Order Blocks
// ────────────────────────────────────────────────────────────────────────────

export function detectOrderBlocks(
  candles: OHLCCandle[],
  swings: SwingPoint[]
): OrderBlock[] {
  const obs: OrderBlock[] = [];
  const len = candles.length;
  const lookForward = 5;

  for (let i = 5; i < len - lookForward; i++) {
    const c = candles[i];
    const isDown = c.close < c.open; // bearish candle = potential bullish OB
    const isUp   = c.close > c.open; // bullish candle = potential bearish OB

    if (isDown) {
      // Check if next N candles all move strongly up
      let strongUp = true;
      for (let f = 1; f <= lookForward; f++) {
        if (candles[i + f].close <= c.high) { strongUp = false; break; }
      }
      if (strongUp) {
        // Check if price has revisited (mitigated)
        let mitigated = false;
        for (let f = i + 1; f < len; f++) {
          if (candles[f].close < c.high && candles[f].close > c.low) {
            mitigated = true; break;
          }
        }

        // Strength by how far price moved vs OB size
        const move = candles[i + lookForward].close - c.high;
        const obSize = c.high - c.low;
        const strength = move > obSize * 3 ? 3 : move > obSize ? 2 : 1;

        obs.push({
          type: 'bullish',
          startTime: c.time,
          endTime: candles[Math.min(i + lookForward, len - 1)].time,
          high: c.high,
          low: c.low,
          strength,
          mitigated,
        });
      }
    }

    if (isUp) {
      let strongDown = true;
      for (let f = 1; f <= lookForward; f++) {
        if (candles[i + f].close >= c.low) { strongDown = false; break; }
      }
      if (strongDown) {
        let mitigated = false;
        for (let f = i + 1; f < len; f++) {
          if (candles[f].close > c.low && candles[f].close < c.high) {
            mitigated = true; break;
          }
        }

        const move = c.low - candles[i + lookForward].close;
        const obSize = c.high - c.low;
        const strength = move > obSize * 3 ? 3 : move > obSize ? 2 : 1;

        obs.push({
          type: 'bearish',
          startTime: c.time,
          endTime: candles[Math.min(i + lookForward, len - 1)].time,
          high: c.high,
          low: c.low,
          strength,
          mitigated,
        });
      }
    }
  }

  // Return last 5 unmitigated OBs per direction
  const bullish = obs.filter(o => o.type === 'bullish' && !o.mitigated).slice(-5);
  const bearish = obs.filter(o => o.type === 'bearish' && !o.mitigated).slice(-5);
  return [...bullish, ...bearish];
}

// ────────────────────────────────────────────────────────────────────────────
// Fair Value Gaps
// ────────────────────────────────────────────────────────────────────────────

export function detectFairValueGaps(candles: OHLCCandle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  const len = candles.length;

  for (let i = 1; i < len - 1; i++) {
    const prev = candles[i - 1];
    const mid  = candles[i];
    const next = candles[i + 1];

    // Bullish FVG: next candle low > prev candle high
    if (next.low > prev.high) {
      let filled = false;
      for (let f = i + 2; f < len; f++) {
        if (candles[f].low <= next.low && candles[f].high >= prev.high) {
          filled = true; break;
        }
      }
      fvgs.push({ type: 'bullish', time: mid.time, top: next.low, low: prev.high, filled });
    }

    // Bearish FVG: next candle high < prev candle low
    if (next.high < prev.low) {
      let filled = false;
      for (let f = i + 2; f < len; f++) {
        if (candles[f].high >= next.high && candles[f].low <= prev.low) {
          filled = true; break;
        }
      }
      fvgs.push({ type: 'bearish', time: mid.time, top: prev.low, low: next.high, filled });
    }
  }

  // Return last 10 unfilled FVGs
  return fvgs.filter(g => !g.filled).slice(-10);
}

// ────────────────────────────────────────────────────────────────────────────
// Structure Breaks (BOS / ChoCH)
// ────────────────────────────────────────────────────────────────────────────

export function detectStructureBreaks(
  candles: OHLCCandle[],
  swings: SwingPoint[]
): StructureBreak[] {
  const breaks: StructureBreak[] = [];
  if (swings.length < 4) return breaks;

  // Build alternating swing sequence
  const highs = swings.filter(s => s.type === 'high').sort((a, b) => a.time - b.time);
  const lows  = swings.filter(s => s.type === 'low').sort((a, b) => a.time - b.time);

  // Detect bullish BOS: close breaks above last confirmed swing high
  for (let i = 1; i < highs.length; i++) {
    const prevHigh = highs[i - 1];
    const currentHigh = highs[i];
    if (currentHigh.price > prevHigh.price) {
      // Determine BOS vs ChoCH based on prior structure
      const priorLows = lows.filter(l => l.time < prevHigh.time);
      const type = priorLows.length >= 2
        && priorLows[priorLows.length - 1].price < priorLows[priorLows.length - 2].price
        ? 'ChoCH' : 'BOS';

      breaks.push({
        type,
        direction: 'bullish',
        time: currentHigh.time,
        level: prevHigh.price,
        prevSwingTime: prevHigh.time,
      });
    }
  }

  // Detect bearish BOS: close breaks below last confirmed swing low
  for (let i = 1; i < lows.length; i++) {
    const prevLow = lows[i - 1];
    const currentLow = lows[i];
    if (currentLow.price < prevLow.price) {
      const priorHighs = highs.filter(h => h.time < prevLow.time);
      const type = priorHighs.length >= 2
        && priorHighs[priorHighs.length - 1].price > priorHighs[priorHighs.length - 2].price
        ? 'ChoCH' : 'BOS';

      breaks.push({
        type,
        direction: 'bearish',
        time: currentLow.time,
        level: prevLow.price,
        prevSwingTime: prevLow.time,
      });
    }
  }

  return breaks.sort((a, b) => a.time - b.time).slice(-5);
}

// ────────────────────────────────────────────────────────────────────────────
// Liquidity Levels (Equal Highs / Equal Lows)
// ────────────────────────────────────────────────────────────────────────────

export function detectLiquidityLevels(
  candles: OHLCCandle[],
  tolerance = 0.001
): LiquidityLevel[] {
  const levels: LiquidityLevel[] = [];

  // Group highs
  const processedHighs = new Set<number>();
  for (let i = 0; i < candles.length; i++) {
    if (processedHighs.has(i)) continue;
    const group: number[] = [i];
    const basePrice = candles[i].high;
    for (let j = i + 1; j < candles.length; j++) {
      if (Math.abs(candles[j].high - basePrice) / basePrice <= tolerance) {
        group.push(j);
        processedHighs.add(j);
      }
    }
    if (group.length >= 2) {
      // Check if swept (any close above max high in group)
      const maxHigh = Math.max(...group.map(idx => candles[idx].high));
      const lastGroupTime = candles[Math.max(...group)].time;
      const swept = candles.some(
        c => c.time > lastGroupTime && c.close > maxHigh
      );
      if (!swept) {
        levels.push({
          type: 'equal_highs',
          price: basePrice,
          touchCount: group.length,
          times: group.map(idx => candles[idx].time),
        });
      }
    }
  }

  // Group lows
  const processedLows = new Set<number>();
  for (let i = 0; i < candles.length; i++) {
    if (processedLows.has(i)) continue;
    const group: number[] = [i];
    const basePrice = candles[i].low;
    for (let j = i + 1; j < candles.length; j++) {
      if (Math.abs(candles[j].low - basePrice) / basePrice <= tolerance) {
        group.push(j);
        processedLows.add(j);
      }
    }
    if (group.length >= 2) {
      const minLow = Math.min(...group.map(idx => candles[idx].low));
      const lastGroupTime = candles[Math.max(...group)].time;
      const swept = candles.some(
        c => c.time > lastGroupTime && c.close < minLow
      );
      if (!swept) {
        levels.push({
          type: 'equal_lows',
          price: basePrice,
          touchCount: group.length,
          times: group.map(idx => candles[idx].time),
        });
      }
    }
  }

  return levels;
}

// ────────────────────────────────────────────────────────────────────────────
// Price Action Patterns
// ────────────────────────────────────────────────────────────────────────────

export function detectPriceActionPatterns(candles: OHLCCandle[]): PriceActionPattern[] {
  const patterns: PriceActionPattern[] = [];
  const slice = candles.slice(-50); // Only check last 50

  for (let i = 1; i < slice.length; i++) {
    const c  = slice[i];
    const p  = slice[i - 1];

    const body    = Math.abs(c.close - c.open);
    const range   = c.high - c.low;
    const upperSh = c.high - Math.max(c.open, c.close);
    const lowerSh = Math.min(c.open, c.close) - c.low;
    const prevBody = Math.abs(p.close - p.open);

    // Doji
    if (range > 0 && body / range < 0.1) {
      patterns.push({ type: 'doji', time: c.time, price: c.close, significance: 'medium' });
      continue;
    }

    // Bullish Engulfing
    if (c.close > c.open && p.close < p.open && c.open < p.close && c.close > p.open) {
      patterns.push({ type: 'bullish_engulfing', time: c.time, price: c.close, significance: 'high' });
      continue;
    }

    // Bearish Engulfing
    if (c.close < c.open && p.close > p.open && c.open > p.close && c.close < p.open) {
      patterns.push({ type: 'bearish_engulfing', time: c.time, price: c.close, significance: 'high' });
      continue;
    }

    // Hammer (after downtrend signals)
    if (lowerSh > body * 2 && upperSh < body * 0.5 && c.close > c.open) {
      patterns.push({ type: 'hammer', time: c.time, price: c.close, significance: 'medium' });
      continue;
    }

    // Shooting Star
    if (upperSh > body * 2 && lowerSh < body * 0.5 && c.close < c.open) {
      patterns.push({ type: 'shooting_star', time: c.time, price: c.close, significance: 'medium' });
      continue;
    }

    // Pin Bar Bullish
    if (lowerSh > (body + upperSh) * 2) {
      patterns.push({ type: 'pin_bar_bull', time: c.time, price: c.close, significance: 'medium' });
      continue;
    }

    // Pin Bar Bearish
    if (upperSh > (body + lowerSh) * 2) {
      patterns.push({ type: 'pin_bar_bear', time: c.time, price: c.close, significance: 'medium' });
      continue;
    }

    // Inside Bar
    if (c.high < p.high && c.low > p.low) {
      patterns.push({ type: 'inside_bar', time: c.time, price: c.close, significance: 'low' });
    }
  }

  return patterns;
}

// ────────────────────────────────────────────────────────────────────────────
// Support / Resistance
// ────────────────────────────────────────────────────────────────────────────

export function detectSupportResistance(candles: OHLCCandle[]): SupportResistanceLevel[] {
  const levels: SupportResistanceLevel[] = [];
  const tolerance = 0.003;

  // Collect all pivot highs and lows
  const pivotHighs: number[] = [];
  const pivotLows: number[]  = [];

  for (let i = 2; i < candles.length - 2; i++) {
    if (
      candles[i].high > candles[i - 1].high &&
      candles[i].high > candles[i - 2].high &&
      candles[i].high > candles[i + 1].high &&
      candles[i].high > candles[i + 2].high
    ) pivotHighs.push(candles[i].high);

    if (
      candles[i].low < candles[i - 1].low &&
      candles[i].low < candles[i - 2].low &&
      candles[i].low < candles[i + 1].low &&
      candles[i].low < candles[i + 2].low
    ) pivotLows.push(candles[i].low);
  }

  // Group highs into resistance levels
  const usedHighs = new Set<number>();
  for (let i = 0; i < pivotHighs.length; i++) {
    if (usedHighs.has(i)) continue;
    const group = [pivotHighs[i]];
    for (let j = i + 1; j < pivotHighs.length; j++) {
      if (Math.abs(pivotHighs[j] - pivotHighs[i]) / pivotHighs[i] <= tolerance) {
        group.push(pivotHighs[j]);
        usedHighs.add(j);
      }
    }
    if (group.length >= 2) {
      const avg = group.reduce((a, b) => a + b, 0) / group.length;
      levels.push({
        price: avg,
        type: 'resistance',
        touchCount: group.length,
        strength: group.length >= 4 ? 'strong' : group.length >= 3 ? 'moderate' : 'weak',
      });
    }
  }

  // Group lows into support levels
  const usedLows = new Set<number>();
  for (let i = 0; i < pivotLows.length; i++) {
    if (usedLows.has(i)) continue;
    const group = [pivotLows[i]];
    for (let j = i + 1; j < pivotLows.length; j++) {
      if (Math.abs(pivotLows[j] - pivotLows[i]) / pivotLows[i] <= tolerance) {
        group.push(pivotLows[j]);
        usedLows.add(j);
      }
    }
    if (group.length >= 2) {
      const avg = group.reduce((a, b) => a + b, 0) / group.length;
      levels.push({
        price: avg,
        type: 'support',
        touchCount: group.length,
        strength: group.length >= 4 ? 'strong' : group.length >= 3 ? 'moderate' : 'weak',
      });
    }
  }

  return levels.sort((a, b) => b.touchCount - a.touchCount).slice(0, 10);
}

// ────────────────────────────────────────────────────────────────────────────
// Kill Zone (IST = UTC+5:30)
// ────────────────────────────────────────────────────────────────────────────

export function getCurrentKillZone(
  timestampSeconds: number
): 'asia' | 'london' | 'ny' | null {
  const date = new Date(timestampSeconds * 1000);
  // Convert to IST: UTC + 5h30m
  const istMs = date.getTime() + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;

  const asiaStart  = 9 * 60;        // 09:00
  const asiaEnd    = 11 * 60;       // 11:00
  const londonStart = 13 * 60 + 30; // 13:30
  const londonEnd   = 18 * 60 + 30; // 18:30
  const nyStart     = 19 * 60;      // 19:00
  const nyEnd       = 23 * 60 + 30; // 23:30

  if (totalMinutes >= asiaStart && totalMinutes < asiaEnd) return 'asia';
  if (totalMinutes >= londonStart && totalMinutes < londonEnd) return 'london';
  if (totalMinutes >= nyStart && totalMinutes < nyEnd) return 'ny';
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Full SMC Analysis Orchestrator
// ────────────────────────────────────────────────────────────────────────────

export function runFullSMCAnalysis(candles: OHLCCandle[]): SMCAnalysisResult {
  const swingPoints     = detectSwingPoints(candles);
  const orderBlocks     = detectOrderBlocks(candles, swingPoints);
  const fairValueGaps   = detectFairValueGaps(candles);
  const structureBreaks = detectStructureBreaks(candles, swingPoints);
  const liquidityLevels = detectLiquidityLevels(candles);
  const priceActionPatterns = detectPriceActionPatterns(candles);
  const supportResistance = detectSupportResistance(candles);

  // Determine trend from last 2 confirmed structure breaks
  let currentTrend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  if (structureBreaks.length >= 2) {
    const last = structureBreaks[structureBreaks.length - 1];
    const prev = structureBreaks[structureBreaks.length - 2];
    if (last.direction === 'bullish' && prev.direction === 'bullish') currentTrend = 'bullish';
    else if (last.direction === 'bearish' && prev.direction === 'bearish') currentTrend = 'bearish';
  } else if (structureBreaks.length === 1) {
    currentTrend = structureBreaks[0].direction;
  }

  // Premium/Discount midpoint from last major swing range
  const swingHighs = swingPoints.filter(s => s.type === 'high');
  const swingLows  = swingPoints.filter(s => s.type === 'low');
  let premiumDiscountLevel = 0;
  if (swingHighs.length > 0 && swingLows.length > 0) {
    const lastHigh = swingHighs[swingHighs.length - 1].price;
    const lastLow  = swingLows[swingLows.length - 1].price;
    premiumDiscountLevel = (lastHigh + lastLow) / 2;
  }

  // Current kill zone from last candle timestamp
  const lastCandle = candles[candles.length - 1];
  const killZone = lastCandle ? getCurrentKillZone(lastCandle.time) : null;

  return {
    swingPoints,
    orderBlocks,
    fairValueGaps,
    structureBreaks,
    liquidityLevels,
    priceActionPatterns,
    supportResistance,
    currentTrend,
    premiumDiscountLevel,
    killZone,
  };
}
