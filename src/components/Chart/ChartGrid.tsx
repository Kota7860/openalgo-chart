import React, { useCallback } from 'react';
import type { MouseEvent, MutableRefObject } from 'react';
import styles from './ChartGrid.module.css';
import ChartComponent from './ChartComponent';
import { useChartSync, useDrawingSync } from './hooks';

type LayoutType = '1' | '2' | '3' | '4';

interface Indicator {
    type: string;
    params?: Record<string, unknown>;
    [key: string]: unknown;
}

interface ComparisonSymbol {
    symbol: string;
    exchange: string;
    color?: string;
    [key: string]: unknown;
}

interface StrategyConfig {
    [key: string]: unknown;
}

interface Alert {
    id: string;
    [key: string]: unknown;
}

interface AlertEvent {
    type: string;
    alert: Alert;
    [key: string]: unknown;
}

interface Chart {
    id: string;
    symbol: string;
    exchange?: string;
    interval: string;
    indicators?: Indicator[];
    comparisonSymbols?: ComparisonSymbol[];
    strategyConfig?: StrategyConfig;
}

interface ChartRef {
    // Chart component instance methods
    [key: string]: unknown;
}

export interface ChartGridProps {
    charts: Chart[];
    layout: LayoutType;
    activeChartId: string;
    onActiveChartChange: (chartId: string) => void;
    onMaximizeChart?: (chartId: string) => void;
    chartRefs: MutableRefObject<Record<string, ChartRef | null>>;
    onAlertsSync?: (chartId: string, symbol: string, exchange: string, alerts: Alert[]) => void;
    onDrawingsSync?: (drawings: unknown[]) => void;
    onAlertTriggered?: (chartId: string, symbol: string, exchange: string, event: AlertEvent) => void;
    onReplayModeChange?: (chartId: string, isActive: boolean) => void;
    onOHLCDataUpdate?: (data: unknown) => void;
    isCrosshairSyncEnabled?: boolean;
    isDrawingSyncEnabled?: boolean;
    [key: string]: unknown; // Additional chart props
}

const ChartGrid: React.FC<ChartGridProps> = ({
    charts,
    layout,
    activeChartId,
    onActiveChartChange,
    onMaximizeChart,
    chartRefs,
    onAlertsSync,
    onDrawingsSync,
    onAlertTriggered,
    onReplayModeChange,
    onOHLCDataUpdate,
    isCrosshairSyncEnabled = true,
    isDrawingSyncEnabled = true,
    ...chartProps
}) => {
    // Enable crosshair sync across all charts
    useChartSync(chartRefs as any, charts as any, isCrosshairSyncEnabled && charts.length > 1);

    // Enable drawing sync for charts with same symbol
    const { handleDrawingsSync } = useDrawingSync({
        chartRefs: chartRefs as any,
        charts: charts as any
    });

    // Wrapper to handle drawing changes and sync
    const handleDrawingsChange = useCallback((chartId: string, symbol: string, exchange: string, drawings: unknown[]) => {
        // Call parent callback if provided
        if (onDrawingsSync) {
            onDrawingsSync(drawings);
        }

        // Sync drawings to other charts with same symbol
        if (isDrawingSyncEnabled) {
            handleDrawingsSync(chartId, symbol, exchange, drawings as any);
        }
    }, [onDrawingsSync, isDrawingSyncEnabled, handleDrawingsSync]);

    const getGridClass = (): string => {
        switch (layout) {
            case '2': return styles.grid2;
            case '3': return styles.grid3;
            case '4': return styles.grid4;
            default: return styles.grid1;
        }
    };

    const handleChartClick = (e: MouseEvent<HTMLDivElement>, chartId: string): void => {
        if (e.altKey && onMaximizeChart) {
            e.preventDefault();
            e.stopPropagation();
            onMaximizeChart(chartId);
        } else {
            onActiveChartChange(chartId);
        }
    };

    return (
        <div className={`${styles.gridContainer} ${getGridClass()}`}>
            {charts.map((chart) => (
                <div
                    key={chart.id}
                    className={`${styles.chartWrapper} ${activeChartId === chart.id && layout !== '1' ? styles.active : ''}`}
                    onClick={(e) => handleChartClick(e, chart.id)}
                >
                    <ChartComponent
                        ref={(el) => {
                            if (chartRefs.current) {
                                chartRefs.current[chart.id] = el;
                            }
                        }}
                        symbol={chart.symbol}
                        exchange={chart.exchange || 'NSE'}
                        interval={chart.interval}
                        onAlertsSync={onAlertsSync ? (alerts: Alert[]) => onAlertsSync(chart.id, chart.symbol, chart.exchange || 'NSE', alerts) : undefined}
                        onDrawingsSync={(drawings: unknown[]) => handleDrawingsChange(chart.id, chart.symbol, chart.exchange || 'NSE', drawings)}
                        onAlertTriggered={onAlertTriggered ? (evt: AlertEvent) => onAlertTriggered(chart.id, chart.symbol, chart.exchange || 'NSE', evt) : undefined}
                        onReplayModeChange={onReplayModeChange ? (isActive: boolean) => onReplayModeChange(chart.id, isActive) : undefined}
                        onOHLCDataUpdate={onOHLCDataUpdate}
                        {...chartProps}
                        indicators={chart.indicators}
                        comparisonSymbols={chart.comparisonSymbols}
                        strategyConfig={chart.strategyConfig}
                    />
                </div>
            ))}
        </div>
    );
};

export default ChartGrid;
