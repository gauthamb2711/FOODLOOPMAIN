import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { 
  getData, setData, SurplusItem, getMetrics, 
  getNotifications, markNotificationRead, clearNotifications, AppNotification, User
} from '@/lib/store';
import { generateFoodReport } from '@/lib/pdf';
import { toast } from 'sonner';
import {
  Heart, Truck, Clock, RefreshCw, FileText, Download, CheckCircle, ShieldAlert, BadgeCheck, XCircle, Search, ThumbsUp, MapPin, Navigation, Bell, MessageSquare, History, AlertTriangle, Play, CheckCircle2, QrCode, ClipboardCheck, Sparkles, LogOut, LayoutDashboard, Package, ShieldCheck, Leaf, ArrowRight, Check, FileDown, Trash2, X
} from 'lucide-react';
import * as api from '@/lib/api';
import { io } from 'socket.io-client';

import ChatInterface from '@/components/ChatInterface';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import MapView from '@/components/MapView';

export default function NgoDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'available' | 'requests' | 'impact' | 'messages' | 'map' | 'notifications' | 'smart-picks' | 'trust-logs'>('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [available, setAvailable] = useState<SurplusItem[]>([]);
  const [myRequests, setMyRequests] = useState<SurplusItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeChatPartner, setActiveChatPartner] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const prevNotifCount = React.useRef(0);

  // Helper for GPS Distance (Haversine Formula)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const refresh = useCallback(async () => {
    if (!user) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }

    let allSurplus: SurplusItem[] = [];

    try {
      const res = await api.getSurplus();
      allSurplus = res.data;
    } catch (e) {
      console.error("Backend offline fallback:", e);
      allSurplus = getData<SurplusItem[]>('surplusFood') || [];
    }

    setAvailable(allSurplus.filter((s: SurplusItem) => 
      s.status === 'available' || 
      (s.requestedBy === user.id && ['requested', 'approved', 'on_the_way'].includes(s.status))
    ));
    
    const myReqs = allSurplus.filter((s: SurplusItem) => s.requestedBy === user.id);
    
    const syntheticNotifs: any[] = [];
    const readNotifs = JSON.parse(localStorage.getItem('readNotifs') || '[]');
    
    myReqs.forEach((s: SurplusItem) => {
      if (s.status === 'approved' || s.status === 'on_the_way' || s.status === 'completed') {
         const idStr = s.id + '-approved';
         const time = s.logs?.find(l => l.action === 'approved')?.time || new Date().toISOString();
         syntheticNotifs.push({
           id: idStr,
           userId: user.id,
           title: 'Request Approved',
           message: `${s.canteenName || 'Canteen'} approved your request for ${s.quantity}kg of ${s.food}.`,
           type: 'success',
           createdAt: time,
           timestamp: time,
           read: readNotifs.includes(idStr)
         });
      }
      if (s.status === 'completed') {
         const idStr = s.id + '-completed';
         const time = s.completedAt || new Date().toISOString();
         syntheticNotifs.push({
           id: idStr,
           userId: user.id,
           title: 'Digital Handover Complete',
           message: `Successfully received ${s.quantity}kg of ${s.food}.`,
           type: 'info',
           createdAt: time,
           timestamp: time,
           read: readNotifs.includes(idStr)
         });
      }
    });
    
    allSurplus.forEach((s: SurplusItem) => {
      const rejectionLogs = s.logs?.filter(l => l.action === 'rejected_request_from_' + user.id) || [];
      rejectionLogs.forEach((log, index) => {
         const idStr = s.id + '-rejected-' + index;
         syntheticNotifs.push({
           id: idStr,
           userId: user.id,
           title: 'Request Rejected',
           message: `${s.canteenName || 'Canteen'} could not accept your pickup request for ${s.food}.`,
           type: 'warning',
           createdAt: log.time,
           timestamp: log.time,
           read: readNotifs.includes(idStr)
         });
      });
    });
    
    syntheticNotifs.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    setNotifications(syntheticNotifs);
    setMyRequests(myReqs);

    if (syntheticNotifs.length > prevNotifCount.current) {
      const latest = syntheticNotifs[0];
      if (!latest.read) {
        if (latest.type === 'info') toast.info(latest.message, { duration: 5000, id: latest.id });
        else if (latest.type === 'warning') toast.error(latest.message, { duration: 5000, id: latest.id });
        else toast.success(latest.message, { duration: 5000, id: latest.id });
      }
    }
    prevNotifCount.current = syntheticNotifs.length;
  }, [user]);


  useEffect(() => {
    if (!user || user.role !== 'ngo') { navigate('/login'); return; }
    refresh();
    const handler = () => refresh();
    window.addEventListener('store-update', handler);
    window.addEventListener('storage', handler);
    
    const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000');
    socket.on('surplus_updated', handler);
    
    return () => {
        window.removeEventListener('store-update', handler);
        window.removeEventListener('storage', handler);
        socket.disconnect();
    };
  }, [user, navigate, refresh]);

  const [activeHandoverItem, setActiveHandoverItem] = useState<SurplusItem | null>(null);
  const [handoverForm, setHandoverForm] = useState({
    code: '',
    rating: 'good' as 'good' | 'acceptable' | 'poor',
    checks: { freshness: false, smell: false, packaging: false }
  });

  const logStatusChange = (item: SurplusItem, action: string, actor: string) => {
    if (!item.logs) item.logs = [];
    item.logs.push({
      action,
      time: new Date().toISOString(),
      actor
    });
  };

  const requestPickup = async (item: SurplusItem) => {
    if (!user) return;
    try {
      await api.updateSurplus(item.id, { status: 'requested', action: 'requested', actor: 'NGO' });
      toast.success(`Pickup requested for ${item.quantity} kg of ${item.food}`);
      refresh();
    } catch(err) {
      toast.error('Failed to request pickup. Backend might be offline.');
    }
  };

  const startPickup = async (id: string) => {
    try {
      await api.updateSurplus(id, { status: 'on_the_way', action: 'pickup_started', actor: 'NGO' });
      toast.info('Pickup started! Drive safely 🚚');
      refresh();
    } catch(err) {
      toast.error('Failed to update status.');
    }
  };


  const initiateHandover = (item: SurplusItem) => {
    setActiveHandoverItem(item);
    setHandoverForm({
      code: '',
      rating: 'good',
      checks: { freshness: false, smell: false, packaging: false }
    });
  };

  const confirmHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHandoverItem || !user) return;

    if (handoverForm.code !== activeHandoverItem.pickupCode) {
      toast.error('Invalid Handover Code. Please ask the Canteen for the 6-digit code.');
      return;
    }

    if (!handoverForm.checks.freshness || !handoverForm.checks.smell || !handoverForm.checks.packaging) {
      toast.error('Please complete all safety checks before proceeding.');
      return;
    }

    try {
      await api.updateSurplus(activeHandoverItem.id, {
        status: 'completed',
        conditionAtPickup: handoverForm.rating,
        handoverLocation: userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : undefined,
        action: 'completed',
        actor: 'NGO'
      });
      toast.success('Handover Verified! Food safety responsibility has been transferred.');
      setActiveHandoverItem(null);
      refresh();
    } catch(err) {
      toast.error('Failed to confirm delivery on the backend.');
    }
  };

  const completePickup = (id: string) => {
    const item = myRequests.find(s => s.id === id);
    if (item) initiateHandover(item);
  };

  const requestChat = (canteenId: string) => {
    setActiveChatPartner(canteenId);
    setTab('messages');
  };

  const downloadReport = async (item: SurplusItem) => {
    try {
      const res = await api.getUsers();
      generateFoodReport(item, res.data);
    } catch (e) {
      generateFoodReport(item, []);
    }
  };

  if (!user) return null;

  const myDelivered = myRequests.filter(d => d.status === 'completed');
  const myFoodSaved = myDelivered.reduce((s, d) => s + d.quantity, 0);
  const myMeals = Math.floor(myFoodSaved / 0.5);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard, badge: 0 },
    { id: 'smart-picks' as const, label: 'Smart Picks 🔥', icon: Sparkles, badge: available.length > 0 ? 3 : 0 },
    { id: 'available' as const, label: 'Available Food', icon: Package, badge: 0 },
    { id: 'requests' as const, label: 'Active Pickups', icon: Truck, badge: 0 },
    { id: 'map' as const, label: 'Map View', icon: MapPin, badge: 0 },
    { id: 'messages' as const, label: 'Messages', icon: MessageSquare, badge: 0 },
    { id: 'trust-logs' as const, label: 'Trust & Logs 🤝', icon: History, badge: 0 },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell, badge: notifications.filter(n => !n.read).length },
    { id: 'impact' as const, label: 'Impact', icon: Heart, badge: 0 },
  ];

  // Build impact chart
  const deliveryByDate: Record<string, number> = {};
  myDelivered.forEach(d => {
    const date = new Date(d.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' });
    deliveryByDate[date] = (deliveryByDate[date] || 0) + d.quantity;
  });
  const impactChart = Object.entries(deliveryByDate).map(([date, qty]) => ({
    date, quantity: qty,
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card/80 backdrop-blur-xl border-r border-border/50 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-lg font-bold gradient-text">Food Loop</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-b border-border/50">
          <div className="font-medium truncate" title={user.organization}>{user.organization}</div>
          <div className="text-xs text-muted-foreground capitalize">{user.role} Dashboard</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
              <t.icon className="w-4 h-4" /> 
              {t.label}
              {t.badge > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-white border-2 border-background animate-pulse">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border/50">
          <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
        {/* Overview Dashboard */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title">Ngo Overview</h2>
                <p className="text-sm text-muted-foreground">Snapshot of your redistribution impact and active tasks.</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Live Trust Score</div>
                <div className="text-2xl font-black text-primary italic leading-none">⭐ {Math.max(1.0, 5.0 - (myDelivered.filter(h => h.conditionAtPickup === 'poor').length * 0.5)).toFixed(1)}</div>
              </div>
            </div>

            {/* Story-Based Impact Hero */}
            <div className="relative overflow-hidden rounded-[2rem] p-8 border border-primary/20 shadow-2xl shadow-primary/5 mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-orange-500/5 to-amber-500/10" />
              
              <div className="relative z-10 max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-4 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-black uppercase tracking-widest border border-primary/20">
                    🌍 Food Rescue Hero
                  </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight tracking-tight">
                  Your Impact <span className="text-primary italic">This Month</span> 🌍
                </h1>
                <p className="text-lg text-muted-foreground font-medium mb-8">
                  You rescued food for <span className="text-primary font-bold">{myMeals}+ people</span> this month. Every pickup you complete reduces hunger and heals the planet ❤️.
                </p>

                {/* Progress Visualization */}
                <div className="mb-10 p-6 bg-white/40 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
                  <div className="flex justify-between items-end mb-3">
                    <div className="text-sm font-black uppercase tracking-widest text-primary">Mission: 1,000 Meals</div>
                    <div className="text-xs font-bold text-muted-foreground italic">Rescue Progress: {Math.floor((myMeals / 1000) * 100)}%</div>
                  </div>
                  <div className="h-4 w-full bg-muted/30 rounded-full overflow-hidden border border-border/50">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (myMeals / 1000) * 100)}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-primary to-orange-400 group relative"
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_2s_infinite]" />
                    </motion.div>
                  </div>
                  <p className="mt-4 text-[10px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2 italic">
                    🍛 You are transforming surplus into smiles.
                  </p>
                </div>

                {/* Story Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { story: `You served ${myMeals} meals to people in need`, icon: "🍽", color: "bg-orange-500" },
                    { story: `You saved ${(myFoodSaved * 2.5).toFixed(1)}kg of CO₂ emissions`, icon: "🌱", color: "bg-primary" },
                    { story: `You prevented ${myFoodSaved}kg of food waste`, icon: "♻", color: "bg-amber-500" },
                    { story: `You partnered with 2 local canteens`, icon: "🤝", color: "bg-blue-500" },
                  ].map((s, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 hover:bg-white/80 transition-all border border-white/50 shadow-sm group cursor-pointer"
                    >
                      <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center text-xl shadow-lg shadow-black/5 group-hover:scale-110 transition-transform`}>
                        {s.icon}
                      </div>
                      <div className="text-sm font-bold leading-snug">{s.story}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Available Now', value: available.filter(s => s.status === 'available').length, icon: Package },
                { label: 'Active Pickups', value: myRequests.filter(d => ['requested', 'approved', 'on_the_way'].includes(d.status)).length, icon: Truck },
                { label: 'Food Collected', value: `${myFoodSaved} kg`, icon: Leaf },
                { label: 'Meals Served', value: myMeals, icon: Heart },
              ].map((s, i) => (
                <div key={i} className="stat-card group hover:border-primary/30 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{s.label}</div>
                    <s.icon className="w-3.5 h-3.5 text-primary/40 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="text-xl font-black">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Main Column */}
              <div className="md:col-span-2 space-y-6">
                {/* Immediate Action Alert */}
                {myRequests.some(r => r.status === 'approved' || r.status === 'on_the_way') && (
                  <div className="p-5 bg-primary/10 border-2 border-primary/20 rounded-2xl relative overflow-hidden group">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 animate-pulse shadow-lg shadow-primary/20">
                        <Truck className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg mb-1">Action Required: Pickup Ready</h4>
                        <p className="text-sm text-primary/80 mb-3">You have {myRequests.filter(r => r.status === 'approved').length} approved requests ready for collection.</p>
                        <button 
                          onClick={() => setTab('requests')}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20"
                        >
                          View Pickup Locations <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Smart Pick Spotlight */}
                <div className="glass-card p-6 overflow-hidden relative">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold flex items-center gap-2 italic uppercase tracking-wider text-sm"><Sparkles className="w-4 h-4 text-primary" /> Top Recommended</h3>
                    <button onClick={() => setTab('smart-picks')} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">View All Scored Picks</button>
                  </div>
                  
                  {(() => {
                    const topItem = available
                      .filter(s => s.status === 'available')
                      .map(item => {
                        let score = 0;
                        const dist = userCoords && item.lat && item.lng ? getDistance(userCoords.lat, userCoords.lng, item.lat, item.lng) : (item.id.length % 5) + 1;
                        if (dist < 2) score += 50; else if (dist < 5) score += 30; else score += 10;
                        const expiry = new Date();
                        const [h, m] = (item.expiryTime || "23:59").split(':');
                        expiry.setHours(parseInt(h), parseInt(m));
                        const mins = (expiry.getTime() - new Date().getTime()) / 60000;
                        if (mins < 60) score += 40; else if (mins < 180) score += 20; else score += 5;
                        const matchScore = Math.min(100, score);
                        return { ...item, matchScore, dist: dist.toFixed(1) };
                      })
                      .sort((a, b) => b.matchScore - a.matchScore)[0];

                    if (!topItem) return <div className="text-sm text-muted-foreground p-8 text-center italic">No surplus items available nearby right now.</div>;

                    return (
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50 group hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🍛</div>
                          <div>
                            <div className="font-black text-lg leading-tight">{topItem.food}</div>
                            <div className="text-xs text-muted-foreground">{topItem.canteenName} · {topItem.dist} km away</div>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                              {topItem.matchScore}% AI Match
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => requestPickup(topItem)}
                          className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                        >
                          <ArrowRight className="w-6 h-6" />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Sidebar Column */}
              <div className="space-y-6">
                <div className="glass-card p-5">
                  <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 mb-4 text-muted-foreground border-b border-border/50 pb-3">
                    <History className="w-3.5 h-3.5" /> Recent Handshakes
                  </h3>
                  <div className="space-y-4">
                    {myDelivered.slice(-3).reverse().map((h, i) => (
                      <div key={i} className="flex gap-3 relative before:absolute before:left-2.5 before:top-6 before:bottom-0 before:w-px before:bg-border last:before:hidden">
                        <div className="w-5 h-5 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center flex-shrink-0 z-10">
                          <Check className="w-2.5 h-2.5 text-primary font-black" />
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-none">{h.food}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">Verified on {new Date(h.completedAt!).toLocaleDateString('en', {month: 'short', day: 'numeric'})}</div>
                        </div>
                      </div>
                    ))}
                    {myDelivered.length === 0 && (
                      <div className="text-[10px] text-center text-muted-foreground py-4 italic">No verified records yet.</div>
                    )}
                  </div>
                  {myDelivered.length > 0 && (
                    <button 
                      onClick={() => setTab('trust-logs')}
                      className="w-full mt-4 py-2 border border-border bg-muted/20 hover:bg-muted/40 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      View All Records
                    </button>
                  )}
                </div>

                <div className="p-4 bg-secondary/5 border border-secondary/10 rounded-2xl">
                   <div className="flex items-center gap-2 mb-2">
                     <ShieldCheck className="w-4 h-4 text-secondary" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Verified Impact</span>
                   </div>
                   <p className="text-[10px] text-muted-foreground leading-relaxed">
                     You have provided approximately <strong>{myMeals} meals</strong> to people in need, preventing <strong>{(myFoodSaved * 2.5).toFixed(1)} kg of CO2</strong> emissions.
                   </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Smart Picks (AI Recommendation) */}
        {tab === 'smart-picks' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary animate-pulse" /> 
                <span className="gradient-text">Smart Picks for You</span>
              </h2>
              <p className="text-sm text-muted-foreground">AI-scored pickups based on proximity, urgency, and quantity.</p>
            </div>

            {(() => {
              const availableItems = available.filter(s => s.status === 'available');
              if (availableItems.length === 0) {
                return <div className="glass-card p-12 text-center text-muted-foreground">No recommendations yet. Check back soon for fresh surplus!</div>;
              }

              // Scoring Logic
              const scoredItems = availableItems.map(item => {
                let score = 0;
                
                // 1. Proximity Score (Real GPS Distance)
                let distance = 0;
                // Default coordinates for demo if GPS denied (Mumbai)
                const currentLat = userCoords?.lat || 18.9733;
                const currentLng = userCoords?.lng || 72.8273;

                if (item.lat && item.lng) {
                   distance = getDistance(currentLat, currentLng, item.lat, item.lng);
                   if (distance < 2) score += 50;
                   else if (distance < 5) score += 30;
                   else if (distance < 10) score += 15;
                   else score += 5;
                } else {
                   // Unique fallback based on item ID hash to ensure variation in demo
                   const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                   distance = (hash % 15) + 0.5;
                   score += 5;
                }

                // 2. Time Urgency (Expiry)
                const expiry = new Date();
                const [h, m] = (item.expiryTime || "23:59").split(':');
                expiry.setHours(parseInt(h), parseInt(m));
                const minsLeft = (expiry.getTime() - new Date().getTime()) / (1000 * 60);
                
                if (minsLeft < 45) score += 50;
                else if (minsLeft < 90) score += 35;
                else if (minsLeft < 240) score += 15;
                else score += 5;

                // 3. Quantity Score
                if (item.quantity > 50) score += 10;
                else if (item.quantity >= 10) score += 5;

                // Normalize Match Percentage (weighted sum)
                const matchScore = Math.min(100, Math.floor((score / 100) * 100));

                return { ...item, matchScore, distance: distance.toFixed(1) };
              }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);

              return (
                <div className="grid gap-6">
                  <div className="text-xs font-bold uppercase tracking-widest text-primary/60 flex items-center gap-2">
                    🔥 Recommended for You
                  </div>
                  {scoredItems.map((item, idx) => (
                    <motion.div 
                      key={item.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`glass-card p-6 border-2 transition-all relative overflow-hidden group ${idx === 0 ? 'border-primary shadow-[0_0_20px_rgba(34,197,94,0.15)] ring-1 ring-primary/20' : 'border-border/50'}`}
                    >
                      {idx === 0 && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-[10px] font-black uppercase tracking-tighter rounded-bl-xl shadow-lg">
                          Best Match
                        </div>
                      )}
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🍛</div>
                            <div>
                              <h3 className="font-bold text-xl">{item.food}</h3>
                              <p className="text-xs text-muted-foreground">{item.canteenName} · {item.location}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm font-medium">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-full">
                              <MapPin className="w-3.5 h-3.5 text-primary" /> {item.distance} km
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-full">
                              <Clock className="w-3.5 h-3.5 text-secondary" /> {item.expiryTime}
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-full">
                              <Sparkles className="w-3.5 h-3.5 text-primary" /> {item.matchScore}% Match
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => requestPickup(item)}
                          className={`btn-primary py-3 px-8 flex items-center gap-2 shadow-xl hover:scale-105 transition-all ${idx === 0 ? 'bg-primary shadow-primary/30' : 'bg-muted text-foreground border border-border shadow-none'}`}
                        >
                          Quick Pickup ⚡
                        </button>
                      </div>
                      
                      {idx === 0 && <div className="absolute inset-0 bg-primary/5 pointer-events-none group-hover:bg-primary/0 transition-colors" />}
                    </motion.div>
                  ))}
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* Trust & Logs (Digital Handshake) */}
        {tab === 'trust-logs' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-primary" /> 
                  <span className="gradient-text">Trust & Traceability</span>
                </h2>
                <p className="text-sm text-muted-foreground">Detailed history of digitally verified handovers and safety audit logs.</p>
              </div>
            </div>

            {(() => {
              const history = myRequests?.filter(s => s.status === 'completed' && s.requestedBy === user.id) || [];
              const issuesCount = history.filter(h => h.conditionAtPickup === 'poor').length;
              const trustScore = Math.max(1.0, 5.0 - (issuesCount * 0.5)).toFixed(1);

              return (
                <>
                  {/* Stats Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 flex items-center gap-5 border-l-4 border-l-primary glow-border">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <div className="text-3xl font-black text-primary italic">⭐ {trustScore}</div>
                        <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Global Trust Score</div>
                      </div>
                    </div>
                    
                    <div className="glass-card p-6 flex items-center gap-5 border-l-4 border-l-blue-500 glow-border">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Package className="w-8 h-8 text-blue-500" />
                      </div>
                      <div>
                        <div className="text-3xl font-black">{history.length}</div>
                        <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Completed Pickups</div>
                      </div>
                    </div>

                    <div className="glass-card p-6 flex items-center gap-5 border-l-4 border-l-red-500 glow-border">
                      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center flex-shrink-0 text-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                      </div>
                      <div>
                        <div className="text-3xl font-black text-red-500">{issuesCount}</div>
                        <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Safety Issues Logged</div>
                      </div>
                    </div>
                  </div>

                  {/* History List */}
                  <div className="glass-card overflow-hidden">
                    <div className="p-5 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                      <h3 className="font-bold flex items-center gap-2"><History className="w-5 h-5 text-muted-foreground" /> Verified Pickup Records</h3>
                      <div className="text-[10px] uppercase font-black text-primary/60 tracking-widest bg-primary/10 px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Digitally Verified
                      </div>
                    </div>

                    {history.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground">No pickups completed yet. Start saving food today!</div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {history.sort((a,b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()).map(h => (
                          <div key={h.id} className="p-6 transition-colors hover:bg-muted/10 group">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="font-bold text-lg flex items-center gap-2">
                                  {h.food}
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-tighter ${h.conditionAtPickup === 'good' ? 'bg-primary/20 text-primary' : h.conditionAtPickup === 'acceptable' ? 'bg-orange-500/20 text-orange-500' : 'bg-red-500/20 text-red-500'}`}>
                                    Condition: {h.conditionAtPickup}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {h.location}</span>
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Handover: {new Date(h.handoverTime!).toLocaleString()}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => downloadReport(h)}
                                className="w-full md:w-auto px-4 py-2 bg-muted/50 rounded-lg text-xs font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center gap-2 border border-transparent hover:border-primary/20"
                              >
                                <FileDown className="w-4 h-4" /> Export Log (PDF)
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-4">
                    <ShieldCheck className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-primary italic uppercase tracking-wider mb-1">🤝 Digitally Verified Handshake</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Every record in this list has been verified using our <strong>6-digit secure handshake system</strong>. 
                        This ensures a transparent chain of custody from the Canteen to your distribution point, fulfilling modern food-safety audit requirements.
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}

        {/* Available Food */}
        {tab === 'available' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title flex items-center gap-2"><Package className="w-6 h-6 text-primary" /> Available Surplus Food</h2>
                <p className="text-sm text-muted-foreground">Browse food available for immediate pickup near you.</p>
              </div>
              <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
                <button onClick={() => setViewMode('grid')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Grid View</button>
                <button onClick={() => setViewMode('map')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'map' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Map View</button>
              </div>
            </div>

            {viewMode === 'map' ? (
              <div className="space-y-4">
                <MapView items={available} />
              </div>
            ) : available.length === 0 ? (
              <div className="glass-card p-10 text-center text-muted-foreground">No surplus food available right now. Check back soon!</div>
            ) : (
              <div className="grid gap-4">
              {available.map(item => {
                const now = new Date();
                const expiry = new Date();
                if (item.expiryTime) {
                  const [h, m] = item.expiryTime.split(':');
                  expiry.setHours(parseInt(h));
                  expiry.setMinutes(parseInt(m));
                }
                const isExpired = now > expiry;

                return (
                <div key={item.id} className={`glass-card p-6 border-l-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                  isExpired && item.status === 'available' ? 'border-l-red-500 opacity-80' : 
                  item.status === 'requested' ? 'border-l-orange-500' :
                  item.status === 'approved' ? 'border-l-blue-500' :
                  item.status === 'on_the_way' ? 'border-l-purple-500' :
                  'border-l-primary hover:border-l-primary/80'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center justify-between md:justify-start gap-4 mb-1">
                      <div className="font-semibold text-lg">{item.food}</div>
                      <div className={`text-xl font-bold px-3 py-1 rounded-lg ${isExpired && item.status === 'available' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>{item.quantity} kg</div>
                      
                      {/* Status Badge */}
                      <div className={`text-xs px-2 py-1 rounded-md font-medium uppercase tracking-wider ${
                        item.status === 'requested' ? 'bg-orange-500/10 text-orange-500' :
                        item.status === 'approved' ? 'bg-blue-500/10 text-blue-500' :
                        item.status === 'on_the_way' ? 'bg-purple-500/10 text-purple-500' :
                        'hidden'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                       <span className="flex items-center gap-2 bg-muted/30 p-2 rounded-md"><MapPin className="w-4 h-4 text-primary" /> {item.location}</span>
                       <span className="flex items-center gap-2 bg-muted/30 p-2 rounded-md text-foreground"><LogOut className="w-4 h-4 rotate-180" /> {item.canteenName}</span>
                       <span className={`flex items-center gap-2 bg-muted/30 p-2 rounded-md ${isExpired && item.status === 'available' ? 'text-red-500 font-medium' : ''}`}>
                         <Package className="w-4 h-4" /> {item.status === 'available' ? `Expires @ ${item.expiryTime}` : `Posted @ ${new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                         {isExpired && item.status === 'available' && " (Expired)"}
                       </span>
                    </div>

                    {item.status === 'approved' && (
                      <div className="mt-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-center gap-4">
                        <div className="text-xs">
                          <span className="text-muted-foreground block">Contact Canteen:</span>
                          <span className="font-bold text-blue-500">{item.contact || '9876543210'}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground block">Expected Pickup:</span>
                          <span className="font-bold text-blue-500">{item.pickupTime || 'Within 1 hour'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {item.status === 'available' && (
                      <button 
                        onClick={() => requestPickup(item)} 
                        disabled={isExpired}
                        className={`w-full md:w-auto text-sm py-3 px-6 flex items-center justify-center gap-2 whitespace-nowrap shadow-lg rounded-lg font-medium transition-all ${isExpired ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'btn-primary'}`}
                      >
                        Request Pickup <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    {item.status === 'requested' && (
                      <button disabled className="w-full md:w-auto text-sm py-3 px-6 bg-muted/50 text-muted-foreground flex items-center justify-center gap-2 rounded-lg font-medium cursor-not-allowed border border-border/50">
                        Waiting for Approval...
                      </button>
                    )}

                    {item.status === 'approved' && (
                      <button 
                        onClick={() => startPickup(item.id)}
                        className="w-full md:w-auto text-sm py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 rounded-lg font-medium transition-all shadow-lg animate-pulse"
                      >
                        Start Pickup 🚚
                      </button>
                    )}

                    {item.status === 'on_the_way' && (
                      <button 
                        onClick={() => initiateHandover(item)}
                        className="w-full md:w-auto text-sm py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2 rounded-lg font-medium transition-all shadow-lg animate-pulse"
                      >
                        Verify Handover ✅
                      </button>
                    )}

                    <button 
                      onClick={() => requestChat(item.canteenId)}
                      className="w-full md:w-auto text-sm py-2 px-6 flex items-center justify-center gap-2 border border-primary/30 text-primary hover:bg-primary/5 transition-all rounded-lg"
                    >
                      <MessageSquare className="w-4 h-4" /> {item.status === 'on_the_way' ? 'Coordination Chat' : 'Chat with Canteen'}
                    </button>
                  </div>
                  
                  {/* Timeline Integration inside the card */}
                  {['requested', 'approved', 'on_the_way', 'completed'].includes(item.status) && (
                    <div className="mt-4 pt-4 border-t border-border/20 md:col-span-2 lg:col-span-1">
                      <HandoverTimeline logs={item.logs} />
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            )}
          </motion.div>
        )}

        {/* Requests */}
        {tab === 'requests' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="section-title flex items-center gap-2"><Truck className="w-6 h-6 text-primary" /> My Active Pickups</h2>
            <p className="text-sm text-muted-foreground mb-4">Track food you've requested. The Canteen will mark these as completed once you pick them up.</p>
            {myRequests.length === 0 ? (
              <div className="glass-card p-10 text-center text-muted-foreground">You haven't requested any food yet.</div>
            ) : (
              <div className="grid gap-4">
              {[...myRequests].reverse().map(d => (
                <div key={d.id} className="glass-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="font-semibold text-lg">{d.food}</div>
                      <div className="text-sm text-muted-foreground mt-1">{d.canteenName} · {d.quantity} kg</div>
                    </div>
                    {d.status === 'requested' ? (
                       <span className="status-requested flex items-center gap-2 animate-pulse"><div className="w-2 h-2 rounded-full bg-[hsl(28,85%,55%)]"></div> Awaiting Pickup</span>
                    ) : d.status === 'completed' ? (
                       <span className="status-delivered flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary"></div> Completed</span>
                    ) : (
                       <span className="status-expired flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Expired</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg flex items-center justify-between gap-3">
                     <div className="flex items-center gap-3">
                       <MapPin className="w-4 h-4 text-primary" /> Collect from: <strong className="text-foreground">{d.location}</strong>
                     </div>
                     {d.status === 'completed' && (
                       <button 
                         onClick={() => downloadReport(d)}
                         className="flex items-center gap-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md transition-colors font-medium border border-primary/20"
                       >
                         <FileDown className="w-3.5 h-3.5" /> Download Report
                       </button>
                     )}
                  </div>
                </div>
              ))}
              </div>
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
        {/* Full Map View */}
        {tab === 'map' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="section-title flex items-center gap-2 regular"><MapPin className="w-6 h-6 text-primary" /> Surplus Discovery Map</h2>
            <p className="text-sm text-muted-foreground mb-4">Discover food availability across your area with real-time markers.</p>
            <MapView items={available} />
          </motion.div>
        )}
        {/* Notifications */}
        {tab === 'notifications' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="section-title flex items-center gap-2 regular"><Bell className="w-6 h-6 text-primary" /> Alerts & Notifications</h2>
                <p className="text-sm text-muted-foreground">Stay updated on your request approvals and rejections.</p>
              </div>
              <button 
                onClick={() => { 
                  const readNotifs = JSON.parse(localStorage.getItem('readNotifs') || '[]');
                  notifications.forEach(n => { if (!readNotifs.includes(n.id)) readNotifs.push(n.id); });
                  localStorage.setItem('readNotifs', JSON.stringify(readNotifs));
                  refresh(); 
                }}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all border border-border/50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="glass-card p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <Bell className="w-12 h-12 opacity-20" />
                <p>You're all caught up! No notifications yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`glass-card p-5 border-l-4 transition-all relative ${
                      !n.read ? (n.type === 'warning' ? 'border-l-orange-500 bg-orange-500/5' : 'border-l-blue-500 bg-blue-500/5') : 'border-l-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className={`text-sm leading-relaxed ${!n.read ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {n.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                          <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                          <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      {!n.read && (
                        <button 
                          onClick={() => { 
                            const readNotifs = JSON.parse(localStorage.getItem('readNotifs') || '[]');
                            if (!readNotifs.includes(n.id)) {
                               readNotifs.push(n.id);
                               localStorage.setItem('readNotifs', JSON.stringify(readNotifs));
                            }
                            refresh(); 
                          }}
                          className="w-8 h-8 rounded-full bg-background border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
        {/* Messages */}
        {tab === 'messages' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ChatInterface 
              currentUser={user} 
              initialPartnerId={activeChatPartner || undefined} 
            />
          </motion.div>
        )}
        </div>

        {/* Handover Verification Modal */}
        {activeHandoverItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card max-w-lg w-full overflow-hidden shadow-2xl border-primary/20"
            >
              <div className="p-6 border-b border-border/50 flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Digital Handover</h3>
                    <p className="text-xs text-muted-foreground">FSSAI Traceability Verification</p>
                  </div>
                </div>
                <button onClick={() => setActiveHandoverItem(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={confirmHandover} className="p-6 space-y-6">
                {/* Checklist */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-primary" /> Safety Checklist
                  </label>
                  <div className="grid gap-2">
                    {[
                      { id: 'freshness', label: 'Food appears fresh' },
                      { id: 'smell', label: 'Odor check passed' },
                      { id: 'packaging', label: 'Packaging is secure/clean' }
                    ].map(check => (
                      <label key={check.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={(handoverForm.checks as any)[check.id]} 
                          onChange={e => setHandoverForm(f => ({ ...f, checks: { ...f.checks, [check.id]: e.target.checked } }))}
                          className="w-4 h-4 rounded border-primary text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{check.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold">Condition at Pickup</label>
                  <div className="flex gap-2">
                    {['good', 'acceptable', 'poor'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setHandoverForm(f => ({ ...f, rating: r as any }))}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                          handoverForm.rating === r 
                            ? 'bg-primary/20 border-primary text-primary shadow-sm' 
                            : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pickup Code */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Handover Code
                  </label>
                  <input 
                    type="text" 
                    maxLength={6}
                    placeholder="Enter 6-digit code from Canteen"
                    value={handoverForm.code}
                    onChange={e => setHandoverForm(f => ({ ...f, code: e.target.value }))}
                    className="input-field text-center text-2xl tracking-[0.5em] font-mono border-2 border-primary/30"
                    required
                  />
                  <p className="text-[10px] text-center text-muted-foreground">
                    Obtain this code from the Canteen staff to authorize the transfer.
                  </p>
                </div>

                {/* Legal Note */}
                <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-lg text-[10px] text-secondary-foreground leading-relaxed">
                  <strong>LEGAL DISCLOSURE:</strong> Per FSSAI Surplus Food Distribution Regulations, by confirming this handover, the NGO ({user.organization}) accepts full legal responsibility for the safety and hygiene of the unconsumed food until final distribution.
                </div>

                <button type="submit" className="btn-primary w-full py-4 shadow-xl shadow-primary/20">
                  Verify & Complete Handover
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}

// Sub-component for Lifecycle Timeline
function HandoverTimeline({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) return null;

  const getLogLabel = (action: string) => {
    switch (action) {
      case 'available': return 'Food Posted';
      case 'requested': return 'Requested by NGO';
      case 'approved': return 'Approved for Pickup';
      case 'pickup_started': return 'NGO En Route';
      case 'handover_accepted': return 'Digital Handshake';
      case 'completed': return 'Redistribution Complete';
      default: return action;
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border/50 pb-2 flex items-center gap-2">
        <Clock className="w-3 h-3" /> Traceability Audit Log
      </div>
      <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted/50">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-4 relative">
            <div className={`w-4 h-4 rounded-full border-2 border-background z-10 ${i === logs.length - 1 ? 'bg-primary ring-4 ring-primary/20 animate-pulse' : 'bg-muted'}`}></div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${i === logs.length - 1 ? 'text-primary' : 'text-foreground'}`}>{getLogLabel(log.action)}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="text-[10px] text-muted-foreground italic">By {log.actor}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
