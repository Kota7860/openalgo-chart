/**
 * AI Analysis Settings Section
 * Allows users to save their Claude API key for AI chart analysis.
 */
import React, { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';
import styles from '../SettingsPopup.module.css';
import { STORAGE_KEYS } from '../../../constants/storageKeys';

const AISection: React.FC = () => {
  const [apiKey, setApiKey]       = useState('');
  const [showKey, setShowKey]     = useState(false);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CLAUDE_API_KEY);
    if (stored) setApiKey(stored);
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.CLAUDE_API_KEY, apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEYS.CLAUDE_API_KEY);
    setApiKey('');
    setSaved(false);
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
