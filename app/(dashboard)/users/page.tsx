'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/components/user-context';
import { Users, Plus, Trash2, User } from 'lucide-react';

interface UserType {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { isAdmin, currentUser } = useUser();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ name: '', email: '' });

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (Array.isArray(data)) {
      setUsers(data);
    }
    setLoading(false);
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email) return;
    
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    
    if (res.ok) {
      setNewUser({ name: '', email: '' });
      fetchUsers();
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    
    await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    
    fetchUsers();
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-zinc-400 mt-1">Manage team members and their access</p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="bg-zinc-950 border-zinc-800 text-white"
            />
            <Input
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="bg-zinc-950 border-zinc-800 text-white"
            />
            <Button onClick={createUser} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {loading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : (
          users.map((user) => (
            <Card key={user.id} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{user.name}</h3>
                      <p className="text-zinc-400 text-sm">{user.email}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 mt-1">
                        {user.role}
                      </span>
                    </div>
                  </div>
                  
                  {user.id !== currentUser?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteUser(user.id)}
                      className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
