import { useState, useEffect, FormEvent } from 'react';
import axios from 'axios';
import { recurringApi } from '../services/api';
import type { RecurringExpense, ExpenseCategory } from '../types';
import { useCategories } from '../hooks/useCategories';

const fmt = (n: number) => `${n.toFixed(2)} €`;

/** Pasikartojančių išlaidų (nuoma, prenumeratos...) valdymo kortelė */
export default function RecurringSettings() {
  const { cats, metaFor } = useCategories();
  const [items, setItems]     = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Add form
  const [showForm, setShowForm]   = useState(false);
  const [category, setCategory]   = useState<ExpenseCategory>('KITOS');
  const [amount, setAmount]       = useState('');
  const [note, setNote]           = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [adding, setAdding]       = useState(false);

  useEffect(() => {
    recurringApi.list()
      .then(({ recurring }) => setItems(recurring))
      .catch(() => setError('Could not load recurring expenses'))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const parsed = parseFloat(amount);
    const day = parseInt(dayOfMonth, 10);
    if (isNaN(parsed) || parsed <= 0) { setError('Enter a valid amount'); return; }
    if (isNaN(day) || day < 1 || day > 28) { setError('Day must be 1–28'); return; }

    setAdding(true);
    try {
      const item = await recurringApi.create({
        category, amount: parsed, note: note.trim() || undefined, dayOfMonth: day,
      });
      setItems(prev => [...prev, item].sort((a, b) => a.dayOfMonth - b.dayOfMonth));
      setAmount(''); setNote(''); setDayOfMonth('1'); setShowForm(false);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Failed to add');
      else setError('Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (item: RecurringExpense) => {
    const updated = await recurringApi.setActive(item.id, !item.active).catch(() => null);
    if (updated) setItems(prev => prev.map(i => (i.id === item.id ? updated : i)));
  };

  const handleDelete = async (id: string) => {
    await recurringApi.remove(id).catch(() => null);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  if (loading) return null;

  const monthlyTotal = items.filter(i => i.active).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="x-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500 }}>
          Recurring expenses
        </div>
        {monthlyTotal > 0 && (
          <span className="x-mono" style={{ fontSize: 12, color: 'var(--x-mid)' }}>{fmt(monthlyTotal)}/mo</span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--x-mid)', marginBottom: 14 }}>
        Rent, subscriptions and other fixed costs — added automatically each month on the chosen day.
      </div>

      {/* List */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {items.map(item => {
            const meta = metaFor(item.category);
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', background: 'var(--x-paper)', borderRadius: 10,
                opacity: item.active ? 1 : .5,
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{meta.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--x-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.note || meta.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--x-mid)', marginTop: 1 }}>
                    {meta.label} · day {item.dayOfMonth}{!item.active && ' · paused'}
                  </div>
                </div>
                <span className="x-mono" style={{ fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{fmt(item.amount)}</span>
                <button type="button" onClick={() => handleToggle(item)}
                  title={item.active ? 'Pause' : 'Resume'}
                  style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', padding: 4, display: 'flex', flexShrink: 0 }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    {item.active
                      ? <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>
                      : <path d="M8 5v14l11-7z"/>}
                  </svg>
                </button>
                <button type="button" onClick={() => handleDelete(item.id)} title="Delete"
                  style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', padding: 4, display: 'flex', flexShrink: 0, opacity: .7 }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && !showForm && (
        <div style={{ fontSize: 13, color: 'var(--x-mid)', padding: '14px 0', textAlign: 'center' }}>
          No recurring expenses yet
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--x-paper)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="x-label">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className="x-input">
                {cats.map(c => (
                  <option key={c.code} value={c.code}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="x-label">Day of month (1–28)</label>
              <input type="number" min="1" max="28" value={dayOfMonth}
                onChange={e => setDayOfMonth(e.target.value)} className="x-input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="x-label">Amount (€)</label>
              <input type="number" min="0.01" step="0.01" value={amount} placeholder="e.g. 400"
                onChange={e => setAmount(e.target.value)} className="x-input" />
            </div>
            <div>
              <label className="x-label">Note (optional)</label>
              <input type="text" value={note} maxLength={60} placeholder="e.g. Rent"
                onChange={e => setNote(e.target.value)} className="x-input" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={adding} className="x-btn x-btn-primary" style={{ flex: 1, height: 38 }}>
              {adding ? 'Adding…' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(''); }}
              className="x-btn x-btn-secondary" style={{ height: 38 }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          style={{
            width: '100%', padding: '10px', borderRadius: 9,
            border: '1px dashed var(--x-hair-2)', background: 'transparent',
            color: 'var(--x-mid)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
          }}>
          + Add recurring expense
        </button>
      )}

      {error && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--x-neg)' }}>⚠ {error}</div>
      )}
    </div>
  );
}
