import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import TeamMembers from '../components/settings/TeamMembers';
import BrandManagement from '../components/settings/BrandManagement';
import KBApprovalQueue from '../components/settings/KBApprovalQueue';
import FeatureFlags from '../components/settings/FeatureFlags';

const TABS = [
  { key: 'team', label: 'Team members' },
  { key: 'brands', label: 'Brands' },
  { key: 'kb_queue', label: 'KB approval' },
  { key: 'flags', label: 'Feature flags' },
];

export default function SettingsPage({ onClose }) {
  const user = useAuthStore((state) => state.user);

  const isAdmin = user?.role === 'admin';
  const isCopyLead = user?.role === 'copy_lead';

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'kb_queue') return isAdmin || isCopyLead;
    return isAdmin;
  });

  // Default to the first tab the user can actually see (not always 'team')
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.key || null);

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Settings</h2>
          <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--label3)', fontSize: '18px' }}>×</span>
        </div>

        <div style={{ display: 'flex', gap: '16px', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '140px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {visibleTabs.map((tab) => (
              <div
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  background: activeTab === tab.key ? 'var(--surface)' : 'transparent',
                  fontWeight: activeTab === tab.key ? 600 : 400,
                }}
              >
                {tab.label}
              </div>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {visibleTabs.length === 0 ? (
              <div style={{ padding: '8px 4px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Your account</div>
                <div style={{ fontSize: '13px', color: 'var(--label2)', marginBottom: '2px' }}>{user?.full_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--label3)', marginBottom: '2px' }}>{user?.email}</div>
                <div style={{ fontSize: '12px', color: 'var(--label3)', textTransform: 'capitalize', marginBottom: '20px' }}>
                  Role: {user?.role?.replace('_', ' ')}
                </div>
                <div style={{
                  padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)', border: '1px solid var(--sep)',
                  fontSize: '12.5px', color: 'var(--label3)', lineHeight: 1.5,
                }}>
                  Admin settings aren't available for your role. Ask an admin to grant you
                  brand access or additional permissions.
                </div>
              </div>
            ) : (
              <>
                {activeTab === 'team' && <TeamMembers />}
                {activeTab === 'brands' && <BrandManagement />}
                {activeTab === 'kb_queue' && <KBApprovalQueue />}
                {activeTab === 'flags' && <FeatureFlags />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle = {
  background: '#fff',
  borderRadius: 'var(--radius-lg)',
  padding: '20px',
  width: '700px',
  height: '500px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--shadow-md)',
};