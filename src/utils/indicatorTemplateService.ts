/**
 * Indicator Template Service
 * Save and load named sets of indicators (presets)
 */

import { getJSON, setJSON } from '../services/storageService';

const STORAGE_KEY = 'indicator_templates_v1';

export interface IndicatorPreset {
    id: string;
    name: string;
    createdAt: string;
    indicators: any[]; // serialized indicator configs
}

const load = (): IndicatorPreset[] => {
    try {
        return getJSON<IndicatorPreset[]>(STORAGE_KEY, []) ?? [];
    } catch {
        return [];
    }
};

const save = (presets: IndicatorPreset[]): void => {
    setJSON(STORAGE_KEY, presets);
};

export const indicatorTemplateService = {
    getAll(): IndicatorPreset[] {
        return load();
    },

    save(name: string, indicators: any[]): IndicatorPreset {
        const presets = load();
        const preset: IndicatorPreset = {
            id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: name.trim() || `Preset ${presets.length + 1}`,
            createdAt: new Date().toISOString(),
            indicators: indicators.map(ind => {
                // Strip runtime-only fields before saving
                const { series, pane, _hash, data, ...rest } = ind;
                return rest;
            }),
        };
        presets.push(preset);
        save(presets);
        return preset;
    },

    delete(id: string): void {
        const presets = load().filter(p => p.id !== id);
        save(presets);
    },

    rename(id: string, newName: string): void {
        const presets = load().map(p =>
            p.id === id ? { ...p, name: newName.trim() || p.name } : p
        );
        save(presets);
    },
};
