import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `x-nav-item${isActive ? ' active' : ''}`}
    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
  >
    <span style={{ display: 'inline-flex', opacity: 0.7 }}>{icon}</span>
    {label}
  </NavLink>
);

const Icon = ({ path, size = 16 }: { path: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      padding: '20px 14px',
      display: 'flex', flexDirection: 'column', gap: 2,
      borderRight: '1px solid var(--x-hair)',
      background: 'var(--x-bg)',
      height: '100vh',
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 8px 20px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'var(--x-ink)', color: 'var(--x-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, letterSpacing: -0.5,
          flexShrink: 0,
        }}>e</div>
        <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: -0.2 }}>Expences</div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <NavItem to="/" icon={
          <Icon path={<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />} />
        } label="Overview" />
        <NavItem to="/create" icon={
          <Icon path={<><path d="M12 5v14M5 12h14"/></>} />
        } label="Add expense" />
        <NavItem to="/profile" icon={
          <Icon path={<>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </>} />
        } label="Profile" />
      </nav>

      <div style={{ flex: 1 }} />

      {/* User + logout */}
      <div style={{ borderTop: '1px solid var(--x-hair)', paddingTop: 14, marginTop: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '8px 10px', borderRadius: 9, marginBottom: 4,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--x-paper-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: 'var(--x-ink-2)', flexShrink: 0,
          }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 500, color: 'var(--x-ink)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="x-nav-item" style={{
          color: 'var(--x-neg)', width: '100%',
        }}>
          <Icon path={<>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </>} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
