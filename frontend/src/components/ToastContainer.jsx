import React from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  const icons = { success: <CheckCircle size={16} />, error: <AlertCircle size={16} />, info: <Info size={16} /> };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {icons[t.type]}
          {t.message}
        </div>
      ))}
    </div>
  );
}
