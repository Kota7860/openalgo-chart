/**
 * SMC Overlay Primitive
 * Draws SMC/ICT structures directly on the main chart canvas.
 * Follows the same pattern as TPOProfilePrimitive (direct ISeriesPrimitive implementation).
 */

import type {
  IChartApi,
  ISeriesApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  SeriesAttachedParameter,
  SeriesOptionsMap,
  Time,
} from 'lightweight-charts';

import type {
  OrderBlock,
  FairValueGap,
  StructureBreak,
  LiquidityLevel,
  SwingPoint,
  BreakerBlock,
  ImpulsiveCandle,
  LiquiditySweep,
} from '../../services/smcDetectionService';

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

export interface SMCOverlayColors {
  obBullishFill:   string;
  obBullishStroke: string;
  obBearishFill:   string;
  obBearishStroke: string;
  fvgBullish:      string;
  fvgBearish:      string;
  bosColor:        string;
  chochColor:      string;
  liquidityHigh:   string;
  liquidityLow:    string;
}

export const DEFAULT_SMC_COLORS: SMCOverlayColors = {
  obBullishFill:   'rgba(38,166,154,0.18)',
  obBullishStroke: 'rgba(38,166,154,0.8)',
  obBearishFill:   'rgba(239,83,80,0.18)',
  obBearishStroke: 'rgba(239,83,80,0.8)',
  fvgBullish:      'rgba(38,166,154,0.12)',
  fvgBearish:      'rgba(239,83,80,0.12)',
  bosColor:        '#2962ff',
  chochColor:      '#ff9800',
  liquidityHigh:   '#ef5350',
  liquidityLow:    '#26a69a',
};

export interface SMCOverlayData {
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  structureBreaks: StructureBreak[];
  liquidityLevels: LiquidityLevel[];
  swingPoints: SwingPoint[];
  breakerBlocks: BreakerBlock[];
  impulsiveCandles: ImpulsiveCandle[];
  liquiditySweeps: LiquiditySweep[];
}

export interface SMCOverlayOptions {
  showOrderBlocks: boolean;
  showFVGs: boolean;
  showStructureBreaks: boolean;
  showLiquidityLevels: boolean;
  showSwingPoints: boolean;
  showBreakerBlocks: boolean;
  showImpulsiveCandles: boolean;
  showLiquiditySweeps: boolean;
  colors: SMCOverlayColors;
}

const DEFAULT_DATA: SMCOverlayData = {
  orderBlocks: [],
  fairValueGaps: [],
  structureBreaks: [],
  liquidityLevels: [],
  swingPoints: [],
  breakerBlocks: [],
  impulsiveCandles: [],
  liquiditySweeps: [],
};

const DEFAULT_OPTIONS: SMCOverlayOptions = {
  showOrderBlocks: true,
  showFVGs: true,
  showStructureBreaks: true,
  showLiquidityLevels: true,
  showSwingPoints: true,
  showBreakerBlocks: true,
  showImpulsiveCandles: true,
  showLiquiditySweeps: true,
  colors: DEFAULT_SMC_COLORS,
};

// ────────────────────────────────────────────────────────────────────────────
// Renderer
// ────────────────────────────────────────────────────────────────────────────

interface BitmapScope {
  context: CanvasRenderingContext2D;
  bitmapSize: { width: number; height: number };
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}

class SMCPaneRenderer implements IPrimitivePaneRenderer {
  private _source: SMCOverlayPrimitive;

  constructor(source: SMCOverlayPrimitive) {
    this._source = source;
  }

  draw(target: { useBitmapCoordinateSpace: (cb: (scope: BitmapScope) => void) => void }): void {
    target.useBitmapCoordinateSpace((scope) => {
      const { context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio } = scope;
      const src = this._source;

      if (!src._chart || !src._series) return;

      const timeScale = src._chart.timeScale();
      const series    = src._series;
      const data      = src._data;
      const opts      = src._options;
      const clr       = opts.colors;

      // Visible time range for frustum culling
      const visibleRange = timeScale.getVisibleRange();
      const fromTime = visibleRange ? (visibleRange.from as unknown as number) : -Infinity;
      const toTime   = visibleRange ? (visibleRange.to   as unknown as number) : Infinity;

      // Helper: time → pixel X
      const tx = (t: number): number | null => {
        const c = timeScale.timeToCoordinate(t as Time);
        return c === null ? null : c * horizontalPixelRatio;
      };

      // Helper: price → pixel Y
      const py = (p: number): number | null => {
        const c = series.priceToCoordinate(p);
        return c === null ? null : c * verticalPixelRatio;
      };

      // Time culling helpers
      const timeVisible = (start: number, end: number) => end >= fromTime && start <= toTime;
      const priceVisible = (high: number, low: number) => {
        const yH = py(high);
        const yL = py(low);
        if (yH === null || yL === null) return true;
        return Math.max(yH, yL) >= 0 && Math.min(yH, yL) <= bitmapSize.height;
      };

      ctx.save();

      // ── Impulse Candle Highlights ─────────────────────────────────────────
      if (opts.showImpulsiveCandles) {
        for (const ic of data.impulsiveCandles) {
          if (!timeVisible(ic.time, ic.time)) continue;
          const x = tx(ic.time);
          if (x === null) continue;

          const barW = Math.max(4 * horizontalPixelRatio, 2);
          ctx.save();
          ctx.fillStyle = ic.direction === 'bullish'
            ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
          ctx.fillRect(x - barW / 2, 0, barW, bitmapSize.height);
          ctx.restore();
        }
      }

      // ── Order Blocks ─────────────────────────────────────────────────────
      if (opts.showOrderBlocks) {
        for (const ob of data.orderBlocks) {
          if (!timeVisible(ob.startTime, ob.endTime ?? toTime)) continue;
          if (!priceVisible(ob.high, ob.low)) continue;

          const x1 = tx(ob.startTime);
          const yH = py(ob.high);
          const yL = py(ob.low);
          if (x1 === null || yH === null || yL === null) continue;

          const x2     = tx(ob.endTime) ?? bitmapSize.width;
          const xStart = Math.min(x1, x2);
          const width  = Math.max(Math.abs(x2 - x1), 4);
          const top    = Math.min(yH, yL);
          const height = Math.max(Math.abs(yH - yL), 2);

          ctx.fillStyle   = ob.type === 'bullish' ? clr.obBullishFill   : clr.obBearishFill;
          ctx.strokeStyle = ob.type === 'bullish' ? clr.obBullishStroke : clr.obBearishStroke;

          ctx.fillRect(xStart, top, width, height);
          ctx.lineWidth = 1 * horizontalPixelRatio;
          ctx.strokeRect(xStart, top, width, height);

          ctx.fillStyle = ob.type === 'bullish' ? clr.obBullishStroke : clr.obBearishStroke;
          ctx.font = `${10 * horizontalPixelRatio}px monospace`;
          ctx.fillText('OB', xStart + 3 * horizontalPixelRatio, top + 12 * verticalPixelRatio);
        }
      }

      // ── Breaker Blocks ───────────────────────────────────────────────────
      if (opts.showBreakerBlocks) {
        for (const bb of data.breakerBlocks) {
          if (!timeVisible(bb.startTime, bb.endTime ?? toTime)) continue;
          if (!priceVisible(bb.high, bb.low)) continue;

          const x1 = tx(bb.startTime);
          const yH = py(bb.high);
          const yL = py(bb.low);
          if (x1 === null || yH === null || yL === null) continue;

          const x2      = tx(bb.endTime) ?? bitmapSize.width;
          const xStart  = Math.min(x1, x2);
          const width   = Math.max(Math.abs(x2 - x1), 4);
          const top     = Math.min(yH, yL);
          const height  = Math.max(Math.abs(yH - yL), 2);

          const isBull      = bb.type === 'bullish';
          const fillColor   = isBull ? 'rgba(38,166,154,0.1)'  : 'rgba(239,83,80,0.1)';
          const borderColor = isBull ? clr.obBullishStroke : clr.obBearishStroke;
          const hatchColor  = isBull ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)';
          const label       = isBull ? 'BB↑' : 'BB↓';

          ctx.fillStyle = fillColor;
          ctx.fillRect(xStart, top, width, height);

          // Backward diagonal hatch (distinguishable from FVG forward hatch)
          ctx.save();
          ctx.beginPath();
          ctx.rect(xStart, top, width, height);
          ctx.clip();
          ctx.strokeStyle = hatchColor;
          ctx.lineWidth = 0.5 * horizontalPixelRatio;
          const step = 8 * horizontalPixelRatio;
          for (let hx = xStart - height; hx < xStart + width + height; hx += step) {
            ctx.beginPath();
            ctx.moveTo(hx + height, top);
            ctx.lineTo(hx, top + height);
            ctx.stroke();
          }
          ctx.restore();

          // Dashed border
          ctx.save();
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 1 * horizontalPixelRatio;
          ctx.setLineDash([4 * horizontalPixelRatio, 3 * horizontalPixelRatio]);
          ctx.strokeRect(xStart, top, width, height);
          ctx.setLineDash([]);
          ctx.restore();

          ctx.fillStyle = borderColor;
          ctx.font = `${10 * horizontalPixelRatio}px monospace`;
          ctx.fillText(label, xStart + 3 * horizontalPixelRatio, top + 12 * verticalPixelRatio);
        }
      }

      // ── Fair Value Gaps ───────────────────────────────────────────────────
      if (opts.showFVGs) {
        for (const fvg of data.fairValueGaps) {
          if (!timeVisible(fvg.time, toTime)) continue;
          if (!priceVisible(fvg.top, fvg.low)) continue;

          const x1 = tx(fvg.time);
          if (x1 === null) continue;
          const yT = py(fvg.top);
          const yL = py(fvg.low);
          if (yT === null || yL === null) continue;

          const top    = Math.min(yT, yL);
          const height = Math.max(Math.abs(yT - yL), 2);
          const width  = bitmapSize.width - x1;
          if (width <= 0) continue;

          const isBull = fvg.type === 'bullish';
          ctx.fillStyle   = isBull ? clr.fvgBullish : clr.fvgBearish;
          ctx.strokeStyle = isBull ? clr.obBullishStroke : clr.obBearishStroke;

          ctx.fillRect(x1, top, width, height);

          // Forward diagonal hatch
          ctx.save();
          ctx.beginPath();
          ctx.rect(x1, top, width, height);
          ctx.clip();
          ctx.strokeStyle = isBull ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
          ctx.lineWidth = 0.5 * horizontalPixelRatio;
          const step = 8 * horizontalPixelRatio;
          for (let hx = x1 - height; hx < x1 + width + height; hx += step) {
            ctx.beginPath();
            ctx.moveTo(hx, top);
            ctx.lineTo(hx + height, top + height);
            ctx.stroke();
          }
          ctx.restore();

          ctx.lineWidth = 1 * horizontalPixelRatio;
          ctx.beginPath();
          ctx.moveTo(x1, top);         ctx.lineTo(x1 + width, top);
          ctx.moveTo(x1, top + height); ctx.lineTo(x1 + width, top + height);
          ctx.stroke();

          ctx.fillStyle = isBull ? clr.obBullishStroke : clr.obBearishStroke;
          ctx.font = `${9 * horizontalPixelRatio}px monospace`;
          ctx.fillText('FVG', x1 + 3 * horizontalPixelRatio, top + 11 * verticalPixelRatio);
        }
      }

      // ── Structure Breaks (BOS / ChoCH) ───────────────────────────────────
      if (opts.showStructureBreaks) {
        for (const sb of data.structureBreaks) {
          if (!timeVisible(sb.prevSwingTime, toTime)) continue;
          const xStart = tx(sb.prevSwingTime);
          const y      = py(sb.level);
          if (xStart === null || y === null) continue;
          if (y < 0 || y > bitmapSize.height) continue;

          ctx.save();
          ctx.lineWidth   = 1.5 * horizontalPixelRatio;
          ctx.strokeStyle = sb.type === 'BOS' ? clr.bosColor : clr.chochColor;
          ctx.setLineDash([6 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
          ctx.beginPath();
          ctx.moveTo(xStart, y);
          ctx.lineTo(bitmapSize.width, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = sb.type === 'BOS' ? clr.bosColor : clr.chochColor;
          ctx.font = `bold ${9 * horizontalPixelRatio}px monospace`;
          const label = `${sb.type} ${sb.direction === 'bullish' ? '▲' : '▼'}`;
          ctx.fillText(label, bitmapSize.width - 60 * horizontalPixelRatio, y - 4 * verticalPixelRatio);
          ctx.restore();
        }
      }

      // ── Liquidity Levels ─────────────────────────────────────────────────
      if (opts.showLiquidityLevels) {
        for (const ll of data.liquidityLevels) {
          const y = py(ll.price);
          if (y === null || y < 0 || y > bitmapSize.height) continue;

          const isEQH = ll.type === 'equal_highs';
          ctx.save();
          ctx.strokeStyle = isEQH ? clr.liquidityHigh : clr.liquidityLow;
          ctx.lineWidth = 1 * horizontalPixelRatio;
          ctx.setLineDash([2 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(bitmapSize.width, y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Right-aligned price label
          const priceLabel = `${isEQH ? 'EQH' : 'EQL'} @ ${ll.price.toFixed(2)} (${ll.touchCount}x)`;
          ctx.fillStyle = isEQH ? clr.liquidityHigh : clr.liquidityLow;
          ctx.font = `${9 * horizontalPixelRatio}px monospace`;
          const labelWidth = ctx.measureText(priceLabel).width;
          ctx.fillText(
            priceLabel,
            bitmapSize.width - labelWidth - 4 * horizontalPixelRatio,
            y - 3 * verticalPixelRatio
          );
          ctx.restore();
        }
      }

      // ── Liquidity Sweeps ─────────────────────────────────────────────────
      if (opts.showLiquiditySweeps) {
        for (const sw of data.liquiditySweeps) {
          if (!timeVisible(sw.time, sw.time)) continue;
          const x = tx(sw.time);
          const y = py(sw.price);
          if (x === null || y === null || y < 0 || y > bitmapSize.height) continue;

          const r = 5 * horizontalPixelRatio;
          const isHigh = sw.type === 'high_sweep';
          const color  = isHigh ? clr.liquidityHigh : clr.liquidityLow;

          ctx.save();
          ctx.strokeStyle = color;
          ctx.fillStyle   = sw.strength === 'strong' ? color : color + '88';
          ctx.lineWidth   = 1.5 * horizontalPixelRatio;

          // Diamond marker
          ctx.beginPath();
          ctx.moveTo(x,     y - r);
          ctx.lineTo(x + r, y);
          ctx.lineTo(x,     y + r);
          ctx.lineTo(x - r, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Label
          ctx.fillStyle = color;
          ctx.font = `bold ${8 * horizontalPixelRatio}px monospace`;
          ctx.fillText(isHigh ? 'SWPH' : 'SWPL', x + r + 2 * horizontalPixelRatio, y + 3 * verticalPixelRatio);
          ctx.restore();
        }
      }

      // ── Swing Points ─────────────────────────────────────────────────────
      if (opts.showSwingPoints) {
        const sz = 6 * horizontalPixelRatio;
        for (const sw of data.swingPoints) {
          if (!timeVisible(sw.time, sw.time)) continue;
          const x = tx(sw.time);
          const y = py(sw.price);
          if (x === null || y === null || y < 0 || y > bitmapSize.height) continue;

          ctx.save();
          ctx.beginPath();

          if (sw.type === 'high') {
            ctx.moveTo(x, y + sz);
            ctx.lineTo(x - sz, y - sz);
            ctx.lineTo(x + sz, y - sz);
            ctx.closePath();
            ctx.fillStyle = 'rgba(239,83,80,0.7)';
          } else {
            ctx.moveTo(x, y - sz);
            ctx.lineTo(x - sz, y + sz);
            ctx.lineTo(x + sz, y + sz);
            ctx.closePath();
            ctx.fillStyle = 'rgba(38,166,154,0.7)';
          }

          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Pane View
// ────────────────────────────────────────────────────────────────────────────

class SMCPaneView implements IPrimitivePaneView {
  private _renderer: SMCPaneRenderer;

  constructor(source: SMCOverlayPrimitive) {
    this._renderer = new SMCPaneRenderer(source);
  }

  renderer(): IPrimitivePaneRenderer { return this._renderer; }
  zOrder(): 'bottom' | 'normal' | 'top' { return 'normal'; }
}

// ────────────────────────────────────────────────────────────────────────────
// Primitive — implements ISeriesPrimitive directly (same pattern as TPOProfilePrimitive)
// ────────────────────────────────────────────────────────────────────────────

export class SMCOverlayPrimitive {
  _data: SMCOverlayData    = { ...DEFAULT_DATA };
  _options: SMCOverlayOptions = { ...DEFAULT_OPTIONS };
  _chart: IChartApi | null = null;
  _series: ISeriesApi<keyof SeriesOptionsMap> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _paneViews: SMCPaneView[];

  constructor() {
    this._paneViews = [new SMCPaneView(this)];
  }

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>): void {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
    this._requestUpdate();
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }

  setData(data: SMCOverlayData): void {
    this._data = data;
    this._requestUpdate?.();
  }

  setOptions(opts: Partial<SMCOverlayOptions>): void {
    this._options = { ...this._options, ...opts };
    this._requestUpdate?.();
  }
}
