/**
 * RSI Divergence Detector
 * Detects bullish and bearish divergences between price and RSI
 */

import { OHLCData, TimeValuePoint } from './types';
import { calculateRSI } from './rsi';

export type DivergenceType = 'bullish_regular' | 'bearish_regular';

export interface Divergence {
  time1: number;
  price1: number;
  rsi1: number;
  time2: number;
  price2: number;
  rsi2: number;
  type: DivergenceType;
}

/**
 * Find swing lows — candles where close is lowest over lookback bars each side
 */
function findSwingLows(data: OHLCData[], lookback: number): number[] {
  const indices: number[] = [];
  for (let i = lookback; i < data.length - lookback; i++) {
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j].low <= data[i].low) {
        isLow = false;
        break;
      }
    }
    if (isLow) indices.push(i);
  }
  return indices;
}

/**
 * Find swing highs — candles where high is highest over lookback bars each side
 */
function findSwingHighs(data: OHLCData[], lookback: number): number[] {
  const indices: number[] = [];
  for (let i = lookback; i < data.length - lookback; i++) {
    let isHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j].high >= data[i].high) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) indices.push(i);
  }
  return indices;
}

/**
 * Detect RSI divergences between price and RSI
 * @param data - OHLC candle data
 * @param rsiPeriod - RSI calculation period (default: 14)
 * @param swingLookback - Bars each side for swing detection (default: 5)
 * @returns Array of divergences (up to last 5)
 */
export const detectRSIDivergences = (
  data: OHLCData[],
  rsiPeriod: number = 14,
  swingLookback: number = 5
): Divergence[] => {
  if (!Array.isArray(data) || data.length < rsiPeriod + swingLookback * 2 + 2) {
    return [];
  }

  const rsiValues: TimeValuePoint[] = calculateRSI(data, rsiPeriod);
  if (rsiValues.length === 0) return [];

  // Build a data-index → rsi-value map (rsi is offset by rsiPeriod bars)
  const rsiMap = new Map<number, number>();
  const rsiOffset = data.length - rsiValues.length;
  rsiValues.forEach((r, idx) => {
    rsiMap.set(idx + rsiOffset, r.value);
  });

  const divergences: Divergence[] = [];
  const MIN_BARS = 5;
  const MAX_BARS = 50;

  // --- Bullish Regular: price lower low, RSI higher low ---
  const swingLows = findSwingLows(data, swingLookback);
  for (let i = 1; i < swingLows.length; i++) {
    const idx1 = swingLows[i - 1];
    const idx2 = swingLows[i];
    const barDist = idx2 - idx1;
    if (barDist < MIN_BARS || barDist > MAX_BARS) continue;

    const rsi1 = rsiMap.get(idx1);
    const rsi2 = rsiMap.get(idx2);
    if (rsi1 === undefined || rsi2 === undefined) continue;

    // Price makes lower low, RSI makes higher low
    if (data[idx2].low < data[idx1].low && rsi2 > rsi1) {
      divergences.push({
        time1: data[idx1].time as number,
        price1: data[idx1].low,
        rsi1,
        time2: data[idx2].time as number,
        price2: data[idx2].low,
        rsi2,
        type: 'bullish_regular',
      });
    }
  }

  // --- Bearish Regular: price higher high, RSI lower high ---
  const swingHighs = findSwingHighs(data, swingLookback);
  for (let i = 1; i < swingHighs.length; i++) {
    const idx1 = swingHighs[i - 1];
    const idx2 = swingHighs[i];
    const barDist = idx2 - idx1;
    if (barDist < MIN_BARS || barDist > MAX_BARS) continue;

    const rsi1 = rsiMap.get(idx1);
    const rsi2 = rsiMap.get(idx2);
    if (rsi1 === undefined || rsi2 === undefined) continue;

    // Price makes higher high, RSI makes lower high
    if (data[idx2].high > data[idx1].high && rsi2 < rsi1) {
      divergences.push({
        time1: data[idx1].time as number,
        price1: data[idx1].high,
        rsi1,
        time2: data[idx2].time as number,
        price2: data[idx2].high,
        rsi2,
        type: 'bearish_regular',
      });
    }
  }

  // Sort by time2 (most recent last) and return last 5
  divergences.sort((a, b) => a.time2 - b.time2);
  return divergences.slice(-5);
};
