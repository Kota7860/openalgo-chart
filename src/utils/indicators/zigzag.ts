/**
 * ZigZag Indicator
 * Connects significant swing highs and lows, filtering out minor fluctuations
 */

import { OHLCData } from './types';

export interface ZigZagPoint {
  time: number;
  price: number;
  type: 'high' | 'low';
}

/**
 * Calculate ZigZag pivots using a percentage deviation filter
 * @param data - Array of OHLC data points
 * @param deviation - Minimum % move to form a new pivot (default: 5)
 * @returns Array of ZigZag pivot points
 */
export const calculateZigZag = (data: OHLCData[], deviation: number = 5): ZigZagPoint[] => {
  if (!Array.isArray(data) || data.length < 3 || deviation <= 0) {
    return [];
  }

  const threshold = deviation / 100;
  const pivots: ZigZagPoint[] = [];

  // State: 'up' means looking for a higher high, 'down' looking for lower low
  let direction: 'up' | 'down' | null = null;
  let extremePrice = 0;
  let extremeIdx = 0;

  // Seed direction from first candle
  let startHigh = data[0].high;
  let startLow = data[0].low;

  for (let i = 1; i < data.length; i++) {
    if (direction === null) {
      if (data[i].high / startLow - 1 >= threshold) {
        // Initial up move detected — first pivot is the low
        direction = 'up';
        pivots.push({ time: data[0].time as number, price: startLow, type: 'low' });
        extremePrice = data[i].high;
        extremeIdx = i;
      } else if (startHigh / data[i].low - 1 >= threshold) {
        // Initial down move detected — first pivot is the high
        direction = 'down';
        pivots.push({ time: data[0].time as number, price: startHigh, type: 'high' });
        extremePrice = data[i].low;
        extremeIdx = i;
      } else {
        // Track widening high/low while no direction
        startHigh = Math.max(startHigh, data[i].high);
        startLow = Math.min(startLow, data[i].low);
      }
    } else if (direction === 'up') {
      if (data[i].high > extremePrice) {
        // New high in this up leg — update extreme
        extremePrice = data[i].high;
        extremeIdx = i;
      } else if (extremePrice / data[i].low - 1 >= threshold) {
        // Reversal — push the high pivot and switch direction
        pivots.push({ time: data[extremeIdx].time as number, price: extremePrice, type: 'high' });
        direction = 'down';
        extremePrice = data[i].low;
        extremeIdx = i;
      }
    } else {
      // direction === 'down'
      if (data[i].low < extremePrice) {
        // New low in this down leg — update extreme
        extremePrice = data[i].low;
        extremeIdx = i;
      } else if (data[i].high / extremePrice - 1 >= threshold) {
        // Reversal — push the low pivot and switch direction
        pivots.push({ time: data[extremeIdx].time as number, price: extremePrice, type: 'low' });
        direction = 'up';
        extremePrice = data[i].high;
        extremeIdx = i;
      }
    }
  }

  // Push the last incomplete pivot (current extreme)
  if (direction !== null) {
    pivots.push({
      time: data[extremeIdx].time as number,
      price: extremePrice,
      type: direction === 'up' ? 'high' : 'low',
    });
  }

  return pivots;
};
