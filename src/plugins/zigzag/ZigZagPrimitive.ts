/**
 * ZigZag Canvas Primitive
 * Draws connected ZigZag pivot lines directly on the chart canvas.
 * Follows the ISeriesPrimitive pattern used by SMCOverlayPrimitive.
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

import type { ZigZagPoint } from '../../utils/indicators/zigzag';

// ─────────────────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────────────────

class ZigZagPaneRenderer implements IPrimitivePaneRenderer {
  private _pivots: ZigZagPoint[];
  private _color: string;
  private _lineWidth: number;
  private _showLabels: boolean;
  private _chart: IChartApi;
  private _series: ISeriesApi<keyof SeriesOptionsMap>;

  constructor(
    pivots: ZigZagPoint[],
    color: string,
    lineWidth: number,
    showLabels: boolean,
    chart: IChartApi,
    series: ISeriesApi<keyof SeriesOptionsMap>
  ) {
    this._pivots = pivots;
    this._color = color;
    this._lineWidth = lineWidth;
    this._showLabels = showLabels;
    this._chart = chart;
    this._series = series;
  }

  draw(target: any): void {
    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx: CanvasRenderingContext2D = scope.context;
      const hpr = scope.horizontalPixelRatio;
      const vpr = scope.verticalPixelRatio;

      if (this._pivots.length < 2) return;

      ctx.save();
      ctx.strokeStyle = this._color;
      ctx.lineWidth = this._lineWidth * Math.min(hpr, vpr);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Compute pixel coordinates for all pivots
      const pts = this._pivots.map(p => {
        const x = this._chart.timeScale().timeToCoordinate(p.time as Time);
        const y = this._series.priceToCoordinate(p.price);
        if (x === null || y === null) return null;
        return { x: x * hpr, y: y * vpr };
      });

      // Draw connected lines
      ctx.beginPath();
      let started = false;
      for (const pt of pts) {
        if (pt === null) continue;
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();

      // Draw labels
      if (this._showLabels) {
        ctx.fillStyle = this._color;
        ctx.font = `${Math.round(11 * Math.min(hpr, vpr))}px sans-serif`;
        ctx.textAlign = 'center';

        for (let i = 0; i < this._pivots.length; i++) {
          const pt = pts[i];
          if (pt === null) continue;
          const p = this._pivots[i];
          const label = p.type === 'high' ? 'H' : 'L';
          const yOffset = p.type === 'high' ? -8 * vpr : 12 * vpr;
          ctx.fillText(label, pt.x, pt.y + yOffset);
        }
      }

      ctx.restore();
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pane View
// ─────────────────────────────────────────────────────────────────────────────

class ZigZagPaneView implements IPrimitivePaneView {
  private _renderer: ZigZagPaneRenderer;

  constructor(renderer: ZigZagPaneRenderer) {
    this._renderer = renderer;
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }

  zOrder(): 'normal' | 'bottom' | 'top' {
    return 'normal';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitive
// ─────────────────────────────────────────────────────────────────────────────

export class ZigZagPrimitive {
  private _pivots: ZigZagPoint[] = [];
  private _color: string = '#FF9800';
  private _lineWidth: number = 2;
  private _showLabels: boolean = true;
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<keyof SeriesOptionsMap> | null = null;
  private _requestUpdate: (() => void) | null = null;

  /**
   * Called by lightweight-charts when the primitive is attached to a series
   */
  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series as ISeriesApi<keyof SeriesOptionsMap>;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  /**
   * Update zigzag data and trigger repaint
   */
  update(pivots: ZigZagPoint[], color: string, showLabels: boolean): void {
    this._pivots = pivots;
    this._color = color;
    this._showLabels = showLabels;
    if (this._requestUpdate) this._requestUpdate();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    if (!this._chart || !this._series) return [];
    const renderer = new ZigZagPaneRenderer(
      this._pivots,
      this._color,
      this._lineWidth,
      this._showLabels,
      this._chart,
      this._series
    );
    return [new ZigZagPaneView(renderer)];
  }

  // Required no-ops for ISeriesPrimitive compatibility
  priceAxisViews(): readonly any[] { return []; }
  timeAxisViews(): readonly any[] { return []; }
  priceAxisPaneViews(): readonly any[] { return []; }
  timeAxisPaneViews(): readonly any[] { return []; }
}
