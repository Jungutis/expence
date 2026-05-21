import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { expensesApi, profileApi } from '../services/api';
import type { ExpenseCategory } from '../types';
import { CATEGORY_META } from '../types';
import { calculateFoodBudget } from '../utils/budgetUtils';
import type { FoodBudgetStatus } from '../utils/budgetUtils';
import axios from 'axios';

const CATEGORIES: ExpenseCategory[] = ['MAISTAS','KURAS','RUBAI','NEBUTINOS','BOLT_WOLT','KITOS'];

const CAT_DOTS: Record<ExpenseCategory, string> = {
  MAISTAS:   '#a04d2e',
  KURAS:     '#1f5454',
  RUBAI:     '#8a5258',
  NEBUTINOS: '#6d4870',
  BOLT_WOLT: '#547040',
  KITOS:     '#a07d2e',
};
const CAT_SOFT: Record<ExpenseCategory, string> = {
  MAISTAS:   '#ecd0bf',
  KURAS:     '#cad9d9',
  RUBAI:     '#e8d2d4',
  NEBUTINOS: '#ddd0de',
  BOLT_WOLT: '#d6dec8',
  KITOS:     '#eddfbc',
};

export default function CreateRecord() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [amount, setAmount]     = useState('');
  const [note, setNote]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [exiting, setExiting]   = useState(false);
  const [budgetStatus, setBudgetStatus] = useState<FoodBudgetStatus | null>(null);
  const [amountTouched, setAmountTouched] = useState(false);
  const [amountError,   setAmountError]   = useState('');

  const validateAmount = (val: string): string => {
    if (!val) return 'Amount is required';
    const normalised = val.replace(',', '.');
    const parsed = parseFloat(normalised);
    if (isNaN(parsed)) return 'Enter a valid number';
    if (parsed <= 0)   return 'Amount must be greater than 0';
    const decimals = normalised.split('.')[1];
    if (decimals && decimals.length > 2) return 'Max 2 decimal places (e.g. 2.22)';
    return '';
  };

  const handleAmountChange = (val: string) => {
    // Block input that would create more than 2 decimal places
    if (val !== '' && !/^\d*[,.]?\d{0,2}$/.test(val)) return;
    setAmount(val);
    setError('');
    if (amountTouched) setAmountError(validateAmount(val));
  };

  const handleAmountBlur = () => {
    setAmountTouched(true);
    setAmountError(validateAmount(amount));
  };

  const pickQuickAmount = (q: number) => {
    setAmount(String(q));
    setAmountError('');
    setAmountTouched(true);
  };

  const now = new Date();

  useEffect(() => {
    (async () => {
      try {
        const [expenses, profile] = await Promise.all([
          expensesApi.getExpenses(now.getMonth() + 1, now.getFullYear()),
          profileApi.getProfile(),
        ]);
        setBudgetStatus(calculateFoodBudget(expenses.expenses, profile.foodDailyLimit, profile.foodMonthlyLimit, now.getMonth() + 1, now.getFullYear()));
      } catch { /* silent */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category) { setError('Select a category'); return; }
    const parsed = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) { setError('Enter a valid amount'); return; }
    setError(''); setLoading(true);
    try {
      await expensesApi.createExpense({ category, amount: parsed, note: note.trim() || undefined });
      setSuccess(true);
      setTimeout(() => setExiting(true), 500);
      setTimeout(() => navigate('/'), 820);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Something went wrong.');
      else setError('Unexpected error. Try again.');
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <div style={{
        minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: exiting ? 'successOut .32s cubic-bezier(0.4,0,1,1) both' : 'successIn .3s cubic-bezier(0,0,0.2,1) both',
      }}>
        <style>{`
          @keyframes successIn  { from { opacity:0; transform:scale(.88) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
          @keyframes successOut { from { opacity:1; transform:scale(1) translateY(0); } to { opacity:0; transform:scale(.92) translateY(-8px); } }
        `}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'rgba(31,138,91,.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 0 10px rgba(31,138,91,.06)',
          }}>
            <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="var(--x-pos)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--x-ink)', letterSpacing: -0.3 }}>Saved!</div>
        </div>
      </div>
    );
  }

  const parsedAmt = parseFloat(amount.replace(',', '.'));
  const showSummary = category && !isNaN(parsedAmt) && parsedAmt > 0;

  return (
    <div style={{ padding: 'var(--pulse-pad, 24px)', paddingBottom: 'max(48px, calc(var(--pulse-pad, 24px) + 64px))', maxWidth: 560, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--x-mid)', textDecoration: 'none', marginBottom: 16 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>New expense</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--x-mid)' }}>Date is set automatically</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Category */}
        <div className="x-card">
          <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 14 }}>
            1 · Category
          </div>

          {/* Budget warnings */}
          {budgetStatus?.isMonthlyExceeded && (
            <div style={{ background: 'rgba(193,75,58,.07)', border: '1px solid rgba(193,75,58,.2)', borderRadius: 9, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--x-neg)' }}>
              ⛔ Monthly food budget exceeded. Food expenses are blocked.
            </div>
          )}
          {budgetStatus?.isWeeklyExceeded && !budgetStatus.isMonthlyExceeded && (
            <div style={{ background: 'rgba(193,75,58,.06)', border: '1px solid rgba(193,75,58,.15)', borderRadius: 9, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--x-neg)' }}>
              🔴 Weekly food budget exceeded. Next week's limit is reduced.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
            {CATEGORIES.map(cat => {
              const meta     = CATEGORY_META[cat];
              const dot      = CAT_DOTS[cat];
              const catSoft  = CAT_SOFT[cat];
              const selected = category === cat;
              const blocked  = cat === 'MAISTAS' && !!budgetStatus?.isMonthlyExceeded;
              return (
                <button key={cat} type="button" disabled={blocked}
                  onClick={() => { if (!blocked) { setCategory(cat); setError(''); } }}
                  style={{
                    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                    padding: '14px 10px', borderRadius: 11, cursor: blocked ? 'not-allowed' : 'pointer',
                    // Active: dot bg, white text / Passive: soft tint, dot border
                    border: selected ? `2px solid ${dot}` : `1px solid ${catSoft}`,
                    background: selected ? dot : catSoft,
                    opacity: blocked ? .45 : 1,
                    transition: 'all .12s', fontFamily: 'inherit',
                  }}>
                  {selected && (
                    <span style={{ position: 'absolute', top: 7, right: 7, width: 14, height: 14, borderRadius: 7, background: 'rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                    </span>
                  )}
                  <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: selected ? '#fff' : dot, textAlign: 'center', lineHeight: 1.2 }}>{meta.label}</span>
                  {blocked && <span style={{ fontSize: 10, color: 'var(--x-neg)' }}>Blocked</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount */}
        <div className="x-card">
          <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 14 }}>
            2 · Amount
          </div>
          <div style={{ position: 'relative' }}>
            <span className="x-mono" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: amountError && amountTouched ? 'var(--x-neg)' : 'var(--x-mid)', pointerEvents: 'none', transition: 'color .15s' }}>€</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              onChange={e => handleAmountChange(e.target.value)}
              onBlur={handleAmountBlur}
              className={`x-input x-mono${amountError && amountTouched ? ' error' : ''}`}
              style={{ paddingLeft: 36, fontSize: 20, fontWeight: 500, height: 50 }}
            />
          </div>

          {/* Inline error */}
          <div style={{
            maxHeight: amountError && amountTouched ? 28 : 0,
            overflow: 'hidden',
            transition: 'max-height .2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, fontSize: 12.5, color: 'var(--x-neg)', fontWeight: 500 }}>
              <span style={{ fontSize: 14 }}>✳</span>
              {amountError}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {[5, 10, 20, 50, 100].map(q => (
              <button key={q} type="button" onClick={() => pickQuickAmount(q)}
                style={{ padding: '5px 12px', border: `1px solid ${amount === String(q) ? 'var(--x-ink)' : 'var(--x-hair)'}`, borderRadius: 7, background: amount === String(q) ? 'var(--x-ink)' : 'transparent', color: amount === String(q) ? 'var(--x-bg)' : 'var(--x-ink-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .1s' }}>
                {q} €
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="x-card">
          <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 14 }}>
            3 · Note <span style={{ fontSize: 10, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span>
          </div>
          <textarea value={note} maxLength={200} rows={2} placeholder="e.g. Lidl groceries, fuel..."
            onChange={e => setNote(e.target.value)}
            className="x-textarea" />
          <div style={{ fontSize: 11, color: 'var(--x-mid-2)', textAlign: 'right', marginTop: 4 }}>{note.length}/200</div>
        </div>

        {/* Summary */}
        {showSummary && (
          <div style={{ background: 'var(--x-accent-soft)', border: '1px solid rgba(42,111,219,.2)', borderRadius: 11, padding: '14px 18px' }} className="anim-fade">
            <div style={{ fontSize: 11.5, color: 'var(--x-accent)', fontWeight: 500, marginBottom: 6 }}>Summary</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, color: 'var(--x-ink-2)' }}>
                {CATEGORY_META[category!].emoji} {CATEGORY_META[category!].label}
                {note && ` · ${note}`}
              </span>
              <span className="x-mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--x-ink)' }}>
                {parsedAmt.toFixed(2)} €
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(193,75,58,.07)', border: '1px solid rgba(193,75,58,.2)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: 'var(--x-neg)' }}>
            ⚠ {error}
          </div>
        )}

        <button type="submit" disabled={loading || !category || !amount || !!amountError} className="x-btn x-btn-primary" style={{ height: 44, fontSize: 14.5 }}>
          {loading ? 'Saving…' : 'Save expense'}
        </button>
      </form>
    </div>
  );
}
