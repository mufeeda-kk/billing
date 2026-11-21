import React, { createContext, useContext, useState, useEffect } from 'react';
import { StaffProfile } from '../types';

export const AUTHORIZED_STAFF: StaffProfile[] = [
  {
    id: 'staff-1',
    email: 'staff1@vintageclothing.in',
    full_name: 'Vintage Staff 1',
    role: 'staff',
    pin_code: '1111',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'staff-2',
    email: 'staff2@vintageclothing.in',
    full_name: 'Vintage Staff 2',
    role: 'staff',
    pin_code: '2222',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'staff-3',
    email: 'owner@vintageclothing.in',
    full_name: 'Store Owner',
    role: 'owner',
    pin_code: '9999',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

interface AuthContextType {
  currentUser: StaffProfile;
  allStaff: StaffProfile[];
  switchUser: (staffId: string) => void;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<StaffProfile>(() => {
    const saved = localStorage.getItem('vcs_active_user_id');
    const found = AUTHORIZED_STAFF.find(s => s.id === saved);
    return found || AUTHORIZED_STAFF[0];
  });

  const switchUser = (staffId: string) => {
    const found = AUTHORIZED_STAFF.find(s => s.id === staffId);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem('vcs_active_user_id', found.id);
    }
  };

  const isOwner = currentUser.role === 'owner';

  return (
    <AuthContext.Provider value={{ currentUser, allStaff: AUTHORIZED_STAFF, switchUser, isOwner }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
