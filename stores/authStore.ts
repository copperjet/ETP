import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { UserRole, School } from '../types/database';

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  staffId: string | null;
  parentId: string | null;
  roles: UserRole[];
  activeRole: UserRole;
  schoolId: string;
}

interface AuthState {
  user: AuthUser | null;
  school: School | null;
  isLoading: boolean;
  isReady: boolean;
  setUser: (user: AuthUser | null) => void;
  setSchool: (school: School | null) => void;
  setLoading: (v: boolean) => void;
  setReady: (v: boolean) => void;
  switchRole: (role: UserRole) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  school: null,
  isLoading: false,
  isReady: false,
  setUser: (user) => set({ user }),
  setSchool: (school) => set({ school }),
  setLoading: (isLoading) => set({ isLoading }),
  setReady: (isReady) => set({ isReady }),
  switchRole: (role) =>
    set((s) => ({
      user: s.user ? { ...s.user, activeRole: role } : null,
    })),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, school: null });
  },
}));
