/**
 * Awesome Oscillator (AO) — Bill Williams
 * AO = SMA(midpoint, 5) − SMA(midpoint, 34)
 * where midpoint = (High + Low) / 2
 *
 * Bar color:
 *   Green when AO > previous bar's AO
 *   Red   when AO ≤ previous bar's AO
 */

import { OHLCData, TimeValueColorPoint } from './types';

/**
 * Simple SMA over a number array
 */
const sma = (src: number[], period: number): number[] => {
    if (src.length < period) return [];
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += src[i];
    result.push(sum / period);
    for (let i = period; i < src.length; i++) {
        sum += src[i] - src[i - period];
        result.push(sum / period);
    }
    return result;
};

/**
 * Calculate Awesome Oscillator
 * @param data        - OHLC data array
 * @param fastPeriod  - Fast SMA period (default 5)
 * @param slowPeriod  - Slow SMA period (default 34)
 * @param upColor     - Color when AO is rising (default '#26A69A')
 * @param downColor   - Color when AO is falling (default '#EF5350')
 */
export const calculateAO = (
    data: OHLCData[],
    fastPeriod = 5,
    slowPeriod = 34,
    upColor = '#26A69A',
    downColor = '#EF5350'
): TimeValueColorPoint[] => {
    if (!Array.isArray(data) || data.length < slowPeriod) return [];

    const midpoints = data.map(d => (d.high + d.low) / 2);

    const fastSMA = sma(midpoints, fastPeriod);
    const slowSMA = sma(midpoints, slowPeriod);

    // fastSMA starts at index (fastPeriod-1), slowSMA starts at (slowPeriod-1)
    // Align: offset between them = slowPeriod - fastPeriod
    const offset = slowPeriod - fastPeriod;
    const len = Math.min(fastSMA.length - offset, slowSMA.length);
    if (len <= 0) return [];

    const aoValues: number[] = [];
    const aoTimes: number[] = [];
    for (let i = 0; i < len; i++) {
        aoValues.push(fastSMA[i + offset] - slowSMA[i]);
        aoTimes.push(data[slowPeriod - 1 + i].time);
    }

    return aoValues.map((v, i) => ({
        time: aoTimes[i],
        value: v,
        color: i === 0 || v >= aoValues[i - 1] ? upColor : downColor
    }));
};
