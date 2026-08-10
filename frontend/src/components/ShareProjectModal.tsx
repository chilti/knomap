import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Share2, X, Check, AlertCircle, UserCheck } from 'lucide-react';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectTitle
}) => {
  const { shareProject } = useAuthStore();
  const [targetUser, setTargetUser] = useState('');
  const [permission, setPermission] = useState<'Read' | 'Write'>('Read');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    
    setStatusMsg(null);
    setIsSubmitting(true);

    const success = await shareProject(projectId, targetUser, permission);
    setIsSubmitting(false);

    if (success) {
      setStatusMsg({ type: 'success', text: `Project successfully shared with '${targetUser}'!` });
      setTargetUser('');
    } else {
      setStatusMsg({ type: 'error', text: `Failed to share project. Check if user '${targetUser}' exists.` });
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-indigo-900/50 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">Share Project</h3>
            <p className="text-xs text-indigo-400 font-semibold truncate max-w-[260px]">{projectTitle}</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Username or Email of recipient
            </label>
            <div className="relative">
              <UserCheck className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input
                type="text"
                required
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="target_username or email"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Access Permission
            </label>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as any)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Read">Can View (Read Only)</option>
              <option value="Write">Can Edit & Save (Read/Write)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-950 cursor-pointer disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Sharing...' : 'Grant Access'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
