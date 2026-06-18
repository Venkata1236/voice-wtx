import { useRef, useState } from 'react';
import { imageService } from '../../services/imageService';

/**
 * "+" attach button, ChatGPT/Claude style.
 * On file pick → uploads to Supabase Storage → calls onUploaded(url, previewDataUrl).
 */
export default function ImageAttachButton({ onUploaded, disabled }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';          // reset so re-picking same file triggers onChange

    const previewUrl = URL.createObjectURL(file); // instant local thumbnail

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
        title="Attach image"
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          border: '1px solid var(--sep)',
          background: 'transparent',
          color: 'var(--label2)',
          cursor: disabled || uploading ? 'default' : 'pointer',
          opacity: uploading ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 400,
          lineHeight: 1,
          flexShrink: 0,
          padding: 0,
          transition: 'all .15s',
        }}
        onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = 'var(--surface)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        +
      </button>
    </>
  );
}