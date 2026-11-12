import type { ChartSnapshot, ReportEntry, SourceProvenance } from '../store/aiStore';
import type { SomRun } from '../store/somStore';

export const VIEW_SOURCE_TAB_LABELS: Record<string, string> = {
  som: 'SOM & UMAP',
  incites: 'InCites Explorer',
  tlachia: 'TlachIA Metrics',
  networks: 'Bibliometrics',
  semantic: 'Semantic Maps',
  dimreduction: 'Dim Reduction',
  longitudinal: 'Longitudinal SOM (PathSOM)',
  custom: 'Custom / Agent'
};

export const EXPLORER_CONTAINER_SUBVIEWS: Record<string, string> = {
  'chart-time-series': 'Time Series Evolution',
  'chart-stacked-area': 'Stacked Area Evolution',
  'chart-cagr-scatter': 'Strategic Growth Matrix (CAGR)',
  'chart-longitudinal-trajectories': 'Longitudinal Trajectories',
  'chart-longitudinal-deltas': 'Longitudinal Growth Deltas',
  'chart-longitudinal-quadrants': 'Longitudinal Strategic Quadrants',
  'chart-4d-bubble': '4D Performance Bubble',
  'chart-radar-comparison': 'Radar Profile Comparison',
  'chart-quartile-distribution': 'Journal Quartile Distribution',
  'chart-bar-1': 'Entity Ranking Bar Chart',
  'chart-bar-2': 'Entity Ranking Bar Chart (Secondary)',
  'chart-baseline-growth': 'Corpus Baseline Growth',
  'chart-baseline-indicator': 'Corpus Baseline Indicator Trend'
};

export const CHART_TYPE_LABELS: Record<string, string> = {
  hex_map: 'Hexagonal Map',
  radar: 'Radar Chart',
  bubble: 'Bubble Chart',
  trend: 'Trend Chart',
  bar: 'Bar Chart',
  scatter: 'Scatter Plot',
  network: 'Network Graph',
  table: 'Table View',
  custom: 'Analytical Panel'
};

const extractPromptMatch = (prompt: string, regex: RegExp): string | null => {
  if (!prompt) return null;
  const m = prompt.match(regex);
  return m?.[1]?.trim() || null;
};

/**
 * Merges explicit source metadata with live store context at capture time.
 */
export function buildResolvedSourceProvenance(
  viewSource: ChartSnapshot['viewSource'],
  chartType: ChartSnapshot['chartType'],
  explicit?: Partial<SourceProvenance>,
  storeSnapshot?: {
    activeTab?: string;
    activeRunId?: string | null;
    savedRuns?: SomRun[];
    fileName?: string | null;
    incitesActiveUnit?: string | null;
    tlachiaActiveUnit?: string | null;
    semanticFileName?: string | null;
    dimFileName?: string | null;
    compNames?: string[];
    labels?: string[];
    config?: { rows?: number; cols?: number };
  }
): SourceProvenance {
  const isLongitudinal = explicit?.tabId === 'longitudinal' || storeSnapshot?.activeTab === 'temporal';
  const tabId: SourceProvenance['tabId'] = explicit?.tabId || (isLongitudinal ? 'longitudinal' : viewSource);
  const activeRun = storeSnapshot?.savedRuns?.find(r => r.id === (explicit?.experimentId || storeSnapshot?.activeRunId));

  const unitFallback =
    tabId === 'incites'
      ? storeSnapshot?.incitesActiveUnit
      : tabId === 'tlachia'
      ? storeSnapshot?.tlachiaActiveUnit
      : activeRun?.provenance?.unitName || null;

  const fileFallback =
    tabId === 'semantic'
      ? storeSnapshot?.semanticFileName
      : tabId === 'dimreduction'
      ? storeSnapshot?.dimFileName
      : activeRun?.fileName || storeSnapshot?.fileName || null;

  return {
    tabId,
    tabLabel: explicit?.tabLabel || VIEW_SOURCE_TAB_LABELS[tabId] || 'KnoMap Module',
    subView: explicit?.subView || CHART_TYPE_LABELS[chartType] || chartType,
    chartTypeLabel: explicit?.chartTypeLabel || CHART_TYPE_LABELS[chartType] || chartType,
    experimentId: explicit?.experimentId ?? (tabId === 'som' ? storeSnapshot?.activeRunId || activeRun?.id || null : null),
    experimentName: explicit?.experimentName ?? (tabId === 'som' ? activeRun?.name || null : null),
    unitName: explicit?.unitName ?? unitFallback,
    originType: explicit?.originType ?? activeRun?.provenance?.originType ?? null,
    fileName: explicit?.fileName ?? fileFallback,
    period: explicit?.period ?? null,
    indicator: explicit?.indicator ?? null,
    clusterId: explicit?.clusterId ?? null,
    clusterLabel: explicit?.clusterLabel ?? null,
    gridSize:
      explicit?.gridSize ??
      (tabId === 'som' && storeSnapshot?.config?.rows && storeSnapshot?.config?.cols
        ? [storeSnapshot.config.rows, storeSnapshot.config.cols]
        : null),
    entitiesCount: explicit?.entitiesCount ?? (tabId === 'som' ? storeSnapshot?.labels?.length ?? null : null),
    indicatorsCount: explicit?.indicatorsCount ?? (tabId === 'som' ? storeSnapshot?.compNames?.length ?? null : null)
  };
}

/**
 * Formats a concise human-readable subtitle for ChartSnapshot.subtitle.
 */
export function buildSourceSubtitle(prov: SourceProvenance): string {
  const parts = [
    prov.tabLabel,
    prov.subView && prov.subView !== prov.tabLabel ? prov.subView : null,
    prov.experimentName ? `Exp: ${prov.experimentName}` : null,
    prov.unitName ? `Unit: ${prov.unitName}` : null,
    prov.period ? `Period: ${prov.period}` : null,
    prov.indicator ? `Indicator: ${prov.indicator}` : null
  ].filter(Boolean);
  return parts.join(' · ');
}

/**
 * Resolves full provenance for any ReportEntry, including legacy entries saved before sourceInfo existed.
 */
export function resolveEntryProvenance(entry: ReportEntry, savedRuns: SomRun[] = []): SourceProvenance {
  const snap = entry.snapshot;
  const explicit = snap?.sourceInfo;
  const prompt = entry.dataContextPrompt || '';
  const viewSource = snap?.viewSource || 'custom';
  const chartType = snap?.chartType || 'custom';

  const tabId: SourceProvenance['tabId'] =
    explicit?.tabId ||
    (prompt.toLowerCase().includes('longitudinal som') ? 'longitudinal' : viewSource);

  let experimentId = explicit?.experimentId ?? null;
  let experimentName =
    explicit?.experimentName ??
    (extractPromptMatch(prompt, /Active Experiment\s*\/\s*Model:\s*"([^"]+)"/i) ||
      extractPromptMatch(prompt, /Model\s*\/\s*Experiment:\s*"([^"]+)"/i));

  let unitName =
    explicit?.unitName ??
    (extractPromptMatch(prompt, /Mapped Unit of Analysis:\s*"([^"]+)"/i) ||
      extractPromptMatch(prompt, /Unit of Analysis:\s*"([^"]+)"/i));

  let gridSize = explicit?.gridSize ?? null;
  if (!gridSize) {
    const gridMatch = prompt.match(/\((\d+)\s*x\s*(\d+)\)/);
    if (gridMatch) {
      gridSize = [Number(gridMatch[1]), Number(gridMatch[2])];
    }
  }

  let entitiesCount = explicit?.entitiesCount ?? null;
  if (entitiesCount === null) {
    const entMatch = prompt.match(/Total Mapped Entities:\s*(\d+)/i);
    if (entMatch) entitiesCount = Number(entMatch[1]);
  }

  let indicatorsCount = explicit?.indicatorsCount ?? null;
  if (indicatorsCount === null) {
    const indMatch = prompt.match(/Analyzed Variables\s*(?:\/\s*Indicators)?\s*(?:\((\d+)\)|:\s*(\d+))/i);
    if (indMatch) indicatorsCount = Number(indMatch[1] || indMatch[2]);
  }

  let subView = explicit?.subView;
  if (!subView) {
    const lowTitle = (entry.title || '').toLowerCase();
    const lowPrompt = prompt.toLowerCase();
    if (tabId === 'longitudinal') {
      subView = 'Longitudinal SOM (PathSOM)';
    } else if (viewSource === 'som') {
      if (chartType === 'radar' || lowTitle.includes('radar')) {
        subView = 'Cluster Profile Radar';
      } else if (lowTitle.includes('u-matrix') || lowPrompt.includes('u-matrix')) {
        subView = 'U-Matrix (Topological Distances)';
      } else if (lowTitle.includes('quantization') || lowPrompt.includes('quantization error')) {
        subView = 'Quantization Error Map';
      } else if (chartType === 'hex_map') {
        subView = 'Clustering Hexagonal Map';
      }
    } else {
      subView = CHART_TYPE_LABELS[chartType] || chartType;
    }
  }

  // Match against savedRuns when SOM metadata is missing or partial (e.g., legacy entries)
  let matchedRun: SomRun | undefined;
  if (experimentId) {
    matchedRun = savedRuns.find(r => r.id === experimentId);
  }
  if (!matchedRun && (tabId === 'som' || viewSource === 'som') && savedRuns.length > 0) {
    const targetExp = (experimentName || '').trim().toLowerCase();
    const targetTitle = (entry.title || '').trim().toLowerCase();
    let bestScore = 0;

    for (const run of savedRuns) {
      const rName = (run.name || '').trim().toLowerCase();
      let score = 0;
      if (targetExp && rName) {
        if (rName === targetExp) score += 10;
        else if (rName.startsWith(targetExp) || targetExp.startsWith(rName)) score += 6;
      } else if (targetTitle && rName) {
        if (rName === targetTitle) score += 6;
        else if (rName.startsWith(targetTitle) || targetTitle.startsWith(rName)) score += 4;
      }
      if (gridSize && run.config?.rows === gridSize[0] && run.config?.cols === gridSize[1]) {
        score += 3;
      }
      if (entitiesCount !== null && (run.labels?.length || run.dataMatrix?.length) === entitiesCount) {
        score += 3;
      }
      if (score > bestScore && score >= 6) {
        bestScore = score;
        matchedRun = run;
      }
    }
  }

  if (matchedRun) {
    experimentId = matchedRun.id;
    experimentName = matchedRun.name || experimentName;
    unitName = unitName || matchedRun.provenance?.unitName || null;
    if (!gridSize && matchedRun.config?.rows && matchedRun.config?.cols) {
      gridSize = [matchedRun.config.rows, matchedRun.config.cols];
    }
    if (entitiesCount === null) {
      entitiesCount = matchedRun.labels?.length || matchedRun.dataMatrix?.length || null;
    }
    if (indicatorsCount === null) {
      indicatorsCount = matchedRun.compNames?.length || matchedRun.dataMatrix?.[0]?.length || null;
    }
  }

  return {
    tabId,
    tabLabel: explicit?.tabLabel || VIEW_SOURCE_TAB_LABELS[tabId] || entry.badge || 'KnoMap Module',
    subView,
    chartTypeLabel: explicit?.chartTypeLabel || CHART_TYPE_LABELS[chartType] || chartType,
    experimentId,
    experimentName: experimentName || null,
    unitName: unitName || null,
    originType: explicit?.originType || matchedRun?.provenance?.originType || null,
    fileName: explicit?.fileName || matchedRun?.fileName || null,
    period: explicit?.period || null,
    indicator: explicit?.indicator || null,
    clusterId: explicit?.clusterId ?? null,
    clusterLabel: explicit?.clusterLabel ?? null,
    gridSize,
    entitiesCount,
    indicatorsCount
  };
}
