import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

export const analyzeFace     = (imageBase64) => api.post('/api/analyze/face',     { image: imageBase64 }).then(r => r.data);
export const analyzeVoice    = (audioBase64) => api.post('/api/analyze/voice',    { audio: audioBase64 }).then(r => r.data);
export const analyzeCombined = (payload)     => api.post('/api/analyze/combined', payload).then(r => r.data);
export const sendChat        = (message, history = []) => api.post('/api/chat',   { message, history }).then(r => r.data);
export const getLatestReport = ()            => api.get('/api/report').then(r => r.data);
export const getReportHistory= ()            => api.get('/api/report/history').then(r => r.data);
export const getHealth       = ()            => api.get('/api/health').then(r => r.data);

export default api;
