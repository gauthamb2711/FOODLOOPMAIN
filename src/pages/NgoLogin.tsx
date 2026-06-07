import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck, HeartHandshake } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function NgoLogin() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      await api.get('/auth/seed');
      const err = await login('demo-ngo@foodloop.com', 'demo123', true);
      if (err) { toast.error(err); }
      else {
        toast.success(`Logged in as Demo NGO`);
        navigate('/ngo');
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
    const err = await login(identifier, password, true);
    setLoading(false);
    
    if (err) { toast.error(err); return; }
    
    toast.success('Welcome back, verified NGO partner!');
    navigate('/ngo');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 selection:bg-blue-500/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-lg shadow-blue-500/20">
            <HeartHandshake className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-cyan-400 tracking-tight">NGO Portal</h1>
          <p className="text-slate-400 mt-2 font-medium">Coordinate food rescue operations.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 space-y-5 border border-blue-500/20 shadow-2xl shadow-blue-500/5">
          <div>
            <label className="block text-sm font-bold text-blue-400/80 uppercase tracking-widest mb-2">Registration ID / Email</label>
            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono" placeholder="NGO123 or email" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-blue-400/80 uppercase tracking-widest mb-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono" placeholder="••••••••" required />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-lg shadow-blue-500/30 duration-300 transform hover:-translate-y-0.5" disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Mission Access'}
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-800" /></div>
            <div className="relative flex justify-center text-xs uppercase font-black tracking-widest"><span className="bg-slate-900 px-3 text-slate-500">Demo Access</span></div>
          </div>

          <button type="button" onClick={handleDemoLogin} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-sm font-bold transition-all text-orange-400">
            <ShieldCheck className="w-5 h-5" /> Launch NGO Demo
          </button>

          <p className="text-center text-sm text-slate-400 mt-6">
            Not registered? <Link to="/ngo/register" className="text-blue-400 font-bold hover:underline">Apply as NGO</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
