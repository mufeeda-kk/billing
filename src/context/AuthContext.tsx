import React, { createContext, useContext } from 'react';
import { StaffProfile } from '../types';

export const DEFAULT_STAFF: StaffProfile = {
  id: 'staff-unified',
  email: 'staff@vintageclothing.in',
  full_name: 'Vintage Staff',
  role: 'staff',
  pin_code: '1234',
  is_active: true,
  created_at: new Date().toISOString()
};

interface AuthContextType {
  currentUser: StaffProfile;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthContext.Provider value={{ currentUser: DEFAULT_STAFF, isOwner: true }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
