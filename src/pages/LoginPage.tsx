import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Leaf } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = login(email, password);
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
          <h1 className="text-2xl font-bold gradient-text">FoodLoop AI</h1>
          <p className="text-muted-foreground mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="canteen@demo.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="demo123" required />
          </div>
          <button type="submit" className="btn-primary w-full">Sign In</button>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account? <Link to="/register" className="text-primary hover:underline">Register</Link>
          </p>
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs text-muted-foreground text-center">Demo: canteen@demo.com / demo123 or ngo@demo.com / demo123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
