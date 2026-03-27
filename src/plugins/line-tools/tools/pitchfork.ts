/**
 * Andrews Pitchfork Drawing Tool
 *
 * Three-point tool:
 *   P1 = anchor (median start)
 *   P2 = upper handle
 *   P3 = lower handle
 *
 * Draws:
 *   Median line: P1 → midpoint(P2, P3), extended to right edge
 *   Upper line:  through P2, parallel to median, extended to right edge
 *   Lower line:  through P3, parallel to median, extended to right edge
 *   Handle line: connects P2 to P3 (optional)
 */

import { CanvasRenderingTarget2D } from 'fancy-canvas';
import {
    IChartApi,
    ISeriesApi,
    ISeriesPrimitive,
    IPrimitivePaneRenderer,
    IPrimitivePaneView,
    Logical,
    SeriesOptionsMap,
    SeriesType,
    Time,
} from 'lightweight-charts';
import {
    LogicalPoint,
    ViewPoint,
    HitTestResult,
    pointToCoordinate,
    scaleCoordinate,
    drawAnchor,
    setLineStyle,
} from './base-types';
import { AutoscaleInfo } from 'lightweight-charts';

// ─────────────────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extend a line segment (from px,py in direction dx,dy) to the right edge at maxX.
 */
function extendRight(
    px: number, py: number,
    dx: number, dy: number,
    maxX: number
): { x: number; y: number } {
    if (Math.abs(dx) < 0.0001) {
        // Vertical line — extend to max canvas height (large number)
        return { x: px, y: py + dy * 9999 };
    }
    const t = (maxX - px) / dx;
    return { x: maxX, y: py + t * dy };
}

class PitchforkPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _p3: ViewPoint;
    private readonly _options: PitchforkOptions;
    private readonly _selected: boolean;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        p3: ViewPoint,
        options: PitchforkOptions,
        selected: boolean
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (
                this._p1.x === null || this._p1.y === null ||
                this._p2.x === null || this._p2.y === null ||
                this._p3.x === null || this._p3.y === null
            ) return;

            const ctx = scope.context;
            const hpr = scope.horizontalPixelRatio;
            const vpr = scope.verticalPixelRatio;

            const x1 = scaleCoordinate(this._p1.x, hpr);
            const y1 = scaleCoordinate(this._p1.y, vpr);
            const x2 = scaleCoordinate(this._p2.x, hpr);
            const y2 = scaleCoordinate(this._p2.y, vpr);
            const x3 = scaleCoordinate(this._p3.x, hpr);
            const y3 = scaleCoordinate(this._p3.y, vpr);

            // Median target: midpoint of P2 and P3
            const mx = (x2 + x3) / 2;
            const my = (y2 + y3) / 2;

            // Direction vector of the median line (from P1 to M)
            const dx = mx - x1;
            const dy = my - y1;

            // Canvas right edge (extend far enough)
            const maxX = scope.bitmapSize.width;

            // Compute right-side endpoints for all 3 lines
            const medianEnd = extendRight(x1, y1, dx, dy, maxX);
            const upperEnd  = extendRight(x2, y2, dx, dy, maxX);
            const lowerEnd  = extendRight(x3, y3, dx, dy, maxX);

            ctx.save();
            ctx.strokeStyle = this._options.lineColor;
            ctx.lineWidth = this._options.width;
            setLineStyle(ctx, this._options.lineStyle);

            // Draw handle line (P2 to P3)
            if (this._options.showHandle) {
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x3, y3);
                ctx.stroke();
            }

            // Draw upper line (P2 → extended)
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(upperEnd.x, upperEnd.y);
            ctx.stroke();

            // Draw lower line (P3 → extended)
            ctx.beginPath();
            ctx.moveTo(x3, y3);
            ctx.lineTo(lowerEnd.x, lowerEnd.y);
            ctx.stroke();

            // Draw median line (P1 → extended), dashed
            ctx.setLineDash([6 * hpr, 4 * hpr]);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(medianEnd.x, medianEnd.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw anchors when selected
            if (this._selected) {
                drawAnchor(scope, x1, y1);
                drawAnchor(scope, x2, y2);
                drawAnchor(scope, x3, y3);
            }

            ctx.restore();
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pane View
// ─────────────────────────────────────────────────────────────────────────────

class PitchforkPaneView implements IPrimitivePaneView {
    private readonly _source: Pitchfork;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };
    private _p3: ViewPoint = { x: null, y: null };

    constructor(source: Pitchfork) {
        this._source = source;
    }

    update(): void {
        this._p1 = pointToCoordinate(this._source._p1, this._source._chart, this._source._series);
        this._p2 = pointToCoordinate(this._source._p2, this._source._chart, this._source._series);
        this._p3 = pointToCoordinate(this._source._p3, this._source._chart, this._source._series);
    }

    renderer(): PitchforkPaneRenderer {
        return new PitchforkPaneRenderer(
            this._p1,
            this._p2,
            this._p3,
            this._source._options,
            this._source._selected
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

export interface PitchforkOptions {
    lineColor: string;
    width: number;
    lineStyle: number;
    showHandle: boolean;
    locked?: boolean;
}

const defaultOptions: PitchforkOptions = {
    lineColor: 'rgb(33, 150, 243)',
    width: 1,
    lineStyle: 0,
    showHandle: true,
    locked: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Pitchfork class
// ─────────────────────────────────────────────────────────────────────────────

export class Pitchfork implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    _p3: LogicalPoint;
    private readonly _paneViews: PitchforkPaneView[];
    readonly _options: PitchforkOptions;
    _selected: boolean = false;
    _locked: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        p3: LogicalPoint,
        options?: Partial<PitchforkOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this._options = { ...defaultOptions, ...options };
        this._paneViews = [new PitchforkPaneView(this)];
    }

    public updatePoints(p1: LogicalPoint, p2: LogicalPoint, p3: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this._p3 = p3;
        this.updateAllViews();
    }

    public updatePointByIndex(index: number, point: LogicalPoint): void {
        if (index === 0) this._p1 = point;
        else if (index === 1) this._p2 = point;
        else if (index === 2) this._p3 = point;
        this.updateAllViews();
    }

    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<PitchforkOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const series = this._series;

        const x1 = timeScale.logicalToCoordinate(this._p1.logical as Logical);
        const y1 = series.priceToCoordinate(this._p1.price);
        const x2 = timeScale.logicalToCoordinate(this._p2.logical as Logical);
        const y2 = series.priceToCoordinate(this._p2.price);
        const x3 = timeScale.logicalToCoordinate(this._p3.logical as Logical);
        const y3 = series.priceToCoordinate(this._p3.price);

        if (x1 === null || y1 === null || x2 === null || y2 === null || x3 === null || y3 === null)
            return null;

        const threshold = 8;

        // Check anchor points
        if (Math.hypot(x - x1, y - y1) < threshold) return { hit: true, type: 'point', index: 0 };
        if (Math.hypot(x - x2, y - y2) < threshold) return { hit: true, type: 'point', index: 1 };
        if (Math.hypot(x - x3, y - y3) < threshold) return { hit: true, type: 'point', index: 2 };

        // Check proximity to the 3 lines (simplified bounding box test)
        const minX = Math.min(x1, x2, x3);
        const maxX = Math.max(x1, x2, x3);
        const minY = Math.min(y1, y2, y3) - threshold * 3;
        const maxY = Math.max(y1, y2, y3) + threshold * 3;

        if (x >= minX - threshold && x <= maxX + threshold && y >= minY && y <= maxY) {
            return { hit: true, type: 'shape' };
        }

        return null;
    }

    autoscaleInfo(): AutoscaleInfo | null {
        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): PitchforkPaneView[] {
        return this._paneViews;
    }
}
