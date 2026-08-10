import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { ShareProjectModal } from './ShareProjectModal';
import { Cloud, Folder, Share2, Trash2, ExternalLink, RefreshCw, X, Users } from 'lucide-react';

interface ProjectsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectsDrawer: React.FC<ProjectsDrawerProps> = ({ isOpen, onClose }) => {
  const { 
    ownedProjects, 
    sharedProjects, 
    isProjectsLoading, 
    fetchUserProjects, 
    loadCloudProject, 
    deleteCloudProject 
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'owned' | 'shared'>('owned');
  const [selectedShareProject, setSelectedShareProject] = useState<{ id: string; title: string } | null>(null);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchUserProjects();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenProject = async (projectId: string) => {
    setLoadingProjectId(projectId);
    const success = await loadCloudProject(projectId);
    setLoadingProjectId(null);
    if (success) {
      onClose();
    }
  };

  const handleDelete = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this cloud project?')) {
      await deleteCloudProject(projectId);
    }
  };

  const projectList = activeTab === 'owned' ? ownedProjects : sharedProjects;

  return (
    <>
      <div className="fixed inset-0 z-[99998] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-[99999] w-full max-w-md bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="p-5 bg-gray-950 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-900/50 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">Server Projects</h3>
              <p className="text-xs text-gray-400">Save, load & share projects on the cloud</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs: My Projects vs Shared with Me */}
        <div className="flex border-b border-gray-800 bg-gray-950">
          <button
            onClick={() => setActiveTab('owned')}
            className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center space-x-2 border-b-2 ${
              activeTab === 'owned'
                ? 'border-indigo-500 text-indigo-400 bg-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>My Projects ({ownedProjects.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center space-x-2 border-b-2 ${
              activeTab === 'shared'
                ? 'border-indigo-500 text-indigo-400 bg-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Shared with Me ({sharedProjects.length})</span>
          </button>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {isProjectsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs">Loading projects from server...</span>
            </div>
          ) : projectList.length === 0 ? (
            <div className="text-center py-12 text-gray-500 space-y-2">
              <Cloud className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-xs font-medium">
                {activeTab === 'owned' 
                  ? 'No cloud projects saved yet. Train a SOM map and click "Save to Server".' 
                  : 'No projects have been shared with you yet.'}
              </p>
            </div>
          ) : (
            projectList.map((p) => (
              <div
                key={p.id}
                className="p-4 bg-gray-950 border border-gray-800 rounded-xl hover:border-gray-700 transition flex flex-col space-y-2 relative group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-100 group-hover:text-indigo-300 transition">{p.title}</h4>
                    {p.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{p.description}</p>}
                  </div>
                  {!p.isOwner && (
                    <span className="px-2 py-0.5 bg-purple-900/60 border border-purple-500/30 text-purple-200 text-[10px] font-bold rounded">
                      From @{p.ownerUsername}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-850 text-[10px] text-gray-500">
                  <span>Updated: {new Date(p.updatedAt).toLocaleDateString()}</span>

                  <div className="flex items-center space-x-2">
                    {p.isOwner && (
                      <>
                        <button
                          onClick={() => setSelectedShareProject({ id: p.id, title: p.title })}
                          className="p-1.5 bg-gray-900 hover:bg-gray-800 text-indigo-400 rounded-lg transition"
                          title="Share Project"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 bg-gray-900 hover:bg-red-950 text-red-400 rounded-lg transition"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleOpenProject(p.id)}
                      disabled={loadingProjectId === p.id}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {loadingProjectId === p.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedShareProject && (
        <ShareProjectModal
          isOpen={!!selectedShareProject}
          onClose={() => setSelectedShareProject(null)}
          projectId={selectedShareProject.id}
          projectTitle={selectedShareProject.title}
        />
      )}
    </>
  );
};
