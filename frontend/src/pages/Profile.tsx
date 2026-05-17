import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { profileApi } from '../services/api';
import type { UserProfile } from '../types';
import axios from 'axios';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Formos state
  const [salary, setSalary] = useState('');
  const [foodDailyLimit, setFoodDailyLimit] = useState('');
  const [foodMonthlyLimit, setFoodMonthlyLimit] = useState('');

  const today = new Date().getDate();
  const isFirstWeek = today <= 7;
  const currentMonth = new Date().toLocaleDateString('lt-LT', { month: 'long' });

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    profileApi.getProfile()
      .then((p) => {
        setProfile(p);
        setSalary(p.salary != null ? String(p.salary) : '');
        setFoodDailyLimit(String(p.foodDailyLimit));
        setFoodMonthlyLimit(String(p.foodMonthlyLimit));
      })
      .catch(() => setError('Nepavyko užkrauti profilio'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: Parameters<typeof profileApi.updateProfile>[0] = {};

      const parsedSalary = salary.trim() === '' ? null : parseFloat(salary);
      if (parsedSalary !== null && isNaN(parsedSalary)) {
        setError('Neteisingas atlyginimo formatas'); setSaving(false); return;
      }
      payload.salary = parsedSalary;

      if (isFirstWeek) {
        const dl = parseFloat(foodDailyLimit);
        const ml = parseFloat(foodMonthlyLimit);
        if (isNaN(dl) || dl <= 0) { setError('Neteisingas dienos limitas'); setSaving(false); return; }
        if (isNaN(ml) || ml <= 0) { setError('Neteisingas mėnesio limitas'); setSaving(false); return; }
        payload.foodDailyLimit = dl;
        payload.foodMonthlyLimit = ml;
      }

      const updated = await profileApi.updateProfile(payload);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Klaida išsaugant');
      } else {
        setError('Netikėta klaida');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-xl mx-auto animate-slide-up">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-stone-500 hover:text-stone-700 text-sm font-medium mb-4 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Grįžti
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">Mano profilis</h1>
          <p className="text-stone-500 text-sm mt-1">Atlyginimas ir maisto biudžeto nustatymai</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">

          {/* Account info */}
          <div className="card">
            <h2 className="text-base font-bold text-stone-800 mb-3 flex items-center gap-2">
              <span className="text-xl">👤</span> Paskyra
            </h2>
            <div className="flex items-center gap-3 bg-stone-50 rounded-xl p-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user?.email[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-stone-900 text-sm">{user?.email}</p>
                <p className="text-xs text-stone-400">
                  Narys nuo {profile ? new Date(profile.createdAt).toLocaleDateString('lt-LT') : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Salary */}
          <div className="card">
            <h2 className="text-base font-bold text-stone-800 mb-1 flex items-center gap-2">
              <span className="text-xl">💶</span> Mėnesinis atlyginimas
            </h2>
            <p className="text-xs text-stone-400 mb-4">Galima keisti bet kada. Naudojama išlaidų % skaičiavimui.</p>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold pointer-events-none">€</div>
              <input
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="pvz. 1500"
                min="0"
                step="0.01"
                className="input-field pl-9"
              />
            </div>
            {salary && parseFloat(salary) > 0 && (
              <p className="text-xs text-green-600 mt-2 font-medium animate-fade-in">
                ✓ Dashboard rodys išlaidų % nuo {parseFloat(salary).toFixed(0)} € atlyginimo
              </p>
            )}
          </div>

          {/* Food limits */}
          <div className={`card border-2 ${isFirstWeek ? 'border-orange-200' : 'border-stone-100'}`}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
                <span className="text-xl">🍽️</span> Maisto biudžeto limitai
              </h2>
              {isFirstWeek ? (
                <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
                  ✓ Galima keisti
                </span>
              ) : (
                <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full flex-shrink-0">
                  🔒 Užrakinta
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mb-4">
              {isFirstWeek
                ? `Pirmoji mėnesio savaitė — limitai keičiami iki 7 d.`
                : `Limitai keičiami tik 1–7 mėnesio dieną. Dabar ${today} d. — laukite kito mėnesio.`}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  Dienos limitas (€)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">€</div>
                  <input
                    type="number"
                    value={foodDailyLimit}
                    onChange={(e) => setFoodDailyLimit(e.target.value)}
                    disabled={!isFirstWeek}
                    min="1"
                    max="500"
                    step="0.5"
                    className={`input-field pl-8 text-sm ${!isFirstWeek ? 'opacity-50 cursor-not-allowed bg-stone-50' : ''}`}
                  />
                </div>
                <p className="text-xs text-stone-400 mt-1">Numatyta: 12 €</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  Mėnesio limitas (€)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">€</div>
                  <input
                    type="number"
                    value={foodMonthlyLimit}
                    onChange={(e) => setFoodMonthlyLimit(e.target.value)}
                    disabled={!isFirstWeek}
                    min="1"
                    max="10000"
                    step="1"
                    className={`input-field pl-8 text-sm ${!isFirstWeek ? 'opacity-50 cursor-not-allowed bg-stone-50' : ''}`}
                  />
                </div>
                <p className="text-xs text-stone-400 mt-1">Numatyta: 350 €</p>
              </div>
            </div>

            {/* Rolling budget explanation */}
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">📊 Kaip veikia savaitinis biudžetas?</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Kiekvienos savaitės biudžetas = likusi mėnesio suma ÷ likusios savaitės.
                Jei šią savaitę išleidote per daug — kitos savaitės biudžetas automatiškai sumažėja.
                Jei taupėte — kita savaitė turės didesnį biudžetą.
              </p>
            </div>

            {/* Warning thresholds info */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                Įspėjimas kai &gt;85% savaitės / mėnesio biudžeto panaudota
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                Blokavimas kai mėnesinis maisto limitas viršytas
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 animate-fade-in">
              <span className="flex-shrink-0">⚠️</span>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Success */}
          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
              <span>✅</span>
              <p className="text-sm text-green-700 font-semibold">Profilis išsaugotas sėkmingai!</p>
            </div>
          )}

          {/* Save button */}
          <button type="submit" disabled={saving} className="btn-primary w-full text-base">
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Išsaugoma...
              </span>
            ) : '💾 Išsaugoti pakeitimus'}
          </button>
        </form>

        {/* Current month stats preview */}
        {profile && (
          <div className="mt-5 card bg-stone-50 border border-stone-100">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
              Dabartiniai nustatymai — {currentMonth}
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-stone-900">
                  {profile.salary != null ? `${profile.salary.toFixed(0)} €` : '—'}
                </p>
                <p className="text-xs text-stone-500">Atlyginimas</p>
              </div>
              <div>
                <p className="text-lg font-bold text-orange-600">{profile.foodDailyLimit} €</p>
                <p className="text-xs text-stone-500">Dienos limitas</p>
              </div>
              <div>
                <p className="text-lg font-bold text-orange-600">{profile.foodMonthlyLimit} €</p>
                <p className="text-xs text-stone-500">Mėnesio limitas</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
