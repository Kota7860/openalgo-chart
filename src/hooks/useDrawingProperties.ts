/**
 * Drawing Properties Hook
 * Manages drawing tool properties like color, width, and line style
 */

import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import { getJSON, setJSON, STORAGE_KEYS } from '../services/storageService';
import { CHART_COLORS } from '../utils/colorUtils';

// ==================== TYPES ====================

/** Line style option */
export interface LineStyleOption {
  value: number;
  label: string;
  pattern: number[];
}

/** Drawing options */
export interface DrawingOptions {
  lineColor: string;
  backgroundColor: string;
  width: number;
  lineStyle: number;
  globalAlpha: number;
}

/** Hook return type */
export interface UseDrawingPropertiesReturn {
  // Current defaults
  defaults: DrawingOptions;

  // Panel visibility
  isPanelVisible: boolean;

  // Individual property values for convenience
  lineColor: string;
  backgroundColor: string;
  width: number;
  lineStyle: number;
  globalAlpha: number;

  // Handlers
  updateProperty: <K extends keyof DrawingOptions>(property: K, value: DrawingOptions[K]) => void;
  updateProperties: (updates: Partial<DrawingOptions>) => void;
  resetToDefaults: () => void;
  setDefaults: Dispatch<SetStateAction<DrawingOptions>>;

  // Utilities
  generateBackgroundColor: (lineColor: string, opacity?: number) => string;

  // Constants for UI
  LINE_STYLES: readonly LineStyleOption[];
  PRESET_COLORS: readonly string[];
}

// ==================== CONSTANTS ====================

/**
 * Default drawing options for line tools
 * Line styles: 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed, 4=SparseDotted
 */
export const DEFAULT_DRAWING_OPTIONS: DrawingOptions = {
  lineColor: '#2962FF',
  backgroundColor: 'rgba(41, 98, 255, 0.2)',
  width: 2,
  lineStyle: 0,
  globalAlpha: 1.0,
};

/**
 * Line style constants with visual patterns
 */
export const LINE_STYLES: readonly LineStyleOption[] = [
  { value: 0, label: 'Solid', pattern: [] },
  { value: 1, label: 'Dotted', pattern: [2, 2] },
  { value: 2, label: 'Dashed', pattern: [6, 6] },
  { value: 3, label: 'Large Dashed', pattern: [10, 10] },
  { value: 4, label: 'Sparse Dotted', pattern: [2, 10] },
] as const;

/**
 * Preset colors for quick selection
 */
export const PRESET_COLORS: readonly string[] = [
  '#2962FF', // Blue (default)
  (CHART_COLORS as { UP: { primary: string }; DOWN: { primary: string } }).UP.primary, // Green (up)
  (CHART_COLORS as { UP: { primary: string }; DOWN: { primary: string } }).DOWN.primary, // Red (down)
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#00BCD4', // Cyan
  '#FFEB3B', // Yellow
  '#795548', // Brown
  '#607D8B', // Gray
  '#FFFFFF', // White
] as const;

/** Drawing tool names that should show the properties panel */
const DRAWING_TOOLS = [
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
] as const;

// ==================== HOOK ====================

/**
 * Hook for managing drawing tool properties
 * @param activeTool - Currently active drawing tool name
 * @returns Drawing properties state and handlers
 */
export const useDrawingProperties = (
  activeTool: string | null = null
): UseDrawingPropertiesReturn => {
  // Load defaults from localStorage
  const [defaults, setDefaults] = useState<DrawingOptions>(() => {
    const saved = getJSON<Partial<DrawingOptions> | null>(STORAGE_KEYS.DRAWING_DEFAULTS, null);
    return saved ? { ...DEFAULT_DRAWING_OPTIONS, ...saved } : DEFAULT_DRAWING_OPTIONS;
  });

  // Persist to localStorage when defaults change
  useEffect(() => {
    setJSON(STORAGE_KEYS.DRAWING_DEFAULTS, defaults);
  }, [defaults]);

  // Check if panel should be visible
  const isPanelVisible = activeTool !== null && DRAWING_TOOLS.includes(activeTool as typeof DRAWING_TOOLS[number]);

  // Update a single property
  const updateProperty = useCallback(
    <K extends keyof DrawingOptions>(property: K, value: DrawingOptions[K]) => {
      setDefaults((prev) => ({
        ...prev,
        [property]: value,
      }));
    },
    []
  );

  // Update multiple properties at once
  const updateProperties = useCallback((updates: Partial<DrawingOptions>) => {
    setDefaults((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setDefaults(DEFAULT_DRAWING_OPTIONS);
  }, []);

  // Generate background color from line color with opacity
  const generateBackgroundColor = useCallback((lineColor: string, opacity: number = 0.2): string => {
    // Handle hex colors
    if (lineColor.startsWith('#')) {
      const hex = lineColor.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // Return as-is for other formats
    return lineColor;
  }, []);

  return {
    // Current defaults
    defaults,

    // Panel visibility
    isPanelVisible,

    // Individual property values for convenience
    lineColor: defaults.lineColor,
    backgroundColor: defaults.backgroundColor,
    width: defaults.width,
    lineStyle: defaults.lineStyle,
    globalAlpha: defaults.globalAlpha,

    // Handlers
    updateProperty,
    updateProperties,
    resetToDefaults,
    setDefaults,

    // Utilities
    generateBackgroundColor,

    // Constants for UI
    LINE_STYLES,
    PRESET_COLORS,
  };
};

export default useDrawingProperties;
