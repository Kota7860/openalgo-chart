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
} from '../../services/smcDetectionService';

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

export interface SMCOverlayData {
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  structureBreaks: StructureBreak[];
  liquidityLevels: LiquidityLevel[];
  swingPoints: SwingPoint[];
}

export interface SMCOverlayOptions {
  showOrderBlocks: boolean;
  showFVGs: boolean;
  showStructureBreaks: boolean;
  showLiquidityLevels: boolean;
  showSwingPoints: boolean;
}

const DEFAULT_DATA: SMCOverlayData = {
  orderBlocks: [],
  fairValueGaps: [],
  structureBreaks: [],
  liquidityLevels: [],
  swingPoints: [],
};

const DEFAULT_OPTIONS: SMCOverlayOptions = {
  showOrderBlocks: true,
  showFVGs: true,
  showStructureBreaks: true,
  showLiquidityLevels: true,
  showSwingPoints: true,
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

      ctx.save();

      // ── Order Blocks ─────────────────────────────────────────────────────
      if (opts.showOrderBlocks) {
        for (const ob of data.orderBlocks) {
          const x1 = tx(ob.startTime);
          const yH = py(ob.high);
          const yL = py(ob.low);
          if (x1 === null || yH === null || yL === null) continue;

          const x2 = tx(ob.endTime) ?? bitmapSize.width;
          const xStart = Math.min(x1, x2);
          const width  = Math.max(Math.abs(x2 - x1), 4);
          const top    = Math.min(yH, yL);
          const height = Math.abs(yH - yL);

          if (ob.type === 'bullish') {
            ctx.fillStyle = 'rgba(38,166,154,0.18)';
            ctx.strokeStyle = 'rgba(38,166,154,0.8)';
          } else {
            ctx.fillStyle = 'rgba(239,83,80,0.18)';
            ctx.strokeStyle = 'rgba(239,83,80,0.8)';
          }

          ctx.fillRect(xStart, top, width, height);
          ctx.lineWidth = 1 * horizontalPixelRatio;
          ctx.strokeRect(xStart, top, width, height);

          ctx.fillStyle = ob.type === 'bullish' ? 'rgba(38,166,154,0.9)' : 'rgba(239,83,80,0.9)';
          ctx.font = `${10 * horizontalPixelRatio}px monospace`;
          ctx.fillText('OB', xStart + 3 * horizontalPixelRatio, top + 12 * verticalPixelRatio);
        }
      }

      // ── Fair Value Gaps ───────────────────────────────────────────────────
      if (opts.showFVGs) {
        for (const fvg of data.fairValueGaps) {
          const x1 = tx(fvg.time);
          if (x1 === null) continue;
          const yT = py(fvg.top);
          const yL = py(fvg.low);
          if (yT === null || yL === null) continue;

          const top    = Math.min(yT, yL);
          const height = Math.abs(yT - yL);
          const width  = bitmapSize.width - x1;
          if (width <= 0) continue;

          ctx.fillStyle = fvg.type === 'bullish' ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)';
          ctx.strokeStyle = fvg.type === 'bullish' ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)';

          ctx.fillRect(x1, top, width, height);

          // Diagonal hatch
          ctx.save();
          ctx.beginPath();
          ctx.rect(x1, top, width, height);
          ctx.clip();
          const step = 8 * horizontalPixelRatio;
          for (let hx = x1 - height; hx < x1 + width + height; hx += step) {
            ctx.moveTo(hx, top);
            ctx.lineTo(hx + height, top + height);
          }
          ctx.lineWidth = 0.5 * horizontalPixelRatio;
          ctx.stroke();
          ctx.restore();

          // Border lines (top and bottom)
          ctx.lineWidth = 1 * horizontalPixelRatio;
          ctx.beginPath();
          ctx.moveTo(x1, top); ctx.lineTo(x1 + width, top);
          ctx.moveTo(x1, top + height); ctx.lineTo(x1 + width, top + height);
          ctx.stroke();

          ctx.fillStyle = fvg.type === 'bullish' ? 'rgba(38,166,154,0.9)' : 'rgba(239,83,80,0.9)';
          ctx.font = `${9 * horizontalPixelRatio}px monospace`;
          ctx.fillText('FVG', x1 + 3 * horizontalPixelRatio, top + 11 * verticalPixelRatio);
        }
      }

      // ── Structure Breaks (BOS / ChoCH) ───────────────────────────────────
      if (opts.showStructureBreaks) {
        for (const sb of data.structureBreaks) {
          const xStart = tx(sb.prevSwingTime);
          const y      = py(sb.level);
          if (xStart === null || y === null) continue;

          ctx.save();
          ctx.lineWidth = 1.5 * horizontalPixelRatio;
          ctx.strokeStyle = sb.type === 'BOS' ? '#2962ff' : '#ff9800';
          ctx.setLineDash([6 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
          ctx.beginPath();
          ctx.moveTo(xStart, y);
          ctx.lineTo(bitmapSize.width, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = sb.type === 'BOS' ? '#2962ff' : '#ff9800';
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
          if (y === null) continue;

          const isEQH = ll.type === 'equal_highs';
          ctx.save();
          ctx.strokeStyle = isEQH ? '#ef5350' : '#26a69a';
          ctx.lineWidth = 1 * horizontalPixelRatio;
          ctx.setLineDash([2 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(bitmapSize.width, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = isEQH ? '#ef5350' : '#26a69a';
          ctx.font = `${9 * horizontalPixelRatio}px monospace`;
          ctx.fillText(
            `${isEQH ? 'EQH' : 'EQL'} (${ll.touchCount}x)`,
            4 * horizontalPixelRatio,
            y - 3 * verticalPixelRatio
          );
          ctx.restore();
        }
      }

      // ── Swing Points ─────────────────────────────────────────────────────
      if (opts.showSwingPoints) {
        const sz = 6 * horizontalPixelRatio;
        for (const sw of data.swingPoints) {
          const x = tx(sw.time);
          const y = py(sw.price);
          if (x === null || y === null) continue;

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
  _data: SMCOverlayData = { ...DEFAULT_DATA };
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
