/**
 * Hull Moving Average (HMA)
 * A fast, low-lag moving average developed by Alan Hull.
 * HMA = WMA(2 × WMA(n/2) − WMA(n), sqrt(n))
 */

import { OHLCData, TimeValuePoint } from './types';

/**
 * Weighted Moving Average (helper used internally by HMA)
 */
function calculateWMA(values: number[], period: number): number[] {
  const result: number[] = [];
  if (values.length < period) return result;

  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let weighted = 0;
    for (let j = 0; j < period; j++) {
      weighted += values[i - j] * (period - j);
    }
    result.push(weighted / denom);
  }
  return result;
}

/**
 * Calculate Hull Moving Average
 * @param data - OHLC data array
 * @param period - HMA period (default: 20)
 * @returns Array of {time, value} line points
 */
export const calculateHMA = (data: OHLCData[], period: number = 20): TimeValuePoint[] => {
  if (!Array.isArray(data) || data.length < period || period < 2) return [];

  const closes = data.map(d => d.close);
  const halfPeriod = Math.max(2, Math.floor(period / 2));
  const sqrtPeriod = Math.max(2, Math.round(Math.sqrt(period)));

  const wmaFull  = calculateWMA(closes, period);
  const wmaHalf  = calculateWMA(closes, halfPeriod);

  if (wmaFull.length === 0 || wmaHalf.length === 0) return [];

  // Align: wmaHalf starts at index (halfPeriod-1), wmaFull at (period-1)
  // wmaHalf has (n - halfPeriod + 1) elements, wmaFull has (n - period + 1) elements
  // Difference in start index: (period - halfPeriod)
  const offset = period - halfPeriod; // wmaHalf index offset vs wmaFull
  const diff: number[] = [];
  for (let i = 0; i < wmaFull.length; i++) {
    diff.push(2 * wmaHalf[i + offset] - wmaFull[i]);
  }

  const hmaValues = calculateWMA(diff, sqrtPeriod);
  if (hmaValues.length === 0) return [];

  // Time offset: period-1 bars consumed by wmaFull, then sqrtPeriod-1 more by final WMA
  const startIdx = period - 1 + sqrtPeriod - 1;
  return hmaValues.map((value, i) => ({
    time: data[startIdx + i].time as number,
    value
  }));
};
