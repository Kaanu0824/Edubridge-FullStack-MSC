import React, { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw, Bot, User, Info, Zap } from 'lucide-react';
import { sendChat } from '../utils/api';

const QUICK_CHIPS = [
  { label: '😟 I feel stressed',       msg: 'I feel stressed and overwhelmed' },
  { label: '📚 Study tips',            msg: 'How can I study better and focus?' },
  { label: '😔 Lost motivation',       msg: "I want to give up, I'm not motivated" },
  { label: '💙 I feel lonely',         msg: 'I feel lonely and isolated' },
  { label: '😰 Exam anxiety',          msg: "I'm really anxious about my exams" },
  { label: '💤 Exhausted',             msg: "I'm exhausted and can't keep up" },
  { label: '⏰ Procrastinating',       msg: "I keep procrastinating and can't manage my time" },
  { label: '😴 Can\'t sleep',          msg: "I can't sleep because of stress" },
  { label: '📝 Assignment help',       msg: "I don't know how to start my assignment" },
];

const INTENT_COLORS = {
  greeting:           'var(--sage)',
  stress:             'var(--danger)',
  anxiety:            '#9B6BA8',
  study_tips:         'var(--amber)',
  time_management:    'var(--terracotta)',
  motivation:         '#D4A843',
  lonely:             '#7BA8C4',
  sleep:              '#6BA8A8',
  mental_health:      '#C4554A',
  exam_preparation:   'var(--deep-sage)',
  assignment_help:    '#8BA888',
  self_care:          '#C4A87B',
  positive_affirmation: 'var(--success)',
  goodbye:            'var(--mist)',
};

const INTENT_LIST = [
  { tag: 'greeting',            emoji: '👋', label: 'Greeting',             desc: 'Hello, hi, good morning'         },
  { tag: 'stress',              emoji: '😟', label: 'Stress',               desc: 'Overwhelmed, burning out'        },
  { tag: 'anxiety',             emoji: '😰', label: 'Anxiety',              desc: 'Exam nerves, fear of failing'    },
  { tag: 'study_tips',          emoji: '📚', label: 'Study Tips',           desc: 'Focus, revision, memory'         },
  { tag: 'time_management',     emoji: '⏰', label: 'Time Management',      desc: 'Procrastination, deadlines'      },
  { tag: 'motivation',          emoji: '💪', label: 'Motivation',           desc: 'Give up, tired, hopeless'        },
  { tag: 'lonely',              emoji: '💙', label: 'Loneliness',           desc: 'Isolated, homesick'              },
  { tag: 'sleep',               emoji: '😴', label: 'Sleep',                desc: 'Insomnia, all-nighters'          },
  { tag: 'mental_health',       emoji: '🧠', label: 'Mental Health',        desc: 'Feeling low, need support'       },
  { tag: 'exam_preparation',    emoji: '📝', label: 'Exam Prep',            desc: 'Revision strategy, tips'         },
  { tag: 'assignment_help',     emoji: '✏️', label: 'Assignment Help',      desc: 'Essay, referencing, structure'   },
  { tag: 'self_care',           emoji: '🌿', label: 'Self Care',            desc: 'Eating, exercise, balance'       },
  { tag: 'positive_affirmation',emoji: '🎉', label: 'Positive',             desc: 'I did well, feeling good'        },
  { tag: 'goodbye',             emoji: '👋', label: 'Goodbye',              desc: 'Bye, thanks, see you'            },
];

function Message({ msg }) {
  const isBot = msg.role === 'bot';
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: isBot ? 'flex-start' : 'flex-end', alignItems: 'flex-end' }}>
      {isBot && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--deep-sage)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={16} color="var(--cream)" />
        </div>
      )}
      <div style={{ maxWidth: '72%' }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: isBot ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
          background: isBot ? 'var(--warm-white)' : 'var(--deep-sage)',
          color: isBot ? 'var(--charcoal)' : 'var(--cream)',
          fontSize: '0.9rem', lineHeight: 1.55,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          border: isBot ? '1px solid rgba(139,168,136,0.12)' : 'none',
          animation: 'msgPop 0.25s ease',
        }}>
          {msg.text}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, justifyContent: isBot ? 'flex-start' : 'flex-end' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--light)' }}>{msg.time}</span>
          {msg.tag && (
            <span style={{
              fontSize: '0.62rem', padding: '2px 8px', borderRadius: 100,
              background: `${INTENT_COLORS[msg.tag] || 'var(--mist)'}20`,
              color: INTENT_COLORS[msg.tag] || 'var(--mid)',
              fontWeight: 500, textTransform: 'capitalize',
            }}>
              {msg.tag.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>
      {!isBot && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(139,168,136,0.2)' }}>
          <User size={16} color="var(--mid)" />
        </div>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--deep-sage)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Bot size={16} color="var(--cream)" />
      </div>
      <div style={{ padding: '12px 18px', borderRadius: '18px 18px 18px 4px', background: 'var(--warm-white)', border: '1px solid rgba(139,168,136,0.12)', display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 0.15, 0.3].map(delay => (
          <div key={delay} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--light)', animation: `typingDot 1.2s ease ${delay}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

export default function Chatbot({ addToast }) {
  const [messages, setMessages] = useState([{
    role: 'bot',
    text: "Hi, I'm here with you 🌿 What's going on today? You can talk to me about anything — stress, studies, motivation, sleep, exams, or just how you're feeling.",
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    tag: null,
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [scores,  setScores]  = useState({});
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg, time: now(), tag: null }]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.text }));
      const data    = await sendChat(msg, history);
      setScores(data.scores || {});
      setTimeout(() => {
        setMessages(m => [...m, { role: 'bot', text: data.response, time: now(), tag: data.tag }]);
        setLoading(false);
      }, 600 + Math.random() * 400);
    } catch {
      setTimeout(() => {
        setMessages(m => [...m, { role: 'bot', text: "I'm here with you. Can you tell me a bit more about how you're feeling?", time: now(), tag: null }]);
        setLoading(false);
      }, 800);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'bot', text: "Hi again 🌿 How are you feeling right now?", time: now(), tag: null }]);
    setScores({});
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="section-eyebrow">NLP Support</div>
        <h1 className="section-title">Support <em>Chatbot</em></h1>
        <p style={{ color: 'var(--mid)', fontSize: '0.92rem', marginTop: 6 }}>
          Intent classification via Logistic Regression · 14 intent categories · Empathetic responses
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        {/* Chat window */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: 640 }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', background: 'var(--deep-sage)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(245,240,232,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🌿
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--cream)', fontFamily: 'Fraunces, serif', fontSize: '1rem' }}>EduBridge Bot</div>
              <div style={{ color: 'rgba(245,240,232,0.6)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7CCC7C', animation: 'pulseDot 2s infinite' }} />
                Online · 14 topics · Ready to help
              </div>
            </div>
            <button className="btn btn-sm" onClick={clearChat} style={{ background: 'rgba(245,240,232,0.12)', color: 'rgba(245,240,232,0.7)', border: 'none', borderRadius: 8 }}>
              <RefreshCw size={13} /> Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((m, i) => <Message key={i} msg={m} />)}
            {loading && <TypingBubble />}
            <div ref={bottomRef} />
          </div>

          {/* Quick chips */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {QUICK_CHIPS.map(c => (
              <button key={c.msg} onClick={() => send(c.msg)} disabled={loading}
                style={{ padding: '5px 12px', borderRadius: 100, fontSize: '0.72rem', border: '1px solid rgba(139,168,136,0.25)', background: 'transparent', color: 'var(--deep-sage)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--deep-sage)'; e.currentTarget.style.color = 'var(--cream)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--deep-sage)'; }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              className="input-field" style={{ flex: 1 }}
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type a message…" disabled={loading}
            />
            <button className="btn btn-primary" style={{ padding: '11px 14px', borderRadius: '50%', flexShrink: 0 }}
              onClick={() => send()} disabled={!input.trim() || loading}>
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: 640 }}>
          {/* Intent scores */}
          {Object.keys(scores).length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.9rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={14} color="var(--amber)" /> Intent Scores
              </div>
              {Object.entries(scores).sort(([,a],[,b]) => b - a).slice(0, 6).map(([intent, score]) => (
                <div key={intent} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--mid)', textTransform: 'capitalize' }}>{intent.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '0.73rem', fontWeight: 500, color: INTENT_COLORS[intent] || 'var(--mid)' }}>{(score * 100).toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 4 }}>
                    <div className="progress-fill" style={{ width: `${score * 100}%`, background: INTENT_COLORS[intent] || 'var(--sage)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Intent categories */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: '0.9rem', marginBottom: 14 }}>14 Intent Categories</div>
            {INTENT_LIST.map(({ tag, emoji, label, desc }) => (
              <div key={tag} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{emoji}</span>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--charcoal)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {label}
                    <span style={{ padding: '1px 6px', borderRadius: 100, fontSize: '0.6rem', background: `${INTENT_COLORS[tag] || 'var(--mist)'}20`, color: INTENT_COLORS[tag] || 'var(--mid)' }}>
                      {tag}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--light)', marginTop: 1 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={15} color="var(--sage)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--mid)', lineHeight: 1.6 }}>
              Uses <strong>TF-IDF vectorisation</strong> + <strong>Logistic Regression</strong> trained on 169 student conversation patterns across 14 intent categories.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes msgPop { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes typingDot { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-5px); opacity: 1; } }
      `}</style>
    </div>
  );
}
