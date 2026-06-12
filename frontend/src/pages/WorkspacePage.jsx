import { useState, useEffect } from 'react';
import Topbar from '../components/common/Topbar';
import Sidebar from '../components/common/Sidebar';
import SingleTab from '../tabs/SingleTab';
import CompareTab from '../tabs/CompareTab';
import ForgeTab from '../tabs/ForgeTab';
import InsightsTab from '../tabs/InsightsTab';
import KBPanel from '../components/kb/KBPanel';
import SettingsPage from './SettingsPage';
import { useBrandStore } from '../store/brandStore';
import api from '../services/api';

export default function WorkspacePage() {
  const [activeView, setActiveView] = useState('single');
  const [kbOpen, setKbOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const activeBrand = useBrandStore((state) => state.activeBrand);
  const kb = useBrandStore((state) => state.kb);

  // VOICE spec — Forge tab only visible if enabled in feature flags
  // For now hardcode true until feature_flags route is wired
  const [forgeEnabled, setForgeEnabled] = useState(false);

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
        setActiveSessionId(null);
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