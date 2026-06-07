import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { HeartHandshake, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function NgoRegister() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'ngo' as const, organization: '', capacity: '', reg_no: '', ngoType: 'Trust', phone: '', address: '' });
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await register({
      ...form,
      capacity: Number(form.capacity) || 100,
    });
    setLoading(false);
    
    if (error) { 
        if (error.toLowerCase().includes('already exists')) {
            toast.error(error, {
                description: "Try logging in instead.",
                action: { label: "Login", onClick: () => navigate('/ngo/login') }
            });
        } else {
            toast.error(error); 
        }
        return; 
    }
    toast.success('NGO Account created and Verified!');
    navigate('/ngo');
  };

  const u = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="min-h-screen bg-slate-950 flex shadow-2xl shadow-blue-500/5 items-center justify-center px-6 py-10 selection:bg-blue-500/30">
      <div className="w-full max-w-lg relative">
        <Link to="/" className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-400 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-lg shadow-blue-500/20">
            <HeartHandshake className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-cyan-400 tracking-tight">NGO Application</h1>
          <p className="text-slate-400 mt-2 font-medium">Join us to rescue surplus food.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 space-y-4 border border-blue-500/20 shadow-2xl shadow-blue-500/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5">Full Name / Representative</label>
              <input value={form.name} onChange={e => u('name', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm" required />
            </div>
            <div>
              <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5">Work Email</label>
              <input type="email" value={form.email} onChange={e => u('email', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm" required />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5">Secure Password</label>
            <input type="password" value={form.password} onChange={e => u('password', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm font-mono" required />
          </div>
          <div>
            <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5">NGO / Trust Name</label>
            <input value={form.organization} onChange={e => u('organization', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm" placeholder="e.g. FeedForward Foundation" required />
          </div>
          
          <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-4">
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-blue-500/10 pb-2">Verification Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5">Registration. No (Govt)</label>
                <input value={form.reg_no} onChange={e => u('reg_no', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm font-mono" placeholder="NGO123" required />
              </div>
              <div>
                <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5">Entity Type</label>
                <select value={form.ngoType} onChange={e => u('ngoType', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm">
                  <option value="Trust">Trust</option>
                  <option value="Society">Society</option>
                  <option value="Section 8">Section 8</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5">Contact Phone</label>
                <input type="tel" value={form.phone} onChange={e => u('phone', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm font-mono" placeholder="+91 9876543210" required />
              </div>
              <div>
                <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5">Max Target Capacity (Meals)</label>
                <input type="number" value={form.capacity} onChange={e => u('capacity', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm font-mono" placeholder="100" required />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-blue-400/80 uppercase tracking-widest mb-1.5">Headquarters Address</label>
              <textarea value={form.address} onChange={e => u('address', e.target.value)} rows={2} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm resize-none" placeholder="Full postal address..." required />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-lg shadow-blue-500/30 duration-300 transform hover:-translate-y-0.5 mt-4" disabled={loading}>
            {loading ? 'Submitting Application...' : 'Submit Application'}
          </button>
          <p className="text-center text-sm text-slate-400 mt-4">
            Already registered? <Link to="/ngo/login" className="text-blue-400 font-bold hover:underline">Log in securely</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
