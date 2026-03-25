/**
 * SMC (Smart Money Concepts) & ICT Detection Service
 * Pure TypeScript — no React, no chart library dependencies.
 *
 * Detects: Swing Points, Order Blocks (with proper wick-based logic),
 * Fair Value Gaps (with minimum gap threshold), Break of Structure / ChoCH,
 * Liquidity Levels (3× wider tolerance), Price Action Patterns,
 * Support/Resistance, Kill Zones, Breaker Blocks, Impulse Candles.
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

/** A breaker block is a mitigated OB that flips polarity */
export interface BreakerBlock {
  type: 'bullish' | 'bearish';   // polarity AFTER flip
  startTime: number;
  endTime: number;
  high: number;
  low: number;
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

export interface ImpulsiveCandle {
  time: number;
  direction: 'bullish' | 'bearish';
  bodyRatio: number; // body / full range (0–1)
}

/** A liquidity sweep: price wick exceeds an EQH/EQL level but closes back on the other side */
export interface LiquiditySweep {
  time: number;
  price: number;          // the liquidity level price that was swept
  type: 'high_sweep' | 'low_sweep';
  wickExtreme: number;    // actual high (for high_sweep) or low (for low_sweep)
  recovered: boolean;     // true when close is back on originating side
  strength: 'strong' | 'weak';
}

/** User-configurable SMC detection parameters */
export interface SMCDetectionOptions {
  swingLookback: number;           // bars left/right for swing point detection (default 3)
  fvgMinGapRatio: number;          // FVG minimum gap as fraction of avg range (default 0.1 = 10%)
  liquidityTolerancePct: number;   // tolerance for grouping equal highs/lows (default 0.003 = 0.3%)
}

export const DEFAULT_SMC_OPTIONS: SMCDetectionOptions = {
  swingLookback: 3,
  fvgMinGapRatio: 0.1,
  liquidityTolerancePct: 0.003,
};

export interface SMCAnalysisResult {
  swingPoints: SwingPoint[];
  orderBlocks: OrderBlock[];
  breakerBlocks: BreakerBlock[];
  fairValueGaps: FairValueGap[];
  structureBreaks: StructureBreak[];
  liquidityLevels: LiquidityLevel[];
  liquiditySweeps: LiquiditySweep[];
  priceActionPatterns: PriceActionPattern[];
  supportResistance: SupportResistanceLevel[];
  impulsiveCandles: ImpulsiveCandle[];
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
    let isHigh = true;
    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) { isHigh = false; break; }
    }
    if (isHigh) swings.push({ type: 'high', time: candles[i].time, price: candles[i].high });

    let isLow = true;
    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue;
      if (candles[j].low <= candles[i].low) { isLow = false; break; }
    }
    if (isLow) swings.push({ type: 'low', time: candles[i].time, price: candles[i].low });
  }

  return swings.slice(-30);
}

// ────────────────────────────────────────────────────────────────────────────
// Order Blocks  (FIX: use wicks for strong-move check and mitigation)
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
    const isDown = c.close < c.open; // down candle → potential bullish OB
    const isUp   = c.close > c.open; // up candle   → potential bearish OB

    if (isDown) {
      // Strong up-move: every forward candle's LOW must be above OB's HIGH (wick-based)
      let strongUp = true;
      for (let f = 1; f <= lookForward; f++) {
        if (candles[i + f].low <= c.high) { strongUp = false; break; }
      }
      if (strongUp) {
        // Mitigation: any subsequent candle's LOW enters the OB zone
        let mitigated = false;
        for (let f = i + 1; f < len; f++) {
          if (candles[f].low < c.high && candles[f].low > c.low) {
            mitigated = true; break;
          }
        }

        const move = candles[i + lookForward].close - c.high;
        const obSize = Math.max(c.high - c.low, 1e-10);
        const strength: number = move > obSize * 3 ? 3 : move > obSize ? 2 : 1;

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
      // Strong down-move: every forward candle's HIGH must be below OB's LOW
      let strongDown = true;
      for (let f = 1; f <= lookForward; f++) {
        if (candles[i + f].high >= c.low) { strongDown = false; break; }
      }
      if (strongDown) {
        // Mitigation: any subsequent candle's HIGH enters the OB zone
        let mitigated = false;
        for (let f = i + 1; f < len; f++) {
          if (candles[f].high > c.low && candles[f].high < c.high) {
            mitigated = true; break;
          }
        }

        const move = c.low - candles[i + lookForward].close;
        const obSize = Math.max(c.high - c.low, 1e-10);
        const strength: number = move > obSize * 3 ? 3 : move > obSize ? 2 : 1;

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

  const bullish = obs.filter(o => o.type === 'bullish' && !o.mitigated).slice(-5);
  const bearish = obs.filter(o => o.type === 'bearish' && !o.mitigated).slice(-5);
  return [...bullish, ...bearish];
}

// ────────────────────────────────────────────────────────────────────────────
// Breaker Blocks  (mitigated OBs that flip polarity)
// ────────────────────────────────────────────────────────────────────────────

export function detectBreakerBlocks(candles: OHLCCandle[]): BreakerBlock[] {
  const obs: OrderBlock[] = [];
  const len = candles.length;
  const lookForward = 5;

  // Re-detect ALL OBs (including mitigated ones)
  for (let i = 5; i < len - lookForward; i++) {
    const c = candles[i];
    const isDown = c.close < c.open;
    const isUp   = c.close > c.open;

    if (isDown) {
      let strongUp = true;
      for (let f = 1; f <= lookForward; f++) {
        if (candles[i + f].low <= c.high) { strongUp = false; break; }
      }
      if (strongUp) {
        let mitigated = false;
        for (let f = i + 1; f < len; f++) {
          if (candles[f].low < c.high && candles[f].low > c.low) {
            mitigated = true; break;
          }
        }
        obs.push({ type: 'bullish', startTime: c.time, endTime: candles[Math.min(i + lookForward, len - 1)].time, high: c.high, low: c.low, strength: 1, mitigated });
      }
    }
    if (isUp) {
      let strongDown = true;
      for (let f = 1; f <= lookForward; f++) {
        if (candles[i + f].high >= c.low) { strongDown = false; break; }
      }
      if (strongDown) {
        let mitigated = false;
        for (let f = i + 1; f < len; f++) {
          if (candles[f].high > c.low && candles[f].high < c.high) {
            mitigated = true; break;
          }
        }
        obs.push({ type: 'bearish', startTime: c.time, endTime: candles[Math.min(i + lookForward, len - 1)].time, high: c.high, low: c.low, strength: 1, mitigated });
      }
    }
  }

  // Mitigated bullish OB → bearish breaker; mitigated bearish OB → bullish breaker
  return obs
    .filter(o => o.mitigated)
    .slice(-6)
    .map(o => ({
      type: o.type === 'bullish' ? 'bearish' : 'bullish' as 'bullish' | 'bearish',
      startTime: o.startTime,
      endTime: o.endTime,
      high: o.high,
      low: o.low,
    }));
}

// ────────────────────────────────────────────────────────────────────────────
// Fair Value Gaps  (FIX: minimum gap threshold relative to avg candle range)
// ────────────────────────────────────────────────────────────────────────────

export function detectFairValueGaps(
  candles: OHLCCandle[],
  minGapRatio = 0.1       // fraction of avg range (0.1 = 10%)
): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  const len = candles.length;

  // Compute average candle range for noise filter (last 14 candles)
  const lookback = Math.min(14, len);
  let avgRange = 0;
  for (let k = len - lookback; k < len; k++) avgRange += (candles[k].high - candles[k].low);
  avgRange = avgRange / lookback;
  const minGapSize = avgRange * minGapRatio;

  for (let i = 1; i < len - 1; i++) {
    const prev = candles[i - 1];
    const mid  = candles[i];
    const next = candles[i + 1];

    // Bullish FVG: next candle low > prev candle high
    if (next.low > prev.high && (next.low - prev.high) >= minGapSize) {
      let filled = false;
      for (let f = i + 2; f < len; f++) {
        if (candles[f].low <= next.low && candles[f].high >= prev.high) {
          filled = true; break;
        }
      }
      fvgs.push({ type: 'bullish', time: mid.time, top: next.low, low: prev.high, filled });
    }

    // Bearish FVG: next candle high < prev candle low
    if (next.high < prev.low && (prev.low - next.high) >= minGapSize) {
      let filled = false;
      for (let f = i + 2; f < len; f++) {
        if (candles[f].high >= next.high && candles[f].low <= prev.low) {
          filled = true; break;
        }
      }
      fvgs.push({ type: 'bearish', time: mid.time, top: prev.low, low: next.high, filled });
    }
  }

  return fvgs.filter(g => !g.filled).slice(-10);
}

// ────────────────────────────────────────────────────────────────────────────
// Structure Breaks (BOS / ChoCH)
// BOS  = structure break in the SAME direction as the prevailing trend
// ChoCH = structure break that REVERSES the prevailing trend
// ────────────────────────────────────────────────────────────────────────────

export function detectStructureBreaks(
  candles: OHLCCandle[],
  swings: SwingPoint[]
): StructureBreak[] {
  const breaks: StructureBreak[] = [];
  if (swings.length < 4) return breaks;

  const highs = swings.filter(s => s.type === 'high').sort((a, b) => a.time - b.time);
  const lows  = swings.filter(s => s.type === 'low').sort((a, b) => a.time - b.time);

  // Bullish structure break: current swing high > previous swing high
  for (let i = 1; i < highs.length; i++) {
    const prevHigh    = highs[i - 1];
    const currentHigh = highs[i];
    if (currentHigh.price > prevHigh.price) {
      // ChoCH if prior lows were making LOWER lows (bearish trend being reversed)
      const priorLows = lows.filter(l => l.time < prevHigh.time);
      const wasDowntrend = priorLows.length >= 2 &&
        priorLows[priorLows.length - 1].price < priorLows[priorLows.length - 2].price;
      // ChoCH = bullish break after bearish structure (reversal)
      // BOS   = bullish break continuing an established bullish structure
      breaks.push({
        type: wasDowntrend ? 'ChoCH' : 'BOS',
        direction: 'bullish',
        time: currentHigh.time,
        level: prevHigh.price,
        prevSwingTime: prevHigh.time,
      });
    }
  }

  // Bearish structure break: current swing low < previous swing low
  for (let i = 1; i < lows.length; i++) {
    const prevLow    = lows[i - 1];
    const currentLow = lows[i];
    if (currentLow.price < prevLow.price) {
      const priorHighs = highs.filter(h => h.time < prevLow.time);
      const wasUptrend = priorHighs.length >= 2 &&
        priorHighs[priorHighs.length - 1].price > priorHighs[priorHighs.length - 2].price;
      // ChoCH = bearish break after bullish structure (reversal)
      breaks.push({
        type: wasUptrend ? 'ChoCH' : 'BOS',
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
// Liquidity Levels  (FIX: tolerance increased to 0.003 = 0.3%)
// ────────────────────────────────────────────────────────────────────────────

export function detectLiquidityLevels(
  candles: OHLCCandle[],
  tolerance = 0.003   // was 0.001 — 3× wider to catch more equal highs/lows
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
      const maxHigh = Math.max(...group.map(idx => candles[idx].high));
      const lastIdx = Math.max(...group);
      const lastGroupTime = candles[lastIdx].time;
      const swept = candles.some(c => c.time > lastGroupTime && c.close > maxHigh);
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
      const lastIdx = Math.max(...group);
      const lastGroupTime = candles[lastIdx].time;
      const swept = candles.some(c => c.time > lastGroupTime && c.close < minLow);
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
// Liquidity Sweeps  (wick exceeds EQH/EQL level but close recovers)
// ────────────────────────────────────────────────────────────────────────────

export function detectLiquiditySweeps(
  candles: OHLCCandle[],
  liquidityLevels?: LiquidityLevel[],
  tolerance = 0.003
): LiquiditySweep[] {
  const levels = liquidityLevels ?? detectLiquidityLevels(candles, tolerance);
  const sweeps: LiquiditySweep[] = [];

  for (const level of levels) {
    if (level.times.length === 0) continue;
    const lastLevelTime = Math.max(...level.times);

    // Only check candles after the last touch of this level
    for (const c of candles) {
      if (c.time <= lastLevelTime) continue;

      if (level.type === 'equal_highs') {
        // High sweep: wick exceeds EQH but close is back below
        if (c.high > level.price && c.close < level.price) {
          sweeps.push({
            time: c.time,
            price: level.price,
            type: 'high_sweep',
            wickExtreme: c.high,
            recovered: true,
            strength: c.close < level.price * (1 - tolerance) ? 'strong' : 'weak',
          });
          break; // one sweep per level
        }
      } else {
        // Low sweep: wick drops below EQL but close is back above
        if (c.low < level.price && c.close > level.price) {
          sweeps.push({
            time: c.time,
            price: level.price,
            type: 'low_sweep',
            wickExtreme: c.low,
            recovered: true,
            strength: c.close > level.price * (1 + tolerance) ? 'strong' : 'weak',
          });
          break;
        }
      }
    }
  }

  return sweeps.sort((a, b) => a.time - b.time).slice(-10);
}

// ────────────────────────────────────────────────────────────────────────────
// Price Action Patterns
// ────────────────────────────────────────────────────────────────────────────

export function detectPriceActionPatterns(candles: OHLCCandle[]): PriceActionPattern[] {
  const patterns: PriceActionPattern[] = [];
  const slice = candles.slice(-50);

  for (let i = 1; i < slice.length; i++) {
    const c = slice[i];
    const p = slice[i - 1];

    const body   = Math.abs(c.close - c.open);
    const range  = c.high - c.low;
    if (range === 0) continue;

    const upperSh = c.high - Math.max(c.open, c.close);
    const lowerSh = Math.min(c.open, c.close) - c.low;

    // Doji
    if (body / range < 0.1) {
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

    // Hammer
    if (lowerSh > body * 2 && upperSh < body * 0.5 && c.close > c.open) {
      patterns.push({ type: 'hammer', time: c.time, price: c.close, significance: 'medium' });
      continue;
    }

    // Shooting Star
    if (upperSh > body * 2 && lowerSh < body * 0.5 && c.close < c.open) {
      patterns.push({ type: 'shooting_star', time: c.time, price: c.close, significance: 'medium' });
      continue;
    }

    // Pin Bar Bullish (long lower wick)
    if (lowerSh > (body + upperSh) * 2) {
      patterns.push({ type: 'pin_bar_bull', time: c.time, price: c.close, significance: 'medium' });
      continue;
    }

    // Pin Bar Bearish (long upper wick)
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
// Impulse Candles (large directional candles — market maker moves)
// ────────────────────────────────────────────────────────────────────────────

export function detectImpulsiveCandles(candles: OHLCCandle[]): ImpulsiveCandle[] {
  const result: ImpulsiveCandle[] = [];
  const slice = candles.slice(-100);
  if (slice.length < 20) return result;

  // Compute average body size over the lookback
  const avgBody = slice.slice(0, -1).reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / (slice.length - 1);

  for (const c of slice) {
    const body  = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range === 0) continue;

    const bodyRatio = body / range;
    // Impulse: body ≥70% of range AND body ≥1.5× avg body
    if (bodyRatio >= 0.7 && body >= avgBody * 1.5) {
      result.push({
        time: c.time,
        direction: c.close >= c.open ? 'bullish' : 'bearish',
        bodyRatio,
      });
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Support / Resistance
// ────────────────────────────────────────────────────────────────────────────

export function detectSupportResistance(candles: OHLCCandle[]): SupportResistanceLevel[] {
  const levels: SupportResistanceLevel[] = [];
  const tolerance = 0.003;

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
// Kill Zone  (FIX: corrected ICT kill zone windows in IST, plug timing gaps)
// Asia    = 09:00–11:00 IST  (Tokyo/India open)
// London  = 13:30–17:30 IST  (London 08:00–12:00 UTC)
// NY AM   = 19:00–21:00 IST  (NY 09:30–11:30 EST)
// ────────────────────────────────────────────────────────────────────────────

export function getCurrentKillZone(
  timestampSeconds: number
): 'asia' | 'london' | 'ny' | null {
  const date = new Date(timestampSeconds * 1000);
  // Convert to IST: UTC + 5h30m
  const istMs = date.getTime() + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  const totalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();

  if (totalMinutes >= 540  && totalMinutes < 660)  return 'asia';    // 09:00–11:00 IST
  if (totalMinutes >= 810  && totalMinutes < 1050)  return 'london';  // 13:30–17:30 IST
  if (totalMinutes >= 1140 && totalMinutes < 1260)  return 'ny';      // 19:00–21:00 IST
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Full SMC Analysis Orchestrator
// ────────────────────────────────────────────────────────────────────────────

export function runFullSMCAnalysis(
  candles: OHLCCandle[],
  options: Partial<SMCDetectionOptions> = {}
): SMCAnalysisResult {
  const opts: SMCDetectionOptions = { ...DEFAULT_SMC_OPTIONS, ...options };

  const swingPoints       = detectSwingPoints(candles, opts.swingLookback, opts.swingLookback);
  const orderBlocks       = detectOrderBlocks(candles, swingPoints);
  const breakerBlocks     = detectBreakerBlocks(candles);
  const fairValueGaps     = detectFairValueGaps(candles, opts.fvgMinGapRatio);
  const structureBreaks   = detectStructureBreaks(candles, swingPoints);
  const liquidityLevels   = detectLiquidityLevels(candles, opts.liquidityTolerancePct);
  const liquiditySweeps   = detectLiquiditySweeps(candles, liquidityLevels, opts.liquidityTolerancePct);
  const priceActionPatterns = detectPriceActionPatterns(candles);
  const supportResistance = detectSupportResistance(candles);
  const impulsiveCandles  = detectImpulsiveCandles(candles);

  // Trend from last 2 confirmed structure breaks
  let currentTrend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  if (structureBreaks.length >= 2) {
    const last = structureBreaks[structureBreaks.length - 1];
    const prev = structureBreaks[structureBreaks.length - 2];
    if (last.direction === 'bullish' && prev.direction === 'bullish')   currentTrend = 'bullish';
    else if (last.direction === 'bearish' && prev.direction === 'bearish') currentTrend = 'bearish';
  } else if (structureBreaks.length === 1) {
    currentTrend = structureBreaks[0].direction;
  }

  // Premium/Discount midpoint
  const swingHighs = swingPoints.filter(s => s.type === 'high');
  const swingLows  = swingPoints.filter(s => s.type === 'low');
  let premiumDiscountLevel = 0;
  if (swingHighs.length > 0 && swingLows.length > 0) {
    const lastHigh = swingHighs[swingHighs.length - 1].price;
    const lastLow  = swingLows[swingLows.length - 1].price;
    premiumDiscountLevel = (lastHigh + lastLow) / 2;
  }

  const lastCandle = candles[candles.length - 1];
  const killZone = lastCandle ? getCurrentKillZone(lastCandle.time) : null;

  return {
    swingPoints,
    orderBlocks,
    breakerBlocks,
    fairValueGaps,
    structureBreaks,
    liquidityLevels,
    liquiditySweeps,
    priceActionPatterns,
    supportResistance,
    impulsiveCandles,
    currentTrend,
    premiumDiscountLevel,
    killZone,
  };
}
