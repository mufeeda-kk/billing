import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StaffProfile } from '../types';
import { getSupabase, isSupabaseConfigured, ensureAnonymousSession } from '../lib/supabase';

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
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isDeviceAuthorized, setIsDeviceAuthorized] = useState(false);
  const [deviceSlot, setDeviceSlot] = useState<number | null>(null);
  const [deviceName, setDeviceName] = useState<string>('Shop Device');

  // Check device status against Supabase PostgreSQL
  const checkStatus = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsCheckingAuth(false);
      setIsDeviceAuthorized(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setIsCheckingAuth(false);
      setIsDeviceAuthorized(false);
      return;
    }

    try {
      // 1. Ensure an anonymous session is active on this device
      await ensureAnonymousSession();

      // 2. Call check_device_status RPC
      const { data, error } = await supabase.rpc('check_device_status');

      if (!error && data && data.is_authorized) {
        setIsDeviceAuthorized(true);
        setDeviceSlot(data.slot || null);
        setDeviceName(data.device_name || `Phone ${data.slot || ''}`);
      } else {
        setIsDeviceAuthorized(false);
        setDeviceSlot(null);
      }
    } catch (err) {
      console.warn('Error checking device authorization:', err);
      setIsDeviceAuthorized(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    // Recheck status on window focus or network reconnect
    const handleRecheck = () => {
      checkStatus();
    };

    window.addEventListener('online', handleRecheck);
    window.addEventListener('focus', handleRecheck);

    return () => {
      window.removeEventListener('online', handleRecheck);
      window.removeEventListener('focus', handleRecheck);
    };
  }, [checkStatus]);

  // One-time device enrollment
  const enrollDevice = async (
    slot: number,
    name: string,
    secret: string
  ): Promise<{ success: boolean; message: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, message: 'Cloud database is not configured in .env or Settings.' };
    }

    try {
      await ensureAnonymousSession();

      const { data, error } = await supabase.rpc('enroll_device', {
        p_slot_number: slot,
        p_device_name: name,
        p_secret: secret
      });

      if (error) {
        return { success: false, message: error.message };
      }

      if (data && data.success) {
        setIsDeviceAuthorized(true);
        setDeviceSlot(slot);
        setDeviceName(name);
        return { success: true, message: data.message || 'Device authorized successfully.' };
      }

      return { success: false, message: 'Unexpected response during device enrollment.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Enrollment failed.' };
    }
  };

  // Device revocation
  const revokeDevice = async (
    slot: number,
    secret: string
  ): Promise<{ success: boolean; message: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, message: 'Cloud database is not configured.' };
    }

    try {
      const { data, error } = await supabase.rpc('revoke_device_slot', {
        p_slot_number: slot,
        p_secret: secret
      });

      if (error) {
        return { success: false, message: error.message };
      }

      await checkStatus();
      return { success: true, message: data?.message || 'Device slot revoked.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Revocation failed.' };
    }
  };

  const currentUser: StaffProfile = {
    id: `device-slot-${deviceSlot || 'unregistered'}`,
    email: `${deviceName.toLowerCase().replace(/[^a-z0-9]/g, '')}@vintageclothing.in`,
    full_name: deviceName,
    role: deviceSlot === 1 ? 'owner' : 'staff',
    is_active: isDeviceAuthorized,
    created_at: new Date().toISOString()
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isOwner: deviceSlot === 1 || !isDeviceAuthorized,
      isDeviceAuthorized,
      isCheckingAuth,
      deviceSlot,
      deviceName,
      enrollDevice,
      revokeDevice,
      refreshDeviceStatus: checkStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
