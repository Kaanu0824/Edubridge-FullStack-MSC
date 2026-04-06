import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, CameraOff, Play, Square, RefreshCw, Info } from 'lucide-react';
import { analyzeFace } from '../utils/api';
import StressGauge from '../components/StressGauge';

const EMOTION_COLORS = {
  angry:    '#C4554A',
  fear:     '#9B6BA8',
  happy:    '#4A9A47',
  neutral:  '#8BA888',
  sad:      '#4A7BA8',
  surprise: '#D4A843',
};

const EMOTION_EMOJIS = {
  angry: '😠', fear: '😨', happy: '😊',
  neutral: '😐', sad: '😢', surprise: '😲',
};

export default function FaceAnalysis({ addToast }) {
  const webcamRef   = useRef(null);
  const intervalRef = useRef(null);

  const [camOn,       setCamOn]       = useState(false);
  const [running,     setRunning]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [history,     setHistory]     = useState([]);
  const [frameCount,  setFrameCount]  = useState(0);
  const [stressFrames,setStressFrames]= useState(0);
  const [loading,     setLoading]     = useState(false);

  const stressRatio = frameCount > 0 ? stressFrames / frameCount : 0;

  const captureAndAnalyze = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    try {
      const data = await analyzeFace(imageSrc);
      setResult(data);
      if (data.has_face) {
        setFrameCount(c => c + 1);
        if (data.is_stressed) setStressFrames(s => s + 1);
        setHistory(h => [...h.slice(-29), {
          time: new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
          emotion: data.emotion,
          conf: data.confidence,
          stressed: data.is_stressed,
        }]);
      }
    } catch (e) {
      // silent fail during live scan
    }
  }, []);

  const startScan = useCallback(() => {
    setRunning(true);
    setFrameCount(0);
    setStressFrames(0);
    setHistory([]);
    intervalRef.current = setInterval(captureAndAnalyze, 1200);
    addToast('Face scanning started', 'success');
  }, [captureAndAnalyze, addToast]);

  const stopScan = useCallback(() => {
    setRunning(false);
    clearInterval(intervalRef.current);
    addToast('Face scan complete', 'info');
  }, [addToast]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const snapOnce = async () => {
    setLoading(true);
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) { setLoading(false); return; }
    try {
      const data = await analyzeFace(imageSrc);
      setResult(data);
      addToast(data.has_face ? `Detected: ${data.emotion}` : 'No face found', data.has_face ? 'success' : 'info');
    } catch {
      addToast('Face analysis failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <div className="section-eyebrow">Computer Vision</div>
        <h1 className="section-title">Face <em>Emotion</em> Recognition</h1>
        <p style={{ color: 'var(--mid)', fontSize: '0.92rem', marginTop: 6 }}>
          CNN-powered real-time detection across 6 emotion classes · Haar cascade face localisation
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Webcam panel */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem' }}>Live Feed</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setCamOn(o => !o)}>
                {camOn ? <CameraOff size={14} /> : <Camera size={14} />}
                {camOn ? 'Disable' : 'Enable'} Camera
              </button>
            </div>
          </div>

          {camOn ? (
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                width="100%"
                videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
                style={{ display: 'block', borderRadius: 14 }}
              />
              {/* Overlay when running */}
              {running && result?.has_face && (
                <div style={{
                  position: 'absolute', bottom: 12, left: 12,
                  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                  borderRadius: 10, padding: '8px 16px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{EMOTION_EMOJIS[result.emotion]}</span>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 500, fontSize: '0.9rem', textTransform: 'capitalize' }}>
                      {result.emotion}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>
                      {(result.confidence * 100).toFixed(1)}% confidence
                    </div>
                  </div>
                </div>
              )}
              {running && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: 'rgba(196,85,74,0.85)', borderRadius: 8,
                  padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulseDot 1s infinite' }} />
                  <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>LIVE</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              height: 300, borderRadius: 14, background: 'var(--cream)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, border: '2px dashed rgba(139,168,136,0.3)',
            }}>
              <Camera size={36} color="var(--light)" />
              <p style={{ color: 'var(--light)', fontSize: '0.9rem' }}>Enable camera to begin</p>
              <button className="btn btn-primary btn-sm" onClick={() => setCamOn(true)}>
                <Camera size={14} /> Enable Camera
              </button>
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            {!running ? (
              <button className="btn btn-primary" onClick={startScan} disabled={!camOn}>
                <Play size={15} /> Start Live Scan
              </button>
            ) : (
              <button className="btn btn-danger" onClick={stopScan}>
                <Square size={15} /> Stop Scan
              </button>
            )}
            <button className="btn btn-secondary" onClick={snapOnce} disabled={!camOn || loading}>
              {loading ? <div className="spinner" /> : <Camera size={15} />}
              Single Capture
            </button>
            <button className="btn btn-secondary" onClick={() => { setResult(null); setHistory([]); setFrameCount(0); setStressFrames(0); }}>
              <RefreshCw size={15} /> Reset
            </button>
          </div>
        </div>

        {/* Results panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Stress meter */}
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.95rem', marginBottom: 16 }}>Session Stress Ratio</div>
            <StressGauge score={stressRatio} level={stressRatio >= 0.5 ? 'HIGH' : 'NORMAL'} size={150} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, padding: '0 8px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.2rem', color: 'var(--terracotta)' }}>{frameCount}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--light)', textTransform: 'uppercase' }}>Total Frames</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.2rem', color: 'var(--danger)' }}>{stressFrames}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--light)', textTransform: 'uppercase' }}>Stressed</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.2rem', color: 'var(--sage)' }}>{frameCount - stressFrames}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--light)', textTransform: 'uppercase' }}>Calm</div>
              </div>
            </div>
          </div>

          {/* Emotion probabilities */}
          {result?.all_probabilities && Object.keys(result.all_probabilities).length > 0 && (
            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.95rem', marginBottom: 14 }}>Emotion Probabilities</div>
              {Object.entries(result.all_probabilities)
                .sort(([,a],[,b]) => b - a)
                .map(([emotion, prob]) => (
                  <div key={emotion} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--mid)', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {EMOTION_EMOJIS[emotion]} {emotion}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 500, color: EMOTION_COLORS[emotion] }}>
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${prob * 100}%`, background: EMOTION_COLORS[emotion] }} />
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* History feed */}
          {history.length > 0 && (
            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.95rem', marginBottom: 12 }}>Frame History</div>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...history].reverse().map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', background: 'var(--cream)', borderRadius: 8,
                    borderLeft: `3px solid ${EMOTION_COLORS[h.emotion] || 'var(--mist)'}`,
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--mid)' }}>{h.time}</span>
                    <span style={{ fontSize: '0.8rem', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {EMOTION_EMOJIS[h.emotion]} {h.emotion}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: h.stressed ? 'var(--danger)' : 'var(--success)' }}>
                      {h.stressed ? '⚠ Stressed' : '✓ Calm'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info panel */}
      <div className="card" style={{ padding: 20, marginTop: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Info size={18} color="var(--sage)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.82rem', color: 'var(--mid)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--charcoal)' }}>How it works:</strong> Each frame is captured from your webcam and sent to the Flask API where a CNN (Conv2D ×3 → MaxPool ×3 → Dense) classifies the face crop into one of 6 emotions (angry, fear, happy, neutral, sad, surprise). Stressed emotions are <em>angry</em>, <em>fear</em>, and <em>sad</em>. The ratio of stressed frames determines the face stress contribution to the final score.
        </div>
      </div>
    </div>
  );
}
