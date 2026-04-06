import React, { useState, useEffect } from 'react';
import { getReportHistory } from '../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

const PIE_COLORS = ['#4A9A47', '#C4554A'];

const EMOTION_COLORS = {
  angry: '#C4554A', fear: '#9B6BA8', happy: '#4A9A47',
  neutral: '#8BA888', sad: '#4A7BA8', surprise: '#D4A843',
};

export default function Analytics({ addToast }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const h = await getReportHistory();
      setHistory(h.reports || []);
    } catch {
      addToast('Could not load analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Derived stats
  const total      = history.length;
  const highCount  = history.filter(r => r.stress_level === 'HIGH').length;
  const normCount  = total - highCount;
  const avgScore   = total ? (history.reduce((a, r) => a + (r.final_score || 0), 0) / total).toFixed(3) : 0;
  const trend      = total > 1
    ? (history[0]?.final_score || 0) - (history[history.length - 1]?.final_score || 0)
    : 0;

  const pieData = [
    { name: 'Normal', value: normCount },
    { name: 'High',   value: highCount },
  ];

  const emotionFreq = {};
  history.forEach(r => {
    if (r.face_emotion) emotionFreq[r.face_emotion] = (emotionFreq[r.face_emotion] || 0) + 1;
  });
  const emotionData = Object.entries(emotionFreq)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const scoreTrend = [...history].reverse().slice(-15).map((r, i) => ({
    idx:   i + 1,
    score: parseFloat(r.final_score?.toFixed(3) || 0),
    time:  r.timestamp ? new Date(r.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : `#${i+1}`,
  }));

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <div className="section-eyebrow">Insights</div>
          <h1 className="section-title"><em>Analytics</em> & Trends</h1>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      ) : total === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--light)' }}>
          <TrendingUp size={40} style={{ marginBottom: 12 }} />
          <p>No data yet. Run some stress checks to see analytics.</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 24 }}>
            {[
              { label: 'Total Sessions', val: total, color: 'var(--deep-sage)', icon: '📊' },
              { label: 'Avg Stress Score', val: avgScore, color: 'var(--amber)', icon: '🧠' },
              { label: 'HIGH Stress', val: highCount, color: 'var(--danger)', icon: '⚠️' },
              { label: 'Normal Sessions', val: normCount, color: 'var(--success)', icon: '✅' },
            ].map(({ label, val, color, icon }) => (
              <div key={label} className="card" style={{ padding: 22, textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{icon}</div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 300, color, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--light)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Trend + Pie */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
            <div className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem' }}>Score Trend</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: trend > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {trend > 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                  {trend > 0 ? 'Improving' : 'Increasing'}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={scoreTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--light)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: 'var(--light)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--warm-white)', border: '1px solid rgba(139,168,136,0.2)', borderRadius: 10, fontSize: 12 }}
                    formatter={v => [`${(v*100).toFixed(0)}%`, 'Stress']}
                  />
                  <Line
                    type="monotone" dataKey="score"
                    stroke="var(--deep-sage)" strokeWidth={2.5}
                    dot={{ fill: 'var(--deep-sage)', r: 5, strokeWidth: 0 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', marginBottom: 20 }}>Stress Distribution</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={4}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--warm-white)', border: '1px solid rgba(139,168,136,0.2)', borderRadius: 10, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Emotion frequency */}
          {emotionData.length > 0 && (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', marginBottom: 20 }}>Emotion Frequency</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={emotionData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--mid)', textTransform: 'capitalize' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--light)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--warm-white)', border: '1px solid rgba(139,168,136,0.2)', borderRadius: 10, fontSize: 12 }}
                    formatter={v => [v, 'Sessions']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {emotionData.map((entry, i) => (
                      <Cell key={i} fill={EMOTION_COLORS[entry.name] || 'var(--sage)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
