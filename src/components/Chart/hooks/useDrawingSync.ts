import { useRef, useCallback, MutableRefObject } from 'react';

/**
 * Drawing data structure
 */
export interface DrawingData {
    type: string;
    points: Array<{ time: number; price: number }>;
    options?: Record<string, unknown>;
    locked?: boolean;
    visible?: boolean;
    [key: string]: unknown;
}

/**
 * Chart wrapper interface with drawing support
 */
export interface ChartWrapperWithDrawings {
    setDrawings?: (drawings: DrawingData[]) => void;
    [key: string]: unknown;
}

/**
 * Chart configuration object
 */
export interface ChartConfig {
    id: string;
    symbol: string;
    exchange?: string;
}

/**
 * Hook parameters
 */
interface UseDrawingSyncParams {
    chartRefs: MutableRefObject<Record<string, ChartWrapperWithDrawings | null>>;
    charts: ChartConfig[];
}

/**
 * Hook return type
 */
interface UseDrawingSyncReturn {
    handleDrawingsSync: (
        sourceChartId: string,
        symbol: string,
        exchange: string,
        drawings: DrawingData[]
    ) => void;
}

/**
 * Hook to handle drawing synchronization across multiple charts.
 * Drawings are synced between charts that have the same symbol:exchange combination.
 *
 * @param params.chartRefs - Refs to ChartComponent instances
 * @param params.charts - Array of chart configurations
 * @returns Object containing handleDrawingsSync callback
 */
export const useDrawingSync = ({
    chartRefs,
    charts
}: UseDrawingSyncParams): UseDrawingSyncReturn => {
    // Store latest drawings by symbol key: { "RELIANCE:NSE": [drawing1, ...], ... }
    const drawingsBySymbol = useRef<Record<string, DrawingData[]>>({});

    const handleDrawingsSync = useCallback((
        sourceChartId: string,
        symbol: string,
        exchange: string,
        drawings: DrawingData[]
    ) => {
        if (!symbol) return;

        const key = `${symbol}:${exchange || 'NSE'}`;

        // Update local cache
        drawingsBySymbol.current[key] = drawings;

        // Broadcast to other charts with the same symbol key
        charts.forEach(chart => {
            // Skip the source chart (it already has the drawings)
            if (chart.id === sourceChartId) return;

            const targetKey = `${chart.symbol}:${chart.exchange || 'NSE'}`;

            // If symbols match, propagate the drawings
            if (targetKey === key) {
                const targetWrapper = chartRefs.current[chart.id];
                if (targetWrapper && typeof targetWrapper.setDrawings === 'function') {
                    targetWrapper.setDrawings(drawings);
                }
            }
        });
    }, [charts, chartRefs]);

    return { handleDrawingsSync };
};

export default useDrawingSync;
