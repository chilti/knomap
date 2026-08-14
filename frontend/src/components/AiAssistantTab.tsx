import React, { useState, useRef, useEffect } from 'react';
import { useAiStore, type ReportEntry } from '../store/aiStore';
import { InteractiveChartViewer } from './InteractiveChartViewer';
import { StudyContextModal } from './StudyContextModal';
import {
  Sparkles, Bot, Send, Trash2, RefreshCw, FileText, Download,
  PlusCircle, BookOpen, HelpCircle, Check, AlertCircle, Loader2,
  ArrowUp, ArrowDown, ChevronDown, ChevronUp, Code2, Copy
} from 'lucide-react';

export const AiAssistantTab: React.FC = () => {
  const {
    studyContext,
    entries,
    activeEntryId,
    setActiveEntryId,
    sendMessage,
    reanalyzeEntry,
    deleteEntry,
    clearAllEntries,
    openContextModal,
    exportReportMarkdown,
    exportReportPdf
  } = useAiStore();

  const [inputQuestion, setInputQuestion] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeEntry: ReportEntry | undefined = entries.find(e => e.id === activeEntryId) || entries[entries.length - 1];

  const handleCopyFullPrompt = () => {
    if (!activeEntry) return;
    const full = `=== SYSTEM PROMPT ===\n${activeEntry.systemPrompt || 'N/A'}\n\n=== CONTEXTO DEL ESTUDIO ===\n${studyContext?.description || 'Sin contexto específico'}\n\n=== DATOS ESTRUCTURADOS ===\n${activeEntry.dataContextPrompt || 'N/A'}\n\n=== SOLICITUD INICIAL ===\n${activeEntry.messages[0]?.content || 'N/A'}`;
    navigator.clipboard.writeText(full);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const scrollToTop = () => {
    contentContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    contentContainerRef.current?.scrollTo({ 
      top: contentContainerRef.current.scrollHeight, 
      behavior: 'smooth' 
    });
  };

  // Only scroll down when the user manually submits a new follow-up question
  const prevMsgCountRef = useRef(activeEntry?.messages?.length || 0);
  useEffect(() => {
    const currentCount = activeEntry?.messages?.length || 0;
    if (currentCount > prevMsgCountRef.current) {
      const lastMsg = activeEntry?.messages[currentCount - 1];
      if (lastMsg?.role === 'user') {
        setTimeout(() => {
          contentContainerRef.current?.scrollTo({
            top: contentContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }, 50);
      }
    }
    prevMsgCountRef.current = currentCount;
  }, [activeEntry?.messages?.length]);

  const handleSendQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuestion.trim() || !activeEntry || activeEntry.isAnalyzing) return;
    const q = inputQuestion;
    setInputQuestion('');
    await sendMessage(activeEntry.id, q);
  };

  const handleQuickQuestion = async (q: string) => {
    if (!activeEntry || activeEntry.isAnalyzing) return;
    await sendMessage(activeEntry.id, q);
  };

  const handleExportMd = () => {
    const md = exportReportMarkdown();
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2500);
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportReportPdf();
    } catch (e) {
      console.error('PDF export failed', e);
      alert('Hubo un problema generando el PDF. Asegúrate de que las imágenes estén cargadas.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">
      {/* Top Header */}
      <header className="px-6 py-4 bg-gray-900/80 border-b border-gray-800 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-900/40 text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              AI Assistant & Report Generator
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Active Local Model
              </span>
            </h1>
            <p className="text-xs text-gray-400">
              Multi-turn analytics integrated with all KnoMap visual modules
            </p>
          </div>
        </div>

        {/* Study Context Badge & Export Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {studyContext && studyContext.description.trim() ? (
            <button
              onClick={openContextModal}
              title="Click to edit study context"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/40 text-xs text-indigo-200 transition group max-w-xs truncate"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate font-medium">
                {studyContext.title || 'Research Study'}
              </span>
            </button>
          ) : (
            <button
              onClick={openContextModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-indigo-900/50 border border-gray-700 hover:border-indigo-500/50 text-xs text-gray-300 hover:text-indigo-200 transition"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>+ Add Study Context</span>
            </button>
          )}

          {entries.length > 0 && (
            <>
              <button
                onClick={handleExportMd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-medium text-gray-200 transition"
                title="Copy complete report in Markdown format"
              >
                {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5 text-indigo-400" />}
                <span>{copiedMd ? 'Copied!' : 'Markdown'}</span>
              </button>

              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-semibold text-white shadow-md shadow-indigo-950/40 transition disabled:opacity-50"
                title="Export report to PDF document"
              >
                {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear all visualizations from the current report?')) {
                    clearAllEntries();
                  }
                }}
                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition"
                title="Clear entire report"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      {entries.length === 0 ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto space-y-6 animate-fadeIn overflow-y-auto custom-scrollbar">
          <div className="w-20 h-20 rounded-3xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-2xl shadow-indigo-900/30">
            <Bot className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Your Interactive Report is Ready</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Send interactive charts and maps from any KnoMap module to generate structured scientific analysis and ask follow-up questions to the local model.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left w-full mt-4">
            <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-1.5">
              <div className="text-xs font-bold text-indigo-300">📊 InCites Explorer</div>
              <p className="text-xs text-gray-400">Send CNCI impact Bubble charts, indicator time series, or full unit distributions.</p>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-1.5">
              <div className="text-xs font-bold text-purple-300">🗺️ SOM & UMAP</div>
              <p className="text-xs text-gray-400">Send hexagonal cluster maps, 2D/3D projections, or component planes.</p>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-1.5">
              <div className="text-xs font-bold text-emerald-300">🕸️ Bibliometric Networks</div>
              <p className="text-xs text-gray-400">Send co-occurrence graphs for keywords, authors, and institutions.</p>
            </div>
            <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 space-y-1.5">
              <div className="text-xs font-bold text-pink-300">🧠 Semantics & Dim. Red.</div>
              <p className="text-xs text-gray-400">Send semantic embedding maps and intrinsic dimension curves.</p>
            </div>
          </div>

          <button
            onClick={openContextModal}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-900/50 flex items-center gap-2 transition cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            Configure Study Context
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Timeline / Entries Sidebar */}
          <aside className="w-72 lg:w-80 min-h-0 bg-gray-900/50 border-r border-gray-800 flex flex-col shrink-0 overflow-hidden">
            <div className="p-3 border-b border-gray-800 flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">
              <span>Visualizations ({entries.length})</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {entries.map((entry, idx) => {
                const isActive = (activeEntry && activeEntry.id === entry.id) || activeEntryId === entry.id;
                return (
                  <div
                    key={entry.id}
                    onClick={() => setActiveEntryId(entry.id)}
                    className={`group relative p-3 rounded-xl cursor-pointer border transition-all ${
                      isActive
                        ? 'bg-indigo-950/60 border-indigo-500/60 shadow-md shadow-indigo-950/50'
                        : 'bg-gray-900/40 border-gray-800/80 hover:bg-gray-850 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            entry.badge.includes('INCITES')
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : entry.badge.includes('SOM')
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : entry.badge.includes('NETWORKS')
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          }`}>
                            {entry.badge}
                          </span>
                          <span className="text-[10px] text-gray-500">#{idx + 1}</span>
                        </div>
                        <h4 className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                          {entry.title}
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {entry.messages.length} message(s) • {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete visualization "${entry.title}" from report?`)) {
                            deleteEntry(entry.id);
                          }
                        }}
                        className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition shrink-0"
                        title="Delete this visualization"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Right Main Analysis Panel */}
          {activeEntry ? (
            <main className="flex-1 min-h-0 relative flex flex-col h-full bg-gray-950 overflow-hidden">
              {/* Entry Subheader */}
              <div className="px-6 py-3 bg-gray-900/40 border-b border-gray-800 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
                      {activeEntry.badge}
                    </span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-400">
                      {new Date(activeEntry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-0.5">
                    {activeEntry.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => reanalyzeEntry(activeEntry.id)}
                    disabled={activeEntry.isAnalyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-200 transition disabled:opacity-50 cursor-pointer"
                    title="Re-run initial scientific analysis"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${activeEntry.isAnalyzing ? 'animate-spin' : ''}`} />
                    <span>Re-analyze</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete visualization "${activeEntry.title}" from report?`)) {
                        deleteEntry(activeEntry.id);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 hover:border-red-600 text-xs font-semibold text-red-300 hover:text-red-100 transition shadow-sm cursor-pointer"
                    title="Delete this visualization from report"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Delete Visualization</span>
                  </button>
                </div>
              </div>

              {/* Quick Floating Scroll Navigation */}
              <div className="absolute right-8 top-16 z-30 flex items-center gap-2 bg-gray-900/90 border border-gray-750 p-1.5 rounded-xl shadow-2xl backdrop-blur-md">
                <button
                  onClick={scrollToTop}
                  className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-indigo-600 text-gray-300 hover:text-white transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  title="Scroll to top to view map / chart"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>View Map</span>
                </button>
                <button
                  onClick={scrollToBottom}
                  className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-indigo-600 text-gray-300 hover:text-white transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  title="Scroll to bottom to view analysis and dialogue"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                  <span>View Analysis</span>
                </button>
              </div>

              {/* Scrollable Content (Chart + Conversation) */}
              <div ref={contentContainerRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Interactive Chart Section */}
                <section>
                  <InteractiveChartViewer snapshot={activeEntry.snapshot} />
                </section>

                {/* Conversation & LLM Insights */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-400" />
                      Scientific Analysis & Dialogue
                    </h3>
                    <span className="text-xs text-gray-500">
                      {activeEntry.messages.length} message(s)
                    </span>
                  </div>

                  {activeEntry.error && (
                    <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                      <div>
                        <strong>Analysis Error:</strong> {activeEntry.error}
                      </div>
                    </div>
                  )}

                  {activeEntry.messages.map((msg, idx) => (
                    <React.Fragment key={msg.id}>
                      <div
                        className={`flex gap-3 text-sm ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-1">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}

                        <div
                          className={`max-w-3xl rounded-2xl p-4 leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none shadow-md shadow-indigo-950/40'
                              : 'bg-gray-900/90 border border-gray-800 text-gray-200 rounded-bl-none prose prose-invert prose-sm max-w-none shadow-lg'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-gray-200">
                              {msg.content.split('\n').map((line, i) => {
                                if (line.startsWith('###')) return <h4 key={i} className="text-white font-bold text-sm mt-3 mb-1">{line.replace(/###/g, '').trim()}</h4>;
                                if (line.startsWith('##')) return <h3 key={i} className="text-indigo-300 font-bold text-base mt-4 mb-1">{line.replace(/##/g, '').trim()}</h3>;
                                if (line.startsWith('#')) return <h2 key={i} className="text-indigo-200 font-extrabold text-lg mt-4 mb-2">{line.replace(/#/g, '').trim()}</h2>;
                                if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-gray-300 list-disc">{line.substring(2)}</li>;
                                if (line.match(/^\d+\.\s/)) return <li key={i} className="ml-4 text-gray-300 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
                                if (line.trim() === '') return <br key={i} />;
                                
                                const boldFormatted = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={j} className="text-indigo-300 font-semibold">{part.substring(2, part.length - 2)}</strong>;
                                  }
                                  return part;
                                });

                                return <p key={i} className="my-1">{boldFormatted}</p>;
                              })}
                            </div>
                          ) : (
                            <div className="text-xs sm:text-sm font-medium">
                              {msg.content}
                            </div>
                          )}
                          <div className={`text-[10px] mt-2 ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-500'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* Collapsible Full Prompt (System Prompt, Study Context, and Structured Data) */}
                      {idx === 0 && (
                        <div className="my-1 max-w-3xl ml-auto w-full">
                          <div className="flex justify-end">
                            <button
                              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900/90 hover:bg-gray-850 border border-gray-800 hover:border-indigo-500/40 text-xs font-semibold text-gray-400 hover:text-indigo-300 transition shadow-sm cursor-pointer"
                              title="View or copy system prompt, study context, and structured data"
                            >
                              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{isPromptExpanded ? 'Hide Full Prompt' : '👁️ View Full Prompt (System, Context & Data)'}</span>
                              {isPromptExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          {isPromptExpanded && (
                            <div className="mt-2 p-4 rounded-2xl bg-gray-950 border border-indigo-500/30 text-xs text-gray-300 space-y-3 shadow-2xl animate-fadeIn">
                              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                <span className="font-bold text-indigo-300 flex items-center gap-1.5 text-xs">
                                  <Code2 className="w-4 h-4 text-indigo-400" />
                                  Full Prompt Sent to Local Model
                                </span>
                                <button
                                  onClick={handleCopyFullPrompt}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-855 hover:bg-indigo-950 text-gray-300 hover:text-indigo-200 border border-gray-700 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedPrompt ? 'Copied!' : 'Copy All'}</span>
                                </button>
                              </div>

                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                                  1. System Prompt & Editorial Guidelines:
                                </div>
                                <pre className="p-3 bg-gray-900/90 rounded-xl border border-gray-800 text-[11px] font-mono text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar select-text">
                                  {activeEntry.systemPrompt}
                                </pre>
                              </div>

                              {studyContext && studyContext.description && (
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">
                                    2. Study Context ({studyContext.title}):
                                  </div>
                                  <pre className="p-3 bg-gray-900/90 rounded-xl border border-gray-800 text-[11px] font-mono text-gray-300 whitespace-pre-wrap max-h-36 overflow-y-auto custom-scrollbar select-text">
                                    {studyContext.description}
                                  </pre>
                                </div>
                              )}

                              {activeEntry.dataContextPrompt && (
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                                    3. Structured Figure / Map Data:
                                  </div>
                                  <pre className="p-3 bg-gray-900/90 rounded-xl border border-gray-800 text-[11px] font-mono text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar select-text">
                                    {activeEntry.dataContextPrompt}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {activeEntry.isAnalyzing && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-900/60 border border-indigo-500/30 max-w-md animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                      <span className="text-xs text-indigo-300">
                        Local AI model is interpreting data...
                      </span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </section>
              </div>

              {/* Bottom Multi-Turn Follow-Up Input */}
              <div className="p-4 bg-gray-900/80 border-t border-gray-800 shrink-0">
                {/* Suggested Follow-Up Prompts */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none">
                  <span className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 shrink-0">
                    <HelpCircle className="w-3 h-3 text-indigo-400" />
                    Suggestions:
                  </span>
                  {[
                    'How would you draft this finding for the Results section of a paper?',
                    'Analyze in two paragraphs the methodological implications of this figure.',
                    'What anomalies or limitations should be discussed in the manuscript?',
                    'Synthesize the relationship between the main clusters in academic prose.'
                  ].map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickQuestion(sug)}
                      disabled={activeEntry.isAnalyzing}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-gray-800/80 hover:bg-indigo-950/60 border border-gray-700/60 hover:border-indigo-500/40 text-[11px] text-gray-300 hover:text-indigo-200 transition disabled:opacity-40"
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendQuestion} className="flex gap-2">
                  <input
                    type="text"
                    value={inputQuestion}
                    onChange={(e) => setInputQuestion(e.target.value)}
                    disabled={activeEntry.isAnalyzing}
                    placeholder="Ask a specific question about this data or request a comparison..."
                    className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!inputQuestion.trim() || activeEntry.isAnalyzing}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-md shadow-indigo-950/40 flex items-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </main>
          ) : null}
        </div>
      )}

      {/* Study Context Modal */}
      <StudyContextModal />
    </div>
  );
};
