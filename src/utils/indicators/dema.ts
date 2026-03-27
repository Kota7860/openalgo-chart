/**
 * Double Exponential Moving Average (DEMA)
 * A faster, smoother moving average with reduced lag.
 *
 *   EMA1 = EMA(source, period)
 *   EMA2 = EMA(EMA1 values, period)
 *   DEMA = 2 × EMA1 − EMA2
 *
 * Source options: close, open, high, low, hl2, hlc3, ohlc4
 */

import { OHLCData, TimeValuePoint } from './types';

type SourceType = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';

const getSource = (d: OHLCData, src: SourceType): number => {
    switch (src) {
        case 'open':  return d.open;
        case 'high':  return d.high;
        case 'low':   return d.low;
        case 'hl2':   return (d.high + d.low) / 2;
        case 'hlc3':  return (d.high + d.low + d.close) / 3;
        case 'ohlc4': return (d.open + d.high + d.low + d.close) / 4;
        default:      return d.close;
    }
};

/**
 * EMA over a raw number array (used internally for EMA-of-EMA)
 */
const emaOfValues = (values: number[], period: number): number[] => {
    if (values.length < period) return [];
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    let prev = sum / period;
    const result: number[] = new Array(period - 1).fill(NaN);
    result.push(prev);
    for (let i = period; i < values.length; i++) {
        prev = (values[i] - prev) * k + prev;
        result.push(prev);
    }
    return result;
};

/**
 * Calculate Double EMA
 * @param data   - OHLC data array
 * @param period - EMA period (default 21)
 * @param source - Price source (default 'close')
 */
export const calculateDEMA = (
    data: OHLCData[],
    period = 21,
    source: SourceType = 'close'
): TimeValuePoint[] => {
    if (!Array.isArray(data) || data.length < period * 2 || period < 2) return [];

    const src = data.map(d => getSource(d, source));
    const k = 2 / (period + 1);

    // First EMA
    let sum = 0;
    for (let i = 0; i < period; i++) sum += src[i];
    let prev1 = sum / period;
    const ema1: number[] = new Array(period - 1).fill(NaN);
    ema1.push(prev1);
    for (let i = period; i < src.length; i++) {
        prev1 = (src[i] - prev1) * k + prev1;
        ema1.push(prev1);
    }

    // Second EMA (of EMA1 values, skipping NaN prefix)
    const ema1Valid = ema1.filter(v => !isNaN(v));
    const ema2Valid = emaOfValues(ema1Valid, period);

    // ema2Valid starts at index (period-1) within ema1Valid
    // ema1Valid starts at overall index (period-1)
    // So ema2Valid[i] corresponds to overall data index: (period-1) + (period-1) + i
    const startIdx = (period - 1) + (period - 1);
    const result: TimeValuePoint[] = [];

    for (let i = 0; i < ema2Valid.length; i++) {
        const overallIdx = startIdx + i;
        if (overallIdx >= data.length || isNaN(ema2Valid[i])) continue;
        const e1 = ema1[overallIdx];
        const e2 = ema2Valid[i];
        if (isNaN(e1)) continue;
        result.push({ time: data[overallIdx].time, value: 2 * e1 - e2 });
    }

    return result;
};
