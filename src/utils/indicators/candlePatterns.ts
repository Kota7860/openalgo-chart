/**
 * Candlestick Pattern Recognition
 * Detects 15+ classic single, double, and triple candlestick patterns
 */

export type PatternBias = 'bullish' | 'bearish' | 'neutral';

export interface CandlePattern {
    time: number;
    name: string;
    type: PatternBias;
    /** relative body size ratio used internally */
    _bodyRatio?: number;
}

export interface OHLCData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const body = (c: OHLCData) => Math.abs(c.close - c.open);
const range = (c: OHLCData) => c.high - c.low;
const upperWick = (c: OHLCData) => c.high - Math.max(c.open, c.close);
const lowerWick = (c: OHLCData) => Math.min(c.open, c.close) - c.low;
const isBull = (c: OHLCData) => c.close >= c.open;
const isBear = (c: OHLCData) => c.close < c.open;
const midpoint = (c: OHLCData) => (c.high + c.low) / 2;

/** body is ≥ threshold fraction of the full range */
const hasBigBody = (c: OHLCData, thr = 0.6) => range(c) > 0 && body(c) / range(c) >= thr;

/** body is tiny relative to range */
const hasSmallBody = (c: OHLCData, thr = 0.15) => range(c) > 0 && body(c) / range(c) <= thr;

/** average body size of the last N candles */
const avgBody = (data: OHLCData[], idx: number, n = 5): number => {
    let sum = 0;
    const start = Math.max(0, idx - n);
    for (let i = start; i < idx; i++) sum += body(data[i]);
    return idx > start ? sum / (idx - start) : body(data[idx]);
};

// ── single-candle patterns ────────────────────────────────────────────────────

/** Doji: tiny body, upper and lower wicks roughly equal */
const isDoji = (c: OHLCData): boolean => {
    if (range(c) === 0) return false;
    const bodyRatio = body(c) / range(c);
    return bodyRatio <= 0.05;
};

/** Hammer: small body at top, long lower wick, small upper wick — bullish */
const isHammer = (c: OHLCData): boolean => {
    if (range(c) === 0) return false;
    const lw = lowerWick(c);
    const uw = upperWick(c);
    const b = body(c);
    return lw >= 2 * b && uw <= 0.3 * b && b > 0;
};

/** Inverted Hammer: small body at bottom, long upper wick — bullish (needs confirmation) */
const isInvertedHammer = (c: OHLCData): boolean => {
    if (range(c) === 0) return false;
    const lw = lowerWick(c);
    const uw = upperWick(c);
    const b = body(c);
    return uw >= 2 * b && lw <= 0.3 * b && b > 0;
};

/** Shooting Star: small body at bottom of range, long upper wick — bearish */
const isShootingStar = (c: OHLCData): boolean => isInvertedHammer(c) && isBear(c);

/** Spinning Top: small body with both wicks longer than the body */
const isSpinningTop = (c: OHLCData): boolean => {
    if (range(c) === 0) return false;
    const b = body(c);
    const lw = lowerWick(c);
    const uw = upperWick(c);
    return hasSmallBody(c, 0.25) && lw > b && uw > b;
};

/** Marubozu: large body, almost no wicks */
const isMarubozu = (c: OHLCData): boolean => {
    if (range(c) === 0) return false;
    const lw = lowerWick(c);
    const uw = upperWick(c);
    return hasBigBody(c, 0.9) && lw <= 0.03 * range(c) && uw <= 0.03 * range(c);
};

// ── double-candle patterns ────────────────────────────────────────────────────

/** Bullish Engulfing: bearish candle followed by a larger bullish candle */
const isBullishEngulfing = (prev: OHLCData, curr: OHLCData): boolean =>
    isBear(prev) && isBull(curr) &&
    curr.open <= prev.close && curr.close >= prev.open;

/** Bearish Engulfing: bullish candle followed by a larger bearish candle */
const isBearishEngulfing = (prev: OHLCData, curr: OHLCData): boolean =>
    isBull(prev) && isBear(curr) &&
    curr.open >= prev.close && curr.close <= prev.open;

/** Piercing Line: bearish + bullish that opens below previous low, closes above midpoint */
const isPiercingLine = (prev: OHLCData, curr: OHLCData): boolean =>
    isBear(prev) && isBull(curr) &&
    curr.open < prev.low &&
    curr.close > midpoint(prev) && curr.close < prev.open;

/** Dark Cloud Cover: bullish + bearish that opens above previous high, closes below midpoint */
const isDarkCloudCover = (prev: OHLCData, curr: OHLCData): boolean =>
    isBull(prev) && isBear(curr) &&
    curr.open > prev.high &&
    curr.close < midpoint(prev) && curr.close > prev.open;

/** Bullish Harami: large bearish + small bullish body inside previous body */
const isBullishHarami = (prev: OHLCData, curr: OHLCData): boolean =>
    isBear(prev) && isBull(curr) &&
    curr.open > prev.close && curr.close < prev.open &&
    hasSmallBody(curr, 0.4);

/** Bearish Harami: large bullish + small bearish body inside previous body */
const isBearishHarami = (prev: OHLCData, curr: OHLCData): boolean =>
    isBull(prev) && isBear(curr) &&
    curr.open < prev.close && curr.close > prev.open &&
    hasSmallBody(curr, 0.4);

// ── triple-candle patterns ────────────────────────────────────────────────────

/** Morning Star: bearish + small doji/spinning top + bullish that closes above midpoint of first */
const isMorningStar = (c1: OHLCData, c2: OHLCData, c3: OHLCData): boolean =>
    isBear(c1) && hasBigBody(c1, 0.5) &&
    hasSmallBody(c2) &&
    c2.high < c1.close && // gap down
    isBull(c3) && hasBigBody(c3, 0.5) &&
    c3.close > midpoint(c1);

/** Evening Star: bullish + small doji/spinning top + bearish that closes below midpoint of first */
const isEveningStar = (c1: OHLCData, c2: OHLCData, c3: OHLCData): boolean =>
    isBull(c1) && hasBigBody(c1, 0.5) &&
    hasSmallBody(c2) &&
    c2.low > c1.close && // gap up
    isBear(c3) && hasBigBody(c3, 0.5) &&
    c3.close < midpoint(c1);

/** Three White Soldiers: 3 consecutive bullish candles with large bodies, each closing higher */
const isThreeWhiteSoldiers = (c1: OHLCData, c2: OHLCData, c3: OHLCData): boolean =>
    isBull(c1) && isBull(c2) && isBull(c3) &&
    hasBigBody(c1, 0.5) && hasBigBody(c2, 0.5) && hasBigBody(c3, 0.5) &&
    c2.close > c1.close && c3.close > c2.close &&
    c2.open > c1.open && c3.open > c2.open;

/** Three Black Crows: 3 consecutive bearish candles with large bodies, each closing lower */
const isThreeBlackCrows = (c1: OHLCData, c2: OHLCData, c3: OHLCData): boolean =>
    isBear(c1) && isBear(c2) && isBear(c3) &&
    hasBigBody(c1, 0.5) && hasBigBody(c2, 0.5) && hasBigBody(c3, 0.5) &&
    c2.close < c1.close && c3.close < c2.close &&
    c2.open < c1.open && c3.open < c2.open;

// ── main detector ─────────────────────────────────────────────────────────────

export interface CandlePatternOptions {
    showDoji?: boolean;
    showHammer?: boolean;
    showInvertedHammer?: boolean;
    showShootingStar?: boolean;
    showSpinningTop?: boolean;
    showMarubozu?: boolean;
    showEngulfing?: boolean;
    showPiercingDarkCloud?: boolean;
    showHarami?: boolean;
    showMorningStar?: boolean;
    showEveningStar?: boolean;
    showThreeSoldiersCrows?: boolean;
}

export const detectCandlePatterns = (
    data: OHLCData[],
    options: CandlePatternOptions = {}
): CandlePattern[] => {
    const opts: Required<CandlePatternOptions> = {
        showDoji: options.showDoji !== false,
        showHammer: options.showHammer !== false,
        showInvertedHammer: options.showInvertedHammer !== false,
        showShootingStar: options.showShootingStar !== false,
        showSpinningTop: options.showSpinningTop !== false,
        showMarubozu: options.showMarubozu !== false,
        showEngulfing: options.showEngulfing !== false,
        showPiercingDarkCloud: options.showPiercingDarkCloud !== false,
        showHarami: options.showHarami !== false,
        showMorningStar: options.showMorningStar !== false,
        showEveningStar: options.showEveningStar !== false,
        showThreeSoldiersCrows: options.showThreeSoldiersCrows !== false,
    };

    const results: CandlePattern[] = [];

    for (let i = 0; i < data.length; i++) {
        const c = data[i];
        const prev = i > 0 ? data[i - 1] : null;
        const prev2 = i > 1 ? data[i - 2] : null;
        const avg = avgBody(data, i);

        // Skip candles with negligible range
        if (range(c) < 0.0001) continue;

        // Only detect patterns on candles with meaningful size
        const significantBody = body(c) >= avg * 0.3;

        // ── Single candle ──
        if (opts.showDoji && isDoji(c)) {
            results.push({ time: c.time, name: 'Doji', type: 'neutral' });
            continue; // one label per candle
        }

        if (opts.showHammer && isHammer(c) && isBull(c)) {
            results.push({ time: c.time, name: 'Hammer', type: 'bullish' });
            continue;
        }

        if (opts.showShootingStar && isShootingStar(c)) {
            results.push({ time: c.time, name: 'Shooting Star', type: 'bearish' });
            continue;
        }

        if (opts.showInvertedHammer && isInvertedHammer(c) && isBull(c)) {
            results.push({ time: c.time, name: 'Inv. Hammer', type: 'bullish' });
            continue;
        }

        if (opts.showMarubozu && isMarubozu(c)) {
            results.push({ time: c.time, name: isBull(c) ? 'Bullish Marubozu' : 'Bearish Marubozu', type: isBull(c) ? 'bullish' : 'bearish' });
            continue;
        }

        if (opts.showSpinningTop && isSpinningTop(c) && significantBody) {
            results.push({ time: c.time, name: 'Spinning Top', type: 'neutral' });
            continue;
        }

        if (!prev) continue;

        // ── Double candle ──
        if (opts.showEngulfing) {
            if (isBullishEngulfing(prev, c)) {
                results.push({ time: c.time, name: 'Bull Engulfing', type: 'bullish' });
                continue;
            }
            if (isBearishEngulfing(prev, c)) {
                results.push({ time: c.time, name: 'Bear Engulfing', type: 'bearish' });
                continue;
            }
        }

        if (opts.showPiercingDarkCloud) {
            if (isPiercingLine(prev, c)) {
                results.push({ time: c.time, name: 'Piercing Line', type: 'bullish' });
                continue;
            }
            if (isDarkCloudCover(prev, c)) {
                results.push({ time: c.time, name: 'Dark Cloud', type: 'bearish' });
                continue;
            }
        }

        if (opts.showHarami) {
            if (isBullishHarami(prev, c)) {
                results.push({ time: c.time, name: 'Bull Harami', type: 'bullish' });
                continue;
            }
            if (isBearishHarami(prev, c)) {
                results.push({ time: c.time, name: 'Bear Harami', type: 'bearish' });
                continue;
            }
        }

        if (!prev2) continue;

        // ── Triple candle ──
        if (opts.showMorningStar && isMorningStar(prev2, prev, c)) {
            results.push({ time: c.time, name: 'Morning Star', type: 'bullish' });
            continue;
        }

        if (opts.showEveningStar && isEveningStar(prev2, prev, c)) {
            results.push({ time: c.time, name: 'Evening Star', type: 'bearish' });
            continue;
        }

        if (opts.showThreeSoldiersCrows) {
            if (isThreeWhiteSoldiers(prev2, prev, c)) {
                results.push({ time: c.time, name: '3 White Soldiers', type: 'bullish' });
                continue;
            }
            if (isThreeBlackCrows(prev2, prev, c)) {
                results.push({ time: c.time, name: '3 Black Crows', type: 'bearish' });
                continue;
            }
        }
    }

    return results;
};
