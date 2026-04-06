import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar        from './components/Sidebar';
import ToastContainer from './components/ToastContainer';
import { useToast }   from './hooks/useToast';
import { getHealth }  from './utils/api';

import Dashboard    from './pages/Dashboard';
import FaceAnalysis from './pages/FaceAnalysis';
import VoiceAnalysis from './pages/VoiceAnalysis';
import Chatbot      from './pages/Chatbot';
import Reports      from './pages/Reports';
import Analytics    from './pages/Analytics';

export default function App() {
  const { toasts, addToast } = useToast();
  const [systemOnline, setSystemOnline] = useState(false);

  useEffect(() => {
    const check = () =>
      getHealth()
        .then(() => setSystemOnline(true))
        .catch(() => setSystemOnline(false));

    check();
    const iv = setInterval(check, 15000);
    return () => clearInterval(iv);
  }, []);

  return (
    <BrowserRouter>
      <div className="noise" style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar systemOnline={systemOnline} />
        <main style={{ marginLeft: 'var(--sidebar-w)', flex: 1, minHeight: '100vh', background: 'var(--cream)', overflowY: 'auto' }}>
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/face"      element={<FaceAnalysis  addToast={addToast} />} />
            <Route path="/voice"     element={<VoiceAnalysis addToast={addToast} />} />
            <Route path="/chatbot"   element={<Chatbot       addToast={addToast} />} />
            <Route path="/reports"   element={<Reports       addToast={addToast} />} />
            <Route path="/analytics" element={<Analytics     addToast={addToast} />} />
          </Routes>
        </main>
        <ToastContainer toasts={toasts} />
      </div>
    </BrowserRouter>
  );
}
