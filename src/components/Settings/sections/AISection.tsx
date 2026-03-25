/**
 * AI Analysis Settings Section
 * Allows users to save their Claude API key and preferred model for AI chart analysis.
 */
import React, { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';
import styles from '../SettingsPopup.module.css';
import { STORAGE_KEYS } from '../../../constants/storageKeys';

const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-6',          label: 'Sonnet 4.6 — Fast, Recommended' },
  { value: 'claude-opus-4-6',            label: 'Opus 4.6 — Most Capable, Slower' },
  { value: 'claude-haiku-4-5-20251001',  label: 'Haiku 4.5 — Fastest, Cheapest' },
];

const AISection: React.FC = () => {
  const [apiKey, setApiKey]   = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [model, setModel]     = useState('claude-sonnet-4-6');

  useEffect(() => {
    const storedKey   = localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY);
    const storedModel = localStorage.getItem(STORAGE_KEYS.CLAUDE_MODEL);
    if (storedKey)   setApiKey(storedKey);
    if (storedModel) setModel(storedModel);
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.CLAUDE_API_KEY, apiKey.trim());
    localStorage.setItem(STORAGE_KEYS.CLAUDE_MODEL, model);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEYS.CLAUDE_API_KEY);
    setApiKey('');
    setSaved(false);
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setModel(val);
    localStorage.setItem(STORAGE_KEYS.CLAUDE_MODEL, val);
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>AI ANALYSIS (CLAUDE)</h3>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Claude API Key</label>
        <div className={styles.inputWithIcon}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
            placeholder="sk-ant-api..."
            className={styles.input}
            autoComplete="off"
          />
          <button
            type="button"
            className={styles.eyeButton}
            onClick={() => setShowKey(v => !v)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className={styles.inputHint}>
          Used only for AI chart analysis. Stored locally in your browser.{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--tv-color-brand, #2962ff)' }}
          >
            Get API key ↗
          </a>
        </p>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Claude Model</label>
        <select
          value={model}
          onChange={handleModelChange}
          className={styles.input}
          style={{ cursor: 'pointer' }}
        >
          {CLAUDE_MODELS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <p className={styles.inputHint}>Model used for chart analysis. Saved immediately.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          className={styles.okButton}
          onClick={handleSave}
          disabled={!apiKey.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {saved ? <Check size={13} /> : null}
          {saved ? 'Saved!' : 'Save Key'}
        </button>
        {apiKey && (
          <button
            className={styles.cancelButton}
            onClick={handleClear}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default AISection;
