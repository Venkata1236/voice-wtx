import { useState, useRef, useEffect } from 'react';
import { copyService } from '../../services/copyService';

export default function SessionItem({ session, isActive, onSelect, onRefresh, onDeleted }) {
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title || 'Untitled');
  const menuRef = useRef(null);
  const btnRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openMenu = (e) => {
    e.stopPropagation();
    const rect = btnRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
    setShowMenu(!showMenu);
  };

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
    setShowMenu(false);
    onDeleted(session.id);
    await copyService.deleteSession(session.id);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        marginBottom: '1px',
        borderLeft: isActive ? '3px solid rgba(232,184,75,.45)' : '3px solid transparent',
        background: isActive
          ? 'rgba(255,255,255,.07)'
          : hovered ? 'rgba(255,255,255,.04)' : 'transparent',
        position: 'relative',
      }}
      onClick={() => !renaming && onSelect(session)}
    >
      {renaming ? (
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') setRenaming(false);
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
          {session.is_pinned ? '· ' : ''}{session.title || 'Untitled'}
        </span>
      )}

      {/* ··· button */}
      {!renaming && (hovered || showMenu) && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={btnRef}
            onClick={openMenu}
            style={{
              background: showMenu ? 'rgba(255,255,255,.10)' : 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,.45)',
              cursor: 'pointer',
              width: '22px',
              height: '22px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              letterSpacing: '1px',
              flexShrink: 0,
            }}
          >
            ···
          </button>
        </div>
      )}

      {/* Dropdown menu — fixed position so it's never clipped */}
      {showMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            background: 'rgba(30,30,42,0.96)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.10)',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,.35)',
            zIndex: 1000,
            minWidth: '160px',
            padding: '4px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem
            label="Rename"
            onClick={() => { setRenaming(true); setShowMenu(false); }}
          />
          <MenuItem
            label={session.is_pinned ? 'Unpin' : 'Pin'}
            onClick={handlePin}
          />
          <div style={{ height: '1px', background: 'rgba(255,255,255,.08)', margin: '3px 4px' }} />
          <MenuItem
            label="Delete"
            onClick={handleDelete}
            danger
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '7px 12px',
        borderRadius: '7px',
        fontSize: '13px',
        cursor: 'pointer',
        color: danger
          ? '#ff6b6b'
          : hovered ? '#fff' : 'rgba(255,255,255,.75)',
        background: hovered
          ? danger ? 'rgba(255,107,107,.12)' : 'rgba(255,255,255,.08)'
          : 'transparent',
        fontWeight: 400,
      }}
    >
      {label}
    </div>
  );
}