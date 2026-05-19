import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { expensesApi } from '../services/api';
import type { ExpenseCategory } from '../types';
import { CATEGORY_META } from '../types';

const CATEGORIES: ExpenseCategory[] = ['MAISTAS', 'KURAS', 'RUBAI', 'NEBUTINOS', 'BOLT_WOLT', 'KITOS'];

type Step = 'confirm' | 'form' | 'done';

export default function QuickAdd() {
  const navigate = useNavigate();
  const [step, setStep]         = useState<Step>('confirm');
  const [amount, setAmount]     = useState('');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const handleSave = async () => {
    if (!category || !amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    setError('');
    try {
      await expensesApi.createExpense({ category, amount: parseFloat(amount) });
      setStep('done');
      setTimeout(() => navigate('/'), 1400);
    } catch {
      setError('Nepavyko išsaugoti. Bandyk dar kartą.');
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(11,13,16,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 200, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--x-bg)',
        borderRadius: '24px 24px 0 0',
        width: '100%', maxWidth: 520,
        padding: '28px 24px calc(32px + env(safe-area-inset-bottom))',
        animation: 'slideUp .3s cubic-bezier(0.32,0.72,0,1) both',
      }}>
        <style>{`
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes slideRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes fadeScale { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
          .qa-step { animation: slideRight .25s cubic-bezier(0.32,0.72,0,1) both; }
        `}</style>

        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--x-hair-2)', margin: '0 auto 24px' }} />

        {/* ── Step 1: Confirmation ── */}
        {step === 'confirm' && (
          <div className="qa-step">
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 10 }}>💳</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, textAlign: 'center', letterSpacing: -0.4 }}>
              Ar susimokėjai?
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--x-mid)', textAlign: 'center' }}>
              Aptikome Wallet aktyvumą. Pridėti išlaidą?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  flex: 1, height: 50, borderRadius: 14, border: '1px solid var(--x-hair-2)',
                  background: 'var(--x-paper)', color: 'var(--x-ink-2)',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  transition: 'opacity .12s',
                }}
              >
                Ne
              </button>
              <button
                onClick={() => setStep('form')}
                style={{
                  flex: 1, height: 50, borderRadius: 14, border: 0,
                  background: 'var(--x-ink)', color: 'var(--x-bg)',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  transition: 'opacity .12s',
                }}
              >
                Taip ✓
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Form ── */}
        {step === 'form' && (
          <div className="qa-step">
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
              Kiek mokėjai?
            </h2>

            {/* Amount */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <span style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                fontSize: 22, color: 'var(--x-mid)', pointerEvents: 'none', fontWeight: 500,
              }}>€</span>
              <input
                autoFocus
                type="number" inputMode="decimal" min="0.01" step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  width: '100%', height: 58, paddingLeft: 44, paddingRight: 16,
                  border: '1px solid var(--x-hair)', borderRadius: 14,
                  background: 'var(--x-paper)', color: 'var(--x-ink)',
                  fontSize: 24, fontWeight: 600, outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
              />
            </div>

            {/* Category grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 22 }}>
              {CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    style={{
                      height: 62, borderRadius: 12, border: `1.5px solid ${active ? 'var(--x-ink)' : 'var(--x-hair)'}`,
                      background: active ? 'var(--x-ink)' : 'var(--x-paper)',
                      color: active ? 'var(--x-bg)' : 'var(--x-ink-2)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 4, cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, transition: 'all .15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {error && (
              <div style={{ fontSize: 13, color: 'var(--x-neg)', marginBottom: 12 }}>⚠ {error}</div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !category || !amount || parseFloat(amount) <= 0}
              style={{
                width: '100%', height: 52, borderRadius: 14, border: 0,
                background: 'var(--x-ink)', color: 'var(--x-bg)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                opacity: (!category || !amount || parseFloat(amount) <= 0 || saving) ? 0.4 : 1,
                transition: 'opacity .15s', fontFamily: 'inherit',
              }}
            >
              {saving ? 'Išsaugoma…' : 'Išsaugoti'}
            </button>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '12px 0', animation: 'fadeScale .3s ease both' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Išsaugota!</div>
            <div style={{ fontSize: 13, color: 'var(--x-mid)', marginTop: 4 }}>Grįžtama į pradžią…</div>
          </div>
        )}
      </div>
    </div>
  );
}
