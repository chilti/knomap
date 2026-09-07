import React, { useState, useMemo, Component, type ReactNode, type ErrorInfo } from 'react';
import { useSomStore } from '../store/somStore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  LineChart, Line, Legend, Sankey, ScatterChart, Scatter, ZAxis, Cell, ReferenceLine
} from 'recharts';
import { 
  Award, FileText, Globe, Users, BookOpen, RefreshCw, AlertCircle,
  TrendingUp, Layers, Compass, Share2, BarChart2, Download
} from 'lucide-react';
import { exportChartAsPNG, exportChartAsSVG } from '../utils/chartExport';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class EdaErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("EdaErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center text-gray-400 bg-gray-900/60 rounded-xl border border-red-900/40 h-full">
          <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-sm font-semibold text-gray-200">{this.props.fallbackTitle || "Error rendering panel"}</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">{this.state.error?.message || "An unexpected error occurred while rendering."}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Reusable Chart Image Export Buttons (PNG & SVG)
 */
const ChartExportButton: React.FC<{ 
  containerId: string; 
  filename: string; 
  showSvg?: boolean;
}> = ({ 
  containerId, 
  filename, 
  showSvg = true
}) => {
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isExportingSvg, setIsExportingSvg] = useState(false);

  const handleExportPng = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExportingPng(true);
    try {
      await exportChartAsPNG(containerId, filename, 2, '#111827');
    } catch (err) {
      console.error(`[ChartExportButton] PNG export failed for ${containerId}:`, err);
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleExportSvg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExportingSvg(true);
    try {
      exportChartAsSVG(containerId, filename, '#111827');
    } catch (err) {
      console.error(`[ChartExportButton] SVG export failed for ${containerId}:`, err);
    } finally {
      setIsExportingSvg(false);
    }
  };

  return (
    <div className="inline-flex items-center space-x-1 bg-gray-800/90 p-0.5 rounded-lg border border-gray-700/70 shadow-sm select-none">
      <button
        type="button"
        onClick={handleExportPng}
        disabled={isExportingPng}
        title="Export high-resolution PNG (2x Retina)"
        className="flex items-center space-x-1 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:text-white hover:bg-indigo-600/90 active:scale-95 transition-all rounded cursor-pointer disabled:opacity-50"
      >
        <Download className={`w-3 h-3 ${isExportingPng ? 'animate-bounce text-indigo-300' : 'text-indigo-400'}`} />
        <span>{isExportingPng ? '...' : 'PNG'}</span>
      </button>
      {showSvg && (
        <>
          <div className="w-[1px] h-3 bg-gray-700 mx-0.5" />
          <button
            type="button"
            onClick={handleExportSvg}
            disabled={isExportingSvg}
            title="Export scalable vector SVG"
            className="flex items-center space-x-1 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:text-white hover:bg-purple-600/90 active:scale-95 transition-all rounded cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-3 h-3 ${isExportingSvg ? 'animate-bounce text-purple-300' : 'text-purple-400'}`} />
            <span>{isExportingSvg ? '...' : 'SVG'}</span>
          </button>
        </>
      )}
    </div>
  );
};

type TabKey = 'overview' | 'laws' | 'geopolitics' | 'thematic';

const BiblioEdaReportContent: React.FC = () => {
  const { edaReport, sankeyData, termGrowth, isPreprocessing, uploadProgress } = useSomStore();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const health = edaReport?.health || {};
  const averages = edaReport?.averages || {};
  const author_metrics = edaReport?.author_metrics || [];
  const top_keywords = edaReport?.top_keywords || [];
  const bradford = edaReport?.bradford_law;
  const lotka = edaReport?.lotka_law;
  const countryCollab = edaReport?.country_collab;
  const annualProd = edaReport?.annual_production;
  const thematicMap = edaReport?.thematic_map;

  // Vibrant palette for charts and tags
  const colors = [
    "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", 
    "#ec4899", "#06b6d4", "#a855f7", "#14b8a6", "#f97316"
  ];

  // HOOK 1: Dense 2D Word Cloud layout (High-capacity Archimedean spiral packing)
  const cloudWords = useMemo(() => {
    if (!top_keywords || top_keywords.length === 0) return [];
    
    // Virtual high-density canvas
    const width = 860;
    const height = 400;
    const cx = width / 2;
    const cy = height / 2;

    const values = top_keywords.map((k: any) => Number(k?.value) || 1);
    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values, 1);

    // Expand to top 250 keywords for rich, dense coverage
    const sorted = [...top_keywords]
      .sort((a: any, b: any) => (Number(b?.value) || 0) - (Number(a?.value) || 0))
      .slice(0, 250);

    const placedRects: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const placed: { text: string; value: number; size: number; x: number; y: number; color: string }[] = [];

    const collides = (x1: number, y1: number, x2: number, y2: number) => {
      for (let i = 0; i < placedRects.length; i++) {
        const r = placedRects[i];
        if (!(x2 < r.x1 || x1 > r.x2 || y2 < r.y1 || y1 > r.y2)) {
          return true;
        }
      }
      return false;
    };

    sorted.forEach((w: any, i: number) => {
      const val = Number(w?.value) || 1;
      const norm = Math.pow((val - minVal) / (maxVal - minVal || 1), 0.50);
      let size = Math.round(9 + norm * 26); // Size between 9px and 35px
      const color = colors[i % colors.length];

      let wordWidth = Math.max(12, String(w?.text || '').length * (size * 0.50) + 3);
      let wordHeight = size + 2;
      let wasPlaced = false;

      // Pass 1: standard tight Archimedean spiral expanding to full boundaries
      for (let step = 0; step < 950; step++) {
        const angle = step * 0.28;
        const radius = 1.45 * angle;
        const x = cx + radius * Math.cos(angle) - wordWidth / 2;
        const y = cy + (radius * 0.44) * Math.sin(angle) - wordHeight / 2;

        const x1 = x;
        const y1 = y;
        const x2 = x + wordWidth;
        const y2 = y + wordHeight;

        if (x1 >= 6 && x2 <= width - 6 && y1 >= 6 && y2 <= height - 6) {
          if (!collides(x1, y1, x2, y2)) {
            placedRects.push({ x1, y1, x2, y2 });
            placed.push({
              text: String(w?.text || ''),
              value: val,
              size,
              x: x + wordWidth / 2,
              y: y + wordHeight * 0.78,
              color
            });
            wasPlaced = true;
            break;
          }
        }
      }

      // Pass 2: fallback with reduced size if collided
      if (!wasPlaced && size > 11) {
        size = Math.max(9, Math.round(size * 0.72));
        wordWidth = Math.max(10, String(w?.text || '').length * (size * 0.49) + 2);
        wordHeight = size + 2;

        for (let step = 0; step < 850; step++) {
          const angle = step * 0.28;
          const radius = 1.35 * angle;
          const x = cx + radius * Math.cos(angle) - wordWidth / 2;
          const y = cy + (radius * 0.44) * Math.sin(angle) - wordHeight / 2;

          const x1 = x;
          const y1 = y;
          const x2 = x + wordWidth;
          const y2 = y + wordHeight;

          if (x1 >= 5 && x2 <= width - 5 && y1 >= 5 && y2 <= height - 5 && !collides(x1, y1, x2, y2)) {
            placedRects.push({ x1, y1, x2, y2 });
            placed.push({
              text: String(w?.text || ''),
              value: val,
              size,
              x: x + wordWidth / 2,
              y: y + wordHeight * 0.78,
              color
            });
            wasPlaced = true;
            break;
          }
        }
      }

      // Pass 3: secondary compact filler for remaining words
      if (!wasPlaced) {
        size = 8.5;
        wordWidth = Math.max(9, String(w?.text || '').length * (size * 0.49) + 2);
        wordHeight = size + 1;

        for (let step = 0; step < 750; step++) {
          const angle = step * 0.28;
          const radius = 1.25 * angle;
          const x = cx + radius * Math.cos(angle) - wordWidth / 2;
          const y = cy + (radius * 0.44) * Math.sin(angle) - wordHeight / 2;

          const x1 = x;
          const y1 = y;
          const x2 = x + wordWidth;
          const y2 = y + wordHeight;

          if (x1 >= 4 && x2 <= width - 4 && y1 >= 4 && y2 <= height - 4 && !collides(x1, y1, x2, y2)) {
            placedRects.push({ x1, y1, x2, y2 });
            placed.push({
              text: String(w?.text || ''),
              value: val,
              size,
              x: x + wordWidth / 2,
              y: y + wordHeight * 0.78,
              color
            });
            break;
          }
        }
      }
    });

    return placed;
  }, [top_keywords]);

  // HOOK 2: Sankey Node & Link sanitization
  const validSankeyData = useMemo(() => {
    if (!sankeyData?.nodes || !sankeyData?.links || sankeyData.nodes.length === 0 || sankeyData.links.length === 0) {
      return null;
    }
    const nodeCount = sankeyData.nodes.length;
    const nodes = sankeyData.nodes.map((n: any, i: number) => ({
      name: String(n?.name || `Node ${i}`),
      fill: colors[i % colors.length]
    }));

    const links = sankeyData.links.filter((l: any) => {
      const src = typeof l?.source === 'number' ? l.source : parseInt(l?.source);
      const dst = typeof l?.target === 'number' ? l.target : parseInt(l?.target);
      return !isNaN(src) && !isNaN(dst) &&
             src >= 0 && src < nodeCount &&
             dst >= 0 && dst < nodeCount &&
             src !== dst &&
             (Number(l?.value) || 0) > 0;
    }).map((l: any) => ({
      source: Number(l.source),
      target: Number(l.target),
      value: Number(l.value) || 1,
      sourceName: String(l.sourceName || ''),
      targetName: String(l.targetName || '')
    }));

    if (links.length === 0) return null;
    return { nodes, links };
  }, [sankeyData]);

  // HOOK 3: Bradford curve formatting
  const bradfordChartData = useMemo(() => {
    if (!bradford?.curve || bradford.curve.length === 0) return [];
    return bradford.curve.map((c: any) => ({
      rank: c.rank,
      logRank: Number(c.log_rank || 0).toFixed(2),
      cumArticles: c.cum_articles,
      cumPercent: c.cum_percent,
      source: c.source,
      zone: c.zone
    }));
  }, [bradford]);

  // HOOK 4: Thematic map formatting
  const thematicScatterData = useMemo(() => {
    if (!thematicMap?.clusters || thematicMap.clusters.length === 0) return [];
    const quadColors: Record<string, string> = {
      'Motor Themes': '#10b981',
      'Niche Themes': '#3b82f6',
      'Basic Themes': '#8b5cf6',
      'Emerging or Declining': '#f59e0b'
    };
    return thematicMap.clusters.map((t: any) => ({
      ...t,
      x: Number(t.centrality || 0),
      y: Number(t.density || 0),
      z: Number(t.size || 1) * 15,
      color: quadColors[t.quadrant] || '#6366f1'
    }));
  }, [thematicMap]);

  // Early returns safely AFTER all hooks are called
  if (isPreprocessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center bg-gray-950 space-y-4">
        <div className="relative">
          <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-bold text-white">
            {uploadProgress !== null && uploadProgress < 100
              ? `Uploading dataset... ${uploadProgress}%`
              : 'Computing Exploratory Data Analysis (Bibliometrix)...'}
          </p>
          <p className="text-xs text-gray-500 max-w-sm">
            Extracting Bradford & Lotka laws, SCP/MCP geopolitics, CAGR growth, and Strategic Thematic Map.
          </p>
        </div>
      </div>
    );
  }

  if (!edaReport || !edaReport.success) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center bg-gray-950">
        <p className="text-lg font-medium text-gray-200">No EDA Data Available</p>
        <p className="text-sm mt-2 max-w-md">Run bibliometrics parsing to generate Exploratory Data Analysis metrics.</p>
        {edaReport?.error && (
          <p className="text-xs mt-4 text-red-400 bg-red-950/40 p-2 rounded border border-red-900/50">
            {edaReport.error}
          </p>
        )}
      </div>
    );
  }

  // Derived global figures
  const totalScp = countryCollab?.top_countries?.reduce((acc: number, c: any) => acc + (c.scp || 0), 0) ?? 0;
  const totalMcp = countryCollab?.top_countries?.reduce((acc: number, c: any) => acc + (c.mcp || 0), 0) ?? 0;
  const globalMcpRate = (totalScp + totalMcp > 0) ? Number(((totalMcp / (totalScp + totalMcp)) * 100).toFixed(1)) : 0;
  const cagrValue = annualProd?.cagr_percent ?? 0;

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 text-gray-200 overflow-y-auto p-6 space-y-6 hide-scrollbar">
      {/* Top Header & Sub-Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-indigo-400" />
            Exploratory Data Analysis (Bibliometrix Suite)
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Cienciometría avanzada: leyes clásicas de dispersión y productividad, colaboración geopolítica, crecimiento temporal y mapa estratégico.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center space-x-1 bg-gray-900 p-1 rounded-xl border border-gray-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-all ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Overview & Dynamics</span>
          </button>

          <button
            onClick={() => setActiveTab('laws')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-all ${
              activeTab === 'laws'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Classical Laws</span>
          </button>

          <button
            onClick={() => setActiveTab('geopolitics')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-all ${
              activeTab === 'geopolitics'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Geopolitics & Authors</span>
          </button>

          <button
            onClick={() => setActiveTab('thematic')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg transition-all ${
              activeTab === 'thematic'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Thematic Map</span>
          </button>
        </div>
      </div>

      {/* Global Metric Cards (Always visible) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Documents</span>
            </span>
            {annualProd?.cagr_percent !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                cagrValue >= 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50' : 'bg-red-950/80 text-red-300 border border-red-800/50'
              }`}>
                CAGR {cagrValue > 0 ? `+${cagrValue}%` : `${cagrValue}%`}
              </span>
            )}
          </div>
          <div className="text-3xl font-bold text-white">{health.total_documents ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Timespan: {health.timespan ?? annualProd?.timespan ?? 'N/A'}</div>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Authors</span>
            </span>
            {globalMcpRate > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-950/80 text-blue-300 border border-blue-800/50">
                MCP {globalMcpRate}%
              </span>
            )}
          </div>
          <div className="text-3xl font-bold text-white">{health.total_authors ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Collab Index: {averages.collab_index ?? 0}</div>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center space-x-2 text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Globe className="w-4 h-4 text-purple-400" />
            <span>Sources</span>
          </div>
          <div className="text-3xl font-bold text-white">{health.total_sources ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">
            Bradford Core: {bradford?.summary?.zone1_journals ?? 0} journals
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center space-x-2 text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Award className="w-4 h-4 text-pink-400" />
            <span>Citations</span>
          </div>
          <div className="text-3xl font-bold text-white">{health.total_citations ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Avg/Doc: {averages.cits_per_doc ?? 0}</div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & DYNAMICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Annual Scientific Production Chart */}
          {annualProd?.series && annualProd.series.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-emerald-400" />
                  Annual Scientific Production & Average Citations
                </h3>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-400 font-mono bg-gray-800/80 px-2.5 py-1 rounded border border-gray-700">
                    Annual Growth Rate (CAGR): <span className="text-emerald-400 font-bold">{cagrValue}%</span>
                  </span>
                  <ChartExportButton containerId="eda-annual-prod-chart" filename="Annual_Scientific_Production" />
                </div>
              </div>
              <div id="eda-annual-prod-chart" className="w-full h-[320px] relative bg-gray-950/60 p-2 rounded-lg border border-gray-800/60">
                <EdaErrorBoundary fallbackTitle="Annual scientific production chart unavailable">
                  <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={100} debounce={50}>
                    <BarChart data={annualProd.series} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="year" stroke="#9ca3af" fontSize={11} />
                      <YAxis yAxisId="left" orientation="left" stroke="#9ca3af" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar yAxisId="left" dataKey="articles" name="Articles Produced" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="avg_citations" name="Avg Citations / Doc" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </EdaErrorBoundary>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Dense 2D WordCloud */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center">
                  <span>Topics WordCloud</span>
                  <span className="text-[11px] font-mono font-normal text-indigo-400 ml-2">
                    ({cloudWords.length} términos compactados)
                  </span>
                </h3>
                <ChartExportButton containerId="eda-wordcloud-chart" filename="Topics_WordCloud_2D" />
              </div>
              <div 
                id="eda-wordcloud-chart" 
                className="w-full h-[400px] overflow-hidden bg-gray-950 border border-gray-800 rounded-lg p-2 flex items-center justify-center relative"
              >
                {cloudWords && cloudWords.length > 0 ? (
                  <svg viewBox="0 0 860 400" className="w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
                    <rect width="100%" height="100%" fill="#030712" />
                    {cloudWords.map((word, idx) => (
                      <text
                        key={idx}
                        x={word.x}
                        y={word.y}
                        textAnchor="middle"
                        fill={word.color}
                        fontSize={word.size}
                        fontWeight={word.size > 22 ? "bold" : word.size > 14 ? "600" : "500"}
                        className="cursor-pointer transition-all duration-200 hover:brightness-125"
                        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
                      >
                        {word.text}
                        <title>{`${word.text} (Frequency: ${word.value})`}</title>
                      </text>
                    ))}
                  </svg>
                ) : (
                  <div className="text-gray-500">No keyword data found.</div>
                )}
              </div>
            </div>

            {/* Term Growth Plot */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                  Temporal Term Growth
                </h3>
                <ChartExportButton containerId="eda-term-growth-chart" filename="Temporal_Term_Growth" />
              </div>
              <div id="eda-term-growth-chart" className="w-full h-[400px] relative bg-gray-950/60 p-2 rounded-lg border border-gray-800/60">
                <EdaErrorBoundary fallbackTitle="Temporal term growth unavailable">
                  {termGrowth?.data && termGrowth.data.length > 0 && termGrowth?.lines && termGrowth.lines.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minHeight={380} minWidth={100} debounce={50}>
                      <LineChart data={termGrowth.data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="year" stroke="#9ca3af" fontSize={11} />
                        <YAxis stroke="#9ca3af" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        {termGrowth.lines.map((t: string, i: number) => (
                          <Line key={t} type="monotone" dataKey={t} stroke={colors[i % colors.length]} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">No temporal data available.</div>
                  )}
                </EdaErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLASSICAL BIBLIOMETRIC LAWS */}
      {activeTab === 'laws' && (
        <div className="space-y-6">
          {/* Bradford's Law Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center">
                  <Layers className="w-4 h-4 mr-2 text-purple-400" />
                  Bradford&apos;s Law of Scattering (Journal Core Dispersion)
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Partición del corpus en 3 zonas con igual volumen de artículos: Zona 1 (Núcleo nuclear), Zona 2 (Moderada) y Zona 3 (Periférica). Multiplicador de Bradford $k$: <span className="text-purple-300 font-mono font-semibold">{bradford?.summary?.multiplier_k ?? 'N/A'}</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Zona 1 (Core)</span>
                  <span className="text-xs font-bold text-white">{bradford?.summary?.zone1_journals ?? 0} fuentes</span>
                  <span className="text-[10px] text-purple-400 block">{bradford?.summary?.zone1_articles ?? 0} arts</span>
                </div>
                <div className="bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Zona 2</span>
                  <span className="text-xs font-bold text-white">{bradford?.summary?.zone2_journals ?? 0} fuentes</span>
                  <span className="text-[10px] text-purple-400 block">{bradford?.summary?.zone2_articles ?? 0} arts</span>
                </div>
                <div className="bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-lg text-center">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Zona 3</span>
                  <span className="text-xs font-bold text-white">{bradford?.summary?.zone3_journals ?? 0} fuentes</span>
                  <span className="text-[10px] text-purple-400 block">{bradford?.summary?.zone3_articles ?? 0} arts</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">
              {/* Bradford Accumulation Curve */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Curva de Acumulación de Bradford (Artículos vs Log(Rank))
                  </h4>
                  <ChartExportButton containerId="eda-bradford-curve-chart" filename="Bradford_Law_Scattering_Curve" />
                </div>
                <div id="eda-bradford-curve-chart" className="w-full h-[320px] relative bg-gray-950/60 p-2 rounded-lg border border-gray-800/80">
                  <EdaErrorBoundary fallbackTitle="Bradford curve unavailable">
                    {bradfordChartData && bradfordChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" minHeight={290} minWidth={100} debounce={50}>
                        <LineChart data={bradfordChartData} margin={{ top: 10, right: 25, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="logRank" stroke="#9ca3af" fontSize={11} label={{ value: 'Log(Rank)', position: 'insideBottomRight', offset: -5, fill: '#9ca3af', fontSize: 10 }} />
                          <YAxis stroke="#9ca3af" fontSize={11} label={{ value: 'Artículos Acum.', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                            formatter={(value: any, _name: any, item: any) => [
                              `${value} arts (${item?.payload?.cumPercent}%)`,
                              `${item?.payload?.source || 'Source'} (Rank ${item?.payload?.rank})`
                            ]}
                          />
                          <Line type="monotone" dataKey="cumArticles" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-500">No Bradford curve data available.</div>
                    )}
                  </EdaErrorBoundary>
                </div>
              </div>

              {/* Core Sources Table (Zone 1) */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
                    <span>Revistas Nucleares (Zona 1 - Core Sources)</span>
                    <span className="text-[11px] font-mono text-purple-400 font-normal ml-2">
                      ({bradford?.core_sources?.length || 0} revistas élite)
                    </span>
                  </h4>
                  <ChartExportButton containerId="eda-bradford-table-box" filename="Bradford_Core_Sources_Table" showSvg={false} />
                </div>
                <div id="eda-bradford-table-box" className="w-full h-[320px] overflow-y-auto bg-gray-950/80 rounded-lg border border-gray-800/80 divide-y divide-gray-800/60 p-1">
                  {bradford?.core_sources && bradford.core_sources.length > 0 ? (
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-gray-800/80 text-[10px] uppercase font-bold text-gray-400 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Rank</th>
                          <th className="py-2 px-3">Revista / Fuente</th>
                          <th className="py-2 px-2 text-right">Artículos</th>
                          <th className="py-2 px-3 text-right">Acumulado %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50 font-mono text-[11px]">
                        {bradford.core_sources.map((cs: any) => (
                          <tr key={cs.rank} className="hover:bg-gray-800/40 transition-colors">
                            <td className="py-2 px-3 text-purple-400 font-bold">#{cs.rank}</td>
                            <td className="py-2 px-3 font-sans text-gray-200 truncate max-w-[200px]" title={cs.source}>
                              {cs.source}
                            </td>
                            <td className="py-2 px-2 text-right text-white font-semibold">{cs.articles}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">{cs.cum_percent}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">No core sources identified.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Lotka's Law Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center">
                  <Award className="w-4 h-4 mr-2 text-amber-400" />
                  Lotka&apos;s Law (Author Scientific Productivity Distribution)
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Distribución de ley de potencia: $y = C / x^\beta$. Exponente empírico estimado mediante regresión logarítmica.
                </p>
              </div>
              <div className="flex items-center space-x-3 text-xs font-mono">
                <div className="bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">Exponente Beta (&beta;)</span>
                  <span className="text-sm font-bold text-amber-400">{lotka?.beta ?? 'N/A'}</span>
                  <span className="text-[10px] text-gray-500 block">Teórico: 2.0</span>
                </div>
                <div className="bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">Constante C</span>
                  <span className="text-sm font-bold text-emerald-400">{lotka?.constant_c ?? 'N/A'}</span>
                  <span className="text-[10px] text-gray-500 block">Teórico: 0.6079</span>
                </div>
                <div className="bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">Autores Único Art.</span>
                  <span className="text-sm font-bold text-blue-400">
                    {lotka?.single_paper_ratio !== undefined ? `${(lotka.single_paper_ratio * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-gray-500 block">Transitorios</span>
                </div>
              </div>
            </div>

            {/* Lotka Chart */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Frecuencia Empírica vs Modelo Teórico de Lotka (% de Autores por Cantidad de Artículos)
                </h4>
                <ChartExportButton containerId="eda-lotka-chart" filename="Lotka_Law_Productivity" />
              </div>
              <div id="eda-lotka-chart" className="w-full h-[320px] relative bg-gray-950/60 p-2 rounded-lg border border-gray-800/80">
                <EdaErrorBoundary fallbackTitle="Lotka law chart unavailable">
                  {lotka?.data && lotka.data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minHeight={290} minWidth={100} debounce={50}>
                      <BarChart data={lotka.data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="documents" stroke="#9ca3af" fontSize={11} label={{ value: 'Nº Artículos por Autor', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 10 }} />
                        <YAxis stroke="#9ca3af" fontSize={11} label={{ value: '% de Autores', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                          formatter={(val: any) => [`${val}%`, '']}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                        <Bar dataKey="empirical_percent" name="Empírico (% Autores)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="theoretical_percent" name="Teórico Lotka (% Esperado)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">No Lotka data available.</div>
                  )}
                </EdaErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GEOPOLITICS & AUTHORS */}
      {activeTab === 'geopolitics' && (
        <div className="space-y-6">
          {/* Country Scientific Collaboration (SCP vs MCP) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center">
                  <Globe className="w-4 h-4 mr-2 text-cyan-400" />
                  Country Collaboration: SCP (Single Country) vs MCP (Multiple Country)
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Artículos con autores de un solo país (SCP - Nacional) vs coautorías internacionales multi-país (MCP). Tasa internacional global: <span className="text-cyan-400 font-mono font-bold">{globalMcpRate}%</span>
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-xs font-mono">
                  <div className="bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-lg text-center">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">Total SCP</span>
                    <span className="text-sm font-bold text-indigo-400">{totalScp}</span>
                  </div>
                  <div className="bg-gray-800/80 border border-gray-700/60 px-3 py-1.5 rounded-lg text-center">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">Total MCP</span>
                    <span className="text-sm font-bold text-cyan-400">{totalMcp}</span>
                  </div>
                </div>
                <ChartExportButton containerId="eda-country-collab-chart" filename="Country_Collaboration_SCP_MCP" />
              </div>
            </div>

            <div id="eda-country-collab-chart" className="w-full h-[350px] relative bg-gray-950/60 p-2 rounded-lg border border-gray-800/60">
              <EdaErrorBoundary fallbackTitle="Country collaboration chart unavailable">
                {countryCollab?.top_countries && countryCollab.top_countries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={320} minWidth={100} debounce={50}>
                    <BarChart data={countryCollab.top_countries} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="country" stroke="#9ca3af" fontSize={11} angle={-25} textAnchor="end" interval={0} />
                      <YAxis stroke="#9ca3af" fontSize={11} label={{ value: 'Nº Publicaciones', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                        formatter={(val: any, name: any, item: any) => {
                          if (name === 'Multiple Country (MCP)') {
                            const ratio = item?.payload?.mcp_ratio !== undefined ? `${(item.payload.mcp_ratio * 100).toFixed(1)}%` : '';
                            return [`${val} (${ratio} intl)`, name];
                          }
                          return [val, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="scp" name="Single Country (SCP)" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="mcp" name="Multiple Country (MCP)" stackId="a" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500">No country collaboration data available.</div>
                )}
              </EdaErrorBoundary>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Top Authors by H-Index */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center">
                  <Award className="w-4 h-4 mr-2 text-yellow-400" />
                  Top Authors by H-Index & G-Index
                </h3>
                <ChartExportButton containerId="eda-top-authors-chart" filename="Top_Authors_H_Index" />
              </div>
              <div id="eda-top-authors-chart" className="w-full h-[340px] relative bg-gray-950/60 p-2 rounded-lg border border-gray-800/60">
                <EdaErrorBoundary fallbackTitle="Author metrics chart unavailable">
                  {author_metrics && author_metrics.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minHeight={310} minWidth={100} debounce={50}>
                      <BarChart data={author_metrics.slice(0, 15)} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                        <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                        <YAxis 
                          dataKey="author" 
                          type="category" 
                          width={110} 
                          stroke="#9ca3af" 
                          fontSize={10} 
                          tickFormatter={(val) => {
                            if (!val) return '';
                            const s = String(val);
                            return s.length > 15 ? s.substring(0, 15) + '...' : s;
                          }} 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                          itemStyle={{ color: '#818cf8' }}
                        />
                        <Bar dataKey="h_index" name="H-Index" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="g_index" name="G-Index" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">No author citation metrics available.</div>
                  )}
                </EdaErrorBoundary>
              </div>
            </div>

            {/* Sankey Knowledge Flows */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center">
                  <Share2 className="w-4 h-4 mr-2 text-emerald-400" />
                  Knowledge Flows (Country → Inst → Source)
                </h3>
                <ChartExportButton containerId="eda-sankey-chart" filename="Knowledge_Flows_Sankey" />
              </div>
              <div id="eda-sankey-chart" className="w-full h-[340px] relative bg-gray-950/60 p-2 rounded-lg border border-gray-800/60">
                <EdaErrorBoundary fallbackTitle="Knowledge flow diagram unavailable">
                  {validSankeyData ? (
                    <ResponsiveContainer width="100%" height="100%" minHeight={310} minWidth={100} debounce={50}>
                      <Sankey
                        data={validSankeyData}
                        nodePadding={20}
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                        link={{ stroke: '#374151', strokeOpacity: 0.3 }}
                      >
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                          formatter={(val: any, name: any, props: any) => {
                            if (props?.payload?.sourceName && props?.payload?.targetName) {
                              return [val, `${props.payload.sourceName} → ${props.payload.targetName}`];
                            }
                            return [val, name];
                          }}
                        />
                      </Sankey>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-500">Not enough data to build Sankey flow.</div>
                  )}
                </EdaErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: THEMATIC MAP */}
      {activeTab === 'thematic' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center">
                  <Compass className="w-4 h-4 mr-2 text-indigo-400" />
                  Strategic Thematic Diagram (Callon&apos;s Centrality vs Density)
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Mapa estratégico de clusters temáticos (Callon, 1991). Eje X: Centralidad (relevancia externa); Eje Y: Densidad (desarrollo interno).
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-emerald-950/40 border border-emerald-800/40 p-2 rounded text-emerald-300">
                    <span className="font-bold block">Motor Themes</span>
                    <span className="text-[10px] text-emerald-400/80">Alta Dens. + Alta Cent.</span>
                  </div>
                  <div className="bg-blue-950/40 border border-blue-800/40 p-2 rounded text-blue-300">
                    <span className="font-bold block">Niche Themes</span>
                    <span className="text-[10px] text-blue-400/80">Alta Dens. + Baja Cent.</span>
                  </div>
                  <div className="bg-purple-950/40 border border-purple-800/40 p-2 rounded text-purple-300">
                    <span className="font-bold block">Basic Themes</span>
                    <span className="text-[10px] text-purple-400/80">Baja Dens. + Alta Cent.</span>
                  </div>
                  <div className="bg-amber-950/40 border border-amber-800/40 p-2 rounded text-amber-300">
                    <span className="font-bold block">Emerging / Declining</span>
                    <span className="text-[10px] text-amber-400/80">Baja Dens. + Baja Cent.</span>
                  </div>
                </div>
                <ChartExportButton containerId="eda-thematic-map-chart" filename="Strategic_Thematic_Map_Callon" />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-2">
              {/* Strategic Scatter Quadrants Plot */}
              <div className="xl:col-span-2 flex flex-col">
                <div id="eda-thematic-map-chart" className="w-full h-[420px] relative bg-gray-950/80 p-4 rounded-xl border border-gray-800">
                  <EdaErrorBoundary fallbackTitle="Thematic scatter chart unavailable">
                    {thematicScatterData && thematicScatterData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" minHeight={380} minWidth={100} debounce={50}>
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                          <XAxis 
                            type="number" 
                            dataKey="x" 
                            name="Centrality" 
                            stroke="#9ca3af" 
                            fontSize={11} 
                            label={{ value: "Callon's Centrality (External Relevance) →", position: 'insideBottom', offset: -15, fill: '#9ca3af', fontSize: 11 }}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="y" 
                            name="Density" 
                            stroke="#9ca3af" 
                            fontSize={11} 
                            label={{ value: "Callon's Density (Internal Development) →", angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af', fontSize: 11 }}
                          />
                          <ZAxis type="number" dataKey="z" range={[100, 500]} />
                          {thematicMap?.median_centrality !== undefined && (
                            <ReferenceLine x={thematicMap.median_centrality} stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1.5} />
                          )}
                          {thematicMap?.median_density !== undefined && (
                            <ReferenceLine y={thematicMap.median_density} stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1.5} />
                          )}
                          <Tooltip
                            contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                            formatter={(val: any, name: any, item: any) => {
                              if (name === 'Centrality' || name === 'Density') return [val, name];
                              return [item?.payload?.name, 'Cluster'];
                            }}
                          />
                          <Scatter name="Themes" data={thematicScatterData}>
                            {thematicScatterData.map((entry: any, index: number) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color} 
                                opacity={0.85}
                                stroke="#ffffff"
                                strokeWidth={1}
                              />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-500">
                        Insufficient co-occurrence clusters to build Thematic Map.
                      </div>
                    )}
                  </EdaErrorBoundary>
                </div>
              </div>

              {/* Thematic Cluster Cards List */}
              <div className="flex flex-col space-y-2 h-[420px] overflow-y-auto pr-1">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Detected Themes ({thematicMap?.clusters?.length || 0})</span>
                  <BarChart2 className="w-3.5 h-3.5 text-gray-500" />
                </h4>
                {thematicMap?.clusters && thematicMap.clusters.length > 0 ? (
                  thematicMap.clusters.map((t: any) => (
                    <div 
                      key={t.id} 
                      className="bg-gray-950/70 border border-gray-800/80 p-3 rounded-lg hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-white flex items-center">
                          <span 
                            className="w-2.5 h-2.5 rounded-full mr-2 inline-block shrink-0" 
                            style={{ 
                              backgroundColor: t.quadrant === 'Motor Themes' ? '#10b981' :
                                               t.quadrant === 'Niche Themes' ? '#3b82f6' :
                                               t.quadrant === 'Basic Themes' ? '#8b5cf6' : '#f59e0b'
                            }}
                          />
                          {t.name}
                        </span>
                        <span 
                          className="text-[10px] font-semibold px-2 py-0.5 rounded"
                          style={{ 
                            backgroundColor: t.quadrant === 'Motor Themes' ? '#10b98122' :
                                             t.quadrant === 'Niche Themes' ? '#3b82f622' :
                                             t.quadrant === 'Basic Themes' ? '#8b5cf622' : '#f59e0b22',
                            color: t.quadrant === 'Motor Themes' ? '#34d399' :
                                   t.quadrant === 'Niche Themes' ? '#60a5fa' :
                                   t.quadrant === 'Basic Themes' ? '#c084fc' : '#fbbf24',
                            border: `1px solid ${
                              t.quadrant === 'Motor Themes' ? '#10b98155' :
                              t.quadrant === 'Niche Themes' ? '#3b82f655' :
                              t.quadrant === 'Basic Themes' ? '#8b5cf655' : '#f59e0b55'
                            }`
                          }}
                        >
                          {t.quadrant}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[10px] font-mono text-gray-400 mb-2">
                        <span>Centrality: <strong className="text-gray-200">{t.centrality}</strong></span>
                        <span>Density: <strong className="text-gray-200">{t.density}</strong></span>
                        <span>Size: <strong className="text-gray-200">{t.size} terms</strong></span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {t.keywords?.map((w: string, wi: number) => (
                          <span key={wi} className="text-[9px] bg-gray-900 border border-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500 text-xs">
                    No thematic clusters available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const BiblioEdaReport: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col">
      <EdaErrorBoundary fallbackTitle="Exploratory Data Analysis view encountered an error">
        <BiblioEdaReportContent />
      </EdaErrorBoundary>
    </div>
  );
};
