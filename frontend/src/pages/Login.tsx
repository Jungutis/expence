import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

interface FieldErrors { email?: string; password?: string; confirmPassword?: string; }

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode,            setMode]            = useState<'login' | 'register'>('login');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors,     setFieldErrors]     = useState<FieldErrors>({});
  const [globalError,     setGlobalError]     = useState('');
  const [loading,         setLoading]         = useState(false);
  const [showPassword,    setShowPassword]    = useState(false);

  const clearErrors = () => { setFieldErrors({}); setGlobalError(''); };

  const validate = (): boolean => {
    const e: FieldErrors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (mode === 'register' && password.length < 6) e.password = 'Min. 6 characters';
    if (mode === 'register') {
      if (!confirmPassword) e.confirmPassword = 'Repeat your password';
      else if (password !== confirmPassword) e.confirmPassword = "Passwords don't match";
    }
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    clearErrors();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error as string | undefined;
        if (msg?.toLowerCase().includes('password') || msg?.toLowerCase().includes('slaptažodis'))
          setFieldErrors({ password: msg });
        else if (msg?.toLowerCase().includes('email') || msg?.toLowerCase().includes('pašt') || msg?.toLowerCase().includes('egzistuoja'))
          setFieldErrors({ email: msg });
        else setGlobalError(msg || 'Something went wrong. Try again.');
      } else {
        setGlobalError('Cannot connect to server.');
      }
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--x-paper)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }} className="anim-up">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--x-ink)', color: 'var(--x-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, margin: '0 auto 14px', letterSpacing: -1 }}>e</div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: -0.3, color: 'var(--x-ink)' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: 13.5, color: 'var(--x-mid)' }}>
            {mode === 'login' ? 'Sign in to Expences' : 'Start tracking your spending'}
          </p>
        </div>

        <div className="x-card" style={{ boxShadow: 'var(--x-shadow-md)' }}>
          {/* Toggle */}
          <div style={{ display: 'flex', background: 'var(--x-paper)', borderRadius: 9, padding: 3, marginBottom: 20, gap: 3 }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); clearErrors(); }}
                style={{ flex: 1, padding: '8px', border: 0, borderRadius: 7, cursor: 'pointer', fontSize: 13.5, fontWeight: mode === m ? 600 : 500, fontFamily: 'inherit', background: mode === m ? 'var(--x-bg)' : 'transparent', color: mode === m ? 'var(--x-ink)' : 'var(--x-mid)', boxShadow: mode === m ? 'var(--x-shadow)' : 'none', transition: 'all .15s' }}>
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label className="x-label">Email</label>
              <input type="email" value={email} placeholder="you@example.com" autoComplete="email"
                onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); }}
                className={`x-input${fieldErrors.email ? ' error' : ''}`} />
              {fieldErrors.email && <div style={{ fontSize: 12, color: 'var(--x-neg)', marginTop: 5 }}>⚠ {fieldErrors.email}</div>}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 14 }}>
              <label className="x-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={password}
                  placeholder={mode === 'register' ? 'Min. 6 characters' : '••••••••'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); }}
                  className={`x-input${fieldErrors.password ? ' error' : ''}`} style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--x-mid)', display: 'flex', padding: 2 }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                    {showPassword ? <><path d="M17.94 17.94A10 10 0 0 1 12 19c-4.48 0-8.27-2.94-9.54-7a10 10 0 0 1 2.34-4.34M3 3l18 18"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
              {fieldErrors.password && <div style={{ fontSize: 12, color: 'var(--x-neg)', marginTop: 5 }}>⚠ {fieldErrors.password}</div>}
            </div>

            {/* Confirm password */}
            {mode === 'register' && (
              <div style={{ marginBottom: 14 }} className="anim-fade">
                <label className="x-label">Confirm password</label>
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword}
                  placeholder="••••••••" autoComplete="new-password"
                  onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: undefined })); }}
                  className={`x-input${fieldErrors.confirmPassword ? ' error' : ''}`} />
                {fieldErrors.confirmPassword && <div style={{ fontSize: 12, color: 'var(--x-neg)', marginTop: 5 }}>⚠ {fieldErrors.confirmPassword}</div>}
              </div>
            )}

            {globalError && (
              <div style={{ background: 'rgba(193,75,58,.07)', border: '1px solid rgba(193,75,58,.18)', borderRadius: 9, padding: '10px 14px', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--x-neg)' }}>⚠ {globalError}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="x-btn x-btn-primary" style={{ width: '100%', height: 42, fontSize: 14, marginTop: 6 }}>
              {loading
                ? `${mode === 'login' ? 'Signing in' : 'Creating account'}…`
                : mode === 'login' ? 'Sign in →' : 'Create account →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--x-mid)', marginTop: 18 }}>
          Your data is encrypted and stored securely.
        </p>
      </div>
    </div>
  );
}
