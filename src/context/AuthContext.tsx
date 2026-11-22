import React, { createContext, useContext, useMemo } from 'react';
import { StaffProfile } from '../types';

interface AuthContextType {
  currentUser: StaffProfile;
  isOwner: boolean;
  isDeviceAuthorized: boolean;
  isCheckingAuth: boolean;
  deviceSlot: number | null;
  deviceName: string;
  enrollDevice: (slot: number, name: string, secret: string) => Promise<{ success: boolean; message: string }>;
  revokeDevice: (slot: number, secret: string) => Promise<{ success: boolean; message: string }>;
  refreshDeviceStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentUser: StaffProfile = useMemo(() => ({
    id: 'shop-terminal',
    email: 'staff@vintageclothing.in',
    full_name: 'Shop Staff',
    role: 'owner',
    is_active: true,
    created_at: new Date().toISOString()
  }), []);

  const value = useMemo(() => ({
    currentUser,
    isOwner: true,
    isDeviceAuthorized: true,
    isCheckingAuth: false,
    deviceSlot: 1,
    deviceName: 'Shop Staff',
    enrollDevice: async () => ({ success: true, message: 'Public cloud mode active' }),
    revokeDevice: async () => ({ success: true, message: 'Public cloud mode active' }),
    refreshDeviceStatus: async () => {}
  }), [currentUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
