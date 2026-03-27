/**
 * Aroon Indicator
 * Measures how recently the highest high and lowest low occurred within a period.
 *   Aroon Up   = 100 × (period − bars since period-high) / period
 *   Aroon Down = 100 × (period − bars since period-low)  / period
 *   Oscillator = Aroon Up − Aroon Down  (range −100 to +100)
 */

import { OHLCData, TimeValuePoint } from './types';

export interface AroonResult {
    up: TimeValuePoint[];
    down: TimeValuePoint[];
    oscillator: TimeValuePoint[];
}

/**
 * Calculate Aroon Indicator
 * @param data   - OHLC data array
 * @param period - Lookback period (default 25)
 */
export const calculateAroon = (data: OHLCData[], period = 25): AroonResult => {
    if (!Array.isArray(data) || data.length <= period || period < 2) {
        return { up: [], down: [], oscillator: [] };
    }

    const up: TimeValuePoint[] = [];
    const down: TimeValuePoint[] = [];
    const oscillator: TimeValuePoint[] = [];

    for (let i = period; i < data.length; i++) {
        // Window: i-period … i (inclusive), length = period+1
        let highIdx = 0;
        let lowIdx  = 0;
        for (let j = 1; j <= period; j++) {
            if (data[i - j].high > data[i - highIdx].high) highIdx = j;
            if (data[i - j].low  < data[i - lowIdx ].low ) lowIdx  = j;
        }
        const aroonUp   = 100 * (period - highIdx) / period;
        const aroonDown = 100 * (period - lowIdx)  / period;

        up.push({ time: data[i].time, value: aroonUp });
        down.push({ time: data[i].time, value: aroonDown });
        oscillator.push({ time: data[i].time, value: aroonUp - aroonDown });
    }

    return { up, down, oscillator };
};
