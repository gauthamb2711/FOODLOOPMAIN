import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/lib/store';
import { loginUser, registerUser } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  login: (identifier: string, password?: string, isNgo?: boolean) => Promise<string | null>;
  register: (user: Omit<User, 'id'>) => Promise<{ error: string | null; status?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Rehydrate user from memory
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse user', e);
    }
  }, []);

  const login = async (identifier: string, password?: string, isNgo?: boolean): Promise<string | null> => {
    try {
      const res = await loginUser({ email: identifier, password });
      const { token, ...userData } = res.data;
      
      if (isNgo && userData.role !== 'ngo') return 'Invalid NGO credentials';
      if (!isNgo && userData.role !== 'canteen') return 'Invalid Canteen credentials';

      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', JSON.stringify({ ...userData, id: userData._id }));
      setUser({ ...userData, id: userData._id });
      return null;
    } catch (err: any) {
      return err.response?.data?.message || 'Login failed Check backend connection';
    }
  };

  const register = async (userData: Omit<User, 'id'>): Promise<{ error: string | null; status?: string }> => {
    try {
      const res = await registerUser(userData);
      const { token, ...newUserData } = res.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', JSON.stringify({ ...newUserData, id: newUserData._id }));
      setUser({ ...newUserData, id: newUserData._id });
      return { error: null, status: newUserData.status };
    } catch (err: any) {
      return { error: err.response?.data?.message || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
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
