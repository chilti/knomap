import chroma from 'chroma-js';
import { denormalizeValue, type NormalizationInfo } from './normalization';
import type { ComponentScaleConfig } from '../store/somStore';

export const SOM_FLAT_HEX_APOTEMA = Math.sqrt(3) / 2.0;

export interface SomHexNode {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
}

export interface ComponentStatSummary {
  name: string;
  rawMin: number;
  rawMax: number;
  rawAvg: number;
  somMin: number;
  somMax: number;
  somAvg: number;
}

export interface ComponentScaleBounds {
  min: number;
  mid: number;
  max: number;
}

export type SomPaletteName = 'standard' | 'viridis' | 'cividis';

/**
 * Generates SVG polygon vertex string for a flat-topped SOM hexagon centered at (xc, yc).
 */
export function getFlatHexPolygonPoints(xc: number, yc: number, R = 1.0): string {
  const a = SOM_FLAT_HEX_APOTEMA * R;
  const pts = [
    `${(xc + R).toFixed(3)},${yc.toFixed(3)}`,
    `${(xc + 0.5 * R).toFixed(3)},${(yc + a).toFixed(3)}`,
    `${(xc - 0.5 * R).toFixed(3)},${(yc + a).toFixed(3)}`,
    `${(xc - R).toFixed(3)},${yc.toFixed(3)}`,
    `${(xc - 0.5 * R).toFixed(3)},${(yc - a).toFixed(3)}`,
    `${(xc + 0.5 * R).toFixed(3)},${(yc - a).toFixed(3)}`
  ];
  return pts.join(' ');
}

/**
 * Computes cluster contour edge segments [x1, y1, x2, y2] for a hexagon at (row, col),
 * matching MallaHexagonal's column-parity hexagonal grid topology.
 */
export function getHexClusterBorders(
  row: number,
  col: number,
  rows: number,
  cols: number,
  hexGrid: SomHexNode[],
  clustering: number[],
  R = 1.0
): Array<[number, number, number, number]> {
  const neuronIdx = col + row * cols;
  const node = hexGrid[neuronIdx];
  if (!node || !clustering || clustering.length === 0) return [];

  const clusterId = clustering[neuronIdx];
  const a = SOM_FLAT_HEX_APOTEMA * R;
  const points: Array<[number, number]> = [
    [node.x + R, node.y],
    [node.x + 0.5 * R, node.y + a],
    [node.x - 0.5 * R, node.y + a],
    [node.x - R, node.y],
    [node.x - 0.5 * R, node.y - a],
    [node.x + 0.5 * R, node.y - a]
  ];

  const neighbors: Array<{ r: number; c: number; edgeIdxs: [number, number] }> = [
    { r: col % 2 === 0 ? row : row + 1, c: col + 1, edgeIdxs: [0, 1] },
    { r: row + 1, c: col, edgeIdxs: [1, 2] },
    { r: col % 2 === 0 ? row : row + 1, c: col - 1, edgeIdxs: [2, 3] },
    { r: col % 2 === 0 ? row - 1 : row, c: col - 1, edgeIdxs: [3, 4] },
    { r: row - 1, c: col, edgeIdxs: [4, 5] },
    { r: col % 2 === 0 ? row - 1 : row, c: col + 1, edgeIdxs: [5, 0] }
  ];

  const lines: Array<[number, number, number, number]> = [];
  for (const nb of neighbors) {
    const isOutOfBounds = nb.r < 0 || nb.r >= rows || nb.c < 0 || nb.c >= cols;
    const neighIdx = nb.c + nb.r * cols;
    const isDiffCluster = !isOutOfBounds && clustering[neighIdx] !== clusterId;
    if (isOutOfBounds || isDiffCluster) {
      const [p1x, p1y] = points[nb.edgeIdxs[0]];
      const [p2x, p2y] = points[nb.edgeIdxs[1]];
      lines.push([p1x, p1y, p2x, p2y]);
    }
  }
  return lines;
}

/**
 * Computes raw dataset and denormalized SOM weight summary statistics for all variables.
 */
export function computeAllComponentStats(
  compNames: string[],
  weights: number[][] | undefined,
  normalizationInfo: NormalizationInfo | null,
  baseMatrix: number[][] | null | undefined
): ComponentStatSummary[] {
  return compNames.map((name, fIdx) => {
    let rawMin = 0;
    let rawMax = 1;
    let rawAvg = 0.5;
    if (baseMatrix && baseMatrix.length > 0 && fIdx < (baseMatrix[0]?.length || 0)) {
      let minV = Infinity;
      let maxV = -Infinity;
      let sumV = 0;
      let count = 0;
      for (const row of baseMatrix) {
        const v = row[fIdx];
        if (typeof v === 'number' && Number.isFinite(v)) {
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
          sumV += v;
          count++;
        }
      }
      if (count > 0) {
        rawMin = minV;
        rawMax = maxV;
        rawAvg = sumV / count;
      }
    }

    let somMin = rawMin;
    let somMax = rawMax;
    let somAvg = rawAvg;
    if (weights && weights.length > 0 && fIdx < (weights[0]?.length || 0)) {
      let minW = Infinity;
      let maxW = -Infinity;
      let sumW = 0;
      let count = 0;
      for (const w of weights) {
        const val = denormalizeValue(w[fIdx] ?? 0, fIdx, normalizationInfo);
        if (Number.isFinite(val)) {
          if (val < minW) minW = val;
          if (val > maxW) maxW = val;
          sumW += val;
          count++;
        }
      }
      if (count > 0) {
        somMin = minW;
        somMax = maxW;
        somAvg = sumW / count;
      }
    }

    return { name, rawMin, rawMax, rawAvg, somMin, somMax, somAvg };
  });
}

/**
 * Resolves effective [min, mid, max] bounds matching MallaHexagonal scale rules.
 */
export function resolveComponentScaleBounds(
  stat: ComponentStatSummary,
  scaleConfig?: ComponentScaleConfig,
  globalScaleSource: 'raw' | 'weights' = 'raw'
): ComponentScaleBounds {
  const source = scaleConfig?.source || globalScaleSource;
  let minV = stat.rawMin;
  let maxV = stat.rawMax;
  let midV = stat.rawAvg;

  if (source === 'weights') {
    minV = stat.somMin;
    maxV = stat.somMax;
    midV = stat.somAvg;
  } else if (source === 'custom' && scaleConfig) {
    minV = scaleConfig.customMin ?? stat.rawMin;
    maxV = scaleConfig.customMax ?? stat.rawMax;
    midV = scaleConfig.customMid ?? stat.rawAvg;
  }

  const effectiveMax = maxV === minV ? minV + 1e-6 : maxV;
  let effectiveMid = midV;
  if (effectiveMid <= minV || effectiveMid >= effectiveMax) {
    effectiveMid = (minV + effectiveMax) / 2.0;
  }
  return { min: minV, mid: effectiveMid, max: effectiveMax };
}

/**
 * Creates a chroma color interpolator consistent with MallaHexagonal component maps.
 */
export function buildComponentChromaScale(
  palette: SomPaletteName,
  bounds: ComponentScaleBounds
): (value: number) => string {
  const { min, mid, max } = bounds;
  const domain5 = [min, (min + mid) / 2, mid, (mid + max) / 2, max];
  const scaleFn =
    palette === 'viridis'
      ? chroma.scale(['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']).domain(domain5)
      : palette === 'cividis'
      ? chroma.scale(['#00204d', '#414d6b', '#7c7b78', '#b9ad71', '#ffea46']).domain(domain5)
      : chroma.scale(['#38a169', '#ecc94b', '#e53e3e']).domain([min, mid, max]);

  return (value: number) => {
    const clamped = Math.max(min, Math.min(max, value));
    return scaleFn(clamped).hex();
  };
}

const formatNum = (n: number): string => {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 10) return n.toFixed(2);
  return n.toFixed(3);
};

/**
 * Builds rich clustering + component-plane quantitative prompt context for LLM cluster characterization.
 */
export function buildEnrichedSomClusterContext(params: {
  rows: number;
  cols: number;
  somTitleName: string;
  unitAnalysisName: string;
  clusteringAlgorithm: string;
  nClusters: number;
  labels: string[];
  dataMatrix: number[][];
  compNames: string[];
  weights: number[][];
  clustering: number[];
  bmus: number[];
  clusterLabels?: Record<number, string>;
  normalizationInfo: NormalizationInfo | null;
  rawColStats: ComponentStatSummary[];
  globalScaleSource?: 'raw' | 'weights';
  colorScale?: SomPaletteName;
}): string {
  const {
    rows,
    cols,
    somTitleName,
    unitAnalysisName,
    clusteringAlgorithm,
    nClusters,
    labels,
    dataMatrix,
    compNames,
    weights,
    clustering,
    bmus,
    clusterLabels,
    normalizationInfo,
    rawColStats,
    globalScaleSource = 'raw',
    colorScale = 'standard'
  } = params;

  const totalNeurons = Math.max(1, rows * cols);
  const totalEntities = labels?.length || dataMatrix?.length || 0;
  const numFeatures = compNames.length;
  const clusters = Array.from(new Set(clustering.filter(c => c !== -1))).sort((a, b) => a - b);

  // Global SOM mean per normalized feature for contrast detection on high-dimensional maps
  const globalSomMeans = new Array(numFeatures).fill(0);
  if (weights.length > 0) {
    for (const w of weights) {
      for (let f = 0; f < numFeatures; f++) globalSomMeans[f] += w[f] ?? 0;
    }
    for (let f = 0; f < numFeatures; f++) globalSomMeans[f] /= weights.length;
  }

  const lines: string[] = [
    `Self-Organizing Map (SOM) Hexagonal Grid (${rows}x${cols} = ${totalNeurons} neurons).`,
    `Active Experiment / Model: "${somTitleName}".`,
    `Mapped Unit of Analysis: "${unitAnalysisName}".`,
    `Clustering Algorithm: ${clusteringAlgorithm} with ${clusters.length || nClusters} clusters.`,
    `Total Mapped Entities: ${totalEntities}.`,
    `Component Planes Palette & Scale: ${colorScale} (${globalScaleSource === 'weights' ? 'SOM Neuron Weights' : 'Raw Denormalized Data'}).`,
    `Analyzed Variables / Component Planes (${numFeatures}): ${compNames.slice(0, 30).join(', ')}${numFeatures > 30 ? ` ... (+${numFeatures - 30} more)` : ''}.`
  ];

  // Include component plane ranges (full for <= 30 variables, or top 25 sample)
  if (rawColStats.length > 0) {
    const shownStats = rawColStats.slice(0, 30);
    lines.push('');
    lines.push(`COMPONENT PLANE VARIABLE RANGES (Global Real Values [Min / Mean / Max] | SOM Codebook [Min..Max]):`);
    for (const st of shownStats) {
      lines.push(
        `• ${st.name}: Real [${formatNum(st.rawMin)} / ${formatNum(st.rawAvg)} / ${formatNum(st.rawMax)}] | SOM [${formatNum(st.somMin)}..${formatNum(st.somMax)}]`
      );
    }
    if (rawColStats.length > 30) {
      lines.push(`... (${rawColStats.length - 30} additional component variables omitted for brevity)`);
    }
  }

  lines.push('');
  lines.push(`CLUSTER BREAKDOWN, CENTROID VECTORS & COMPONENT PLANE CHARACTERIZATION:`);

  for (const cId of clusters) {
    const clusterNeuronIndices: number[] = [];
    const clusterNeuronSet = new Set<number>();
    clustering.forEach((c, idx) => {
      if (c === cId) {
        clusterNeuronIndices.push(idx);
        clusterNeuronSet.add(idx);
      }
    });

    const centroidNorm = new Array(numFeatures).fill(0);
    for (const nIdx of clusterNeuronIndices) {
      const w = weights[nIdx];
      if (w) {
        for (let f = 0; f < numFeatures; f++) centroidNorm[f] += w[f] ?? 0;
      }
    }
    for (let f = 0; f < numFeatures; f++) {
      centroidNorm[f] /= Math.max(1, clusterNeuronIndices.length);
    }

    const mappedEntities = labels.filter((_, idx) => bmus && clusterNeuronSet.has(bmus[idx]));
    const neuronPct = ((clusterNeuronIndices.length / totalNeurons) * 100).toFixed(1);
    const entityPct = totalEntities > 0 ? ((mappedEntities.length / totalEntities) * 100).toFixed(1) : '0.0';
    const customName = clusterLabels?.[cId] || `Cluster ${cId + 1}`;

    const compDetails = compNames.map((name, f) => {
      const normV = centroidNorm[f];
      const realV = denormalizeValue(normV, f, normalizationInfo);
      const st = rawColStats[f];
      const globalMeanReal = st ? st.somAvg : denormalizeValue(globalSomMeans[f], f, normalizationInfo);
      const deltaNorm = normV - globalSomMeans[f];
      return { name, normV, realV, globalMeanReal, deltaNorm };
    });

    lines.push(
      `\n• ${customName} (${clusterNeuronIndices.length} neurons [${neuronPct}% of map], ${mappedEntities.length} "${unitAnalysisName}" entities [${entityPct}% of sample]):`
    );

    if (numFeatures <= 25) {
      const sorted = [...compDetails].sort((a, b) => b.normV - a.normV);
      const formattedAll = sorted
        .map(d => `${d.name}: norm=${d.normV.toFixed(3)} (real=${formatNum(d.realV)}, Δglobal=${d.deltaNorm >= 0 ? '+' : ''}${d.deltaNorm.toFixed(3)})`)
        .join('; ');
      lines.push(`   - Full Component Plane Centroid Profile: [${formattedAll}]`);
    } else {
      const byHigh = [...compDetails].sort((a, b) => b.deltaNorm - a.deltaNorm).slice(0, 10);
      const byLow = [...compDetails].sort((a, b) => a.deltaNorm - b.deltaNorm).slice(0, 5);
      lines.push(
        `   - Strongest Positive Component Planes (vs map mean): [${byHigh
          .map(d => `${d.name}: norm=${d.normV.toFixed(3)} / real=${formatNum(d.realV)} (+${d.deltaNorm.toFixed(3)})`)
          .join(', ')}]`
      );
      lines.push(
        `   - Lowest / Under-represented Component Planes: [${byLow
          .map(d => `${d.name}: norm=${d.normV.toFixed(3)} / real=${formatNum(d.realV)} (${d.deltaNorm.toFixed(3)})`)
          .join(', ')}]`
      );
    }

    lines.push(
      `   - Assigned Entities (${mappedEntities.length}): ${mappedEntities.slice(0, 15).join(', ') || 'No directly assigned entities'}${
        mappedEntities.length > 15 ? ` ... (+${mappedEntities.length - 15} more)` : ''
      }`
    );
  }

  return lines.join('\n');
}

