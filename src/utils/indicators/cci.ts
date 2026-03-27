/**
 * Commodity Channel Index (CCI) Indicator
 * Measures the deviation of price from its statistical mean
 */

import { OHLCData, TimeValuePoint } from './types';

/**
 * Calculate Commodity Channel Index
 * @param data - Array of OHLC data points
 * @param period - Number of periods (default: 20)
 * @returns Array of {time, value} objects
 */
export const calculateCCI = (data: OHLCData[], period: number = 20): TimeValuePoint[] => {
  if (!Array.isArray(data) || data.length < period || period <= 0) {
    return [];
  }

  const cciData: TimeValuePoint[] = [];

  // Calculate typical prices
  const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);

  for (let i = period - 1; i < data.length; i++) {
    const slice = typicalPrices.slice(i - period + 1, i + 1);

    // SMA of typical prices
    const smaTP = slice.reduce((sum, v) => sum + v, 0) / period;

    // Mean deviation
    const meanDev = slice.reduce((sum, v) => sum + Math.abs(v - smaTP), 0) / period;

    if (meanDev === 0) {
      cciData.push({ time: data[i].time, value: 0 });
    } else {
      const cci = (typicalPrices[i] - smaTP) / (0.015 * meanDev);
      cciData.push({ time: data[i].time, value: cci });
    }
  }

  return cciData;
};
