import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-orange-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-warm group-hover:shadow-warm-lg transition-shadow">
              <span className="text-lg">💰</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-stone-900 font-bold text-lg leading-none">Išlaidos</span>
              <p className="text-orange-500 text-xs font-medium leading-none">Sekimo sistema</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/"
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/'
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  🏠 Pradžia
                </Link>
                <Link
                  to="/create"
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/create'
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  ➕ Pridėti
                </Link>
                <Link
                  to="/profile"
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/profile'
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  👤 Profilis
                </Link>
                <div className="h-6 w-px bg-stone-200 mx-1" />
                <div className="flex items-center gap-3">
                  <div className="text-right hidden lg:block">
                    <p className="text-xs text-stone-500">Prisijungęs</p>
                    <p className="text-sm font-semibold text-stone-800 max-w-[160px] truncate">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-stone-100 hover:bg-red-50 hover:text-red-600 text-stone-600 px-4 py-2 rounded-xl text-sm font-medium transition-all border border-transparent hover:border-red-200"
                  >
                    Atsijungti
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="btn-primary text-sm"
              >
                Prisijungti
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-xl text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label="Meniu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-orange-100 py-3 space-y-1 animate-fade-in">
            {user ? (
              <>
                <div className="px-3 py-2 mb-2">
                  <p className="text-xs text-stone-500">Prisijungęs kaip</p>
                  <p className="text-sm font-semibold text-stone-800 truncate">{user.email}</p>
                </div>
                <Link
                  to="/"
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/'
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  🏠 Pradžia
                </Link>
                <Link
                  to="/create"
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/create'
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  ➕ Pridėti išlaidą
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/profile'
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  👤 Profilis
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
                >
                  🚪 Atsijungti
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-orange-600 hover:bg-orange-50 transition-all"
              >
                🔑 Prisijungti
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
