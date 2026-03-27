/**
 * App Utilities
 * Utility functions and constants extracted from App.jsx
 */

// ============== Type Definitions ==============

/**
 * Valid interval unit characters
 */
export type IntervalUnit = 's' | 'm' | 'h' | 'd' | 'w' | 'M';

/**
 * Custom interval definition
 */
export interface CustomInterval {
    value: string;
    label: string;
    isCustom: boolean;
}

/**
 * Watchlist symbol definition
 */
export interface WatchlistSymbol {
    symbol: string;
    exchange: string;
}

/**
 * Single watchlist definition
 */
export interface Watchlist {
    id: string;
    name: string;
    symbols: WatchlistSymbol[];
}

/**
 * Watchlist data structure with multiple lists
 */
export interface WatchlistData {
    lists: Watchlist[];
    activeListId: string;
}

/**
 * Chart appearance settings
 */
export interface ChartAppearance {
    candleUpColor: string;
    candleDownColor: string;
    wickUpColor: string;
    wickDownColor: string;
    showVerticalGridLines: boolean;
    showHorizontalGridLines: boolean;
    darkBackground: string;
    lightBackground: string;
    darkGridColor: string;
    lightGridColor: string;
}

/**
 * Drawing tool options
 */
export interface DrawingOptions {
    lineColor: string;
    backgroundColor: string;
    width: number;
    lineStyle: number;
    globalAlpha: number;
}

/**
 * Drawing tool name type
 */
export type DrawingToolName =
    | 'TrendLine'
    | 'HorizontalLine'
    | 'VerticalLine'
    | 'Rectangle'
    | 'Circle'
    | 'Path'
    | 'Text'
    | 'Callout'
    | 'PriceRange'
    | 'Arrow'
    | 'Ray'
    | 'ExtendedLine'
    | 'ParallelChannel'
    | 'FibonacciRetracement'
    | 'Pitchfork'
    | 'FibTimeZones';

// ============== Interval Utilities ==============

export const VALID_INTERVAL_UNITS: Set<IntervalUnit> = new Set(['s', 'm', 'h', 'd', 'w', 'M']);
export const DEFAULT_FAVORITE_INTERVALS: string[] = []; // No default favorites

/**
 * Validates if a value is a valid interval string
 * @param value - The interval value to validate
 * @returns Whether the value is valid
 */
export const isValidIntervalValue = (value: unknown): boolean => {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^\d+$/.test(trimmed)) {
        return parseInt(trimmed, 10) > 0;
    }
    const match = /^([1-9]\d*)([smhdwM])$/.exec(trimmed);
    if (!match) return false;
    const unit = match[2] as IntervalUnit;
    return VALID_INTERVAL_UNITS.has(unit);
};

/**
 * Sanitizes favorite intervals array
 * @param raw - Raw interval array
 * @returns Sanitized unique intervals
 */
export const sanitizeFavoriteIntervals = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return DEFAULT_FAVORITE_INTERVALS;
    const filtered = raw.filter(isValidIntervalValue) as string[];
    const unique = Array.from(new Set(filtered));
    return unique;
};

/**
 * Raw custom interval input type
 */
interface RawCustomInterval {
    value?: unknown;
    label?: unknown;
}

/**
 * Sanitizes custom intervals array
 * @param raw - Raw custom intervals array
 * @returns Sanitized custom intervals with label
 */
export const sanitizeCustomIntervals = (raw: unknown): CustomInterval[] => {
    if (!Array.isArray(raw)) return [];
    return (raw as RawCustomInterval[])
        .filter((item): item is RawCustomInterval =>
            item !== null &&
            typeof item === 'object' &&
            isValidIntervalValue((item as RawCustomInterval).value)
        )
        .map((item) => ({
            value: item.value as string,
            label: (typeof item.label === 'string' ? item.label : item.value) as string,
            isCustom: true,
        }));
};

// ============== JSON/Storage Utilities ==============

// Import and re-export from centralized storage service
import { safeParseJSON as _safeParseJSON, getJSON, STORAGE_KEYS } from '../services/storageService';
export const safeParseJSON = _safeParseJSON;

// ============== Alert Constants ==============

export const ALERT_RETENTION_MS: number = 24 * 60 * 60 * 1000; // 24 hours

// ============== Watchlist Utilities ==============

export const DEFAULT_WATCHLIST: Watchlist = {
    id: 'wl_default',
    name: 'My Watchlist',
    symbols: [
        { symbol: 'RELIANCE', exchange: 'NSE' },
        { symbol: 'TCS', exchange: 'NSE' },
        { symbol: 'INFY', exchange: 'NSE' },
        { symbol: 'HDFCBANK', exchange: 'NSE' },
        { symbol: 'ICICIBANK', exchange: 'NSE' },
        { symbol: 'SBIN', exchange: 'NSE' },
        { symbol: 'BHARTIARTL', exchange: 'NSE' },
        { symbol: 'ITC', exchange: 'NSE' },
    ],
};

/**
 * Migrates watchlist data from old format to new format
 * @returns Migrated watchlist data
 */
export const migrateWatchlistData = (): WatchlistData => {
    const newData = getJSON<WatchlistData>(STORAGE_KEYS.WATCHLISTS, null);

    // If new format exists, validate and use it
    if (newData && newData.lists && Array.isArray(newData.lists)) {
        // Filter out any old Favorites watchlist
        newData.lists = newData.lists.filter(wl => wl.id !== 'wl_favorites');
        // Ensure at least one watchlist exists
        if (newData.lists.length === 0) {
            newData.lists.push(DEFAULT_WATCHLIST);
            newData.activeListId = 'wl_default';
        }
        // Update activeListId if it was pointing to favorites
        if (newData.activeListId === 'wl_favorites') {
            newData.activeListId = newData.lists[0].id;
        }
        return newData;
    }

    // Check for old format
    const oldData = getJSON<(string | WatchlistSymbol)[]>(STORAGE_KEYS.WATCHLIST, null);

    if (oldData && Array.isArray(oldData) && oldData.length > 0) {
        // Migrate old format to new format
        return {
            lists: [
                {
                    ...DEFAULT_WATCHLIST,
                    symbols: oldData.map(s => typeof s === 'string' ? { symbol: s, exchange: 'NSE' } : s),
                }
            ],
            activeListId: 'wl_default',
        };
    }

    // Return default
    return {
        lists: [DEFAULT_WATCHLIST],
        activeListId: 'wl_default',
    };
};

// ============== Chart Appearance Defaults ==============

export const DEFAULT_CHART_APPEARANCE: ChartAppearance = {
    // Candle Colors
    candleUpColor: '#089981',
    candleDownColor: '#F23645',
    wickUpColor: '#089981',
    wickDownColor: '#F23645',
    // Grid Settings
    showVerticalGridLines: true,
    showHorizontalGridLines: true,
    // Background Colors (per theme)
    darkBackground: '#131722',
    lightBackground: '#ffffff',
    // Grid Colors (per theme)
    darkGridColor: '#2A2E39',
    lightGridColor: '#e0e3eb',
};

// ============== Drawing Tool Defaults ==============

// Line styles: 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed, 4=SparseDotted
export const DEFAULT_DRAWING_OPTIONS: DrawingOptions = {
    lineColor: '#2962FF',
    backgroundColor: 'rgba(41, 98, 255, 0.2)',
    width: 2,
    lineStyle: 0,
    globalAlpha: 1.0,
};

// Drawing tools that should show the properties panel
export const DRAWING_TOOLS: DrawingToolName[] = [
    'TrendLine',
    'HorizontalLine',
    'VerticalLine',
    'Rectangle',
    'Circle',
    'Path',
    'Text',
    'Callout',
    'PriceRange',
    'Arrow',
    'Ray',
    'ExtendedLine',
    'ParallelChannel',
    'FibonacciRetracement',
    'Pitchfork',
    'FibTimeZones',
];

// ============== Price Formatting ==============

// Re-export from shared formatters
import { formatPrice as _formatPrice } from '../utils/shared/formatters';
export const formatPrice = _formatPrice;
