/**
 * Previous Day OHLC Lines Indicator
 * Draws horizontal lines at the previous trading day's Open, High, Low, Close.
 * Commonly used by intraday traders as key support/resistance levels.
 */

import { OHLCData } from './types';

export interface PrevDayLevel {
  time: number;  // Time of the candle where this level starts being drawn
  value: number;
  label: 'PDH' | 'PDL' | 'PDC' | 'PDO';
}

export interface PrevDayResult {
  /** Daily OHLC levels as { time, value } pairs for each intraday bar */
  levels: PrevDayLevel[];
}

/**
 * Detect day boundaries in intraday data using IST market hours (09:15).
 * Returns an array of indices where a new trading day begins.
 */
function findDayBoundaries(data: OHLCData[]): number[] {
  const boundaries: number[] = [0];
  for (let i = 1; i < data.length; i++) {
    const prevDate = new Date((data[i - 1].time as number) * 1000);
    const currDate = new Date((data[i].time as number) * 1000);
    // New day if calendar date changes
    if (
      currDate.getUTCFullYear() !== prevDate.getUTCFullYear() ||
      currDate.getUTCMonth() !== prevDate.getUTCMonth() ||
      currDate.getUTCDate() !== prevDate.getUTCDate()
    ) {
      boundaries.push(i);
    }
  }
  return boundaries;
}

/**
 * Calculate Previous Day OHLC levels for each intraday candle.
 * Each candle receives the OHLC of the previous calendar day.
 *
 * @param data - Array of OHLC candles (works best on intraday data: 1m–1h)
 * @param showOpen  - Include Previous Day Open (default: true)
 * @param showHigh  - Include Previous Day High (default: true)
 * @param showLow   - Include Previous Day Low (default: true)
 * @param showClose - Include Previous Day Close (default: true)
 */
export const calculatePrevDayOHLC = (
  data: OHLCData[],
  showOpen: boolean = true,
  showHigh: boolean = true,
  showLow: boolean = true,
  showClose: boolean = true
): PrevDayResult => {
  if (!Array.isArray(data) || data.length < 2) return { levels: [] };

  const boundaries = findDayBoundaries(data);
  if (boundaries.length < 2) return { levels: [] };

  const levels: PrevDayLevel[] = [];

  // For each day (starting from day 2), compute OHLC of the prior day
  for (let d = 1; d < boundaries.length; d++) {
    const prevStart = boundaries[d - 1];
    const prevEnd = (d < boundaries.length - 1 ? boundaries[d] : data.length) - 1;
    const currStart = boundaries[d];
    const currEnd = d + 1 < boundaries.length ? boundaries[d + 1] : data.length;

    // Compute previous day OHLC
    const prevOpen  = data[prevStart].open;
    const prevClose = data[prevEnd].close;
    let prevHigh = -Infinity;
    let prevLow  = Infinity;
    for (let i = prevStart; i <= prevEnd; i++) {
      if (data[i].high > prevHigh) prevHigh = data[i].high;
      if (data[i].low  < prevLow)  prevLow  = data[i].low;
    }

    if (!isFinite(prevHigh) || !isFinite(prevLow)) continue;

    // Emit one level record per current-day candle (so horizontal line spans the day)
    for (let i = currStart; i < currEnd; i++) {
      const t = data[i].time as number;
      if (showHigh)  levels.push({ time: t, value: prevHigh,  label: 'PDH' });
      if (showLow)   levels.push({ time: t, value: prevLow,   label: 'PDL' });
      if (showClose) levels.push({ time: t, value: prevClose, label: 'PDC' });
      if (showOpen && prevOpen !== undefined)
                     levels.push({ time: t, value: prevOpen,  label: 'PDO' });
    }
  }

  return { levels };
};
