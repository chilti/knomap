import React, { useState, useEffect } from 'react';
import { useAiStore } from '../store/aiStore';
import { Sparkles, BookOpen, Target, Check, X, HelpCircle } from 'lucide-react';

export const StudyContextModal: React.FC = () => {
  const { studyContext, isContextModalOpen, closeContextModal, setStudyContext } = useAiStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (studyContext) {
      setTitle(studyContext.title || '');
      setDescription(studyContext.description || '');
    }
  }, [studyContext, isContextModalOpen]);

  if (!isContextModalOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('Please briefly describe the study objective or research context.');
      return;
    }
    setStudyContext(description, title || 'Research Study');
    closeContextModal();
  };

  const handleApplyTemplate = (sampleTitle: string, sampleDesc: string) => {
    setTitle(sampleTitle);
    setDescription(sampleDesc);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-gray-900 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Banner */}
        <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Thematic Study Context
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Local AI
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Define the scope and objectives of your research so that the AI Assistant produces tailored, highly relevant scientific analyses.
              </p>
            </div>
          </div>
          <button
            onClick={closeContextModal}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Study Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Title or Main Research Theme
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Scientific Output and Impact in Renewable Energy (2015-2025)"
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Detailed Context / Objectives */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              Objectives, Research Questions & Field Context
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="e.g., Scientometric analysis of Category Normalized Citation Impact (CNCI) and international collaboration networks. We aim to identify leading institutions, detect emerging thematic clusters in solar and wind power, and evaluate cross-border co-authorship patterns."
              className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition leading-relaxed resize-none"
            />
          </div>

          {/* Quick Presets / Templates */}
          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1.5 mb-2 font-medium">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              Or select a quick starter template:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleApplyTemplate(
                  "Institutional Performance & Collaboration Evaluation",
                  "Scientometric study on institutional performance, identifying leading research groups, high-impact publications (Top 10% and Top 1%), and international co-authorship patterns."
                )}
                className="text-left p-2.5 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 hover:border-indigo-500/50 transition group cursor-pointer"
              >
                <div className="text-xs font-bold text-gray-200 group-hover:text-indigo-300">🏢 Institutional Performance</div>
                <div className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">Normalized impact, top percentiles, and citation leadership.</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyTemplate(
                  "Thematic Mapping & Emerging Topic Mining",
                  "Identification of research fronts using Self-Organizing Maps (SOM), UMAP projections, and keyword co-occurrence networks to detect emerging vs. consolidated topics."
                )}
                className="text-left p-2.5 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 hover:border-indigo-500/50 transition group cursor-pointer"
              >
                <div className="text-xs font-bold text-gray-200 group-hover:text-purple-300">🗺️ Thematic Mapping (SOM & UMAP)</div>
                <div className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">Thematic clusters, trajectories, and keyword dynamics.</div>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
            <button
              type="button"
              onClick={closeContextModal}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-900/40 flex items-center gap-2 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Save Context
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
