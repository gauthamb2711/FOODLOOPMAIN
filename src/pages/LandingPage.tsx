import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getMetrics, initSeedData } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { Leaf, Users, Building2, Truck, BarChart3, Brain, ArrowRight, Recycle } from 'lucide-react';

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);
  return <span className="mono">{count.toLocaleString()}{suffix}</span>;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({ totalFoodSaved: 0, mealsRedistributed: 0, activeCanteens: 0, ngosConnected: 0 });

  useEffect(() => {
    initSeedData();
    setMetrics(getMetrics());
  }, []);

  useEffect(() => {
    if (user) navigate(user.role === 'canteen' ? '/canteen' : '/ngo');
  }, [user, navigate]);

  const features = [
    { icon: Brain, title: 'AI Prediction Engine', desc: 'Forecast footfall and food demand with trend-based algorithms' },
    { icon: Recycle, title: 'Surplus Detection', desc: 'Automatically detect and flag excess food for redistribution' },
    { icon: Users, title: 'NGO Matching', desc: 'Smart matching connects surplus food with nearby organizations' },
    { icon: Truck, title: 'Logistics Tracking', desc: 'Real-time delivery coordination from kitchen to community' },
    { icon: BarChart3, title: 'Impact Analytics', desc: 'Track waste reduction, meals provided, and environmental impact' },
    { icon: Leaf, title: 'Smart Recommendations', desc: 'Data-driven suggestions to optimize food preparation' },
  ];

  const stats = [
    { label: 'Food Saved', value: metrics.totalFoodSaved || 45, suffix: ' kg' },
    { label: 'Meals Provided', value: metrics.mealsRedistributed || 90, suffix: '' },
    { label: 'Active Canteens', value: metrics.activeCanteens || 1, suffix: '' },
    { label: 'NGOs Connected', value: metrics.ngosConnected || 1, suffix: '' },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold gradient-text">Food Loop</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 mr-4 border-r border-border/50 pr-4">
              <button onClick={() => navigate('/canteen/login')} className="text-xs font-semibold hover:text-primary transition-colors">Canteen Login</button>
              <button onClick={() => navigate('/ngo/login')} className="text-xs font-semibold hover:text-blue-500 transition-colors">NGO Login</button>
            </div>
            <button onClick={() => navigate('/canteen/register')} className="btn-primary text-sm py-2 px-4">Register Canteen</button>
            <button onClick={() => navigate('/ngo/register')} className="btn-ghost border-blue-500 text-blue-500 hover:bg-blue-500/10 text-sm py-2 px-4">Register NGO</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative">
        <div className="absolute inset-0 opacity-30" style={{ background: 'var(--gradient-glow)' }} />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
              <span className="pulse-dot" />
              <span className="text-sm text-primary font-medium">Live System Active</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
              <span className="gradient-text">Zero Waste.</span>
              <br />
              <span className="text-foreground">Full Impact.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              AI-powered food waste prediction and redistribution network connecting canteens with NGOs to ensure no meal goes to waste.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => navigate('/canteen/register')} className="btn-primary text-base flex items-center justify-center gap-2">
                Join as Canteen <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => navigate('/ngo/register')} className="btn-ghost border-blue-500 text-blue-500 hover:bg-blue-500/10 text-base">
                Join as NGO Network
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="stat-card text-center"
            >
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Integrated System Modules</h2>
            <p className="text-muted-foreground">Every component works together seamlessly</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="glass-card p-6 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto glass-card p-10 text-center glow-border">
          <h2 className="text-3xl font-bold mb-3">Ready to Make an Impact?</h2>
          <p className="text-muted-foreground mb-6">Join the food waste reduction network today</p>
          <div className="flex justify-center gap-4">
            <button onClick={() => navigate('/canteen/register')} className="btn-primary text-base">
              Register Canteen
            </button>
            <button onClick={() => navigate('/ngo/register')} className="btn-primary bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] text-base">
              Register NGO
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" />
            <span>Food Loop</span>
          </div>
          <span>Reducing food waste with technology</span>
        </div>
      </footer>
    </div>
  );
}
