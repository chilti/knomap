import React, { useEffect, useMemo, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  CartesianGrid, Legend
} from 'recharts';
import type { ChartSnapshot } from '../store/aiStore';
import { useSomStore } from '../store/somStore';
import { denormalizeValue } from '../utils/normalization';
import {
  SOM_FLAT_HEX_APOTEMA,
  buildComponentChromaScale,
  computeAllComponentStats,
  getFlatHexPolygonPoints,
  getHexClusterBorders,
  resolveComponentScaleBounds,
  type SomPaletteName
} from '../utils/somGeometry';
import { Eye, Image as ImageIcon, Download, Copy, Check, Layers, Sparkles, Grid3X3, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface InteractiveChartViewerProps {
  snapshot: ChartSnapshot;
  resolvedExperimentId?: string | null;
  onOpenOriginal?: () => void;
}

export const InteractiveChartViewer: React.FC<InteractiveChartViewerProps> = ({
  snapshot,
  resolvedExperimentId
}) => {
  const { savedRuns, result: activeSomResult, compNames: activeCompNames, normalizationInfo: activeNormInfo, originalDataMatrix: activeOrigMatrix, dataMatrix: activeDataMatrix, config: activeConfig } = useSomStore();
  const [viewMode, setViewMode] = useState<'svg' | 'interactive' | 'components' | 'image'>(
    snapshot.svgMarkup ? 'svg' : 'interactive'
  );
  const [copied, setCopied] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [hoveredCompCell, setHoveredCompCell] = useState<{ compName: string; neuronIndex: number; realVal: number; normVal: number; clusterId: number } | null>(null);
  const [compPage, setCompPage] = useState(0);
  const [compSearch, setCompSearch] = useState('');
  const [showClusterBorders, setShowClusterBorders] = useState(true);
  const [compPalette, setCompPalette] = useState<SomPaletteName>(
    (snapshot.data?.colorScale as SomPaletteName) || 'standard'
  );

  const { chartType, data, config, thumbnailPng, svgMarkup } = snapshot;

  // Resolve component-plane dataset from snapshot directly or fallback to matched savedRun / active SOM state
  const componentPlaneModel = useMemo(() => {
    if (chartType !== 'hex_map') return null;

    const expId = snapshot.sourceInfo?.experimentId || resolvedExperimentId || null;
    const matchedRun = expId ? savedRuns.find(r => r.id === expId) : undefined;
    const activeMatches =
      !matchedRun &&
      activeSomResult?.weights?.length &&
      data?.rows === activeConfig?.rows &&
      data?.cols === activeConfig?.cols;

    const hexGrid = data?.hexGrid || matchedRun?.result?.hexGrid || (activeMatches ? activeSomResult?.hexGrid : null) || [];
    const weights: number[][] | undefined =
      data?.weights || matchedRun?.result?.weights || (activeMatches ? activeSomResult?.weights : undefined);
    const compNames: string[] =
      data?.compNames || matchedRun?.compNames || (activeMatches ? activeCompNames : []) || [];
    const clustering: number[] =
      data?.clustering || matchedRun?.result?.clustering || (activeMatches ? activeSomResult?.clustering : []) || [];
    const rows: number = Number(data?.rows || matchedRun?.config?.rows || (activeMatches ? activeConfig?.rows : 0) || 0);
    const cols: number = Number(data?.cols || matchedRun?.config?.cols || (activeMatches ? activeConfig?.cols : 0) || 0);

    if (!hexGrid.length || !weights?.length || !compNames.length || !rows || !cols) {
      return null;
    }

    const normalizationInfo =
      data?.normalizationInfo ?? matchedRun?.normalizationInfo ?? (activeMatches ? activeNormInfo : null);
    const baseMatrix =
      matchedRun?.originalDataMatrix ||
      matchedRun?.dataMatrix ||
      (activeMatches ? activeOrigMatrix || activeDataMatrix : null);

    const stats =
      Array.isArray(data?.rawColStats) && data.rawColStats.length === compNames.length
        ? data.rawColStats
        : computeAllComponentStats(compNames, weights, normalizationInfo, baseMatrix);

    return {
      hexGrid,
      weights,
      compNames,
      clustering,
      rows,
      cols,
      normalizationInfo,
      stats,
      componentScaleConfigs: data?.componentScaleConfigs || matchedRun?.componentScaleConfigs || {},
      globalScaleSource: (data?.globalScaleSource as 'raw' | 'weights') || 'raw'
    };
  }, [chartType, snapshot, resolvedExperimentId, savedRuns, activeSomResult, activeConfig, activeCompNames, activeNormInfo, activeOrigMatrix, activeDataMatrix, data]);

  useEffect(() => {
    setCompPage(0);
    setCompSearch('');
    setHoveredNode(null);
    setHoveredCompCell(null);
    setCompPalette((snapshot.data?.colorScale as SomPaletteName) || 'standard');
    setViewMode(prev => {
      if (prev === 'components' && !componentPlaneModel) {
        return snapshot.svgMarkup ? 'svg' : 'interactive';
      }
      return snapshot.svgMarkup ? 'svg' : 'interactive';
    });
  }, [snapshot]);

  const handleCopyData = () => {
    try {
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy data', e);
    }
  };

  const handleDownloadPng = () => {
    if (!thumbnailPng) return;
    const a = document.createElement('a');
    a.href = thumbnailPng;
    a.download = `${snapshot.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.png`;
    a.click();
  };

  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snapshot.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_vector.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 1. Render Bubble Chart
  const renderBubbleChart = () => {
    if (!Array.isArray(data) || data.length === 0) return null;
    const xKey = config?.xAxisKey || 'cnci' || 'x';
    const yKey = config?.yAxisKey || 'docs' || 'y';
    const zKey = config?.sizeKey || 'timesCited' || 'z';
    const nameKey = config?.nameKey || 'name' || 'entity';

    return (
      <div className="w-full h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
            <XAxis 
              dataKey={xKey} 
              name={config?.labels?.[xKey] || 'CNCI / Impacto'} 
              stroke="#9CA3AF" 
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              domain={['auto', 'auto']}
            />
            <YAxis 
              dataKey={yKey} 
              name={config?.labels?.[yKey] || 'Documentos'} 
              stroke="#9CA3AF" 
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              domain={['auto', 'auto']}
            />
            <ZAxis dataKey={zKey} range={[60, 400]} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div className="bg-gray-950/95 border border-indigo-500/50 p-3 rounded-xl shadow-xl text-xs space-y-1 backdrop-blur-sm z-50">
                      <div className="font-bold text-indigo-300 border-b border-gray-800 pb-1">{p[nameKey] || p.title || 'Entidad'}</div>
                      <div className="text-gray-300">
                        <span className="text-gray-400">{config?.labels?.[xKey] || 'Eje X'}:</span> <strong className="text-white">{p[xKey]}</strong>
                      </div>
                      <div className="text-gray-300">
                        <span className="text-gray-400">{config?.labels?.[yKey] || 'Eje Y'}:</span> <strong className="text-white">{p[yKey]}</strong>
                      </div>
                      {p[zKey] !== undefined && (
                        <div className="text-gray-300">
                          <span className="text-gray-400">{config?.labels?.[zKey] || 'Tamaño'}:</span> <strong className="text-white">{p[zKey]}</strong>
                        </div>
                      )}
                      {p.percentile !== undefined && (
                        <div className="text-gray-300">
                          <span className="text-gray-400">% Percentil:</span> <strong className="text-emerald-400">{p.percentile}%</strong>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter name="Entidades" data={data} fill="#6366f1" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // 2. Render Trend / Time Series Chart
  const renderTrendChart = () => {
    if (!Array.isArray(data) || data.length === 0) return null;
    const xKey = config?.xAxisKey || 'year' || 'period';
    const seriesKeys = config?.seriesKeys || Object.keys(data[0] || {}).filter(k => k !== xKey && typeof data[0][k] === 'number');
    const colors = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#fb7185'];

    return (
      <div className="w-full h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.4} />
            <XAxis dataKey={xKey} stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#030712', borderColor: '#4f46e5', borderRadius: '0.75rem', fontSize: '12px' }}
              itemStyle={{ color: '#e0e7ff' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            {seriesKeys.slice(0, 7).map((key: string, idx: number) => (
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                name={config?.labels?.[key] || key} 
                stroke={colors[idx % colors.length]} 
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // 3. Render Bar Chart
  const renderBarChart = () => {
    if (!Array.isArray(data) || data.length === 0) return null;
    
    // Check if this is a Quartiles stacked bar dataset (contains Q1, Q2, Q3, Q4)
    const isQuartileData = data.some((d: any) => d && (d.Q1 !== undefined || d.Q2 !== undefined || d.Q3 !== undefined || d.Q4 !== undefined));
    if (isQuartileData) {
      const chartHeight = Math.max(340, Math.min(data.length * 28, 500));
      return (
        <div className="w-full overflow-y-auto custom-scrollbar" style={{ maxHeight: '420px' }}>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height={chartHeight} minHeight={300}>
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} opacity={0.4} />
                <XAxis type="number" domain={[0, 100]} stroke="#9CA3AF" tick={{ fontSize: 10, fill: '#9CA3AF' }} unit="%" />
                <YAxis dataKey="entity" type="category" width={150} stroke="#9CA3AF" tick={{ fontSize: 9, fill: '#cbd5e1' }} interval={0} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="bg-gray-900 border border-gray-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1 z-50">
                        <p className="font-bold text-gray-200 border-b border-gray-800 pb-1 mb-1">{label}</p>
                        {payload.map((entry: any, i: number) => (
                          <div key={i} className="flex items-center justify-between space-x-4">
                            <span className="font-medium" style={{ color: entry.fill }}>
                              {entry.name}:
                            </span>
                            <span className="font-bold text-gray-200 ml-2">
                              {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}%
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px', color: '#cbd5e1' }} />
                <Bar dataKey="Q1" name="Q1 (Top 25%)" stackId="q" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Q2" name="Q2 (25%-50%)" stackId="q" fill="#34d399" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Q3" name="Q3 (50%-75%)" stackId="q" fill="#fbbf24" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Q4" name="Q4 (75%-100%)" stackId="q" fill="#f87171" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    const xKey = config?.xAxisKey || (data[0]?.entity !== undefined ? 'entity' : 'name');
    const yKey = config?.yAxisKey || (data[0]?.value !== undefined ? 'value' : 'docs');

    return (
      <div className="w-full h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.slice(0, 25)} margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.4} />
            <XAxis dataKey={xKey} stroke="#9CA3AF" angle={-35} textAnchor="end" interval={0} height={55} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#030712', borderColor: '#6366f1', borderRadius: '0.75rem', fontSize: '12px' }}
            />
            <Bar dataKey={yKey} name={config?.labels?.[yKey] || yKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // 4. Render Radar Chart
  const renderRadarChart = () => {
    if (!Array.isArray(data) || data.length === 0) return null;
    const indicatorKey = config?.indicatorKey || (data[0]?.indicator !== undefined ? 'indicator' : 'subject');
    
    // Check if multi-entity radar data (each column other than indicator is an entity)
    const entityKeys = Object.keys(data[0] || {}).filter(k => 
      k !== indicatorKey && k !== 'subject' && k !== 'indicator' && !k.endsWith('_raw') && typeof data[0][k] === 'number'
    );

    const colors = ['#818cf8', '#34d399', '#f87171', '#fbbf24', '#c084fc', '#2dd4bf', '#fb923c', '#f472b6'];

    if (entityKeys.length > 0) {
      return (
        <div className="w-full h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart outerRadius={95} data={data} margin={{ top: 15, right: 25, bottom: 15, left: 25 }}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey={indicatorKey} stroke="#9CA3AF" tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 500 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#6B7280" tick={{ fontSize: 9, fill: '#9CA3AF' }} unit="%" />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="bg-gray-900 border border-gray-700 p-3 rounded-xl shadow-xl text-xs space-y-1 z-50">
                      <p className="font-bold text-gray-200 border-b border-gray-800 pb-1">{label}</p>
                      {payload.map((entry: any) => (
                        <p key={entry.name} style={{ color: entry.color }}>
                          <span className="font-semibold">{entry.name}:</span> {entry.value}% {entry.payload?.[`${entry.name}_raw`] !== undefined ? <span className="text-gray-400 text-[10px]">({entry.payload[`${entry.name}_raw`]})</span> : null}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              {entityKeys.map((ent, i) => (
                <Radar 
                  key={ent} 
                  name={ent} 
                  dataKey={ent} 
                  stroke={colors[i % colors.length]} 
                  fill={colors[i % colors.length]} 
                  fillOpacity={0.25} 
                  strokeWidth={2} 
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    const valKey = config?.valueKey || 'value' || 'A';
    return (
      <div className="w-full h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart outerRadius={90} data={data}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey={indicatorKey} stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
            <PolarRadiusAxis stroke="#6B7280" />
            <Radar name="Indicador" dataKey={valKey} stroke="#818cf8" fill="#6366f1" fillOpacity={0.5} />
            <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#4f46e5', borderRadius: '0.75rem', fontSize: '12px' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // 5. Render Hexagonal SOM Grid
  const renderHexMap = () => {
    const hexGrid = data?.hexGrid || [];
    const clusters = data?.clustering || [];
    const frequencies = data?.frequencies || [];
    const rows = Number(data?.rows || 0);
    const cols = Number(data?.cols || 0);

    if (!Array.isArray(hexGrid) || hexGrid.length === 0) {
      return (
        <div className="p-6 text-center text-xs text-gray-400">
          Visualización de Malla SOM lista para análisis de pesos y neuronas.
        </div>
      );
    }

    const minX = -1.2;
    const minY = -1.2 * SOM_FLAT_HEX_APOTEMA;
    const maxX = Math.max(...hexGrid.map((h: any) => h.x)) + 1.2;
    const maxY = Math.max(...hexGrid.map((h: any) => h.y)) + 1.2;
    const width = maxX - minX;
    const height = maxY - minY;
    const fontSz = 0.55;
    const showTextOnCells = hexGrid.length <= 400;

    return (
      <div className="w-full flex flex-col items-center justify-center p-2">
        <svg
          viewBox={`${minX} ${minY} ${width} ${height}`}
          className="w-auto max-w-full"
          style={{ maxHeight: '340px' }}
        >
          {hexGrid.map((node: any, idx: number) => {
            const clusterId = clusters[idx] !== undefined ? clusters[idx] : 0;
            const color = clusterId === -1
              ? '#334155'
              : `hsl(${((clusterId * 137.5) % 360 + 360) % 360}, 70%, 55%)`;
            const rawFreq = frequencies[idx];
            const parsedFreq = typeof rawFreq === 'number' ? Math.round(rawFreq) : parseInt(rawFreq, 10) || 0;
            const points = getFlatHexPolygonPoints(node.x, node.y, 1.0);

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredNode({ ...node, clusterId, freq: parsedFreq })}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer transition-all duration-150 group"
              >
                <polygon
                  points={points}
                  fill={color}
                  fillOpacity={0.9}
                  stroke="#050508"
                  strokeWidth={0.04}
                  className="group-hover:stroke-white group-hover:fill-opacity-100 transition"
                />
                {showTextOnCells && parsedFreq > 0 && (
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth={(fontSz * 0.22).toFixed(3)}
                    paintOrder="stroke fill"
                    fontSize={fontSz.toFixed(3)}
                    fontWeight="900"
                    pointerEvents="none"
                    className="select-none font-sans"
                  >
                    {parsedFreq}
                  </text>
                )}
              </g>
            );
          })}
          {clusters.length > 0 && rows > 0 && cols > 0 && hexGrid.map((node: any) =>
            getHexClusterBorders(node.row, node.col, rows, cols, hexGrid, clusters, 1.0).map(([x1, y1, x2, y2], bIdx) => (
              <line
                key={`${node.index}_b_${bIdx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#000000"
                strokeWidth={0.06}
                strokeLinecap="round"
                className="pointer-events-none"
              />
            ))
          )}
        </svg>

        {hoveredNode && (
          <div className="mt-2 text-xs bg-gray-950 border border-indigo-500/40 px-3 py-1.5 rounded-lg text-gray-300 shadow-lg">
            Neuron #{hoveredNode.index} (Row: {hoveredNode.row}, Col: {hoveredNode.col}) •
            <span className="text-indigo-300 font-semibold ml-1">Cluster {hoveredNode.clusterId + 1}</span> •
            <span className="text-emerald-400 font-semibold ml-1">{hoveredNode.freq} documents</span>
          </div>
        )}
      </div>
    );
  };

  // 5b. Render Optional Component Planes Grid (for characterizing SOM clusters)
  const renderComponentMaps = () => {
    if (!componentPlaneModel) {
      return (
        <div className="p-6 text-center text-xs text-gray-400">
          Component plane weights are not available for this entry.
        </div>
      );
    }

    const { hexGrid, weights, compNames, clustering, rows, cols, normalizationInfo, stats, componentScaleConfigs, globalScaleSource } = componentPlaneModel;
    const minX = -1.2;
    const minY = -1.2 * SOM_FLAT_HEX_APOTEMA;
    const width = Math.max(...hexGrid.map((h: any) => h.x)) + 1.2 - minX;
    const height = Math.max(...hexGrid.map((h: any) => h.y)) + 1.2 - minY;

    const indexedComps = compNames
      .map((name, idx) => ({ name, idx }))
      .filter(item => !compSearch.trim() || item.name.toLowerCase().includes(compSearch.trim().toLowerCase()));

    const pageSize = 9;
    const totalPages = Math.max(1, Math.ceil(indexedComps.length / pageSize));
    const safePage = Math.min(compPage, totalPages - 1);
    const pageItems = indexedComps.slice(safePage * pageSize, (safePage + 1) * pageSize);

    const fmtVal = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 10 ? v.toFixed(2) : v.toFixed(3));

    return (
      <div className="w-full space-y-3">
        {/* Component Maps Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 bg-gray-900/70 border border-gray-800 rounded-xl text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showClusterBorders}
                onChange={(e) => setShowClusterBorders(e.target.checked)}
                className="rounded border-gray-700 bg-gray-950 text-indigo-500"
              />
              <span>Cluster Borders</span>
            </label>

            <span className="text-gray-700">|</span>

            <select
              value={compPalette}
              onChange={(e) => setCompPalette(e.target.value as SomPaletteName)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-gray-200 cursor-pointer"
            >
              <option value="standard">Green–Yellow–Red</option>
              <option value="viridis">Viridis</option>
              <option value="cividis">Cividis</option>
            </select>

            {compNames.length > 6 && (
              <div className="relative flex items-center">
                <Search className="w-3 h-3 text-gray-500 absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  value={compSearch}
                  onChange={(e) => { setCompSearch(e.target.value); setCompPage(0); }}
                  placeholder="Filter variables..."
                  className="bg-gray-950 border border-gray-700 rounded-lg pl-6 pr-2 py-0.5 text-[11px] text-gray-200 w-36 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setCompPage(p => Math.max(0, p - 1))}
                className="p-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-gray-300 font-semibold">
                Page {safePage + 1} / {totalPages} ({indexedComps.length} vars)
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setCompPage(p => Math.min(totalPages - 1, p + 1))}
                className="p-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Component Hex Maps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pageItems.map(({ name, idx: fIdx }) => {
            const bounds = resolveComponentScaleBounds(stats[fIdx], componentScaleConfigs[fIdx], globalScaleSource);
            const colorFn = buildComponentChromaScale(compPalette, bounds);
            const gradColors = `${colorFn(bounds.min)}, ${colorFn(bounds.mid)}, ${colorFn(bounds.max)}`;

            return (
              <div key={fIdx} className="bg-gray-900/70 border border-gray-800 rounded-xl p-2.5 flex flex-col">
                <div className="text-[11px] font-bold text-gray-200 truncate mb-1.5" title={name}>
                  {name}
                </div>
                <svg
                  viewBox={`${minX} ${minY} ${width} ${height}`}
                  className="w-full h-36"
                >
                  {hexGrid.map((node: any, nIdx: number) => {
                    const normW = weights[nIdx]?.[fIdx] ?? 0;
                    const realVal = denormalizeValue(normW, fIdx, normalizationInfo);
                    const fill = colorFn(realVal);
                    const cid = clustering[nIdx] ?? 0;
                    return (
                      <polygon
                        key={nIdx}
                        points={getFlatHexPolygonPoints(node.x, node.y, 1.0)}
                        fill={fill}
                        stroke="#1f2937"
                        strokeWidth={0.025}
                        onMouseEnter={() => setHoveredCompCell({ compName: name, neuronIndex: node.index, realVal, normVal: normW, clusterId: cid })}
                        onMouseLeave={() => setHoveredCompCell(null)}
                      />
                    );
                  })}
                  {showClusterBorders && clustering.length > 0 && hexGrid.map((node: any) =>
                    getHexClusterBorders(node.row, node.col, rows, cols, hexGrid, clustering, 1.0).map(([x1, y1, x2, y2], bIdx) => (
                      <line
                        key={`${node.index}_cb_${bIdx}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#000000"
                        strokeWidth={0.065}
                        strokeLinecap="round"
                        className="pointer-events-none"
                      />
                    ))
                  )}
                </svg>
                <div className="mt-1.5 space-y-0.5">
                  <div className="h-1.5 rounded-full w-full" style={{ background: `linear-gradient(to right, ${gradColors})` }} />
                  <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                    <span>{fmtVal(bounds.min)}</span>
                    <span>{fmtVal(bounds.mid)}</span>
                    <span>{fmtVal(bounds.max)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hoveredCompCell && (
          <div className="text-xs bg-gray-950 border border-indigo-500/40 px-3 py-1.5 rounded-lg text-gray-300 shadow-lg text-center">
            <span className="font-semibold text-indigo-300">{hoveredCompCell.compName}</span> • Neuron #{hoveredCompCell.neuronIndex} (Cluster {hoveredCompCell.clusterId + 1}) •
            Real: <strong className="text-white">{fmtVal(hoveredCompCell.realVal)}</strong> · SOM norm: <span className="text-emerald-400">{hoveredCompCell.normVal.toFixed(3)}</span>
          </div>
        )}
      </div>
    );
  };

  // 6. Render 2D Scatter (UMAP / Semantics)
  const renderScatterPlot = () => {
    const points = Array.isArray(data) ? data : data?.points || [];
    if (!Array.isArray(points) || points.length === 0) return null;

    return (
      <div className="w-full h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="x" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
            <YAxis dataKey="y" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div className="bg-gray-950/95 border border-indigo-500/40 p-2.5 rounded-xl shadow-xl text-xs max-w-xs backdrop-blur-sm">
                      <div className="font-bold text-indigo-300 line-clamp-2">{p.title || p.label || `Point #${p.id || ''}`}</div>
                      {p.cluster !== undefined && <div className="text-gray-400 mt-1">Cluster: <strong className="text-white">{p.cluster}</strong></div>}
                      {p.author && <div className="text-gray-400">Author: <span className="text-gray-300">{p.author}</span></div>}
                      {p.year && <div className="text-gray-400">Year: <span className="text-gray-300">{p.year}</span></div>}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter name="2D Projection" data={points} fill="#a855f7" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // 7. Render Network Graph Preview
  const renderNetworkGraph = () => {
    const nodes = data?.nodes || [];
    const links = data?.links || [];

    return (
      <div className="w-full h-80 flex flex-col items-center justify-center p-4 bg-gray-950/60 rounded-xl">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-8 h-8" />
          </div>
          <h4 className="text-sm font-bold text-white">Bibliometric Network Graph</h4>
          <p className="text-xs text-gray-400">
            {nodes.length > 0 ? `${nodes.length} Nodes / Entities and ${links.length} Co-occurrence links` : 'Captured network graph with degree and modularity metrics'}
          </p>
        </div>
      </div>
    );
  };

  // Main interactive renderer selector
  const renderInteractiveContent = () => {
    switch (chartType) {
      case 'bubble':
        return renderBubbleChart();
      case 'trend':
        return renderTrendChart();
      case 'bar':
        return renderBarChart();
      case 'radar':
        return renderRadarChart();
      case 'hex_map':
        return renderHexMap();
      case 'scatter':
        return renderScatterPlot();
      case 'network':
        return renderNetworkGraph();
      default:
        // Generic or fallback
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
          return renderBarChart() || renderBubbleChart();
        }
        return (
          <div className="p-6 text-center text-xs text-gray-400">
            Structured data captured for LLM analysis.
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-gray-950/80 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/90 border-b border-gray-800/80 text-xs flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          {svgMarkup && (
            <button
              onClick={() => setViewMode('svg')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'svg' 
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="View exact configured vector map/chart"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Original SVG</span>
            </button>
          )}

          <button
            onClick={() => setViewMode('interactive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              viewMode === 'interactive' 
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title="Interactive analysis view with dynamic tooltips"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Interactive</span>
          </button>

          {componentPlaneModel && (
            <button
              onClick={() => setViewMode('components')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'components'
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Optionally draw SOM Component Maps to characterize clusters"
            >
              <Grid3X3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Component Maps ({componentPlaneModel.compNames.length})</span>
            </button>
          )}

          {thumbnailPng && (
            <button
              onClick={() => setViewMode('image')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'image' 
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Static PNG snapshot"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>PNG Snapshot</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleCopyData}
            title="Copy JSON data"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition flex items-center gap-1 text-[11px] cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Data'}</span>
          </button>

          {svgMarkup && (
            <button
              onClick={handleDownloadSvg}
              title="Download vector SVG file"
              className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-indigo-950/80 border border-indigo-800/40 transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>SVG</span>
            </button>
          )}

          {thumbnailPng && (
            <button
              onClick={handleDownloadPng}
              title="Download PNG image"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PNG</span>
            </button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      <div className={`relative p-3 flex items-center justify-center min-h-[260px] ${viewMode === 'components' ? 'max-h-[680px]' : 'max-h-[500px]'} overflow-auto custom-scrollbar`}>
        {viewMode === 'svg' && svgMarkup ? (
          <div 
            className="w-full h-auto max-h-[460px] overflow-auto custom-scrollbar flex items-center justify-center pointer-events-auto select-none bg-white rounded-xl p-2 border border-gray-200 shadow-sm [&>svg]:max-h-[440px] [&>svg]:w-auto [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:mx-auto [&>svg]:rounded-lg"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : viewMode === 'components' && componentPlaneModel ? (
          renderComponentMaps()
        ) : viewMode === 'interactive' ? (
          renderInteractiveContent()
        ) : thumbnailPng ? (
          <img 
            src={thumbnailPng} 
            alt={snapshot.title} 
            className="max-h-[440px] w-auto max-w-full rounded-xl object-contain border border-gray-200 shadow-md bg-white p-1"
          />
        ) : (
          renderInteractiveContent()
        )}
      </div>
    </div>
  );
};
