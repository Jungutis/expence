import { useState, useEffect } from 'react';
import { budgetsApi } from '../services/api';
import type { Budget } from '../types';
import { useCategories } from '../hooks/useCategories';

/** Mėnesio biudžetų (bendro ir pagal kategoriją) nustatymo kortelė */
export default function BudgetSettings() {
  const { cats } = useCategories();
  const [values, setValues]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    budgetsApi.list()
      .then(({ budgets }) => {
        const v: Record<string, string> = {};
        budgets.forEach((b: Budget) => { v[b.category] = String(b.amount); });
        setValues(v);
      })
      .catch(() => setError('Could not load budgets'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const keys = ['TOTAL', ...cats.map(c => c.code)];
      for (const key of keys) {
        const raw = (values[key] ?? '').trim();
        const amount = raw === '' ? null : parseFloat(raw);
        if (amount !== null && (isNaN(amount) || amount < 0)) {
          const cat = cats.find(c => c.code === key);
          setError(`Invalid amount for ${key === 'TOTAL' ? 'Total' : cat?.label ?? key}`);
          setSaving(false);
          return;
        }
        await budgetsApi.upsert(key, amount);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="x-card">
      <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 4 }}>
        Monthly budgets
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--x-mid)', marginBottom: 16 }}>
        Optional spending limits — leave empty for no limit. Progress shows on the dashboard.
      </div>

      {/* Total budget */}
      <div style={{ marginBottom: 14 }}>
        <label className="x-label">Total monthly budget (€)</label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--x-mid)', pointerEvents: 'none' }}>€</span>
          <input type="number" min="0" step="1" placeholder="No limit"
            value={values['TOTAL'] ?? ''}
            onChange={e => setValues(v => ({ ...v, TOTAL: e.target.value }))}
            className="x-input" style={{ paddingLeft: 28 }} />
        </div>
      </div>

      {/* Per-category */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {cats.map(cat => (
          <div key={cat.code}>
            <label className="x-label">{cat.emoji} {cat.label} (€)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--x-mid)', pointerEvents: 'none' }}>€</span>
              <input type="number" min="0" step="1" placeholder="—"
                value={values[cat.code] ?? ''}
                onChange={e => setValues(v => ({ ...v, [cat.code]: e.target.value }))}
                className="x-input" style={{ paddingLeft: 28 }} />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--x-neg)' }}>⚠ {error}</div>
      )}
      {saved && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--x-pos)', fontWeight: 500 }} className="anim-fade">
          ✓ Budgets saved
        </div>
      )}

      <button type="button" onClick={handleSave} disabled={saving}
        className="x-btn x-btn-secondary" style={{ marginTop: 14, width: '100%', height: 40 }}>
        {saving ? 'Saving…' : 'Save budgets'}
      </button>
    </div>
  );
}
