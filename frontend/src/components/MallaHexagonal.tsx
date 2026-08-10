import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import chroma from 'chroma-js';
import { line, curveCatmullRom } from 'd3-shape';
import { useSomStore } from '../store/somStore';
import { RefreshCw, ZoomIn, ZoomOut, Tags, Download } from 'lucide-react';

export interface Trajectory {
  name: string;
  points: { index: number; dataIndex: number }[];
  color: string;
  width?: number;
}

interface MallaHexagonalProps {
  visualizationMode: 'umatrix' | 'clustering' | 'component' | 'frequencies' | 'qe';
  selectedComponentIndex?: number;
  centerReference?: number;
  initialScale?: number;
  colorScale?: 'standard' | 'viridis' | 'cividis';
  onColorScaleChange?: (scale: 'standard' | 'viridis' | 'cividis') => void;
  trajectories?: Trajectory[];
  onNeuronClick?: (neuronIndex: number) => void;
}

export const MallaHexagonal: React.FC<MallaHexagonalProps> = ({
  visualizationMode,
  selectedComponentIndex = 0,
  centerReference,
  initialScale,
  colorScale = 'standard',
  onColorScaleChange,
  trajectories = [],
  onNeuronClick
}) => {
  const { 
    result, 
    config: somConfig,
    originalDataMatrix,
    labels,
    // Label Filters Zustand states & actions
    showLabels,
    labelSearchQuery,
    excludedLabels,
    maxLabelsPerNeuron,
    showLabelsOnComponents,
    setShowLabels,
    setLabelSearchQuery,
    toggleLabelVisibility,
    setExcludedLabels,
    setMaxLabelsPerNeuron,
    resetLabelFilters
  } = useSomStore();
  
  // Calculate a scale factor that scales down dynamically for large grid sizes (e.g. 20x20)
  const baseScale = initialScale ?? 60;
  const maxDim = Math.max(somConfig.rows, somConfig.cols);
  const calculatedScale = maxDim > 8 ? Math.max(8, Math.floor(baseScale * (8 / maxDim))) : baseScale;

  const [scale, setScale] = useState(calculatedScale); // pixel scale factor
  const [selectedNeuron, setSelectedNeuron] = useState<number | null>(null);
  const [hoveredNeuron, setHoveredNeuron] = useState<{ index: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Local state to control filters modal visibility
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Sync scale if calculatedScale changes (e.g. when grid size changes or new training is loaded)
  useEffect(() => {
    setScale(calculatedScale);
  }, [calculatedScale]);
  
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-700 rounded-2xl h-96 text-gray-400 bg-gray-900 bg-opacity-40">
        <RefreshCw className="w-12 h-12 mb-4 animate-spin text-indigo-500" />
        <p className="text-lg font-medium text-gray-200">The map has not been trained yet</p>
        <p className="text-sm mt-1">Load a CSV dataset or preprocess bibliometrics data, then click "Train SOM".</p>
      </div>
    );
  }

  const { hexGrid, umatrix, clustering, frequencies, quantizationErrors, weights, mappedLabels } = result;
  const { rows, cols } = somConfig;

  // Hexagon math constants
  const R = 1.0;
  const apotema = Math.sqrt(3) / 2.0;
  
  // Calculate bounding box in relative grid coordinates
  const maxX = Math.max(...hexGrid.map(n => n.x)) + 1.2 * R;
  const maxY = Math.max(...hexGrid.map(n => n.y)) + 1.2 * R;
  const minX = -1.2 * R;
  const minY = -1.2 * apotema * R;

  // Convert bounding box to pixels for viewBox
  const widthPx = (maxX - minX) * scale;
  const heightPx = (maxY - minY) * scale;
  const viewboxStr = `${minX * scale} ${minY * scale} ${widthPx} ${heightPx}`;

  // Calculate original data metrics for component map color bar
  let compMin = 0;
  let compMax = 0;
  let compAvg = 0;

  if (visualizationMode === 'component' && originalDataMatrix && originalDataMatrix.length > 0 && selectedComponentIndex < originalDataMatrix[0].length) {
    const colValues = originalDataMatrix.map(row => row[selectedComponentIndex]);
    compMin = Math.min(...colValues);
    compMax = Math.max(...colValues);
    compAvg = colValues.reduce((a, b) => a + b, 0) / colValues.length;
  }

  // Extract all unique labels present in the trained result for selection list
  const uniqueLabels = useMemo(() => {
    if (!result || !result.mappedLabels) return [];
    const set = new Set<string>();
    result.mappedLabels.forEach(list => {
      if (list) {
        list.forEach(label => set.add(label));
      }
    });
    return Array.from(set).sort();
  }, [result]);

  // Filter unique labels based on search query in the modal list
  const filteredUniqueLabels = useMemo(() => {
    if (!labelSearchQuery) return uniqueLabels;
    return uniqueLabels.filter(l => l.toLowerCase().includes(labelSearchQuery.toLowerCase()));
  }, [uniqueLabels, labelSearchQuery]);

  const handleSelectAllLabels = () => setExcludedLabels(new Set<string>());
  const handleClearAllLabels = () => setExcludedLabels(new Set<string>(uniqueLabels));

  // Pre-calculate color scale functions and expensive aggregations to avoid O(N^2) overhead per cell
  const colorScales = useMemo(() => {
    const scales: any = {
      umatrixFn: null,
      freqFn: chroma.scale(['#38a169', '#dd6b20', '#e53e3e']).domain([0, 1]),
      qeFn: chroma.scale(['#cbd5e0', '#4a5568']).domain([0, 1]),
      compFn: null
    };

    if (!result) return scales;

    // 1. U-Matrix Scale
    if (visualizationMode === 'umatrix' && result.umatrix) {
      const flatUmatrix = result.umatrix.flat();
      const minU = Math.min(...flatUmatrix);
      const maxU = Math.max(...flatUmatrix);
      scales.umatrixFn = chroma.scale(['#e53e3e', '#ecc94b']).domain([minU, maxU]);
    }

    // 2. Component Scale
    if (visualizationMode === 'component' && result.weights && result.weights.length > 0) {
      const compWeights = result.weights.map(w => w[selectedComponentIndex]);
      const minW = Math.min(...compWeights);
      const maxW = Math.max(...compWeights);
      
      if (colorScale === 'viridis') {
        scales.compFn = chroma.scale(['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']).domain([minW, maxW]);
      } else if (colorScale === 'cividis') {
        scales.compFn = chroma.scale(['#00204d', '#414d6b', '#7c7b78', '#b9ad71', '#ffea46']).domain([minW, maxW]);
      } else {
        let mid = centerReference ?? (minW + maxW) / 2.0;
        if (mid <= minW || mid >= maxW) {
          mid = (minW + maxW) / 2.0;
        }
        scales.compFn = chroma.scale(['#38a169', '#ecc94b', '#e53e3e']).domain([minW, mid, maxW]);
      }
    }
    return scales;
  }, [visualizationMode, result, selectedComponentIndex, colorScale, centerReference]);

  // Get color for a specific cell based on visualization mode
  const getCellColor = (neuronIdx: number): string => {
    switch (visualizationMode) {
      case 'umatrix': {
        const row = Math.floor(neuronIdx / cols);
        const col = neuronIdx % cols;
        const val = umatrix[row][col];
        return colorScales.umatrixFn ? colorScales.umatrixFn(val).hex() : '#ffffff';
      }
      
      case 'clustering': {
        const clusterId = clustering[neuronIdx];
        if (clusterId === -1) {
          // DBSCAN Noise
          return '#2d3748';
        }
        // Dynamic golden ratio HSL generation to provide highly distinct colors
        const hue = (clusterId * 137.5) % 360;
        return chroma.hsl(hue, 0.75, 0.65).hex();
      }
      
      case 'frequencies': {
        const val = frequencies[neuronIdx];
        return colorScales.freqFn(val).hex();
      }
      
      case 'qe': {
        const val = quantizationErrors[neuronIdx];
        // Greyscale or black if zero
        if (val === 0) return '#1a202c'; // dark grey/black for empty cells
        return colorScales.qeFn(val).hex();
      }
      
      case 'component': {
        const val = weights[neuronIdx][selectedComponentIndex];
        return colorScales.compFn ? colorScales.compFn(val).hex() : '#4a5568';
      }
      
      default:
        return '#4a5568';
    }
  };

  // Check neighbors to draw clustering borders
  const getClusteringBorders = (i: number, j: number): string[] => {
    const borderLines: string[] = [];
    const neuronIdx = j + i * cols;
    const clusterId = clustering[neuronIdx];
    
    // Hexagonal neighbors based on column j parity
    const neighborsMap: Record<string, { r: number; c: number; edgeIdxs: [number, number] }> = {
      n1: { r: j % 2 === 0 ? i : i + 1, c: j + 1, edgeIdxs: [0, 1] },     // bottom-right
      n2: { r: i + 1, c: j, edgeIdxs: [1, 2] },                           // bottom
      n3: { r: j % 2 === 0 ? i : i + 1, c: j - 1, edgeIdxs: [2, 3] },     // bottom-left
      n4: { r: j % 2 === 0 ? i - 1 : i, c: j - 1, edgeIdxs: [3, 4] },     // top-left
      n5: { r: i - 1, c: j, edgeIdxs: [4, 5] },                           // top
      n6: { r: j % 2 === 0 ? i - 1 : i, c: j + 1, edgeIdxs: [5, 0] }      // top-right
    };

    // Calculate vertex coordinates for a given cell center (xc, yc)
    const getHexPoints = (xc: number, yc: number) => {
      return [
        { x: xc + R, y: yc },                               // P1
        { x: xc + 0.5 * R, y: yc + apotema * R },           // P2
        { x: xc - 0.5 * R, y: yc + apotema * R },           // P3
        { x: xc - R, y: yc },                               // P4
        { x: xc - 0.5 * R, y: yc - apotema * R },           // P5
        { x: xc + 0.5 * R, y: yc - apotema * R }            // P6
      ].map(p => ({ x: p.x * scale, y: p.y * scale }));
    };

    const xc = hexGrid[neuronIdx].x;
    const yc = hexGrid[neuronIdx].y;
    const points = getHexPoints(xc, yc);

    Object.keys(neighborsMap).forEach(key => {
      const { r, c, edgeIdxs } = neighborsMap[key];
      const neighIdx = c + r * cols;
      
      // Draw border if out of bounds (map border) or if belongs to a different cluster
      const isOutOfBounds = r < 0 || r >= rows || c < 0 || c >= cols;
      const isDiffCluster = !isOutOfBounds && clustering[neighIdx] !== clusterId;
      
      if (isOutOfBounds || isDiffCluster) {
        const pStart = points[edgeIdxs[0]];
        const pEnd = points[edgeIdxs[1]];
        borderLines.push(`${pStart.x},${pStart.y} ${pEnd.x},${pEnd.y}`);
      }
    });

    return borderLines;
  };

  // Generate SVG polygon points string for a hexagon centered at (xc, yc)
  const getHexPolygonPoints = (xc: number, yc: number): string => {
    const points = [
      { x: xc + R, y: yc },
      { x: xc + 0.5 * R, y: yc + apotema * R },
      { x: xc - 0.5 * R, y: yc + apotema * R },
      { x: xc - R, y: yc },
      { x: xc - 0.5 * R, y: yc - apotema * R },
      { x: xc + 0.5 * R, y: yc - apotema * R }
    ];
    return points.map(p => `${p.x * scale},${p.y * scale}`).join(' ');
  };

  // Helper to determine if we should draw labels for the current map viewport
  const shouldRenderLabels = () => {
    if (visualizationMode === 'component') {
      return showLabelsOnComponents;
    }
    return showLabels;
  };

  const handleDownload = (format: 'svg' | 'png') => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgRef.current);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const svgData = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<?xml version="1.0" standalone="no"?>\r\n' + source);

    if (format === 'svg') {
      const a = document.createElement("a");
      a.href = svgData;
      a.download = `sinapsis_map_${visualizationMode}.svg`;
      a.click();
    } else {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scaleFactor = 3; // High res
      canvas.width = widthPx * scaleFactor;
      canvas.height = heightPx * scaleFactor;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png", 1.0);
        a.download = `sinapsis_map_${visualizationMode}_highres.png`;
        a.click();
      };
      img.src = svgData;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Visual Controls Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-950 border-b border-gray-800 flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <span className="text-xs uppercase tracking-wider text-gray-500 font-bold">Zoom</span>
          <button
            onClick={() => setScale(prev => Math.min(120, prev + 10))}
            className="p-1-5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale(prev => Math.max(8, prev - 5))}
            className="p-1-5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {visualizationMode === 'component' && (
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-bold">Palette</span>
            <select
              value={colorScale}
              onChange={(e) => onColorScaleChange?.(e.target.value as any)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[10px] text-gray-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="standard">Standard (Green-Red)</option>
              <option value="viridis">Viridis (Accessible)</option>
              <option value="cividis">Cividis (Accessible)</option>
            </select>
          </div>
        )}

        {visualizationMode !== 'component' && (
          <div className="flex items-center space-x-6 flex-wrap gap-2">
            {/* Main show labels toggle */}
            <label className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900 cursor-pointer"
              />
              <span>Show labels</span>
            </label>

            {/* Subset filters modal open trigger button */}
            {showLabels && shouldRenderLabels() && (
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-lg shadow-indigo-950 cursor-pointer"
                title="Open Labels Subset Manager"
              >
                <Tags className="w-3.5 h-3.5" />
                <span>Label Filters</span>
              </button>
            )}
          </div>
        )}

        {/* Download actions */}
        <div className="flex items-center space-x-2 ml-auto">
          <button
            onClick={() => handleDownload('png')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg transition flex items-center space-x-1.5"
            title="Save as High-Res PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
          <button
            onClick={() => handleDownload('svg')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg transition flex items-center space-x-1.5"
            title="Save as Vector SVG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* Main Canvas SVG Drawing */}
      <div className="flex-1 relative overflow-hidden flex flex-row items-stretch bg-gray-950">
        <div className="relative flex-1 flex justify-center items-center overflow-auto p-4 min-w-0">
          <svg
            ref={svgRef}
            width={widthPx}
            height={heightPx}
            viewBox={viewboxStr}
            className="map-hexagonal-svg transition-all select-none"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0,0 L 8,4 L 0,8 Z" fill="context-stroke" />
              </marker>
            </defs>
            {useMemo(() => (
              <g>
                {/* 1. Hexagon Cells */}
                {hexGrid.map((neuron) => {
                  const isSelected = selectedNeuron === neuron.index;
                  const fillClr = getCellColor(neuron.index);
                  return (
                    <polygon
                      key={neuron.index}
                      points={getHexPolygonPoints(neuron.x, neuron.y)}
                      fill={fillClr}
                      stroke={isSelected ? '#ffffff' : '#4a5568'}
                      strokeWidth={isSelected ? 2 : 0.4}
                      opacity={0.9}
                      className="cursor-pointer transition-colors duration-150 hover:opacity-100"
                      onClick={() => {
                        setSelectedNeuron(neuron.index);
                        onNeuronClick?.(neuron.index);
                      }}
                      onMouseEnter={(e) => setHoveredNeuron({ index: neuron.index, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setHoveredNeuron({ index: neuron.index, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHoveredNeuron(null)}
                    />
                  );
                })}

                {/* 2. Cluster Contours / Frontiers */}
                {hexGrid.map((neuron) => {
                  const borders = getClusteringBorders(neuron.row, neuron.col);
                  return borders.map((bStr, idx) => {
                    const [p1, p2] = bStr.split(' ');
                    const [x1, y1] = p1.split(',');
                    const [x2, y2] = p2.split(',');
                    return (
                      <line
                        key={`${neuron.index}_b_${idx}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#000000"
                        strokeWidth={2}
                        strokeLinecap="round"
                        className="pointer-events-none"
                      />
                    );
                  });
                })}

                {/* 3. Spline PATH Trajectories (PathSOM) */}
                {trajectories.map((traj, idx) => {
                  if (traj.points.length < 2) return null;

                  // Create coords for the spline
                  const coords = traj.points.map(p => {
                    const node = hexGrid[p.index];
                    return [node.x * scale, node.y * scale] as [number, number];
                  });

                  const lineGen = line()
                    .curve(curveCatmullRom.alpha(0.5))
                    .x(d => d[0])
                    .y(d => d[1]);

                  const pathData = lineGen(coords) || '';

                  return (
                    <g key={`traj_${idx}_${traj.name}`}>
                      <path
                        d={pathData}
                        fill="none"
                        stroke={traj.color}
                        strokeWidth={traj.width || 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        markerEnd="url(#arrowhead)"
                        className="transition-all duration-300"
                        style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.8))' }}
                      />
                      
                      {/* Trajectory waypoints (dots) */}
                      {coords.map((c, i) => (
                        <circle
                          key={`traj_p_${idx}_${i}`}
                          cx={c[0]}
                          cy={c[1]}
                          r={(traj.width || 2) * 1.5}
                          fill={traj.color}
                          stroke="#050508"
                          strokeWidth={1}
                          style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.5))' }}
                        />
                      ))}
                      
                      {/* Trajectory specific labels */}
                      {coords.map((c, i) => {
                        const dataIndex = traj.points[i].dataIndex;
                        const labelText = labels[dataIndex];
                        if (!labelText) return null;
                        return (
                          <text
                            key={`traj_lbl_${idx}_${i}`}
                            x={c[0]}
                            y={c[1] - (traj.width || 2) * 1.5 - 4}
                            textAnchor="middle"
                            dominantBaseline="alphabetic"
                            fill={traj.color}
                            fontSize="10px"
                            fontWeight="900"
                            className="font-sans select-none pointer-events-none uppercase tracking-tight"
                            style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.9), 0px 0px 1px rgba(255,255,255,0.5)' }}
                          >
                            {labelText}
                          </text>
                        );
                      })}
                    </g>
                  );
                })}

                {/* 4. Flat, Centered SVG Document Labels Overlays */}
                {shouldRenderLabels() &&
                  hexGrid.map((neuron) => {
                    const docList = mappedLabels[neuron.index] || [];
                    if (docList.length === 0) return null;

                    const filteredDocs = docList
                      .filter(label => {
                        if (labelSearchQuery && !label.toLowerCase().includes(labelSearchQuery.toLowerCase())) {
                          return false;
                        }
                        if (excludedLabels.has(label)) {
                          return false;
                        }
                        return true;
                      })
                      .slice(0, maxLabelsPerNeuron);

                    if (filteredDocs.length === 0) return null;

                    const xc = neuron.x * scale;
                    const yc = neuron.y * scale;

                    return (
                      <g key={`lbl_group_${neuron.index}`} className="pointer-events-none">
                        {filteredDocs.map((label, idx) => {
                          const yOffset = (idx - (filteredDocs.length - 1) / 2) * 11;
                          return (
                            <text
                              key={`${label}_${idx}`}
                              x={xc}
                              y={yc + yOffset}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#0e121a"
                              fontSize="8px"
                              fontWeight="bold"
                              className="font-sans select-none pointer-events-none uppercase tracking-tight"
                              style={{ textShadow: '0px 0px 2px rgba(255,255,255,0.7)' }}
                            >
                              {label}
                            </text>
                          );
                        })}
                      </g>
                    );
                  })}
              </g>
            ), [
              hexGrid, 
              selectedNeuron, 
              clustering, 
              scale, 
              colorScales,
              visualizationMode,
              showLabels,
              showLabelsOnComponents,
              mappedLabels,
              excludedLabels,
              labelSearchQuery,
              maxLabelsPerNeuron,
              trajectories,
              labels,
              onNeuronClick
            ])}
          </svg>
        </div>

        {/* Color Bar Legend for Component Maps */}
        {visualizationMode === 'component' && originalDataMatrix && originalDataMatrix.length > 0 && (
          <div 
            className="flex flex-col items-center justify-center px-3 py-4 border-l border-gray-800 bg-gray-900 bg-opacity-40"
            style={{ flexShrink: 0, width: '65px', maxWidth: '65px' }}
          >
            <span className="text-[10px] font-bold text-gray-300 mb-2" title="Maximum Value (Original)">{compMax.toFixed(2)}</span>
            
            <div 
              className="relative rounded-full shadow-inner my-1"
              style={{
                width: '12px',
                minWidth: '12px',
                height: '120px',
                background: colorScale === 'standard'
                  ? 'linear-gradient(to bottom, #e53e3e, #ecc94b, #38a169)'
                  : colorScale === 'viridis'
                    ? 'linear-gradient(to bottom, #fde725, #5ec962, #21918c, #3b528b, #440154)'
                    : 'linear-gradient(to bottom, #ffea46, #b9ad71, #7c7b78, #414d6b, #00204d)'
              }}
            >
              {/* Avg indicator (line only) */}
              <div 
                className="absolute bg-white z-10 rounded-full" 
                style={{ 
                  width: '20px', 
                  height: '2px', 
                  left: '-4px', 
                  top: `${Math.max(0, Math.min(100, 100 - ((compAvg - compMin) / (compMax - compMin || 1)) * 100))}%` 
                }}
                title={`Average: μ = ${compAvg.toFixed(2)}`}
              ></div>
            </div>
            
            <span className="text-[10px] font-bold text-gray-300 mt-2" title="Minimum Value (Original)">{compMin.toFixed(2)}</span>
            
            <div className="mt-3 pt-2 border-t border-gray-700 w-full flex flex-col items-center" title="Average Value (Original)">
              <span className="text-[7px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Media</span>
              <span className="text-[8px] font-bold text-gray-300">μ={compAvg.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>



      {/* 5. INTERACTIVE POP-UP MODAL: LABEL FILTER MANAGER */}
      {isFilterModalOpen && (
        <div className="absolute inset-0 bg-gray-950 bg-opacity-80 backdrop-blur-xs z-50 flex items-center justify-center p-6 transition-all duration-300">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90%] space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2">
                <Tags className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black uppercase text-gray-200 tracking-wider">Label Filter Manager</h3>
              </div>
              <button 
                onClick={() => setIsFilterModalOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-300 font-bold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Density Limiter Counter Component (Positioned directly below the title!) */}
            <div className="flex items-center justify-between bg-gray-950 p-3 rounded-xl border border-gray-850">
              <span className="text-xs text-gray-400 font-bold">Max labels per hexagon:</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setMaxLabelsPerNeuron(Math.max(1, maxLabelsPerNeuron - 1))}
                  className="w-7 h-7 bg-gray-800 hover:bg-gray-700 active:bg-gray-900 rounded-lg flex items-center justify-center font-black text-gray-200 transition disabled:opacity-30 disabled:pointer-events-none"
                  disabled={maxLabelsPerNeuron <= 1}
                >
                  -
                </button>
                <span className="text-sm text-white font-black w-6 text-center">{maxLabelsPerNeuron}</span>
                <button
                  onClick={() => setMaxLabelsPerNeuron(Math.min(15, maxLabelsPerNeuron + 1))}
                  className="w-7 h-7 bg-gray-800 hover:bg-gray-700 active:bg-gray-900 rounded-lg flex items-center justify-center font-black text-gray-200 transition disabled:opacity-30 disabled:pointer-events-none"
                  disabled={maxLabelsPerNeuron >= 15}
                >
                  +
                </button>
              </div>
            </div>

            {/* Instant Search Bar */}
            <div className="space-y-1.5">
              <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider">Search Keywords / Years / Authors</label>
              <input
                type="text"
                placeholder="Type to filter labels..."
                value={labelSearchQuery}
                onChange={(e) => setLabelSearchQuery(e.target.value)}
                className="w-full bg-gray-950 border border-gray-850 rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Subsets checkboxes list header */}
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-gray-500 pt-2 border-t border-gray-850">
              <span>MAPPED LABELS ({uniqueLabels.length})</span>
              <div className="flex space-x-3">
                <button 
                  onClick={handleSelectAllLabels}
                  className="text-indigo-400 hover:text-indigo-300 uppercase tracking-widest font-black cursor-pointer text-[9px]"
                >
                  Select All
                </button>
                <button 
                  onClick={handleClearAllLabels}
                  className="text-amber-500 hover:text-amber-400 uppercase tracking-widest font-black cursor-pointer text-[9px]"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Scrollable list container */}
            <div className="flex-1 overflow-auto bg-gray-950 border border-gray-850 rounded-xl p-3 max-h-[220px] space-y-2">
              {filteredUniqueLabels.length > 0 ? (
                filteredUniqueLabels.map((label, idx) => {
                  const isChecked = !excludedLabels.has(label);
                  return (
                    <label 
                      key={idx} 
                      className="flex items-center space-x-2.5 text-xs text-gray-300 hover:text-gray-100 cursor-pointer py-1"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleLabelVisibility(label)}
                        className="w-3.5 h-3.5 bg-gray-900 border-gray-850 rounded text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="truncate">{label}</span>
                    </label>
                  );
                })
              ) : (
                <span className="text-[10px] text-gray-600 block text-center py-4">No matching labels found.</span>
              )}
            </div>

            {/* Reset Filters action */}
            <button
              onClick={resetLabelFilters}
              className="w-full py-2.5 bg-gray-850 hover:bg-gray-800 text-gray-300 text-xs font-bold rounded-xl transition uppercase tracking-wider cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* 5. Floating Hover Tooltip: Mapped Units (up to 5) via Portal */}
      {hoveredNeuron && result && createPortal(
        (() => {
          // Resolve mapped labels for hovered neuron with fallbacks
          let allMapped: string[] = [];
          if (mappedLabels && mappedLabels[hoveredNeuron.index] && mappedLabels[hoveredNeuron.index].length > 0) {
            allMapped = mappedLabels[hoveredNeuron.index];
          } else if (result.bmus && labels && labels.length > 0) {
            result.bmus.forEach((bmuIdx, dIdx) => {
              if (bmuIdx === hoveredNeuron.index && labels[dIdx]) {
                allMapped.push(labels[dIdx]);
              }
            });
          }

          const displayList = allMapped.slice(0, 5);
          const extraCount = Math.max(0, allMapped.length - 5);
          const clusterId = result.clustering ? result.clustering[hoveredNeuron.index] : null;

          return (
            <div 
              className="fixed z-[99999] pointer-events-none bg-[#090d16]/95 border border-[#1e293b] rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-xs text-xs text-gray-200"
              style={{
                left: Math.min(window.innerWidth - 250, hoveredNeuron.x + 14),
                top: Math.min(window.innerHeight - 200, hoveredNeuron.y + 14)
              }}
            >
              <div className="flex items-center justify-between border-b border-gray-800 pb-1.5 mb-2 gap-3">
                <span className="font-black text-indigo-400 text-[11px] uppercase tracking-wider">
                  Neuron #{hoveredNeuron.index}
                </span>
                {clusterId !== null && clusterId !== -1 && (
                  <span className="px-1.5 py-0.5 bg-purple-900/60 border border-purple-500/50 text-purple-200 text-[9px] font-bold rounded">
                    Cluster {clusterId}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                  Mapped Units ({allMapped.length}):
                </p>
                {displayList.length > 0 ? (
                  <ul className="space-y-1">
                    {displayList.map((unitName, i) => (
                      <li key={i} className="flex items-center space-x-1.5 text-[11px] text-gray-200 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                        <span className="truncate">{unitName}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-gray-500 italic">No units mapped to this cell</p>
                )}

                {extraCount > 0 && (
                  <p className="text-[10px] text-indigo-400 font-semibold pt-1">
                    + {extraCount} more unit{extraCount > 1 ? 's' : ''}...
                  </p>
                )}
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
};
