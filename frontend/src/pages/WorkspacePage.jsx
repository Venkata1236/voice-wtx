import { useState, useEffect } from 'react';
import api from '../services/api';
import Topbar from '../components/common/Topbar';
import Sidebar from '../components/common/Sidebar';
import SingleTab from '../tabs/SingleTab';
import CompareTab from '../tabs/CompareTab';
import ForgeTab from '../tabs/ForgeTab';
import InsightsTab from '../tabs/InsightsTab';
import KBPanel from '../components/kb/KBPanel';
import SettingsPage from './SettingsPage';
import { useBrandStore } from '../store/brandStore';

export default function WorkspacePage() {
  const [activeView, setActiveView] = useState('single');
  const [kbOpen, setKbOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [forgeEnabled, setForgeEnabled] = useState(false);

  // Per-tab session memory — each mode remembers its own session
  const [sessionIds, setSessionIds] = useState(() => {
    try {
      const saved = localStorage.getItem('voice_session_ids');
      return saved ? JSON.parse(saved) : { single: null, compare: null, forge: null };
    } catch {
      return { single: null, compare: null, forge: null };
    }
  });
  const activeSessionId = sessionIds[activeView] ?? null;
  const setActiveSessionId = (id) => {
    setSessionIds((prev) => {
      const updated = { ...prev, [activeView]: id };
      localStorage.setItem('voice_session_ids', JSON.stringify(updated));
      return updated;
    });
  };

  const activeBrand = useBrandStore((state) => state.activeBrand);
  const kb = useBrandStore((state) => state.kb);

  useEffect(() => {
  if (activeBrand) {
    api.get(`/api/copy/sessions/${activeBrand.id}`).then((res) => {
      setSessions(res.data);
    }).catch(() => {});
  } else {
    setSessions([]);
  }
}, [activeBrand, sessionIds]);

  useEffect(() => {
    api.get('/api/settings/feature-flags').then((res) => {
      const forge = res.data.find((f) => f.flag_name === 'forge_mode');
      setForgeEnabled(forge?.is_enabled || false);
    });
  }, []);

  const handleNewChat = () => {
    setActiveSessionId(null);
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const handleSelectSession = (session) => {
    setActiveSessionId(session.id);
  };

  const renderTab = () => {
    if (!activeBrand) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--label3)' }}>
          Select a brand to get started
        </div>
      );
    }

    switch (activeView) {
      case 'single':
        return (
          <SingleTab
            brand={activeBrand}
            activeSessionId={activeSessionId}
            onSessionCreated={(id) => setActiveSessionId(id)}
          />
        );
      case 'compare':
        return (
          <CompareTab
            brand={activeBrand}
            activeSessionId={activeSessionId}
            onSessionCreated={(id) => setActiveSessionId(id)}
          />
        );
      case 'forge':
        return (
          <ForgeTab
            brand={activeBrand}
            activeSessionId={activeSessionId}
            onSessionCreated={(id) => setActiveSessionId(id)}
          />
        );
      case 'insights':
        return <InsightsTab brand={activeBrand} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Topbar
        activeView={activeView}
        setActiveView={handleViewChange}
        onOpenKB={() => setKbOpen(!kbOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
        forgeEnabled={forgeEnabled}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          onNewChat={handleNewChat}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onRefreshSessions={() => {
            if (activeBrand) {
              api.get(`/api/copy/sessions/${activeBrand.id}`).then((res) => {
                setSessions(res.data);
              });
            }
          }}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
            {renderTab()}
          </div>

          {kbOpen && activeBrand && (
            <KBPanel brand={activeBrand} kb={kb} onClose={() => setKbOpen(false)} />
          )}
        </div>
      </div>

      {settingsOpen && <SettingsPage onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}