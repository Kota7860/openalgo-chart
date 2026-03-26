/**
 * Linear Regression Channel
 * Rolling OLS regression line with ±N standard-deviation bands
 */

export interface OHLCData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

export type TimeValuePoint = { time: number; value: number };

export interface LinearRegressionResult {
    mid: TimeValuePoint[];    // regression line
    upper: TimeValuePoint[];  // mid + mult * stddev
    lower: TimeValuePoint[];  // mid - mult * stddev
}

export const calculateLinearRegression = (
    data: OHLCData[],
    period: number = 100,
    multiplier: number = 2.0,
    source: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' = 'close'
): LinearRegressionResult => {
    const mid: TimeValuePoint[] = [];
    const upper: TimeValuePoint[] = [];
    const lower: TimeValuePoint[] = [];

    const src = data.map(d => {
        switch (source) {
            case 'open':  return d.open;
            case 'high':  return d.high;
            case 'low':   return d.low;
            case 'hl2':   return (d.high + d.low) / 2;
            case 'hlc3':  return (d.high + d.low + d.close) / 3;
            default:      return d.close;
        }
    });

    for (let i = period - 1; i < data.length; i++) {
        const n = period;
        // Indices 0..n-1 → y values: src[i-n+1] .. src[i]
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let j = 0; j < n; j++) {
            sumX  += j;
            sumY  += src[i - n + 1 + j];
            sumXY += j * src[i - n + 1 + j];
            sumX2 += j * j;
        }
        const denom = n * sumX2 - sumX * sumX;
        if (denom === 0) continue;

        const slope     = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        const regVal    = slope * (n - 1) + intercept; // value at current bar

        // Residual standard deviation
        let sse = 0;
        for (let j = 0; j < n; j++) {
            const fitted = slope * j + intercept;
            sse += (src[i - n + 1 + j] - fitted) ** 2;
        }
        const stddev = Math.sqrt(sse / n);

        const t = data[i].time;
        mid.push({ time: t, value: regVal });
        upper.push({ time: t, value: regVal + multiplier * stddev });
        lower.push({ time: t, value: regVal - multiplier * stddev });
    }

    return { mid, upper, lower };
};
