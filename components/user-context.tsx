'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface UserContextType {
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  isAdmin: boolean;
  loading: boolean;
  fetchWithUser: (url: string, options?: RequestInit) => Promise<Response>;
}

const UserContext = createContext<UserContextType>({
  users: [],
  currentUser: null,
  setCurrentUser: () => {},
  isAdmin: false,
  loading: true,
  fetchWithUser: () => Promise.resolve(new Response()),
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
          const saved = localStorage.getItem('currentUserId');
          const initial = saved 
            ? data.find((u: User) => u.id === parseInt(saved)) 
            : data[0];
          if (initial) setCurrentUser(initial);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSetCurrentUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUserId', user.id.toString());
    window.location.reload();
  };

  const fetchWithUser = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (currentUser) {
      headers.set('x-user-id', currentUser.id.toString());
    }
    return fetch(url, { ...options, headers });
  };

  return (
    <UserContext.Provider value={{
      users,
      currentUser,
      setCurrentUser: handleSetCurrentUser,
      isAdmin: currentUser?.role === 'admin',
      loading,
      fetchWithUser,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
