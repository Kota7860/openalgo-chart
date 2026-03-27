/**
 * Williams Alligator Indicator
 * Three smoothed moving averages (SMMA) with time offsets:
 *   Jaw   — 13-period SMMA, shifted 8 bars forward  (blue)
 *   Teeth — 8-period SMMA,  shifted 5 bars forward  (red)
 *   Lips  — 5-period SMMA,  shifted 3 bars forward  (green)
 */

import { OHLCData, TimeValuePoint } from './types';

export interface AlligatorResult {
    jaw: TimeValuePoint[];
    teeth: TimeValuePoint[];
    lips: TimeValuePoint[];
}

/**
 * Smoothed Moving Average (Wilder's SMMA)
 * First value = SMA of first `period` values, then:
 *   smma[i] = (smma[i-1] * (period - 1) + src[i]) / period
 */
const calculateSMMA = (src: number[], period: number): number[] => {
    if (src.length < period) return [];
    const result: (number | null)[] = new Array(period - 1).fill(null);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += src[i];
    let prev = sum / period;
    result.push(prev);
    for (let i = period; i < src.length; i++) {
        prev = (prev * (period - 1) + src[i]) / period;
        result.push(prev);
    }
    return result as number[];
};

/**
 * Calculate Williams Alligator
 * @param data - OHLC data array
 * @param jawPeriod   - Jaw SMMA period (default 13)
 * @param jawOffset   - Jaw shift forward (default 8)
 * @param teethPeriod - Teeth SMMA period (default 8)
 * @param teethOffset - Teeth shift forward (default 5)
 * @param lipsPeriod  - Lips SMMA period (default 5)
 * @param lipsOffset  - Lips shift forward (default 3)
 */
export const calculateAlligator = (
    data: OHLCData[],
    jawPeriod = 13,
    jawOffset = 8,
    teethPeriod = 8,
    teethOffset = 5,
    lipsPeriod = 5,
    lipsOffset = 3
): AlligatorResult => {
    const midpoints = data.map(d => (d.high + d.low) / 2);
    const times = data.map(d => d.time);

    const jawVals   = calculateSMMA(midpoints, jawPeriod);
    const teethVals = calculateSMMA(midpoints, teethPeriod);
    const lipsVals  = calculateSMMA(midpoints, lipsPeriod);

    const jaw: TimeValuePoint[] = [];
    const teeth: TimeValuePoint[] = [];
    const lips: TimeValuePoint[] = [];

    // Shift each value forward in time by its offset
    for (let i = 0; i < jawVals.length; i++) {
        const v = jawVals[i];
        if (v !== null && i + jawOffset < times.length) {
            jaw.push({ time: times[i + jawOffset], value: v });
        }
    }
    for (let i = 0; i < teethVals.length; i++) {
        const v = teethVals[i];
        if (v !== null && i + teethOffset < times.length) {
            teeth.push({ time: times[i + teethOffset], value: v });
        }
    }
    for (let i = 0; i < lipsVals.length; i++) {
        const v = lipsVals[i];
        if (v !== null && i + lipsOffset < times.length) {
            lips.push({ time: times[i + lipsOffset], value: v });
        }
    }

    return { jaw, teeth, lips };
};
