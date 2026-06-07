import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Leaf } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'canteen' as 'canteen' | 'ngo', organization: '', location: '', capacity: '', reg_no: '', ngoType: 'Trust', phone: '', address: '' });
  const { register } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, status } = await register({
      ...form,
      capacity: form.role === 'ngo' ? Number(form.capacity) || 100 : undefined,
    });
    setLoading(false);
    if (error) { 
        if (error.toLowerCase().includes('already exists')) {
            toast.error(error, {
                description: "Try logging in instead.",
                action: {
                    label: "Login",
                    onClick: () => navigate('/login')
                }
            });
        } else {
            toast.error(error); 
        }
        return; 
    }
    toast.success('Account created' + (form.role === 'ngo' ? ' and Verified!' : '!'));
    navigate(form.role === 'canteen' ? '/canteen' : '/ngo');
  };

  const u = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Join FoodLoop AI</h1>
          <p className="text-muted-foreground mt-1">Create your account</p>
        </div>
        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">I am a</label>
            <div className="grid grid-cols-2 gap-3">
              {(['canteen', 'ngo'] as const).map(r => (
                <button key={r} type="button" onClick={() => u('role', r)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${form.role === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
                  {r === 'canteen' ? '🍽️ Canteen Admin' : '🤝 NGO Admin'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name</label>
            <input value={form.name} onChange={e => u('name', e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => u('email', e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input type="password" value={form.password} onChange={e => u('password', e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Organization Name</label>
            <input value={form.organization} onChange={e => u('organization', e.target.value)} className="input-field" required />
          </div>
          {form.role === 'canteen' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input value={form.location} onChange={e => u('location', e.target.value)} className="input-field" placeholder="e.g. Mumbai Central" required={form.role === 'canteen'} />
            </div>
          )}
          {form.role === 'ngo' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Registration Number</label>
                <input value={form.reg_no} onChange={e => u('reg_no', e.target.value)} className="input-field" placeholder="NGO123" required={form.role === 'ngo'} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">NGO Type</label>
                <select value={form.ngoType} onChange={e => u('ngoType', e.target.value)} className="input-field" required={form.role === 'ngo'}>
                  <option value="Trust">Trust</option>
                  <option value="Society">Society</option>
                  <option value="Section 8">Section 8</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone</label>
                <input type="tel" value={form.phone} onChange={e => u('phone', e.target.value)} className="input-field" placeholder="1234567890" required={form.role === 'ngo'} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Address</label>
                <input value={form.address} onChange={e => u('address', e.target.value)} className="input-field" placeholder="e.g. Mumbai South" required={form.role === 'ngo'} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Capacity (meals/day)</label>
                <input type="number" value={form.capacity} onChange={e => u('capacity', e.target.value)} className="input-field" placeholder="200" />
              </div>
            </>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
