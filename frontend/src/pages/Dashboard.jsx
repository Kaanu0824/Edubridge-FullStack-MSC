import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Mic, MessageCircle, FileText, Activity, ArrowRight, Brain, Zap, Shield } from 'lucide-react';
import { getLatestReport, getHealth } from '../utils/api';
import StressGauge from '../components/StressGauge';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

const EMOTION_COLORS = {
  angry:   '#C4554A',
  fear:    '#9B6BA8',
  happy:   '#4A9A47',
  neutral: '#8BA888',
  sad:     '#4A7BA8',
  surprise: '#D4A843',
};

export default function Dashboard() {
  const [report, setReport]   = useState(null);
  const [health, setHealth]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getLatestReport(), getHealth()])
      .then(([r, h]) => { setReport(r); setHealth(h); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const score = report?.final_score ?? 0.46;
  const level = report?.stress_level ?? 'NORMAL';

  const radarData = [
    { subject: 'Face', A: Math.round((report?.face_ratio ?? 0.4) * 100) },
    { subject: 'Voice', A: Math.round((report?.voice_conf ?? 0.55) * 100) },
    { subject: 'Final', A: Math.round(score * 100) },
    { subject: 'Calm', A: Math.round((1 - score) * 100) },
    { subject: 'Focus', A: 72 },
  ];

  const mockHistory = [
    { time: '08:00', score: 0.25 },
    { time: '09:30', score: 0.38 },
    { time: '11:00', score: 0.52 },
    { time: '12:30', score: 0.46 },
    { time: '14:00', score: 0.41 },
    { time: '15:30', score: 0.35 },
    { time: '17:00', score: score },
  ];

  const cards = [
    {
      to: '/face', icon: Camera, color: 'var(--deep-sage)',
      bg: 'rgba(139,168,136,0.1)',
      title: 'Face Analysis',
      desc: 'CNN-powered real-time emotion detection via webcam',
      stat: report?.face_emotion ?? 'sad',
      statLabel: 'Last emotion',
    },
    {
      to: '/voice', icon: Mic, color: 'var(--terracotta)',
      bg: 'rgba(196,117,74,0.1)',
      title: 'Voice Analysis',
      desc: 'MFCC feature extraction for acoustic stress detection',
      stat: report?.voice_label ?? 'STRESSED',
      statLabel: 'Last result',
    },
    {
      to: '/chatbot', icon: MessageCircle, color: 'var(--amber)',
      bg: 'rgba(212,168,67,0.1)',
      title: 'Support Chatbot',
      desc: 'Intent-driven conversational support with LR + SVM',
      stat: '6 intents',
      statLabel: 'Categories',
    },
    {
      to: '/reports', icon: FileText, color: 'var(--mist)',
      bg: 'rgba(184,201,199,0.2)',
      title: 'Reports',
      desc: 'Session history, trends and exported stress summaries',
      stat: report ? '1 saved' : '—',
      statLabel: 'Latest',
    },
  ];

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-eyebrow">Overview</div>
        <h1 className="section-title" style={{ marginBottom: 8 }}>
          Student <em>Wellbeing</em> Dashboard
        </h1>
        <p style={{ color: 'var(--mid)', fontSize: '0.95rem' }}>
          Real-time multimodal stress detection — face · voice · chat
        </p>
      </div>

      {/* System health banner */}
      {health && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap'
        }}>
          {[
            { label: 'Face Model',    ok: health.models?.face    },
            { label: 'Audio Model',   ok: health.models?.audio   },
            { label: 'Chatbot Model', ok: health.models?.chatbot },
          ].map(({ label, ok }) => (
            <div key={label} className={`badge ${ok ? 'badge-green' : 'badge-red'}`}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {label} {ok ? 'Loaded' : 'Offline'}
            </div>
          ))}
        </div>
      )}

      {/* Top row: Gauge + Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, marginBottom: 24 }}>
        {/* Gauge card */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem' }}>Stress Index</span>
            <span className={`badge ${level === 'HIGH' ? 'badge-red' : 'badge-green'}`}>
              {level}
            </span>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            </div>
          ) : (
            <StressGauge score={score} level={level} size={180} />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24 }}>
            <div style={{ textAlign: 'center', padding: '12px', background: 'var(--cream)', borderRadius: 12 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.3rem', color: 'var(--terracotta)' }}>
                {((report?.face_ratio ?? 0.4) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                Face Ratio
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: 'var(--cream)', borderRadius: 12 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.3rem', color: 'var(--amber)' }}>
                {((report?.voice_conf ?? 0.55) * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                Voice Conf
              </div>
            </div>
          </div>
        </div>

        {/* Trend chart */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 20, fontFamily: 'Fraunces, serif', fontSize: '1rem' }}>
            Stress Trend — Today
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mockHistory}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--deep-sage)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--deep-sage)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--light)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: 'var(--light)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--warm-white)', border: '1px solid rgba(139,168,136,0.2)', borderRadius: 10, fontSize: 12 }}
                formatter={v => [`${(v*100).toFixed(0)}%`, 'Stress']}
              />
              <Area type="monotone" dataKey="score" stroke="var(--deep-sage)" strokeWidth={2} fill="url(#sg)" dot={{ fill: 'var(--deep-sage)', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Module cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 24 }}>
        {cards.map(({ to, icon: Icon, color, bg, title, desc, stat, statLabel }) => (
          <Link key={to} to={to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              padding: 22, cursor: 'pointer',
              transition: 'transform 0.25s, box-shadow 0.25s',
              ':hover': { transform: 'translateY(-4px)' }
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={19} color={color} />
                </div>
                <ArrowRight size={15} color="var(--light)" />
              </div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', marginBottom: 6, color: 'var(--charcoal)' }}>
                {title}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--light)', lineHeight: 1.5, marginBottom: 16 }}>
                {desc}
              </div>
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 12 }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.95rem', color, textTransform: 'capitalize' }}>{stat}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{statLabel}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom row: Radar + Report snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Radar */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', marginBottom: 20 }}>Wellbeing Radar</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(0,0,0,0.07)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--mid)' }} />
              <Radar dataKey="A" stroke="var(--deep-sage)" fill="var(--deep-sage)" fillOpacity={0.18} strokeWidth={2} dot={{ r: 4, fill: 'var(--deep-sage)' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Report snapshot */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem' }}>Latest Report</span>
            <Link to="/reports" style={{ fontSize: '0.78rem', color: 'var(--deep-sage)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {report ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Face Emotion',   val: report.face_emotion, highlight: EMOTION_COLORS[report.face_emotion] },
                { label: 'Face Ratio',     val: `${(report.face_ratio * 100).toFixed(0)}%` },
                { label: 'Voice Label',    val: report.voice_label, highlight: report.voice_label === 'STRESSED' ? 'var(--danger)' : 'var(--success)' },
                { label: 'Voice Conf',     val: `${(report.voice_conf * 100).toFixed(0)}%` },
                { label: 'Final Score',    val: report.final_score?.toFixed(2) },
                { label: 'Stress Level',   val: report.stress_level, highlight: report.stress_level === 'HIGH' ? 'var(--danger)' : 'var(--success)' },
              ].map(({ label, val, highlight }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 14px', background: 'var(--cream)', borderRadius: 10
                }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--mid)' }}>{label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: highlight || 'var(--charcoal)', textTransform: 'capitalize' }}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--light)', fontSize: '0.9rem' }}>
              No report yet — run a stress check first
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
