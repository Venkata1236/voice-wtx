import { useState, useRef, useEffect } from 'react';
import { voiceService } from '../../services/voiceService';

export default function MicButton({ onTranscript }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const errorTimerRef = useRef(null);

  // Auto-dismiss the error tooltip after 3 seconds
  useEffect(() => {
    if (error) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(''), 3000);
    }
    return () => clearTimeout(errorTimerRef.current);
  }, [error]);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setProcessing(true);
        try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const transcript = await voiceService.transcribe(audioBlob);
          if (transcript) {
            onTranscript(transcript);
          } else {
            setError('No speech detected');
          }
        } catch (err) {
          setError('Transcription failed');
        } finally {
          setProcessing(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Permission denied');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found');
      } else {
        setError('Mic unavailable');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleClick = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        onClick={handleClick}
        disabled={processing}
        title={recording ? 'Click to stop recording' : 'Click to record brief'}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: recording ? '2px solid var(--red)' : '1px solid var(--sep)',
          background: recording ? 'var(--red-bg)' : processing ? 'var(--surface)' : 'transparent',
          cursor: processing ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          flexShrink: 0,
          animation: recording ? 'pulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {processing ? '⏳' : recording ? '⏹' : '🎙'}
      </button>

      {/* Tooltip — floats ABOVE the button, never pushes the toolbar row */}
      {error && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          right: 0,
          background: '#1E1E2A',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 500,
          padding: '5px 9px',
          borderRadius: '6px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(0,0,0,.18)',
        }}>
          {error}
          {/* Downward arrow */}
          <div style={{
            position: 'absolute',
            top: '100%',
            right: '10px',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #1E1E2A',
          }} />
        </div>
      )}
    </div>
  );
}