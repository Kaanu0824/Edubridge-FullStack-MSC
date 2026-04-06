import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Camera, Mic, MessageCircle, FileText, BarChart2, Leaf } from 'lucide-react';

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/face',      icon: Camera,          label: 'Face Analysis' },
  { to: '/voice',     icon: Mic,             label: 'Voice Analysis'},
  { to: '/chatbot',   icon: MessageCircle,   label: 'Chatbot'       },
  { to: '/reports',   icon: FileText,        label: 'Reports'       },
  { to: '/analytics', icon: BarChart2,       label: 'Analytics'     },
];

export default function Sidebar({ systemOnline }) {
  return (
    <aside style={{
      width: 'var(--sidebar-w)', minHeight: '100vh',
      background: '#2C2C2C', display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 200,
    }}>
      {/* Logo */}
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--deep-sage)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Leaf size={18} color="var(--cream)" />
          </div>
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.15rem', color: 'var(--cream)', fontWeight: 400 }}>
              Edu<span style={{ color: 'var(--terracotta)', fontStyle: 'italic' }}>Bridge</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Wellbeing AI
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: systemOnline ? 'rgba(74,154,71,0.12)' : 'rgba(196,85,74,0.12)',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: systemOnline ? '#4A9A47' : 'var(--danger)', animation: 'pulseDot 2s infinite' }} />
          <span style={{ fontSize: '0.75rem', color: systemOnline ? '#7acc77' : '#e07070', fontWeight: 500 }}>
            {systemOnline ? 'System Online' : 'Connecting…'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 12px' }}>
        <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 12px 6px' }}>
          Menu
        </div>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px', borderRadius: 12,
              textDecoration: 'none', marginBottom: 3,
              color: isActive ? 'var(--cream)' : 'rgba(255,255,255,0.45)',
              background: isActive ? 'rgba(139,168,136,0.2)' : 'transparent',
              fontWeight: isActive ? 500 : 400,
              fontSize: '0.875rem', transition: 'all 0.2s',
              borderLeft: isActive ? '2px solid var(--sage)' : '2px solid transparent',
            })}
          >
            <Icon size={17} />{label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', lineHeight: 1.5 }}>
          EduBridge v1.0<br />University Research Project
        </div>
      </div>
    </aside>
  );
}
