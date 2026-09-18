import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { User, Lock, AlertCircle, LogIn, Cpu, Network, Layers, ShieldCheck } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    await login(username, password);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-gray-950 text-gray-100 overflow-hidden font-sans" style={{ backgroundColor: '#050508' }}>
      {/* Background glowing gradients & tech elements */}
      <div className="absolute rounded-full pointer-events-none" style={{ top: '-10rem', left: '-10rem', width: '24rem', height: '24rem', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div className="absolute rounded-full pointer-events-none" style={{ bottom: '-10rem', right: '-10rem', width: '24rem', height: '24rem', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none" style={{ width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />

      <div className="max-w-4xl w-full mx-4 grid grid-cols-1 md:grid-cols-2 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden relative" style={{ backgroundColor: 'rgba(14, 18, 26, 0.95)', backdropFilter: 'blur(16px)' }}>
        
        {/* Left Side: Branding & Features */}
        <div className="p-8 md:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-gray-800" style={{ background: 'linear-gradient(135deg, rgba(0, 16, 38, 0.7) 0%, rgba(14, 18, 26, 0.9) 60%, rgba(5, 5, 8, 0.95) 100%)' }}>
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/40">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">knoMap</span>
            </div>

            <h1 className="text-2xl font-black text-gray-100 mb-3 leading-tight">
              Self-Organizing Maps & Knowledge Analytics
            </h1>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              Web Cloud Server Workspace. Train high-dimensional neural maps, analyze bibliometric networks, and collaborate securely.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-xs text-gray-300">
                <div className="p-1.5 bg-indigo-900/40 rounded-lg text-indigo-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <span>GPU-Accelerated Parallel Neural Engine</span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-gray-300">
                <div className="p-1.5 bg-indigo-900/40 rounded-lg text-indigo-400">
                  <Network className="w-4 h-4" />
                </div>
                <span>Bibliometric & Semantic Network Analytics</span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-gray-300">
                <div className="p-1.5 bg-indigo-900/40 rounded-lg text-indigo-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span>Encrypted Server Persistence & Project Sharing</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800/80 text-[11px] text-gray-500">
            <span>Server Web Edition • knoMap 2026</span>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-8 md:p-10 flex flex-col justify-center" style={{ backgroundColor: '#090d16' }}>
          <div className="mb-6">
            <h2 className="text-xl font-bold" style={{ color: '#ffffff' }}>Sign In to Your Account</h2>
            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Enter your assigned username and password</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5" style={{ color: '#64748b' }} />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition"
                  style={{ backgroundColor: '#0f1422', color: '#f8fafc', border: '1px solid #1e293b' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5" style={{ color: '#64748b' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition"
                  style={{ backgroundColor: '#0f1422', color: '#f8fafc', border: '1px solid #1e293b' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-950 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

          <div className="mt-6 p-3 rounded-xl text-[11px] text-center" style={{ backgroundColor: 'rgba(15, 20, 34, 0.7)', border: '1px solid #1e293b', color: '#64748b' }}>
            <span>First time setup? Use initial admin credentials configured on Docker startup (`admin`).</span>
          </div>
        </div>

      </div>
    </div>
  );
};
