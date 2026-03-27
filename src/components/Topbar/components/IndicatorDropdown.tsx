import React from 'react';
import type { MouseEvent } from 'react';
import { BaseDropdown, DropdownItem, DropdownDivider } from '../../shared';
import styles from '../Topbar.module.css';

interface Position {
    top: number;
    left: number;
}

export interface IndicatorDropdownProps {
    position: Position;
    onAddIndicator: (indicator: string) => void;
    onClose: () => void;
    onOpenTemplates?: () => void;
}

interface SectionHeaderProps {
    children: React.ReactNode;
}

interface IndicatorItemProps {
    id: string;
    label: string;
    onClick: (id: string) => void;
}

/**
 * Indicator Dropdown Component
 * Displays categorized list of available indicators
 */
export const IndicatorDropdown: React.FC<IndicatorDropdownProps> = ({ position, onAddIndicator, onClose, onOpenTemplates }) => {
    const handleClick = (indicator: string): void => {
        onAddIndicator(indicator);
        // Dont close automatically to allow adding multiple indicators
    };

    const SectionHeader: React.FC<SectionHeaderProps> = ({ children }) => (
        <div className={styles.dropdownSection}>{children}</div>
    );

    const IndicatorItem: React.FC<IndicatorItemProps> = ({ id, label, onClick }) => (
        <DropdownItem
            label={label}
            onClick={(e?: MouseEvent) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                onClick(id);
            }}
        />
    );

    return (
        <BaseDropdown
            isOpen={true}
            onClose={onClose}
            position={{ top: position.top, left: position.left }}
            width={220}
            className={styles.indicatorDropdown}
        >
                {onOpenTemplates && (
                <>
                    <DropdownItem
                        label="📋 Indicator Templates…"
                        onClick={(e?: React.MouseEvent) => {
                            if (e) { e.preventDefault(); e.stopPropagation(); }
                            onOpenTemplates();
                            onClose();
                        }}
                    />
                    <DropdownDivider />
                </>
            )}
            <SectionHeader>Moving Averages</SectionHeader>
            <IndicatorItem id="sma" label="SMA" onClick={handleClick} />
            <IndicatorItem id="ema" label="EMA" onClick={handleClick} />
            <IndicatorItem id="dema" label="DEMA (Double EMA)" onClick={handleClick} />
            <IndicatorItem id="hma" label="HMA (Hull)" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Oscillators</SectionHeader>
            <IndicatorItem id="rsi" label="RSI" onClick={handleClick} />
            <IndicatorItem id="stochastic" label="Stochastic" onClick={handleClick} />
            <IndicatorItem id="stochastic_rsi" label="Stochastic RSI" onClick={handleClick} />
            <IndicatorItem id="cci" label="CCI" onClick={handleClick} />
            <IndicatorItem id="mfi" label="MFI" onClick={handleClick} />
            <IndicatorItem id="cmf" label="CMF (Chaikin)" onClick={handleClick} />
            <IndicatorItem id="willr" label="Williams %R" onClick={handleClick} />
            <IndicatorItem id="aroon" label="Aroon" onClick={handleClick} />
            <IndicatorItem id="roc" label="ROC" onClick={handleClick} />
            <IndicatorItem id="squeeze" label="Squeeze Momentum" onClick={handleClick} />
            <IndicatorItem id="hilengaMilenga" label="Hilenga-Milenga" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Momentum</SectionHeader>
            <IndicatorItem id="macd" label="MACD" onClick={handleClick} />
            <IndicatorItem id="awesome_oscillator" label="Awesome Oscillator" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Volatility</SectionHeader>
            <IndicatorItem id="bollingerBands" label="Bollinger Bands" onClick={handleClick} />
            <IndicatorItem id="atr" label="ATR" onClick={handleClick} />
            <IndicatorItem id="keltner" label="Keltner Channel" onClick={handleClick} />
            <IndicatorItem id="donchian" label="Donchian Channel" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Trend</SectionHeader>
            <IndicatorItem id="supertrend" label="Supertrend" onClick={handleClick} />
            <IndicatorItem id="ichimoku" label="Ichimoku Cloud" onClick={handleClick} />
            <IndicatorItem id="alligator" label="Alligator" onClick={handleClick} />
            <IndicatorItem id="psar" label="Parabolic SAR" onClick={handleClick} />
            <IndicatorItem id="zigzag" label="ZigZag" onClick={handleClick} />
            <IndicatorItem id="linear_regression" label="LR Channel" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Trend Strength</SectionHeader>
            <IndicatorItem id="adx" label="ADX" onClick={handleClick} />
            <IndicatorItem id="rsi_divergence" label="RSI Divergence" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Support/Resistance</SectionHeader>
            <IndicatorItem id="pivotPoints" label="Pivot Points" onClick={handleClick} />
            <IndicatorItem id="prev_day_ohlc" label="Prev Day OHLC" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Volume</SectionHeader>
            <IndicatorItem id="volume" label="Volume" onClick={handleClick} />
            <IndicatorItem id="vwap" label="VWAP" onClick={handleClick} />
            <IndicatorItem id="vwap_bands" label="VWAP Bands" onClick={handleClick} />
            <IndicatorItem id="obv" label="OBV" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Pattern Recognition</SectionHeader>
            <IndicatorItem id="candle_patterns" label="Candle Patterns" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Market Profile</SectionHeader>
            <IndicatorItem id="tpo" label="TPO Profile (30m)" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Strategy</SectionHeader>
            <IndicatorItem id="firstCandle" label="First Red Candle" onClick={handleClick} />
            <IndicatorItem id="rangeBreakout" label="Range Breakout" onClick={handleClick} />
            <IndicatorItem id="annStrategy" label="ANN Strategy" onClick={handleClick} />

            <DropdownDivider />
            <SectionHeader>Risk Management</SectionHeader>
            <IndicatorItem id="riskCalculator" label="Risk Calculator" onClick={handleClick} />
        </BaseDropdown>
    );
};

export default IndicatorDropdown;
