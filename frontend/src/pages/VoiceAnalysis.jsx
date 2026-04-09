import { Info, Mic, Square, Upload, Waves } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { analyzeVoice } from '../utils/api';

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

  // Draw waveform
  const drawWave = useCallback(() => {
    const canvas   = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx    = canvas.getContext('2d');
    const W      = canvas.width;
    const H      = canvas.height;
    const data   = new Uint8Array(analyser.frequencyBinCount);

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

  const startRecording = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx      = new AudioCtx();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = e => chunksRef.current.push(e.data);

      mr.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach(t => t.stop());
        const blob   = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          setLoading(true);
          try {
            const b64  = reader.result;
            const data = await analyzeVoice(b64);
            setResult(data);
            setHistory(h => [...h.slice(-9), {
              time:      new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
              label:     data.label,
              conf:      data.confidence,
              stressed:  data.is_stressed,
            }]);
            addToast(`Voice: ${data.label} (${(data.confidence*100).toFixed(0)}%)`, data.is_stressed ? 'error' : 'success');
          } catch {
            addToast('Voice analysis failed — ensure backend is running', 'error');
          } finally {
            setLoading(false);
          }
        };
        reader.readAsDataURL(blob);
      };

      mr.start();
      setRecording(true);
      drawWave();
      addToast('Recording… speak normally for 15 seconds', 'info');

      // Auto-stop after 15s
      let c = 15;
      setCountdown(c);
      const iv = setInterval(() => {
        c--;
        setCountdown(c);
        if (c <= 0) {
          clearInterval(iv);
          mr.stop();
          setRecording(false);
          setCountdown(0);
        }
      }, 1000);

    } catch (e) {
      addToast('Microphone access denied', 'error');
    }
  }, [drawWave, addToast]);

  const stopManually = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setCountdown(0);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const data = await analyzeVoice(reader.result);
        setResult(data);
        addToast(`Voice: ${data.label} (${(data.confidence*100).toFixed(0)}%)`, data.is_stressed ? 'error' : 'success');
      } catch {
        addToast('Analysis failed', 'error');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const barColor = result?.is_stressed ? 'var(--danger)' : 'var(--success)';

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="section-eyebrow">Audio Processing</div>
        <h1 className="section-title">Voice <em>Stress</em> Detection</h1>
        <p style={{ color: 'var(--mid)', fontSize: '0.92rem', marginTop: 6 }}>
          MFCC feature extraction (40 coefficients) · Dense neural network classifier
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Recorder */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', marginBottom: 20 }}>Microphone Recorder</div>

          {/* Waveform canvas */}
          <div style={{
            height: 100, borderRadius: 12, background: 'var(--cream)',
            marginBottom: 20, position: 'relative', overflow: 'hidden',
            border: recording ? '2px solid rgba(196,85,74,0.4)' : '2px solid rgba(139,168,136,0.15)',
            transition: 'border-color 0.3s',
          }}>
            <canvas ref={canvasRef} width={600} height={100} style={{ width: '100%', height: '100%' }} />
            {!recording && !loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 6,
              }}>
                <Waves size={28} color="var(--light)" />
                <span style={{ fontSize: '0.82rem', color: 'var(--light)' }}>
                  {loading ? 'Analysing…' : 'Press Record to start'}
                </span>
              </div>
            )}
            {recording && (
              <div style={{
                position: 'absolute', top: 10, right: 12,
                background: 'rgba(196,85,74,0.9)', borderRadius: 8,
                padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulseDot 1s infinite' }} />
                <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>REC {countdown}s</span>
              </div>
            )}
          </div>

          {/* Countdown visual */}
          {recording && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: 'rgba(196,85,74,0.08)', padding: '10px 24px', borderRadius: 100,
              }}>
                <Mic size={16} color="var(--danger)" />
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', color: 'var(--danger)' }}>{countdown}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--mid)' }}>seconds left</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {!recording ? (
              <button className="btn btn-primary" onClick={startRecording} disabled={loading}>
                {loading ? <div className="spinner" /> : <Mic size={16} />}
                {loading ? 'Analysing…' : 'Record 15 Seconds'}
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
            💡 Speak naturally for 15 seconds. The model analyses acoustic changes in pitch, tempo, and spectral features associated with stress.
          </p>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {result ? (
            <>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.95rem', marginBottom: 16 }}>Result</div>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '20px 0',
                }}>
                  <div style={{ fontSize: '3rem' }}>{result.is_stressed ? '😰' : '😌'}</div>
                  <div style={{
                    fontFamily: 'Fraunces, serif', fontSize: '1.8rem', fontWeight: 300,
                    color: result.is_stressed ? 'var(--danger)' : 'var(--success)',
                  }}>
                    {result.label}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--light)' }}>
                    Confidence: <strong style={{ color: 'var(--charcoal)' }}>{(result.confidence * 100).toFixed(1)}%</strong>
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
            </>
          ) : (
            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180, gap: 10 }}>
              <Waves size={32} color="var(--light)" />
              <p style={{ color: 'var(--light)', fontSize: '0.88rem', textAlign: 'center' }}>
                Record your voice to see<br />stress analysis results
              </p>
            </div>
          )}

          {/* History */}
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
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: h.stressed ? 'var(--danger)' : 'var(--success)' }}>
                      {h.label}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--mid)' }}>
                      {(h.conf * 100).toFixed(0)}%
                    </span>
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
          <strong style={{ color: 'var(--charcoal)' }}>How it works:</strong> Audio is recorded at 22,050 Hz and converted to a Mel-Frequency Cepstral Coefficient (MFCC) feature vector of 40 dimensions. This is passed through a Dense neural network (128 → 64 → softmax) to classify as <em>STRESSED</em> or <em>NORMAL</em>. The model captures acoustic features like pitch variation, speech rate, and spectral energy that correlate with psychological stress.
        </div>
      </div>
    </div>
  );
}