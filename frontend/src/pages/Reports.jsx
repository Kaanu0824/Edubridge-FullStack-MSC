import React, { useState, useEffect } from 'react';
import { getLatestReport, getReportHistory, analyzeCombined } from '../utils/api';
import { RefreshCw, Download, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import StressGauge from '../components/StressGauge';

export default function Reports({ addToast }) {
  const [latest,  setLatest]  = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, h] = await Promise.all([getLatestReport(), getReportHistory()]);
      setLatest(r);
      setHistory(h.reports || []);
    } catch {
      addToast('Could not load reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generateDemoReport = async () => {
    try {
      const data = await analyzeCombined({
        face_ratio:   parseFloat((Math.random() * 0.6 + 0.1).toFixed(2)),
        face_emotion: ['sad','neutral','angry','fear','happy'][Math.floor(Math.random()*5)],
        voice_label:  Math.random() > 0.5 ? 'STRESSED' : 'NORMAL',
        voice_conf:   parseFloat((Math.random() * 0.4 + 0.4).toFixed(2)),
      });
      setLatest(data);
      setHistory(h => [data, ...h.slice(0, 19)]);
      addToast('Demo report generated', 'success');
    } catch {
      addToast('Could not generate report — is backend running?', 'error');
    }
  };

  const downloadReport = (report) => {
    const lines = [
      `EduBridge Stress Report`,
      `========================`,
      `Timestamp:    ${report.timestamp}`,
      `Face Emotion: ${report.face_emotion}`,
      `Face Ratio:   ${report.face_ratio}`,
      `Voice Label:  ${report.voice_label}`,
      `Voice Conf:   ${report.voice_conf}`,
      `Final Score:  ${report.final_score}`,
      `Stress Level: ${report.stress_level}`,
      ``,
      `Formula: score = (face_ratio × 0.6) + (voice_conf × 0.4)`,
      `Threshold: HIGH if score ≥ 0.50 else NORMAL`,
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `stress_report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Report downloaded', 'success');
  };

  const levelColor = (level) => level === 'HIGH' ? 'var(--danger)' : 'var(--success)';

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <div className="section-eyebrow">Data</div>
          <h1 className="section-title">Stress <em>Reports</em></h1>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={generateDemoReport}>
            <FileText size={13} /> Generate Demo
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      ) : (
        <>
          {/* Latest report hero */}
          {latest && (
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, marginBottom: 28 }}>
              <div className="card" style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.9rem', marginBottom: 16 }}>Latest Result</div>
                <StressGauge score={latest.final_score} level={latest.stress_level} size={150} />
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 16, width: '100%' }} onClick={() => downloadReport(latest)}>
                  <Download size={13} /> Download Report
                </button>
              </div>

              <div className="card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem' }}>Session Details</span>
                  <span className={`badge ${latest.stress_level === 'HIGH' ? 'badge-red' : 'badge-green'}`}>
                    {latest.stress_level === 'HIGH' ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
                    {latest.stress_level}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[
                    { label: 'Face Emotion',  val: latest.face_emotion, color: 'var(--terracotta)' },
                    { label: 'Face Ratio',    val: `${(latest.face_ratio * 100).toFixed(0)}%` },
                    { label: 'Voice Label',   val: latest.voice_label, color: levelColor(latest.voice_label === 'STRESSED' ? 'HIGH' : 'NORMAL') },
                    { label: 'Voice Conf',    val: `${(latest.voice_conf * 100).toFixed(0)}%` },
                    { label: 'Final Score',   val: latest.final_score?.toFixed(3), color: levelColor(latest.stress_level) },
                    { label: 'Timestamp',     val: latest.timestamp ? new Date(latest.timestamp).toLocaleString('en-GB') : '—' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ padding: '14px', background: 'var(--cream)', borderRadius: 12 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--light)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.05rem', color: color || 'var(--charcoal)', textTransform: 'capitalize' }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Formula */}
                <div style={{
                  marginTop: 16, padding: '12px 16px', background: 'var(--cream)',
                  borderRadius: 10, fontFamily: 'Courier New, monospace', fontSize: '0.82rem', color: 'var(--mid)', lineHeight: 1.7,
                }}>
                  score = ({latest.face_ratio?.toFixed(2)} × 0.6) + ({latest.voice_conf?.toFixed(2)} × {latest.voice_label === 'STRESSED' ? '0.4' : '0.0'})
                  &nbsp;= <strong style={{ color: levelColor(latest.stress_level) }}>{latest.final_score?.toFixed(3)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* History table */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', marginBottom: 18 }}>Report History</div>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--light)' }}>
                <FileText size={32} style={{ marginBottom: 10 }} />
                <p>No reports yet. Run a stress check first.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      {['Timestamp', 'Face', 'Face Ratio', 'Voice', 'Voice Conf', 'Score', 'Level', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--light)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r, i) => (
                      <tr key={i} style={{ background: 'var(--cream)', borderRadius: 10 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,168,136,0.07)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--cream)'}
                      >
                        <td style={{ padding: '12px', borderRadius: '10px 0 0 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={12} color="var(--light)" />
                            <span style={{ fontSize: '0.78rem', color: 'var(--mid)' }}>
                              {r.timestamp ? new Date(r.timestamp).toLocaleTimeString('en-GB') : '—'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', textTransform: 'capitalize', color: 'var(--terracotta)' }}>{r.face_emotion}</td>
                        <td style={{ padding: '12px' }}>{(r.face_ratio * 100).toFixed(0)}%</td>
                        <td style={{ padding: '12px', color: r.voice_label === 'STRESSED' ? 'var(--danger)' : 'var(--success)', fontWeight: 500 }}>{r.voice_label}</td>
                        <td style={{ padding: '12px' }}>{(r.voice_conf * 100).toFixed(0)}%</td>
                        <td style={{ padding: '12px', fontFamily: 'Fraunces, serif', color: levelColor(r.stress_level) }}>{r.final_score?.toFixed(3)}</td>
                        <td style={{ padding: '12px' }}>
                          <span className={`badge ${r.stress_level === 'HIGH' ? 'badge-red' : 'badge-green'}`} style={{ fontSize: '0.65rem' }}>
                            {r.stress_level}
                          </span>
                        </td>
                        <td style={{ padding: '12px', borderRadius: '0 10px 10px 0' }}>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => downloadReport(r)}>
                            <Download size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
