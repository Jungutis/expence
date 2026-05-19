import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Icon({ d, size = 16 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

const NAV = [
  {
    to: '/',
    label: 'Overview',
    icon: <Icon d={<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />} />,
    exact: true,
  },
  {
    to: '/create',
    label: 'Add',
    icon: <Icon d={<><path d="M12 5v14M5 12h14"/></>} />,
    exact: false,
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: <Icon d={<><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>} />,
    exact: false,
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <aside className="pulse-side">
      {/* Brand mark — hidden on mobile bottom nav via CSS */}
      <div className="pulse-brand">
        <div className="pulse-brand-mark">e</div>
        <div className="pulse-brand-text">Expences</div>
      </div>

      {/* Navigation */}
      <nav className="pulse-nav">
        {NAV.map(({ to, label, icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) => `pulse-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="pulse-nav-icon">{icon}</span>
            <span className="pulse-nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="pulse-spacer" style={{ flex: 1 }} />

      {/* User + logout — hidden on tablet/mobile via CSS */}
      <div className="pulse-side-footer">
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
          <div style={{
            fontSize: 12.5, fontWeight: 500, color: 'var(--x-ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
          }}>
            {user?.email}
          </div>
        </div>

        <button onClick={handleLogout} className="pulse-nav-item" style={{ color: 'var(--x-neg)' }}>
          <span className="pulse-nav-icon">
            <Icon d={<>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </>} />
          </span>
          <span className="pulse-nav-label">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
