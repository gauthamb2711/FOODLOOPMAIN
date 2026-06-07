import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChefHat, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function CanteenRegister() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'canteen' as const, organization: '', location: '' });
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await register({ ...form });
    setLoading(false);
    
    if (error) { 
        if (error.toLowerCase().includes('already exists')) {
            toast.error(error, {
                description: "Try logging in instead.",
                action: { label: "Login", onClick: () => navigate('/canteen/login') }
            });
        } else {
            toast.error(error); 
        }
        return; 
    }
    toast.success('Canteen Account created successfully!');
    navigate('/canteen');
  };

  const u = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md relative">
        <Link to="/" className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4 border border-primary/30 shadow-lg shadow-primary/20">
            <ChefHat className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black gradient-text tracking-tight">Register Canteen</h1>
          <p className="text-muted-foreground mt-2 font-medium">Join the FoodLoop network.</p>
        </div>
        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-4 border border-primary/20 shadow-xl shadow-primary/5">
          <div>
            <label className="block text-xs font-bold text-primary/80 uppercase tracking-widest mb-1.5">Full Name</label>
            <input value={form.name} onChange={e => u('name', e.target.value)} className="input-field border-primary/30 focus:border-primary focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-primary/80 uppercase tracking-widest mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => u('email', e.target.value)} className="input-field border-primary/30 focus:border-primary focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-primary/80 uppercase tracking-widest mb-1.5">Password</label>
            <input type="password" value={form.password} onChange={e => u('password', e.target.value)} className="input-field border-primary/30 focus:border-primary focus:ring-primary" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-primary/80 uppercase tracking-widest mb-1.5">Canteen / Org. Name</label>
            <input value={form.organization} onChange={e => u('organization', e.target.value)} className="input-field border-primary/30 focus:border-primary focus:ring-primary" placeholder="e.g. Central Kitchen Campus A" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-primary/80 uppercase tracking-widest mb-1.5">City Location</label>
            <input value={form.location} onChange={e => u('location', e.target.value)} className="input-field border-primary/30 focus:border-primary focus:ring-primary" placeholder="e.g. Mumbai Central" required />
          </div>
          <button type="submit" className="btn-primary w-full mt-4 shadow-lg shadow-primary/30" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Already registered? <Link to="/canteen/login" className="text-primary font-bold hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
