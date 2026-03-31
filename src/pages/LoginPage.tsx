import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Leaf } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [role, setRole] = useState<'canteen' | 'ngo'>('canteen');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const err = await login(identifier, password, role === 'ngo');
    setLoading(false);
    
    if (err) { toast.error(err); return; }
    
    toast.success('Welcome back!');
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    navigate(user.role === 'canteen' ? '/canteen' : '/ngo');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Food Loop</h1>
          <p className="text-muted-foreground mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">I am a</label>
            <div className="grid grid-cols-2 gap-3">
              {(['canteen', 'ngo'] as const).map(r => (
                <button key={r} type="button" onClick={() => { setRole(r); setIdentifier(''); }}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${role === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
                  {r === 'canteen' ? '🍽️ Canteen Admin' : '🤝 NGO Admin'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{role === 'canteen' ? 'Email' : 'Registration Number'}</label>
            <input type={role === 'canteen' ? 'email' : 'text'} value={identifier} onChange={e => setIdentifier(e.target.value)} className="input-field" placeholder={role === 'canteen' ? "canteen@demo.com" : "Reg No. or Email (e.g. chinmayi...)"} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="demo123" required />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account? <Link to="/register" className="text-primary hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
