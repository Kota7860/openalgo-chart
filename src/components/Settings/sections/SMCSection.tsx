/**
 * SMC / ICT Settings Section
 * User-configurable parameters for SMC detection and overlay colors.
 */
import React, { useState, ChangeEvent } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import styles from '../SettingsPopup.module.css';
import { STORAGE_KEYS } from '../../../constants/storageKeys';
import { DEFAULT_SMC_OPTIONS, SMCDetectionOptions } from '../../../services/smcDetectionService';
import { DEFAULT_SMC_COLORS, SMCOverlayColors } from '../../../plugins/smc-overlays/SMCOverlayPrimitive';

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadDetectionOpts(): SMCDetectionOptions {
  try {
    const s = localStorage.getItem(STORAGE_KEYS.SMC_SETTINGS);
    return s ? { ...DEFAULT_SMC_OPTIONS, ...JSON.parse(s) } : { ...DEFAULT_SMC_OPTIONS };
  } catch { return { ...DEFAULT_SMC_OPTIONS }; }
}

function loadColors(): SMCOverlayColors {
  try {
    const s = localStorage.getItem(STORAGE_KEYS.SMC_OVERLAY_COLORS);
    return s ? { ...DEFAULT_SMC_COLORS, ...JSON.parse(s) } : { ...DEFAULT_SMC_COLORS };
  } catch { return { ...DEFAULT_SMC_COLORS }; }
}

// Convert any color string to hex for <input type="color">
function toHex(color: string): string {
  if (color.startsWith('#')) return color.slice(0, 7);
  const m = color.match(/rgba?\s*\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return '#' + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
  }
  return '#2962ff';
}

// Build a rgba string with fixed opacity from hex
function fromHex(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SMCSection: React.FC = () => {
  const [opts, setOpts]       = useState<SMCDetectionOptions>(loadDetectionOpts);
  const [colors, setColors]   = useState<SMCOverlayColors>(loadColors);
  const [saved, setSaved]     = useState(false);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.SMC_SETTINGS, JSON.stringify(opts));
    localStorage.setItem(STORAGE_KEYS.SMC_OVERLAY_COLORS, JSON.stringify(colors));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setOpts({ ...DEFAULT_SMC_OPTIONS });
    setColors({ ...DEFAULT_SMC_COLORS });
    localStorage.removeItem(STORAGE_KEYS.SMC_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.SMC_OVERLAY_COLORS);
  };

  const setOpt = <K extends keyof SMCDetectionOptions>(key: K, value: SMCDetectionOptions[K]) => {
    setOpts(prev => ({ ...prev, [key]: value }));
  };

  const setColor = (key: keyof SMCOverlayColors, hex: string) => {
    // Apply color with appropriate alpha based on the default
    const defaultVal = DEFAULT_SMC_COLORS[key];
    const alphaMatch = defaultVal.match(/[\d.]+\)$/);
    const alpha = alphaMatch ? parseFloat(alphaMatch[0]) : 1;
    const newColor = defaultVal.startsWith('#') ? hex : fromHex(hex, alpha);
    setColors(prev => ({ ...prev, [key]: newColor }));
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>SMC DETECTION</h3>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Swing Lookback Bars</label>
        <input
          type="number"
          min={1} max={10} step={1}
          value={opts.swingLookback}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setOpt('swingLookback', Math.max(1, parseInt(e.target.value) || 3))
          }
          className={styles.input}
        />
        <p className={styles.inputHint}>Bars left/right to confirm a swing high/low (default: 3).</p>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>FVG Min Gap (% of avg range)</label>
        <input
          type="number"
          min={1} max={50} step={1}
          value={Math.round(opts.fvgMinGapRatio * 100)}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setOpt('fvgMinGapRatio', Math.max(0.01, parseInt(e.target.value) / 100 || 0.1))
          }
          className={styles.input}
        />
        <p className={styles.inputHint}>Minimum FVG size as % of average candle range (default: 10%).</p>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Liquidity Tolerance (%)</label>
        <input
          type="number"
          min={0.05} max={2} step={0.05}
          value={+(opts.liquidityTolerancePct * 100).toFixed(2)}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setOpt('liquidityTolerancePct', Math.max(0.001, parseFloat(e.target.value) / 100 || 0.003))
          }
          className={styles.input}
        />
        <p className={styles.inputHint}>How close two highs/lows must be to count as "equal" (default: 0.30%).</p>
      </div>

      <h3 className={styles.sectionTitle} style={{ marginTop: 16 }}>OVERLAY COLORS</h3>

      {(
        [
          ['obBullishFill',   'Bullish OB Fill'],
          ['obBullishStroke', 'Bullish OB Border'],
          ['obBearishFill',   'Bearish OB Fill'],
          ['obBearishStroke', 'Bearish OB Border'],
          ['fvgBullish',      'Bullish FVG'],
          ['fvgBearish',      'Bearish FVG'],
          ['bosColor',        'BOS Line'],
          ['chochColor',      'ChoCH Line'],
          ['liquidityHigh',   'EQH / High Sweep'],
          ['liquidityLow',    'EQL / Low Sweep'],
        ] as [keyof SMCOverlayColors, string][]
      ).map(([key, label]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span className={styles.inputLabel} style={{ margin: 0 }}>{label}</span>
          <input
            type="color"
            value={toHex(colors[key])}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setColor(key, e.target.value)}
            style={{ width: 32, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          className={styles.okButton}
          onClick={handleSave}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {saved ? <Check size={13} /> : null}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
        <button
          className={styles.cancelButton}
          onClick={handleReset}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RotateCcw size={13} />
          Reset Defaults
        </button>
      </div>
    </div>
  );
};

export default SMCSection;
