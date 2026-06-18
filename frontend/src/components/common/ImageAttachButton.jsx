import { useRef, useState } from 'react';
import { imageService } from '../../services/imageService';

/**
 * Paperclip/image attach button.
 * On file pick → uploads to Supabase Storage → calls onUploaded(url, previewDataUrl).
 * Shows a spinner while uploading.
 */
export default function ImageAttachButton({ onUploaded, disabled }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';          // reset so re-picking same file triggers onChange

    // Local preview URL for instant thumbnail
    const previewUrl = URL.createObjectURL(file);

    setUploading(true);
    try {
      const { url } = await imageService.upload(file);
      onUploaded(url, previewUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        title="Attach image — Gemini vision will read it"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          border: '1px solid var(--sep)',
          background: 'transparent',
          color: uploading ? 'var(--accent)' : 'var(--label3)',
          cursor: disabled || uploading ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          flexShrink: 0,
          transition: 'all .15s',
        }}
      >
        {uploading ? '⏳' : '📎'}
      </button>
    </>
  );
}