import React, { useMemo, useState, useCallback } from 'react';
import { hierarchy, partition } from 'd3-hierarchy';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import { arc } from 'd3-shape';

// ─── Colour helpers ──────────────────────────────────────────────────────────
// Two-colour divergent scale: cold (blue) → neutral (gray) → warm (orange/red)
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function tropicColor(t: number): string {
    // t in [0,1]; mid-point = neutral
    // Low  → cool teal-blue  #1e90c3
    // High → warm orange-red  #c34b1e
    const low  = [0x1e, 0x90, 0xc3];
    const mid  = [0x88, 0x88, 0x88];
    const high = [0xc3, 0x4b, 0x1e];
    const [a, b] = t < 0.5 ? [low, mid] : [mid, high];
    const tt = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const r = Math.round(lerp(a[0], b[0], tt));
    const g = Math.round(lerp(a[1], b[1], tt));
    const b_ = Math.round(lerp(a[2], b[2], tt));
    return `rgb(${r},${g},${b_})`;
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface SunburstNode {
    id: string;
    parent: string;
    level: 'Macro Topics' | 'Meso Topics' | 'Micro Topics';
    value: number;
    indicators_sum:  Record<string, number>;
    indicators_mean: Record<string, number>;
}

export interface SunburstData {
    nodes: SunburstNode[];
    indicators: string[];
    summable_indicators: string[];
    meanable_indicators: string[];
}

interface Props {
    data: SunburstData;
}

// ─── Component ───────────────────────────────────────────────────────────────
const SunburstChart: React.FC<Props> = ({ data }) => {
    const SIZE = 560;
    const RADIUS = SIZE / 2;

    const [colorIndicator, setColorIndicator] = useState<string>('');
    const [tooltip, setTooltip] = useState<{ x: number; y: number; node: any } | null>(null);

    // Derive default indicator once data arrives
    const defaultIndicator = useMemo(() => {
        const prefer = ['Category Normalized Citation Impact', '% Documents in Top 10%',
                        '% Documents in Q1 Journals', 'Average Percentile'];
        for (const p of prefer) {
            if (data.indicators.includes(p)) return p;
        }
        return data.indicators[0] ?? '';
    }, [data]);

    const activeIndicator = colorIndicator || defaultIndicator;
    const isSummable = data.summable_indicators.includes(activeIndicator);

    // Build d3 hierarchy from flat node list
    const root = useMemo(() => {
        if (!data?.nodes?.length) return null;

        // Build adjacency
        const childrenMap: Record<string, SunburstNode[]> = {};
        const roots: SunburstNode[] = [];
        for (const n of data.nodes) {
            if (!n.parent) {
                roots.push(n);
            } else {
                if (!childrenMap[n.parent]) childrenMap[n.parent] = [];
                childrenMap[n.parent].push(n);
            }
        }

        const fakeRoot = {
            id: '__root__', parent: '', level: 'Macro Topics' as const,
            value: 0, indicators_sum: {}, indicators_mean: {},
        } as SunburstNode;
        void fakeRoot; // unused; kept for clarity

        function buildTree(n: SunburstNode): any {
            const kids = childrenMap[n.id] ?? [];
            return {
                name:  n.id,
                level: n.level,
                rawValue: n.value,
                ind_sum:  n.indicators_sum,
                ind_mean: n.indicators_mean,
                children: kids.length ? kids.map(buildTree) : undefined,
            };
        }

        const treeData = {
            name: '__root__', level: 'root', rawValue: 0,
            ind_sum: {}, ind_mean: {},
            children: roots.map(buildTree),
        };

        return hierarchy(treeData)
            .sum((d: any) => d.children ? 0 : d.rawValue)
            .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));
    }, [data]);

    // d3 partition layout → arcs
    const { arcGen, arcs } = useMemo(() => {
        if (!root) return { arcGen: null, arcs: [] };
        const p = partition<any>().size([2 * Math.PI, RADIUS]);
        p(root);
        const arcGen = arc<HierarchyRectangularNode<any>>()
            .startAngle((d: HierarchyRectangularNode<any>) => d.x0)
            .endAngle((d: HierarchyRectangularNode<any>) => d.x1)
            .innerRadius((d: HierarchyRectangularNode<any>) => d.y0)
            .outerRadius((d: HierarchyRectangularNode<any>) => d.y1 - 1);

        const allNodes: any[] = [];
        root.each(d => { if (d.depth > 0) allNodes.push(d); });
        return { arcGen, arcs: allNodes };
    }, [root]);

    // Colour scale for the active indicator
    const { minC, maxC } = useMemo(() => {
        let minC = Infinity, maxC = -Infinity;
        for (const n of data.nodes) {
            const vals = isSummable ? n.indicators_sum : n.indicators_mean;
            const v = vals?.[activeIndicator] ?? 0;
            if (v < minC) minC = v;
            if (v > maxC) maxC = v;
        }
        return { minC, maxC };
    }, [data, activeIndicator, isSummable]);

    const getColor = useCallback((d: any) => {
        const vals = isSummable ? d.data.ind_sum : d.data.ind_mean;
        const v    = vals?.[activeIndicator] ?? 0;
        const range = maxC - minC;
        const t = range > 0 ? (v - minC) / range : 0.5;
        return tropicColor(t);
    }, [activeIndicator, isSummable, minC, maxC]);

    if (!root || !arcGen) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
                No hay datos de Micro Topics para construir el sunburst.
            </div>
        );
    }

    // Split indicators into two groups for the selector
    const summable = data.summable_indicators;
    const meanable = data.meanable_indicators;

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-gray-200">Sunburst Hierarchy</h3>
                    <p className="text-xs text-gray-500">Macro → Meso → Micro Topics</p>
                </div>
                <div className="flex flex-col items-end space-y-1">
                    <select
                        value={activeIndicator}
                        onChange={e => setColorIndicator(e.target.value)}
                        className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 max-w-[220px]"
                    >
                        {summable.length > 0 && (
                            <optgroup label="Sumables (totales)">
                                {summable.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                            </optgroup>
                        )}
                        {meanable.length > 0 && (
                            <optgroup label="Promediables (ratios)">
                                {meanable.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                            </optgroup>
                        )}
                    </select>
                    <span className="text-[10px] text-gray-600">
                        {isSummable ? 'Suma por nivel' : 'Promedio ponderado por nivel'}
                    </span>
                </div>
            </div>

            <div className="relative flex justify-center">
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
                     style={{ fontFamily: 'sans-serif' }}>
                    <g transform={`translate(${RADIUS},${RADIUS})`}>
                        {arcs.map((d, i) => {
                            const fill = getColor(d);
                            const pathD = arcGen(d as HierarchyRectangularNode<any>) ?? '';
                            return (
                                <path
                                    key={i}
                                    d={pathD}
                                    fill={fill}
                                    stroke="#111827"
                                    strokeWidth={0.5}
                                    opacity={0.85}
                                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                                    onMouseEnter={e => {
                                        (e.target as SVGPathElement).style.opacity = '1';
                                        const rect = (e.target as SVGPathElement)
                                            .closest('svg')!.getBoundingClientRect();
                                        setTooltip({
                                            x: e.clientX - rect.left,
                                            y: e.clientY - rect.top,
                                            node: d,
                                        });
                                    }}
                                    onMouseLeave={e => {
                                        (e.target as SVGPathElement).style.opacity = '0.85';
                                        setTooltip(null);
                                    }}
                                />
                            );
                        })}
                    </g>
                </svg>

                {/* Tooltip */}
                {tooltip && (() => {
                    const d = tooltip.node;
                    const vals = isSummable ? d.data.ind_sum : d.data.ind_mean;
                    const colorVal = vals?.[activeIndicator] ?? 0;
                    return (
                        <div
                            className="absolute z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-2xl text-xs"
                            style={{ left: tooltip.x + 12, top: tooltip.y - 20, maxWidth: 240 }}
                        >
                            <p className="font-bold text-gray-100 mb-1">{d.data.name}</p>
                            <p className="text-gray-400 text-[10px] mb-2">{d.data.level}</p>
                            <div className="space-y-0.5">
                                <div className="flex justify-between gap-3">
                                    <span className="text-gray-500">WoS Documents</span>
                                    <span className="text-gray-200 font-mono">{d.value?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-gray-500 truncate max-w-[130px]">{activeIndicator}</span>
                                    <span className="text-gray-200 font-mono">{colorVal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Legend: colour scale */}
            <div className="flex items-center space-x-2 justify-center">
                <span className="text-[10px] text-gray-500">{minC.toFixed(1)}</span>
                <div className="h-2 w-40 rounded-full" style={{
                    background: 'linear-gradient(to right, #1e90c3, #888888, #c34b1e)'
                }} />
                <span className="text-[10px] text-gray-500">{maxC.toFixed(1)}</span>
                <span className="text-[10px] text-gray-400 ml-2">{activeIndicator}</span>
            </div>
        </div>
    );
};

export default SunburstChart;
