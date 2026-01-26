import { useEffect, useRef, MutableRefObject } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

/**
 * Chart wrapper interface exposed via useImperativeHandle
 */
export interface ChartWrapper {
    chart: IChartApi | null;
    mainSeries: ISeriesApi<'Candlestick' | 'Bar' | 'Line' | 'Area'> | null;
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
 * Hook to synchronize multiple charts (Crosshair position)
 * @param chartRefs - MutableRefObject containing chart references by ID
 * @param charts - Array of chart configuration objects
 * @param isSyncEnabled - Whether synchronization is active
 */
export const useChartSync = (
    chartRefs: MutableRefObject<Record<string, ChartWrapper | null>>,
    charts: ChartConfig[],
    isSyncEnabled: boolean = true
): void => {
    // Track if we are currently syncing to prevent infinite loops
    const isSyncingCrosshair = useRef(false);

    useEffect(() => {
        if (!isSyncEnabled || !chartRefs.current || charts.length < 2) return;

        // Cleanup function to remove subscriptions
        const cleanups: (() => void)[] = [];

        charts.forEach(sourceChartConfig => {
            const sourceId = sourceChartConfig.id;
            const sourceWrapper = chartRefs.current[sourceId];

            // sourceWrapper is the component instance exposed via useImperativeHandle
            // It has .chart (LightweightChart instance) and .mainSeries
            if (!sourceWrapper || !sourceWrapper.chart) return;

            const sourceChart = sourceWrapper.chart;

            // --- Crosshair Sync ---
            const handleCrosshairMove = (param: { time?: Time; point?: { x: number; y: number } }) => {
                if (isSyncingCrosshair.current) return;
                isSyncingCrosshair.current = true;

                try {
                    charts.forEach(targetChartConfig => {
                        if (targetChartConfig.id === sourceId) return;

                        const targetWrapper = chartRefs.current[targetChartConfig.id];
                        if (!targetWrapper || !targetWrapper.chart) {
                            return;
                        }

                        if (param.time) {
                            // Sync vertical position (time)
                            const targetSeries = targetWrapper.mainSeries;

                            if (targetWrapper.chart.setCrosshairPosition && targetSeries) {
                                // Set the crosshair position on the target chart
                                // Using 0 for price since we only sync time (vertical line)
                                targetWrapper.chart.setCrosshairPosition(0, param.time, targetSeries);
                            }
                        } else {
                            // Clear crosshair when mouse leaves source chart
                            if (targetWrapper.chart.clearCrosshairPosition) {
                                targetWrapper.chart.clearCrosshairPosition();
                            }
                        }
                    });
                } finally {
                    isSyncingCrosshair.current = false;
                }
            };

            sourceChart.subscribeCrosshairMove(handleCrosshairMove);
            cleanups.push(() => sourceChart.unsubscribeCrosshairMove(handleCrosshairMove));
        });

        return () => {
            cleanups.forEach(fn => fn());
        };
    }, [chartRefs, charts, isSyncEnabled]);
};

export default useChartSync;
