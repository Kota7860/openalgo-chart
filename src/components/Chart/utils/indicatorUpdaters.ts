/**
 * Indicator Series Update Functions
 * Functions for updating indicator data and appearance
 */

import {
    calculateSMA,
    calculateEMA,
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateVolume,
    calculateATR,
    calculateStochastic,
    calculateVWAP,
    calculateSupertrend,
    calculateADX,
    calculateIchimoku,
    calculatePivotPoints,
    calculateCCI,
    calculateMFI,
    calculateOBV,
    calculateWilliamsR,
    calculateDonchianChannel,
    calculateKeltnerChannel,
    calculateZigZag,
    detectRSIDivergences,
    calculateStochasticRSI,
    calculatePrevDayOHLC,
    calculateHMA,
    calculateROC,
    calculateParabolicSAR,
    calculateVWAPBands,
    detectCandlePatterns,
    calculateSqueeze,
    calculateLinearRegression
} from '../../../utils/indicators';
import { calculateANNStrategy } from '../../../utils/indicators/annStrategy';
import { calculateHilengaMilenga } from '../../../utils/indicators/hilengaMilenga';
import { CHART_COLORS } from '../../../utils/colorUtils';
import { IndicatorConfig } from './indicatorCreators';

export interface OHLCData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface ChartMarker {
    time: number;
    position: 'aboveBar' | 'belowBar';
    color: string;
    shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
    text?: string;
}

/**
 * Update SMA/EMA/VWAP series
 */
export const updateOverlaySeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    const { type } = ind;
    // Generate title only if showTitle is enabled
    const title = ind.showTitle ? `${type.toUpperCase()} ${ind.period || 20}` : '';

    series.applyOptions({
        visible: isVisible,
        color: ind.color || (type === 'sma' ? '#2196F3' : '#FF9800'),
        title
    });

    let val: any = null;
    if (type === 'sma') val = calculateSMA(data, ind.period || 20);
    else if (type === 'ema') val = calculateEMA(data, ind.period || 20);
    else if (type === 'vwap') val = calculateVWAP(data, ind as any);

    if (val && val.length > 0) series.setData(val);
};

/**
 * Update RSI series
 */
export const updateRSISeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible, color: ind.color || '#7B1FA2' });
    if (series._obLine) {
        series._obLine.applyOptions({ price: ind.overbought || 70, color: ind.overboughtColor || CHART_COLORS.DOWN.primary });
    }
    if (series._osLine) {
        series._osLine.applyOptions({ price: ind.oversold || 30, color: ind.oversoldColor || CHART_COLORS.UP.primary });
    }
    const val = calculateRSI(data, ind.period || 14);
    if (val) series.setData(val);
};

/**
 * Update MACD series
 */
export const updateMACDSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    if (series.macd) series.macd.applyOptions({ visible: isVisible, color: ind.macdColor || '#2962FF' });
    if (series.signal) series.signal.applyOptions({ visible: isVisible, color: ind.signalColor || '#FF6D00' });
    if (series.histogram) series.histogram.applyOptions({ visible: isVisible });

    const val = calculateMACD(data, ind.fast || 12, ind.slow || 26, ind.signal || 9) as any;
    if (val) {
        if (val.macd) series.macd.setData(val.macd);
        if (val.signal) series.signal.setData(val.signal);
        if (val.histogram) {
            const colored = val.histogram.map((d: any) => ({
                ...d,
                color: d.value >= 0 ? (ind.histUpColor || '#26A69A') : (ind.histDownColor || '#EF5350')
            }));
            series.histogram.setData(colored);
        }
    }
};

/**
 * Update Bollinger Bands series
 */
export const updateBollingerBandsSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.upper.applyOptions({ visible: isVisible, color: ind.upperColor || '#2962FF' });
    series.middle.applyOptions({ visible: isVisible, color: ind.basisColor || '#FF6D00' });
    series.lower.applyOptions({ visible: isVisible, color: ind.lowerColor || '#2962FF' });

    const val = calculateBollingerBands(data, ind.period || 20, ind.stdDev || 2);
    if (val) {
        series.upper.setData(val.upper);
        series.middle.setData(val.middle);
        series.lower.setData(val.lower);
    }
};

/**
 * Update Stochastic series
 */
export const updateStochasticSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.k.applyOptions({ visible: isVisible, color: ind.kColor || '#2962FF' });
    series.d.applyOptions({ visible: isVisible, color: ind.dColor || '#FF6D00' });

    const val = calculateStochastic(data, ind.kPeriod || 14, ind.dPeriod || 3, ind.smooth || 3);
    if (val) {
        series.k.setData(val.kLine);
        series.d.setData(val.dLine);
    }
};

/**
 * Update ATR series
 */
export const updateATRSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    if (series.applyOptions) series.applyOptions({ visible: isVisible, color: ind.color || '#FF9800' });
    const val = calculateATR(data, ind.period || 14);
    if (val) series.setData(val);
};

/**
 * Update Supertrend series
 */
export const updateSupertrendSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible });
    const val = calculateSupertrend(data, ind.period || 10, ind.multiplier || 3);
    if (val) {
        const colored = val.map((d: any) => ({
            ...d,
            color: d.trend === 1 ? (ind.upColor || CHART_COLORS.UP.primary) : (ind.downColor || CHART_COLORS.DOWN.primary)
        }));
        series.setData(colored);
    }
};

/**
 * Update Volume series - TradingView style
 */
export const updateVolumeSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    if (!series?.bars || !data) return;

    // Apply visibility
    series.bars.applyOptions({ visible: isVisible });

    // Use simple volume calculation (close vs previous close)
    const volumeData = calculateVolume(
        data,
        ind.colorUp || '#26A69A',
        ind.colorDown || '#EF5350'
    );

    series.bars.setData(volumeData);

    // No MA line to update
};

/**
 * Update ANN Strategy series
 * @returns markers for signals
 */
export const updateANNStrategySeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): ChartMarker[] => {
    const markers: ChartMarker[] = [];

    if (series.prediction) {
        series.prediction.applyOptions({
            visible: isVisible,
            lineColor: ind.predictionColor || '#00BCD4'
        });

        // Update threshold lines
        const thresholdValue = ind.threshold || 0.0014;
        if (series.prediction._upperThreshold) {
            series.prediction._upperThreshold.applyOptions({
                price: thresholdValue,
                color: ind.longColor || '#26A69A'
            });
        }
        if (series.prediction._lowerThreshold) {
            series.prediction._lowerThreshold.applyOptions({
                price: -thresholdValue,
                color: ind.shortColor || '#EF5350'
            });
        }

        // Calculate ANN predictions
        const result = calculateANNStrategy(data, {
            threshold: ind.threshold || 0.0014,
            longColor: ind.longColor || '#26A69A',
            shortColor: ind.shortColor || '#EF5350',
            showSignals: ind.showSignals !== false,
            showBackground: ind.showBackground !== false
        });

        // Set prediction data
        if (result.predictions && result.predictions.length > 0) {
            series.prediction.setData(result.predictions);
        }

        // Set background area data for signal coloring on main chart
        if ((series.bgLong || series.bgShort) && result.signals && result.signals.length > 0 && ind.showBackground !== false && isVisible) {
            // Calculate price range for background
            const priceMax = Math.max(...data.map(d => d.high));
            const priceMin = Math.min(...data.map(d => d.low));
            const padding = (priceMax - priceMin) * 0.1;
            const bgTop = priceMax + padding;
            const bgBottom = priceMin - padding;

            // Create data for LONG background
            const longBgData = result.signals.map((sig: any) => ({
                time: sig.time,
                value: sig.buying === true ? bgTop : bgBottom
            }));

            // Create data for SHORT background
            const shortBgData = result.signals.map((sig: any) => ({
                time: sig.time,
                value: sig.buying === false ? bgTop : bgBottom
            }));

            if (series.bgLong) series.bgLong.setData(longBgData);
            if (series.bgShort) series.bgShort.setData(shortBgData);
        } else {
            if (series.bgLong) series.bgLong.setData([]);
            if (series.bgShort) series.bgShort.setData([]);
        }

        // Collect markers for buy/sell signals
        if (result.markers && result.markers.length > 0 && isVisible) {
            markers.push(...result.markers);
        }
    }

    return markers;
};

/**
 * Update Hilenga-Milenga series
 */
export const updateHilengaMilengaSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    if (series.rsi) series.rsi.applyOptions({ visible: isVisible, color: ind.rsiColor || '#131722' });
    if (series.ema) series.ema.applyOptions({ visible: isVisible, color: ind.emaColor || '#26A69A' });
    if (series.wma) series.wma.applyOptions({ visible: isVisible, color: ind.wmaColor || '#EF5350' });
    if (series.baseline) series.baseline.applyOptions({ visible: isVisible });

    const result = calculateHilengaMilenga(data, {
        rsiLength: ind.rsiLength || 14,
        emaLength: ind.emaLength || 5,
        wmaLength: ind.wmaLength || 45
    } as any) as any;

    if (result) {
        if (result.rsi && series.rsi) series.rsi.setData(result.rsi);
        if (result.ema && series.ema) series.ema.setData(result.ema);
        if (result.wma && series.wma) series.wma.setData(result.wma);
        if (result.baseline && series.baseline) series.baseline.setData(result.baseline);
    }
};

/**
 * Update ADX series
 */
export const updateADXSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    if (series.adx) series.adx.applyOptions({ visible: isVisible, color: ind.adxColor || '#FF9800', lineWidth: ind.lineWidth || 2 });
    if (series.plusDI) series.plusDI.applyOptions({ visible: isVisible, color: ind.plusDIColor || '#26A69A' });
    if (series.minusDI) series.minusDI.applyOptions({ visible: isVisible, color: ind.minusDIColor || '#EF5350' });

    const val = calculateADX(data, ind.period || 14);
    if (val) {
        if (val.adx && series.adx) series.adx.setData(val.adx);
        if (val.plusDI && series.plusDI) series.plusDI.setData(val.plusDI);
        if (val.minusDI && series.minusDI) series.minusDI.setData(val.minusDI);
    }
};

/**
 * Update Ichimoku series
 */
export const updateIchimokuSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    if (series.tenkan) series.tenkan.applyOptions({ visible: isVisible, color: ind.tenkanColor || '#2962FF' });
    if (series.kijun) series.kijun.applyOptions({ visible: isVisible, color: ind.kijunColor || '#EF5350' });
    if (series.senkouA) series.senkouA.applyOptions({ visible: isVisible, color: ind.senkouAColor || '#26A69A' });
    if (series.senkouB) series.senkouB.applyOptions({ visible: isVisible, color: ind.senkouBColor || '#EF5350' });
    if (series.chikou) series.chikou.applyOptions({ visible: isVisible, color: ind.chikouColor || '#9C27B0' });

    const val = calculateIchimoku(
        data,
        ind.tenkanPeriod || 9,
        ind.kijunPeriod || 26,
        ind.senkouBPeriod || 52,
        ind.displacement || 26
    );

    if (val) {
        if (val.tenkan && series.tenkan) series.tenkan.setData(val.tenkan);
        if (val.kijun && series.kijun) series.kijun.setData(val.kijun);
        if (val.senkouA && series.senkouA) series.senkouA.setData(val.senkouA);
        if (val.senkouB && series.senkouB) series.senkouB.setData(val.senkouB);
        if (val.chikou && series.chikou) series.chikou.setData(val.chikou);
    }
};

/**
 * Update Pivot Points series
 */
export const updatePivotPointsSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    const lineWidth = ind.lineWidth || 1;

    if (series.pivot) series.pivot.applyOptions({ visible: isVisible, color: ind.pivotColor || '#FF9800', lineWidth, title: ind.showTitle !== false ? 'P' : '' });
    if (series.r1) series.r1.applyOptions({ visible: isVisible, color: ind.resistanceColor || '#EF5350', lineWidth, title: ind.showTitle !== false ? 'R1' : '' });
    if (series.r2) series.r2.applyOptions({ visible: isVisible, color: ind.resistanceColor || '#EF5350', lineWidth, title: ind.showTitle !== false ? 'R2' : '' });
    if (series.r3) series.r3.applyOptions({ visible: isVisible, color: ind.resistanceColor || '#EF5350', lineWidth, title: ind.showTitle !== false ? 'R3' : '' });
    if (series.s1) series.s1.applyOptions({ visible: isVisible, color: ind.supportColor || '#26A69A', lineWidth, title: ind.showTitle !== false ? 'S1' : '' });
    if (series.s2) series.s2.applyOptions({ visible: isVisible, color: ind.supportColor || '#26A69A', lineWidth, title: ind.showTitle !== false ? 'S2' : '' });
    if (series.s3) series.s3.applyOptions({ visible: isVisible, color: ind.supportColor || '#26A69A', lineWidth, title: ind.showTitle !== false ? 'S3' : '' });

    const val = calculatePivotPoints(data, ind.pivotType || 'classic', ind.timeframe || 'daily');
    if (val) {
        if (val.pivot && series.pivot) series.pivot.setData(val.pivot);
        if (val.r1 && series.r1) series.r1.setData(val.r1);
        if (val.r2 && series.r2) series.r2.setData(val.r2);
        if (val.r3 && series.r3) series.r3.setData(val.r3);
        if (val.s1 && series.s1) series.s1.setData(val.s1);
        if (val.s2 && series.s2) series.s2.setData(val.s2);
        if (val.s3 && series.s3) series.s3.setData(val.s3);
    }
};

/**
 * Update Pine Script indicator series
 * Attempts to calculate common indicators (EMA, SMA) directly from Pine code
 */
export const updatePineSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({
        visible: isVisible,
        color: ind.pineColor || '#2962FF',
        lineWidth: ind.pineLineWidth || 2,
        title: ind.name || 'Pine Script'
    });

    // If we have cached Pine result data, use it
    if (ind.pineResultData && Array.isArray(ind.pineResultData)) {
        const chartData = ind.pineResultData
            .map((value: number, index: number) => {
                if (index >= data.length || value === null || value === undefined || isNaN(value)) {
                    return null;
                }
                return { time: data[index].time, value: value };
            })
            .filter((d: any) => d !== null);

        if (chartData.length > 0) {
            series.setData(chartData);
            return;
        }
    }

    // Try to calculate directly from Pine code if it's a simple indicator
    const pineCode = ind.pineCode as string || '';
    const length = (ind.length as number) || 14;
    const source = (ind.source as string) || 'close';

    // Get source data based on input
    const getSourceData = (d: OHLCData): number => {
        switch (source) {
            case 'open': return d.open;
            case 'high': return d.high;
            case 'low': return d.low;
            case 'hl2': return (d.high + d.low) / 2;
            case 'hlc3': return (d.high + d.low + d.close) / 3;
            case 'ohlc4': return (d.open + d.high + d.low + d.close) / 4;
            default: return d.close;
        }
    };

    let calculatedData: { time: number; value: number }[] | null = null;

    // Detect EMA pattern: ta.ema(source, length)
    if (/ta\.ema\s*\(/.test(pineCode)) {
        const sourceData = data.map(getSourceData);
        const emaValues: number[] = [];
        const multiplier = 2 / (length + 1);
        let ema = sourceData[0];

        for (let i = 0; i < sourceData.length; i++) {
            if (i === 0) {
                ema = sourceData[i];
            } else {
                ema = (sourceData[i] - ema) * multiplier + ema;
            }
            emaValues.push(ema);
        }

        calculatedData = data.map((d, i) => ({ time: d.time, value: emaValues[i] }));
    }
    // Detect SMA pattern: ta.sma(source, length)
    else if (/ta\.sma\s*\(/.test(pineCode)) {
        const sourceData = data.map(getSourceData);
        calculatedData = data.map((d, i) => {
            if (i < length - 1) {
                return { time: d.time, value: sourceData[i] };
            }
            const sum = sourceData.slice(i - length + 1, i + 1).reduce((a, b) => a + b, 0);
            return { time: d.time, value: sum / length };
        });
    }
    // Detect RSI pattern: ta.rsi(source, length)
    else if (/ta\.rsi\s*\(/.test(pineCode)) {
        const rsiData = calculateRSI(data, length);
        if (rsiData) {
            calculatedData = rsiData;
        }
    }

    if (calculatedData && calculatedData.length > 0) {
        series.setData(calculatedData);
    } else {
        // No data available - script couldn't be executed
        // Show empty series with a title indicating the issue
        series.applyOptions({
            title: ind.name ? `${ind.name} (unsupported)` : 'Pine Script (unsupported)',
        });
        // Set empty data - don't show misleading close prices
        series.setData([]);
    }
};

/**
 * Update CCI series
 */
export const updateCCISeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible, color: ind.color || '#2962FF' });
    if (series._obLine) {
        series._obLine.applyOptions({ price: ind.overbought ?? 100, color: ind.overboughtColor || CHART_COLORS.DOWN.primary });
    }
    if (series._osLine) {
        series._osLine.applyOptions({ price: ind.oversold ?? -100, color: ind.oversoldColor || CHART_COLORS.UP.primary });
    }
    const val = calculateCCI(data, ind.period || 20);
    if (val && val.length > 0) series.setData(val);
};

/**
 * Update MFI series
 */
export const updateMFISeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible, color: ind.color || '#00BCD4' });
    if (series._obLine) {
        series._obLine.applyOptions({ price: ind.overbought ?? 80, color: ind.overboughtColor || CHART_COLORS.DOWN.primary });
    }
    if (series._osLine) {
        series._osLine.applyOptions({ price: ind.oversold ?? 20, color: ind.oversoldColor || CHART_COLORS.UP.primary });
    }
    const val = calculateMFI(data, ind.period || 14);
    if (val && val.length > 0) series.setData(val);
};

/**
 * Update OBV series
 */
export const updateOBVSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible, color: ind.color || '#2962FF' });
    const val = calculateOBV(data);
    if (val && val.length > 0) series.setData(val);
};

/**
 * Update Williams %R series
 */
export const updateWilliamsRSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible, color: ind.color || '#7B1FA2' });
    if (series._obLine) {
        series._obLine.applyOptions({ price: ind.overbought ?? -20, color: ind.overboughtColor || CHART_COLORS.DOWN.primary });
    }
    if (series._osLine) {
        series._osLine.applyOptions({ price: ind.oversold ?? -80, color: ind.oversoldColor || CHART_COLORS.UP.primary });
    }
    const val = calculateWilliamsR(data, ind.period || 14);
    if (val && val.length > 0) series.setData(val);
};

/**
 * Update Donchian Channel series
 */
export const updateDonchianSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.upper.applyOptions({ visible: isVisible, color: ind.upperColor || '#2962FF', lineWidth: ind.lineWidth || 1 });
    series.mid.applyOptions({ visible: isVisible, color: ind.midColor || '#9E9E9E', lineWidth: ind.lineWidth || 1 });
    series.lower.applyOptions({ visible: isVisible, color: ind.lowerColor || '#2962FF', lineWidth: ind.lineWidth || 1 });
    const val = calculateDonchianChannel(data, ind.period || 20);
    if (val) {
        if (val.upper.length > 0) series.upper.setData(val.upper);
        if (val.mid.length > 0) series.mid.setData(val.mid);
        if (val.lower.length > 0) series.lower.setData(val.lower);
    }
};

/**
 * Update Keltner Channel series
 */
export const updateKeltnerSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.upper.applyOptions({ visible: isVisible, color: ind.upperColor || '#FF6D00', lineWidth: ind.lineWidth || 1 });
    series.mid.applyOptions({ visible: isVisible, color: ind.midColor || '#9E9E9E', lineWidth: ind.lineWidth || 1 });
    series.lower.applyOptions({ visible: isVisible, color: ind.lowerColor || '#FF6D00', lineWidth: ind.lineWidth || 1 });
    const val = calculateKeltnerChannel(data, ind.emaPeriod || 20, ind.atrPeriod || 10, ind.multiplier || 2.0);
    if (val) {
        if (val.upper.length > 0) series.upper.setData(val.upper);
        if (val.mid.length > 0) series.mid.setData(val.mid);
        if (val.lower.length > 0) series.lower.setData(val.lower);
    }
};

/**
 * Update ZigZag series — emits no line data (primitive does the drawing),
 * but we store the pivot data on the series object for future use.
 */
export const updateZigZagSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): ChartMarker[] => {
    // ZigZag uses a canvas primitive stored on series._primitive
    const pivots = calculateZigZag(data, ind.deviation || 5);
    if (series._primitive && typeof series._primitive.update === 'function') {
        series._primitive.update(pivots, ind.color || '#FF9800', ind.showLabels !== false);
    }
    // Also emit markers for each pivot as fallback
    if (!isVisible) return [];
    return pivots.map(p => ({
        time: p.time,
        position: p.type === 'high' ? ('aboveBar' as const) : ('belowBar' as const),
        color: ind.color || '#FF9800',
        shape: 'circle' as const,
        text: p.type === 'high' ? 'H' : 'L'
    }));
};

/**
 * Update RSI Divergence series — returns markers for bullish/bearish divergences
 */
export const updateRSIDivergenceSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): ChartMarker[] => {
    if (!isVisible) return [];
    const divergences = detectRSIDivergences(data, ind.rsiPeriod || 14, ind.swingLookback || 5);
    return divergences.map(div => ({
        time: div.time2,
        position: div.type === 'bullish_regular' ? ('belowBar' as const) : ('aboveBar' as const),
        color: div.type === 'bullish_regular' ? (ind.bullColor || '#26A69A') : (ind.bearColor || '#EF5350'),
        shape: div.type === 'bullish_regular' ? ('arrowUp' as const) : ('arrowDown' as const),
        text: div.type === 'bullish_regular' ? 'Bull Div' : 'Bear Div'
    }));
};

/**
 * Update Stochastic RSI series
 */
export const updateStochasticRSISeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.k.applyOptions({ visible: isVisible, color: ind.kColor || '#2962FF' });
    series.d.applyOptions({ visible: isVisible, color: ind.dColor || '#FF6D00' });
    if (series.k._obLine) {
        series.k._obLine.applyOptions({ price: ind.overbought ?? 80, color: ind.overboughtColor || CHART_COLORS.DOWN.primary });
    }
    if (series.k._osLine) {
        series.k._osLine.applyOptions({ price: ind.oversold ?? 20, color: ind.oversoldColor || CHART_COLORS.UP.primary });
    }
    const val = calculateStochasticRSI(data, ind.rsiPeriod || 14, ind.stochPeriod || 14, ind.kSmooth || 3, ind.dSmooth || 3);
    if (val) {
        if (val.k.length > 0) series.k.setData(val.k);
        if (val.d.length > 0) series.d.setData(val.d);
    }
};

/**
 * Update Previous Day OHLC Lines
 */
export const updatePrevDayOHLCSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    const showHigh  = ind.showHigh  !== false;
    const showLow   = ind.showLow   !== false;
    const showClose = ind.showClose !== false;
    const showOpen  = ind.showOpen  === true;

    series.high.applyOptions({  visible: isVisible && showHigh,  color: ind.highColor  || '#F23645', lineWidth: 1 });
    series.low.applyOptions({   visible: isVisible && showLow,   color: ind.lowColor   || '#089981', lineWidth: 1 });
    series.close.applyOptions({ visible: isVisible && showClose, color: ind.closeColor || '#B2B5BE', lineWidth: 1 });
    series.open.applyOptions({  visible: isVisible && showOpen,  color: ind.openColor  || '#2962FF', lineWidth: 1 });

    const result = calculatePrevDayOHLC(data, showOpen, showHigh, showLow, showClose);

    // Group levels by label
    const highData:  Array<{ time: number; value: number }> = [];
    const lowData:   Array<{ time: number; value: number }> = [];
    const closeData: Array<{ time: number; value: number }> = [];
    const openData:  Array<{ time: number; value: number }> = [];

    // Deduplicate: only one entry per time per label (take first occurrence)
    const seen = { PDH: new Set<number>(), PDL: new Set<number>(), PDC: new Set<number>(), PDO: new Set<number>() };
    for (const lv of result.levels) {
        if (seen[lv.label].has(lv.time)) continue;
        seen[lv.label].add(lv.time);
        if      (lv.label === 'PDH') highData.push({ time: lv.time, value: lv.value });
        else if (lv.label === 'PDL') lowData.push({ time: lv.time, value: lv.value });
        else if (lv.label === 'PDC') closeData.push({ time: lv.time, value: lv.value });
        else if (lv.label === 'PDO') openData.push({ time: lv.time, value: lv.value });
    }

    series.high.setData(highData);
    series.low.setData(lowData);
    series.close.setData(closeData);
    series.open.setData(openData);
};

/**
 * Update HMA series (overlay)
 */
export const updateHMASeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible, color: ind.color || '#9C27B0', lineWidth: ind.lineWidth || 2 });
    const val = calculateHMA(data, ind.period || 20);
    if (val && val.length > 0) series.setData(val);
};

/**
 * Update ROC series
 */
export const updateROCSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.applyOptions({ visible: isVisible, color: ind.color || '#2962FF' });
    const val = calculateROC(data, ind.period || 14);
    if (val && val.length > 0) series.setData(val);
};

/**
 * Update Parabolic SAR — renders as circle markers above/below price
 */
export const updatePSARSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): ChartMarker[] => {
    if (!isVisible) return [];
    const sarPoints = calculateParabolicSAR(data, ind.step || 0.02, ind.maxAF || 0.2);
    return sarPoints.map(p => ({
        time: p.time,
        position: p.trend === 'bull' ? ('belowBar' as const) : ('aboveBar' as const),
        color: p.trend === 'bull' ? (ind.bullColor || '#089981') : (ind.bearColor || '#F23645'),
        shape: 'circle' as const,
        text: ''
    }));
};

/**
 * Update Candlestick Pattern Recognition — returns ChartMarker[] for each detected pattern
 */
export const updateCandlePatternsSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): ChartMarker[] => {
    if (!isVisible) return [];
    const patterns = detectCandlePatterns(data as any, {
        showDoji: ind.showDoji !== false,
        showHammer: ind.showHammer !== false,
        showInvertedHammer: ind.showInvertedHammer !== false,
        showShootingStar: ind.showShootingStar !== false,
        showSpinningTop: ind.showSpinningTop !== false,
        showMarubozu: ind.showMarubozu !== false,
        showEngulfing: ind.showEngulfing !== false,
        showPiercingDarkCloud: ind.showPiercingDarkCloud !== false,
        showHarami: ind.showHarami !== false,
        showMorningStar: ind.showMorningStar !== false,
        showEveningStar: ind.showEveningStar !== false,
        showThreeSoldiersCrows: ind.showThreeSoldiersCrows !== false,
    });
    return patterns.map(p => ({
        time: p.time,
        position: p.type === 'bearish' ? ('aboveBar' as const) : ('belowBar' as const),
        color: p.type === 'bearish' ? (ind.bearColor || '#EF5350') : p.type === 'bullish' ? (ind.bullColor || '#26A69A') : (ind.neutralColor || '#9E9E9E'),
        shape: p.type === 'bearish' ? ('arrowDown' as const) : ('arrowUp' as const),
        text: ind.showLabels !== false ? p.name : ''
    }));
};

/**
 * Update Squeeze Momentum series — histogram + squeeze-state dot markers
 */
export const updateSqueezeSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): ChartMarker[] => {
    const bullColor  = ind.bullColor  || '#26A69A';
    const bearColor  = ind.bearColor  || '#EF5350';
    const sqzOnColor = ind.sqzOnColor || '#F23645';
    const sqzOffColor = ind.sqzOffColor || '#089981';

    series.hist.applyOptions({ visible: isVisible });
    series.dots.applyOptions({ visible: false });

    if (!isVisible || data.length < 20) return [];

    const result = calculateSqueeze(
        data as any,
        ind.bbPeriod || 20,
        ind.bbMult   || 2.0,
        ind.kcPeriod || 20,
        ind.kcMult   || 1.5
    );

    if (!result.momentum.length) return [];

    // Color histogram by value direction
    const histData = result.momentum.map((p, i) => {
        const prev = i > 0 ? result.momentum[i - 1].value : 0;
        const rising = p.value >= prev;
        const pos = p.value >= 0;
        return {
            time: p.time,
            value: p.value,
            color: pos ? (rising ? bullColor : '#52b2a0') : (rising ? '#f07070' : bearColor)
        };
    });
    series.hist.setData(histData);

    // Return dot markers for squeeze state
    return result.squeezeOn.map(s => ({
        time: s.time,
        position: 'belowBar' as const,
        color: s.on ? sqzOnColor : sqzOffColor,
        shape: 'circle' as const,
        text: ''
    }));
};

/**
 * Update Linear Regression Channel (3 overlay lines)
 */
export const updateLinearRegressionSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    const midColor   = ind.midColor   || '#2962FF';
    const bandColor  = ind.bandColor  || '#FF6D00';
    const lw         = ind.lineWidth  || 2;

    series.mid.applyOptions({   visible: isVisible, color: midColor,  lineWidth: lw });
    series.upper.applyOptions({ visible: isVisible, color: bandColor, lineWidth: 1  });
    series.lower.applyOptions({ visible: isVisible, color: bandColor, lineWidth: 1  });

    const val = calculateLinearRegression(data as any, ind.period || 100, ind.multiplier || 2.0, ind.source || 'close');
    if (val.mid.length > 0) {
        series.mid.setData(val.mid);
        series.upper.setData(val.upper);
        series.lower.setData(val.lower);
    }
};

/**
 * Update VWAP Bands series (VWAP + 2 upper/lower SD bands)
 */
export const updateVWAPBandsSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): void => {
    series.vwap.applyOptions({   visible: isVisible, color: ind.vwapColor   || '#2962FF', lineWidth: 2 });
    series.upper1.applyOptions({ visible: isVisible, color: ind.band1Color  || '#FF6D00', lineWidth: 1 });
    series.lower1.applyOptions({ visible: isVisible, color: ind.band1Color  || '#FF6D00', lineWidth: 1 });
    series.upper2.applyOptions({ visible: isVisible, color: ind.band2Color  || '#9C27B0', lineWidth: 1 });
    series.lower2.applyOptions({ visible: isVisible, color: ind.band2Color  || '#9C27B0', lineWidth: 1 });

    const val = calculateVWAPBands(data, ind.stdDev || 2, ind.resetDaily !== false);
    if (val) {
        if (val.vwap.length > 0)    series.vwap.setData(val.vwap);
        if (val.upperBand1.length > 0) series.upper1.setData(val.upperBand1);
        if (val.lowerBand1.length > 0) series.lower1.setData(val.lowerBand1);
        if (val.upperBand2.length > 0) series.upper2.setData(val.upperBand2);
        if (val.lowerBand2.length > 0) series.lower2.setData(val.lowerBand2);
    }
};

/**
 * Main update function - updates series for any indicator type
 * @returns markers (for indicators that generate markers like ANN Strategy)
 */
export const updateIndicatorSeries = (series: any, ind: IndicatorConfig, data: OHLCData[], isVisible: boolean): ChartMarker[] => {
    const { type } = ind;

    switch (type) {
        case 'sma':
        case 'ema':
        case 'vwap':
            updateOverlaySeries(series, ind, data, isVisible);
            return [];

        case 'rsi':
            updateRSISeries(series, ind, data, isVisible);
            return [];

        case 'macd':
            updateMACDSeries(series, ind, data, isVisible);
            return [];

        case 'bollingerBands':
            updateBollingerBandsSeries(series, ind, data, isVisible);
            return [];

        case 'stochastic':
            updateStochasticSeries(series, ind, data, isVisible);
            return [];

        case 'atr':
            updateATRSeries(series, ind, data, isVisible);
            return [];

        case 'supertrend':
            updateSupertrendSeries(series, ind, data, isVisible);
            return [];

        case 'volume':
            updateVolumeSeries(series, ind, data, isVisible);
            return [];

        case 'annStrategy':
            return updateANNStrategySeries(series, ind, data, isVisible);

        case 'hilengaMilenga':
            updateHilengaMilengaSeries(series, ind, data, isVisible);
            return [];

        case 'adx':
            updateADXSeries(series, ind, data, isVisible);
            return [];

        case 'ichimoku':
            updateIchimokuSeries(series, ind, data, isVisible);
            return [];

        case 'pivotPoints':
            updatePivotPointsSeries(series, ind, data, isVisible);
            return [];

        case 'pine':
            updatePineSeries(series, ind, data, isVisible);
            return [];

        case 'cci':
            updateCCISeries(series, ind, data, isVisible);
            return [];

        case 'mfi':
            updateMFISeries(series, ind, data, isVisible);
            return [];

        case 'obv':
            updateOBVSeries(series, ind, data, isVisible);
            return [];

        case 'willr':
            updateWilliamsRSeries(series, ind, data, isVisible);
            return [];

        case 'donchian':
            updateDonchianSeries(series, ind, data, isVisible);
            return [];

        case 'keltner':
            updateKeltnerSeries(series, ind, data, isVisible);
            return [];

        case 'zigzag':
            return updateZigZagSeries(series, ind, data, isVisible);

        case 'rsi_divergence':
            return updateRSIDivergenceSeries(series, ind, data, isVisible);

        case 'stochastic_rsi':
            updateStochasticRSISeries(series, ind, data, isVisible);
            return [];

        case 'prev_day_ohlc':
            updatePrevDayOHLCSeries(series, ind, data, isVisible);
            return [];

        case 'hma':
            updateHMASeries(series, ind, data, isVisible);
            return [];

        case 'roc':
            updateROCSeries(series, ind, data, isVisible);
            return [];

        case 'psar':
            return updatePSARSeries(series, ind, data, isVisible);

        case 'vwap_bands':
            updateVWAPBandsSeries(series, ind, data, isVisible);
            return [];

        case 'candle_patterns':
            return updateCandlePatternsSeries(series, ind, data, isVisible);

        case 'squeeze':
            return updateSqueezeSeries(series, ind, data, isVisible);

        case 'linear_regression':
            updateLinearRegressionSeries(series, ind, data, isVisible);
            return [];

        default:
            return [];
    }
};
