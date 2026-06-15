import { useState, useRef } from 'react';
import { voiceService } from '../../services/voiceService';

export default function MicButton({ onTranscript }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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
          // Stop all audio tracks
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      setError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleClick = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
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

      {error && (
        <span style={{ fontSize: '10px', color: 'var(--red)', whiteSpace: 'nowrap' }}>
          {error}
        </span>
      )}
    </div>
  );
}