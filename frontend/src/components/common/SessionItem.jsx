import { useState, useRef, useEffect } from 'react';
import { copyService } from '../../services/copyService';

export default function SessionItem({ session, isActive, onSelect, onRefresh, onDeleted }) {
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title || 'Untitled');
  const menuRef = useRef(null);

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
    setShowMenu(false);
    onDeleted(session.id);
    await copyService.deleteSession(session.id);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        marginBottom: '1px',
        borderLeft: isActive ? '3px solid rgba(232,184,75,.45)' : '3px solid transparent',
        background: isActive ? 'rgba(255,255,255,.07)' : hovered ? 'rgba(255,255,255,.04)' : 'transparent',
        position: 'relative',
      }}
      onClick={() => !renaming && onSelect(session)}
    >
      {/* Title or rename input */}
      {renaming ? (
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') { setRenaming(false); }
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          style={{
            flex: 1,
            background: 'rgba(255,255,255,.12)',
            border: '1px solid rgba(232,184,75,.5)',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '12px',
            padding: '3px 6px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: '12px',
            color: isActive ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.45)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.5,
          }}
        >
          {session.is_pinned ? '📌 ' : ''}{session.title || 'Untitled'}
        </span>
      )}

      {/* ··· button — shown only on hover or when menu is open */}
      {!renaming && (hovered || showMenu) && (
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={{
              background: showMenu ? 'rgba(255,255,255,.12)' : 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,.5)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
              borderRadius: '4px',
              lineHeight: 1,
              letterSpacing: '1px',
            }}
          >
            ···
          </button>

          {showMenu && (
            <div
              style={{
                position: 'fixed',
                background: '#fff',
                border: '1px solid var(--sep)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(0,0,0,.15)',
                zIndex: 1000,
                minWidth: '160px',
                padding: '4px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <MenuItem
                icon="✏️"
                label="Rename"
                onClick={() => { setRenaming(true); setShowMenu(false); }}
              />
              <MenuItem
                icon={session.is_pinned ? '📌' : '📍'}
                label={session.is_pinned ? 'Unpin' : 'Pin'}
                onClick={handlePin}
              />
              <div style={{ height: '1px', background: 'var(--sep)', margin: '3px 4px' }} />
              <MenuItem
                icon="🗑"
                label="Delete"
                onClick={handleDelete}
                danger
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 10px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '13px',
        cursor: 'pointer',
        color: danger ? 'var(--red)' : 'var(--label)',
        background: hovered ? (danger ? 'var(--red-bg)' : 'var(--surface)') : 'transparent',
      }}
    >
      <span style={{ fontSize: '13px' }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}