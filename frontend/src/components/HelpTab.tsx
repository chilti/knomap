import React, { useState } from 'react';
import {
  BarChart2,
  Database,
  Layers,
  FileText,
  Copy,
  Check,
  FolderArchive,
  Calendar,
  AlertCircle,
  Sparkles,
  BookOpen,
  Compass,
  Share2,
  Bot,
  Sliders,
  Network,
  Cpu,
  Save,
  Grid,
  Activity
} from 'lucide-react';
import { useSomStore } from '../store/somStore';

export const HelpTab: React.FC = () => {
  const { helpSection, setHelpSection, setActiveTab } = useSomStore();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const navItems = [
    { key: 'incites', label: 'Clarivate InCites', icon: BarChart2, color: 'text-indigo-400', badge: 'InCites' },
    { key: 'tlachia', label: 'TlachIA Metrics', icon: Database, color: 'text-cyan-400', badge: 'OpenAlex' },
    { key: 'multidimensional', label: 'Multidimensional & SOM', icon: Grid, color: 'text-amber-400', badge: 'Kohonen' },
    { key: 'dimreduction', label: 'Dimensionality Reduction', icon: Compass, color: 'text-rose-400', badge: 'UMAP/MLE' },
    { key: 'bibliometrics', label: 'Bibliometric Networks', icon: Share2, color: 'text-emerald-400', badge: 'VOS/EDA' },
    { key: 'semantic', label: 'Semantic Bibliometrics', icon: Sparkles, color: 'text-violet-400', badge: 'Embeddings' },
    { key: 'asistente', label: 'Sinapsis AI Assistant', icon: Bot, color: 'text-purple-400', badge: 'LLM Agent' },
    { key: 'general', label: 'Ecosystem & Projects', icon: Layers, color: 'text-teal-400', badge: 'Core' },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-200 overflow-y-auto pr-2 space-y-8">
      {/* 1. Header Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-gray-900 via-indigo-950/60 to-gray-900 border border-indigo-500/20 p-8 shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -bottom-20 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Complete System Documentation & Guidelines</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent">KnoMap</span> Knowledge Base
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Explore in-depth technical manuals, file naming rules, methodological foundations, and analytical workflows across all KnoMap modules: from <strong>Clarivate InCites</strong> and <strong>TlachIA OpenAlex</strong> to <strong>Self-Organizing Maps (SOM)</strong>, <strong>Manifold Learning</strong>, and the <strong>Sinapsis AI Assistant</strong>.
            </p>
          </div>

          {/* Quick Access to Explorers */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActiveTab('incites')}
              className="px-3.5 py-2 bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-950/80 transition flex items-center space-x-1.5 border border-indigo-400/30 cursor-pointer"
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-200" />
              <span>InCites Explorer</span>
            </button>
            <button
              onClick={() => setActiveTab('tlachia_metrics')}
              className="px-3.5 py-2 bg-cyan-700/80 hover:bg-cyan-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950/80 transition flex items-center space-x-1.5 border border-cyan-400/30 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-cyan-200" />
              <span>TlachIA Metrics</span>
            </button>
            <button
              onClick={() => setActiveTab('multidimensional')}
              className="px-3.5 py-2 bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-950/80 transition flex items-center space-x-1.5 border border-amber-400/30 cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5 text-amber-200" />
              <span>SOM Explorer</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Pills Selector */}
      <div className="flex items-center space-x-2 border-b border-gray-800 pb-3 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = helpSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setHelpSection(item.key as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-950/60 border border-indigo-400/40'
                  : 'bg-gray-900/80 text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-gray-800'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : item.color}`} />
              <span>{item.label}</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                isActive ? 'bg-indigo-950 text-indigo-200 border border-indigo-400/30' : 'bg-gray-950 text-gray-500 border border-gray-800'
              }`}>
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. CLARIVATE INCITES DATA GUIDE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {helpSection === 'incites' && (
        <div className="space-y-8 animate-fade-in">
          <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start space-x-4">
            <div className="p-2.5 bg-indigo-600/20 rounded-xl border border-indigo-400/30 text-indigo-300 mt-0.5 shrink-0">
              <AlertCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="text-sm font-bold text-white">Fundamental Upload Rules for Clarivate InCites Data</h4>
              <p className="text-gray-300 leading-relaxed">
                KnoMap's <strong>InCites Explorer</strong> automatically detects analytical entities and their respective temporal windows by parsing file names. To enable the complete suite of visualizations (static baseline benchmarks, radar charts, 4D bubbles, and multi-year time series), the user is expected to download <strong>3 temporal levels</strong> for each evaluated unit.
              </p>
            </div>
          </div>

          {/* The 3 Core Temporal Files */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-wide">
                The 3 Required Temporal Levels per Analytical Unit
              </h2>
            </div>
            <p className="text-xs text-gray-400">
              For each analytical unit (for instance, <em>Organizations</em> or <em>Locations</em>), export the following 3 files from Clarivate InCites:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Whole Period */}
              <div className="p-5 rounded-2xl bg-gray-900/90 border border-indigo-500/30 hover:border-indigo-500/60 transition-all flex flex-col justify-between space-y-4 shadow-lg shadow-indigo-950/20">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wide">
                      1. Full Period (Whole)
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">Whole / Baseline</span>
                  </div>
                  <h3 className="text-base font-bold text-white">Complete Historical Horizon</h3>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Encompasses the entire historical period of the study (e.g., 1980–2025 or full query horizon). It defines the <strong>structural baseline</strong>, cumulative totals, and global reference percentiles.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <span className="text-[11px] font-semibold text-gray-400 block">File naming pattern:</span>
                  <div className="p-2.5 bg-gray-950 rounded-xl border border-gray-800 flex items-center justify-between group">
                    <code className="text-xs text-indigo-300 font-mono">Incites Organizations.xlsx</code>
                    <button
                      onClick={() => handleCopy('Incites Organizations.xlsx', 'c1')}
                      title="Copy example filename"
                      className="p-1 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
                    >
                      {copiedKey === 'c1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    * No temporal suffix or with the word <code className="text-gray-400">Whole</code>.
                  </p>
                </div>
              </div>

              {/* Card 2: Last 5 Years */}
              <div className="p-5 rounded-2xl bg-gray-900/90 border border-cyan-500/30 hover:border-cyan-500/60 transition-all flex flex-col justify-between space-y-4 shadow-lg shadow-cyan-950/20">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 uppercase tracking-wide">
                      2. Last 5 Years (5Years)
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">Recent Window</span>
                  </div>
                  <h3 className="text-base font-bold text-white">Recent Quinquennium Window</h3>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Filters production to the recent 5-year window (e.g., 2019–2023 or 2020–2024). Enables assessing <strong>recent scientific acceleration</strong>, authorship leadership, and Top 10% citation shifts.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <span className="text-[11px] font-semibold text-gray-400 block">File naming pattern:</span>
                  <div className="p-2.5 bg-gray-950 rounded-xl border border-gray-800 flex items-center justify-between group">
                    <code className="text-xs text-cyan-300 font-mono">Incites Organizations 2019-2023.xlsx</code>
                    <button
                      onClick={() => handleCopy('Incites Organizations 2019-2023.xlsx', 'c2')}
                      title="Copy example filename"
                      className="p-1 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
                    >
                      {copiedKey === 'c2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    * Must include the year range <code className="text-gray-400">YYYY-YYYY</code> or the tag <code className="text-gray-400">5Years</code>.
                  </p>
                </div>
              </div>

              {/* Card 3: Trend */}
              <div className="p-5 rounded-2xl bg-gray-900/90 border border-purple-500/30 hover:border-purple-500/60 transition-all flex flex-col justify-between space-y-4 shadow-lg shadow-purple-950/20">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 uppercase tracking-wide">
                      3. Annual Trend (Trend)
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">Time Series</span>
                  </div>
                  <h3 className="text-base font-bold text-white">Year-by-Year Indicator Evolution</h3>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Yearly breakdown of production, citations, and impact metrics. This file <strong>unlocks the Time Series Evolution charts</strong>, area distribution graphs, and longitudinal PathSOM trajectories.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <span className="text-[11px] font-semibold text-gray-400 block">File naming pattern:</span>
                  <div className="p-2.5 bg-gray-950 rounded-xl border border-gray-800 flex items-center justify-between group">
                    <code className="text-xs text-purple-300 font-mono">Incites Organizations Trend.xlsx</code>
                    <button
                      onClick={() => handleCopy('Incites Organizations Trend.xlsx', 'c3')}
                      title="Copy example filename"
                      className="p-1 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
                    >
                      {copiedKey === 'c3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    * <strong>Mandatory:</strong> must contain the keyword <code className="text-purple-300 font-bold">Trend</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Canonical Units Table */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-wide">
                Canonical Analytical Units Catalog
              </h2>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900/60 shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 font-bold">
                    <th className="py-3 px-4">Canonical Unit</th>
                    <th className="py-3 px-4">Full Period (Whole)</th>
                    <th className="py-3 px-4">Last 5 Years (5Years)</th>
                    <th className="py-3 px-4">Annual Trend (Trend)</th>
                    <th className="py-3 px-4">Analytical Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-mono text-[11px]">
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-indigo-300">Organizations</td>
                    <td className="py-2.5 px-4 text-gray-300">Incites Organizations.xlsx</td>
                    <td className="py-2.5 px-4 text-cyan-300">Incites Organizations 2019-2023.xlsx</td>
                    <td className="py-2.5 px-4 text-purple-300">Incites Organizations Trend.xlsx</td>
                    <td className="py-2.5 px-4 font-sans text-gray-400">Institutions, universities, and research centers</td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-indigo-300">Locations</td>
                    <td className="py-2.5 px-4 text-gray-300">Incites Locations.xlsx</td>
                    <td className="py-2.5 px-4 text-cyan-300">Incites Locations 2019-2023.xlsx</td>
                    <td className="py-2.5 px-4 text-purple-300">Incites Locations Trend.xlsx</td>
                    <td className="py-2.5 px-4 font-sans text-gray-400">Countries, territories & international collaboration</td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-indigo-300">Researchers</td>
                    <td className="py-2.5 px-4 text-gray-300">Incites Researchers.xlsx</td>
                    <td className="py-2.5 px-4 text-cyan-300">Incites Researchers 2019-2023.xlsx</td>
                    <td className="py-2.5 px-4 text-purple-300">Incites Researchers Trend.xlsx</td>
                    <td className="py-2.5 px-4 font-sans text-gray-400">Individual authors, principal investigators & teams</td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-indigo-300">Publication Sources</td>
                    <td className="py-2.5 px-4 text-gray-300">Incites Publication Sources.xlsx</td>
                    <td className="py-2.5 px-4 text-cyan-300">Incites Publication Sources 2019-2023.xlsx</td>
                    <td className="py-2.5 px-4 text-purple-300">Incites Publication Sources Trend.xlsx</td>
                    <td className="py-2.5 px-4 font-sans text-gray-400">Scientific journals, series, and proceedings</td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-indigo-300">Funding Agencies</td>
                    <td className="py-2.5 px-4 text-gray-300">Incites Funding Agencies.xlsx</td>
                    <td className="py-2.5 px-4 text-cyan-300">Incites Funding Agencies 2019-2023.xlsx</td>
                    <td className="py-2.5 px-4 text-purple-300">Incites Funding Agencies Trend.xlsx</td>
                    <td className="py-2.5 px-4 font-sans text-gray-400">National and global research funding sponsors</td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-indigo-300">WoS Categories</td>
                    <td className="py-2.5 px-4 text-gray-300">Incites WoS Categories.xlsx</td>
                    <td className="py-2.5 px-4 text-cyan-300">Incites WoS Categories 2019-2023.xlsx</td>
                    <td className="py-2.5 px-4 text-purple-300">Incites WoS Categories Trend.xlsx</td>
                    <td className="py-2.5 px-4 font-sans text-gray-400">254 Web of Science subject categories</td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-indigo-300">Research Areas ESI</td>
                    <td className="py-2.5 px-4 text-gray-300">Incites Research Areas ESI.xlsx</td>
                    <td className="py-2.5 px-4 text-cyan-300">Incites Research Areas ESI 2019-2023.xlsx</td>
                    <td className="py-2.5 px-4 text-purple-300">Incites Research Areas ESI Trend.xlsx</td>
                    <td className="py-2.5 px-4 font-sans text-gray-400">22 Essential Science Indicators disciplines</td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-indigo-300">Research Areas SDG</td>
                    <td className="py-2.5 px-4 text-gray-300">Incites Research Areas SDG.xlsx</td>
                    <td className="py-2.5 px-4 text-cyan-300">Incites Research Areas SDG 2019-2023.xlsx</td>
                    <td className="py-2.5 px-4 text-purple-300">Incites Research Areas SDG Trend.xlsx</td>
                    <td className="py-2.5 px-4 font-sans text-gray-400">17 UN Sustainable Development Goals</td>
                  </tr>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-bold text-indigo-300">Macro / Meso / Micro</td>
                    <td className="py-2.5 px-4 text-gray-300">Incites Research Areas Meso.xlsx</td>
                    <td className="py-2.5 px-4 text-cyan-300">Incites Research Areas Meso 2019-2023.xlsx</td>
                    <td className="py-2.5 px-4 text-purple-300">Incites Research Areas Meso Trend.xlsx</td>
                    <td className="py-2.5 px-4 font-sans text-gray-400">Citation topic clusters across 3 hierarchical levels</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Step-by-Step Export & ZIP Packaging Guide */}
          <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 space-y-4">
            <div className="flex items-center space-x-2">
              <FolderArchive className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">
                Clarivate InCites Export & ZIP Packaging Workflow
              </h3>
            </div>

            <ol className="space-y-3 text-xs text-gray-300 list-decimal list-inside pl-1 leading-relaxed">
              <li>
                <strong className="text-white">Sign in to Clarivate InCites</strong>: Navigate to <em>Benchmarking & Analytics</em> and choose your target entity (e.g. <em>Organizations</em>).
              </li>
              <li>
                <strong className="text-white">Configure the Full Period</strong>: Set the year filter to the full evaluation range (e.g. 1980–2025). Click <strong>Export</strong> and select <strong>Excel (.xlsx)</strong> or <strong>CSV</strong>. Rename the downloaded file to <code className="text-indigo-300 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">Incites Organizations.xlsx</code>.
              </li>
              <li>
                <strong className="text-white">Configure the Last 5 Years</strong>: Adjust the time filter to the recent 5-year window (e.g. 2019–2023). Export and rename to <code className="text-cyan-300 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">Incites Organizations 2019-2023.xlsx</code>.
              </li>
              <li>
                <strong className="text-white">Export Annual Trend (Trend)</strong>: Toggle the year-by-year <em>Trend</em> view on the InCites table. Export and rename the file ensuring it contains the word <code className="text-purple-300 font-bold bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">Trend</code>, for example <code className="text-purple-300 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">Incites Organizations Trend.xlsx</code>.
              </li>
              <li>
                <strong className="text-white">Compress into a Single ZIP Archive</strong>: Select all exported files across units and compress them into one ZIP file (e.g. <code className="text-emerald-300 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">InCites_Export_Package.zip</code>).
              </li>
              <li>
                <strong className="text-white">Upload to KnoMap</strong>: Go to the <strong>InCites Data</strong> tab on the left sidebar, click <strong>Upload ZIP / Excel</strong>, and select your archive. The backend engine will parse and index all units simultaneously.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. TLACHIA METRICS GUIDE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {helpSection === 'tlachia' && (
        <div className="space-y-8 animate-fade-in">
          <div className="p-5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-start space-x-4">
            <div className="p-2.5 bg-cyan-600/20 rounded-xl border border-cyan-400/30 text-cyan-300 mt-0.5 shrink-0">
              <Database className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="text-sm font-bold text-white">Canonical Structure of TlachIA Metrics ZIP Packages</h4>
              <p className="text-gray-300 leading-relaxed">
                <strong>TlachIA Metrics</strong> archives are generated by the scientometrics engine <strong>openalex_indicators_engine</strong>. These archives are bundled into <code className="text-cyan-300 font-mono font-bold">metricas_*.zip</code> files containing longitudinal performance matrices, consecutive periods, and annual indicator trends.
              </p>
            </div>
          </div>

          {/* Folder Hierarchy Diagram */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <FolderArchive className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-wide">
                Folder Hierarchy in TlachIA Metrics ZIP Archives
              </h2>
            </div>

            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 font-mono text-xs space-y-3">
              <div className="flex items-center space-x-2 text-cyan-300 font-bold">
                <FolderArchive className="w-4 h-4" />
                <span>metricas_institutional_or_thematic.zip</span>
              </div>
              <div className="pl-6 border-l border-gray-800 space-y-3">
                <div className="space-y-1">
                  <div className="text-indigo-400 font-bold flex items-center space-x-1.5">
                    <span>📁 01_Matrices_Desempeño_Longitudinal/</span>
                    <span className="text-[10px] font-sans text-gray-500 font-normal">(Consolidated multi-indicator matrix)</span>
                  </div>
                  <p className="pl-5 text-gray-400 text-[11px] font-sans">
                    Contains institutional or topic performance matrices: <code className="text-gray-300">* Performance Matrix.csv</code> and <code className="text-gray-300">Matriz_Desempeño_Longitudinal_Consolidada.csv</code>.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="text-cyan-400 font-bold flex items-center space-x-1.5">
                    <span>📁 02_Periodos_Consecutivos/</span>
                    <span className="text-[10px] font-sans text-gray-500 font-normal">(Consecutive chronological windows)</span>
                  </div>
                  <p className="pl-5 text-gray-400 text-[11px] font-sans">
                    Subdivided period matrices used to train longitudinal Self-Organizing Maps with intertemporal warm-start and synaptic drift analysis.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="text-emerald-400 font-bold flex items-center space-x-1.5">
                    <span>📁 03_Historico_Completo/</span>
                    <span className="text-[10px] font-sans text-gray-500 font-normal">(Cumulative baseline horizon)</span>
                  </div>
                  <p className="pl-5 text-gray-400 text-[11px] font-sans">
                    Complete historical tables for OpenAlex literature across entities (Institutions, Authors, Sources, Countries, etc.).
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="text-purple-400 font-bold flex items-center space-x-1.5">
                    <span>📁 04_Tendencias_Anuales/</span>
                    <span className="text-[10px] font-sans text-gray-500 font-normal">(Yearly indicator time series)</span>
                  </div>
                  <p className="pl-5 text-gray-400 text-[11px] font-sans">
                    <code className="text-gray-300">* Trend.csv</code> tables detailing annual evolution for FWCI, Citations per Doc, Gold/Green/Diamond Open Access, and estimated APC costs.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="text-amber-400 font-bold flex items-center space-x-1.5">
                    <span>📁 05_Tablas_Parquet_y_Datos/</span>
                    <span className="text-[10px] font-sans text-gray-500 font-normal">(Binary Parquet tables & OpenAlex works)</span>
                  </div>
                  <p className="pl-5 text-gray-400 text-[11px] font-sans">
                    High-performance Parquet datasets and linked scholarly works JSON (<code className="text-gray-300">*_openalex_works.json</code>) for semantic deep-linking.
                  </p>
                </div>

                <div className="pt-2 text-gray-500 text-[11px] space-y-1">
                  <div>📄 manifest.json <span className="font-sans text-gray-600">(Metadata inventory, execution parameters, and timestamps)</span></div>
                  <div>📄 LEEME_ESTRUCTURA.txt <span className="font-sans text-gray-600">(Comprehensive variable dictionary and metric definitions)</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 5. MULTIDIMENSIONAL DATA ANALYSIS & SOM GUIDE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {helpSection === 'multidimensional' && (
        <div className="space-y-8 animate-fade-in">
          <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-start space-x-4">
            <div className="p-2.5 bg-amber-600/20 rounded-xl border border-amber-400/30 text-amber-300 mt-0.5 shrink-0">
              <Grid className="w-5 h-5 text-amber-400" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="text-sm font-bold text-white">Multidimensional Data Exploration & Self-Organizing Maps (SOM)</h4>
              <p className="text-gray-300 leading-relaxed">
                The <strong>Multidimensional Data Analysis</strong> module trains Kohonen Self-Organizing Maps on continuous numerical datasets, projecting high-dimensional indicator profiles or co-occurrence matrices onto a 2D hexagonal lattice while preserving topological relationships.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Step 1: Ingestion & Normalization */}
            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-3">
              <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm">
                <Sliders className="w-4 h-4" />
                <h3>1. Ingestion & Preprocessing Scalers</h3>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Load numerical CSV/TSV tables. The first column or explicit label headers identify the entities (universities, countries, research areas). Choose the appropriate scaler:
              </p>
              <ul className="space-y-2 text-gray-400 pl-2">
                <li><strong className="text-white">Min-Max [0, 1]</strong>: Ideal when indicators have bounded scales or natural zero lower bounds.</li>
                <li><strong className="text-white">Z-Score (StandardScaler)</strong>: Standardizes features to mean 0, variance 1; best for Gaussian-like distributions.</li>
                <li><strong className="text-white">Decimal Scaling</strong>: Divides by powers of 10 to retain original distribution shapes without boundary clamping.</li>
                <li><strong className="text-white">Robust Scaler</strong>: Normalizes using median and Interquartile Range (IQR), protecting against extreme citation outliers.</li>
                <li><strong className="text-white">Intertemporal Scaling</strong>: Normalizes across multiple time slices simultaneously, preserving comparative growth across years.</li>
              </ul>
            </div>

            {/* Step 2: Training Hyperparameters */}
            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-3">
              <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm">
                <Cpu className="w-4 h-4" />
                <h3>2. SOM Topology & Hyperparameters</h3>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Configure network size, training algorithms, and neighborhood functions:
              </p>
              <ul className="space-y-2 text-gray-400 pl-2">
                <li><strong className="text-white">Grid Dimension SVD Heuristic</strong>: KnoMap calculates optimal Big vs. Small grid ratios ($cols \times rows$) using ratio of the two dominant eigenvalues ($\lambda_1 / \lambda_2$).</li>
                <li><strong className="text-white">Batch vs. Basic Mode</strong>: <em>Batch SOM</em> computes centroid updates across all data points per epoch (faster and deterministic); <em>Basic SOM</em> uses stochastic online updates.</li>
                <li><strong className="text-white">Weight Initialization</strong>: <em>PCA</em> initializes neurons along the first two principal eigenvectors (fastest convergence); <em>Random</em> samples from uniform data bounds.</li>
                <li><strong className="text-white">Distance Metrics</strong>: Euclidean ($L_2$), Manhattan ($L_1$), or Canberra (emphasizes relative percentage differences).</li>
              </ul>
            </div>
          </div>

          {/* Visual Outputs of SOM */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Visual Analytics Outputs in Multidimensional Tab</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-1.5">
                <span className="text-indigo-400 font-bold text-xs">Hexagonal Lattice & Clusters</span>
                <p className="text-gray-400 leading-relaxed">
                  Hexagonal neuron layout showing sample counts, assigned labels, and agglomerative cluster boundaries.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-1.5">
                <span className="text-cyan-400 font-bold text-xs">U-Matrix (Unified Distance)</span>
                <p className="text-gray-400 leading-relaxed">
                  Depicts Euclidean distances between adjacent weight vectors. High ridges (bright) indicate separation barriers between scientific clusters.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-1.5">
                <span className="text-purple-400 font-bold text-xs">Component Planes</span>
                <p className="text-gray-400 leading-relaxed">
                  Individual sliced heatmaps for each indicator. Comparing component planes reveals correlation structures and trade-offs.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 6. DIMENSIONALITY ESTIMATION & REDUCTION GUIDE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {helpSection === 'dimreduction' && (
        <div className="space-y-8 animate-fade-in">
          <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start space-x-4">
            <div className="p-2.5 bg-rose-600/20 rounded-xl border border-rose-400/30 text-rose-300 mt-0.5 shrink-0">
              <Compass className="w-5 h-5 text-rose-400" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="text-sm font-bold text-white">Intrinsic Dimensionality Estimation & Manifold Learning</h4>
              <p className="text-gray-300 leading-relaxed">
                Before projecting high-dimensional bibliometric matrices into 2D or 3D, it is essential to determine the <strong>intrinsic dimension ($d$)</strong> of the underlying data manifold. This avoids topology collapse, distortion, and artificial clustering.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-3">
              <h3 className="text-sm font-bold text-rose-300 flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Intrinsic Dimension Estimators</span>
              </h3>
              <ul className="space-y-2.5 text-gray-400">
                <li>
                  <strong className="text-white">MLE (Maximum Likelihood Estimation)</strong>: Evaluates neighbor distance ratios within a Poisson point process assumption. KnoMap evaluates at the 95th percentile to guard against noise.
                </li>
                <li>
                  <strong className="text-white">TwoNN (Two Nearest Neighbors)</strong>: Estimates dimension from the ratio of distances to the 2nd vs. 1st nearest neighbor ($\mu = r_2 / r_1$). Highly robust against severe density variations.
                </li>
                <li>
                  <strong className="text-white">Fisher Separability (FisherS)</strong>: Explores high-dimensional geometry and concentration of measure.
                </li>
                <li>
                  <strong className="text-white">PCA Linear Ceiling</strong>: Computes variance explained by orthogonal eigenvalues (Kaiser-Guttman threshold $\lambda &gt; 1$ or 80% total cumulative variance).
                </li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-3">
              <h3 className="text-sm font-bold text-rose-300 flex items-center space-x-2">
                <Network className="w-4 h-4" />
                <span>Nonlinear Compression Algorithms</span>
              </h3>
              <ul className="space-y-2.5 text-gray-400">
                <li>
                  <strong className="text-white">UMAP (Uniform Manifold Approximation and Projection)</strong>: Constructs a fuzzy simplicial set representation in high dimensions and minimizes cross-entropy with a low-dimensional layout. Preserves both local and global cluster relationships.
                </li>
                <li>
                  <strong className="text-white">t-SNE (t-Distributed Stochastic Neighbor Embedding)</strong>: Converts Euclidean distances into conditional probabilities with Student-t distribution in target space. Focuses primarily on local neighborhoods.
                </li>
                <li>
                  <strong className="text-white">Target Dimension Selection ($d$)</strong>: Allows compressing high-dimensional matrices down to an intermediate intrinsic manifold (e.g., $d=15$) prior to SOM training.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 7. BIBLIOMETRIC NETWORKS & EDA GUIDE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {helpSection === 'bibliometrics' && (
        <div className="space-y-8 animate-fade-in">
          <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start space-x-4">
            <div className="p-2.5 bg-emerald-600/20 rounded-xl border border-emerald-400/30 text-emerald-300 mt-0.5 shrink-0">
              <Share2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="text-sm font-bold text-white">Bibliometric Preprocessing, Co-occurrence Networks & EDA</h4>
              <p className="text-gray-300 leading-relaxed">
                Ingest raw bibliographic archives from <strong>Clarivate Web of Science (WoS)</strong>, <strong>Scopus</strong>, <strong>PubMed/MEDLINE</strong>, or <strong>OpenAlex</strong>. Extract co-authorship, international collaboration, co-word, or bipartite taxonomy networks, and generate automated scientometric EDA reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-2.5">
              <h3 className="text-sm font-bold text-emerald-300">Supported File Formats</h3>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-white">Web of Science</strong>: Plaintext (`.txt`, `.ciw`) or BibTeX (`.bib`).</li>
                <li><strong className="text-white">Scopus</strong>: CSV or RIS exports.</li>
                <li><strong className="text-white">PubMed</strong>: MEDLINE text format or XML.</li>
                <li><strong className="text-white">OpenAlex</strong>: Canonical Works JSON / CSV.</li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-2.5">
              <h3 className="text-sm font-bold text-emerald-300">Network Extractors</h3>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-white">AU</strong>: Co-authorship network.</li>
                <li><strong className="text-white">C1</strong>: Institutional collaboration.</li>
                <li><strong className="text-white">CU</strong>: International country co-authorship.</li>
                <li><strong className="text-white">DE / ID / MeSH</strong>: Keyword co-occurrence.</li>
                <li><strong className="text-white">Bipartite Tags</strong>: Taxonomies &amp; SDGs (1–17).</li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-2.5">
              <h3 className="text-sm font-bold text-emerald-300">Classical Laws &amp; EDA</h3>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-white">Lotka&apos;s Law</strong>: Inverse square law of author scientific productivity.</li>
                <li><strong className="text-white">Bradford&apos;s Law</strong>: Core and peripheral journal dispersion zones.</li>
                <li><strong className="text-white">Zipf&apos;s Law</strong>: Term frequency-rank power law.</li>
                <li><strong className="text-white">Price&apos;s Law</strong>: Half of all papers produced by {"$\\sqrt{N}$"} elite authors.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 8. SEMANTIC BIBLIOMETRICS GUIDE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {helpSection === 'semantic' && (
        <div className="space-y-8 animate-fade-in">
          <div className="p-5 rounded-2xl bg-violet-950/40 border border-violet-500/30 flex items-start space-x-4">
            <div className="p-2.5 bg-violet-600/20 rounded-xl border border-violet-400/30 text-violet-300 mt-0.5 shrink-0">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="text-sm font-bold text-white">Semantic Bibliometrics & Deep Textual Manifolds</h4>
              <p className="text-gray-300 leading-relaxed">
                Move beyond lexical keyword matching by embedding scientific titles and abstracts into high-dimensional semantic spaces using dense transformer models (Nomic Embed v1.5, AllenAI SPECTER, SBERT).
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-violet-300">Semantic Processing Pipeline</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-300 pl-1">
              <li><strong className="text-white">Dense Embeddings</strong>: Converts scientific textual abstracts into dense 768-dimensional semantic vectors.</li>
              <li><strong className="text-white">Intrinsic Dimension Calibration</strong>: Calculates local MLE dimension on the semantic manifold to estimate true conceptual degrees of freedom.</li>
              <li><strong className="text-white">Manifold Compression</strong>: Compresses dense vectors to a lower-dimensional Riemannian manifold using UMAP.</li>
              <li><strong className="text-white">Research Front Clustering</strong>: Automatically groups works into conceptual research fronts and extracts distinguishing terminology with class-based TF-IDF (c-TF-IDF).</li>
            </ol>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 9. SINAPSIS AI ASSISTANT GUIDE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {helpSection === 'asistente' && (
        <div className="space-y-8 animate-fade-in">
          <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-start space-x-4">
            <div className="p-2.5 bg-purple-600/20 rounded-xl border border-purple-400/30 text-purple-300 mt-0.5 shrink-0">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="text-sm font-bold text-white">Sinapsis AI Assistant & Local Scientometric Intelligence</h4>
              <p className="text-gray-300 leading-relaxed">
                The <strong>Sinapsis AI Assistant</strong> connects your visual exploratory workspace with local or cloud Large Language Models (Ollama, llama.cpp, custom OpenAI/Claude endpoints, or UNAM Default).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-3">
              <h3 className="text-sm font-bold text-purple-300">1. &quot;Send to AI Assistant&quot; Feature</h3>
              <p className="text-gray-300 leading-relaxed">
                Every visualization in KnoMap (InCites radars, TlachIA sunbursts, SOM hexagonal lattices, UMAP scatters, and VOS networks) includes an <strong>AI Assistant</strong> button. Clicking it injects a structured JSON payload directly into the assistant context, allowing the model to perform quantitative reasoning over the exact data on screen.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-3">
              <h3 className="text-sm font-bold text-purple-300">2. Pre-engineered Scientometric Prompts</h3>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-white">Results &amp; Discussion Drafter</strong>: Compiles academic prose formatted for scientometrics journal articles.</li>
                <li><strong className="text-white">Institutional Benchmark</strong>: Summarizes comparative performance against world and national averages.</li>
                <li><strong className="text-white">Cluster Characterization</strong>: Interprets topical cohesion and thematic divergence across SOM neurons.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 10. GENERAL ARCHITECTURE & PROJECTS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {helpSection === 'general' && (
        <div className="space-y-8 animate-fade-in">
          <div className="p-5 rounded-2xl bg-teal-950/40 border border-teal-500/30 flex items-start space-x-4">
            <div className="p-2.5 bg-teal-600/20 rounded-xl border border-teal-400/30 text-teal-300 mt-0.5 shrink-0">
              <Layers className="w-5 h-5 text-teal-400" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="text-sm font-bold text-white">KnoMap Scientific Pipeline & Architecture</h4>
              <p className="text-gray-300 leading-relaxed">
                KnoMap integrates an end-to-end analytical pipeline transitioning from heterogeneous bibliometric data (Scopus, WoS, PubMed, Clarivate InCites, or OpenAlex TlachIA) to nonlinear manifold learning with Self-Organizing Maps (SOM), intrinsic dimensionality estimation, and AI qualitative synthesis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2">
              <div className="text-indigo-400 font-bold text-sm">1. Ingestion & Preprocess</div>
              <p className="text-gray-400 leading-relaxed">
                Extraction of co-occurrence matrices, VOSviewer/D3 network graph calculation, and multidimensional matrix standardization.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2">
              <div className="text-rose-400 font-bold text-sm">2. Manifold & Intrinsic Dim</div>
              <p className="text-gray-400 leading-relaxed">
                Intrinsic dimensionality estimation (MLE at 95th percentile, TwoNN) and topological manifold compression via UMAP.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2">
              <div className="text-amber-400 font-bold text-sm">3. Hexagonal SOM Lattice</div>
              <p className="text-gray-400 leading-relaxed">
                Kohonen neural network training on hexagonal grids with U-Matrix quantization, hierarchical clustering, and component planes.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2">
              <div className="text-purple-400 font-bold text-sm">4. Sinapsis AI Assistant</div>
              <p className="text-gray-400 leading-relaxed">
                Qualitative cluster interpretation, scientometric hypothesis formulation, and automated scientific report generation.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Save className="w-4 h-4 text-teal-400" />
              <span>Project Persistence & Portability</span>
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Use the top toolbar buttons to manage your workspaces:
            </p>
            <ul className="space-y-1.5 text-gray-400 pl-2">
              <li><strong className="text-white">Save Local File (.knoMap)</strong>: Exports full project state (data matrices, trained SOM weights, U-Matrix, clusters, and LLM logs) into a portable JSON file.</li>
              <li><strong className="text-white">Load Local File</strong>: Restores previous experiments without retraining from scratch.</li>
              <li><strong className="text-white">Server & Cloud Sync</strong>: In web server mode, projects can be saved directly to user cloud storage and shared with collaborators.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
