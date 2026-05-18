import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { profileApi } from '../services/api';
import type { UserProfile } from '../types';
import axios from 'axios';

export default function Profile() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  const [salary,          setSalary]          = useState('');
  const [foodDailyLimit,  setFoodDailyLimit]  = useState('');
  const [foodMonthlyLimit,setFoodMonthlyLimit]= useState('');

  const today      = new Date().getDate();
  const isFirstWeek = today <= 7;

  useEffect(() => {
    profileApi.getProfile()
      .then(p => {
        setProfile(p);
        setSalary(p.salary != null ? String(p.salary) : '');
        setFoodDailyLimit(String(p.foodDailyLimit));
        setFoodMonthlyLimit(String(p.foodMonthlyLimit));
      })
      .catch(() => setError('Could not load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: Parameters<typeof profileApi.updateProfile>[0] = {};
      const parsedSalary = salary.trim() === '' ? null : parseFloat(salary);
      if (parsedSalary !== null && isNaN(parsedSalary)) {
        setError('Invalid salary format'); setSaving(false); return;
      }
      payload.salary = parsedSalary;

      if (isFirstWeek) {
        const dl = parseFloat(foodDailyLimit);
        const ml = parseFloat(foodMonthlyLimit);
        if (isNaN(dl) || dl <= 0) { setError('Invalid daily limit'); setSaving(false); return; }
        if (isNaN(ml) || ml <= 0) { setError('Invalid monthly limit'); setSaving(false); return; }
        payload.foodDailyLimit  = dl;
        payload.foodMonthlyLimit = ml;
      }

      const updated = await profileApi.updateProfile(payload);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Save failed');
      else setError('Unexpected error');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid var(--x-hair)', borderTopColor: 'var(--x-accent)', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 28px 48px', maxWidth: 560, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>Profile</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--x-mid)' }}>Manage your account and budget settings</p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Account */}
        <div className="x-card">
          <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 14 }}>
            Account
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--x-paper)', borderRadius: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--x-ink)', color: 'var(--x-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 600, flexShrink: 0,
            }}>
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--x-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
              {profile && (
                <div style={{ fontSize: 12, color: 'var(--x-mid)', marginTop: 1 }}>
                  Member since {new Date(profile.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Salary */}
        <div className="x-card">
          <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 4 }}>
            Monthly salary
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--x-mid)', marginBottom: 14 }}>
            Used to calculate expense % of income. Can be updated any time.
          </div>
          <div style={{ position: 'relative' }}>
            <span className="x-mono" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--x-mid)', pointerEvents: 'none' }}>€</span>
            <input type="number" value={salary} min="0" step="0.01" placeholder="e.g. 1500"
              onChange={e => setSalary(e.target.value)}
              className="x-input x-mono" style={{ paddingLeft: 34, fontSize: 18, fontWeight: 500, height: 48 }} />
          </div>
          {salary && parseFloat(salary) > 0 && (
            <div style={{ fontSize: 12, color: 'var(--x-pos)', marginTop: 8, fontWeight: 500 }} className="anim-fade">
              ✓ Dashboard will show spending as % of {parseFloat(salary).toFixed(0)} € salary
            </div>
          )}
        </div>

        {/* Food budget */}
        <div className="x-card" style={{ borderColor: isFirstWeek ? 'rgba(42,111,219,.25)' : 'var(--x-hair)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500 }}>
              Food budget limits
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
              background: isFirstWeek ? 'rgba(31,138,91,.1)' : 'var(--x-paper)',
              color: isFirstWeek ? 'var(--x-pos)' : 'var(--x-mid)',
              border: `1px solid ${isFirstWeek ? 'rgba(31,138,91,.2)' : 'var(--x-hair)'}`,
            }}>
              {isFirstWeek ? '✓ Editable' : `🔒 Locked · day ${today}`}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--x-mid)', marginBottom: 16 }}>
            {isFirstWeek
              ? 'First week of the month — limits can be changed until day 7.'
              : 'Limits can only be changed on days 1–7 of the month.'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="x-label">Daily limit (€)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--x-mid)', pointerEvents: 'none' }}>€</span>
                <input type="number" value={foodDailyLimit} disabled={!isFirstWeek}
                  min="1" max="500" step="0.5"
                  onChange={e => setFoodDailyLimit(e.target.value)}
                  className="x-input" style={{ paddingLeft: 28, opacity: isFirstWeek ? 1 : .45, cursor: isFirstWeek ? 'text' : 'not-allowed' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--x-mid-2)', marginTop: 4 }}>Default: 12 €</div>
            </div>
            <div>
              <label className="x-label">Monthly limit (€)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--x-mid)', pointerEvents: 'none' }}>€</span>
                <input type="number" value={foodMonthlyLimit} disabled={!isFirstWeek}
                  min="1" max="10000" step="1"
                  onChange={e => setFoodMonthlyLimit(e.target.value)}
                  className="x-input" style={{ paddingLeft: 28, opacity: isFirstWeek ? 1 : .45, cursor: isFirstWeek ? 'text' : 'not-allowed' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--x-mid-2)', marginTop: 4 }}>Default: 350 €</div>
            </div>
          </div>

          {/* Rolling budget explainer */}
          <div style={{ marginTop: 16, background: 'var(--x-accent-soft)', border: '1px solid rgba(42,111,219,.15)', borderRadius: 9, padding: '11px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--x-accent)', marginBottom: 4 }}>📊 How weekly budget works</div>
            <div style={{ fontSize: 12, color: 'var(--x-ink-2)', lineHeight: 1.55 }}>
              Each week's budget = remaining monthly amount ÷ remaining weeks.
              Overspend this week → next week's budget shrinks. Save → next week gets more.
            </div>
          </div>

          {/* Thresholds */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--x-mid)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e8a020', flexShrink: 0, display: 'inline-block' }} />
              Warning when &gt;85% of weekly / monthly budget used
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--x-mid)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--x-neg)', flexShrink: 0, display: 'inline-block' }} />
              Food expense blocked when monthly limit exceeded
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(193,75,58,.07)', border: '1px solid rgba(193,75,58,.2)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: 'var(--x-neg)' }}>
            ⚠ {error}
          </div>
        )}

        {/* Success */}
        {saved && (
          <div style={{ background: 'rgba(31,138,91,.07)', border: '1px solid rgba(31,138,91,.2)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: 'var(--x-pos)', fontWeight: 500 }} className="anim-fade">
            ✓ Profile saved successfully
          </div>
        )}

        <button type="submit" disabled={saving} className="x-btn x-btn-primary" style={{ height: 44, fontSize: 14.5 }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Current settings summary */}
      {profile && (
        <div className="x-card" style={{ marginTop: 14, background: 'var(--x-paper)' }}>
          <div style={{ fontSize: 11, color: 'var(--x-mid)', textTransform: 'uppercase', letterSpacing: .6, fontWeight: 500, marginBottom: 14 }}>
            Current settings
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
            {[
              { label: 'Salary', value: profile.salary != null ? `${profile.salary.toFixed(0)} €` : '—' },
              { label: 'Daily limit', value: `${profile.foodDailyLimit} €` },
              { label: 'Monthly limit', value: `${profile.foodMonthlyLimit} €` },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '4px 8px', borderRight: i < 2 ? '1px solid var(--x-hair)' : 'none' }}>
                <div className="x-mono" style={{ fontSize: 17, fontWeight: 600, color: 'var(--x-ink)', letterSpacing: -0.5 }}>{item.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--x-mid)', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
