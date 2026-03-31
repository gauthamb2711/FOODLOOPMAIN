import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatically map MongoDB's _id to id for the frontend TS interfaces
api.interceptors.response.use((response) => {
  if (response.data) {
    if (Array.isArray(response.data)) {
      response.data = response.data.map(item => ({ ...item, id: item._id || item.id }));
    } else if (typeof response.data === 'object') {
      response.data.id = response.data._id || response.data.id;
    }
  }
  return response;
});

// Auth
export const loginUser = (data: any) => api.post('/auth/login', data);
export const registerUser = (data: any) => api.post('/auth/register', data);
export const getUsers = () => api.get('/auth/users');

// Surplus
export const getSurplus = () => api.get('/surplus');
export const createSurplus = (data: any) => api.post('/surplus', data);
export const updateSurplus = (id: string, data: any) => api.put(`/surplus/${id}`, data);

// Logs
export const getLogs = () => api.get('/logs');
export const createLog = (data: any) => api.post('/logs', data);

// Chat
export const getChatHistory = (partnerId: string) => api.get(`/chat/${partnerId}`);
export const sendChatMessage = (data: any) => api.post('/chat', data);

// AI
export const fetchPredictions = (prompt: string) => api.post('/ai/predict', { prompt });

export default api;
