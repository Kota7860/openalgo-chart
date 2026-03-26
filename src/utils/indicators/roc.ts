/**
 * Rate of Change (ROC) Indicator
 * Measures the percentage change in price over N periods.
 * ROC = ((Close - Close[N]) / Close[N]) × 100
 */

import { OHLCData, TimeValuePoint } from './types';

/**
 * Calculate Rate of Change
 * @param data - OHLC data array
 * @param period - Lookback period (default: 14)
 * @returns Array of {time, value} objects (values are percentages)
 */
export const calculateROC = (data: OHLCData[], period: number = 14): TimeValuePoint[] => {
  if (!Array.isArray(data) || data.length <= period || period <= 0) return [];

  const result: TimeValuePoint[] = [];
  for (let i = period; i < data.length; i++) {
    const prevClose = data[i - period].close;
    if (prevClose === 0) continue;
    const roc = ((data[i].close - prevClose) / prevClose) * 100;
    result.push({ time: data[i].time as number, value: roc });
  }
  return result;
};
