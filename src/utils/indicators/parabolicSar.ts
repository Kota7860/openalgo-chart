/**
 * Parabolic SAR (Stop and Reverse)
 * A trend-following indicator that identifies potential reversal points.
 * Displayed as dots above (bearish) or below (bullish) price.
 */

import { OHLCData } from './types';

export interface SARPoint {
  time: number;
  value: number;
  trend: 'bull' | 'bear'; // bull = SAR below price, bear = SAR above price
}

/**
 * Calculate Parabolic SAR
 * @param data   - OHLC data array
 * @param step   - Acceleration factor step (default: 0.02)
 * @param maxAF  - Maximum acceleration factor (default: 0.2)
 * @returns Array of SAR points with trend direction
 */
export const calculateParabolicSAR = (
  data: OHLCData[],
  step: number = 0.02,
  maxAF: number = 0.2
): SARPoint[] => {
  if (!Array.isArray(data) || data.length < 3) return [];

  const result: SARPoint[] = [];

  // Seed: assume bullish start
  let bull = true;
  let af = step;
  let ep = data[0].high; // extreme point
  let sar = data[0].low;

  for (let i = 1; i < data.length; i++) {
    const prevSAR = sar;

    if (bull) {
      sar = prevSAR + af * (ep - prevSAR);
      // SAR cannot be above the two prior lows
      sar = Math.min(sar, data[i - 1].low, i >= 2 ? data[i - 2].low : data[i - 1].low);

      if (data[i].low < sar) {
        // Reversal to bearish
        bull = false;
        sar = ep;
        ep = data[i].low;
        af = step;
      } else {
        if (data[i].high > ep) {
          ep = data[i].high;
          af = Math.min(af + step, maxAF);
        }
      }
    } else {
      sar = prevSAR + af * (ep - prevSAR);
      // SAR cannot be below the two prior highs
      sar = Math.max(sar, data[i - 1].high, i >= 2 ? data[i - 2].high : data[i - 1].high);

      if (data[i].high > sar) {
        // Reversal to bullish
        bull = true;
        sar = ep;
        ep = data[i].high;
        af = step;
      } else {
        if (data[i].low < ep) {
          ep = data[i].low;
          af = Math.min(af + step, maxAF);
        }
      }
    }

    result.push({
      time: data[i].time as number,
      value: sar,
      trend: bull ? 'bull' : 'bear'
    });
  }

  return result;
};
