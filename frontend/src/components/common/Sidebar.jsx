import { useEffect, useState } from 'react';
import { useBrandStore } from '../../store/brandStore';
import { useAuthStore } from '../../store/authStore';
import SessionItem from './SessionItem';

export default function Sidebar({ onNewChat, sessions = [], activeSessionId, onSelectSession, onRefreshSessions }) {
  const { brands, activeBrand, fetchBrands, setActiveBrand, loading } = useBrandStore();
  const { user, logout } = useAuthStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    fetchBrands();
  }, []);

  const userInitials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <aside
      style={{
        width: '260px',
        background: '#1E1E2A',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* New chat button */}
      <div style={{ padding: '12px 12px 8px' }}>
        <button
          onClick={onNewChat}
          style={{
            width: '100%',
            padding: '9px 14px',
            background: 'transparent',
            border: '1px solid rgba(232,184,75,.35)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            fontFamily: 'inherit',
          }}
        >
          + New Chat
        </button>
      </div>

      {/* Scrollable area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        <div style={sectionLabelStyle}>Brands</div>

        {loading && (
          <div style={{ padding: '8px 10px', fontSize: '12px', color: 'rgba(255,255,255,.3)' }}>
            Loading...
          </div>
        )}

        {brands.map((brand) => {
          const isActive = activeBrand?.id === brand.id;
          return (
            <div
              key={brand.id}
              onClick={() => setActiveBrand(brand)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px 8px 8px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                marginBottom: '1px',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                background: isActive ? 'rgba(232,184,75,0.10)' : 'transparent',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: brand.color || '#8e8e93',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.50)',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {brand.name}
              </span>
            </div>
          );
        })}

        {/* Recent chats — one unified list (single + compare live together) */}
        {activeBrand && (
          <>
            <div style={sectionLabelStyle}>Chats — {activeBrand.name}</div>
            {sessions.length === 0 && (
              <div style={{ padding: '6px 16px 2px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                No chats yet
              </div>
            )}
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={activeSessionId === session.id}
                onSelect={onSelectSession}
                onRefresh={onRefreshSessions}
                onDeleted={() => onRefreshSessions()}
              />
            ))}
          </>
        )}
      </div>

      {/* User footer */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '10px 12px',
          background: '#1A1A26',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              color: '#1E1E2A',
            }}
          >
            {userInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize' }}>
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="Log out"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px 8px',
              borderRadius: '6px',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#ff6b6b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          >
            ⏻
          </button>
        </div>
      </div>

      {showLogoutConfirm && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowLogoutConfirm(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 'var(--radius-lg)',
            padding: '24px', width: '320px', boxShadow: 'var(--shadow-md)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--label1)' }}>
              Log out?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--label3)', lineHeight: 1.5 }}>
              Are you sure you want to log out of WTX Voice?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--sep)', background: '#fff',
                  color: 'var(--label2)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={logout}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'var(--red, #dc2626)',
                  color: '#fff', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

const sectionLabelStyle = {
  padding: '14px 16px 4px',
  fontSize: '10px',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.30)',
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
};