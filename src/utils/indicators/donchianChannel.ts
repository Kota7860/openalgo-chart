/**
 * Donchian Channel Indicator
 * Shows highest high and lowest low over a period, with midline
 */

import { OHLCData, TimeValuePoint } from './types';

export interface DonchianResult {
  upper: TimeValuePoint[];
  mid: TimeValuePoint[];
  lower: TimeValuePoint[];
}

/**
 * Calculate Donchian Channel
 * @param data - Array of OHLC data points
 * @param period - Lookback period (default: 20)
 * @returns Object with upper, mid, and lower band arrays
 */
export const calculateDonchianChannel = (data: OHLCData[], period: number = 20): DonchianResult => {
  if (!Array.isArray(data) || data.length < period || period <= 0) {
    return { upper: [], mid: [], lower: [] };
  }

  const upper: TimeValuePoint[] = [];
  const mid: TimeValuePoint[] = [];
  const lower: TimeValuePoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...slice.map(d => d.high));
    const lowestLow = Math.min(...slice.map(d => d.low));
    const midVal = (highestHigh + lowestLow) / 2;

    upper.push({ time: data[i].time, value: highestHigh });
    mid.push({ time: data[i].time, value: midVal });
    lower.push({ time: data[i].time, value: lowestLow });
  }

  return { upper, mid, lower };
};
