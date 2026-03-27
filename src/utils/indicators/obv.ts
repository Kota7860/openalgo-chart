/**
 * On-Balance Volume (OBV) Indicator
 * Cumulative volume indicator that relates volume to price change
 */

import { OHLCData, TimeValuePoint } from './types';

/**
 * Calculate On-Balance Volume
 * @param data - Array of OHLC data points (volume required)
 * @returns Array of {time, value} objects
 */
export const calculateOBV = (data: OHLCData[]): TimeValuePoint[] => {
  if (!Array.isArray(data) || data.length < 2) {
    return [];
  }

  const obvData: TimeValuePoint[] = [];
  let obv = 0;

  obvData.push({ time: data[0].time, value: 0 });

  for (let i = 1; i < data.length; i++) {
    const volume = data[i].volume ?? 0;
    if (data[i].close > data[i - 1].close) {
      obv += volume;
    } else if (data[i].close < data[i - 1].close) {
      obv -= volume;
    }
    // If close == prev close, OBV stays the same
    obvData.push({ time: data[i].time, value: obv });
  }

  return obvData;
};
