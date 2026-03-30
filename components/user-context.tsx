'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  team_id: number | null;
  unipile_account_id: string | null;
  pipedrive_api_key: string | null;
  daily_limit: number;
  message_delay_min: number;
  message_delay_max: number;
  send_schedule: any;
}

// viewAs: null = viewing as yourself, number = viewing as that user, 'all' = team aggregate
type ViewAs = null | number | 'all';

interface UserContextType {
  currentUser: User | null;
  isAdmin: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
  // View-as functionality
  viewAs: ViewAs;
  setViewAs: (v: ViewAs) => void;
  viewingUser: User | null; // the user being viewed (or currentUser if null)
  teamUsers: User[];
  isViewingAll: boolean;
  // Helper to append view_as to API calls
  apiQuery: string;
}

const UserContext = createContext<UserContextType>({
  currentUser: null,
  isAdmin: false,
  loading: true,
  refreshUser: async () => {},
  viewAs: null,
  setViewAs: () => {},
  viewingUser: null,
  teamUsers: [],
  isViewingAll: false,
  apiQuery: '',
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewAs, setViewAs] = useState<ViewAs>(null);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        // If admin, fetch team users
        if (user.role === 'admin') {
          const usersRes = await fetch('/api/users');
          if (usersRes.ok) {
            const users = await usersRes.json();
            if (Array.isArray(users)) setTeamUsers(users);
          }
        }
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const isAdmin = currentUser?.role === 'admin';
  const isViewingAll = viewAs === 'all';
  const viewingUser = viewAs === null || viewAs === 'all'
    ? currentUser
    : teamUsers.find(u => u.id === viewAs) || currentUser;

  // Query string to append to API calls
  const apiQuery = viewAs === null ? '' : viewAs === 'all' ? '?view_as=all' : `?view_as=${viewAs}`;

  return (
    <UserContext.Provider value={{
      currentUser,
      isAdmin,
      loading,
      refreshUser: fetchCurrentUser,
      viewAs,
      setViewAs,
      viewingUser,
      teamUsers,
      isViewingAll,
      apiQuery,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
