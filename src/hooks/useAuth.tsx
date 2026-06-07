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

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
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
      const serverMsg = err.response?.data?.message;
      if (serverMsg) return serverMsg;
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        return 'Cannot reach API. Start the backend: cd backend && npm install && npm start';
      }
      return err.message || 'Login failed';
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
      const serverMsg = err.response?.data?.message;
      if (serverMsg) return { error: serverMsg };
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        return { error: 'Cannot reach API. Start the backend: cd backend && npm install && npm start' };
      }
      return { error: err.message || 'Registration failed' };
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
