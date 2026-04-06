import React from 'react';

export default function StressGauge({ score = 0, level = 'NORMAL', size = 180 }) {
  const R      = (size / 2) - 14;
  const circ   = 2 * Math.PI * R;
  const pct    = Math.min(score, 1);
  const offset = circ - pct * circ;
  const color  = level === 'HIGH' ? 'var(--danger)' : score > 0.35 ? 'var(--amber)' : 'var(--sage)';

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={10} />
        <circle
          cx={size/2} cy={size/2} r={R}
          fill="none" stroke={color} strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.5s' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: size * 0.18, fontWeight: 300, color: 'var(--charcoal)', lineHeight: 1 }}>
          {Math.round(pct * 100)}%
        </div>
        <div style={{ fontSize: size * 0.07, color: 'var(--light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
          Stress
        </div>
        <div style={{ marginTop: 6, padding: '2px 10px', borderRadius: 100, fontSize: size * 0.07, fontWeight: 600, background: level === 'HIGH' ? 'rgba(196,85,74,0.12)' : 'rgba(74,154,71,0.12)', color: level === 'HIGH' ? 'var(--danger)' : 'var(--success)' }}>
          {level}
        </div>
      </div>
    </div>
  );
}
