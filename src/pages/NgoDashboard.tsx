import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getData, setData, genId, SurplusItem, Delivery, User, getMetrics } from '@/lib/store';
import { toast } from 'sonner';
import {
  Leaf, LogOut, Package, Truck, BarChart3, CheckCircle2, Clock, MapPin,
  ArrowRight, Heart, Users
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function NgoDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'available' | 'deliveries' | 'impact'>('available');
  const [available, setAvailable] = useState<SurplusItem[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const refresh = useCallback(() => {
    if (!user) return;
    setAvailable((getData<SurplusItem[]>('surplusItems') || []).filter(s => s.status === 'available'));
    setDeliveries((getData<Delivery[]>('deliveries') || []).filter(d => d.ngoId === user.id));
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'ngo') { navigate('/login'); return; }
    refresh();
    const handler = () => refresh();
    window.addEventListener('store-update', handler);
    return () => window.removeEventListener('store-update', handler);
  }, [user, navigate, refresh]);

  const requestPickup = (item: SurplusItem) => {
    if (!user) return;

    // Update surplus status
    const allSurplus = getData<SurplusItem[]>('surplusItems') || [];
    const idx = allSurplus.findIndex(s => s.id === item.id);
    if (idx >= 0) { allSurplus[idx].status = 'assigned'; setData('surplusItems', allSurplus); }

    // Create delivery
    const delivery: Delivery = {
      deliveryId: genId(), surplusId: item.id, ngoId: user.id, ngoName: user.organization,
      canteenId: item.canteenId, canteenName: item.canteenName, foodType: item.foodType,
      quantity: item.quantity, status: 'requested',
      timestamps: { requested: new Date().toISOString() },
    };
    const allDeliveries = getData<Delivery[]>('deliveries') || [];
    allDeliveries.push(delivery);
    setData('deliveries', allDeliveries);

    toast.success(`Pickup requested for ${item.quantity} kg of ${item.foodType}`);
    refresh();
  };

  const advanceDelivery = (del: Delivery) => {
    const allDeliveries = getData<Delivery[]>('deliveries') || [];
    const idx = allDeliveries.findIndex(d => d.deliveryId === del.deliveryId);
    if (idx < 0) return;

    const statusFlow: Record<string, string> = {
      requested: 'approved', approved: 'intransit', intransit: 'delivered',
    };
    const next = statusFlow[del.status];
    if (!next) return;

    allDeliveries[idx].status = next as Delivery['status'];
    allDeliveries[idx].timestamps = { ...allDeliveries[idx].timestamps, [next]: new Date().toISOString() };

    if (next === 'delivered') {
      const allSurplus = getData<SurplusItem[]>('surplusItems') || [];
      const si = allSurplus.findIndex(s => s.id === del.surplusId);
      if (si >= 0) { allSurplus[si].status = 'delivered'; setData('surplusItems', allSurplus); }
    }

    setData('deliveries', allDeliveries);
    toast.success(`Delivery ${next === 'delivered' ? 'completed! 🎉' : `updated to ${next}`}`);
    refresh();
  };

  if (!user) return null;

  const metrics = getMetrics();
  const myDelivered = deliveries.filter(d => d.status === 'delivered');
  const myFoodSaved = myDelivered.reduce((s, d) => s + d.quantity, 0);
  const myMeals = Math.floor(myFoodSaved / 0.5);

  const statusLabel: Record<string, string> = { requested: 'Requested', approved: 'Approved', intransit: 'In Transit', delivered: 'Delivered' };
  const statusClass: Record<string, string> = { requested: 'status-requested', approved: 'status-assigned', intransit: 'status-intransit', delivered: 'status-delivered' };
  const nextAction: Record<string, string> = { requested: 'Approve', approved: 'Start Transit', intransit: 'Mark Delivered' };

  const tabs = [
    { id: 'available' as const, label: 'Available Food', icon: Package },
    { id: 'deliveries' as const, label: 'Deliveries', icon: Truck },
    { id: 'impact' as const, label: 'Impact', icon: Heart },
  ];

  // Build impact chart
  const deliveryByDate: Record<string, number> = {};
  myDelivered.forEach(d => {
    const date = d.timestamps.delivered?.split('T')[0] || '';
    deliveryByDate[date] = (deliveryByDate[date] || 0) + d.quantity;
  });
  const impactChart = Object.entries(deliveryByDate).sort().map(([date, qty]) => ({
    date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }), quantity: qty,
  }));

  return (
    <div className="min-h-screen bg-background">
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
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Available Now', value: available.length },
            { label: 'Active Deliveries', value: deliveries.filter(d => d.status !== 'delivered').length },
            { label: 'Food Collected', value: `${myFoodSaved} kg` },
            { label: 'Meals Served', value: myMeals },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
              <div className="text-2xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Available */}
        {tab === 'available' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="section-title flex items-center gap-2"><Package className="w-6 h-6 text-primary" /> Available Surplus Food</h2>
            {available.length === 0 ? (
              <div className="glass-card p-10 text-center text-muted-foreground">No surplus food available right now. Check back soon!</div>
            ) : (
              available.map(item => (
                <div key={item.id} className="glass-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-lg">{item.foodType}</div>
                      <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.location}</span>
                        <span>{item.canteenName}</span>
                        <span>{item.date}</span>
                      </div>
                      <div className="mt-2 text-2xl font-bold text-primary">{item.quantity} kg</div>
                    </div>
                    <button onClick={() => requestPickup(item)} className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                      Request Pickup <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* Deliveries */}
        {tab === 'deliveries' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="section-title flex items-center gap-2"><Truck className="w-6 h-6 text-primary" /> Delivery Tracking</h2>
            {deliveries.length === 0 ? (
              <div className="glass-card p-10 text-center text-muted-foreground">No deliveries yet. Request a pickup to get started!</div>
            ) : (
              [...deliveries].reverse().map(d => (
                <div key={d.deliveryId} className="glass-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="font-semibold">{d.foodType}</div>
                      <div className="text-sm text-muted-foreground">{d.canteenName} · {d.quantity} kg</div>
                    </div>
                    <span className={statusClass[d.status]}>{statusLabel[d.status]}</span>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2 mb-4">
                    {['requested', 'approved', 'intransit', 'delivered'].map((stage, i) => {
                      const stages = ['requested', 'approved', 'intransit', 'delivered'];
                      const currentIdx = stages.indexOf(d.status);
                      const stageIdx = i;
                      const done = stageIdx <= currentIdx;
                      return (
                        <React.Fragment key={stage}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                          </div>
                          {i < 3 && <div className={`flex-1 h-0.5 ${stageIdx < currentIdx ? 'bg-primary' : 'bg-muted'}`} />}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Timestamps */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mb-3">
                    {Object.entries(d.timestamps).map(([key, val]) => val && (
                      <div key={key}>
                        <span className="capitalize">{key}</span>
                        <br />
                        <span className="mono text-foreground/70">{new Date(val).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {d.status !== 'delivered' && (
                    <button onClick={() => advanceDelivery(d)} className="btn-primary text-sm py-2 px-4">
                      {nextAction[d.status]}
                    </button>
                  )}
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* Impact */}
        {tab === 'impact' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="section-title flex items-center gap-2"><Heart className="w-6 h-6 text-secondary" /> Your Impact</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="glass-card p-6 text-center glow-border">
                <div className="text-4xl font-bold text-primary mb-1">{myFoodSaved} kg</div>
                <div className="text-sm text-muted-foreground">Food Collected</div>
              </div>
              <div className="glass-card p-6 text-center glow-border">
                <div className="text-4xl font-bold text-secondary mb-1">{myMeals}</div>
                <div className="text-sm text-muted-foreground">Meals Served</div>
              </div>
              <div className="glass-card p-6 text-center glow-border col-span-2 md:col-span-1">
                <div className="text-4xl font-bold text-primary mb-1">{myDelivered.length}</div>
                <div className="text-sm text-muted-foreground">Deliveries Completed</div>
              </div>
            </div>
            {impactChart.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="font-semibold mb-4">Food Collected Over Time</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={impactChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 10%, 16%)" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(140, 6%, 55%)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'hsl(160, 12%, 9%)', border: '1px solid hsl(160, 10%, 16%)', borderRadius: 8 }} />
                    <Bar dataKey="quantity" fill="hsl(145, 65%, 42%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
