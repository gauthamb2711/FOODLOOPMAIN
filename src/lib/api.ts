import axios from 'axios';
import { 
  getData, setData, genId, User, FoodLog, SurplusItem, ChatMessage, initSeedData,
  getUserById, addNotification
} from './store';

// MASTER TOGGLE - Set to false to run fully in LocalStorage
export const USE_BACKEND = false;

/** Dev: proxied via Vite to backend (see vite.config). Prod: set VITE_API_URL or default API port. */
const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : 'http://localhost:5001/api');

/** Socket.IO origin: dev uses Vite proxy (same origin as UI); set VITE_API_URL when API is elsewhere. */
export function getSocketUrl(): string {
  if (!USE_BACKEND) return 'http://localhost:5000'; // Dummy for LS mode
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/api\/?$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://127.0.0.1:5001';
}

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
    } else if (typeof response.data === 'object' && response.data !== null) {
      response.data.id = response.data._id || response.data.id;
    }
  }
  return response;
}, (error) => {
  const status = error?.response?.status;
  if (status === 401) {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:logout'));
    }
  }
  return Promise.reject(error);
});

// Helper for Mock Promises
const mockRes = <T>(data: T): Promise<{ data: T }> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data }), 100);
  });
};

// ─── LOCAL STORAGE RE-IMPLEMENTATION ───

// Auth
export const loginUser = async (data: any) => {
  if (USE_BACKEND) return api.post('/auth/login', data);
  
  initSeedData();
  const users = getData<User[]>('users') || [];
  const user = users.find(u => (u.email === data.email || u.reg_no === data.email) && u.password === data.password);
  
  if (!user) throw { response: { status: 401, data: { message: 'Invalid email or password' } } };
  
  const token = 'mock-jwt-token-' + user.id;
  localStorage.setItem('token', token);
  return mockRes({ ...user, token });
};

export const registerUser = async (data: any) => {
  if (USE_BACKEND) return api.post('/auth/register', data);
  
  const users = getData<User[]>('users') || [];
  if (users.find(u => u.email === data.email)) {
    throw { response: { status: 400, data: { message: 'User already exists' } } };
  }
  
  const newUser: User = { ...data, id: genId(), status: 'approved' };
  users.push(newUser);
  setData('users', users);
  
  const token = 'mock-jwt-token-' + newUser.id;
  localStorage.setItem('token', token);
  return mockRes({ ...newUser, token });
};

export const getUsers = async () => {
  if (USE_BACKEND) return api.get('/auth/users');
  return mockRes(getData<User[]>('users') || []);
};

// Surplus
export const getSurplus = async () => {
  if (USE_BACKEND) return api.get('/surplus');
  return mockRes(getData<SurplusItem[]>('surplusFood') || []);
};

export const createSurplus = async (data: any) => {
  if (USE_BACKEND) return api.post('/surplus', data);
  
  const currentUser = getData<User>('currentUser');
  const items = getData<SurplusItem[]>('surplusFood') || [];
  
  // Calculate definitive Expiry ISO
  const now = new Date();
  const expiresAt = new Date(now);
  if (data.expiryTime) {
    const [h, m] = data.expiryTime.split(':');
    expiresAt.setHours(parseInt(h), parseInt(m), 0, 0);
    
    // If expiry time is earlier than NOW, it likely means tomorrow (e.g. at 10 PM setting expiry to 2 AM)
    if (expiresAt.getTime() <= now.getTime()) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    }
  } else {
    // Default to 6 hours from now if not set
    expiresAt.setHours(now.getHours() + 6);
  }

  const newItem: SurplusItem = {
    ...data,
    id: genId(),
    canteenId: currentUser?.id || 'unknown',
    canteenName: currentUser?.organization || 'Canteen',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    pickupCode: Math.floor(100000 + Math.random() * 900000).toString(),
    handoverStatus: 'pending',
    logs: [{ action: 'available', time: now.toISOString(), actor: 'Canteen' }]
  };
  
  items.push(newItem);
  setData('surplusFood', items);
  return mockRes(newItem);
};

export const updateSurplus = async (id: string, data: any) => {
  if (USE_BACKEND) return api.put(`/surplus/${id}`, data);
  
  const items = getData<SurplusItem[]>('surplusFood') || [];
  const idx = items.findIndex(s => s.id === id);
  if (idx === -1) throw new Error('Not found');
  
  const oldItem = items[idx];
  const updated = { ...oldItem, ...data };
  
  // Intelligent Mock Logics
  if (data.status === 'requested' && data.requestedBy) {
    const ngo = getUserById(data.requestedBy);
    if (ngo) {
      updated.requestedByName = ngo.organization;
      updated.contact = ngo.phone;
      addNotification(oldItem.canteenId, `NGO "${ngo.organization}" has requested your food!`, 'info');
    }
  }

  if (data.status === 'approved') {
    addNotification(oldItem.requestedBy || '', `Your request for "${oldItem.food}" was APPROVED!`, 'success');
  }

  if (data.status === 'completed') {
    updated.handoverStatus = 'accepted';
    updated.handoverTime = new Date().toISOString();
    updated.completedAt = new Date().toISOString();
    addNotification(oldItem.canteenId, `Pickup of "${oldItem.food}" completed by NGO.`, 'success');
  }
  
  // Handle log addition if actors are present
  if (data.action && data.actor) {
    if (!updated.logs) updated.logs = [];
    updated.logs.push({ action: data.action, time: new Date().toISOString(), actor: data.actor });
  }
  
  items[idx] = updated;
  setData('surplusFood', items);
  return mockRes(updated);
};

// Logs
export const getLogs = async () => {
  if (USE_BACKEND) return api.get('/logs');
  return mockRes(getData<FoodLog[]>('dailyLogs') || []);
};

export const createLog = async (data: any) => {
  if (USE_BACKEND) return api.post('/logs', data);
  
  const currentUser = getData<User>('currentUser');
  const logs = getData<FoodLog[]>('dailyLogs') || [];
  const newLog: FoodLog = {
    ...data,
    id: genId(),
    canteenId: currentUser?.id || 'unknown',
    createdAt: new Date().toISOString(),
    surplus: (data.foodPrepared || 0) - (data.foodConsumed || 0)
  };
  
  logs.push(newLog);
  setData('dailyLogs', logs);
  return mockRes(newLog);
};

// Chat
export const getChatHistory = async (partnerId: string) => {
  if (USE_BACKEND) return api.get(`/chat/${partnerId}`);
  
  const currentUser = getData<User>('currentUser');
  if (!currentUser) return mockRes([]);
  
  const allMessages = getData<ChatMessage[]>('chatMessages') || [];
  const filtered = allMessages.filter(m => 
    (m.senderId === currentUser.id && m.receiverId === partnerId) ||
    (m.senderId === partnerId && m.receiverId === currentUser.id)
  ).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  
  return mockRes(filtered);
};

export const sendChatMessage = async (data: any) => {
  if (USE_BACKEND) return api.post('/chat', data);
  
  const currentUser = getData<User>('currentUser');
  if (!currentUser) throw new Error('Not logged in');
  
  const allMessages = getData<ChatMessage[]>('chatMessages') || [];
  const newMessage: ChatMessage = {
    id: genId(),
    senderId: currentUser.id,
    receiverId: data.receiverId,
    text: data.text,
    timestamp: new Date().toISOString(),
    read: false
  };
  
  allMessages.push(newMessage);
  setData('chatMessages', allMessages);
  return mockRes(newMessage);
};

// AI
export const fetchPredictions = async (prompt: string) => {
  if (USE_BACKEND) return api.post('/ai/predict', { prompt });
  return mockRes({ text: "Based on LocalStorage trends, footfall is stable." });
};

export default api;
