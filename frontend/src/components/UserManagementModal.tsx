import React, { useState, useEffect } from 'react';
import { useAuthStore, type User as UserType } from '../store/authStore';
import { UserPlus, X, Check, AlertCircle, Users } from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const { createUser, fetchUsers } = useAuthStore();
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Admin' | 'User'>('User');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    const data = await fetchUsers();
    setUsersList(data);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setIsSubmitting(true);

    const success = await createUser(username, email, password, role);
    setIsSubmitting(false);

    if (success) {
      setStatusMsg({ type: 'success', text: `User '${username}' created successfully!` });
      setUsername('');
      setEmail('');
      setPassword('');
      loadUsers();
    } else {
      setStatusMsg({ type: 'error', text: 'Failed to create user. Username/Email might already exist.' });
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-indigo-900/50 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">User Management (Admin)</h3>
            <p className="text-xs text-gray-400">Manually register users who can log in to the server</p>
          </div>
        </div>

        {statusMsg && (
          <div className={`mb-4 p-3 rounded-xl text-xs flex items-center space-x-2 border ${
            statusMsg.type === 'success' 
              ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-200' 
              : 'bg-red-900/40 border-red-500/50 text-red-200'
          }`}>
            {statusMsg.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden flex-1">
          {/* Create User Form */}
          <form onSubmit={handleSubmit} className="space-y-3 bg-gray-950 p-4 rounded-xl border border-gray-850">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <UserPlus className="w-4 h-4 text-indigo-400" />
              <span>Register New User</span>
            </h4>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="johndoe"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Initial Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="User">User (Standard)</option>
                <option value="Admin">Administrator</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Creating...' : 'Create Account'}</span>
            </button>
          </form>

          {/* Registered Users List */}
          <div className="flex flex-col bg-gray-950 p-4 rounded-xl border border-gray-850 overflow-hidden">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Registered Users ({usersList.length})</h4>
            <div className="flex-1 overflow-auto space-y-2 pr-1">
              {usersList.map((u) => (
                <div key={u.id} className="p-2.5 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-gray-200 block">{u.username}</span>
                    <span className="text-[10px] text-gray-500">{u.email}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    u.role === 'Admin' ? 'bg-purple-900/60 text-purple-300 border border-purple-500/30' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
