'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

// Only show in development
const isDevelopment = process.env.NODE_ENV === 'development';

interface TestUser {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface CreateUserResponse {
  success: boolean;
  user?: TestUser;
  credentials?: { email: string; password: string };
  login_url?: string;
  message?: string;
  error?: string;
}

export function TestUserCreator() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<TestUser[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'guest' as 'host' | 'guest' | 'admin',
    phone: '',
  });

  // Early return after all hooks are declared
  if (!isDevelopment) return null;

  const createUser = async () => {
    if (!formData.name || !formData.email) {
      setMessage('❌ Name and email are required');
      return;
    }

    setLoading(true);
    setMessage('Creating user...');

    try {
      const response = await fetch('/api/admin/test-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result: CreateUserResponse = await response.json();

      if (result.success && result.credentials) {
        setMessage(
          `✅ Created ${result.user?.name}! Password: ${result.credentials.password}`,
        );

        // Reset form
        setFormData({ name: '', email: '', role: 'guest', phone: '' });

        // Auto-refresh user list if it's showing
        if (showUsers) {
          await loadUsers();
        }
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const createScenario = async (scenarioName: string) => {
    setLoading(true);
    setMessage(`Creating ${scenarioName} scenario...`);

    try {
      // For now, just create a basic wedding host
      const hostData = {
        name: `${scenarioName} Host`,
        email: `${scenarioName.toLowerCase().replace(/\s+/g, '.')}.host@test.local`,
        role: 'host' as const,
        phone: `+1555${Math.floor(Math.random() * 9000000) + 1000000}`,
      };

      const response = await fetch('/api/admin/test-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hostData),
      });

      const result: CreateUserResponse = await response.json();

      if (result.success) {
        setMessage(
          `✅ Created ${scenarioName} scenario! Check console for details.`,
        );
        console.log('Created user:', result);

        if (showUsers) await loadUsers();
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/test-users');
      const result = await response.json();

      if (result.success) {
        setUsers(result.users || []);
        setShowUsers(true);
      } else {
        setMessage(`❌ Error loading users: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error}`);
    }
  };

  const cleanupUsers = async () => {
    if (!confirm('Delete all test users? This cannot be undone.')) return;

    setLoading(true);
    setMessage('Deleting test users...');

    try {
      const response = await fetch('/api/admin/test-users?all=true', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setMessage(`✅ ${result.message}`);
        setUsers([]);
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-amber-900 font-semibold shadow-lg"
        >
          🧪 Test Users
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white border-2 border-amber-400 rounded-lg shadow-xl p-4 max-w-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-amber-800 flex items-center gap-2">
          🧪 Test User Creator
          <span className="text-xs bg-amber-100 px-2 py-1 rounded">DEV</span>
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-amber-600 hover:text-amber-800 text-xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => createScenario('Wedding')}
            disabled={loading}
            size="sm"
            className="text-xs"
          >
            👰 Wedding Host
          </Button>
          <Button
            onClick={() => createScenario('Birthday')}
            disabled={loading}
            size="sm"
            className="text-xs"
          >
            🎂 Birthday Host
          </Button>
        </div>

        {/* Custom User Form */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-2 py-1 border border-stone-300 rounded text-sm"
            disabled={loading}
          />
          <input
            type="email"
            placeholder="email@test.local"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="w-full px-2 py-1 border border-stone-300 rounded text-sm"
            disabled={loading}
          />
          <div className="flex gap-2">
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  role: e.target.value as 'host' | 'guest' | 'admin',
                })
              }
              className="flex-1 px-2 py-1 border border-stone-300 rounded text-sm"
              disabled={loading}
            >
              <option value="guest">Guest</option>
              <option value="host">Host</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              onClick={createUser}
              disabled={loading || !formData.name || !formData.email}
              size="sm"
              className="text-xs"
            >
              Create
            </Button>
          </div>
        </div>

        {/* Management Actions */}
        <div className="flex gap-2 pt-2 border-t border-amber-200">
          <Button
            onClick={loadUsers}
            disabled={loading}
            size="sm"
            variant="outline"
            className="text-xs flex-1"
          >
            {showUsers ? 'Refresh' : 'List Users'}
          </Button>
          <Button
            onClick={cleanupUsers}
            disabled={loading}
            size="sm"
            variant="outline"
            className="text-xs text-red-600 hover:text-red-700"
          >
            Cleanup
          </Button>
        </div>

        {/* Message Display */}
        {message && (
          <div
            className={`text-xs p-2 rounded ${
              message.includes('✅')
                ? 'bg-green-50 text-green-700'
                : message.includes('❌')
                  ? 'bg-red-50 text-red-700'
                  : 'bg-blue-50 text-blue-700'
            }`}
          >
            {message}
          </div>
        )}

        {/* User List */}
        {showUsers && (
          <div className="max-h-40 overflow-y-auto border border-stone-200 rounded">
            {users.length === 0 ? (
              <div className="p-2 text-xs text-stone-500 text-center">
                No test users found
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="text-xs border-b border-stone-100 pb-1"
                  >
                    <div className="font-medium">{user.name}</div>
                    <div className="text-stone-500">
                      {user.email} ({user.role})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Auto-show in development if not in production build
export function DevToolsProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TestUserCreator />
    </>
  );
}
