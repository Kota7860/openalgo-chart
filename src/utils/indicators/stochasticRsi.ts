/**
 * Stochastic RSI Indicator
 * Applies the Stochastic oscillator formula to RSI values
 * More sensitive than standard RSI; commonly used at 3/3/14/14 settings
 */

import { OHLCData } from './types';
import { calculateRSI } from './rsi';

export interface StochasticRSIResult {
  k: Array<{ time: number; value: number }>;
  d: Array<{ time: number; value: number }>;
}

/**
 * Calculate Stochastic RSI
 * @param data - OHLC candle data
 * @param rsiPeriod - RSI period (default: 14)
 * @param stochPeriod - Stochastic lookback on RSI (default: 14)
 * @param kSmooth - %K smoothing period (default: 3)
 * @param dSmooth - %D smoothing period (default: 3)
 * @returns Object with k and d line arrays (0–100)
 */
export const calculateStochasticRSI = (
  data: OHLCData[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  kSmooth: number = 3,
  dSmooth: number = 3
): StochasticRSIResult => {
  const empty: StochasticRSIResult = { k: [], d: [] };
  if (!Array.isArray(data) || data.length < rsiPeriod + stochPeriod + kSmooth + dSmooth) {
    return empty;
  }

  const rsiValues = calculateRSI(data, rsiPeriod);
  if (rsiValues.length < stochPeriod) return empty;

  // Raw %K: stochastic of RSI values
  const rawK: Array<{ time: number; value: number }> = [];
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const slice = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const highRSI = Math.max(...slice.map(r => r.value));
    const lowRSI = Math.min(...slice.map(r => r.value));
    const range = highRSI - lowRSI;
    const stochVal = range === 0 ? 0 : ((rsiValues[i].value - lowRSI) / range) * 100;
    rawK.push({ time: rsiValues[i].time as number, value: stochVal });
  }

  if (rawK.length < kSmooth) return empty;

  // Smooth %K using SMA
  const smoothedK: Array<{ time: number; value: number }> = [];
  for (let i = kSmooth - 1; i < rawK.length; i++) {
    const slice = rawK.slice(i - kSmooth + 1, i + 1);
    const avg = slice.reduce((s, v) => s + v.value, 0) / kSmooth;
    smoothedK.push({ time: rawK[i].time, value: avg });
  }

  if (smoothedK.length < dSmooth) return empty;

  // %D is SMA of smoothed %K
  const dLine: Array<{ time: number; value: number }> = [];
  for (let i = dSmooth - 1; i < smoothedK.length; i++) {
    const slice = smoothedK.slice(i - dSmooth + 1, i + 1);
    const avg = slice.reduce((s, v) => s + v.value, 0) / dSmooth;
    dLine.push({ time: smoothedK[i].time, value: avg });
  }

  // Align k to match d length
  const kAligned = smoothedK.slice(smoothedK.length - dLine.length);

  return { k: kAligned, d: dLine };
};
