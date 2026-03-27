/**
 * Chart Domain Types
 * Types for chart configuration, indicators, and drawings
 */

import type { Exchange } from './trading';

/** Chart type */
export type ChartType =
  | 'candlestick'
  | 'line'
  | 'area'
  | 'baseline'
  | 'renko'
  | 'heikinashi';

/** Time interval for charts */
export type TimeInterval =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '3h'
  | '4h'
  | 'D'
  | '1d'
  | 'W'
  | '1w'
  | 'M'
  | '1M';

/** Indicator type */
export type IndicatorType =
  | 'sma'
  | 'ema'
  | 'rsi'
  | 'macd'
  | 'bollinger'
  | 'atr'
  | 'stochastic'
  | 'vwap'
  | 'supertrend'
  | 'volume'
  | 'pivotPoints'
  | 'ichimoku'
  | 'adx'
  | 'cci'
  | 'mfi'
  | 'obv'
  | 'willr'
  | 'donchian'
  | 'keltner'
  | 'zigzag'
  | 'rsi_divergence'
  | 'stochastic_rsi'
  | 'prev_day_ohlc'
  | 'hma'
  | 'roc'
  | 'psar'
  | 'vwap_bands'
  | 'candle_patterns'
  | 'squeeze'
  | 'linear_regression'
  | 'alligator'
  | 'aroon'
  | 'awesome_oscillator'
  | 'cmf'
  | 'dema';

/** Base indicator configuration */
export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  visible: boolean;
  paneId?: string;
}

/** SMA indicator settings */
export interface SMAIndicator extends IndicatorConfig {
  type: 'sma';
  period: number;
  color: string;
  lineWidth?: number;
  source?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
}

/** EMA indicator settings */
export interface EMAIndicator extends IndicatorConfig {
  type: 'ema';
  period: number;
  color: string;
  lineWidth?: number;
  source?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
}

/** RSI indicator settings */
export interface RSIIndicator extends IndicatorConfig {
  type: 'rsi';
  period: number;
  overbought: number;
  oversold: number;
  color: string;
}

/** MACD indicator settings */
export interface MACDIndicator extends IndicatorConfig {
  type: 'macd';
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  macdColor: string;
  signalColor: string;
  histogramPositiveColor: string;
  histogramNegativeColor: string;
}

/** Bollinger Bands indicator settings */
export interface BollingerIndicator extends IndicatorConfig {
  type: 'bollinger';
  period: number;
  stdDev: number;
  upperColor: string;
  middleColor: string;
  lowerColor: string;
  fillColor?: string;
}

/** Supertrend indicator settings */
export interface SupertrendIndicator extends IndicatorConfig {
  type: 'supertrend';
  period: number;
  multiplier: number;
  upColor: string;
  downColor: string;
}

/** Volume indicator settings */
export interface VolumeIndicator extends IndicatorConfig {
  type: 'volume';
  upColor: string;
  downColor: string;
  showMA?: boolean;
  maPeriod?: number;
  maColor?: string;
}

/** Pivot Points indicator settings */
export interface PivotPointsIndicator extends IndicatorConfig {
  type: 'pivotPoints';
  pivotType: 'classic' | 'fibonacci' | 'woodie' | 'camarilla' | 'demark';
  pivotColor: string;
  supportColor: string;
  resistanceColor: string;
}

/** Union of all indicator types */
export type Indicator =
  | SMAIndicator
  | EMAIndicator
  | RSIIndicator
  | MACDIndicator
  | BollingerIndicator
  | SupertrendIndicator
  | VolumeIndicator
  | PivotPointsIndicator
  | IndicatorConfig;

/** Drawing tool type */
export type DrawingType =
  | 'trendline'
  | 'horizontalline'
  | 'verticalline'
  | 'rectangle'
  | 'fibonacciretracement'
  | 'text'
  | 'arrow'
  | 'channel'
  | 'ray'
  | 'extendedline';

/** Drawing point */
export interface DrawingPoint {
  time: number;
  price: number;
}

/** Base drawing configuration */
export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  visible: boolean;
  locked?: boolean;
  text?: string;
  fontSize?: number;
  fillColor?: string;
  fillOpacity?: number;
}

/** Chart configuration */
export interface ChartConfig {
  id: number;
  symbol: string;
  exchange: Exchange;
  interval: TimeInterval;
  chartType?: ChartType;
  indicators: Indicator[];
  drawings?: Drawing[];
  showVolume?: boolean;
  showGrid?: boolean;
  theme?: 'light' | 'dark';
}

/** Chart pane configuration */
export interface ChartPane {
  id: string;
  height: number;
  indicators: string[];
  isMain: boolean;
}

/** Chart template */
export interface ChartTemplate {
  id: string;
  name: string;
  description?: string;
  chartType: ChartType;
  indicators: Indicator[];
  drawings?: Drawing[];
  createdAt: number;
  updatedAt: number;
}
