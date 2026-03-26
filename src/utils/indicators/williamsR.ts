/**
 * Williams %R Indicator
 * Momentum oscillator measuring overbought/oversold levels
 * Output range: -100 to 0 (inverted Stochastic)
 */

import { OHLCData, TimeValuePoint } from './types';

/**
 * Calculate Williams %R
 * @param data - Array of OHLC data points
 * @param period - Lookback period (default: 14)
 * @returns Array of {time, value} objects where value is -100 to 0
 */
export const calculateWilliamsR = (data: OHLCData[], period: number = 14): TimeValuePoint[] => {
  if (!Array.isArray(data) || data.length < period || period <= 0) {
    return [];
  }

  const willrData: TimeValuePoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...slice.map(d => d.high));
    const lowestLow = Math.min(...slice.map(d => d.low));
    const range = highestHigh - lowestLow;

    if (range === 0) {
      willrData.push({ time: data[i].time, value: -50 });
    } else {
      const willr = ((highestHigh - data[i].close) / range) * -100;
      willrData.push({ time: data[i].time, value: willr });
    }
  }

  return willrData;
};
