import { useState, useEffect, FormEvent } from 'react';
import axios from 'axios';
import { debtsApi } from '../services/api';
import type { Debt } from '../services/api';

const fmt = (n: number) => `${n.toFixed(2)} €`;

/** Skolų ir paskolų sekimo kortelė */
export default function DebtSettings() {
  const [debts, setDebts]     = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [showForm, setShowForm] = useState(false);
  const [name, setName]         = useState('');
  const [type, setType]         = useState<'BORROWED' | 'LENT'>('BORROWED');
  const [principal, setPrincipal] = useState('');
  const [busy, setBusy]         = useState(false);

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

  useEffect(() => {
    debtsApi.list()
      .then(({ debts }) => setDebts(debts))
      .catch(() => setError('Could not load debts'))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(principal);
    if (!name.trim()) { setError('Enter a name'); return; }
    if (isNaN(parsed) || parsed <= 0) { setError('Enter a valid amount'); return; }
    setBusy(true); setError('');
    try {
      const debt = await debtsApi.create({ name: name.trim(), type, principal: parsed });
      setDebts(prev => [debt, ...prev]);
      setName(''); setPrincipal(''); setShowForm(false);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Failed to add');
      else setError('Failed to add');
    } finally { setBusy(false); }
  };

  const handlePay = async (id: string) => {
    const parsed = parseFloat(payAmount);
    if (isNaN(parsed) || parsed <= 0) return;
    setBusy(true);
    try {
      const updated = await debtsApi.pay(id, parsed);
      setDebts(prev => prev.map(d => (d.id === id ? updated : d)));
      setPayingId(null); setPayAmount('');
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    await debtsApi.remove(id).catch(() => null);
    setDebts(prev => prev.filter(d => d.id !== id));
  };

  if (loading) return null;

  const owedByMe = debts.filter(d => d.type === 'BORROWED' && !d.closedAt).reduce((s, d) => s + d.remaining, 0);
  const owedToMe = debts.filter(d => d.type === 'LENT' && !d.closedAt).reduce((s, d) => s + d.remaining, 0);

  return (
    <div className="x-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500 }}>
          Debts & loans
        </div>
        {(owedByMe > 0 || owedToMe > 0) && (
          <span className="x-mono" style={{ fontSize: 11.5, color: 'var(--x-mid)' }}>
            {owedByMe > 0 && <span style={{ color: 'var(--x-neg)' }}>you owe {fmt(owedByMe)}</span>}
            {owedByMe > 0 && owedToMe > 0 && ' · '}
            {owedToMe > 0 && <span style={{ color: 'var(--x-pos)' }}>owed to you {fmt(owedToMe)}</span>}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--x-mid)', marginBottom: 14 }}>
        Track loans and money lent to friends — record payments until settled.
      </div>

      {debts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {debts.map(d => {
            const paid = d.principal - d.remaining;
            const pct = d.principal > 0 ? (paid / d.principal) * 100 : 0;
            const closed = !!d.closedAt;
            return (
              <div key={d.id} style={{ padding: '10px 12px', background: 'var(--x-paper)', borderRadius: 10, opacity: closed ? .55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12, flexShrink: 0,
                    background: d.type === 'BORROWED' ? 'rgba(193,75,58,.1)' : 'rgba(31,138,91,.1)',
                    color: d.type === 'BORROWED' ? 'var(--x-neg)' : 'var(--x-pos)',
                  }}>
                    {d.type === 'BORROWED' ? 'YOU OWE' : 'OWED TO YOU'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.name}{closed && ' ✓'}
                  </span>
                  <span className="x-mono" style={{ fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
                    {closed ? 'settled' : fmt(d.remaining)}
                  </span>
                  {!closed && (
                    <button type="button" onClick={() => { setPayingId(payingId === d.id ? null : d.id); setPayAmount(''); }}
                      style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 9px', borderRadius: 7, border: '1px solid var(--x-hair)', background: 'var(--x-bg)', color: 'var(--x-accent)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      Pay
                    </button>
                  )}
                  <button type="button" onClick={() => handleDelete(d.id)} title="Delete"
                    style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', padding: 3, display: 'flex', flexShrink: 0, opacity: .6 }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                    </svg>
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                  <div style={{ flex: 1, height: 5, background: 'var(--x-paper-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: closed ? 'var(--x-pos)' : 'var(--x-accent)', transition: 'width .4s ease' }} />
                  </div>
                  <span className="x-mono" style={{ fontSize: 10.5, color: 'var(--x-mid)', flexShrink: 0 }}>
                    {fmt(paid)} / {fmt(d.principal)}
                  </span>
                </div>
                {payingId === d.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input type="number" min="0.01" step="0.01" value={payAmount} placeholder="Payment amount"
                      onChange={e => setPayAmount(e.target.value)} className="x-input" style={{ height: 34, fontSize: 13 }} autoFocus />
                    <button type="button" disabled={busy} onClick={() => handlePay(d.id)}
                      className="x-btn x-btn-primary" style={{ height: 34, fontSize: 12.5, padding: '0 14px' }}>
                      Record
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--x-paper)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div>
              <label className="x-label">Name</label>
              <input type="text" value={name} maxLength={60} placeholder="e.g. Car leasing"
                onChange={e => setName(e.target.value)} className="x-input" />
            </div>
            <div>
              <label className="x-label">Amount (€)</label>
              <input type="number" min="0.01" step="0.01" value={principal} placeholder="e.g. 5000"
                onChange={e => setPrincipal(e.target.value)} className="x-input" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['BORROWED', 'LENT'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                style={{
                  flex: 1, padding: '9px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${type === t ? 'var(--x-ink)' : 'var(--x-hair)'}`,
                  background: type === t ? 'var(--x-ink)' : 'var(--x-bg)',
                  color: type === t ? 'var(--x-bg)' : 'var(--x-ink-2)',
                }}>
                {t === 'BORROWED' ? 'I owe' : 'Owed to me'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy} className="x-btn x-btn-primary" style={{ flex: 1, height: 38 }}>
              {busy ? 'Adding…' : 'Add'}
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
          + Add debt or loan
        </button>
      )}

      {error && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--x-neg)' }}>⚠ {error}</div>}
    </div>
  );
}
