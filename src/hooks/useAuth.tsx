import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getData, setData, User } from '@/lib/store';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => string | null;
  register: (user: Omit<User, 'id'>) => string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const current = getData<User>('currentUser');
    if (current) setUser(current);
  }, []);

  const login = (email: string, password: string): string | null => {
    const users = getData<User[]>('users') || [];
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) return 'Invalid email or password';
    setData('currentUser', found);
    setUser(found);
    return null;
  };

  const register = (userData: Omit<User, 'id'>): string | null => {
    const users = getData<User[]>('users') || [];
    if (users.find(u => u.email === userData.email)) return 'Email already registered';
    const newUser: User = { ...userData, id: `${userData.role}-${Date.now()}` };
    users.push(newUser);
    setData('users', users);
    setData('currentUser', newUser);
    setUser(newUser);
    return null;
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
