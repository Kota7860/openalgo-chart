/**
 * Fibonacci Time Zones Drawing Tool
 *
 * Two-point tool: user clicks two bars to define a unit interval.
 * Draws vertical dashed lines at Fibonacci-number multiples of that interval
 * to the right of P1: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34 ...
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
} from './base-types';

// Fibonacci sequence used for zone offsets (in bar units)
const FIB_SEQUENCE = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

// ─────────────────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────────────────

class FibTimeZonesPaneRenderer implements IPrimitivePaneRenderer {
    private readonly _p1: ViewPoint;
    private readonly _p2: ViewPoint;
    private readonly _p1Logical: number;
    private readonly _p2Logical: number;
    private readonly _chart: IChartApi;
    private readonly _options: FibTimeZonesOptions;
    private readonly _selected: boolean;

    constructor(
        p1: ViewPoint,
        p2: ViewPoint,
        p1Logical: number,
        p2Logical: number,
        chart: IChartApi,
        options: FibTimeZonesOptions,
        selected: boolean
    ) {
        this._p1 = p1;
        this._p2 = p2;
        this._p1Logical = p1Logical;
        this._p2Logical = p2Logical;
        this._chart = chart;
        this._options = options;
        this._selected = selected;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace(scope => {
            if (this._p1.x === null || this._p2.x === null) return;

            const ctx = scope.context;
            const hpr = scope.horizontalPixelRatio;
            const vpr = scope.verticalPixelRatio;
            const height = scope.bitmapSize.height;

            const x1s = scaleCoordinate(this._p1.x, hpr);
            const x2s = scaleCoordinate(this._p2.x, hpr);

            // Unit step in pixels (may be negative if P2 is left of P1)
            const unitDx = x2s - x1s;
            const unitLogical = this._p2Logical - this._p1Logical;
            if (Math.abs(unitLogical) < 0.5) return;

            // Pixels per bar logical unit
            const pxPerLogical = unitDx / unitLogical;

            const timeScale = this._chart.timeScale();

            ctx.save();
            ctx.setLineDash([5 * hpr, 4 * hpr]);
            ctx.lineWidth = Math.max(1, this._options.lineWidth * hpr);

            FIB_SEQUENCE.forEach((fib, idx) => {
                // x = p1.x + fib * unitDx (in px) — but we also need to extend
                // past p1 to the left for fib=0
                const targetLogical = this._p1Logical + fib * unitLogical;
                const xCoord = timeScale.logicalToCoordinate(targetLogical as Logical);
                if (xCoord === null) return;

                const xs = scaleCoordinate(xCoord, hpr);
                if (xs < 0) return; // off-screen left

                // Alternate colours between accent and muted
                ctx.strokeStyle = idx % 2 === 0 ? this._options.accentColor : this._options.color;

                ctx.beginPath();
                ctx.moveTo(xs, 0);
                ctx.lineTo(xs, height);
                ctx.stroke();

                // Label at the top
                ctx.setLineDash([]);
                ctx.fillStyle = ctx.strokeStyle;
                ctx.font = `${Math.round(10 * hpr)}px sans-serif`;
                ctx.fillText(String(fib), xs + 2 * hpr, 14 * vpr);
                ctx.setLineDash([5 * hpr, 4 * hpr]);
            });

            ctx.restore();

            // Draw anchors when selected
            if (this._selected) {
                ctx.setLineDash([]);
                if (this._p1.y !== null) drawAnchor(scope, x1s, scaleCoordinate(this._p1.y, vpr));
                if (this._p2.y !== null) drawAnchor(scope, x2s, scaleCoordinate(this._p2.y, vpr));
            }
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pane View
// ─────────────────────────────────────────────────────────────────────────────

class FibTimeZonesPaneView implements IPrimitivePaneView {
    private readonly _source: FibTimeZones;
    private _p1: ViewPoint = { x: null, y: null };
    private _p2: ViewPoint = { x: null, y: null };

    constructor(source: FibTimeZones) {
        this._source = source;
    }

    update(): void {
        this._p1 = pointToCoordinate(this._source._p1, this._source._chart, this._source._series);
        this._p2 = pointToCoordinate(this._source._p2, this._source._chart, this._source._series);
    }

    renderer(): FibTimeZonesPaneRenderer {
        return new FibTimeZonesPaneRenderer(
            this._p1,
            this._p2,
            this._source._p1.logical,
            this._source._p2.logical,
            this._source._chart,
            this._source._options,
            this._source._selected
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public interface
// ─────────────────────────────────────────────────────────────────────────────

export interface FibTimeZonesOptions {
    color: string;
    accentColor: string;
    lineWidth: number;
}

const defaultOptions: FibTimeZonesOptions = {
    color: '#9C27B0',
    accentColor: '#2962FF',
    lineWidth: 1,
};

export class FibTimeZones implements ISeriesPrimitive<Time> {
    readonly _chart: IChartApi;
    readonly _series: ISeriesApi<keyof SeriesOptionsMap>;
    _p1: LogicalPoint;
    _p2: LogicalPoint;
    private readonly _paneViews: FibTimeZonesPaneView[];
    readonly _options: FibTimeZonesOptions;
    _selected: boolean = false;

    constructor(
        chart: IChartApi,
        series: ISeriesApi<SeriesType>,
        p1: LogicalPoint,
        p2: LogicalPoint,
        options?: Partial<FibTimeZonesOptions>
    ) {
        this._chart = chart;
        this._series = series;
        this._p1 = p1;
        this._p2 = p2;
        this._options = { ...defaultOptions, ...options };
        this._paneViews = [new FibTimeZonesPaneView(this)];
    }

    public updatePoints(p1: LogicalPoint, p2: LogicalPoint): void {
        this._p1 = p1;
        this._p2 = p2;
        this.updateAllViews();
    }

    public updatePointByIndex(index: number, point: LogicalPoint): void {
        if (index === 0) this._p1 = point;
        else if (index === 1) this._p2 = point;
        this.updateAllViews();
    }

    public setSelected(selected: boolean): void {
        this._selected = selected;
        this.updateAllViews();
    }

    public applyOptions(options: Partial<FibTimeZonesOptions>): void {
        Object.assign(this._options, options);
        this.updateAllViews();
        this._chart.timeScale().applyOptions({});
    }

    public toolHitTest(x: number, y: number): HitTestResult | null {
        const timeScale = this._chart.timeScale();
        const x1 = timeScale.logicalToCoordinate(this._p1.logical as Logical);
        const x2 = timeScale.logicalToCoordinate(this._p2.logical as Logical);
        if (x1 === null || x2 === null) return null;

        const threshold = 8;
        if (Math.abs(x - x1) < threshold) return { hit: true, type: 'point', index: 0 };
        if (Math.abs(x - x2) < threshold) return { hit: true, type: 'point', index: 1 };

        // Check all fib vertical lines
        const unitLogical = this._p2.logical - this._p1.logical;
        for (const fib of FIB_SEQUENCE) {
            const targetLogical = this._p1.logical + fib * unitLogical;
            const xCoord = timeScale.logicalToCoordinate(targetLogical as Logical);
            if (xCoord !== null && Math.abs(x - xCoord) < 5) {
                return { hit: true, type: 'line' };
            }
        }
        return null;
    }

    updateAllViews(): void {
        this._paneViews.forEach(pw => pw.update());
    }

    paneViews(): FibTimeZonesPaneView[] {
        if ((this as any)._hiddenByVisibility) return [];
        return this._paneViews;
    }
}
