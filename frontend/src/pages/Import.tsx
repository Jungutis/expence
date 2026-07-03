import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { expensesApi } from '../services/api';
import { useCategories } from '../hooks/useCategories';

const fmt = (n: number) => `${Math.abs(n).toFixed(2)} €`;

interface ParsedRow {
  date: string;      // YYYY-MM-DD
  amount: number;    // teigiama = išlaida
  note: string;
  category: string;
  include: boolean;
}

/** Paprastas CSV parseris: palaiko , ir ; skirtukus bei kabutes */
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Bando atspėti datą iš įvairių formatų → YYYY-MM-DD arba null */
function parseDate(s: string): string | null {
  const t = s.trim();
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(t);        // 2026-06-01
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(t);              // 01.06.2026 / 01/06/2026 (DD.MM.YYYY)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function parseAmount(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  const v = parseFloat(t);
  return isNaN(v) ? null : v;
}

// Stulpelių atpažinimas pagal antraštes (Swedbank/SEB/Revolut/bendri)
const DATE_HEADERS   = ['data', 'date', 'started date', 'completed date', 'operacijos data'];
const AMOUNT_HEADERS = ['suma', 'amount', 'sum', 'debetas/kreditas'];
const NOTE_HEADERS   = ['paskirtis', 'description', 'note', 'mokėjimo paskirtis', 'aprašymas', 'gavėjas', 'payee'];

function guessColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.findIndex(h => h === c || h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

export default function Import() {
  const navigate = useNavigate();
  const { cats } = useCategories();

  const [raw, setRaw]           = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [dateCol, setDateCol]   = useState(-1);
  const [amountCol, setAmountCol] = useState(-1);
  const [noteCol, setNoteCol]   = useState(-1);
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [step, setStep]         = useState<'pick' | 'map' | 'preview' | 'done'>('pick');
  const [error, setError]       = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [skippedIncome, setSkippedIncome] = useState(0);

  const defaultCat = cats.find(c => c.code === 'KITOS')?.code ?? cats[0]?.code ?? 'KITOS';

  const handleFile = async (file: File) => {
    setError('');
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { setError('File looks empty or not a CSV'); return; }
    setRaw(parsed);
    const headers = parsed[0];
    setDateCol(guessColumn(headers, DATE_HEADERS));
    setAmountCol(guessColumn(headers, AMOUNT_HEADERS));
    setNoteCol(guessColumn(headers, NOTE_HEADERS));
    setStep('map');
  };

  const buildPreview = () => {
    if (dateCol < 0 || amountCol < 0) { setError('Select date and amount columns'); return; }
    setError('');
    const dataRows = hasHeader ? raw.slice(1) : raw;
    const out: ParsedRow[] = [];
    let income = 0;
    for (const r of dataRows) {
      const date = parseDate(r[dateCol] ?? '');
      const amt = parseAmount(r[amountCol] ?? '');
      if (!date || amt === null || amt === 0) continue;
      if (amt > 0) { income++; continue; } // teigiamos sumos banko išraše = įplaukos, praleidžiam
      out.push({
        date,
        amount: Math.abs(amt),
        note: (noteCol >= 0 ? (r[noteCol] ?? '') : '').trim().slice(0, 120),
        category: defaultCat,
        include: true,
      });
    }
    if (out.length === 0) { setError('No expense rows recognised. Check column mapping.'); return; }
    setSkippedIncome(income);
    setRows(out.slice(0, 500));
    setStep('preview');
  };

  const included = useMemo(() => rows.filter(r => r.include), [rows]);
  const totalAmount = useMemo(() => included.reduce((s, r) => s + r.amount, 0), [included]);

  const handleImport = async () => {
    if (included.length === 0) return;
    setImporting(true); setError('');
    try {
      const { created } = await expensesApi.bulkImport(
        included.map(r => ({ category: r.category, amount: r.amount, note: r.note || undefined, date: r.date })),
      );
      setImported(created);
      setStep('done');
    } catch {
      setError('Import failed — check the rows and try again');
    } finally {
      setImporting(false);
    }
  };

  const headers = raw[0] ?? [];

  return (
    <div style={{ padding: 'var(--pulse-pad, 24px)', paddingBottom: 64, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/transactions" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--x-mid)', textDecoration: 'none', marginBottom: 6 }}>
          ← Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>Import bank CSV</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--x-mid)' }}>
          Swedbank, SEB, Revolut or any CSV with date, amount and description columns
        </p>
      </div>

      {/* Step 1: file */}
      {step === 'pick' && (
        <label className="x-card" style={{ display: 'block', textAlign: 'center', padding: 48, cursor: 'pointer', border: '2px dashed var(--x-hair-2)' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>Choose a CSV file</div>
          <div style={{ fontSize: 12.5, color: 'var(--x-mid)' }}>Only expenses (negative amounts) will be imported</div>
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>
      )}

      {/* Step 2: column mapping */}
      {step === 'map' && (
        <div className="x-card">
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Match the columns</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Date', val: dateCol, set: setDateCol },
              { label: 'Amount', val: amountCol, set: setAmountCol },
              { label: 'Description', val: noteCol, set: setNoteCol },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="x-label">{label}</label>
                <select value={val} onChange={e => set(parseInt(e.target.value))} className="x-input">
                  <option value={-1}>—</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--x-ink-2)', marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
            First row is a header
          </label>

          {/* Sample preview */}
          <div style={{ fontSize: 11.5, color: 'var(--x-mid)', marginBottom: 6 }}>First rows of the file:</div>
          <div style={{ overflowX: 'auto', background: 'var(--x-paper)', borderRadius: 9, padding: 10, marginBottom: 14 }}>
            {raw.slice(0, 4).map((r, i) => (
              <div key={i} className="x-mono" style={{ fontSize: 10.5, whiteSpace: 'nowrap', color: i === 0 && hasHeader ? 'var(--x-ink)' : 'var(--x-mid)', fontWeight: i === 0 && hasHeader ? 600 : 400 }}>
                {r.join(' · ')}
              </div>
            ))}
          </div>

          {error && <div style={{ fontSize: 12.5, color: 'var(--x-neg)', marginBottom: 10 }}>⚠ {error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={buildPreview} className="x-btn x-btn-primary" style={{ flex: 1, height: 40 }}>Preview import</button>
            <button onClick={() => { setStep('pick'); setRaw([]); }} className="x-btn x-btn-secondary" style={{ height: 40 }}>Back</button>
          </div>
        </div>
      )}

      {/* Step 3: preview + categories */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="x-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--x-ink-2)' }}>
              <strong>{included.length}</strong> expenses · <span className="x-mono">{fmt(totalAmount)}</span>
              {skippedIncome > 0 && <span style={{ color: 'var(--x-mid)' }}> · {skippedIncome} income rows skipped</span>}
            </div>
            <button onClick={handleImport} disabled={importing || included.length === 0}
              className="x-btn x-btn-primary" style={{ height: 40, minWidth: 140 }}>
              {importing ? 'Importing…' : `Import ${included.length}`}
            </button>
          </div>

          {error && <div style={{ fontSize: 12.5, color: 'var(--x-neg)' }}>⚠ {error}</div>}

          <div className="x-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              {rows.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                  borderBottom: '1px solid var(--x-hair)', opacity: r.include ? 1 : .4,
                }}>
                  <input type="checkbox" checked={r.include}
                    onChange={e => setRows(prev => prev.map((x, xi) => xi === i ? { ...x, include: e.target.checked } : x))} />
                  <span className="x-mono" style={{ fontSize: 11.5, color: 'var(--x-mid)', flexShrink: 0, width: 76 }}>{r.date}</span>
                  <span style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.note || '—'}
                  </span>
                  <select value={r.category}
                    onChange={e => setRows(prev => prev.map((x, xi) => xi === i ? { ...x, category: e.target.value } : x))}
                    style={{ fontSize: 12, padding: '4px 6px', borderRadius: 7, border: '1px solid var(--x-hair)', background: 'var(--x-bg)', color: 'var(--x-ink-2)', fontFamily: 'inherit', flexShrink: 0 }}>
                    {cats.map(c => <option key={c.code} value={c.code}>{c.emoji} {c.label}</option>)}
                  </select>
                  <span className="x-mono" style={{ fontSize: 12.5, fontWeight: 500, flexShrink: 0, width: 76, textAlign: 'right' }}>−{fmt(r.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: done */}
      {step === 'done' && (
        <div className="x-card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Imported {imported} expenses</div>
          <div style={{ fontSize: 13, color: 'var(--x-mid)', marginBottom: 20 }}>They're now part of your history and stats.</div>
          <button onClick={() => navigate('/transactions')} className="x-btn x-btn-primary">View transactions</button>
        </div>
      )}
    </div>
  );
}
