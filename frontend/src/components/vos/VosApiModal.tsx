import React, { useState } from 'react';
import { Globe, Search, RefreshCw, X, Sparkles, BookOpen } from 'lucide-react';
import { useSomStore } from '../../store/somStore';

interface VosApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VosApiModal: React.FC<VosApiModalProps> = ({ isOpen, onClose }) => {
  const queryBibliometricsApi = useSomStore(state => state.queryBibliometricsApi);
  const isPreprocessing = useSomStore(state => state.isPreprocessing);

  const [source, setSource] = useState<'openalex' | 'crossref'>('openalex');
  const [query, setQuery] = useState<string>('');
  const [maxResults, setMaxResults] = useState<number>(100);
  const [networkType] = useState<string>('co-occurrence');
  const [extractionSource, setExtractionSource] = useState<'keywords' | 'title_abstract' | 'title' | 'abstract'>('title_abstract');
  const [countingMethod, setCountingMethod] = useState<'full' | 'fractional'>('fractional');
  const [maxTerms, setMaxTerms] = useState<number>(60);
  const [minCooc, setMinCooc] = useState<number>(2);
  const [relevanceRatio, setRelevanceRatio] = useState<number>(0.60);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      alert("Please enter a search query or topic.");
      return;
    }

    const success = await queryBibliometricsApi({
      source,
      query: query.trim(),
      maxResults,
      networkType,
      maxTerms,
      minCooc,
      extractionSource,
      countingMethod,
      relevanceRatio
    });

    if (success) {
      onClose();
    }
  };

  const sampleQueries = [
    "self-organizing maps",
    "deep learning bibliometrics",
    "quantum computing algorithms",
    "crispr gene editing",
    "climate change mitigation"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100">Live Bibliographic API Query</h3>
              <p className="text-[11px] text-gray-400">Fetch scientific literature and build co-occurrence networks directly from online APIs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-1.5 rounded-lg hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Source Tabs */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">API Provider</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSource('openalex')}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                  source === 'openalex'
                    ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-950/40'
                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <span>OpenAlex API</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-indigo-600 text-white rounded font-medium">Recommended</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">250M+ open publications, full abstracts & concepts</div>
                </div>
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setSource('crossref')}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                  source === 'crossref'
                    ? 'bg-indigo-950/50 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-950/40'
                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <span>Crossref API</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Global DOI registry, metadata & citations</div>
                </div>
                <BookOpen className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Search Query Input */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Topic Query or Keywords
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. self-organizing maps, deep learning, bibliometrics..."
                className="w-full bg-gray-950 border border-gray-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 pl-10 text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition"
              />
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
            </div>

            {/* Quick Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-gray-500 font-medium">Suggestions:</span>
              {sampleQueries.map((sq) => (
                <button
                  key={sq}
                  type="button"
                  onClick={() => setQuery(sq)}
                  className="text-[10px] px-2 py-0.5 bg-gray-950 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-indigo-300 rounded-md transition"
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Max Publications</label>
              <select
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value))}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none"
              >
                <option value={50}>50 works (Quick)</option>
                <option value={100}>100 works (Standard)</option>
                <option value={200}>200 works (Deep)</option>
                <option value={500}>500 works (Thorough)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Counting Method</label>
              <select
                value={countingMethod}
                onChange={(e) => setCountingMethod(e.target.value as any)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none"
              >
                <option value="fractional">Fractional Counting (1/n)</option>
                <option value="full">Full Counting</option>
              </select>
            </div>
          </div>

          {/* Term Extraction Source & NLP */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Term Extraction Method</label>
            <select
              value={extractionSource}
              onChange={(e) => setExtractionSource(e.target.value as any)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-indigo-300 font-semibold focus:outline-none"
            >
              <option value="title_abstract">Title & Abstract (NLP Mining & Relevance Score)</option>
              <option value="keywords">Keywords / Concepts Only</option>
              <option value="title">Title Only (NLP)</option>
              <option value="abstract">Abstract Only (NLP)</option>
            </select>
          </div>

          {/* Relevance Ratio Slider */}
          {extractionSource !== 'keywords' && (
            <div className="p-3.5 bg-gray-950 border border-indigo-500/20 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-300 font-semibold">VOS Relevance Filter</span>
                <span className="text-indigo-400 font-bold">Top {Math.round(relevanceRatio * 100)}% terms</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={relevanceRatio}
                onChange={(e) => setRelevanceRatio(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <p className="text-[10px] text-gray-500">
                Filters out generic academic stop-words using the VOSviewer co-occurrence specificity algorithm.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Max Nodes</label>
              <input
                type="number"
                value={maxTerms}
                onChange={(e) => setMaxTerms(parseInt(e.target.value) || 30)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Min Co-occurrence</label>
              <input
                type="number"
                value={minCooc}
                onChange={(e) => setMinCooc(parseInt(e.target.value) || 1)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-950/80">
          <span className="text-[10px] text-gray-500">
            Powered by {source === 'openalex' ? 'OpenAlex.org' : 'Crossref.org'}
          </span>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPreprocessing}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPreprocessing || !query.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              {isPreprocessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching & Building Network...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Query & Build Network</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
