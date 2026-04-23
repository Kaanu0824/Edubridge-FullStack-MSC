import { Info, Mic, Square, Upload, Waves } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { analyzeVoice } from '../utils/api';

// ── WAV encoder ────────────────────────────────────────────────────────────────
// Converts Float32Array PCM samples into a proper WAV Blob.
// This lets us send WAV to the backend instead of WebM,
// so librosa can decode it without needing ffmpeg installed.
function encodeWAV(samples, sampleRate) {
  const buf  = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const str  = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  str(0, 'RIFF');
  view.setUint32(4,  36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1,  true);          // PCM
  view.setUint16(22, 1,  true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2,  true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// Re-encode any audio Blob → WAV base64 data URI using Web Audio API
async function blobToWavBase64(blob) {
  const arrayBuf = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx      = new AudioCtx({ sampleRate: 22050 });
  let audioBuf;
  try {
    audioBuf = await ctx.decodeAudioData(arrayBuf);
  } finally {
    ctx.close();
  }
  const wavBlob = encodeWAV(audioBuf.getChannelData(0), 22050);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror   = reject;
    reader.readAsDataURL(wavBlob);
  });
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function VoiceAnalysis({ addToast }) {
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const animFrameRef     = useRef(null);
  const analyserRef      = useRef(null);
  const canvasRef        = useRef(null);

  const [recording, setRecording] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [history,   setHistory]   = useState([]);
  const [errorMsg,  setErrorMsg]  = useState(null);

  // Waveform visualiser
  const drawWave = useCallback(() => {
    const canvas   = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx  = canvas.getContext('2d');
    const W    = canvas.width;
    const H    = canvas.height;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, W, H);
      ctx.beginPath();
      ctx.strokeStyle = 'var(--deep-sage)';
      ctx.lineWidth   = 2;
      const sliceW = W / data.length;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * H) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.stroke();
    };
    draw();
  }, []);

  // Convert blob → WAV → send to backend
  const sendBlob = useCallback(async (blob) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let wavBase64;
      try {
        // KEY FIX: convert to WAV in browser before sending
        // This removes the ffmpeg dependency on the backend
        wavBase64 = await blobToWavBase64(blob);
      } catch (e) {
        throw new Error(`Audio encoding failed: ${e.message}. Try recording again.`);
      }

      const b64Part = wavBase64.split(',')[1] || '';
      if (b64Part.length < 500) {
        throw new Error('Recording too short — hold Record for at least 2 seconds.');
      }

      const data = await analyzeVoice(wavBase64);
      setResult(data);
      setHistory(h => [...h.slice(-9), {
        time:     new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
        label:    data.label,
        conf:     data.confidence,
        stressed: data.is_stressed,
      }]);
      addToast(`Voice: ${data.label} (${(data.confidence * 100).toFixed(0)}%)`,
               data.is_stressed ? 'error' : 'success');
    } catch (err) {
      const msg = err?.response?.data?.detail
               || err?.response?.data?.error
               || err?.message
               || 'Voice analysis failed';
      setErrorMsg(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Start recording
  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      chunksRef.current   = [];

      const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        if (!chunksRef.current.length) {
          setErrorMsg('No audio captured — check microphone permissions.');
          setLoading(false);
          return;
        }
        await sendBlob(new Blob(chunksRef.current, { type: mimeType || 'audio/webm' }));
      };

      mr.start(250);
      setRecording(true);
      drawWave();
      addToast('Recording… speak for 10 seconds', 'info');

      let c = 10;
      setCountdown(c);
      const iv = setInterval(() => {
        c -= 1;
        setCountdown(c);
        if (c <= 0) {
          clearInterval(iv);
          if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
          setRecording(false);
          setCountdown(0);
        }
      }, 1000);
    } catch (e) {
      setErrorMsg(e.name === 'NotAllowedError'
        ? 'Microphone access denied — allow microphone in browser settings'
        : `Could not start recording: ${e.message}`);
    }
  }, [drawWave, addToast, sendBlob]);

  const stopManually = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setRecording(false);
    setCountdown(0);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    await sendBlob(new Blob([await file.arrayBuffer()], { type: file.type || 'audio/wav' }));
    e.target.value = '';
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="section-eyebrow">Audio Processing</div>
        <h1 className="section-title">Voice <em>Stress</em> Detection</h1>
        <p style={{ color: 'var(--mid)', fontSize: '0.92rem', marginTop: 6 }}>
          MFCC feature extraction (40 coefficients) · Dense neural network classifier
        </p>
      </div>

      {errorMsg && (
        <div style={{
          background: 'rgba(196,85,74,0.08)', border: '1px solid rgba(196,85,74,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', marginBottom: 2 }}>
              Voice analysis error
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--mid)', lineHeight: 1.5 }}>{errorMsg}</div>
          </div>
          <button onClick={() => setErrorMsg(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--light)', fontSize: '1.2rem', padding: 0,
          }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        <div className="card" style={{ padding: 28 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', marginBottom: 20 }}>
            Microphone Recorder
          </div>

          <div style={{
            height: 100, borderRadius: 12, background: 'var(--cream)', marginBottom: 20,
            position: 'relative', overflow: 'hidden',
            border: recording ? '2px solid rgba(196,85,74,0.4)' : '2px solid rgba(139,168,136,0.15)',
            transition: 'border-color 0.3s',
          }}>
            <canvas ref={canvasRef} width={600} height={100} style={{ width: '100%', height: '100%' }} />
            {!recording && !loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6,
              }}>
                <Waves size={28} color="var(--light)" />
                <span style={{ fontSize: '0.82rem', color: 'var(--light)' }}>Press Record to start</span>
              </div>
            )}
            {recording && (
              <div style={{
                position: 'absolute', top: 10, right: 12, background: 'rgba(196,85,74,0.9)',
                borderRadius: 8, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulseDot 1s infinite' }} />
                <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>REC {countdown}s</span>
              </div>
            )}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(245,240,232,0.85)', gap: 10,
              }}>
                <div className="spinner" />
                <span style={{ fontSize: '0.82rem', color: 'var(--mid)' }}>Analysing…</span>
              </div>
            )}
          </div>

          {recording && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: 'rgba(196,85,74,0.08)', padding: '10px 24px', borderRadius: 100,
              }}>
                <Mic size={16} color="var(--danger)" />
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', color: 'var(--danger)' }}>
                  {countdown}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--mid)' }}>seconds left</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {!recording ? (
              <button className="btn btn-primary" onClick={startRecording} disabled={loading}>
                {loading ? <div className="spinner" /> : <Mic size={16} />}
                {loading ? 'Analysing…' : 'Record 10 Seconds'}
              </button>
            ) : (
              <button className="btn btn-danger" onClick={stopManually}>
                <Square size={15} /> Stop Early
              </button>
            )}
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={15} /> Upload Audio
              <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--light)', marginTop: 12, lineHeight: 1.5 }}>
            💡 Speak naturally for 10 seconds. The model analyses acoustic changes in pitch,
            tempo, and spectral features associated with stress.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {result ? (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.95rem', marginBottom: 16 }}>Result</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0' }}>
                <div style={{ fontSize: '3rem' }}>{result.is_stressed ? '😰' : '😌'}</div>
                <div style={{
                  fontFamily: 'Fraunces, serif', fontSize: '1.8rem', fontWeight: 300,
                  color: result.is_stressed ? 'var(--danger)' : 'var(--success)',
                }}>
                  {result.label}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--light)' }}>
                  Confidence:{' '}
                  <strong style={{ color: 'var(--charcoal)' }}>{(result.confidence * 100).toFixed(1)}%</strong>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {Object.entries(result.all_probabilities || {}).map(([label, prob]) => (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--mid)', textTransform: 'capitalize' }}>{label}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 500, color: label.toUpperCase() === 'STRESSED' ? 'var(--danger)' : 'var(--success)' }}>
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${prob * 100}%`,
                        background: label.toUpperCase() === 'STRESSED' ? 'var(--danger)' : 'var(--success)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{
              padding: 24, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', minHeight: 180, gap: 10,
            }}>
              <Waves size={32} color="var(--light)" />
              <p style={{ color: 'var(--light)', fontSize: '0.88rem', textAlign: 'center' }}>
                Record your voice to see<br />stress analysis results
              </p>
            </div>
          )}

          {history.length > 0 && (
            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.9rem', marginBottom: 12 }}>Session History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[...history].reverse().map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 10px', background: 'var(--cream)', borderRadius: 8,
                    borderLeft: `3px solid ${h.stressed ? 'var(--danger)' : 'var(--success)'}`,
                  }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--light)' }}>{h.time}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: h.stressed ? 'var(--danger)' : 'var(--success)' }}>{h.label}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--mid)' }}>{(h.conf * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Info size={18} color="var(--sage)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.82rem', color: 'var(--mid)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--charcoal)' }}>How it works:</strong> Audio is recorded
          at 22,050 Hz, converted to WAV in the browser (no ffmpeg needed), and sent to the
          backend. A 40-dimensional MFCC feature vector is extracted and passed through a Dense
          neural network (256 → 128 → 64 → softmax) to classify as <em>STRESSED</em> or <em>NORMAL</em>.
        </div>
      </div>
    </div>
  );
}