/**
 * Keltner Channel Indicator
 * ATR-based envelope around an EMA
 */

import { OHLCData, TimeValuePoint } from './types';
import { calculateEMA } from './ema';
import { calculateATR } from './atr';

export interface KeltnerResult {
  upper: TimeValuePoint[];
  mid: TimeValuePoint[];
  lower: TimeValuePoint[];
}

/**
 * Calculate Keltner Channel
 * @param data - Array of OHLC data points
 * @param emaPeriod - EMA period (default: 20)
 * @param atrPeriod - ATR period (default: 10)
 * @param multiplier - ATR multiplier (default: 2.0)
 * @returns Object with upper, mid, and lower band arrays
 */
export const calculateKeltnerChannel = (
  data: OHLCData[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  multiplier: number = 2.0
): KeltnerResult => {
  if (!Array.isArray(data) || data.length < Math.max(emaPeriod, atrPeriod) + 1) {
    return { upper: [], mid: [], lower: [] };
  }

  const emaValues = calculateEMA(data, emaPeriod);
  const atrValues = calculateATR(data, atrPeriod);

  // Build a time-indexed map for fast lookup
  const atrMap = new Map<number, number>();
  for (const a of atrValues) {
    atrMap.set(a.time as number, a.value);
  }

  const upper: TimeValuePoint[] = [];
  const mid: TimeValuePoint[] = [];
  const lower: TimeValuePoint[] = [];

  for (const ema of emaValues) {
    const t = ema.time as number;
    const atr = atrMap.get(t);
    if (atr === undefined) continue;

    upper.push({ time: t, value: ema.value + multiplier * atr });
    mid.push({ time: t, value: ema.value });
    lower.push({ time: t, value: ema.value - multiplier * atr });
  }

  return { upper, mid, lower };
};
