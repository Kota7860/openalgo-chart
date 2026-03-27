/**
 * Chaikin Money Flow (CMF)
 * Measures the amount of money flow volume over a specified period.
 *
 *   Money Flow Multiplier (MFM) = ((Close − Low) − (High − Close)) / (High − Low)
 *   Money Flow Volume (MFV)     = MFM × Volume
 *   CMF                         = Σ(MFV, period) / Σ(Volume, period)
 *
 * Range: −1 to +1. Values above 0 indicate buying pressure, below 0 selling pressure.
 */

import { OHLCData, TimeValuePoint } from './types';

/**
 * Calculate Chaikin Money Flow
 * @param data   - OHLC+Volume data array
 * @param period - Lookback period (default 20)
 */
export const calculateCMF = (data: OHLCData[], period = 20): TimeValuePoint[] => {
    if (!Array.isArray(data) || data.length < period || period < 1) return [];

    const result: TimeValuePoint[] = [];

    for (let i = period - 1; i < data.length; i++) {
        let sumMFV = 0;
        let sumVol = 0;

        for (let j = i - period + 1; j <= i; j++) {
            const { high, low, close, volume = 0 } = data[j];
            const range = high - low;
            if (range === 0 || volume === 0) continue;
            const mfm = ((close - low) - (high - close)) / range;
            sumMFV += mfm * volume;
            sumVol += volume;
        }

        if (sumVol === 0) continue;
        result.push({ time: data[i].time, value: sumMFV / sumVol });
    }

    return result;
};
