import React, { useState, useEffect, useMemo } from 'react';
import { useSomStore } from '../store/somStore';
import { 
  Play, Pause, SkipBack, SkipForward, Activity, 
  TrendingUp, Compass, Grid, Zap, RefreshCw, BarChart2, 
  Info, Settings, Share2, ArrowLeft, Sliders
} from 'lucide-react';
import { SendToAssistantButton } from './SendToAssistantButton';

// Helper to estimate spectral aspect ratio (sigma_1 / sigma_2) via covariance SVD/PCA
function estimateSpectralRatio(data: number[][]): number {
  if (!data || data.length < 2 || !data[0] || data[0].length < 2) return 1.0;
  const n = data.length;
  const d = data[0].length;
  
  const means = new Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      means[j] += data[i][j] || 0;
    }
  }
  for (let j = 0; j < d; j++) means[j] /= n;

  const useFeatureCov = d <= n;
  const k = useFeatureCov ? d : n;

  const getTopEigenvalue = (matrix: number[][], deflatedVector: number[] | null): { val: number; vec: number[] } => {
    let v = new Array(k).fill(0).map((_, i) => ((i % 2 === 0 ? 1 : -1) * 0.5));
    for (let iter = 0; iter < 12; iter++) {
      if (deflatedVector) {
        let dot = 0;
        for (let i = 0; i < k; i++) dot += v[i] * deflatedVector[i];
        for (let i = 0; i < k; i++) v[i] -= dot * deflatedVector[i];
      }
      const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0)) || 1;
      v = v.map(x => x / norm);
      
      const w = new Array(k).fill(0);
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
          w[i] += matrix[i][j] * v[j];
        }
      }
      v = w;
    }
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0)) || 1;
    v = v.map(x => x / norm);
    
    let val = 0;
    for (let i = 0; i < k; i++) {
      let rowDot = 0;
      for (let j = 0; j < k; j++) rowDot += matrix[i][j] * v[j];
      val += v[i] * rowDot;
    }
    return { val: Math.max(0, val), vec: v };
  };

  try {
    if (useFeatureCov) {
      const cov = Array.from({ length: d }, () => new Array(d).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < d; j++) {
          const valJ = (data[i][j] || 0) - means[j];
          for (let l = j; l < d; l++) {
            const valL = (data[i][l] || 0) - means[l];
            cov[j][l] += valJ * valL;
          }
        }
      }
      for (let j = 0; j < d; j++) {
        for (let l = j; l < d; l++) {
          cov[j][l] /= n;
          cov[l][j] = cov[j][l];
        }
      }
      const e1 = getTopEigenvalue(cov, null);
      const e2 = getTopEigenvalue(cov, e1.vec);
      const s1 = Math.sqrt(e1.val);
      const s2 = Math.sqrt(e2.val);
      if (s2 > 1e-4) {
        return Math.max(0.33, Math.min(3.0, s1 / s2));
      }
    }
  } catch {
    return 1.0;
  }
  return 1.0;
}

export const LongitudinalSomViewer: React.FC = () => {
  const {
    longitudinalResults,
    activeLongitudinalPeriod,
    setActiveLongitudinalPeriod,
    cooccurrenceMatricesByPeriod,
    trainLongitudinalSOM,
    exportLongitudinalToExperiments,
    isTraining,
    config,
    longitudinalNormType,
    setLongitudinalNormType
  } = useSomStore();

  const [activeSubTab, setActiveSubTab] = useState<'player' | 'side_by_side' | 'drift' | 'migration'>('player');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1500); // ms per step
  const [colorMode, setColorMode] = useState<'umatrix' | 'clusters' | 'frequencies'>('clusters');
  const [selectedNeuron, setSelectedNeuron] = useState<number | null>(null);

  // Configuration mode & parameters
  const [isConfigMode, setIsConfigMode] = useState<boolean>(false);
  const [gridSizeMode, setGridSizeMode] = useState<'optimal' | 'big' | 'custom'>('optimal');
  const [gridRows, setGridRows] = useState<number>(config.rows || 10);
  const [gridCols, setGridCols] = useState<number>(config.cols || 12);
  const [method] = useState<'basic'>('basic');
  // First map (Base) parameters - 2016: Full training
  const [baseIterations, setBaseIterations] = useState<number>(1000);
  const [baseSigma, setBaseSigma] = useState<number | null>(null);
  const [baseLearningRate, setBaseLearningRate] = useState<number>(0.9);
  // Subsequent maps (Warm-Start) parameters - 2017-2019: Refinement phase
  const [refineIterations, setRefineIterations] = useState<number>(200);
  const [refineSigma, setRefineSigma] = useState<number | null>(null);
  const [refineLearningRate, setRefineLearningRate] = useState<number>(0.1);

  // Dynamic academic grid sizing: average size = (rows + cols) / 2
  const gridAvgSize = useMemo(() => (gridRows + gridCols) / 2.0, [gridRows, gridCols]);
  // Base sigma = 1/2 of grid's average size
  const autoBaseSigma = useMemo(() => Number((0.5 * gridAvgSize).toFixed(2)), [gridAvgSize]);
  // Refinement sigma = 1/8 of grid's average size (1/4 of base sigma)
  const autoRefineSigma = useMemo(() => Number((0.125 * gridAvgSize).toFixed(3)), [gridAvgSize]);

  // Compute number of entities and spectral aspect ratio from active periods data
  const { suggestedOptimalGrid, suggestedBigGrid } = useMemo(() => {
    let n = 100;
    let sampleData: number[][] = [];
    if (cooccurrenceMatricesByPeriod) {
      const keys = Object.keys(cooccurrenceMatricesByPeriod);
      if (keys.length > 0 && cooccurrenceMatricesByPeriod[keys[0]]?.data) {
        sampleData = cooccurrenceMatricesByPeriod[keys[0]].data;
        n = sampleData.length || 100;
      }
    }

    const ratio = estimateSpectralRatio(sampleData);

    // Optimal Longitudinal Density: M ~ 1.2 * N (ideal for meso-clusters & trajectory stability)
    const targetOptimal = Math.max(36, Math.min(400, Math.round(1.2 * n)));
    const optCols = Math.max(4, Math.round(Math.sqrt(targetOptimal * ratio)));
    const optRows = Math.max(4, Math.round(Math.sqrt(targetOptimal / ratio)));

    // Big SOM (Step 2 criteria): M = 10 * N (ideal for continuous U-matrix and micro-frontiers)
    const targetBig = 10 * n;
    const bigCols = Math.max(6, Math.round(Math.sqrt(targetBig * ratio)));
    const bigRows = Math.max(6, Math.round(Math.sqrt(targetBig / ratio)));

    return {
      suggestedOptimalGrid: { rows: optRows, cols: optCols, total: optRows * optCols },
      suggestedBigGrid: { rows: bigRows, cols: bigCols, total: bigRows * bigCols }
    };
  }, [cooccurrenceMatricesByPeriod]);

  // Synchronize grid size when mode changes
  useEffect(() => {
    if (gridSizeMode === 'optimal') {
      setGridRows(suggestedOptimalGrid.rows);
      setGridCols(suggestedOptimalGrid.cols);
    } else if (gridSizeMode === 'big') {
      setGridRows(suggestedBigGrid.rows);
      setGridCols(suggestedBigGrid.cols);
    }
  }, [gridSizeMode, suggestedOptimalGrid, suggestedBigGrid]);

  const periods = useMemo(() => {
    if (longitudinalResults?.periods && longitudinalResults.periods.length > 0) {
      return longitudinalResults.periods;
    }
    if (cooccurrenceMatricesByPeriod) {
      return Object.keys(cooccurrenceMatricesByPeriod);
    }
    return [];
  }, [longitudinalResults, cooccurrenceMatricesByPeriod]);

  // Detect if data is a square co-occurrence network or a rectangular performance matrix
  const isNetworkData = useMemo(() => {
    if (!cooccurrenceMatricesByPeriod) return false;
    const firstKey = Object.keys(cooccurrenceMatricesByPeriod)[0];
    if (!firstKey) return false;
    const item = cooccurrenceMatricesByPeriod[firstKey];
    if (!item || !item.data || item.data.length === 0) return false;
    return item.data.length === (item.data[0]?.length || 0);
  }, [cooccurrenceMatricesByPeriod]);

  // Set default normalization type based on data kind if not yet customized
  useEffect(() => {
    if (isNetworkData && !longitudinalNormType.startsWith('cooc_') && longitudinalNormType !== 'none') {
      setLongitudinalNormType('cooc_association');
    } else if (!isNetworkData && longitudinalNormType.startsWith('cooc_')) {
      setLongitudinalNormType('min_max');
    }
  }, [isNetworkData, longitudinalNormType, setLongitudinalNormType]);

  // Set default active period if not set
  useEffect(() => {
    if (periods.length > 0 && (!activeLongitudinalPeriod || !periods.includes(activeLongitudinalPeriod))) {
      setActiveLongitudinalPeriod(periods[0]);
    }
  }, [periods, activeLongitudinalPeriod, setActiveLongitudinalPeriod]);

  // Auto-play timeline animation
  useEffect(() => {
    if (!isPlaying || periods.length <= 1) return;
    const interval = setInterval(() => {
      const currIdx = periods.indexOf(activeLongitudinalPeriod);
      const nextIdx = (currIdx + 1) % periods.length;
      setActiveLongitudinalPeriod(periods[nextIdx]);
    }, playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, periods, activeLongitudinalPeriod, playbackSpeed, setActiveLongitudinalPeriod]);

  const activeMap = useMemo(() => {
    if (!longitudinalResults?.maps || !activeLongitudinalPeriod) return null;
    return longitudinalResults.maps[activeLongitudinalPeriod] || null;
  }, [longitudinalResults, activeLongitudinalPeriod]);

  // Derive cluster color palette
  const clusterColors = useMemo(() => [
    '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', 
    '#06b6d4', '#f97316', '#14b8a6', '#e11d48', '#84cc16'
  ], []);

  // Hexagon math constants
  const R = 1.0;
  const apotema = Math.sqrt(3) / 2.0;

  const getHexPolygonPoints = (xc: number, yc: number): string => {
    const points = [
      { x: xc + R, y: yc },
      { x: xc + 0.5 * R, y: yc + apotema * R },
      { x: xc - 0.5 * R, y: yc + apotema * R },
      { x: xc - R, y: yc },
      { x: xc - 0.5 * R, y: yc - apotema * R },
      { x: xc + 0.5 * R, y: yc - apotema * R }
    ];
    return points.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
  };

  // Compute hex grid parameters
  const renderHexGrid = (mapData: any, highlightDrift = false, driftMetric?: any) => {
    if (!mapData?.hexGrid || mapData.hexGrid.length === 0) return null;

    const hexGrid = mapData.hexGrid;
    const rawUmatrix = mapData.umatrix || [];
    const umatrix = Array.isArray(rawUmatrix[0]) ? rawUmatrix.flat() : rawUmatrix;
    const clustering = mapData.clustering || [];
    const frequencies = mapData.frequencies || [];
    const mappedLabels = mapData.mappedLabels || [];
    const rawDrift = driftMetric?.raw_drift || [];
    const maxDrift = driftMetric?.max_drift || 1;

    // SVG coordinate bounds
    const xs = hexGrid.map((h: any) => h.x ?? 0);
    const ys = hexGrid.map((h: any) => h.y ?? 0);
    const minX = Math.min(...xs) - 1.5 * R;
    const maxX = Math.max(...xs) + 1.5 * R;
    const minY = Math.min(...ys) - 1.5 * apotema * R;
    const maxY = Math.max(...ys) + 1.5 * apotema * R;
    const width = maxX - minX;
    const height = maxY - minY;

    // Compute min/max for U-matrix normalization
    const uMin = umatrix.length > 0 ? Math.min(...umatrix) : 0;
    const uMax = umatrix.length > 0 ? Math.max(...umatrix) : 1;
    const uSpan = uMax - uMin > 0 ? uMax - uMin : 1;

    const maxFreq = frequencies.length > 0 ? Math.max(...frequencies) : 1;

    return (
      <svg
        viewBox={`${minX} ${minY} ${width} ${height}`}
        className="w-full h-full max-h-[560px] select-none"
      >
        <defs>
          <radialGradient id="hexGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
          </radialGradient>
        </defs>

        {hexGrid.map((hex: any, idx: number) => {
          const uVal = umatrix[idx] ?? 0;
          const uNorm = (uVal - uMin) / uSpan; // 0 = close, 1 = distant
          const clusterId = clustering[idx] ?? -1;
          const freq = frequencies[idx] ?? 0;
          const labels = mappedLabels[idx] || [];
          const driftVal = rawDrift[idx] ?? 0;
          const driftNorm = maxDrift > 0 ? driftVal / maxDrift : 0;

          let fillColor = '#1e293b';
          let strokeColor = '#334155';

          if (highlightDrift) {
            // Drift heatmap (fire scale: dark violet -> orange -> yellow)
            const r = Math.round(30 + driftNorm * 225);
            const g = Math.round(20 + Math.pow(driftNorm, 2) * 180);
            const b = Math.round(60 + (1 - driftNorm) * 80);
            fillColor = `rgb(${r}, ${g}, ${b})`;
            strokeColor = driftNorm > 0.6 ? '#fde047' : '#475569';
          } else if (colorMode === 'umatrix') {
            // U-Matrix gray/cyan gradient (dark = close cluster core, light = boundary)
            const lightness = Math.round(15 + uNorm * 65);
            fillColor = `hsl(220, 30%, ${lightness}%)`;
            strokeColor = uNorm > 0.7 ? '#f43f5e' : '#475569';
          } else if (colorMode === 'clusters') {
            if (clusterId >= 0) {
              const baseColor = clusterColors[clusterId % clusterColors.length];
              fillColor = baseColor;
            } else {
              fillColor = '#1e293b';
            }
          } else if (colorMode === 'frequencies') {
            const fNorm = freq / (maxFreq || 1);
            const r = Math.round(20 + fNorm * 200);
            const g = Math.round(30 + fNorm * 120);
            const b = Math.round(70 + fNorm * 180);
            fillColor = `rgb(${r}, ${g}, ${b})`;
          }

          const isSelected = selectedNeuron === idx;
          const polyPoints = getHexPolygonPoints(hex.x, hex.y);

          return (
            <g
              key={`hex-${idx}`}
              onClick={() => setSelectedNeuron(isSelected ? null : idx)}
              className="cursor-pointer transition-transform duration-200 hover:scale-105"
              style={{ transformOrigin: `${hex.x}px ${hex.y}px` }}
            >
              {/* Hexagon Path */}
              <polygon
                points={polyPoints}
                fill={fillColor}
                stroke={isSelected ? '#38bdf8' : strokeColor}
                strokeWidth={isSelected ? 0.09 : 0.025}
                className="transition-colors duration-150"
              />

              {/* Hit circle marker */}
              {freq > 0 && !highlightDrift && (
                <circle
                  cx={hex.x}
                  cy={hex.y}
                  r={Math.min(0.5, 0.15 + Math.sqrt(freq) * 0.06)}
                  fill="#ffffff"
                  fillOpacity={0.25}
                  stroke="#ffffff"
                  strokeWidth={0.02}
                />
              )}

              {/* Top Label summary on hexagon */}
              {labels.length > 0 && (
                <text
                  x={hex.x}
                  y={hex.y + (freq > 0 ? 0.35 : 0.08)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#f8fafc"
                  fontSize="0.22"
                  fontWeight="bold"
                  stroke="#050508"
                  strokeWidth="0.03"
                  paintOrder="stroke fill"
                  className="pointer-events-none select-none tracking-tight"
                >
                  {labels[0].length > 14 ? `${labels[0].slice(0, 13)}…` : labels[0]}
                </text>
              )}

              {/* Neuron Frequency badge */}
              {freq > 0 && (
                <text
                  x={hex.x}
                  y={hex.y - 0.15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#38bdf8"
                  fontSize="0.28"
                  fontWeight="900"
                  stroke="#050508"
                  strokeWidth="0.04"
                  paintOrder="stroke fill"
                  className="pointer-events-none select-none"
                >
                  {freq}
                </text>
              )}

              {/* Highlight selection ring */}
              {isSelected && (
                <polygon
                  points={polyPoints}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={0.09}
                  strokeDasharray="0.1 0.05"
                />
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  // If no longitudinal results yet or explicitly in config mode, show training configuration card
  if (!longitudinalResults || !longitudinalResults.maps || isConfigMode) {
    return (
      <div className="flex flex-col items-center justify-center p-8 md:p-12 bg-gray-900/60 border border-gray-800 rounded-3xl max-w-4xl mx-auto my-6 shadow-2xl backdrop-blur-xl w-full">
        {longitudinalResults?.maps && (
          <div className="w-full flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
            <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
              Modo de Configuración & Reentrenamiento
            </span>
            <button
              onClick={() => setIsConfigMode(false)}
              className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a los Mapas Entrenados</span>
            </button>
          </div>
        )}

        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-5">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>

        <h3 className="text-2xl font-black text-white tracking-tight mb-2 text-center">
          Longitudinal SOM Analysis (Chained Evolutionary Maps)
        </h3>
        <p className="text-xs text-gray-400 text-center max-w-xl mb-6 leading-relaxed">
          Para subperiodos de <strong>5 años o más</strong>, el sistema entrena un mapa por ventana temporal usando el protocolo <em>Warm-Start</em>: los pesos sinápticos del periodo anterior inicializan el siguiente SOM, acelerando la convergencia en fase de refinamiento ({refineIterations} épocas) y preservando la coherencia de cuadrantes temáticos.
        </p>

        {periods.length > 0 ? (
          <div className="w-full bg-gray-950/80 border border-gray-800 rounded-2xl p-6 mb-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <span className="text-xs font-bold uppercase text-gray-400">Subperiodos Detectados:</span>
              <span className="text-xs font-bold text-indigo-400">{periods.length} Ventanas Temporales</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {periods.map((p, idx) => (
                <div key={p} className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-950/50 border border-indigo-500/30 rounded-xl text-xs text-indigo-200">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/60 text-white font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="font-bold">{p}</span>
                  {idx === 0 ? (
                    <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono">
                      Base ({baseIterations} épocas)
                    </span>
                  ) : (
                    <span className="text-[9px] bg-purple-950 text-purple-300 border border-purple-800/60 px-1.5 py-0.5 rounded font-mono">
                      Warm-Start ({refineIterations} épocas)
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Intertemporal Data Normalization Settings */}
            <div className="bg-gray-900/70 p-4 rounded-xl border border-gray-800 space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase text-gray-300">Normalización de Datos Multiperiodo</span>
                </div>
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded font-mono font-bold">
                  {isNetworkData ? 'Red Bibliométrica Cuadrada' : 'Perfiles de Desempeño (Matriz Rectangular)'}
                </span>
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed">
                {isNetworkData
                  ? 'Métrica de similitud y proximidad semántica aplicada a las matrices de co-ocurrencia por periodo:'
                  : 'Escalamiento intertemporal global calculado sobre todos los periodos juntos (mantiene la estabilidad de cuadrantes y la validez analítica de la deriva sináptica ΔW):'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {isNetworkData ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setLongitudinalNormType('cooc_association')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        longitudinalNormType === 'cooc_association'
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Fuerza de Asociación (VOS)</span>
                        <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-1 rounded font-mono">Recomendado</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">C_ij / (C_i · C_j) — VOSviewer canonical</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLongitudinalNormType('cooc_cosine')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        longitudinalNormType === 'cooc_cosine'
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="text-xs font-bold">Coseno de Salton</div>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">C_ij / sqrt(C_i · C_j)</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLongitudinalNormType('cooc_jaccard')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        longitudinalNormType === 'cooc_jaccard'
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="text-xs font-bold">Índice de Jaccard</div>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">C_ij / (C_i + C_j - C_ij)</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLongitudinalNormType('cooc_inclusion')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        longitudinalNormType === 'cooc_inclusion'
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="text-xs font-bold">Índice de Inclusión</div>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">C_ij / min(C_i, C_j)</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLongitudinalNormType('none')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer sm:col-span-2 ${
                        longitudinalNormType === 'none'
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="text-xs font-bold">Sin Normalización (Co-ocurrencias Brutas)</div>
                      <p className="text-[10px] text-gray-400 mt-1">Conteo directo de co-ocurrencias sin transformación</p>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setLongitudinalNormType('min_max')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        longitudinalNormType === 'min_max'
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Min-Max Global [0, 1]</span>
                        <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-1 rounded font-mono">Recomendado</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Escalamiento unificado intertemporal. Mantiene las proporciones reales de crecimiento o declive.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLongitudinalNormType('z_score')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        longitudinalNormType === 'z_score'
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="text-xs font-bold">Z-Score Global (μ=0, σ=1)</div>
                      <p className="text-[10px] text-gray-400 mt-1">Estandarización basada en media y desviación estándar de toda la serie continua.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLongitudinalNormType('div_max')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        longitudinalNormType === 'div_max'
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="text-xs font-bold">Dividir por Máximo Global</div>
                      <p className="text-[10px] text-gray-400 mt-1">Conserva el cero absoluto escalando por el valor pico de cada indicador en cualquier periodo.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLongitudinalNormType('none')}
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        longitudinalNormType === 'none'
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <div className="text-xs font-bold">Sin Normalización (Valores Crudos)</div>
                      <p className="text-[10px] text-gray-400 mt-1">Mantiene las escalas originales sin ajuste (útil si las variables ya vienen calibradas).</p>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Global Architecture Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Card 1: SOM Grid */}
              <div className="bg-gray-900/70 p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-gray-400">Rejilla Neuronal (SOM Grid)</span>
                  <span className="text-[11px] font-bold text-indigo-400 font-mono">
                    {gridRows} × {gridCols} ({gridRows * gridCols} neuronas)
                  </span>
                </div>

                {/* Grid Size Mode Radio Buttons (Step 2 Style) */}
                <div className="flex flex-col space-y-2 bg-gray-950/80 p-3 rounded-xl border border-gray-800/80">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                    Criterio de Tamaño de Malla
                  </span>

                  <label className="flex items-start space-x-2.5 text-xs text-gray-300 cursor-pointer hover:text-indigo-300 transition-colors">
                    <input 
                      type="radio" 
                      name="longitudinalGridMode" 
                      value="optimal" 
                      className="mt-0.5 text-indigo-500 bg-gray-900 border-gray-700 focus:ring-0 focus:ring-offset-0"
                      checked={gridSizeMode === 'optimal'} 
                      onChange={() => {
                        setGridSizeMode('optimal');
                        setGridRows(suggestedOptimalGrid.rows);
                        setGridCols(suggestedOptimalGrid.cols);
                      }} 
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                        Densidad Óptima Longitudinal 
                        <span className="text-emerald-400 font-mono text-[11px] font-normal">
                          ({suggestedOptimalGrid.rows} × {suggestedOptimalGrid.cols}, ~{suggestedOptimalGrid.total} neuronas)
                        </span>
                      </span>
                      <span className="text-[10px] text-gray-500 leading-tight">
                        Meso-clusters y dinámicas de escisión/fusión (Jiménez-Andrade et al., 2024)
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start space-x-2.5 text-xs text-gray-300 cursor-pointer hover:text-indigo-300 transition-colors">
                    <input 
                      type="radio" 
                      name="longitudinalGridMode" 
                      value="big" 
                      className="mt-0.5 text-indigo-500 bg-gray-900 border-gray-700 focus:ring-0 focus:ring-offset-0"
                      checked={gridSizeMode === 'big'} 
                      onChange={() => {
                        setGridSizeMode('big');
                        setGridRows(suggestedBigGrid.rows);
                        setGridCols(suggestedBigGrid.cols);
                      }} 
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                        Big SOM (Paso 2) 
                        <span className="text-purple-400 font-mono text-[11px] font-normal">
                          ({suggestedBigGrid.rows} × {suggestedBigGrid.cols}, ~{suggestedBigGrid.total} neuronas)
                        </span>
                      </span>
                      <span className="text-[10px] text-gray-500 leading-tight">
                        10 × N neuronas con ratio espectral PCA para U-Matrix continua
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 text-xs text-gray-300 cursor-pointer hover:text-indigo-300 transition-colors pt-0.5">
                    <input 
                      type="radio" 
                      name="longitudinalGridMode" 
                      value="custom" 
                      className="text-indigo-500 bg-gray-900 border-gray-700 focus:ring-0 focus:ring-offset-0"
                      checked={gridSizeMode === 'custom'} 
                      onChange={() => setGridSizeMode('custom')} 
                    />
                    <span className="font-semibold text-gray-200">Personalizado (User Defined)</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Filas (m)</label>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={gridRows}
                      onChange={(e) => {
                        setGridRows(Math.max(2, parseInt(e.target.value) || 2));
                        setGridSizeMode('custom');
                      }}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Columnas (n)</label>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={gridCols}
                      onChange={(e) => {
                        setGridCols(Math.max(2, parseInt(e.target.value) || 2));
                        setGridSizeMode('custom');
                      }}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 italic">Topología hexagonal bidimensional continua</p>
              </div>

              {/* Card 2: Solver Algorithm (Basic SOM) */}
              <div className="bg-gray-900/70 p-4 rounded-xl border border-gray-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-gray-400">Algoritmo de Aprendizaje</span>
                  <span className="text-[11px] font-bold text-emerald-400 font-mono">
                    Basic SOM (Online / Estocástico)
                  </span>
                </div>
                <div className="p-2.5 bg-gray-950/70 border border-gray-800/80 rounded-lg space-y-1">
                  <div className="text-xs text-white font-medium">Algoritmo de Kohonen Secuencial</div>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Actualización iterativa vector a vector con decaimiento lineal del factor de aprendizaje (<span className="text-emerald-300 font-mono font-bold">α</span>) y contracción exponencial de vecindad gaussiana (<span className="text-purple-300 font-mono font-bold">σ</span>).
                  </p>
                </div>
              </div>
            </div>

            {/* Comparison Cards: First Map vs Subsequent Maps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Primer Mapa (Periodo Base) */}
              <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-800/40 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase text-emerald-300">Primer Mapa (Periodo 1 - Base)</span>
                  </div>
                  <span className="text-[9px] bg-emerald-900/60 text-emerald-200 border border-emerald-700/60 px-2 py-0.5 rounded font-mono">
                    Inicialización Global
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">
                      Épocas Base: <strong className="text-emerald-300 font-mono">{baseIterations}</strong>
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={100000}
                      step={50}
                      value={baseIterations}
                      onChange={(e) => setBaseIterations(Math.max(10, parseInt(e.target.value) || 10))}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-gray-400">
                        Sigma Inicial (σ₀):
                      </label>
                      <span className="text-[10px] text-emerald-300 font-mono font-bold">
                        {baseSigma !== null && baseSigma > 0 ? baseSigma : `Auto (${autoBaseSigma})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0.1}
                        max={100}
                        step={0.5}
                        value={baseSigma ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : parseFloat(e.target.value);
                          setBaseSigma(val !== null && !isNaN(val) && val > 0 ? val : null);
                        }}
                        placeholder={`Auto (${autoBaseSigma})`}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                      />
                      {baseSigma !== null && (
                        <button
                          type="button"
                          onClick={() => setBaseSigma(null)}
                          className="text-[9px] px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-medium transition cursor-pointer"
                          title="Restablecer a cálculo automático (½ · promedio de malla)"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-gray-400">
                      Factor de Aprendizaje Inicial (α₀):
                    </label>
                    <span className="text-[10px] text-emerald-300 font-mono font-bold">
                      {baseLearningRate}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0.01}
                    max={1.0}
                    step={0.05}
                    value={baseLearningRate}
                    onChange={(e) => setBaseLearningRate(Math.max(0.01, Math.min(1.0, parseFloat(e.target.value) || 0.9)))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                  />
                </div>

                <p className="text-[10px] text-gray-400 italic leading-relaxed border-t border-emerald-900/30 pt-2">
                  Configuración canónica: σ₀ = ½ · promedio(filas+cols) = {autoBaseSigma}, α₀ = {baseLearningRate}, {baseIterations} épocas (Full training) para estructurar el espacio semántico base.
                </p>
              </div>

              {/* Siguientes Mapas (Warm-Start Refinement) */}
              <div className="bg-purple-950/20 p-4 rounded-xl border border-purple-800/40 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    <span className="text-xs font-bold uppercase text-purple-300">Siguientes Mapas (Periodos 2+)</span>
                  </div>
                  <span className="text-[9px] bg-purple-900/60 text-purple-200 border border-purple-700/60 px-2 py-0.5 rounded font-mono">
                    Refinement Phase
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">
                      Épocas Warm-Start: <strong className="text-purple-300 font-mono">{refineIterations}</strong>
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={50000}
                      step={10}
                      value={refineIterations}
                      onChange={(e) => setRefineIterations(Math.max(5, parseInt(e.target.value) || 200))}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-purple-200 font-mono focus:border-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-gray-400">
                        Sigma Refinamiento (σ):
                      </label>
                      <span className="text-[10px] text-purple-300 font-mono font-bold">
                        {refineSigma !== null && refineSigma > 0 ? refineSigma : `Auto (${autoRefineSigma})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0.05}
                        max={50}
                        step={0.1}
                        value={refineSigma ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : parseFloat(e.target.value);
                          setRefineSigma(val !== null && !isNaN(val) && val > 0 ? val : null);
                        }}
                        placeholder={`Auto (${autoRefineSigma})`}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-purple-200 font-mono focus:border-purple-500 outline-none"
                      />
                      {refineSigma !== null && (
                        <button
                          type="button"
                          onClick={() => setRefineSigma(null)}
                          className="text-[9px] px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-medium transition cursor-pointer"
                          title="Restablecer a cálculo automático (⅛ · promedio de malla)"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-gray-400">
                      Factor Aprendizaje Refinamiento (α):
                    </label>
                    <span className="text-[10px] text-purple-300 font-mono font-bold">
                      {refineLearningRate}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0.001}
                    max={0.5}
                    step={0.01}
                    value={refineLearningRate}
                    onChange={(e) => setRefineLearningRate(Math.max(0.001, Math.min(0.5, parseFloat(e.target.value) || 0.1)))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-purple-200 font-mono focus:border-purple-500 outline-none"
                  />
                </div>

                <p className="text-[10px] text-gray-400 italic leading-relaxed border-t border-purple-900/30 pt-2">
                  Ajuste fino canónico: σ = ⅛ · promedio(filas+cols) = {autoRefineSigma}, α = {refineLearningRate}, {refineIterations} épocas heredando pesos previos (W<sub>t-1</sub>) para mantener estables los cuadrantes.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-2xl text-xs text-amber-300 mb-6">
            ⚠️ No se encontraron matrices de subperiodos. Verifica que "Generate Temporal Sequences" esté activo con una ventana de 5 o más años en la pestaña Redes Bibliométricas.
          </div>
        )}

        <button
          onClick={async () => {
            const ok = await trainLongitudinalSOM({
              rows: gridRows,
              cols: gridCols,
              iterations: baseIterations,
              refineIterations: refineIterations,
              method: method,
              learningRate: baseLearningRate,
              sigma: baseSigma !== null ? baseSigma : autoBaseSigma,
              refineSigma: refineSigma !== null ? refineSigma : autoRefineSigma,
              refineLearningRate: refineLearningRate,
              normType: longitudinalNormType
            });
            if (ok) setIsConfigMode(false);
          }}
          disabled={isTraining || periods.length === 0}
          className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-2xl transition shadow-xl shadow-indigo-900/40 flex items-center space-x-3 cursor-pointer text-sm"
        >
          {isTraining ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Entrenando Mapas Evolutivos ({periods.length} SOMs)...</span>
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 text-amber-300" />
              <span>{longitudinalResults?.maps ? 'Reentrenar SOMs Longitudinales' : 'Train Longitudinal SOMs'}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-950 p-6 space-y-6 overflow-y-auto">
      {/* Top Header & Metrics Bar */}
      <div className="flex items-center justify-between bg-gray-900/80 border border-gray-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/40 rounded-xl flex items-center justify-center text-indigo-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-black text-white tracking-tight">
                Longitudinal SOM Analysis (Evolutionary Maps)
              </h2>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-bold uppercase">
                Warm-Start Chaining
              </span>
              {longitudinalResults?.normalization_info?.label && (
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full font-mono font-medium">
                  Norm: {longitudinalResults.normalization_info.label}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Continuous temporal evolution with spatial alignment of thematic quadrants
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center bg-gray-950 border border-gray-800 rounded-xl p-1 space-x-1">
          <button
            onClick={() => setActiveSubTab('player')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeSubTab === 'player' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Timeline Player</span>
          </button>

          <button
            onClick={() => setActiveSubTab('side_by_side')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeSubTab === 'side_by_side' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Side-by-Side</span>
          </button>

          <button
            onClick={() => setActiveSubTab('drift')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeSubTab === 'drift' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Knowledge Drift (ΔW)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('migration')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeSubTab === 'migration' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Thematic Migration</span>
          </button>
        </div>

        {/* Actions & AI Assistant Snapshot */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsConfigMode(true)}
            className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
            title="Reconfigurar parámetros de cuadrícula e iteraciones para reentrenar"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>Reconfigurar / Reentrenar</span>
          </button>

          <button
            onClick={() => exportLongitudinalToExperiments()}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-950/50 cursor-pointer"
            title="Enviar matrices normalizadas y modelos entrenados a la pestaña SOM & UMAP"
          >
            <Share2 className="w-3.5 h-3.5 text-white" />
            <span>Enviar a SOM & UMAP</span>
          </button>

          <SendToAssistantButton
            title={`Longitudinal SOM Map (${activeLongitudinalPeriod})`}
            viewSource="som"
            chartType="hex_map"
            dataContextPrompt={`Longitudinal SOM Evolutionary Map for period ${activeLongitudinalPeriod}`}
            data={{
              activePeriod: activeLongitudinalPeriod,
              periods: longitudinalResults.periods,
              driftMetrics: longitudinalResults.drift_metrics,
              mapInfo: activeMap ? {
                training_phase: activeMap.training_phase,
                iterations: activeMap.iterations,
                frequencies: activeMap.frequencies,
                quantizationErrors: activeMap.quantizationErrors
              } : null
            }}
          />
        </div>
      </div>

      {/* SUB-VIEW 1: TIMELINE PLAYER */}
      {activeSubTab === 'player' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
          {/* Main Map Visualizer */}
          <div className="lg:col-span-3 bg-gray-900/60 border border-gray-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl">
            {/* Map Top Bar */}
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-4 mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-bold text-gray-300">Active Period:</span>
                <div className="flex space-x-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800">
                  {periods.map(p => (
                    <button
                      key={p}
                      onClick={() => setActiveLongitudinalPeriod(p)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        activeLongitudinalPeriod === p
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Mode Switcher */}
              <div className="flex items-center space-x-2 bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs">
                <button
                  onClick={() => setColorMode('umatrix')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    colorMode === 'umatrix' ? 'bg-gray-800 text-cyan-300' : 'text-gray-400'
                  }`}
                >
                  U-Matrix
                </button>
                <button
                  onClick={() => setColorMode('clusters')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    colorMode === 'clusters' ? 'bg-gray-800 text-purple-300' : 'text-gray-400'
                  }`}
                >
                  Clusters
                </button>
                <button
                  onClick={() => setColorMode('frequencies')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    colorMode === 'frequencies' ? 'bg-gray-800 text-indigo-300' : 'text-gray-400'
                  }`}
                >
                  BMU Density
                </button>
              </div>
            </div>

            {/* Map Hex SVG */}
            <div className="flex-1 flex items-center justify-center min-h-[420px]">
              {activeMap ? renderHexGrid(activeMap) : (
                <div className="text-gray-500 text-xs">No data for this map</div>
              )}
            </div>

            {/* Timeline Controls Bottom Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800/80 mt-4 bg-gray-950/60 p-3 rounded-2xl">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const idx = periods.indexOf(activeLongitudinalPeriod);
                    if (idx > 0) setActiveLongitudinalPeriod(periods[idx - 1]);
                  }}
                  disabled={periods.indexOf(activeLongitudinalPeriod) === 0}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-xl text-gray-200 transition"
                  title="Previous Period"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center space-x-2 shadow-lg shadow-indigo-900/40 transition"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span className="text-xs">{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  onClick={() => {
                    const idx = periods.indexOf(activeLongitudinalPeriod);
                    if (idx < periods.length - 1) setActiveLongitudinalPeriod(periods[idx + 1]);
                  }}
                  disabled={periods.indexOf(activeLongitudinalPeriod) === periods.length - 1}
                  className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-xl text-gray-200 transition"
                  title="Next Period"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Slider */}
              <div className="flex-1 mx-6 flex items-center space-x-3">
                <input
                  type="range"
                  min="0"
                  max={periods.length - 1}
                  value={periods.indexOf(activeLongitudinalPeriod)}
                  onChange={(e) => setActiveLongitudinalPeriod(periods[parseInt(e.target.value)])}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-indigo-400 min-w-[70px]">
                  {activeLongitudinalPeriod}
                </span>
              </div>

              {/* Speed dropdown */}
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
                className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none"
              >
                <option value={2500}>0.5x (Slow)</option>
                <option value={1500}>1.0x (Normal)</option>
                <option value={800}>2.0x (Fast)</option>
              </select>
            </div>
          </div>

          {/* Right Sidebar: Details & Mapped Labels */}
          <div className="space-y-6">
            {/* Period Statistics */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-5 shadow-xl space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-2">
                <Info className="w-4 h-4 text-indigo-400" />
                <span>Period Metadata</span>
              </h4>

              {activeMap && (
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-800/60">
                    <span className="text-gray-400">Training Phase:</span>
                    <span className="font-bold text-indigo-300">
                      {activeMap.training_phase === 'base_full' ? 'Base (Global Ordering)' : 'Warm-Start (Refinement)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-800/60">
                    <span className="text-gray-400">Epochs Executed:</span>
                    <span className="font-bold text-white">{activeMap.iterations} epochs</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-800/60">
                    <span className="text-gray-400">Active Terms:</span>
                    <span className="font-bold text-emerald-400">
                      {activeMap.mappedLabels?.reduce((acc: number, cur: any[]) => acc + cur.length, 0) || 0}
                    </span>
                  </div>
                  {activeMap.drift_from_prev && (
                    <div className="flex justify-between py-1 border-b border-gray-800/60">
                      <span className="text-gray-400">Mean Drift (ΔW):</span>
                      <span className="font-bold text-amber-400">
                        {activeMap.drift_from_prev.mean_drift?.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Neuron Inspector */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-5 shadow-xl space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-2">
                <Compass className="w-4 h-4 text-purple-400" />
                <span>
                  {selectedNeuron !== null ? `Neuron #${selectedNeuron}` : 'Neuron Inspector'}
                </span>
              </h4>

              {selectedNeuron !== null && activeMap ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                      <span className="text-gray-500 block text-[10px]">Cluster ID</span>
                      <span className="text-white font-bold">
                        {activeMap.clustering?.[selectedNeuron] ?? 'N/A'}
                      </span>
                    </div>
                    <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                      <span className="text-gray-500 block text-[10px]">BMU Frequency</span>
                      <span className="text-indigo-400 font-bold">
                        {activeMap.frequencies?.[selectedNeuron] ?? 0}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-gray-400 block mb-1.5">
                      Mapped Terms ({activeMap.mappedLabels?.[selectedNeuron]?.length || 0}):
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {(activeMap.mappedLabels?.[selectedNeuron] || []).map((lbl: string) => (
                        <div key={lbl} className="px-2.5 py-1 bg-gray-950 border border-gray-800/80 rounded-lg text-xs text-gray-200 truncate">
                          {lbl}
                        </div>
                      ))}
                      {(!activeMap.mappedLabels?.[selectedNeuron] || activeMap.mappedLabels[selectedNeuron].length === 0) && (
                        <span className="text-xs text-gray-600 italic">Empty neuron in this period</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 leading-relaxed">
                  Click on any hexagon on the SOM grid to inspect associated terms, cluster and evolution in this period.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: SIDE-BY-SIDE COMPARISON */}
      {activeSubTab === 'side_by_side' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {periods.map((p, idx) => {
            const pMap = longitudinalResults.maps[p];
            if (!pMap) return null;
            return (
              <div key={p} className="bg-gray-900/60 border border-gray-800 rounded-3xl p-5 flex flex-col shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-bold text-white">{p}</h3>
                  </div>
                  <span className="text-[10px] bg-gray-950 text-gray-400 border border-gray-800 px-2 py-0.5 rounded-full font-mono">
                    {pMap.training_phase === 'base_full' ? 'Base' : 'Warm-Start'}
                  </span>
                </div>

                <div className="flex-1 flex items-center justify-center min-h-[300px]">
                  {renderHexGrid(pMap)}
                </div>

                <div className="pt-3 border-t border-gray-800/60 mt-3 flex justify-between text-[11px] text-gray-400">
                  <span>Terms: <strong className="text-white">{pMap.mappedLabels?.reduce((acc: number, cur: any[]) => acc + cur.length, 0) || 0}</strong></span>
                  {pMap.drift_from_prev && (
                    <span>Drift: <strong className="text-amber-400">{pMap.drift_from_prev.mean_drift?.toFixed(3)}</strong></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-VIEW 3: KNOWLEDGE DRIFT HEATMAP (ΔW) */}
      {activeSubTab === 'drift' && (
        <div className="space-y-6">
          <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl flex items-start space-x-3">
            <Activity className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
            <div className="text-xs text-indigo-200 leading-relaxed">
              <strong>Knowledge Drift (&Delta;W_t = ||W_t - W_&#123;t-1&#125;||_2):</strong> Measures the displacement magnitude of neural centroids between consecutive periods. Warmer and more intense colors highlight conceptual fronts with high dynamism and disciplinary restructuring.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(longitudinalResults.drift_metrics || {}).map(([transitionKey, driftMetric]) => {
              const targetPeriod = transitionKey.split(' -> ')[1];
              const targetMap = longitudinalResults.maps[targetPeriod];
              if (!targetMap) return null;

              return (
                <div key={transitionKey} className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>Transition:</span>
                      <span className="text-amber-400">{transitionKey}</span>
                    </h3>
                    <div className="flex space-x-2 text-[10px]">
                      <span className="px-2 py-0.5 bg-gray-950 rounded border border-gray-800 text-gray-300">
                        Mean: <strong>{driftMetric.mean_drift?.toFixed(4)}</strong>
                      </span>
                      <span className="px-2 py-0.5 bg-gray-950 rounded border border-gray-800 text-amber-300">
                        Max: <strong>{driftMetric.max_drift?.toFixed(4)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex items-center justify-center min-h-[320px]">
                    {renderHexGrid(targetMap, true, driftMetric)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: THEMATIC MIGRATION TABLE */}
      {activeSubTab === 'migration' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide">
            Term Evolution Across Subperiods
          </h3>
          <p className="text-xs text-gray-400">
            BMU neuron trajectory tracking for each term across all temporal periods.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="py-2.5 px-3">Term / Concept</th>
                  {periods.map(p => (
                    <th key={p} className="py-2.5 px-3">{p} (Neuron / BMU)</th>
                  ))}
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {(() => {
                  // Collect unique labels across all periods
                  const labelMap = new Map<string, Record<string, number | null>>();
                  periods.forEach(p => {
                    const pMap = longitudinalResults.maps[p];
                    if (pMap?.mappedLabels) {
                      pMap.mappedLabels.forEach((lbls: string[], neuronIdx: number) => {
                        lbls.forEach(lbl => {
                          if (!labelMap.has(lbl)) labelMap.set(lbl, {});
                          labelMap.get(lbl)![p] = neuronIdx;
                        });
                      });
                    }
                  });

                  const sortedEntries = Array.from(labelMap.entries()).slice(0, 50);

                  return sortedEntries.map(([lbl, periodLocations]) => {
                    const presentCount = Object.keys(periodLocations).length;
                    const isPersistent = presentCount === periods.length;
                    const isEmerging = presentCount < periods.length && periodLocations[periods[periods.length - 1]] !== undefined;

                    return (
                      <tr key={lbl} className="hover:bg-gray-950/60 transition">
                        <td className="py-2.5 px-3 font-semibold text-white truncate max-w-[200px]">{lbl}</td>
                        {periods.map(p => {
                          const nIdx = periodLocations[p];
                          return (
                            <td key={p} className="py-2.5 px-3 font-mono">
                              {nIdx !== undefined ? (
                                <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 rounded">
                                  N#{nIdx}
                                </span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3">
                          {isPersistent ? (
                            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded font-bold">
                              Persistent
                            </span>
                          ) : isEmerging ? (
                            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded font-bold">
                              Emerging
                            </span>
                          ) : (
                            <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-bold">
                              Transient
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
