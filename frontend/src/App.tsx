import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthState } from './hooks/useAuth';
import Home from './pages/Home';
import Login from './pages/Login';
import CreateRecord from './pages/CreateRecord';
import Profile from './pages/Profile';
import QuickAdd from './pages/QuickAdd';
import Transactions from './pages/Transactions';
import Sidebar from './components/Sidebar';

/** One-time banner on iOS Safari: prompt user to install as PWA */
function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = ('standalone' in navigator) &&
      (navigator as Navigator & { standalone: boolean }).standalone;
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (isIOS && !isStandalone && !dismissed) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--x-bg)', borderTop: '1px solid var(--x-hair)',
      padding: '14px 18px 22px', boxShadow: '0 -4px 24px rgba(0,0,0,.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: 'var(--x-ink)',
          color: 'var(--x-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 22, flexShrink: 0, letterSpacing: -1,
        }}>e</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--x-ink)', marginBottom: 3 }}>
            Add Expences to Home Screen
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--x-mid)', lineHeight: 1.5 }}>
            Tap <strong style={{ color: 'var(--x-ink)' }}>Share</strong> <span style={{ fontSize: 14 }}>⎙</span> then{' '}
            <strong style={{ color: 'var(--x-ink)' }}>"Add to Home Screen"</strong> — then set up the Apple Pay shortcut.
          </div>
        </div>
        <button
          onClick={() => { localStorage.setItem('pwa-banner-dismissed', '1'); setVisible(false); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--x-mid)', padding: 4, flexShrink: 0 }}
          aria-label="Dismiss"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function App() {
  const auth = useAuthState();
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const main = shell?.querySelector('.pulse-main') as HTMLElement | null;
    if (!shell || !main) return;

    let lastY = 0;
    const onScroll = () => {
      const y = main.scrollTop;
      if (y > lastY + 6) shell.classList.add('nav-hidden');
      else if (y < lastY - 6) shell.classList.remove('nav-hidden');
      lastY = y;
    };

    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, [auth.user]);

  if (auth.loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--x-bg)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2.5px solid var(--x-hair)',
          borderTopColor: 'var(--x-accent)',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        {auth.user ? (
          /* x-root is the container-query anchor; pulse-shell handles sidebar ↔ bottom-nav */
          <div className="x-root" style={{ height: '100vh' }}>
            <div className="pulse-shell" ref={shellRef}>
              <Sidebar />
              <main className="pulse-main">
                <Routes>
                  <Route path="/"          element={<Home />} />
                  <Route path="/create"    element={<CreateRecord />} />
                  <Route path="/profile"   element={<Profile />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/quick-add" element={<QuickAdd />} />
                  <Route path="/login"     element={<Navigate to="/" replace />} />
                  <Route path="*"          element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
            <IOSInstallBanner />
          </div>
        ) : (
          <div style={{ minHeight: '100vh', background: 'var(--x-paper)' }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/"      element={<Login />} />
              <Route path="*"      element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        )}
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
