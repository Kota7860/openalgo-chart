/**
 * Squeeze Momentum Indicator (LazyBear / TTM Squeeze style)
 *
 * Squeeze ON  = Bollinger Bands are INSIDE Keltner Channel → low volatility coiling
 * Squeeze OFF = BB breaks outside KC → momentum releasing
 * Histogram   = linear-regression momentum value
 */

import { calculateEMA } from './ema';
import { calculateATR } from './atr';

export interface OHLCData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

export type TimeValuePoint = { time: number; value: number };

export interface SqueezeResult {
    /** Momentum histogram values (positive = bullish, negative = bearish) */
    momentum: TimeValuePoint[];
    /** true = squeeze ON (red dot), false = squeeze OFF (green dot) */
    squeezeOn: Array<{ time: number; on: boolean }>;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const calcSMA = (data: number[], period: number): number[] => {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { result.push(NaN); continue; }
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j];
        result.push(sum / period);
    }
    return result;
};

const calcStdDev = (data: number[], sma: number[], period: number): number[] => {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
        if (isNaN(sma[i])) { result.push(NaN); continue; }
        let variance = 0;
        for (let j = i - period + 1; j <= i; j++) {
            variance += (data[j] - sma[i]) ** 2;
        }
        result.push(Math.sqrt(variance / period));
    }
    return result;
};

/** Linear regression value (last point) over a rolling window */
const linRegValue = (data: number[], period: number): number[] => {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { result.push(NaN); continue; }
        const n = period;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let j = 0; j < n; j++) {
            sumX += j;
            sumY += data[i - n + 1 + j];
            sumXY += j * data[i - n + 1 + j];
            sumX2 += j * j;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        result.push(slope * (n - 1) + intercept);
    }
    return result;
};

// ── main calculation ──────────────────────────────────────────────────────────

export const calculateSqueeze = (
    data: OHLCData[],
    bbPeriod: number = 20,
    bbMult: number = 2.0,
    kcPeriod: number = 20,
    kcMult: number = 1.5,
    momentumPeriod: number = 20
): SqueezeResult => {
    const closes = data.map(d => d.close);

    // Bollinger Bands
    const bbSma = calcSMA(closes, bbPeriod);
    const bbStd = calcStdDev(closes, bbSma, bbPeriod);
    const bbUpper = bbSma.map((s, i) => s + bbMult * bbStd[i]);
    const bbLower = bbSma.map((s, i) => s - bbMult * bbStd[i]);

    // Keltner Channel (EMA ± ATR * mult)
    const emaData = calculateEMA(data, kcPeriod);
    const emaMap = new Map<number, number>();
    emaData.forEach(p => emaMap.set(p.time as number, p.value));

    const atrData = calculateATR(data, kcPeriod);
    const atrMap = new Map<number, number>();
    atrData.forEach(p => atrMap.set(p.time as number, p.value));

    // Momentum: delta = close - midpoint(highest(high,period), lowest(low,period))
    const delta: number[] = data.map((d, i) => {
        if (i < momentumPeriod - 1) return NaN;
        let hh = -Infinity, ll = Infinity;
        for (let j = i - momentumPeriod + 1; j <= i; j++) {
            if (data[j].high > hh) hh = data[j].high;
            if (data[j].low < ll) ll = data[j].low;
        }
        return d.close - (hh + ll) / 2;
    });

    const momentum_lr = linRegValue(delta, momentumPeriod);

    // Build results (only for valid indices)
    const momentumOut: TimeValuePoint[] = [];
    const squeezeOnOut: Array<{ time: number; on: boolean }> = [];

    for (let i = 0; i < data.length; i++) {
        const t = data[i].time;
        const ema = emaMap.get(t);
        const atr = atrMap.get(t);
        const mom = momentum_lr[i];

        if (ema === undefined || atr === undefined || isNaN(mom) || isNaN(bbUpper[i])) continue;

        const kcU = ema + kcMult * atr;
        const kcL = ema - kcMult * atr;
        const sqzOn = bbUpper[i] < kcU && bbLower[i] > kcL;

        momentumOut.push({ time: t, value: mom });
        squeezeOnOut.push({ time: t, on: sqzOn });
    }

    return { momentum: momentumOut, squeezeOn: squeezeOnOut };
};
