import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SessionUser {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
}

export interface AuthState {
  user: SessionUser | null;
  isAuthenticated: boolean;
  setUser: (user: SessionUser) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "cb-auth", // localStorage key
      // Only persist the user object, not functions
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
