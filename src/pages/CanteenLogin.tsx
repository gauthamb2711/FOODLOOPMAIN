import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Leaf, ShieldCheck, ChefHat } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function CanteenLogin() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      await api.get('/auth/seed');
      const err = await login('demo-canteen@foodloop.com', 'demo123', false);
      if (err) { toast.error(err); }
      else {
        toast.success(`Logged in as Demo Canteen`);
        navigate('/canteen');
      }
    } catch (e: any) {
      toast.error('Failed to seed/login: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const err = await login(identifier, password, false);
    setLoading(false);
    
    if (err) { toast.error(err); return; }
    
    toast.success('Welcome back to Canteen Dashboard!');
    navigate('/canteen');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4 border border-primary/30 shadow-lg shadow-primary/20">
            <ChefHat className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black gradient-text tracking-tight">Canteen Portal</h1>
          <p className="text-muted-foreground mt-2 font-medium">Manage surplus and track impact.</p>
        </div>
        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5 border border-primary/20 shadow-xl shadow-primary/5">
          <div>
            <label className="block text-sm font-bold text-primary/80 uppercase tracking-widest mb-2">Email address</label>
            <input type="email" value={identifier} onChange={e => setIdentifier(e.target.value)} className="input-field border-primary/30 focus:border-primary focus:ring-primary" placeholder="canteen@demo.com" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-primary/80 uppercase tracking-widest mb-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field border-primary/30 focus:border-primary focus:ring-primary" placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn-primary w-full shadow-lg shadow-primary/30" disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase font-black tracking-widest"><span className="bg-card px-3 text-muted-foreground">Demo Access</span></div>
          </div>

          <button type="button" onClick={handleDemoLogin} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-sm font-bold transition-all text-primary">
            <ShieldCheck className="w-5 h-5" /> Launch Canteen Demo
          </button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            New Canteen? <Link to="/canteen/register" className="text-primary font-bold hover:underline">Register Here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
