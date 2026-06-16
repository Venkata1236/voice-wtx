import { useState, useRef, useEffect } from 'react';
import { copyService } from '../../services/copyService';

export default function SessionItem({ session, isActive, onSelect, onRefresh, onDeleted }) {
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title || 'Untitled');
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePin = async () => {
    await copyService.pinSession(session.id);
    setShowMenu(false);
    onRefresh();
  };

  const handleRename = async () => {
    if (!newTitle.trim()) return;
    await copyService.renameSession(session.id, newTitle.trim());
    setRenaming(false);
    setShowMenu(false);
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${session.title || 'Untitled'}"?`)) return;
    await copyService.deleteSession(session.id);
    setShowMenu(false);
    onDeleted(session.id);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        marginBottom: '1px',
        borderLeft: isActive ? '3px solid rgba(232,184,75,.45)' : '3px solid transparent',
        background: isActive ? 'rgba(255,255,255,.07)' : 'transparent',
        position: 'relative',
        group: 'session',
      }}
      onClick={() => !renaming && onSelect(session)}
    >
      {renaming ? (
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') { setRenaming(false); setShowMenu(false); }
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          style={{
            flex: 1,
            background: 'rgba(255,255,255,.12)',
            border: '1px solid rgba(232,184,75,.4)',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '12px',
            padding: '2px 6px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: '12px',
            color: isActive ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.40)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.45,
          }}
        >
          {session.is_pinned ? '📌 ' : ''}{session.title || 'Untitled'}
        </span>
      )}

      {/* Three dot menu button */}
      {!renaming && (
        <div
          ref={menuRef}
          style={{ position: 'relative', flexShrink: 0 }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,.35)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0 2px',
              lineHeight: 1,
              borderRadius: '4px',
            }}
            title="Options"
          >
            ···
          </button>

          {showMenu && (
            <div
              style={{
                position: 'absolute',
                left: '100%',
                top: 0,
                background: '#fff',
                border: '1px solid var(--sep)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                zIndex: 100,
                minWidth: '140px',
                padding: '4px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <MenuItem
                onClick={() => { setRenaming(true); setShowMenu(false); }}
                icon="✏️"
                label="Rename"
              />
              <MenuItem
                onClick={handlePin}
                icon={session.is_pinned ? '📌' : '📍'}
                label={session.is_pinned ? 'Unpin' : 'Pin'}
              />
              <div style={{ height: '1px', background: 'var(--sep)', margin: '4px 0' }} />
              <MenuItem
                onClick={handleDelete}
                icon="🗑"
                label="Delete"
                danger
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, icon, label, danger }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '12px',
        cursor: 'pointer',
        color: danger ? 'var(--red)' : 'var(--label)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = danger ? 'var(--red-bg)' : 'var(--surface)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}