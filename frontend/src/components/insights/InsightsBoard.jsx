import { useState, useEffect } from 'react';
import { insightsService } from '../../services/insightsService';
import NoteCard from './NoteCard';
import NoteEditor from './NoteEditor';

const PREDEFINED_VALUES = ['misc', 'client_feedback', 'brand_rule', 'important', 'follow_up', 'research'];

export default function InsightsBoard({ brandId }) {
  const [notes, setNotes] = useState([]);
  const [countInfo, setCountInfo] = useState({ current: 0, max: 25, status: 'green' });
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [customTags, setCustomTags] = useState([]); // user-created tags, persisted per brand

  const storageKey = `voice_custom_tags_${brandId}`;

  useEffect(() => {
    loadNotes();
    // Load persisted custom tags for this brand
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(`voice_custom_tags_${brandId}`) || '[]'); } catch { stored = []; }
    setCustomTags(Array.isArray(stored) ? stored : []);
  }, [brandId]);

  const loadNotes = async () => {
    const [notesData, countData] = await Promise.all([
      insightsService.getNotes(brandId),
      insightsService.getCount(brandId),
    ]);
    setNotes(notesData);
    setCountInfo(countData);
  };

  const persistCustom = (list) => {
    setCustomTags(list);
    try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch { /* ignore */ }
  };

  // All custom tags = persisted list + any found on existing notes (deduped)
  const noteCustomTags = notes
    .map((n) => n.tag)
    .filter((t) => t && !PREDEFINED_VALUES.includes(t));
  const allCustomTags = [...new Set([...customTags, ...noteCustomTags])];

  const handleAddTag = (t) => {
    const tag = (t || '').trim();
    if (!tag || PREDEFINED_VALUES.includes(tag) || allCustomTags.includes(tag)) return;
    persistCustom([...customTags, tag]);
  };

  const handleSaveNew = async (data) => {
    try {
      await insightsService.createNote({ brand_id: brandId, ...data });
      setShowNew(false);
      loadNotes();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save note');
    }
  };

  const handleSaveEdit = async (data) => {
    try {
      await insightsService.updateNote(editing.id, data);
      setEditing(null);
      loadNotes();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save note');
    }
  };

  // Delete a tag everywhere — remove from persisted list + revert affected notes to misc
  const handleDeleteTag = async (tagValue) => {
    persistCustom(customTags.filter((t) => t !== tagValue));
    const affected = notes.filter((n) => n.tag === tagValue);
    try {
      if (affected.length) {
        await Promise.all(affected.map((n) => insightsService.updateNote(n.id, { tag: 'misc' })));
        loadNotes();
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete tag');
    }
  };

  const handleTogglePin = async (noteId) => {
    await insightsService.togglePin(noteId);
    loadNotes();
  };

  const handleDelete = async (noteId) => {
    if (!confirm('Delete this note?')) return;
    await insightsService.deleteNote(noteId);
    loadNotes();
  };

  const barColor = {
    green: 'var(--green)',
    orange: 'var(--orange)',
    red: 'var(--red)',
  }[countInfo.status];

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
      {/* Header with count bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Notes</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div style={{ width: '100px', height: '4px', borderRadius: '2px', background: 'var(--sep)', overflow: 'hidden' }}>
              <div style={{ width: `${(countInfo.current / countInfo.max) * 100}%`, height: '100%', background: barColor }} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--label3)' }}>{countInfo.current} / {countInfo.max}</span>
          </div>
        </div>

        <button
          onClick={() => setShowNew(true)}
          disabled={countInfo.current >= countInfo.max}
          style={{
            padding: '7px 14px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: '#1E1E2A',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: countInfo.current >= countInfo.max ? 'default' : 'pointer',
            opacity: countInfo.current >= countInfo.max ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          + Note
        </button>
      </div>

      {/* New note editor */}
      {showNew && (
        <div style={{ marginBottom: '16px' }}>
          <NoteEditor
            onSave={handleSaveNew}
            onCancel={() => setShowNew(false)}
            customTags={allCustomTags}
            onAddTag={handleAddTag}
            onDeleteTag={handleDeleteTag}
          />
        </div>
      )}

      {/* Notes grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
        {notes.map((note) =>
          editing?.id === note.id ? (
            <NoteEditor
              key={note.id}
              note={note}
              onSave={handleSaveEdit}
              onCancel={() => setEditing(null)}
              customTags={allCustomTags}
              onAddTag={handleAddTag}
              onDeleteTag={handleDeleteTag}
            />
          ) : (
            <NoteCard
              key={note.id}
              note={note}
              onTogglePin={handleTogglePin}
              onDelete={handleDelete}
              onEdit={setEditing}
            />
          )
        )}
      </div>

      {notes.length === 0 && !showNew && (
        <div style={{ textAlign: 'center', color: 'var(--label3)', marginTop: '60px', fontSize: '13px' }}>
          No notes yet. Capture what worked, what got rejected, and client feedback here.
        </div>
      )}
    </div>
  );
}