import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const clearErrors = () => {
    setFieldErrors({});
    setGlobalError('');
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!email.trim()) {
      errors.email = 'El. paštas yra privalomas';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Įveskite teisingą el. pašto adresą';
    }

    if (!password) {
      errors.password = 'Slaptažodis yra privalomas';
    } else if (mode === 'register' && password.length < 6) {
      errors.password = 'Slaptažodis turi būti bent 6 simbolių';
    }

    if (mode === 'register') {
      if (!confirmPassword) {
        errors.confirmPassword = 'Pakartokite slaptažodį';
      } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Slaptažodžiai nesutampa';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error;
        // Jei klaida susijusi su konkrečiu lauku - rodyk prie lauko
        if (msg?.toLowerCase().includes('slaptažodis') || msg?.toLowerCase().includes('password')) {
          setFieldErrors({ password: msg });
        } else if (msg?.toLowerCase().includes('el. pašt') || msg?.toLowerCase().includes('email') || msg?.toLowerCase().includes('egzistuoja')) {
          setFieldErrors({ email: msg });
        } else {
          setGlobalError(msg || 'Klaida. Bandykite dar kartą.');
        }
      } else {
        setGlobalError('Nepavyko prisijungti prie serverio. Patikrinkite interneto ryšį.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl shadow-warm-lg mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
            {mode === 'login' ? 'Sveiki sugrįžę!' : 'Pradėkite dabar'}
          </h1>
          <p className="text-stone-500 mt-1.5 text-sm sm:text-base">
            {mode === 'login'
              ? 'Prisijunkite prie savo išlaidų sekimo'
              : 'Sukurkite nemokamą paskyrą'}
          </p>
        </div>

        {/* Card */}
        <div className="card shadow-warm-lg">
          {/* Mode Toggle */}
          <div className="flex bg-stone-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode('login'); clearErrors(); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              🔑 Prisijungti
            </button>
            <button
              onClick={() => { setMode('register'); clearErrors(); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              ✨ Registruotis
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                El. paštas
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="jusu@epastas.lt"
                className={`input-field ${fieldErrors.email ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
                autoComplete="email"
              />
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1 animate-fade-in">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                Slaptažodis
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder={mode === 'register' ? 'Min. 6 simboliai' : '••••••••'}
                  className={`input-field pr-11 ${fieldErrors.password ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1 animate-fade-in">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Confirm Password (Register only) */}
            {mode === 'register' && (
              <div className="animate-fade-in">
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                  Pakartokite slaptažodį
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                  placeholder="••••••••"
                  className={`input-field ${fieldErrors.confirmPassword ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
                  autoComplete="new-password"
                />
                {fieldErrors.confirmPassword && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1 animate-fade-in">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {/* Global error (serverio klaidos) */}
            {globalError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 animate-fade-in">
                <span className="text-red-500 mt-0.5 flex-shrink-0">⚠️</span>
                <p className="text-sm text-red-700 font-medium">{globalError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Kraunama...
                </span>
              ) : mode === 'login' ? (
                'Prisijungti →'
              ) : (
                'Sukurti paskyrą →'
              )}
            </button>
          </form>

          {/* Features hint */}
          {mode === 'register' && (
            <div className="mt-5 pt-5 border-t border-stone-100 animate-fade-in">
              <p className="text-xs text-stone-500 text-center mb-3">Ką gausite:</p>
              <div className="grid grid-cols-2 gap-2">
                {['🍽️ Maisto išlaidos', '⛽ Kuro išlaidos', '👗 Rūbų išlaidos', '📊 Mėnesio ataskaita'].map((f) => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-stone-600">
                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-stone-400 mt-4">
          Jūsų duomenys yra saugūs ir šifruoti
        </p>
      </div>
    </div>
  );
}
