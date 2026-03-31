// Centralized LocalStorage State Engine

export function getData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setData<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('store-update', { detail: { key } }));
}

export function useStoreListener(keys: string[], callback: () => void) {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (keys.includes(detail.key)) callback();
  };
  window.addEventListener('store-update', handler);
  return () => window.removeEventListener('store-update', handler);
}

// Types
export interface User {
  id: string;
  name: string;
  email?: string; // Optional for NGO if they only use reg_no, but we keep it here
  password?: string;
  role: 'canteen' | 'ngo';
  organization: string;
  location?: string;
  capacity?: number;
  reg_no?: string;
  ngoType?: string;
  phone?: string;
  address?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface FoodLog {
  id: string;
  canteenId: string;
  date: string;
  menuItems: string;
  studentFootfall: number;
  foodPrepared: number;
  foodConsumed: number;
  surplus: number;
  createdAt: string;
}

export interface SurplusItem {
  id: string;
  canteenId: string;
  canteenName: string;
  food: string;
  quantity: number;
  preparedTime: string;
  expiryTime: string;
  location: string;
  lat?: number;
  lng?: number;
  status: 'available' | 'requested' | 'approved' | 'on_the_way' | 'handover_pending' | 'completed' | 'expired';
  requestedBy?: string; // ngoId
  requestedByName?: string; // ngoName
  contact?: string;
  pickupTime?: string;
  completedAt?: string;
  createdAt: string;

  // Digital Handover Fields
  pickupCode: string;
  handoverStatus: 'pending' | 'accepted';
  handoverTime?: string;
  handoverLocation?: { lat: number; lng: number };
  conditionAtPickup?: 'good' | 'acceptable' | 'poor';
  logs: Array<{
    action: string;
    time: string;
    actor: string;
  }>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface AppNotification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  read: boolean;
  createdAt: string;
}

// ID generator
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function genPickupCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Global Notification Helper
export function addNotification(userId: string, message: string, type: 'info' | 'warning' | 'success' = 'info') {
  const all = getData<AppNotification[]>('notifications') || [];
  all.push({
    id: genId(),
    userId,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  });
  setData('notifications', all);
}

export function getNotifications(userId: string) {
  const all = getData<AppNotification[]>('notifications') || [];
  return all.filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function markNotificationRead(id: string) {
  const all = getData<AppNotification[]>('notifications') || [];
  const idx = all.findIndex(n => n.id === id);
  if (idx !== -1) {
    all[idx].read = true;
    setData('notifications', all);
  }
}

export function clearNotifications(userId: string) {
  const all = getData<AppNotification[]>('notifications') || [];
  const remaining = all.filter(n => n.userId !== userId);
  setData('notifications', remaining);
}

// Initialize seed data
export function initSeedData() {
  if (getData('initialized_v4')) return;

  const canteen: User = {
    id: 'canteen-1',
    name: 'Rajesh Kumar',
    email: 'canteen@demo.com',
    password: 'demo123',
    role: 'canteen',
    organization: 'Central Kitchen Campus A',
    location: 'Mumbai Central',
  };

  const ngo: User = {
    id: 'ngo-1',
    name: 'Priya Sharma',
    email: 'ngo@demo.com',
    password: 'demo123',
    role: 'ngo',
    organization: 'FeedForward Foundation',
    location: 'Mumbai South',
    address: 'Mumbai South',
    capacity: 200,
    reg_no: 'NGO123',
    ngoType: 'Trust',
    phone: '9876543210',
    status: 'approved',
  };

  const today = new Date();
  const logs: FoodLog[] = [
    {
      id: genId(),
      canteenId: 'canteen-1',
      date: new Date(today.getTime() - 86400000 * 2).toISOString().split('T')[0],
      menuItems: 'Rice, Dal, Sabzi, Roti',
      studentFootfall: 275,
      foodPrepared: 150,
      foodConsumed: 130,
      surplus: 20,
      createdAt: new Date(today.getTime() - 86400000 * 2).toISOString(),
    },
    {
      id: genId(),
      canteenId: 'canteen-1',
      date: new Date(today.getTime() - 86400000).toISOString().split('T')[0],
      menuItems: 'Biryani, Raita, Salad',
      studentFootfall: 320,
      foodPrepared: 175,
      foodConsumed: 150,
      surplus: 25,
      createdAt: new Date(today.getTime() - 86400000).toISOString(),
    },
  ];

  const surplus: SurplusItem[] = [
    {
      id: genId(),
      canteenId: 'canteen-1',
      canteenName: 'Central Kitchen Campus A',
      food: 'Biryani, Raita, Salad',
      quantity: 25,
      preparedTime: '12:00',
      expiryTime: '18:00',
      status: 'available',
      location: 'Mumbai Central',
      lat: 18.9733, lng: 72.8273, // Mumbai Central
      createdAt: new Date(today.getTime() - 86400000).toISOString(),
      pickupCode: '123456',
      handoverStatus: 'pending',
      logs: [
        { action: 'available', time: new Date(today.getTime() - 86400000).toISOString(), actor: 'Canteen' }
      ]
    },
    {
      id: genId(),
      canteenId: 'canteen-1',
      canteenName: 'Central Kitchen Campus A',
      food: 'Rice, Dal, Sabzi',
      quantity: 15,
      preparedTime: '13:30',
      expiryTime: '20:30',
      status: 'available',
      location: 'Dadar, Mumbai',
      lat: 19.0178, lng: 72.8478, // Dadar
      createdAt: new Date(today.getTime() - 3600000 * 2).toISOString(),
      pickupCode: '654321',
      handoverStatus: 'pending',
      logs: [
        { action: 'available', time: new Date(today.getTime() - 3600000 * 2).toISOString(), actor: 'Canteen' }
      ]
    },
  ];

  const initialMessages: ChatMessage[] = [
    {
      id: genId(),
      senderId: 'canteen-1',
      receiverId: 'ngo-1',
      text: 'Hello! Welcome to FoodLoop sync. We have some surplus food today.',
      timestamp: new Date(today.getTime() - 3600000).toISOString(),
      read: true,
    }
  ];

  setData('users', [canteen, ngo]);
  setData('dailyLogs', logs);
  setData('surplusFood', surplus);
  setData('chatMessages', initialMessages);
  setData('initialized_v4', true);
}

// Derived computations
export function getMetrics(logs: FoodLog[] = [], surplus: SurplusItem[] = [], users: User[] = []) {
  const completedSurplus = surplus.filter(s => s.status === 'completed');
  const totalFoodSaved = completedSurplus.reduce((sum, s) => sum + s.quantity, 0);

  const mealsRedistributed = Math.floor(totalFoodSaved / 0.5);

  const activeCanteens = users.filter(u => u.role === 'canteen').length || 24;
  const ngosConnected = users.filter(u => u.role === 'ngo').length || 12;

  const totalPrepared = logs.reduce((s, l) => s + l.foodPrepared, 0);
  const totalConsumed = logs.reduce((s, l) => s + l.foodConsumed, 0);
  const wasteReduction = totalPrepared > 0
    ? Math.round(((totalFoodSaved) / (totalPrepared - totalConsumed + 0.01)) * 100)
    : 0;

  return {
    totalFoodSaved,
    mealsRedistributed,
    activeCanteens,
    ngosConnected,
    wasteReduction: Math.min(wasteReduction, 100),
    totalSurplus: logs.reduce((s, l) => s + (l.surplus || 0), 0),
  };
}

// Chat helpers
export function getChatPartners(userId: string) {
  const messages = getData<ChatMessage[]>('chatMessages') || [];
  const users = getData<User[]>('users') || [];
  
  const partnerIds = new Set<string>();
  messages.forEach(m => {
    if (m.senderId === userId) partnerIds.add(m.receiverId);
    if (m.receiverId === userId) partnerIds.add(m.senderId);
  });
  
  return users.filter(u => partnerIds.has(u.id));
}

export function getMessagesBetween(u1: string, u2: string) {
  const messages = getData<ChatMessage[]>('chatMessages') || [];
  return messages.filter(m => 
    (m.senderId === u1 && m.receiverId === u2) ||
    (m.senderId === u2 && m.receiverId === u1)
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Prediction engine
export function predictFootfall(canteenId: string, allLogs: FoodLog[] = []): { predicted: number; trend: string } {
  const logs = allLogs
    .filter(l => l.canteenId === canteenId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  if (logs.length === 0) return { predicted: 300, trend: 'stable' };

  const avg = logs.reduce((s, l) => s + l.studentFootfall, 0) / logs.length;

  if (logs.length >= 2) {
    const recent = logs.slice(0, Math.ceil(logs.length / 2));
    const older = logs.slice(Math.ceil(logs.length / 2));
    const recentAvg = recent.reduce((s, l) => s + l.studentFootfall, 0) / recent.length;
    const olderAvg = older.reduce((s, l) => s + l.studentFootfall, 0) / older.length;
    const trend = recentAvg > olderAvg ? 'increasing' : recentAvg < olderAvg ? 'decreasing' : 'stable';
    const trendFactor = trend === 'increasing' ? 1.05 : trend === 'decreasing' ? 0.95 : 1;
    return { predicted: Math.round(avg * trendFactor), trend };
  }

  return { predicted: Math.round(avg), trend: 'stable' };
}

export function predictFoodQuantity(canteenId: string, allLogs: FoodLog[] = []): number {
  const logs = allLogs.filter(l => l.canteenId === canteenId);
  if (logs.length === 0) return 150;

  const avgConsumptionPerPerson =
    logs.reduce((s, l) => s + l.foodConsumed / (l.studentFootfall || 1), 0) / logs.length;

  const { predicted } = predictFootfall(canteenId, allLogs);
  return Math.round(predicted * avgConsumptionPerPerson);
}

export function getRecommendations(canteenId: string, allLogs: FoodLog[] = []) {
  const logs = allLogs.filter(l => l.canteenId === canteenId);
  const recs: string[] = [];

  if (logs.length >= 2) {
    const avgSurplus = logs.reduce((s, l) => s + (l.surplus || 0), 0) / logs.length;
    const optimalPrep = predictFoodQuantity(canteenId, allLogs);
    recs.push(`Optimal food preparation: ~${optimalPrep} kg based on trends`);

    if (avgSurplus > 15) {
      recs.push(`High avg surplus (${avgSurplus.toFixed(1)} kg). Reduce prep by ${Math.round(avgSurplus * 0.7)} kg`);
    }

    const dayMap: Record<string, number[]> = {};
    logs.forEach(l => {
      const day = new Date(l.date).toLocaleDateString('en', { weekday: 'long' });
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(l.surplus || 0);
    });

    let worstDay = '';
    let worstAvg = 0;
    Object.entries(dayMap).forEach(([day, surpluses]) => {
      const avg = surpluses.reduce((a, b) => a + b, 0) / surpluses.length;
      if (avg > worstAvg) { worstDay = day; worstAvg = avg; }
    });

    if (worstDay) recs.push(`${worstDay} tends to have highest waste (${worstAvg.toFixed(1)} kg avg)`);
  }

  const ngos = (getData<User[]>('users') || []).filter(u => u.role === 'ngo');
  if (ngos.length > 0) {
    recs.push(`Active NGOs ready to take surplus food: ${ngos.length}`);
  }

  if (recs.length === 0) recs.push('Add more daily logs to generate smart recommendations');

  return recs;
}
