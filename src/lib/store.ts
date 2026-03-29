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
  email: string;
  password: string;
  role: 'canteen' | 'ngo';
  organization: string;
  location: string;
  capacity?: number;
}

export interface FoodLog {
  id: string;
  canteenId: string;
  date: string;
  menuItems: string;
  expectedFootfall: number;
  actualFootfall: number;
  foodPrepared: number;
  foodConsumed: number;
  surplus: number;
  createdAt: string;
}

export interface SurplusItem {
  id: string;
  canteenId: string;
  canteenName: string;
  date: string;
  foodType: string;
  quantity: number;
  status: 'available' | 'assigned' | 'delivered';
  location: string;
  createdAt: string;
}

export interface Delivery {
  deliveryId: string;
  surplusId: string;
  ngoId: string;
  ngoName: string;
  canteenId: string;
  canteenName: string;
  foodType: string;
  quantity: number;
  status: 'requested' | 'approved' | 'intransit' | 'delivered';
  timestamps: {
    requested?: string;
    approved?: string;
    intransit?: string;
    delivered?: string;
  };
}

// ID generator
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Initialize seed data
export function initSeedData() {
  if (getData('initialized')) return;

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
    capacity: 200,
  };

  const today = new Date();
  const logs: FoodLog[] = [
    {
      id: genId(),
      canteenId: 'canteen-1',
      date: new Date(today.getTime() - 86400000 * 2).toISOString().split('T')[0],
      menuItems: 'Rice, Dal, Sabzi, Roti',
      expectedFootfall: 300,
      actualFootfall: 275,
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
      expectedFootfall: 350,
      actualFootfall: 320,
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
      date: new Date(today.getTime() - 86400000).toISOString().split('T')[0],
      foodType: 'Biryani, Raita, Salad',
      quantity: 25,
      status: 'available',
      location: 'Mumbai Central',
      createdAt: new Date(today.getTime() - 86400000).toISOString(),
    },
  ];

  setData('users', [canteen, ngo]);
  setData('foodLogs', logs);
  setData('surplusItems', surplus);
  setData('deliveries', []);
  setData('initialized', true);
}

// Derived computations
export function getMetrics() {
  const logs = getData<FoodLog[]>('foodLogs') || [];
  const deliveries = getData<Delivery[]>('deliveries') || [];
  const users = getData<User[]>('users') || [];
  const surplus = getData<SurplusItem[]>('surplusItems') || [];

  const totalFoodSaved = deliveries
    .filter(d => d.status === 'delivered')
    .reduce((sum, d) => sum + d.quantity, 0) +
    surplus.filter(s => s.status === 'available').reduce((sum, s) => sum + s.quantity, 0);

  const mealsRedistributed = Math.floor(
    deliveries.filter(d => d.status === 'delivered').reduce((sum, d) => sum + d.quantity, 0) / 0.5
  );

  const activeCanteens = users.filter(u => u.role === 'canteen').length;
  const ngosConnected = users.filter(u => u.role === 'ngo').length;

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
    totalSurplus: logs.reduce((s, l) => s + l.surplus, 0),
  };
}

// Prediction engine
export function predictFootfall(canteenId: string): { predicted: number; trend: string } {
  const logs = getData<FoodLog[]>('foodLogs') || [];
  const canteenLogs = logs
    .filter(l => l.canteenId === canteenId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  if (canteenLogs.length === 0) return { predicted: 300, trend: 'stable' };

  const avg = canteenLogs.reduce((s, l) => s + l.actualFootfall, 0) / canteenLogs.length;

  if (canteenLogs.length >= 2) {
    const recent = canteenLogs.slice(0, Math.ceil(canteenLogs.length / 2));
    const older = canteenLogs.slice(Math.ceil(canteenLogs.length / 2));
    const recentAvg = recent.reduce((s, l) => s + l.actualFootfall, 0) / recent.length;
    const olderAvg = older.reduce((s, l) => s + l.actualFootfall, 0) / older.length;
    const trend = recentAvg > olderAvg ? 'increasing' : recentAvg < olderAvg ? 'decreasing' : 'stable';
    const trendFactor = trend === 'increasing' ? 1.05 : trend === 'decreasing' ? 0.95 : 1;
    return { predicted: Math.round(avg * trendFactor), trend };
  }

  return { predicted: Math.round(avg), trend: 'stable' };
}

export function predictFoodQuantity(canteenId: string): number {
  const logs = getData<FoodLog[]>('foodLogs') || [];
  const canteenLogs = logs.filter(l => l.canteenId === canteenId);
  if (canteenLogs.length === 0) return 150;

  const avgConsumptionPerPerson =
    canteenLogs.reduce((s, l) => s + l.foodConsumed / (l.actualFootfall || 1), 0) / canteenLogs.length;

  const { predicted } = predictFootfall(canteenId);
  return Math.round(predicted * avgConsumptionPerPerson);
}

export function getRecommendations(canteenId: string) {
  const logs = getData<FoodLog[]>('foodLogs') || [];
  const canteenLogs = logs.filter(l => l.canteenId === canteenId);
  const recs: string[] = [];

  if (canteenLogs.length >= 2) {
    const avgSurplus = canteenLogs.reduce((s, l) => s + l.surplus, 0) / canteenLogs.length;
    const optimalPrep = predictFoodQuantity(canteenId);
    recs.push(`Optimal food preparation: ~${optimalPrep} kg based on trends`);

    if (avgSurplus > 15) {
      recs.push(`High avg surplus (${avgSurplus.toFixed(1)} kg). Reduce prep by ${Math.round(avgSurplus * 0.7)} kg`);
    }

    const dayMap: Record<string, number[]> = {};
    canteenLogs.forEach(l => {
      const day = new Date(l.date).toLocaleDateString('en', { weekday: 'long' });
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(l.surplus);
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
    const deliveries = getData<Delivery[]>('deliveries') || [];
    const ngoStats = ngos.map(n => ({
      ...n,
      completed: deliveries.filter(d => d.ngoId === n.id && d.status === 'delivered').length,
    }));
    ngoStats.sort((a, b) => b.completed - a.completed);
    recs.push(`Prioritize NGO: ${ngoStats[0].organization} (${ngoStats[0].completed} deliveries completed)`);
  }

  if (recs.length === 0) recs.push('Add more daily logs to generate smart recommendations');

  return recs;
}
