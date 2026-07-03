import { useState, FormEvent } from 'react';
import axios from 'axios';
import { categoriesApi } from '../services/api';
import type { CategoryDef } from '../types';
import { useCategories } from '../hooks/useCategories';

/** Spalvų paletė custom kategorijoms — [pagrindinė, šviesi] poros pagal esamą dizainą */
const PALETTE: { color: string; soft: string }[] = [
  { color: '#a04d2e', soft: '#ecd0bf' }, // terracotta
  { color: '#4a6a8a', soft: '#d4dde6' }, // steel blue
  { color: '#8a5258', soft: '#e8d2d4' }, // rosewood
  { color: '#5b5a8c', soft: '#dadae6' }, // dusk violet
  { color: '#2e6a7a', soft: '#d2e2e6' }, // teal
  { color: '#a07d2e', soft: '#eddfbc' }, // honey
  { color: '#3e7a4e', soft: '#d0e4d4' }, // forest
  { color: '#7a5a3e', soft: '#e6dcd0' }, // walnut
  { color: '#9c3a66', soft: '#ecd0dd' }, // berry
  { color: '#54718c', soft: '#d8e0e8' }, // slate
];

const EMOJI_SUGGESTIONS = ['🐾','🏠','💊','🎮','📚','✈️','🎁','🚗','💇','🏋️','🎵','🧸','🍺','☕','🚌','🧾'];

export default function CategorySettings() {
  const { cats, all, refresh } = useCategories();

  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel]         = useState('');
  const [emoji, setEmoji]         = useState('🐾');
  const [palette, setPalette]     = useState(0);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');

  const archived = all.filter(c => c.archived);

  const startAdd = () => {
    setEditingId(null); setLabel(''); setEmoji('🐾'); setPalette(0);
    setShowForm(true); setError('');
  };

  const startEdit = (c: CategoryDef) => {
    setEditingId(c.id); setLabel(c.label); setEmoji(c.emoji);
    const idx = PALETTE.findIndex(p => p.color === c.color);
    setPalette(idx >= 0 ? idx : 0);
    setShowForm(true); setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { setError('Enter a name'); return; }
    setBusy(true); setError('');
    try {
      const data = { label: label.trim(), emoji, color: PALETTE[palette].color, soft: PALETTE[palette].soft };
      if (editingId) await categoriesApi.update(editingId, data);
      else await categoriesApi.create(data);
      await refresh();
      setShowForm(false);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Save failed');
      else setError('Save failed');
    } finally { setBusy(false); }
  };

  const handleDelete = async (c: CategoryDef) => {
    setBusy(true); setError('');
    try {
      await categoriesApi.remove(c.id);
      await refresh();
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Delete failed');
      else setError('Delete failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="x-card">
      <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 4 }}>
        Categories
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--x-mid)', marginBottom: 14 }}>
        Create your own categories with an emoji and colour. Categories in use are archived instead of deleted.
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {cats.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--x-paper)', borderRadius: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: c.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
              {c.emoji}
            </span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--x-ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.label}
            </span>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: c.color, flexShrink: 0 }} />
            <button type="button" onClick={() => startEdit(c)} title="Edit" disabled={busy}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', padding: 4, display: 'flex', flexShrink: 0 }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>
              </svg>
            </button>
            {c.code !== 'MAISTAS' && (
              <button type="button" onClick={() => handleDelete(c)} title="Delete / archive" disabled={busy}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', padding: 4, display: 'flex', flexShrink: 0, opacity: .7 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {archived.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--x-mid-2)', marginBottom: 12 }}>
          Archived: {archived.map(c => `${c.emoji} ${c.label}`).join(', ')} — still shown on old expenses.
        </div>
      )}

      {/* Add/edit form */}
      {showForm ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--x-paper)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div>
              <label className="x-label">Name</label>
              <input type="text" value={label} maxLength={24} placeholder="e.g. Pets"
                onChange={e => setLabel(e.target.value)} className="x-input" />
            </div>
            <div>
              <label className="x-label">Emoji</label>
              <input type="text" value={emoji} maxLength={4}
                onChange={e => setEmoji(e.target.value)} className="x-input" style={{ textAlign: 'center', fontSize: 17 }} />
            </div>
          </div>

          <div>
            <label className="x-label">Quick emoji</label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {EMOJI_SUGGESTIONS.map(em => (
                <button key={em} type="button" onClick={() => setEmoji(em)}
                  style={{
                    width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: 'pointer',
                    border: emoji === em ? '2px solid var(--x-ink)' : '1px solid var(--x-hair)',
                    background: 'var(--x-bg)', fontFamily: 'inherit',
                  }}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="x-label">Colour</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PALETTE.map((p, i) => (
                <button key={p.color} type="button" onClick={() => setPalette(i)}
                  style={{
                    width: 30, height: 30, borderRadius: 15, background: p.color, cursor: 'pointer',
                    border: palette === i ? '3px solid var(--x-ink)' : '3px solid transparent',
                    outline: `1px solid ${p.soft}`, padding: 0,
                  }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy} className="x-btn x-btn-primary" style={{ flex: 1, height: 38 }}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add category'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(''); }}
              className="x-btn x-btn-secondary" style={{ height: 38 }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={startAdd}
          style={{
            width: '100%', padding: '10px', borderRadius: 9,
            border: '1px dashed var(--x-hair-2)', background: 'transparent',
            color: 'var(--x-mid)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
          }}>
          + Add category
        </button>
      )}

      {error && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--x-neg)' }}>⚠ {error}</div>
      )}
    </div>
  );
}
