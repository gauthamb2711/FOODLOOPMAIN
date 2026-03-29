import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import {
  getData, setData, genId, FoodLog, SurplusItem, Delivery,
  predictFootfall, predictFoodQuantity, getMetrics, getRecommendations
} from '@/lib/store';
import { toast } from 'sonner';
import {
  Leaf, LogOut, BarChart3, Plus, TrendingUp, TrendingDown, Minus, Package,
  Brain, Lightbulb, Calendar, Users, Utensils, AlertTriangle, CheckCircle2, Truck
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

const SURPLUS_THRESHOLD = 10;

export default function CanteenDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'input' | 'predictions' | 'surplus' | 'analytics' | 'recommendations'>('overview');
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [surplus, setSurplus] = useState<SurplusItem[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], menuItems: '', expectedFootfall: '', actualFootfall: '', foodPrepared: '', foodConsumed: '' });

  const refresh = useCallback(() => {
    if (!user) return;
    setLogs((getData<FoodLog[]>('foodLogs') || []).filter(l => l.canteenId === user.id));
    setSurplus((getData<SurplusItem[]>('surplusItems') || []).filter(s => s.canteenId === user.id));
    setDeliveries(getData<Delivery[]>('deliveries') || []);
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'canteen') { navigate('/login'); return; }
    refresh();
    const unsub = () => { };
    const handler = () => refresh();
    window.addEventListener('store-update', handler);
    return () => window.removeEventListener('store-update', handler);
  }, [user, navigate, refresh]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const prepared = Number(form.foodPrepared);
    const consumed = Number(form.foodConsumed);
    const surplusQty = prepared - consumed;

    const log: FoodLog = {
      id: genId(), canteenId: user.id, date: form.date, menuItems: form.menuItems,
      expectedFootfall: Number(form.expectedFootfall), actualFootfall: Number(form.actualFootfall),
      foodPrepared: prepared, foodConsumed: consumed, surplus: surplusQty,
      createdAt: new Date().toISOString(),
    };

    const allLogs = getData<FoodLog[]>('foodLogs') || [];
    allLogs.push(log);
    setData('foodLogs', allLogs);

    if (surplusQty > SURPLUS_THRESHOLD) {
      const item: SurplusItem = {
        id: genId(), canteenId: user.id, canteenName: user.organization, date: form.date,
        foodType: form.menuItems, quantity: surplusQty, status: 'available',
        location: user.location, createdAt: new Date().toISOString(),
      };
      const allSurplus = getData<SurplusItem[]>('surplusItems') || [];
      allSurplus.push(item);
      setData('surplusItems', allSurplus);
      toast.warning(`⚠️ ${surplusQty} kg surplus detected! Listed for redistribution.`);
    } else {
      toast.success('Daily log recorded successfully!');
    }

    setForm({ date: new Date().toISOString().split('T')[0], menuItems: '', expectedFootfall: '', actualFootfall: '', foodPrepared: '', foodConsumed: '' });
    refresh();
  };

  if (!user) return null;

  const prediction = predictFootfall(user.id);
  const predictedFood = predictFoodQuantity(user.id);
  const metrics = getMetrics();
  const recs = getRecommendations(user.id);

  const chartData = [...logs].sort((a, b) => a.date.localeCompare(b.date)).slice(-14).map(l => ({
    date: new Date(l.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    prepared: l.foodPrepared, consumed: l.foodConsumed, surplus: l.surplus, footfall: l.actualFootfall,
  }));

  const trendIcon = prediction.trend === 'increasing' ? <TrendingUp className="w-4 h-4 text-primary" /> :
    prediction.trend === 'decreasing' ? <TrendingDown className="w-4 h-4 text-secondary" /> :
    <Minus className="w-4 h-4 text-muted-foreground" />;

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'input' as const, label: 'Daily Input', icon: Plus },
    { id: 'predictions' as const, label: 'Predictions', icon: Brain },
    { id: 'surplus' as const, label: 'Surplus', icon: Package },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    { id: 'recommendations' as const, label: 'Smart Tips', icon: Lightbulb },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="font-bold text-sm gradient-text">FoodLoop AI</span>
              <span className="text-xs text-muted-foreground block">{user.organization}</span>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-card/50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex gap-1 overflow-x-auto py-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Overview */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Predicted Footfall', value: prediction.predicted, extra: trendIcon },
                { label: 'Recommended Prep', value: `${predictedFood} kg`, extra: null },
                { label: 'Total Surplus', value: `${metrics.totalSurplus} kg`, extra: null },
                { label: 'Food Saved', value: `${metrics.totalFoodSaved} kg`, extra: null },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
                  <div className="text-2xl font-bold flex items-center gap-2">{s.value} {s.extra}</div>
                </div>
              ))}
            </div>

            {/* Recent Logs */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Recent Logs</h3>
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No logs yet. Add your first daily entry!</p>
              ) : (
                <div className="space-y-3">
                  {[...logs].reverse().slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="text-sm font-medium">{l.menuItems}</div>
                        <div className="text-xs text-muted-foreground">{l.date} · {l.actualFootfall} people</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{l.foodPrepared} kg prepared</div>
                        <div className={`text-xs ${l.surplus > SURPLUS_THRESHOLD ? 'text-secondary' : 'text-primary'}`}>
                          {l.surplus > 0 ? `${l.surplus} kg surplus` : 'No waste'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Chart */}
            {chartData.length > 1 && (
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4">Surplus Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="surplusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(145, 65%, 42%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(145, 65%, 42%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 10%, 16%)" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'hsl(160, 12%, 9%)', border: '1px solid hsl(160, 10%, 16%)', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="surplus" stroke="hsl(145, 65%, 42%)" fill="url(#surplusGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}

        {/* Input Form */}
        {tab === 'input' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="max-w-2xl mx-auto glass-card p-8">
              <h2 className="section-title mb-6 flex items-center gap-2"><Plus className="w-6 h-6 text-primary" /> Daily Food Log</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Menu Items</label>
                    <input value={form.menuItems} onChange={e => setForm(f => ({ ...f, menuItems: e.target.value }))} className="input-field" placeholder="Rice, Dal, Sabzi" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Expected Footfall</label>
                    <input type="number" value={form.expectedFootfall} onChange={e => setForm(f => ({ ...f, expectedFootfall: e.target.value }))} className="input-field" placeholder={`Predicted: ${prediction.predicted}`} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Actual Footfall</label>
                    <input type="number" value={form.actualFootfall} onChange={e => setForm(f => ({ ...f, actualFootfall: e.target.value }))} className="input-field" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Food Prepared (kg)</label>
                    <input type="number" value={form.foodPrepared} onChange={e => setForm(f => ({ ...f, foodPrepared: e.target.value }))} className="input-field" placeholder={`Recommended: ${predictedFood}`} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Food Consumed (kg)</label>
                    <input type="number" value={form.foodConsumed} onChange={e => setForm(f => ({ ...f, foodConsumed: e.target.value }))} className="input-field" required />
                  </div>
                </div>
                {form.foodPrepared && form.foodConsumed && (
                  <div className={`p-4 rounded-lg border ${Number(form.foodPrepared) - Number(form.foodConsumed) > SURPLUS_THRESHOLD ? 'bg-secondary/10 border-secondary/30' : 'bg-primary/10 border-primary/30'}`}>
                    <div className="text-sm font-medium">
                      Estimated Surplus: <span className="text-lg font-bold">{Number(form.foodPrepared) - Number(form.foodConsumed)} kg</span>
                      {Number(form.foodPrepared) - Number(form.foodConsumed) > SURPLUS_THRESHOLD && (
                        <span className="ml-2 text-secondary text-xs">⚠️ Will be listed for redistribution</span>
                      )}
                    </div>
                  </div>
                )}
                <button type="submit" className="btn-primary w-full">Submit Daily Log</button>
              </form>
            </div>
          </motion.div>
        )}

        {/* Predictions */}
        {tab === 'predictions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-card p-6 glow-border">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Brain className="w-5 h-5 text-primary" /> Footfall Prediction</h3>
                <div className="text-5xl font-bold text-primary mb-2">{prediction.predicted}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {trendIcon} Trend: <span className="capitalize">{prediction.trend}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">Based on last {Math.min(logs.length, 7)} entries with weighted trend analysis</p>
              </div>
              <div className="glass-card p-6 glow-border">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Utensils className="w-5 h-5 text-primary" /> Recommended Preparation</h3>
                <div className="text-5xl font-bold text-primary mb-2">{predictedFood} <span className="text-lg">kg</span></div>
                <p className="text-xs text-muted-foreground mt-3">Calculated from predicted footfall × avg consumption per person</p>
              </div>
            </div>
            {chartData.length > 1 && (
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4">Footfall History</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 10%, 16%)" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'hsl(160, 12%, 9%)', border: '1px solid hsl(160, 10%, 16%)', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="footfall" stroke="hsl(145, 65%, 42%)" strokeWidth={2} dot={{ fill: 'hsl(145, 65%, 42%)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}

        {/* Surplus */}
        {tab === 'surplus' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="section-title flex items-center gap-2"><Package className="w-6 h-6 text-primary" /> Surplus Items</h2>
            {surplus.length === 0 ? (
              <div className="glass-card p-10 text-center text-muted-foreground">No surplus items detected yet</div>
            ) : (
              surplus.map(s => (
                <div key={s.id} className="glass-card p-5 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.foodType}</div>
                    <div className="text-sm text-muted-foreground">{s.date} · {s.quantity} kg</div>
                  </div>
                  <span className={`status-${s.status}`}>{s.status}</span>
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* Analytics */}
        {tab === 'analytics' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Food Saved', value: `${metrics.totalFoodSaved} kg` },
                { label: 'Meals Provided', value: metrics.mealsRedistributed },
                { label: 'Waste Reduction', value: `${metrics.wasteReduction}%` },
                { label: 'Total Entries', value: logs.length },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
                  <div className="text-2xl font-bold">{s.value}</div>
                </div>
              ))}
            </div>
            {chartData.length > 1 && (
              <>
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-4">Prepared vs Consumed</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 10%, 16%)" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                      <YAxis tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: 'hsl(160, 12%, 9%)', border: '1px solid hsl(160, 10%, 16%)', borderRadius: 8 }} />
                      <Bar dataKey="prepared" fill="hsl(28, 85%, 55%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="consumed" fill="hsl(145, 65%, 42%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-4">Daily Surplus Trend</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(28, 85%, 55%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(28, 85%, 55%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 10%, 16%)" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                      <YAxis tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: 'hsl(160, 12%, 9%)', border: '1px solid hsl(160, 10%, 16%)', borderRadius: 8 }} />
                      <Area type="monotone" dataKey="surplus" stroke="hsl(28, 85%, 55%)" fill="url(#sg2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Recommendations */}
        {tab === 'recommendations' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="section-title flex items-center gap-2"><Lightbulb className="w-6 h-6 text-secondary" /> Smart Recommendations</h2>
            {recs.map((r, i) => (
              <div key={i} className="glass-card p-5 flex items-start gap-4 hover:border-primary/30 transition-all">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb className="w-4 h-4 text-secondary" />
                </div>
                <p className="text-sm leading-relaxed">{r}</p>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
