/**
 * Indicator Templates Dialog
 * Save and load named sets of indicators (presets)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { FC, ChangeEvent, KeyboardEvent } from 'react';
import { Save, Trash2, LayoutTemplate, Check, X, Edit2 } from 'lucide-react';
import { indicatorTemplateService, type IndicatorPreset } from '../../utils/indicatorTemplateService';
import styles from './IndicatorTemplatesDialog.module.css';

export interface IndicatorTemplatesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentIndicators: any[];
    onLoadTemplate: (indicators: any[]) => void;
}

const IndicatorTemplatesDialog: FC<IndicatorTemplatesDialogProps> = ({
    isOpen,
    onClose,
    currentIndicators,
    onLoadTemplate,
}) => {
    const [presets, setPresets] = useState<IndicatorPreset[]>([]);
    const [saveName, setSaveName] = useState('');
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const saveInputRef = useRef<HTMLInputElement>(null);

    const refresh = useCallback(() => {
        setPresets(indicatorTemplateService.getAll());
    }, []);

    useEffect(() => {
        if (isOpen) refresh();
    }, [isOpen, refresh]);

    useEffect(() => {
        if (showSaveForm && saveInputRef.current) {
            saveInputRef.current.focus();
        }
    }, [showSaveForm]);

    const handleSave = useCallback(() => {
        if (!saveName.trim()) return;
        indicatorTemplateService.save(saveName, currentIndicators);
        setSaveName('');
        setShowSaveForm(false);
        refresh();
    }, [saveName, currentIndicators, refresh]);

    const handleLoad = useCallback((preset: IndicatorPreset) => {
        onLoadTemplate(preset.indicators);
        onClose();
    }, [onLoadTemplate, onClose]);

    const handleDelete = useCallback((id: string) => {
        indicatorTemplateService.delete(id);
        setConfirmDelete(null);
        refresh();
    }, [refresh]);

    const handleRename = useCallback((id: string) => {
        if (!editName.trim()) { setEditingId(null); return; }
        indicatorTemplateService.rename(id, editName);
        setEditingId(null);
        refresh();
    }, [editName, refresh]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown} role="dialog" aria-modal>
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <LayoutTemplate size={16} />
                        <span>Indicator Templates</span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
                </div>

                <div className={styles.body}>
                    {/* Save current setup */}
                    {showSaveForm ? (
                        <div className={styles.saveForm}>
                            <input
                                ref={saveInputRef}
                                type="text"
                                className={styles.saveInput}
                                placeholder="Template name…"
                                value={saveName}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setSaveName(e.target.value)}
                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === 'Enter') handleSave();
                                    if (e.key === 'Escape') setShowSaveForm(false);
                                }}
                                maxLength={50}
                            />
                            <button className={styles.btnPrimary} onClick={handleSave} disabled={!saveName.trim()}>
                                <Check size={14} /> Save
                            </button>
                            <button className={styles.btnGhost} onClick={() => setShowSaveForm(false)}>
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <button
                            className={styles.saveCurrentBtn}
                            onClick={() => setShowSaveForm(true)}
                            disabled={currentIndicators.length === 0}
                            title={currentIndicators.length === 0 ? 'Add indicators to the chart first' : 'Save current indicator setup as a template'}
                        >
                            <Save size={14} />
                            Save current setup ({currentIndicators.length} indicator{currentIndicators.length !== 1 ? 's' : ''})
                        </button>
                    )}

                    {/* Template list */}
                    {presets.length === 0 ? (
                        <div className={styles.empty}>
                            No saved templates yet.<br />Add indicators and save the setup above.
                        </div>
                    ) : (
                        <div className={styles.list}>
                            {presets.map(preset => (
                                <div key={preset.id} className={styles.item}>
                                    <div className={styles.itemInfo}>
                                        {editingId === preset.id ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                className={styles.editInput}
                                                value={editName}
                                                onChange={(e: ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                                    if (e.key === 'Enter') handleRename(preset.id);
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                                onBlur={() => handleRename(preset.id)}
                                                maxLength={50}
                                            />
                                        ) : (
                                            <span className={styles.itemName}>{preset.name}</span>
                                        )}
                                        <span className={styles.itemMeta}>
                                            {preset.indicators.length} indicator{preset.indicators.length !== 1 ? 's' : ''}
                                            {' · '}
                                            {new Date(preset.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className={styles.itemActions}>
                                        <button
                                            className={styles.btnLoad}
                                            onClick={() => handleLoad(preset)}
                                            title="Load this template"
                                        >
                                            Load
                                        </button>
                                        <button
                                            className={styles.btnIcon}
                                            onClick={() => { setEditingId(preset.id); setEditName(preset.name); }}
                                            title="Rename"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        {confirmDelete === preset.id ? (
                                            <>
                                                <button className={styles.btnDanger} onClick={() => handleDelete(preset.id)}>
                                                    <Check size={13} />
                                                </button>
                                                <button className={styles.btnGhost} onClick={() => setConfirmDelete(null)}>
                                                    <X size={13} />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                className={styles.btnIcon}
                                                onClick={() => setConfirmDelete(preset.id)}
                                                title="Delete"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IndicatorTemplatesDialog;
