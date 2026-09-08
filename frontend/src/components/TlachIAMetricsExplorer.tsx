import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Activity, BarChart2, CheckSquare, Square, ChevronDown, ChevronRight, Loader2, Download, Database, TrendingUp, Filter, Check, Zap } from 'lucide-react';
import { useSomStore, getApiUrl } from '../store/somStore';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    BarChart, Bar, ScatterChart, Scatter, ZAxis, Cell,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    AreaChart, Area, ReferenceLine
} from 'recharts';
import chroma from 'chroma-js';
import SunburstChart from './SunburstChart';
import { AIAssistantCard } from './AIAssistantCard';
import { SendToAssistantButton } from './SendToAssistantButton';

import { exportChartAsSVG, exportChartAsPNG } from '../utils/chartExport';

const ExportButtons: React.FC<{ 
    containerId: string; 
    filename: string;
    chartTitle?: string;
    chartType?: 'bubble' | 'trend' | 'bar' | 'radar' | 'scatter' | 'network' | 'table' | 'custom';
    chartData?: any;
    dataPrompt?: string;
}> = ({ containerId, filename, chartTitle, chartType = 'trend', chartData, dataPrompt }) => {
    const formattedTitle = chartTitle || filename.replace(/_/g, ' ').toUpperCase();
    const promptText = dataPrompt || (chartData ? `Datos de la visualización ${formattedTitle}:\n\`\`\`json\n${typeof chartData === 'string' ? chartData : JSON.stringify(chartData, null, 2).slice(0, 3500)}\n\`\`\`` : `Gráfica generada en TlachIA Metrics Explorer: ${formattedTitle}`);

    return (
        <div className="flex items-center space-x-1.5 shrink-0">
            <SendToAssistantButton
                title={formattedTitle}
                badge="TLACHIA"
                viewSource="tlachia"
                chartType={chartType}
                targetElementId={containerId}
                data={chartData || []}
                dataContextPrompt={promptText}
                buttonText="AI Assistant"
            />
            <button
                onClick={() => exportChartAsSVG(containerId, filename)}
                className="px-2 py-1 text-[10px] font-bold bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 flex items-center space-x-1 transition-all shadow-sm"
                title="Export as SVG"
            >
                <Download className="w-3 h-3 text-cyan-400" />
                <span>SVG</span>
            </button>
            <button
                onClick={() => exportChartAsPNG(containerId, filename)}
                className="px-2 py-1 text-[10px] font-bold bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 flex items-center space-x-1 transition-all shadow-sm"
                title="Export as PNG"
            >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>PNG</span>
            </button>
        </div>
    );
};

const parseVal = (raw: any): number => {
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    if (typeof raw === 'string') return parseFloat(raw.replace('%', '').replace(',', '.').trim()) || 0;
    return 0;
};

const TlachIAUnitPanel: React.FC<{ unitName: string; unit: any }> = ({ unitName, unit }) => {
    const { 
        loadCsvData, 
        setActiveTab, 
        setConfig, 
        tlachiaSidebarTab, 
        setTlachiaState,
        tlachiaLimitTop50,
        tlachiaFilterIndicator,
        tlachiaFilterMinValue,
        tlachiaIsFilterActive,
        tlachiaIsFilterModalOpen,
        sendTlachiaToLongitudinalSom
    } = useSomStore();
    const sidebarTab = tlachiaSidebarTab || 'profiles';
    const setSidebarTab = (tab: 'profiles' | 'temporal' | 'longitudinal') => setTlachiaState({ tlachiaSidebarTab: tab });

    const limitTop50 = tlachiaLimitTop50 !== undefined ? tlachiaLimitTop50 : true;
    const filterIndicator = tlachiaFilterIndicator || (unit?.indicators?.includes('Documents') ? 'Documents' : (unit?.indicators?.[0] || ''));
    const filterMinValue = tlachiaFilterMinValue ?? '';
    const isFilterActive = tlachiaIsFilterActive || false;
    const isFilterModalOpen = tlachiaIsFilterModalOpen || false;
    const setIsFilterModalOpen = (open: boolean) => setTlachiaState({ tlachiaIsFilterModalOpen: open });

    const [selectedProfileIndicators, setSelectedProfileIndicators] = useState<string[]>([]);
    const [isProfileExpanded, setIsProfileExpanded] = useState<boolean>(false);
    const [isEntityExpanded, setIsEntityExpanded] = useState<boolean>(false);
    const [tsIndicator, setTsIndicator] = useState<string>('');
    const [tsSmoothing, setTsSmoothing] = useState<'raw' | 'ecma3' | 'ecma5'>('raw');
    const [evolutionSmoothing, setEvolutionSmoothing] = useState<'raw' | 'ecma3' | 'ecma5'>('ecma3');
    const [filterEvoZeros, setFilterEvoZeros] = useState<boolean>(true);
    const [useRecent, setUseRecent] = useState<boolean>(false);
    const [barInd1, setBarInd1] = useState<string>('');
    const [barInd2, setBarInd2] = useState<string>('');
    const [entityLimit, setEntityLimit] = useState<number | 'all' | 'custom'>(25);
    const [entitySortBy, setEntitySortBy] = useState<string>('');
    const [selectedChartEntities, setSelectedChartEntities] = useState<string[]>([]);
    
    // 4D Bubble Chart indicators
    const [bubbleIndX, setBubbleIndX] = useState<string>('');
    const [bubbleIndY, setBubbleIndY] = useState<string>('');
    const [bubbleIndSize, setBubbleIndSize] = useState<string>('');
    const [bubbleIndColor, setBubbleIndColor] = useState<string>('');
    const [showBubbleLabels, setShowBubbleLabels] = useState<boolean>(true);

    // New Visualizations state
    const [radarEntities, setRadarEntities] = useState<string[]>([]);
    const [areaMode, setAreaMode] = useState<'absolute' | 'percentage'>('absolute');

    // Longitudinal subtab state
    const [longiIndicator, setLongiIndicator] = useState<string>('Docs');
    const [longiDeltaIndicator, setLongiDeltaIndicator] = useState<string>('');
    const [longiPeriodA, setLongiPeriodA] = useState<string>('');
    const [longiPeriodB, setLongiPeriodB] = useState<string>('');
    const [longiPositiveGrowthOnly, setLongiPositiveGrowthOnly] = useState<boolean>(false);
    const [longiEntityLimit, setLongiEntityLimit] = useState<number | 'all' | 'custom'>(25);
    const [selectedLongiEntities, setSelectedLongiEntities] = useState<string[]>([]);
    const [isLongitudinalEntitiesExpanded, setIsLongitudinalEntitiesExpanded] = useState<boolean>(false);
    const [longiEntitySearch, setLongiEntitySearch] = useState<string>('');
    const [longiTableSearch, setLongiTableSearch] = useState<string>('');

    // Initialise defaults when unit data arrives
    useEffect(() => {
        if (!unit) return;
        if (unit.indicators && unit.indicators.length > 0) {
            // Default selected profile indicators — TlachIA Metrics (OpenAlex) columns
            const defaultsExact = [
                'Documents',
                'Times Cited',
                '% Documents in Top 10%',
                '% Documents in Top 1%',
                'Average Percentile',
                'H-Index',
                '% All Open Access Documents',
                '% Free to Read / Diamond Documents',
                '% International Collaborations',
                '% Global South Collaborations',
                'Estimated APC Paid (USD)',
            ];
            // Substring patterns for indicators whose names may vary slightly (e.g. CNCI with/without suffix)
            const defaultsSubstring = [
                'Category Normalized Citation Impact',  // matches with or without '(CNCI / FWCI)'
            ];
            const initialSelected = unit.indicators.filter((ind: string) =>
                defaultsExact.includes(ind) ||
                defaultsSubstring.some(pattern => ind.includes(pattern))
            );
            if (initialSelected.length === 0) initialSelected.push(...unit.indicators.slice(0, 6));
            setSelectedProfileIndicators(initialSelected);

            if (!barInd1 || !unit.indicators.includes(barInd1)) {
                setBarInd1(unit.indicators.includes('Documents') ? 'Documents' : unit.indicators[0]);
            }
            if (!barInd2 || !unit.indicators.includes(barInd2)) {
                const second = unit.indicators.find((i: string) => i !== 'Documents' && (i.includes('Impact') || i.includes('Cited') || i.includes('CNCI'))) || unit.indicators[1] || unit.indicators[0];
                setBarInd2(second);
            }
            if (!entitySortBy || !unit.indicators.includes(entitySortBy)) {
                setEntitySortBy(unit.indicators.includes('Documents') ? 'Documents' : unit.indicators[0]);
            }
            if (!tlachiaFilterIndicator || !unit.indicators.includes(tlachiaFilterIndicator)) {
                setTlachiaState({ tlachiaFilterIndicator: unit.indicators.includes('Documents') ? 'Documents' : unit.indicators[0] });
            }
            // Bubble chart defaults: X=Documents, Y=CNCI, Size=Times Cited, Color=% Free to Read / Diamond
            const indX = unit.indicators.find((i: string) => i === 'Documents') || unit.indicators[0];
            const indY = unit.indicators.find((i: string) => i !== indX && (i.includes('CNCI') || i.includes('Category Normalized') || i.includes('Impact'))) || unit.indicators.find((i: string) => i !== indX) || unit.indicators[1] || indX;
            const indSize = unit.indicators.find((i: string) => i !== indX && i !== indY && (i === 'Times Cited' || i.includes('Times Cited'))) || unit.indicators.find((i: string) => i !== indX && i !== indY) || unit.indicators[2] || indX;
            const indColor = unit.indicators.find((i: string) => i !== indX && i !== indY && i !== indSize && (i.includes('Diamond') || i.includes('Average Percentile') || i.includes('Top 1%'))) || unit.indicators.find((i: string) => i !== indX && i !== indY && i !== indSize) || unit.indicators[3] || indX;

            if (!bubbleIndX || !unit.indicators.includes(bubbleIndX)) {
                setBubbleIndX(indX);
            }
            if (!bubbleIndY || !unit.indicators.includes(bubbleIndY)) {
                setBubbleIndY(indY);
            }
            if (!bubbleIndSize || !unit.indicators.includes(bubbleIndSize)) {
                setBubbleIndSize(indSize);
            }
            if (!bubbleIndColor || !unit.indicators.includes(bubbleIndColor)) {
                setBubbleIndColor(indColor);
            }
        }
        if (unit.time_series) {
            const tsKeys = Object.keys(unit.time_series);
            if (tsKeys.length > 0) {
                if (!tsIndicator || !tsKeys.includes(tsIndicator)) {
                    setTsIndicator(tsKeys.includes('Documents') ? 'Documents' : tsKeys[0]);
                }
            } else {
                setTsIndicator('');
            }
        }
        if (unit.longitudinal) {
            const l = unit.longitudinal;
            if (l.indicators && l.indicators.length > 0) {
                if (!longiIndicator || !l.indicators.includes(longiIndicator)) {
                    setLongiIndicator(l.indicators.includes('Docs') ? 'Docs' : l.indicators[0]);
                }
            }
            if (l.delta_indicators && l.delta_indicators.length > 0) {
                if (!longiDeltaIndicator || !l.delta_indicators.includes(longiDeltaIndicator)) {
                    setLongiDeltaIndicator(l.delta_indicators[0]);
                }
            }
            if (l.periods && l.periods.length >= 2) {
                setLongiPeriodA(l.periods[0]);
                setLongiPeriodB(l.periods[l.periods.length - 1]);
            }
            if (l.entities && l.entities.length > 0) {
                if (longiEntityLimit !== 'custom') {
                    if (longiEntityLimit === 'all') {
                        setSelectedLongiEntities(l.entities.map((e: any) => e.entity));
                    } else {
                        const lim = typeof longiEntityLimit === 'number' ? longiEntityLimit : 25;
                        setSelectedLongiEntities(l.entities.slice(0, lim).map((e: any) => e.entity));
                    }
                }
            }
        }
    }, [unit]);

    const longiPeriods = useMemo(() => unit?.longitudinal?.periods || [], [unit]);
    const longiIndicators = useMemo(() => unit?.longitudinal?.indicators || [], [unit]);
    const longiDeltaIndicators = useMemo(() => unit?.longitudinal?.delta_indicators || [], [unit]);
    const longiEntities = useMemo(() => unit?.longitudinal?.entities || [], [unit]);

    useEffect(() => {
        if (!longiEntities || longiEntities.length === 0 || longiEntityLimit === 'custom') return;
        if (longiEntityLimit === 'all') {
            setSelectedLongiEntities(longiEntities.map((e: any) => e.entity));
        } else {
            const lim = typeof longiEntityLimit === 'number' ? longiEntityLimit : 25;
            setSelectedLongiEntities(longiEntities.slice(0, lim).map((e: any) => e.entity));
        }
    }, [longiEntities, longiEntityLimit]);

    const toggleLongiEntity = (ent: string) => {
        setSelectedLongiEntities(prev =>
            prev.includes(ent) ? prev.filter(e => e !== ent) : [...prev, ent]
        );
        setLongiEntityLimit('custom');
    };

    const displayedLongiEntities = useMemo(() => {
        if (!longiEntities || longiEntities.length === 0) return [];
        if (!longiEntitySearch.trim()) return longiEntities;
        const q = longiEntitySearch.toLowerCase().trim();
        return longiEntities.filter((e: any) => String(e.entity).toLowerCase().includes(q));
    }, [longiEntities, longiEntitySearch]);

    const filteredLongiEntities = useMemo(() => {
        if (!longiEntities || longiEntities.length === 0) return [];
        if (selectedLongiEntities.length === 0) return [];
        let list = longiEntities.filter((e: any) => selectedLongiEntities.includes(e.entity));
        if (longiPositiveGrowthOnly && longiDeltaIndicator) {
            list = list.filter((e: any) => (e.deltas?.[longiDeltaIndicator] || 0) > 0);
        }
        return list;
    }, [longiEntities, selectedLongiEntities, longiPositiveGrowthOnly, longiDeltaIndicator]);

    const longiTrajectoryChartData = useMemo(() => {
        if (!longiPeriods.length || !filteredLongiEntities.length || !longiIndicator) return [];
        return longiPeriods.map((period: string) => {
            const row: Record<string, any> = { period };
            filteredLongiEntities.forEach((ent: any) => {
                row[ent.entity] = ent.periods?.[period]?.[longiIndicator] ?? 0;
            });
            return row;
        });
    }, [longiPeriods, filteredLongiEntities, longiIndicator]);

    const longiDeltaChartData = useMemo(() => {
        if (!longiDeltaIndicator || !filteredLongiEntities.length) return [];
        return filteredLongiEntities.map((ent: any) => ({
            entity: ent.entity,
            delta: ent.deltas?.[longiDeltaIndicator] ?? 0,
            total_docs: ent.total_docs || 0
        })).sort((a: any, b: any) => b.delta - a.delta).slice(0, 20);
    }, [filteredLongiEntities, longiDeltaIndicator]);

    const longiQuadrantData = useMemo(() => {
        if (!longiPeriodA || !longiPeriodB || !filteredLongiEntities.length) return [];
        return filteredLongiEntities.map((ent: any) => {
            const docsA = ent.periods?.[longiPeriodA]?.['Docs'] ?? ent.periods?.[longiPeriodA]?.['Documents'] ?? 0;
            const docsB = ent.periods?.[longiPeriodB]?.['Docs'] ?? ent.periods?.[longiPeriodB]?.['Documents'] ?? 0;
            const fwciA = ent.periods?.[longiPeriodA]?.['FWCI'] ?? ent.periods?.[longiPeriodA]?.['Field-Weighted Citation Impact (FWCI)'] ?? 0;
            const fwciB = ent.periods?.[longiPeriodB]?.['FWCI'] ?? ent.periods?.[longiPeriodB]?.['Field-Weighted Citation Impact (FWCI)'] ?? 0;
            return {
                entity: ent.entity,
                docsA,
                docsB,
                fwciA,
                fwciB,
                deltaDocs: docsB - docsA,
                deltaFWCI: Number((fwciB - fwciA).toFixed(2))
            };
        });
    }, [filteredLongiEntities, longiPeriodA, longiPeriodB]);

    const longiColors = useMemo(() => {
        if (!filteredLongiEntities || filteredLongiEntities.length === 0) return {};
        const count = Math.max(filteredLongiEntities.length, 7);
        const scale = chroma.scale(['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#14b8a6']).mode('lch').colors(count);
        const map: Record<string, string> = {};
        filteredLongiEntities.forEach((ent: any, idx: number) => {
            map[ent.entity] = scale[idx % scale.length];
        });
        return map;
    }, [filteredLongiEntities]);

    useEffect(() => {
        if (!unit || !unit.profile || !entitySortBy || entityLimit === 'custom') return;
        const profileToUse = (useRecent && unit.profile_5years && unit.profile_5years.length > 0) ? unit.profile_5years : unit.profile;
        const sorted = [...profileToUse].sort((a: any, b: any) => {
            const valA = typeof a[entitySortBy] === 'number' ? a[entitySortBy] : parseFloat(String(a[entitySortBy] || '').replace('%', '').replace(',', '.')) || 0;
            const valB = typeof b[entitySortBy] === 'number' ? b[entitySortBy] : parseFloat(String(b[entitySortBy] || '').replace('%', '').replace(',', '.')) || 0;
            return valB - valA;
        });
        
        let topEntities = sorted.map((r: any) => String(r.entity));
        if (entityLimit !== 'all') {
            topEntities = topEntities.slice(0, entityLimit);
        }
        setSelectedChartEntities(topEntities);
    }, [unit, useRecent, entityLimit, entitySortBy]);

    const toggleProfileIndicator = (ind: string) => {
        setSelectedProfileIndicators(prev =>
            prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
        );
    };

    const toggleChartEntity = (entity: string) => {
        setSelectedChartEntities(prev =>
            prev.includes(entity) ? prev.filter(e => e !== entity) : [...prev, entity]
        );
        setEntityLimit('custom');
    };

    // Extract unique entities according to the Temporal Heatmap Matrix ranking order
    const evoUniqueEntities = useMemo(() => {
        const raw = unit?.profile_evolution?.[evolutionSmoothing];
        if (!raw || raw.length === 0) return [];
        const seen = new Set<string>();
        const list: string[] = [];
        for (const r of raw) {
            const rawName = String(r.entity || '');
            const ent = rawName.includes('_') ? rawName.substring(rawName.indexOf('_') + 1) : rawName;
            if (ent && !seen.has(ent)) {
                seen.add(ent);
                list.push(ent);
            }
        }
        return list;
    }, [unit, evolutionSmoothing]);

    const [temporalEntityLimit, setTemporalEntityLimit] = useState<number | 'all' | 'custom'>(5);
    const [temporalSelectedEntities, setTemporalSelectedEntities] = useState<string[]>([]);
    const [isTemporalEntitiesExpanded, setIsTemporalEntitiesExpanded] = useState<boolean>(false);

    useEffect(() => {
        if (evoUniqueEntities.length === 0 || temporalEntityLimit === 'custom') return;
        if (temporalEntityLimit === 'all') {
            setTemporalSelectedEntities(evoUniqueEntities);
        } else {
            setTemporalSelectedEntities(evoUniqueEntities.slice(0, temporalEntityLimit));
        }
    }, [evoUniqueEntities, temporalEntityLimit]);

    const toggleTemporalEntity = (ent: string) => {
        setTemporalSelectedEntities(prev =>
            prev.includes(ent) ? prev.filter(e => e !== ent) : [...prev, ent]
        );
        setTemporalEntityLimit('custom');
    };

    // Filtered evolution data (all trajectory rows for the selected temporal entities)
    const filteredEvoData = useMemo(() => {
        const raw = unit?.profile_evolution?.[evolutionSmoothing];
        if (!raw || raw.length === 0) return [];
        const matchingRows = raw.filter((row: any) => {
            const rawName = String(row.entity || '');
            const ent = rawName.includes('_') ? rawName.substring(rawName.indexOf('_') + 1) : rawName;
            return temporalSelectedEntities.includes(ent);
        });

        if (!filterEvoZeros || selectedProfileIndicators.length === 0) return matchingRows;
        return matchingRows.filter((row: any) =>
            selectedProfileIndicators.some((ind: string) => {
                const v = row[ind];
                return typeof v === 'number' && v !== 0;
            })
        );
    }, [unit, evolutionSmoothing, temporalSelectedEntities, filterEvoZeros, selectedProfileIndicators]);

    const hasRecentData = unit.profile_5years && unit.profile_5years.length > 0;
    const activeProfile = useRecent && hasRecentData ? unit.profile_5years : unit.profile;
    const activeQuartiles = useRecent && hasRecentData && unit.quartiles_5years ? unit.quartiles_5years : unit.quartiles;
    const activeSunburst = useRecent && hasRecentData && unit.sunburst_5years ? unit.sunburst_5years : unit.sunburst;

    const barData1 = useMemo(() => {
        if (!activeProfile || !barInd1) return [];
        return activeProfile
            .map((r: any) => {
                const rawV = r[barInd1];
                let val = 0;
                if (typeof rawV === 'number') val = isNaN(rawV) ? 0 : rawV;
                else if (typeof rawV === 'string') {
                    val = parseFloat(rawV.replace('%', '').replace(',', '.').trim()) || 0;
                }
                return { entity: String(r.entity || ''), value: val };
            })
            .filter((r: any) => selectedChartEntities.includes(r.entity) && r.value > 0)
            .sort((a: any, b: any) => b.value - a.value);
    }, [activeProfile, barInd1, selectedChartEntities]);

    const barData2 = useMemo(() => {
        if (!activeProfile || !barInd2) return [];
        return activeProfile
            .map((r: any) => {
                const rawV = r[barInd2];
                let val = 0;
                if (typeof rawV === 'number') val = isNaN(rawV) ? 0 : rawV;
                else if (typeof rawV === 'string') {
                    val = parseFloat(rawV.replace('%', '').replace(',', '.').trim()) || 0;
                }
                return { entity: String(r.entity || ''), value: val };
            })
            .filter((r: any) => selectedChartEntities.includes(r.entity) && r.value > 0)
            .sort((a: any, b: any) => b.value - a.value);
    }, [activeProfile, barInd2, selectedChartEntities]);

    const quartileChartData = useMemo(() => {
        if (!activeQuartiles) return [];
        return activeQuartiles.filter((q: any) => selectedChartEntities.includes(q.entity));
    }, [activeQuartiles, selectedChartEntities]);

    const matchingFilterCount = useMemo(() => {
        if (!activeProfile || !filterIndicator) return 0;
        const thresholdNum = parseFloat(String(filterMinValue));
        if (isNaN(thresholdNum) || thresholdNum <= 0) return activeProfile.length;
        return activeProfile.filter((r: any) => parseVal(r[filterIndicator]) >= thresholdNum).length;
    }, [activeProfile, filterIndicator, filterMinValue]);

    const handleTrainSOM = () => {
        if (!unit || selectedProfileIndicators.length === 0) return;
        if (!activeProfile || activeProfile.length === 0) {
            alert("No profile data available for this unit.");
            return;
        }

        // 1. Apply threshold filtering if active
        let candidateRows = [...activeProfile];
        const thresholdNum = parseFloat(String(filterMinValue));
        if (isFilterActive && filterIndicator && !isNaN(thresholdNum) && thresholdNum > 0) {
            candidateRows = candidateRows.filter((r: any) => {
                const val = parseVal(r[filterIndicator]);
                return val >= thresholdNum;
            });
        }

        if (candidateRows.length === 0) {
            alert(`No entities match the filter criteria (${filterIndicator} >= ${filterMinValue}).`);
            return;
        }

        // 2. Apply Top 50 limit if checked
        const finalRows = limitTop50 ? candidateRows.slice(0, 50) : candidateRows;

        let csvContent = "Entity," + selectedProfileIndicators.join(",") + "\n";
        finalRows.forEach((row: any) => {
            const rowData = [
                `"${row.entity}"`,
                ...selectedProfileIndicators.map((ind: string) => row[ind] ?? 0)
            ];
            csvContent += rowData.join(",") + "\n";
        });

        const filterDescription = isFilterActive && filterIndicator && !isNaN(thresholdNum) && thresholdNum > 0
            ? `Filtered (${filterIndicator} >= ${thresholdNum})`
            : 'All entities';

        loadCsvData(csvContent, 0, [], 'csv', `${unitName}_Profile`, {
            originType: 'tlachia',
            unitName: unitName,
            subView: `Multidimensional Profile (${finalRows.length} entities)`,
            indicatorsCount: selectedProfileIndicators.length,
            indicatorsList: selectedProfileIndicators,
            smoothingInfo: `${filterDescription} | ${limitTop50 ? 'Max 50' : 'Unbounded'}`
        });
        setConfig({ method: 'batch', init: 'pca' });
        setActiveTab('multidimensional');
    };

    const handleTrainSOMEvo = () => {
        if (!unit?.profile_evolution || !unit.profile_evolution[evolutionSmoothing] || selectedProfileIndicators.length === 0) return;
        if (filteredEvoData.length === 0) {
            alert("No temporal trajectory rows match the selected entities.");
            return;
        }
        let csvContent = "Entity," + selectedProfileIndicators.join(",") + "\n";
        filteredEvoData.forEach((row: any) => {
            const rowData = [
                `"${row.entity}"`,
                ...selectedProfileIndicators.map((ind: string) => row[ind] ?? 0)
            ];
            csvContent += rowData.join(",") + "\n";
        });
        loadCsvData(csvContent, 0, [], 'csv', `${unitName}_TemporalEvolution`, {
            originType: 'tlachia',
            unitName: unitName,
            subView: `Temporal Evolution (${temporalSelectedEntities.length} entities · ${filteredEvoData.length} rows)`,
            indicatorsCount: selectedProfileIndicators.length,
            indicatorsList: selectedProfileIndicators,
            smoothingInfo: `${evolutionSmoothing.toUpperCase()} | ${temporalSelectedEntities.length} entities`
        });
        setConfig({ method: 'batch', init: 'pca' });
        setActiveTab('multidimensional');
    };

    const handleTrainSOMQuartiles = () => {
        if (!unit || !activeQuartiles || activeQuartiles.length === 0) {
            alert("No quartile data available to train SOM.");
            return;
        }

        // 1. Filter entities from activeQuartiles using the active threshold filter on activeProfile
        let candidateRows = [...activeQuartiles];
        const thresholdNum = parseFloat(String(filterMinValue));
        if (isFilterActive && filterIndicator && !isNaN(thresholdNum) && thresholdNum > 0 && activeProfile) {
            const matchingEntities = new Set(
                activeProfile
                    .filter((r: any) => parseVal(r[filterIndicator]) >= thresholdNum)
                    .map((r: any) => String(r.entity))
            );
            candidateRows = candidateRows.filter((q: any) => matchingEntities.has(String(q.entity)));
        }

        if (candidateRows.length === 0) {
            alert(`No entities match the filter criteria (${filterIndicator} >= ${filterMinValue}).`);
            return;
        }

        // 2. Apply Max 50 limit if enabled
        const finalRows = limitTop50 ? candidateRows.slice(0, 50) : candidateRows;

        let csvContent = "Entity,Q1,Q2,Q3,Q4\n";
        finalRows.forEach((row: any) => {
            const rowData = [
                `"${row.entity}"`,
                parseVal(row.Q1),
                parseVal(row.Q2),
                parseVal(row.Q3),
                parseVal(row.Q4)
            ];
            csvContent += rowData.join(",") + "\n";
        });

        const filterDescription = isFilterActive && filterIndicator && !isNaN(thresholdNum) && thresholdNum > 0
            ? `Filtered (${filterIndicator} >= ${thresholdNum})`
            : 'All entities';

        loadCsvData(csvContent, 0, [], 'csv', `${unitName}_Quartiles`, {
            originType: 'tlachia',
            unitName: unitName,
            subView: `Quartiles Q1-Q4 (${finalRows.length} entities)`,
            indicatorsCount: 4,
            indicatorsList: ['Q1', 'Q2', 'Q3', 'Q4'],
            smoothingInfo: `${filterDescription} | ${limitTop50 ? 'Max 50' : 'Unbounded'}`
        });
        setConfig({ method: 'batch', init: 'pca' });
        setActiveTab('multidimensional');
    };

    const bubbleChartData = useMemo(() => {
        if (!activeProfile || !bubbleIndX || !bubbleIndY || !bubbleIndSize || !bubbleIndColor) {
            return { points: [], minColor: 0, maxColor: 1, minSize: 0, maxSize: 1 };
        }

        const filtered = activeProfile.filter((r: any) => selectedChartEntities.includes(r.entity));
        if (filtered.length === 0) return { points: [], minColor: 0, maxColor: 1, minSize: 0, maxSize: 1 };

        let minColor = Infinity;
        let maxColor = -Infinity;
        let minSize = Infinity;
        let maxSize = -Infinity;

        const points = filtered.map((r: any) => {
            const x = parseVal(r[bubbleIndX]);
            const y = parseVal(r[bubbleIndY]);
            const size = parseVal(r[bubbleIndSize]);
            const colorVal = parseVal(r[bubbleIndColor]);

            if (colorVal < minColor) minColor = colorVal;
            if (colorVal > maxColor) maxColor = colorVal;
            if (size < minSize) minSize = size;
            if (size > maxSize) maxSize = size;

            return {
                entity: String(r.entity || ''),
                x,
                y,
                size,
                colorVal
            };
        });

        if (minColor === Infinity) minColor = 0;
        if (maxColor === -Infinity || maxColor === minColor) maxColor = minColor + 1;
        if (minSize === Infinity) minSize = 0;
        if (maxSize === -Infinity || maxSize === minSize) maxSize = minSize + 1;

        const colorScale = chroma.scale(['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921']).domain([minColor, maxColor]);

        const minR = 6;
        const maxR = 26;

        const pointsWithColorAndRadius = points.map((p: any) => {
            let normSize = 0.5;
            if (maxSize > minSize) {
                normSize = (p.size - minSize) / (maxSize - minSize);
            }
            const radius = minR + Math.sqrt(Math.max(0, normSize)) * (maxR - minR);

            return {
                ...p,
                bubbleRadius: radius,
                fillColor: (colorScale(p.colorVal) as any).hex()
            };
        });

        return {
            points: pointsWithColorAndRadius,
            minColor,
            maxColor,
            minSize,
            maxSize,
            colorScale
        };
    }, [activeProfile, selectedChartEntities, bubbleIndX, bubbleIndY, bubbleIndSize, bubbleIndColor]);

    const handleTrainSOMBubble = () => {
        if (!unit || !activeProfile || activeProfile.length === 0) {
            alert("No profile data available to train SOM.");
            return;
        }
        const rawIndicators = [bubbleIndX, bubbleIndY, bubbleIndSize, bubbleIndColor];
        if (rawIndicators.some(ind => !ind)) {
            alert("Please select all 4 indicators for the 4D Bubble Chart.");
            return;
        }

        // 1. Filter entities from activeProfile using the active threshold filter
        let candidateRows = [...activeProfile];
        const thresholdNum = parseFloat(String(filterMinValue));
        if (isFilterActive && filterIndicator && !isNaN(thresholdNum) && thresholdNum > 0) {
            candidateRows = candidateRows.filter((r: any) => parseVal(r[filterIndicator]) >= thresholdNum);
        }

        if (candidateRows.length === 0) {
            alert(`No entities match the filter criteria (${filterIndicator} >= ${filterMinValue}).`);
            return;
        }

        // 2. Apply Max 50 limit if enabled
        const finalRows = limitTop50 ? candidateRows.slice(0, 50) : candidateRows;

        // Disambiguate column names if two dropdowns have the same indicator name
        const colNames = rawIndicators.map((ind, idx) => {
            const prevCount = rawIndicators.slice(0, idx).filter(x => x === ind).length;
            return prevCount > 0 ? `${ind} (${idx === 1 ? 'Y' : idx === 2 ? 'Size' : 'Color'})` : ind;
        });

        let csvContent = "Entity," + colNames.join(",") + "\n";
        finalRows.forEach((row: any) => {
            const rowData = [
                `"${row.entity}"`,
                ...rawIndicators.map(ind => parseVal(row[ind]))
            ];
            csvContent += rowData.join(",") + "\n";
        });

        const filterDescription = isFilterActive && filterIndicator && !isNaN(thresholdNum) && thresholdNum > 0
            ? `Filtered (${filterIndicator} >= ${thresholdNum})`
            : 'All entities';

        loadCsvData(csvContent, 0, [], 'csv', `${unitName}_4DBubble`, {
            originType: 'tlachia',
            unitName: unitName,
            subView: `4D Bubble Chart (${finalRows.length} entities)`,
            indicatorsCount: 4,
            indicatorsList: colNames,
            smoothingInfo: `${filterDescription} | ${limitTop50 ? 'Max 50' : 'Unbounded'}`
        });
        setConfig({ method: 'batch', init: 'pca' });
        setActiveTab('multidimensional');
    };

    // Auto-select Top 3 for Radar Chart default comparison
    useEffect(() => {
        if (selectedChartEntities && selectedChartEntities.length > 0) {
            setRadarEntities(prev => {
                if (prev.length === 0) return selectedChartEntities.slice(0, 3);
                return prev.filter(e => selectedChartEntities.includes(e));
            });
        }
    }, [selectedChartEntities]);

    // 1. Radar Chart Data Hook
    const radarChartData = useMemo(() => {
        if (!activeProfile || selectedProfileIndicators.length === 0 || radarEntities.length === 0) return [];
        
        const statsMap: { [ind: string]: { min: number; max: number } } = {};
        selectedProfileIndicators.forEach(ind => {
            let min = Infinity;
            let max = -Infinity;
            activeProfile.forEach((r: any) => {
                const v = parseVal(r[ind]);
                if (v < min) min = v;
                if (v > max) max = v;
            });
            if (min === Infinity) min = 0;
            if (max === -Infinity || max === min) max = min + 1;
            statsMap[ind] = { min, max };
        });

        return selectedProfileIndicators.map(ind => {
            const row: any = { indicator: ind };
            const { max } = statsMap[ind];
            radarEntities.forEach(ent => {
                const entityRow = activeProfile.find((r: any) => String(r.entity) === ent);
                const rawV = entityRow ? parseVal(entityRow[ind]) : 0;
                const normV = max > 0 ? Math.round((rawV / max) * 100) : 0;
                row[ent] = normV;
                row[`${ent}_raw`] = rawV;
            });
            return row;
        });
    }, [activeProfile, selectedProfileIndicators, radarEntities]);

    // 2. Heatmap Matrix Data Hook
    const heatmapMatrixData = useMemo(() => {
        if (!activeProfile || selectedProfileIndicators.length === 0) return { rows: [], stats: {} };
        const filtered = activeProfile.filter((r: any) => selectedChartEntities.includes(r.entity));
        if (filtered.length === 0) return { rows: [], stats: {} };

        const stats: { [ind: string]: { min: number; max: number } } = {};
        selectedProfileIndicators.forEach(ind => {
            let min = Infinity;
            let max = -Infinity;
            filtered.forEach((r: any) => {
                const v = parseVal(r[ind]);
                if (v < min) min = v;
                if (v > max) max = v;
            });
            if (min === Infinity) min = 0;
            if (max === -Infinity || max === min) max = min + 1;
            stats[ind] = { min, max };
        });

        const colorScales: { [ind: string]: any } = {};
        selectedProfileIndicators.forEach(ind => {
            const { min, max } = stats[ind];
            colorScales[ind] = chroma.scale(['#0f172a', '#1e3a8a', '#2563eb', '#06b6d4', '#10b981', '#facc15']).domain([min, max]);
        });

        const rows = filtered.map((r: any) => {
            const cells: { [ind: string]: { val: number; color: string; textColor: string } } = {};
            selectedProfileIndicators.forEach(ind => {
                const val = parseVal(r[ind]);
                const bg = colorScales[ind](val).hex();
                const textColor = chroma(bg).luminance() > 0.45 ? '#090d16' : '#ffffff';
                cells[ind] = {
                    val,
                    color: bg,
                    textColor
                };
            });
            return {
                entity: String(r.entity),
                cells
            };
        });

        return { rows, stats };
    }, [activeProfile, selectedChartEntities, selectedProfileIndicators]);

    // 2b. Temporal Heatmap Matrix Data Hook
    const temporalHeatmapMatrixData = useMemo(() => {
        if (!filteredEvoData || filteredEvoData.length === 0 || selectedProfileIndicators.length === 0) {
            return { rows: [], stats: {} };
        }

        const stats: { [ind: string]: { min: number; max: number } } = {};
        selectedProfileIndicators.forEach(ind => {
            let min = Infinity;
            let max = -Infinity;
            filteredEvoData.forEach((r: any) => {
                const v = parseVal(r[ind]);
                if (v < min) min = v;
                if (v > max) max = v;
            });
            if (min === Infinity) min = 0;
            if (max === -Infinity || max === min) max = min + 1;
            stats[ind] = { min, max };
        });

        const colorScales: { [ind: string]: any } = {};
        selectedProfileIndicators.forEach(ind => {
            const { min, max } = stats[ind];
            colorScales[ind] = chroma.scale(['#0f172a', '#1e3a8a', '#2563eb', '#06b6d4', '#10b981', '#facc15']).domain([min, max]);
        });

        const rows = filteredEvoData.slice(0, 100).map((r: any) => {
            const cells: { [ind: string]: { val: number; color: string; textColor: string } } = {};
            selectedProfileIndicators.forEach(ind => {
                const val = parseVal(r[ind]);
                const bg = colorScales[ind](val).hex();
                const textColor = chroma(bg).luminance() > 0.45 ? '#090d16' : '#ffffff';
                cells[ind] = {
                    val,
                    color: bg,
                    textColor
                };
            });
            return {
                entity: String(r.entity),
                cells
            };
        });

        return { rows, stats };
    }, [filteredEvoData, selectedProfileIndicators]);

    // 3. Stacked Area Chart Data Hook
    const stackedAreaData = useMemo(() => {
        if (!unit?.time_series || !tsIndicator || !unit.time_series[tsIndicator]) return [];
        const rawSeries: any[] = unit.time_series[tsIndicator];
        const filteredSeries = rawSeries.filter((s: any) => selectedChartEntities.includes(s.entity));
        if (filteredSeries.length === 0) return [];

        const timeSet = new Set<string>();
        filteredSeries.forEach((s: any) => s.times?.forEach((t: string) => timeSet.add(t)));
        const times = Array.from(timeSet).sort();

        return times.map(t => {
            const point: any = { time: t };
            let yearTotal = 0;
            filteredSeries.forEach((s: any) => {
                const idx = s.times?.indexOf(t);
                const val = (idx !== undefined && idx >= 0 && s[tsSmoothing]) ? s[tsSmoothing][idx] : 0;
                point[s.entity] = val || 0;
                yearTotal += (val || 0);
            });

            if (areaMode === 'percentage' && yearTotal > 0) {
                filteredSeries.forEach((s: any) => {
                    point[s.entity] = parseFloat(((point[s.entity] / yearTotal) * 100).toFixed(2));
                });
            }
            return point;
        });
    }, [unit, tsIndicator, tsSmoothing, selectedChartEntities, areaMode]);

    // 4. CAGR Scatter Plot Data Hook
    const cagrScatterData = useMemo(() => {
        if (!unit?.time_series || !tsIndicator || !unit.time_series[tsIndicator]) return { points: [], medianVolume: 0, medianCagr: 0 };
        const rawSeries: any[] = unit.time_series[tsIndicator];
        const filteredSeries = rawSeries.filter((s: any) => selectedChartEntities.includes(s.entity));
        if (filteredSeries.length === 0) return { points: [], medianVolume: 0, medianCagr: 0 };

        const points = filteredSeries.map((s: any) => {
            const vals: number[] = s[tsSmoothing] || [];
            const times: string[] = s.times || [];
            if (!vals || vals.length < 2) return null;

            const firstVal = vals[0] || 0.0001;
            const lastVal = vals[vals.length - 1] || 0;
            const yearsCount = vals.length;

            let cagr = 0;
            if (firstVal > 0 && lastVal > 0 && yearsCount > 1) {
                cagr = (Math.pow(lastVal / firstVal, 1 / (yearsCount - 1)) - 1) * 100;
            }

            return {
                entity: String(s.entity),
                volume: lastVal,
                cagr: parseFloat(cagr.toFixed(2)),
                startYear: times[0] || '',
                endYear: times[times.length - 1] || ''
            };
        }).filter(Boolean);

        if (points.length === 0) return { points: [], medianVolume: 0, medianCagr: 0 };

        const volumes = points.map((p: any) => p.volume).sort((a, b) => a - b);
        const cagrs = points.map((p: any) => p.cagr).sort((a, b) => a - b);
        const midIdx = Math.floor(points.length / 2);
        const medianVolume = volumes[midIdx] || 0;
        const medianCagr = cagrs[midIdx] || 0;

        return { points, medianVolume, medianCagr };
    }, [unit, tsIndicator, tsSmoothing, selectedChartEntities]);

    // Build chart data for time series
    const { tsChartData, tsEntities, totalEntities } = useMemo(() => {
        if (!unit?.time_series || !tsIndicator || !unit.time_series[tsIndicator]) {
            return { tsChartData: [], tsEntities: [], totalEntities: 0 };
        }
        const rawSeries: any[] = unit.time_series[tsIndicator];
        if (!rawSeries || rawSeries.length === 0) {
            return { tsChartData: [], tsEntities: [], totalEntities: 0 };
        }

        // Filter by selected entities
        const topSeries = rawSeries.filter((series: any) => selectedChartEntities.includes(series.entity));

        // Pivot to recharts format: [{time: '2020', EntityA: 5, EntityB: 3}, ...]
        const timeSet = new Set<string>();
        topSeries.forEach((s: any) => s.times?.forEach((t: string) => timeSet.add(t)));
        const times = Array.from(timeSet).sort();

        const chartData = times.map(t => {
            const point: any = { time: t };
            topSeries.forEach((s: any) => {
                const idx = s.times?.indexOf(t);
                point[s.entity] = (idx !== undefined && idx >= 0 && s[tsSmoothing]) ? s[tsSmoothing][idx] : null;
            });
            return point;
        });

        return {
            tsChartData: chartData,
            tsEntities: topSeries.map((s: any) => s.entity),
            totalEntities: rawSeries.length
        };
    }, [unit, tsIndicator, tsSmoothing, selectedChartEntities]);

    const colors = ['#818cf8', '#34d399', '#f87171', '#fbbf24', '#c084fc', '#2dd4bf', '#fb923c', '#f472b6',
        '#60a5fa', '#a78bfa', '#4ade80', '#facc15', '#f97316', '#ec4899', '#22d3ee', '#84cc16'];

    const dynamicChartHeight = Math.max(420, selectedChartEntities.length * 25);

    return (
        <div className="flex flex-col h-full space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Controls Sidebar with Tabs */}
                <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden">
                    {/* Tab Headers */}
                    <div className="flex border-b border-gray-800 shrink-0 p-1.5 gap-1.5 bg-gray-950">
                        <button
                            onClick={() => setSidebarTab('profiles')}
                            className={`flex-1 py-2 px-2 text-[11px] font-bold rounded-xl transition-all border ${
                                sidebarTab === 'profiles'
                                    ? 'bg-cyan-950/70 text-cyan-400 border-cyan-500/80 shadow-md shadow-cyan-950/50'
                                    : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:bg-gray-800/80'
                            }`}
                        >
                            <span className="flex items-center justify-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full ${sidebarTab === 'profiles' ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`} />
                                <span>Multidimensional Profiles</span>
                            </span>
                        </button>
                        <button
                            onClick={() => setSidebarTab('temporal')}
                            className={`flex-1 py-2 px-2 text-[11px] font-bold rounded-xl transition-all border ${
                                sidebarTab === 'temporal'
                                    ? 'bg-purple-950/70 text-purple-400 border-purple-500/80 shadow-md shadow-purple-950/50'
                                    : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:bg-gray-800/80'
                            }`}
                        >
                            <span className="flex items-center justify-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full ${sidebarTab === 'temporal' ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'}`} />
                                <span>Temporal Analysis</span>
                            </span>
                        </button>
                        <button
                            onClick={() => setSidebarTab('longitudinal')}
                            className={`flex-1 py-2 px-2 text-[11px] font-bold rounded-xl transition-all border ${
                                sidebarTab === 'longitudinal'
                                    ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/80 shadow-md shadow-emerald-950/50'
                                    : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:bg-gray-800/80'
                            }`}
                        >
                            <span className="flex items-center justify-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full ${sidebarTab === 'longitudinal' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                                <span>Longitudinal</span>
                            </span>
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex flex-col flex-1 space-y-4 p-4 overflow-y-auto">

                        {/* ── 1. PERIOD TOGGLE (Top-most control) ──────────────── */}
                        {sidebarTab === 'profiles' && (
                            <div className="flex items-center space-x-3 p-3 bg-gray-950 rounded-xl border border-gray-800">
                                <input
                                    type="checkbox"
                                    id="useRecentData"
                                    className="w-4 h-4 text-cyan-600 bg-gray-900 border-gray-700 rounded focus:ring-cyan-600 focus:ring-2 cursor-pointer"
                                    checked={useRecent}
                                    onChange={(e) => setUseRecent(e.target.checked)}
                                    disabled={!hasRecentData}
                                />
                                <div>
                                    <label htmlFor="useRecentData" className={`text-sm font-bold block ${hasRecentData ? 'text-gray-200 cursor-pointer' : 'text-gray-600 cursor-not-allowed'}`}>
                                        Use 2021-2025 Data
                                    </label>
                                    <p className="text-[10px] text-gray-500">
                                        {hasRecentData ? 'Applies to Profile, Quartiles, and Sunburst.' : 'No 2021-2025 file uploaded.'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── 2. GLOBAL CHART ENTITIES SELECTOR ───────────────────── */}
                        <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                            <button
                                onClick={() => setIsEntityExpanded(!isEntityExpanded)}
                                className="w-full flex items-center justify-between text-left group bg-transparent border-0 cursor-pointer"
                            >
                                <div>
                                    <h3 className="text-sm font-bold text-gray-200 group-hover:text-blue-400 transition-colors">Chart Entities</h3>
                                    <p className="text-[10px] text-gray-400">
                                        <span className="text-cyan-400 font-bold">{selectedChartEntities.length} selected</span> (for charts & table)
                                    </p>
                                </div>
                                {isEntityExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                            </button>
                            
                            {isEntityExpanded && (
                                <div className="mt-3 space-y-3 pt-3 border-t border-gray-800/50">
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Top N Limit</label>
                                        <div className="flex space-x-1">
                                            {([10, 25, 50, 'all'] as const).map(lim => (
                                                <button
                                                    key={lim}
                                                    onClick={() => setEntityLimit(lim)}
                                                    className={`flex-1 py-1 text-[10px] rounded transition-colors font-medium border ${entityLimit === lim ? 'bg-cyan-900/50 text-cyan-400 border-cyan-700' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'}`}
                                                >
                                                    {lim === 'all' ? 'All' : lim}
                                                </button>
                                            ))}
                                            <button
                                                disabled
                                                className={`flex-1 py-1 text-[10px] rounded transition-colors font-medium border ${entityLimit === 'custom' ? 'bg-orange-900/50 text-orange-400 border-orange-700' : 'bg-gray-900 text-gray-600 border-gray-800'}`}
                                            >
                                                Custom
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Sort by</label>
                                        <select
                                            value={entitySortBy}
                                            onChange={e => setEntitySortBy(e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[11px] text-gray-200"
                                        >
                                            {unit.indicators?.map((ind: string) => (
                                                <option key={ind} value={ind}>{ind}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="flex flex-col space-y-1 pt-2 border-t border-gray-800/50">
                                        <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Select Entities</label>
                                        <div className="max-h-48 overflow-y-auto pr-1 space-y-1 custom-scrollbar bg-gray-900 rounded p-1">
                                            {unit.profile?.map((r: any) => r.entity).sort().map((ent: string) => (
                                                <button
                                                    key={ent}
                                                    onClick={() => toggleChartEntity(ent)}
                                                    className={`flex items-center space-x-2 text-[11px] w-full text-left p-1 rounded transition border-0 ${selectedChartEntities.includes(ent) ? 'bg-blue-600/20 text-gray-200' : 'hover:bg-gray-800 text-gray-500'}`}
                                                >
                                                    {selectedChartEntities.includes(ent) ? <CheckSquare size={12} className="text-blue-400 shrink-0" /> : <Square size={12} className="opacity-50 shrink-0" />}
                                                    <span className={`truncate ${selectedChartEntities.includes(ent) ? 'text-gray-200' : 'text-gray-500'}`} title={ent}>
                                                        {ent}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── 3. PROFILES TAB ───────────────────────────── */}
                        {sidebarTab === 'profiles' && (<>
                            {/* Multidimensional Profile Expander (Indicators + Filter for SOM) */}
                            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                                <button
                                    onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                                    className="w-full flex items-center justify-between text-left group bg-transparent border-0 cursor-pointer"
                                >
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200 group-hover:text-cyan-400 transition-colors flex items-center space-x-2">
                                            <span>Multidimensional Profile</span>
                                            {isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0 && (
                                                <span className="px-1.5 py-0.5 bg-indigo-950 text-cyan-300 border border-cyan-500/50 text-[9px] font-bold rounded">
                                                    ≥ {filterMinValue}
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-[10px] text-gray-500">Select indicators & filter units for SOM.</p>
                                    </div>
                                    {isProfileExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                </button>

                                {isProfileExpanded && (
                                    <div className="mt-3 space-y-3 pt-3 border-t border-gray-800/50">
                                        {/* Indicators Checkboxes */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
                                                Profile Indicators ({selectedProfileIndicators.length} selected)
                                            </label>
                                            <div className="max-h-44 overflow-y-auto space-y-1 pr-1 bg-gray-900 p-1.5 rounded-lg border border-gray-800 custom-scrollbar">
                                                {unit.indicators?.map((ind: string) => (
                                                    <button
                                                        key={ind}
                                                        onClick={() => toggleProfileIndicator(ind)}
                                                        className={`flex items-center space-x-2 text-xs w-full text-left p-1.5 rounded transition border-0 cursor-pointer ${selectedProfileIndicators.includes(ind)
                                                                ? 'bg-gray-800 text-gray-200'
                                                                : 'bg-transparent hover:bg-gray-800 text-gray-400'
                                                            }`}
                                                    >
                                                        {selectedProfileIndicators.includes(ind)
                                                            ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                            : <Square className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                                                        }
                                                        <span className="truncate" title={ind}>{ind}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Filter Units for SOM Controls (Nested inside Expander) */}
                                        <div className="bg-gray-900/90 p-3 rounded-xl border border-gray-800 space-y-2.5 shadow-inner">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <div className="p-1 bg-indigo-950 border border-cyan-500/50 rounded text-cyan-400">
                                                        <Filter className="w-3 h-3" />
                                                    </div>
                                                    <h4 className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Filter Units for SOM</h4>
                                                </div>
                                                {isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setTlachiaState({ tlachiaFilterMinValue: '', tlachiaIsFilterActive: false })}
                                                        className="text-[10px] text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>

                                            {/* Filter Indicator Dropdown */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filter Indicator:</label>
                                                <select
                                                    value={filterIndicator}
                                                    onChange={(e) => setTlachiaState({ tlachiaFilterIndicator: e.target.value })}
                                                    className="w-full bg-gray-950 border border-gray-700 focus:border-cyan-500 rounded-lg px-2 py-1 text-[11px] text-gray-200 focus:outline-none cursor-pointer truncate"
                                                >
                                                    {unit.indicators?.map((ind: string) => (
                                                        <option key={ind} value={ind}>{ind}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Minimum Threshold Input & Presets */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Minimum Threshold (≥):</label>
                                                    {matchingFilterCount !== undefined && (
                                                        <span className="text-[10px] font-mono font-bold text-emerald-400">
                                                            {matchingFilterCount} / {activeProfile?.length || 0} units
                                                        </span>
                                                    )}
                                                </div>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    placeholder="e.g. 10"
                                                    value={filterMinValue}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const hasVal = val !== '' && Number(val) > 0;
                                                        setTlachiaState({
                                                            tlachiaFilterMinValue: val,
                                                            tlachiaIsFilterActive: hasVal,
                                                            tlachiaLimitTop50: hasVal ? false : limitTop50
                                                        });
                                                    }}
                                                    className="w-full bg-gray-950 border border-gray-700 focus:border-cyan-500 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none"
                                                />

                                                {/* Quick Presets */}
                                                <div className="flex items-center space-x-1 pt-0.5 flex-wrap gap-y-1">
                                                    <span className="text-[9px] text-gray-500 font-bold uppercase mr-1">Presets:</span>
                                                    {[5, 10, 25, 50, 100].map((val) => (
                                                        <button
                                                            key={val}
                                                            type="button"
                                                            onClick={() => {
                                                                setTlachiaState({
                                                                    tlachiaFilterMinValue: val,
                                                                    tlachiaIsFilterActive: true,
                                                                    tlachiaLimitTop50: false
                                                                });
                                                            }}
                                                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition border cursor-pointer ${
                                                                Number(filterMinValue) === val
                                                                    ? 'bg-cyan-600 text-white border-cyan-500'
                                                                    : 'bg-gray-950 hover:bg-gray-800 text-gray-300 border-gray-700'
                                                            }`}
                                                        >
                                                            ≥ {val}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Heatmap Matrix Card */}
                            {heatmapMatrixData.rows.length > 0 && (
                                <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden mt-3 relative">
                                    <div className="p-3 border-b border-gray-800 flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200 flex items-center space-x-2 flex-wrap gap-1">
                                                <span>Heatmap Matrix</span>
                                                <span className="text-gray-500 font-normal text-xs">
                                                    ({heatmapMatrixData.rows.length} entities)
                                                </span>
                                                {isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0 && (
                                                    <span className="px-2 py-0.5 bg-indigo-950/80 border border-cyan-500/60 text-cyan-300 text-[10px] font-bold rounded-lg flex items-center space-x-1">
                                                        <Filter className="w-2.5 h-2.5" />
                                                        <span className="truncate max-w-[150px]">{filterIndicator} ≥ {filterMinValue}</span>
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-[10px] text-gray-400 font-medium">Min-Max column normalization [0 to 1].</p>
                                        </div>

                                        {/* SOM Training Controls: Filter + Max 50 Checkbox + Train SOM Button */}
                                        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                                            {/* Filter Trigger Button */}
                                            <button
                                                type="button"
                                                onClick={() => setIsFilterModalOpen(true)}
                                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 cursor-pointer ${
                                                    isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0
                                                        ? 'bg-indigo-900/60 text-cyan-300 border-cyan-500/80 shadow-md shadow-indigo-950'
                                                        : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
                                                }`}
                                                title="Filter entities by minimum threshold on any indicator (e.g. Web of Science Documents >= 10)"
                                            >
                                                <Filter className="w-3.5 h-3.5" />
                                                <span>{isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0 ? `Filter: ≥ ${filterMinValue}` : 'Filter Units'}</span>
                                            </button>

                                            {/* Limit Top 50 Checkbox */}
                                            <label 
                                                className="flex items-center space-x-1.5 text-xs text-gray-300 cursor-pointer select-none bg-gray-900/80 px-2.5 py-1.5 rounded-xl border border-gray-800 hover:border-gray-700" 
                                                title="Send at most 50 entities to Train SOM (Default: Active)"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={limitTop50}
                                                    onChange={(e) => setTlachiaState({ tlachiaLimitTop50: e.target.checked })}
                                                    className="w-3.5 h-3.5 bg-gray-950 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
                                                />
                                                <span className="font-semibold text-gray-200 text-[11px]">Max 50</span>
                                            </label>

                                            {/* Train SOM Button */}
                                            <button
                                                type="button"
                                                onClick={handleTrainSOM}
                                                disabled={selectedProfileIndicators.length === 0}
                                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-900/40 transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                                                title={`Train SOM with ${limitTop50 ? 'up to 50' : 'all'} filtered entities`}
                                            >
                                                <Activity className="w-3.5 h-3.5" />
                                                <span>Train SOM</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto max-h-72 custom-scrollbar">
                                        <table className="w-full text-[10px] border-collapse">
                                            <thead className="sticky top-0 bg-gray-950 border-b border-gray-800 shadow-sm">
                                                <tr>
                                                    <th className="text-left px-2 py-2 text-gray-400 font-semibold whitespace-nowrap bg-gray-950">Entity</th>
                                                    {selectedProfileIndicators.map(ind => (
                                                        <th key={ind} className="text-right px-2 py-2 text-gray-400 font-semibold whitespace-nowrap truncate max-w-[100px] bg-gray-950" title={ind}>
                                                            {ind}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-900">
                                                {heatmapMatrixData.rows.map((row: any, i: number) => (
                                                    <tr key={i} className="hover:opacity-90 transition-opacity">
                                                        <td className="px-2 py-1.5 text-gray-300 font-medium max-w-[130px] truncate bg-gray-950" title={row.entity}>
                                                            {row.entity}
                                                        </td>
                                                        {selectedProfileIndicators.map((ind: string) => {
                                                            const cell = row.cells[ind];
                                                            return (
                                                                <td
                                                                    key={ind}
                                                                    className="px-2 py-1.5 text-right font-bold transition-colors"
                                                                    style={{
                                                                        backgroundColor: cell?.color || '#0f172a',
                                                                        color: cell?.textColor || '#ffffff'
                                                                    }}
                                                                    title={`${row.entity} - ${ind}: ${cell?.val}`}
                                                                >
                                                                    {typeof cell?.val === 'number' ? cell.val.toFixed(2) : cell?.val ?? '-'}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}


                        </>)}

                        {/* ── TEMPORAL ANALYSIS TAB ─────────────────── */}
                        {sidebarTab === 'temporal' && (<>
                            {unit.profile_evolution && unit.profile_evolution[evolutionSmoothing] && unit.profile_evolution[evolutionSmoothing].length > 0 ? (<>
                                {/* Header row: title + Hide zeros */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200">Temporal Smoothing</h3>
                                        <p className="text-[10px] text-gray-500">{filteredEvoData.length} active trajectory rows</p>
                                    </div>
                                    <label className="flex items-center space-x-1.5 cursor-pointer" title="Hide rows where all selected indicators are zero">
                                        <input
                                            type="checkbox"
                                            checked={filterEvoZeros}
                                            onChange={e => setFilterEvoZeros(e.target.checked)}
                                            className="w-3.5 h-3.5 text-cyan-600 bg-gray-900 border-gray-700 rounded focus:ring-cyan-600 cursor-pointer"
                                        />
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap">Hide zeros</span>
                                    </label>
                                </div>

                                {/* Smoothing buttons */}
                                <div className="flex space-x-1">
                                    {(['raw', 'ecma3', 'ecma5'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setEvolutionSmoothing(mode)}
                                            className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                                                evolutionSmoothing === mode ? 'bg-cyan-600 text-white shadow' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
                                            }`}
                                        >
                                            {mode.toUpperCase()}
                                        </button>
                                    ))}
                                </div>

                                {/* ── TEMPORAL SOM ENTITIES SELECTOR (Ranked) ─────────── */}
                                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-3 mt-2">
                                    <button
                                        onClick={() => setIsTemporalEntitiesExpanded(!isTemporalEntitiesExpanded)}
                                        className="w-full flex items-center justify-between text-left group bg-transparent border-0 cursor-pointer"
                                    >
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200 group-hover:text-purple-400 transition-colors flex items-center space-x-2">
                                                <span>Temporal SOM Entities</span>
                                                <span className="px-1.5 py-0.5 bg-purple-950 text-purple-300 border border-purple-500/50 text-[9px] font-bold rounded">
                                                    {temporalSelectedEntities.length} entities
                                                </span>
                                            </h3>
                                            <p className="text-[10px] text-gray-500">{filteredEvoData.length} trajectory rows in total</p>
                                        </div>
                                        {isTemporalEntitiesExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                    </button>

                                    {isTemporalEntitiesExpanded && (
                                        <div className="space-y-3 pt-2 border-t border-gray-800/50">
                                            {/* Quick Limit Buttons */}
                                            <div className="flex flex-col space-y-1">
                                                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Top Entities (Temporal Rank)</label>
                                                <div className="flex space-x-1">
                                                    {([3, 4, 5, 10, 'all'] as const).map(lim => (
                                                        <button
                                                            key={lim}
                                                            type="button"
                                                            onClick={() => setTemporalEntityLimit(lim)}
                                                            className={`flex-1 py-1 text-[10px] rounded-lg transition-colors font-medium border cursor-pointer ${
                                                                temporalEntityLimit === lim
                                                                    ? 'bg-purple-900/70 text-purple-300 border-purple-500 shadow-sm'
                                                                    : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'
                                                            }`}
                                                        >
                                                            {lim === 'all' ? 'All' : `Top ${lim}`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Entity Selection Checklist */}
                                            <div className="flex flex-col space-y-1">
                                                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Select Entities (Ranked)</label>
                                                <div className="max-h-48 overflow-y-auto pr-1 space-y-1 custom-scrollbar bg-gray-900 rounded-lg p-1.5 border border-gray-800">
                                                    {evoUniqueEntities.map((ent: string, idx: number) => (
                                                        <button
                                                            key={ent}
                                                            type="button"
                                                            onClick={() => toggleTemporalEntity(ent)}
                                                            className={`flex items-center space-x-2 text-[11px] w-full text-left p-1.5 rounded transition border-0 cursor-pointer ${
                                                                temporalSelectedEntities.includes(ent) ? 'bg-purple-600/20 text-gray-200' : 'hover:bg-gray-800 text-gray-500'
                                                            }`}
                                                        >
                                                            {temporalSelectedEntities.includes(ent)
                                                                ? <CheckSquare size={12} className="text-purple-400 shrink-0" />
                                                                : <Square size={12} className="opacity-50 shrink-0" />
                                                            }
                                                            <span className="text-[10px] text-gray-500 font-mono w-4 shrink-0">{idx + 1}.</span>
                                                            <span className="truncate" title={ent}>{ent}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>) : (
                                <div className="flex flex-col items-center justify-center h-40 text-center text-gray-600">
                                    <Activity className="w-8 h-8 mb-2 opacity-30" />
                                    <p className="text-xs">No temporal evolution data available.<br/>Upload a Trend file to enable this tab.</p>
                                </div>
                            )}
                        </>)}

                        {/* ── LONGITUDINAL TAB CONTROLS ─────────────── */}
                        {sidebarTab === 'longitudinal' && (<>
                            {/* Primary Action Button: Send to Longitudinal SOM */}
                            <div className="p-3 bg-gradient-to-br from-emerald-950/60 to-gray-950 rounded-xl border border-emerald-500/40 flex flex-col space-y-2">
                                <div className="flex items-center space-x-2 text-emerald-400">
                                    <Zap className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">SOM & UMAP Engine</span>
                                </div>
                                <p className="text-[11px] text-gray-400">
                                    Transfiere la serie multitemporal de matrices al Módulo Longitudinal con encadenamiento Warm-Start.
                                </p>
                                <button
                                    onClick={() => {
                                        const isAll = selectedLongiEntities.length === 0 || selectedLongiEntities.length === longiEntities.length;
                                        sendTlachiaToLongitudinalSom(
                                            unitName,
                                            unit?.longitudinal,
                                            isAll ? undefined : selectedLongiEntities
                                        );
                                    }}
                                    disabled={!unit?.longitudinal?.has_longitudinal || (longiEntities.length > 0 && selectedLongiEntities.length === 0)}
                                    className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/60 transition flex items-center justify-center space-x-2 border border-emerald-400/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <Zap className="w-3.5 h-3.5 fill-current" />
                                    <span>
                                        {selectedLongiEntities.length === longiEntities.length || selectedLongiEntities.length === 0
                                            ? `Enviar a SOM & UMAP (Todas las ${longiEntities.length || ''})`
                                            : `Enviar a SOM & UMAP (${selectedLongiEntities.length} Entidades)`}
                                    </span>
                                </button>
                            </div>

                            {unit?.longitudinal?.has_longitudinal ? (<>
                                {/* Indicator Selector */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-400">Indicador Longitudinal:</label>
                                    <select
                                        value={longiIndicator}
                                        onChange={(e) => setLongiIndicator(e.target.value)}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                                    >
                                        {longiIndicators.map((ind: string) => (
                                            <option key={ind} value={ind}>{ind}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Delta Indicator Selector */}
                                {longiDeltaIndicators.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-400">Tasa de Cambio (Δ):</label>
                                        <select
                                            value={longiDeltaIndicator}
                                            onChange={(e) => setLongiDeltaIndicator(e.target.value)}
                                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                                        >
                                            {longiDeltaIndicators.map((dind: string) => (
                                                <option key={dind} value={dind}>{dind}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Quadrant Period Selectors */}
                                {unit.longitudinal.periods?.length >= 2 && (
                                    <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 space-y-2">
                                        <label className="text-xs font-semibold text-gray-400 block">Comparativa Cuadrantes (TA → TB):</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="text-[10px] text-gray-500 block mb-1">Periodo TA</span>
                                                <select
                                                    value={longiPeriodA}
                                                    onChange={(e) => setLongiPeriodA(e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-[11px] text-gray-300"
                                                >
                                                    {unit.longitudinal.periods.map((p: string) => (
                                                        <option key={`a_${p}`} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-gray-500 block mb-1">Periodo TB</span>
                                                <select
                                                    value={longiPeriodB}
                                                    onChange={(e) => setLongiPeriodB(e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2 py-1.5 text-[11px] text-gray-300"
                                                >
                                                    {unit.longitudinal.periods.map((p: string) => (
                                                        <option key={`b_${p}`} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── LONGITUDINAL SOM ENTITIES SELECTOR (Collapsible Accordion) ─────────── */}
                                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-3 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsLongitudinalEntitiesExpanded(!isLongitudinalEntitiesExpanded)}
                                        className="w-full flex items-center justify-between text-left group bg-transparent border-0 cursor-pointer"
                                    >
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200 group-hover:text-emerald-400 transition-colors flex items-center space-x-2">
                                                <span>Longitudinal SOM Entities</span>
                                                <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[9px] font-bold rounded">
                                                    {selectedLongiEntities.length} entities
                                                </span>
                                            </h3>
                                            <p className="text-[10px] text-gray-500">
                                                {longiEntities.length} entities available in total
                                            </p>
                                        </div>
                                        {isLongitudinalEntitiesExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                    </button>

                                    {isLongitudinalEntitiesExpanded && (
                                        <div className="space-y-3 pt-2 border-t border-gray-800/50">
                                            {/* Quick Limit Buttons */}
                                            <div className="flex flex-col space-y-1">
                                                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Top Entities (Ranked)</label>
                                                <div className="flex space-x-1">
                                                    {([10, 25, 50, 100, 'all'] as const).map(lim => (
                                                        <button
                                                            key={lim}
                                                            type="button"
                                                            onClick={() => setLongiEntityLimit(lim)}
                                                            className={`flex-1 py-1 text-[10px] rounded-lg transition-colors font-medium border cursor-pointer ${
                                                                longiEntityLimit === lim
                                                                    ? 'bg-emerald-900/70 text-emerald-300 border-emerald-500 shadow-sm'
                                                                    : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'
                                                            }`}
                                                        >
                                                            {lim === 'all' ? 'All' : `Top ${lim}`}
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        disabled
                                                        className={`flex-1 py-1 text-[10px] rounded-lg transition-colors font-medium border ${
                                                            longiEntityLimit === 'custom'
                                                                ? 'bg-amber-900/60 text-amber-300 border-amber-500'
                                                                : 'bg-gray-900 text-gray-600 border-gray-800'
                                                        }`}
                                                    >
                                                        Custom
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick Growth Filter */}
                                            {longiDeltaIndicator && (
                                                <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer pt-1 border-t border-gray-800/60">
                                                    <input
                                                        type="checkbox"
                                                        checked={longiPositiveGrowthOnly}
                                                        onChange={(e) => setLongiPositiveGrowthOnly(e.target.checked)}
                                                        className="rounded bg-gray-900 border-gray-700 text-emerald-500 focus:ring-0"
                                                    />
                                                    <span className="text-[11px]">Solo Crecimiento Positivo (Δ {'>'} 0)</span>
                                                </label>
                                            )}

                                            {/* Search Filter */}
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={longiEntitySearch}
                                                    onChange={(e) => setLongiEntitySearch(e.target.value)}
                                                    placeholder="Filtrar entidades..."
                                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                                                />
                                                {longiEntitySearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setLongiEntitySearch('')}
                                                        className="absolute right-2 top-1.5 text-xs text-gray-500 hover:text-gray-300"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>

                                            {/* Entity Selection Checklist */}
                                            <div className="flex flex-col space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase font-semibold">
                                                    <span>Seleccionar Entidades</span>
                                                    <div className="space-x-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedLongiEntities(longiEntities.map((e: any) => e.entity));
                                                                setLongiEntityLimit('all');
                                                            }}
                                                            className="text-emerald-400 hover:text-emerald-300 lowercase font-normal cursor-pointer"
                                                        >
                                                            todas
                                                        </button>
                                                        <span>·</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedLongiEntities([]);
                                                                setLongiEntityLimit('custom');
                                                            }}
                                                            className="text-gray-400 hover:text-gray-300 lowercase font-normal cursor-pointer"
                                                        >
                                                            ninguna
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="max-h-56 overflow-y-auto pr-1 space-y-1 custom-scrollbar bg-gray-900 rounded-lg p-1.5 border border-gray-800">
                                                    {displayedLongiEntities.map((ent: any, idx: number) => {
                                                        const isSelected = selectedLongiEntities.includes(ent.entity);
                                                        return (
                                                            <button
                                                                key={ent.entity}
                                                                type="button"
                                                                onClick={() => toggleLongiEntity(ent.entity)}
                                                                className={`flex items-center space-x-2 text-[11px] w-full text-left p-1.5 rounded transition border-0 cursor-pointer ${
                                                                    isSelected ? 'bg-emerald-600/20 text-gray-200' : 'hover:bg-gray-800 text-gray-500'
                                                                }`}
                                                            >
                                                                {isSelected
                                                                    ? <CheckSquare size={12} className="text-emerald-400 shrink-0" />
                                                                    : <Square size={12} className="opacity-50 shrink-0" />
                                                                }
                                                                <span className="text-[10px] text-gray-500 font-mono w-6 shrink-0">{idx + 1}.</span>
                                                                <span className="truncate flex-1" title={ent.entity}>{ent.entity}</span>
                                                                {ent.total_docs !== undefined && (
                                                                    <span className="text-[10px] text-gray-500 font-mono shrink-0">
                                                                        {ent.total_docs.toLocaleString()} docs
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>) : (
                                <div className="flex flex-col items-center justify-center h-40 text-center text-gray-600">
                                    <Activity className="w-8 h-8 mb-2 opacity-30" />
                                    <p className="text-xs">No hay matrices consecutivas.<br/>Carga un paquete con carpetas longitudinales.</p>
                                </div>
                            )}
                        </>)}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3 flex flex-col space-y-6">

                    {/* ── TEMPORAL ANALYSIS TAB CHARTS ──────────────── */}
                    {sidebarTab === 'temporal' && (
                        <>
                            {/* Time Series Chart */}
                            {tsChartData.length > 0 ? (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 h-96 flex flex-col">
                                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                        <h3 className="text-sm font-bold text-gray-200 flex-shrink-0">
                                            Time Series Chart
                                            {tsEntities.length > 0 && <span className="text-gray-500 ml-2 font-normal">(Top {tsEntities.length} de {totalEntities})</span>}
                                        </h3>
                                        <div className="flex items-center space-x-3 ml-auto flex-wrap gap-y-2">
                                            <ExportButtons 
                                                containerId="chart-time-series" 
                                                filename={`time_series_${tsIndicator || 'data'}`} 
                                                chartTitle={`Time Series: ${unitName} - ${tsIndicator}`}
                                                chartType="trend"
                                                chartData={tsChartData}
                                                dataPrompt={`Time Series Data for "${unitName}" (${tsIndicator}).\n` +
                                                    `Years: ${tsChartData.map((d: any) => d.time).join(', ')}.\n` +
                                                    `Tracked Entities (${tsEntities.length}): ${tsEntities.slice(0, 10).join(', ')}...`
                                                }
                                            />
                                            <select
                                                value={tsIndicator}
                                                onChange={e => setTsIndicator(e.target.value)}
                                                className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200"
                                            >
                                                {unit.time_series && Object.keys(unit.time_series).map(ind => (
                                                    <option key={ind} value={ind}>{ind}</option>
                                                ))}
                                            </select>
                                            <div className="flex space-x-1">
                                                {(['raw', 'ecma3', 'ecma5'] as const).map(mode => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => setTsSmoothing(mode)}
                                                        className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg border ${tsSmoothing === mode
                                                                ? 'bg-cyan-600 border-cyan-500 text-white'
                                                                : 'bg-gray-950 border-gray-700 text-gray-400 hover:text-gray-200'
                                                            }`}
                                                    >
                                                        {mode}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-[300px]" id="chart-time-series">
                                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                                            <LineChart data={tsChartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                                <XAxis dataKey="time" stroke="#4b5563" tick={{ fontSize: 10 }} />
                                                <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} width={40} />
                                                 <RechartsTooltip
                                                     content={({ active, payload, label }) => {
                                                         if (!active || !payload || !payload.length) return null;
                                                         const activeItems = payload
                                                             .filter((item: any) => typeof item.value === 'number' && item.value > 0)
                                                             .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
                                                         if (activeItems.length === 0) return null;
                                                         return (
                                                             <div className="bg-gray-900 border border-gray-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1 max-h-60 overflow-y-auto">
                                                                 <p className="font-bold text-gray-300 border-b border-gray-800 pb-1 mb-1">{label}</p>
                                                                 {activeItems.map((item: any, idx: number) => (
                                                                     <div key={idx} className="flex items-center justify-between space-x-4">
                                                                         <span className="font-medium truncate max-w-[220px]" style={{ color: item.color }}>
                                                                             {item.name}:
                                                                         </span>
                                                                         <span className="font-bold text-gray-200 ml-2">
                                                                             {typeof item.value === 'number' ? item.value.toFixed(2) : item.value}
                                                                         </span>
                                                                     </div>
                                                                 ))}
                                                             </div>
                                                         );
                                                     }}
                                                 />
                                                {tsEntities.map((entity: string, i: number) => (
                                                    <Line
                                                        key={entity}
                                                        type="monotone"
                                                        dataKey={entity}
                                                        stroke={colors[i % colors.length]}
                                                        dot={false}
                                                        strokeWidth={2}
                                                        connectNulls
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-40 flex flex-col justify-center items-center text-center">
                                    <h3 className="text-sm font-bold text-gray-300 mb-1">Time Series (Series de Tiempo)</h3>
                                    <p className="text-xs text-gray-500 max-w-md">Para visualizar esta gráfica, sube reportes TlachIA Metrics de tipo 'Trend' o archivos que incluyan columnas temporales por años.</p>
                                </div>
                            )}

                            {/* ── STACKED AREA CHART ────────────────────────────────────── */}
                            {stackedAreaData.length > 0 && (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-800">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200">
                                                Stacked Area Evolution ({tsIndicator})
                                            </h3>
                                            <p className="text-[11px] text-gray-500">Cumulative share & volume evolution over time.</p>
                                        </div>

                                        <div className="flex items-center space-x-2 flex-wrap gap-2">
                                            <ExportButtons 
                                                containerId="chart-stacked-area" 
                                                filename={`stacked_area_${tsIndicator || 'data'}`} 
                                                chartTitle={`Stacked Area Evolution: ${unitName} - ${tsIndicator} (${areaMode === 'percentage' ? '100% Share' : 'Absolute Volume'})`}
                                                chartType="trend"
                                                chartData={stackedAreaData}
                                                dataPrompt={`Stacked Area Evolution (${areaMode}) for "${unitName}" (${tsIndicator}).\n` +
                                                    `Years: ${stackedAreaData.map((d: any) => d.time).join(', ')}.`
                                                }
                                            />
                                            <div className="flex space-x-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
                                            <button
                                                onClick={() => setAreaMode('absolute')}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                                    areaMode === 'absolute' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-gray-200'
                                                }`}
                                            >
                                                Absolute Volume
                                            </button>
                                            <button
                                                onClick={() => setAreaMode('percentage')}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                                    areaMode === 'percentage' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-gray-200'
                                                }`}
                                            >
                                                100% Share (%)
                                            </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full" style={{ height: 380 }} id="chart-stacked-area">
                                        <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                                            <AreaChart data={stackedAreaData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-800, #1e293b)" />
                                                <XAxis dataKey="time" stroke="var(--gray-400, #64748b)" tick={{ fontSize: 10, fill: 'var(--gray-300, #cbd5e1)' }} />
                                                <YAxis
                                                    type="number"
                                                    domain={areaMode === 'percentage' ? [0, 100] : [0, 'auto']}
                                                    unit={areaMode === 'percentage' ? '%' : ''}
                                                    stroke="var(--gray-400, #64748b)"
                                                    tick={{ fontSize: 10, fill: 'var(--gray-300, #cbd5e1)' }}
                                                />
                                                <RechartsTooltip />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                {selectedChartEntities.slice(0, 15).map((ent, i) => (
                                                    <Area
                                                        key={ent}
                                                        type="monotone"
                                                        dataKey={ent}
                                                        stackId="1"
                                                        stroke={colors[i % colors.length]}
                                                        fill={colors[i % colors.length]}
                                                        fillOpacity={0.6}
                                                    />
                                                ))}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* ── CAGR VS VOLUME SCATTER PLOT ─────────────────────────────── */}
                            {cagrScatterData.points.length > 0 && (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-800">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200">
                                                Strategic Growth Matrix (CAGR % vs. Current Volume)
                                            </h3>
                                            <p className="text-[11px] text-gray-500">Compound Annual Growth Rate vs. latest volume ({tsIndicator}).</p>
                                        </div>
                                        <ExportButtons 
                                            containerId="chart-cagr-scatter" 
                                            filename="cagr_growth_matrix" 
                                            chartTitle={`CAGR Strategic Growth Matrix: ${unitName} (${tsIndicator})`}
                                            chartType="scatter"
                                            chartData={cagrScatterData.points}
                                            dataPrompt={`Strategic Growth Matrix (CAGR % vs Volume) for "${unitName}" (${tsIndicator}).\n` +
                                                `Median Volume: ${cagrScatterData.medianVolume.toFixed(1)}, Median CAGR: ${cagrScatterData.medianCagr.toFixed(2)}%.\n` +
                                                `Entities:\n` +
                                                cagrScatterData.points.slice(0, 25).map((p: any) => `- ${p.entity}: Volume=${p.volume}, CAGR=${p.cagr}%`).join('\n')
                                            }
                                        />
                                    </div>

                                    <div className="w-full relative" style={{ height: 420 }} id="chart-cagr-scatter">
                                        {/* Quadrant Labels Background Overlay */}
                                        <div className="absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2 text-[10px] font-bold p-8 opacity-40">
                                            <div className="text-green-400 self-start justify-self-start bg-green-950/40 p-1.5 rounded border border-green-800/40">
                                                ⭐ Emerging Stars (High Growth, Low Vol)
                                            </div>
                                            <div className="text-cyan-400 self-start justify-self-end text-right bg-indigo-950/40 p-1.5 rounded border border-indigo-800/40">
                                                🚀 Star Leaders (High Growth, High Vol)
                                            </div>
                                            <div className="text-gray-500 self-end justify-self-start bg-gray-950/40 p-1.5 rounded border border-gray-800/40">
                                                🔻 Low Priority / Declining
                                            </div>
                                            <div className="text-amber-400 self-end justify-self-end text-right bg-amber-950/40 p-1.5 rounded border border-amber-800/40">
                                                🏰 Established Giants (Low Growth, High Vol)
                                            </div>
                                        </div>

                                        <ResponsiveContainer width="100%" height="100%" minHeight={380}>
                                            <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-800, #1e293b)" />
                                                <XAxis
                                                    type="number"
                                                    dataKey="volume"
                                                    name="Volume"
                                                    stroke="var(--gray-400, #64748b)"
                                                    tick={{ fontSize: 10, fill: 'var(--gray-300, #cbd5e1)' }}
                                                    label={{ value: `Current Volume (${tsIndicator})`, position: 'bottom', offset: 5, fill: 'var(--gray-300, #cbd5e1)', fontSize: 11, fontWeight: 'bold' }}
                                                />
                                                <YAxis
                                                    type="number"
                                                    dataKey="cagr"
                                                    name="CAGR %"
                                                    unit="%"
                                                    stroke="var(--gray-400, #64748b)"
                                                    tick={{ fontSize: 10, fill: 'var(--gray-300, #cbd5e1)' }}
                                                    label={{ value: 'CAGR (Annual Growth %)', angle: -90, position: 'left', offset: -5, fill: 'var(--gray-300, #cbd5e1)', fontSize: 11, fontWeight: 'bold' }}
                                                />
                                                <ReferenceLine x={cagrScatterData.medianVolume} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Median Vol', fill: '#94a3b8', fontSize: 10, position: 'top' }} />
                                                <ReferenceLine y={cagrScatterData.medianCagr} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Median CAGR', fill: '#94a3b8', fontSize: 10, position: 'right' }} />
                                                <RechartsTooltip
                                                    content={({ active, payload }) => {
                                                        if (!active || !payload || !payload.length) return null;
                                                        const d = payload[0].payload;
                                                        return (
                                                            <div className="bg-gray-900 border border-gray-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
                                                                <p className="font-bold text-gray-200 border-b border-gray-800 pb-1">{d.entity}</p>
                                                                <p className="text-cyan-400 font-bold">CAGR ({d.startYear} - {d.endYear}): {d.cagr}%</p>
                                                                <p className="text-gray-300">Volume ({d.endYear}): {d.volume}</p>
                                                            </div>
                                                        );
                                                    }}
                                                />
                                                <Scatter name="Entities" data={cagrScatterData.points}>
                                                    {cagrScatterData.points.map((_: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                                    ))}
                                                </Scatter>
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* ── TEMPORAL HEATMAP MATRIX ─────────────────────────────────── */}
                            {temporalHeatmapMatrixData.rows.length > 0 && (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-gray-800">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200 flex items-center space-x-2 flex-wrap gap-1">
                                                <span>Temporal Heatmap Matrix</span>
                                                <span className="px-2 py-0.5 bg-purple-950/80 border border-purple-500/60 text-purple-300 text-[10px] font-bold rounded-lg">
                                                    {temporalSelectedEntities.length} entities · {filteredEvoData.length} trajectory rows
                                                </span>
                                            </h3>
                                            <p className="text-[11px] text-gray-500">Min-Max column normalization [0 to 1] per entity across indicator series.</p>
                                        </div>

                                        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                                            {/* Quick Top N limit buttons */}
                                            <div className="flex items-center space-x-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
                                                <span className="text-[10px] text-gray-500 font-semibold px-1.5">Entities:</span>
                                                {([3, 4, 5, 10, 'all'] as const).map(lim => (
                                                    <button
                                                        key={lim}
                                                        type="button"
                                                        onClick={() => setTemporalEntityLimit(lim)}
                                                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                                                            temporalEntityLimit === lim
                                                                ? 'bg-purple-600 text-white shadow'
                                                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                                        }`}
                                                    >
                                                        {lim === 'all' ? 'All' : `Top ${lim}`}
                                                    </button>
                                                ))}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleTrainSOMEvo}
                                                disabled={selectedProfileIndicators.length === 0 || filteredEvoData.length === 0}
                                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-900/40 transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                                                title={`Train SOM with all ${filteredEvoData.length} trajectory rows from ${temporalSelectedEntities.length} entities`}
                                            >
                                                <Activity className="w-3.5 h-3.5" />
                                                <span>Train SOM ({filteredEvoData.length} rows)</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto max-h-[450px] custom-scrollbar rounded-xl border border-gray-800">
                                        <table className="w-full text-xs border-collapse">
                                            <thead className="sticky top-0 bg-gray-950 border-b border-gray-800 shadow-sm">
                                                <tr>
                                                    <th className="text-left px-3 py-2.5 text-gray-400 font-semibold whitespace-nowrap bg-gray-950">Year_Entity</th>
                                                    {selectedProfileIndicators.map((ind: string) => (
                                                        <th key={ind} className="text-right px-3 py-2.5 text-gray-400 font-semibold whitespace-nowrap truncate max-w-[150px] bg-gray-950" title={ind}>
                                                            {ind}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-900">
                                                {temporalHeatmapMatrixData.rows.map((row: any, i: number) => (
                                                    <tr key={i} className="hover:opacity-90 transition-opacity">
                                                        <td className="px-3 py-2 text-gray-300 font-medium max-w-[200px] truncate bg-gray-950" title={row.entity}>
                                                            {row.entity}
                                                        </td>
                                                        {selectedProfileIndicators.map((ind: string) => {
                                                            const cell = row.cells[ind];
                                                            return (
                                                                <td
                                                                    key={ind}
                                                                    className="px-3 py-2 text-right font-bold transition-colors"
                                                                    style={{
                                                                        backgroundColor: cell?.color || '#0f172a',
                                                                        color: cell?.textColor || '#ffffff'
                                                                    }}
                                                                    title={`${row.entity} - ${ind}: ${cell?.val}`}
                                                                >
                                                                    {typeof cell?.val === 'number' ? cell.val.toFixed(2) : cell?.val ?? '-'}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── LONGITUDINAL ANALYSIS TAB CHARTS ─────────────── */}
                    {sidebarTab === 'longitudinal' && (
                        <>
                            {unit?.longitudinal?.has_longitudinal ? (
                                <div className="space-y-6">
                                    {/* 1. Multi-Period Longitudinal Trajectories Line Chart */}
                                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col min-h-[440px]">
                                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-100 flex items-center space-x-2">
                                                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                                                    <span>Trayectoria Longitudinal Periodo a Periodo</span>
                                                    <span className="text-xs font-normal text-emerald-400/90 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                                        {longiIndicator}
                                                    </span>
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    Evolución temporal a través de {longiPeriods.length} ventanas consecutivas ({longiPeriods[0]} → {longiPeriods[longiPeriods.length - 1]}).
                                                </p>
                                            </div>
                                            <ExportButtons
                                                containerId="chart-longitudinal-trajectories"
                                                filename={`longitudinal_trajectories_${unitName}_${longiIndicator}`}
                                                chartTitle={`Trayectorias Longitudinales: ${unitName} - ${longiIndicator}`}
                                                chartType="trend"
                                                chartData={longiTrajectoryChartData}
                                                dataPrompt={`Datos de Trayectorias Longitudinales para ${unitName} (${longiIndicator}).\n` +
                                                    `Periodos analizados: ${longiPeriods.join(', ')}.\n` +
                                                    `Entidades (${filteredLongiEntities.length}): ${filteredLongiEntities.map((e: any) => e.entity).slice(0, 10).join(', ')}...`
                                                }
                                            />
                                        </div>

                                        <div id="chart-longitudinal-trajectories" className="flex-1 w-full h-80 min-h-[320px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={longiTrajectoryChartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                                    <XAxis dataKey="period" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                                                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                                                    <RechartsTooltip
                                                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem', fontSize: '11px' }}
                                                        formatter={(value: any, name: any) => [typeof value === 'number' ? value.toLocaleString() : value, name]}
                                                    />
                                                    <Legend wrapperStyle={{ paddingTop: 12, fontSize: '11px' }} />
                                                    {filteredLongiEntities.map((ent: any) => (
                                                        <Line
                                                            key={ent.entity}
                                                            type="monotone"
                                                            dataKey={ent.entity}
                                                            name={ent.entity}
                                                            stroke={longiColors[ent.entity] || '#10b981'}
                                                            strokeWidth={2}
                                                            dot={{ r: 3 }}
                                                            activeDot={{ r: 6 }}
                                                        />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* 2. Inter-period Delta and Strategic Quadrants Grid */}
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                        {/* Inter-Period Growth Bar Chart */}
                                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col min-h-[400px]">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-100 flex items-center space-x-2">
                                                        <BarChart2 className="w-4 h-4 text-cyan-400" />
                                                        <span>Tasas de Crecimiento Interperiódico (Δ)</span>
                                                    </h3>
                                                    <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-sm">
                                                        {longiDeltaIndicator || 'Variación entre ventanas temporales consecutivas'}
                                                    </p>
                                                </div>
                                                <ExportButtons
                                                    containerId="chart-longitudinal-deltas"
                                                    filename={`longitudinal_deltas_${unitName}`}
                                                    chartTitle={`Crecimiento Interperiódico: ${unitName} - ${longiDeltaIndicator}`}
                                                    chartType="bar"
                                                    chartData={longiDeltaChartData}
                                                />
                                            </div>

                                            <div id="chart-longitudinal-deltas" className="flex-1 w-full h-72">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={longiDeltaChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                                                        <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                                                        <YAxis type="category" dataKey="entity" stroke="#9ca3af" tick={{ fontSize: 10 }} width={120} />
                                                        <RechartsTooltip
                                                            contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem', fontSize: '11px' }}
                                                            formatter={(val: any) => [`${val}%`, 'Variación']}
                                                        />
                                                        <ReferenceLine x={0} stroke="#4b5563" />
                                                        <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                                                            {longiDeltaChartData.map((entry: any, index: number) => (
                                                                <Cell
                                                                    key={`cell-${index}`}
                                                                    fill={entry.delta >= 0 ? '#10b981' : '#f43f5e'}
                                                                />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Strategic Quadrant Shift Scatter (TA vs TB) */}
                                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col min-h-[400px]">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-100 flex items-center space-x-2">
                                                        <Activity className="w-4 h-4 text-purple-400" />
                                                        <span>Desplazamiento de Cuadrantes ({longiPeriodA} → {longiPeriodB})</span>
                                                    </h3>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                        Producción (Eje X) vs Impacto FWCI (Eje Y)
                                                    </p>
                                                </div>
                                                <ExportButtons
                                                    containerId="chart-longitudinal-quadrants"
                                                    filename={`longitudinal_quadrants_${unitName}`}
                                                    chartTitle={`Cuadrantes: ${unitName} (${longiPeriodA} vs ${longiPeriodB})`}
                                                    chartType="scatter"
                                                    chartData={longiQuadrantData}
                                                />
                                            </div>

                                            <div id="chart-longitudinal-quadrants" className="flex-1 w-full h-72">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                                        <XAxis type="number" dataKey="docsB" name="Documentos (TB)" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                                                        <YAxis type="number" dataKey="fwciB" name="FWCI (TB)" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                                                        <RechartsTooltip
                                                            contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem', fontSize: '11px' }}
                                                            formatter={(val: any, name: any) => [val, name]}
                                                        />
                                                        <ReferenceLine y={1.0} stroke="#6366f1" strokeDasharray="3 3" label={{ value: 'FWCI = 1.0 (Media Mundial)', fill: '#818cf8', fontSize: 10 }} />
                                                        <Scatter name="Entidades" data={longiQuadrantData} fill="#8b5cf6">
                                                            {longiQuadrantData.map((entry: any, index: number) => (
                                                                <Cell
                                                                    key={`scell-${index}`}
                                                                    fill={longiColors[entry.entity] || '#8b5cf6'}
                                                                />
                                                            ))}
                                                        </Scatter>
                                                    </ScatterChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Consolidated Longitudinal Performance Table */}
                                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col">
                                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-100 flex items-center space-x-2">
                                                    <Database className="w-4 h-4 text-emerald-400" />
                                                    <span>Tabla de Desempeño Longitudinal Consolidada</span>
                                                    <span className="text-xs font-normal text-gray-400 ml-2">
                                                        ({longiEntities.length} entidades analizadas)
                                                    </span>
                                                </h3>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <input
                                                    type="text"
                                                    placeholder="Buscar entidad..."
                                                    value={longiTableSearch}
                                                    onChange={(e) => setLongiTableSearch(e.target.value)}
                                                    className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto max-h-96 rounded-xl border border-gray-800">
                                            <table className="w-full text-left text-xs text-gray-300">
                                                <thead className="bg-gray-950 text-gray-400 sticky top-0 border-b border-gray-800 z-10">
                                                    <tr>
                                                        <th className="py-2.5 px-3 font-semibold">Entidad</th>
                                                        <th className="py-2.5 px-3 font-semibold text-right">Total Docs</th>
                                                        <th className="py-2.5 px-3 font-semibold text-right">Total FWCI</th>
                                                        {longiPeriods.map((p: string) => (
                                                            <th key={`th_${p}`} className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                                                                {p} ({longiIndicator})
                                                            </th>
                                                        ))}
                                                        {longiDeltaIndicator && (
                                                            <th className="py-2.5 px-3 font-semibold text-right text-cyan-400 whitespace-nowrap">
                                                                {longiDeltaIndicator}
                                                            </th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800/60 bg-gray-900/40">
                                                    {longiEntities
                                                        .filter((ent: any) => !longiTableSearch || ent.entity.toLowerCase().includes(longiTableSearch.toLowerCase()))
                                                        .slice(0, 50)
                                                        .map((ent: any) => (
                                                            <tr key={ent.entity} className="hover:bg-gray-800/50 transition">
                                                                <td className="py-2 px-3 font-medium text-gray-200 whitespace-nowrap">{ent.entity}</td>
                                                                <td className="py-2 px-3 text-right text-gray-300">{(ent.total_docs || 0).toLocaleString()}</td>
                                                                <td className="py-2 px-3 text-right text-gray-300">{(ent.total_fwci || 0).toFixed(2)}</td>
                                                                {longiPeriods.map((p: string) => (
                                                                    <td key={`td_${ent.entity}_${p}`} className="py-2 px-3 text-right text-gray-300">
                                                                        {typeof ent.periods?.[p]?.[longiIndicator] === 'number'
                                                                            ? ent.periods[p][longiIndicator].toLocaleString()
                                                                            : (ent.periods?.[p]?.[longiIndicator] ?? '-')}
                                                                    </td>
                                                                ))}
                                                                {longiDeltaIndicator && (
                                                                    <td className={`py-2 px-3 text-right font-bold ${
                                                                        (ent.deltas?.[longiDeltaIndicator] || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                                                    }`}>
                                                                        {(ent.deltas?.[longiDeltaIndicator] || 0).toFixed(1)}%
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 border border-dashed border-gray-800 rounded-2xl p-8">
                                    <Zap className="w-12 h-12 mb-3 text-gray-700" />
                                    <p className="text-gray-300 font-semibold text-sm">No se encontraron matrices de periodos consecutivos</p>
                                    <p className="text-xs text-gray-500 mt-1 max-w-md">
                                        Esta unidad no contiene carpetas `01_Matrices_Desempeño_Longitudinal` ni reportes multi-periodo `02_Periodos_Consecutivos`.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── MULTIDIMENSIONAL PROFILES TAB CHARTS ───────── */}
                    {sidebarTab === 'profiles' && (
                        <>
                            {/* ── 4D BUBBLE CHART ─────────────────────────────────────────── */}
                            {activeProfile && activeProfile.length > 0 && unit.indicators && unit.indicators.length > 0 && (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col space-y-4">
                                    {/* Card Header & Indicator Selectors */}
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-gray-800">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200 flex items-center space-x-2 flex-wrap gap-1">
                                                <span>4D Bubble Chart Analysis</span>
                                                <span className="text-gray-500 font-normal text-xs">({bubbleChartData.points.length} entities)</span>
                                                {isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0 && (
                                                    <span className="px-2 py-0.5 bg-indigo-950/80 border border-cyan-500/60 text-cyan-300 text-[10px] font-bold rounded-lg flex items-center space-x-1">
                                                        <Filter className="w-2.5 h-2.5" />
                                                        <span className="truncate max-w-[150px]">{filterIndicator} ≥ {filterMinValue}</span>
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-[11px] text-gray-500">Configure 4 distinct indicators for X, Y, Size, and Color.</p>
                                        </div>
                                        
                                        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
                                            <ExportButtons
                                                containerId="chart-4d-bubble"
                                                filename="4d_bubble_chart"
                                                chartTitle={`4D Bubble Chart: ${unitName} (${bubbleIndX} vs ${bubbleIndY})`}
                                                chartType="bubble"
                                                chartData={bubbleChartData.points}
                                                dataPrompt={`4D Bubble Chart for "${unitName}" unit.\n` +
                                                    `Total compared entities: ${bubbleChartData.points.length}.\n` +
                                                    `X-Axis: ${bubbleIndX} | Y-Axis: ${bubbleIndY} | Size: ${bubbleIndSize} | Color: ${bubbleIndColor}.\n` +
                                                    `Sample of analyzed entities across all 4 dimensions:\n` +
                                                    bubbleChartData.points.slice(0, 25).map((p: any) =>
                                                        `- ${p.entity}: ${bubbleIndX}=${typeof p.x === 'number' ? p.x.toFixed(2) : p.x}, ${bubbleIndY}=${typeof p.y === 'number' ? p.y.toFixed(2) : p.y}, ${bubbleIndSize}=${typeof p.size === 'number' ? p.size.toFixed(2) : p.size}, ${bubbleIndColor}=${typeof p.colorVal === 'number' ? p.colorVal.toFixed(2) : p.colorVal}`
                                                    ).join('\n')
                                                }
                                            />
                                            <label className="flex items-center space-x-1.5 cursor-pointer text-xs text-gray-300 mr-1">
                                                <input
                                                    type="checkbox"
                                                    checked={showBubbleLabels}
                                                    onChange={e => setShowBubbleLabels(e.target.checked)}
                                                    className="w-3.5 h-3.5 text-blue-600 bg-gray-950 border-gray-700 rounded"
                                                />
                                                <span>Show Labels</span>
                                            </label>

                                            {/* Filter Trigger Button */}
                                            <button
                                                type="button"
                                                onClick={() => setIsFilterModalOpen(true)}
                                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 cursor-pointer ${
                                                    isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0
                                                        ? 'bg-indigo-900/60 text-cyan-300 border-cyan-500/80 shadow-md shadow-indigo-950'
                                                        : 'bg-gray-950 hover:bg-gray-800 text-gray-300 border-gray-800 hover:border-gray-700'
                                                }`}
                                                title="Filter entities by minimum threshold on any indicator"
                                            >
                                                <Filter className="w-3.5 h-3.5" />
                                                <span>{isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0 ? `Filter: ≥ ${filterMinValue}` : 'Filter Units'}</span>
                                            </button>

                                            {/* Limit Top 50 Checkbox */}
                                            <label 
                                                className="flex items-center space-x-1.5 text-xs text-gray-300 cursor-pointer select-none bg-gray-950 px-2.5 py-1.5 rounded-xl border border-gray-800 hover:border-gray-700" 
                                                title="Send at most 50 entities to Train SOM (Default: Active)"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={limitTop50}
                                                    onChange={(e) => setTlachiaState({ tlachiaLimitTop50: e.target.checked })}
                                                    className="w-3.5 h-3.5 bg-gray-950 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
                                                />
                                                <span className="font-semibold text-gray-200 text-[11px]">Max 50</span>
                                            </label>
                                            
                                            <button
                                                type="button"
                                                onClick={handleTrainSOMBubble}
                                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-900/30 transition-all flex items-center space-x-1.5 cursor-pointer shrink-0"
                                                title={`Train SOM with 4 dimensions (${limitTop50 ? 'up to 50' : 'all'} filtered entities)`}
                                            >
                                                <Activity className="w-3.5 h-3.5" />
                                                <span>Train SOM</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* 4 Indicator Dropdowns Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800/80">
                                        <div className="flex flex-col space-y-1">
                                            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
                                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                <span>X-Axis</span>
                                            </label>
                                            <select
                                                value={bubbleIndX}
                                                onChange={e => setBubbleIndX(e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 truncate"
                                            >
                                                {unit.indicators.map((ind: string) => (
                                                    <option key={ind} value={ind}>{ind}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex flex-col space-y-1">
                                            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
                                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                                <span>Y-Axis</span>
                                            </label>
                                            <select
                                                value={bubbleIndY}
                                                onChange={e => setBubbleIndY(e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 truncate"
                                            >
                                                {unit.indicators.map((ind: string) => (
                                                    <option key={ind} value={ind}>{ind}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex flex-col space-y-1">
                                            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
                                                <span className="w-2 h-2 rounded-full bg-orange-500" />
                                                <span>Bubble Size</span>
                                            </label>
                                            <select
                                                value={bubbleIndSize}
                                                onChange={e => setBubbleIndSize(e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 truncate"
                                            >
                                                {unit.indicators.map((ind: string) => (
                                                    <option key={ind} value={ind}>{ind}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex flex-col space-y-1">
                                            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
                                                <span className="w-2 h-2 rounded-full bg-purple-500" />
                                                <span>Bubble Color</span>
                                            </label>
                                            <select
                                                value={bubbleIndColor}
                                                onChange={e => setBubbleIndColor(e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 truncate"
                                            >
                                                {unit.indicators.map((ind: string) => (
                                                    <option key={ind} value={ind}>{ind}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Main Chart Area & Continuous Colorbar */}
                                    <div className="flex flex-row items-stretch gap-4" style={{ height: 480 }}>
                                        {/* Scatter Chart Canvas */}
                                        <div className="flex-1 bg-white border border-gray-200 rounded-xl p-2 min-w-0" id="chart-4d-bubble">
                                            <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                                                <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis
                                                        type="number"
                                                        dataKey="x"
                                                        name={bubbleIndX}
                                                        stroke="#64748b"
                                                        tick={{ fontSize: 10, fill: '#475569' }}
                                                        label={{ value: bubbleIndX, position: 'bottom', offset: 5, fill: '#334155', fontSize: 11, fontWeight: 'bold' }}
                                                    />
                                                    <YAxis
                                                        type="number"
                                                        dataKey="y"
                                                        name={bubbleIndY}
                                                        stroke="#64748b"
                                                        tick={{ fontSize: 10, fill: '#475569' }}
                                                        label={{ value: bubbleIndY, angle: -90, position: 'left', offset: -5, fill: '#334155', fontSize: 11, fontWeight: 'bold' }}
                                                    />
                                                    <ZAxis type="number" dataKey="size" range={[100, 1000]} name={bubbleIndSize} />
                                                    <RechartsTooltip
                                                        cursor={{ strokeDasharray: '3 3', stroke: '#64748b' }}
                                                        content={({ active, payload }) => {
                                                            if (!active || !payload || !payload.length) return null;
                                                            const data = payload[0].payload;
                                                            return (
                                                                <div className="bg-gray-900 border border-gray-700 p-3 rounded-xl shadow-2xl text-xs space-y-1 z-50">
                                                                    <p className="font-bold text-gray-100 text-sm border-b border-gray-800 pb-1">{data.entity}</p>
                                                                    <p className="text-gray-300"><span className="text-gray-400 font-semibold">{bubbleIndX}:</span> {typeof data.x === 'number' ? data.x.toFixed(2) : data.x}</p>
                                                                    <p className="text-gray-300"><span className="text-gray-400 font-semibold">{bubbleIndY}:</span> {typeof data.y === 'number' ? data.y.toFixed(2) : data.y}</p>
                                                                    <p className="text-gray-300"><span className="text-gray-400 font-semibold">{bubbleIndSize} (Size):</span> {typeof data.size === 'number' ? data.size.toFixed(2) : data.size}</p>
                                                                    <p className="text-gray-300"><span className="text-gray-400 font-semibold">{bubbleIndColor} (Color):</span> <span className="font-bold" style={{ color: data.fillColor }}>{typeof data.colorVal === 'number' ? data.colorVal.toFixed(2) : data.colorVal}</span></p>
                                                                </div>
                                                            );
                                                        }}
                                                    />
                                                    <Scatter
                                                        name="Entities"
                                                        data={bubbleChartData.points}
                                                        shape={(props: any) => {
                                                            const { cx, cy, payload } = props;
                                                            const r = payload.bubbleRadius || props.r || 8;
                                                            return (
                                                                <g key={`bubble_${payload.entity}`}>
                                                                    <circle
                                                                        cx={cx}
                                                                        cy={cy}
                                                                        r={r}
                                                                        fill={payload.fillColor}
                                                                        fillOpacity={0.8}
                                                                        stroke="#ffffff"
                                                                        strokeWidth={1.5}
                                                                        className="transition-all hover:stroke-width-3 cursor-pointer"
                                                                    />
                                                                    {showBubbleLabels && (
                                                                        <text
                                                                            x={cx + r + 4}
                                                                            y={cy + 3}
                                                                            fill="#1e293b"
                                                                            fontSize={9}
                                                                            fontWeight={600}
                                                                            className="pointer-events-none select-none"
                                                                        >
                                                                            {payload.entity}
                                                                        </text>
                                                                    )}
                                                                </g>
                                                            );
                                                        }}
                                                    >
                                                        {bubbleChartData.points.map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fillColor} />
                                                        ))}
                                                    </Scatter>
                                                </ScatterChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Continuous Colorbar Bar Legend */}
                                        <div className="w-28 bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between items-center shrink-0 select-none">
                                            <div className="text-[10px] font-bold text-gray-800 text-center uppercase tracking-wider mb-2 max-w-full truncate" title={bubbleIndColor}>
                                                {bubbleIndColor}
                                            </div>
                                            
                                            <div className="flex-1 flex items-center space-x-3 w-full justify-center">
                                                {/* Gradient Bar */}
                                                <div
                                                    className="w-4 h-full rounded-md shadow-inner border border-gray-300"
                                                    style={{
                                                        background: 'linear-gradient(to top, #0d0887, #6a00a8, #b12a90, #e16462, #fca636, #f0f921)'
                                                    }}
                                                />
                                                
                                                {/* Labels & Ticks */}
                                                <div className="h-full flex flex-col justify-between text-[10px] font-semibold text-gray-700">
                                                    <span>{typeof bubbleChartData.maxColor === 'number' ? bubbleChartData.maxColor.toFixed(1) : bubbleChartData.maxColor}</span>
                                                    <span>{typeof bubbleChartData.maxColor === 'number' && typeof bubbleChartData.minColor === 'number' ? ((bubbleChartData.maxColor + bubbleChartData.minColor) / 2).toFixed(1) : '-'}</span>
                                                    <span>{typeof bubbleChartData.minColor === 'number' ? bubbleChartData.minColor.toFixed(1) : bubbleChartData.minColor}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── RADAR / SPIDER CHART ────────────────────────────────────── */}
                            {activeProfile && activeProfile.length > 0 && selectedProfileIndicators.length >= 3 && (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col space-y-0">
                                    {/* Header */}
                                    <div className="px-4 pt-4 pb-3 border-b border-gray-800 flex items-center justify-between gap-2">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200">Radar Profile Comparison</h3>
                                            <p className="text-[11px] text-gray-400 font-medium">Normalized by column Maximum [0% to 100% of column max].</p>
                                        </div>
                                        <ExportButtons
                                            containerId="chart-radar-comparison"
                                            filename="radar_profile_comparison"
                                            chartTitle={`Radar Profile Comparison: ${unitName}`}
                                            chartType="radar"
                                            chartData={radarChartData}
                                            dataPrompt={`Radar Profile Comparison Chart for "${unitName}" unit.\n` +
                                                `Compared entities (${radarEntities.length}): ${radarEntities.join(', ')}.\n` +
                                                `Analyzed indicators (${selectedProfileIndicators.length}): ${selectedProfileIndicators.join(', ')}.\n` +
                                                `Values per indicator (% of column maximum and raw value in parentheses):\n` +
                                                radarChartData.map((row: any) => {
                                                    const entVals = radarEntities.map(ent => `${ent}: ${row[ent]}% (raw: ${row[`${ent}_raw`]})`).join(' | ');
                                                    return `- Indicator "${row.indicator}": ${entVals}`;
                                                }).join('\n')
                                            }
                                        />
                                    </div>

                                    {/* Entity Selection — dedicated scrollable row */}
                                    <div className="w-full max-w-full overflow-hidden shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/60">
                                        <div
                                            className="flex items-center gap-2 custom-scrollbar min-w-0"
                                            style={{ overflowX: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#94a3b8 transparent' }}
                                        >
                                            <span className="text-[10px] text-gray-400 font-semibold uppercase shrink-0 pr-1">Compare:</span>
                                            {selectedChartEntities.map(ent => (
                                                <button
                                                    key={ent}
                                                    onClick={() => {
                                                        setRadarEntities(prev =>
                                                            prev.includes(ent) ? prev.filter(e => e !== ent) : [...prev, ent]
                                                        );
                                                    }}
                                                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all border whitespace-nowrap shrink-0 ${
                                                        radarEntities.includes(ent)
                                                            ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                                                            : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-200'
                                                    }`}
                                                >
                                                    {ent}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="w-full flex justify-center items-center bg-white rounded-xl" style={{ height: 380 }} id="chart-radar-comparison">
                                        <ResponsiveContainer width="100%" height="100%" minHeight={340}>
                                            <RadarChart data={radarChartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                                                <PolarGrid stroke="#cbd5e1" />
                                                <PolarAngleAxis dataKey="indicator" stroke="#334155" tick={{ fontSize: 10, fill: '#1e293b', fontWeight: 600 }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 9, fill: '#475569' }} unit="%" />
                                                <RechartsTooltip
                                                    content={({ active, payload, label }) => {
                                                        if (!active || !payload || !payload.length) return null;
                                                        return (
                                                            <div className="bg-gray-900 border border-gray-700 p-3 rounded-xl shadow-xl text-xs space-y-1 z-50">
                                                                <p className="font-bold text-gray-200 border-b border-gray-800 pb-1">{label}</p>
                                                                {payload.map((entry: any) => (
                                                                    <p key={entry.name} style={{ color: entry.color }}>
                                                                        <span className="font-semibold">{entry.name}:</span> {entry.value}% <span className="text-gray-400 text-[10px]">({entry.payload[`${entry.name}_raw`]})</span>
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        );
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#1e293b' }} />
                                                {radarEntities.map((ent, i) => (
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
                                </div>
                            )}

                            {/* Quartiles Chart */}
                            {quartileChartData && quartileChartData.length > 0 ? (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col">
                                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200 flex items-center space-x-2 flex-wrap gap-1">
                                                <span>Quartile Distribution (Q1–Q4)</span>
                                                <span className="text-gray-500 font-normal text-xs">({quartileChartData.length} entities)</span>
                                                {isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0 && (
                                                    <span className="px-2 py-0.5 bg-indigo-950/80 border border-cyan-500/60 text-cyan-300 text-[10px] font-bold rounded-lg flex items-center space-x-1">
                                                        <Filter className="w-2.5 h-2.5" />
                                                        <span className="truncate max-w-[150px]">{filterIndicator} ≥ {filterMinValue}</span>
                                                    </span>
                                                )}
                                            </h3>
                                        </div>
                                        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                                            <ExportButtons
                                                containerId="chart-quartile-distribution"
                                                filename="quartile_distribution"
                                                chartTitle={`Quartile Distribution (Q1-Q4): ${unitName}`}
                                                chartType="bar"
                                                chartData={quartileChartData}
                                                dataPrompt={`Impact Quartile Distribution (Q1-Q4) for "${unitName}" unit.\n` +
                                                    `Total entities: ${quartileChartData.length}.\n` +
                                                    `Percentage breakdown across quartiles (Q1: Top 25%, Q2: 25-50%, Q3: 50-75%, Q4: 75-100%):\n` +
                                                    quartileChartData.slice(0, 30).map((q: any) =>
                                                        `- ${q.entity}: Q1=${q.Q1?.toFixed(1) || 0}%, Q2=${q.Q2?.toFixed(1) || 0}%, Q3=${q.Q3?.toFixed(1) || 0}%, Q4=${q.Q4?.toFixed(1) || 0}%`
                                                    ).join('\n')
                                                }
                                            />

                                            {/* Filter Trigger Button */}
                                            <button
                                                type="button"
                                                onClick={() => setIsFilterModalOpen(true)}
                                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 cursor-pointer ${
                                                    isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0
                                                        ? 'bg-indigo-900/60 text-cyan-300 border-cyan-500/80 shadow-md shadow-indigo-950'
                                                        : 'bg-gray-950 hover:bg-gray-800 text-gray-300 border-gray-800 hover:border-gray-700'
                                                }`}
                                                title="Filter entities by minimum threshold on any indicator"
                                            >
                                                <Filter className="w-3.5 h-3.5" />
                                                <span>{isFilterActive && filterMinValue !== '' && Number(filterMinValue) > 0 ? `Filter: ≥ ${filterMinValue}` : 'Filter Units'}</span>
                                            </button>

                                            {/* Limit Top 50 Checkbox */}
                                            <label 
                                                className="flex items-center space-x-1.5 text-xs text-gray-300 cursor-pointer select-none bg-gray-950 px-2.5 py-1.5 rounded-xl border border-gray-800 hover:border-gray-700" 
                                                title="Send at most 50 entities to Train SOM (Default: Active)"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={limitTop50}
                                                    onChange={(e) => setTlachiaState({ tlachiaLimitTop50: e.target.checked })}
                                                    className="w-3.5 h-3.5 bg-gray-950 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
                                                />
                                                <span className="font-semibold text-gray-200 text-[11px]">Max 50</span>
                                            </label>

                                            <button
                                                type="button"
                                                onClick={handleTrainSOMQuartiles}
                                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-900/30 transition-all flex items-center space-x-1.5 cursor-pointer shrink-0"
                                                title={`Train SOM with Q1-Q4 (${limitTop50 ? 'up to 50' : 'all'} filtered entities)`}
                                            >
                                                <Activity className="w-3.5 h-3.5" />
                                                <span>Train SOM</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="w-full overflow-y-auto custom-scrollbar h-[420px] bg-white rounded-xl" id="chart-quartile-distribution">
                                        <div style={{ height: dynamicChartHeight }}>
                                            <ResponsiveContainer width="100%" height={dynamicChartHeight} minHeight={300} key={`qchart_${sidebarTab}_${dynamicChartHeight}`}>
                                                <BarChart data={quartileChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                                <XAxis type="number" domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 10, fill: '#1e293b', fontWeight: 500 }} unit="%" />
                                                <YAxis dataKey="entity" type="category" width={160} stroke="#64748b" tick={{ fontSize: 9, fill: '#1e293b', fontWeight: 500 }} interval={0} />
                                                <RechartsTooltip
                                                    content={({ active, payload, label }) => {
                                                        if (!active || !payload || !payload.length) return null;
                                                        return (
                                                            <div className="bg-gray-900 border border-gray-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
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
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px', color: '#1e293b' }} />
                                                <Bar dataKey="Q1" name="Q1 (Top 25%)" stackId="q" fill="#6366f1" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Q2" name="Q2 (25%-50%)" stackId="q" fill="#34d399" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Q3" name="Q3 (50%-75%)" stackId="q" fill="#fbbf24" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Q4" name="Q4 (75%-100%)" stackId="q" fill="#f87171" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-40 flex flex-col justify-center items-center text-center">
                                    <h3 className="text-sm font-bold text-gray-300 mb-1">Quartile Distribution (Q1–Q4)</h3>
                                    <p className="text-xs text-gray-500 max-w-md">Esta unidad de análisis no contiene datos de distribución por cuartiles en los archivos cargados.</p>
                                </div>
                            )}

                            {/* ── Indicator Bar Charts Pair (Ordered Largest Top to Smallest Bottom) ── */}
                            {activeProfile && activeProfile.length > 0 && unit.indicators && unit.indicators.length > 0 && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Chart 1 */}
                                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col">
                                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                            <h3 className="text-xs font-bold text-gray-200 truncate max-w-[240px]" title={`${unitName}_${barInd1}`}>
                                                {unitName}_{barInd1}
                                            </h3>
                                            <div className="flex items-center space-x-2">
                                                <ExportButtons
                                                    containerId="chart-bar-1"
                                                    filename={`bar_${barInd1 || '1'}`}
                                                    chartTitle={`${unitName} Ranking by ${barInd1}`}
                                                    chartType="bar"
                                                    chartData={barData1}
                                                    dataPrompt={`Ranking of ${unitName} by "${barInd1}" indicator.\n` +
                                                        `Top classified entities:\n` +
                                                        barData1.slice(0, 25).map((d: any, i: number) => `${i + 1}. ${d.entity}: ${typeof d.value === 'number' ? d.value.toFixed(2) : d.value}`).join('\n')
                                                    }
                                                />
                                                <select
                                                    value={barInd1}
                                                    onChange={e => setBarInd1(e.target.value)}
                                                    className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 max-w-[200px] truncate"
                                                >
                                                    {unit.indicators.map((ind: string) => (
                                                        <option key={ind} value={ind}>{ind}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="w-full overflow-y-auto custom-scrollbar h-[520px] bg-white rounded-xl" id="chart-bar-1">
                                            <div style={{ height: dynamicChartHeight }}>
                                                <ResponsiveContainer width="100%" height={dynamicChartHeight} minHeight={300} key={`barchart1_${barInd1}_${dynamicChartHeight}`}>
                                                    <BarChart data={barData1} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                                    <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10, fill: '#1e293b', fontWeight: 500 }} />
                                                    <YAxis dataKey="entity" type="category" width={180} stroke="#64748b" tick={{ fontSize: 9, fill: '#1e293b', fontWeight: 500 }} interval={0} />
                                                    <RechartsTooltip
                                                        content={({ active, payload, label }) => {
                                                            if (!active || !payload || !payload.length) return null;
                                                            const val = payload[0].value;
                                                            return (
                                                                <div className="bg-gray-900 border border-gray-700 p-2.5 rounded-xl shadow-xl text-xs">
                                                                    <p className="font-bold text-gray-200">{label}</p>
                                                                    <p className="text-cyan-400 font-bold mt-1">
                                                                        {barInd1}: {typeof val === 'number' ? val.toFixed(2) : val}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }}
                                                    />
                                                    <Bar dataKey="value" name={barInd1} fill="#6366f1" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chart 2 */}
                                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col">
                                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                            <h3 className="text-xs font-bold text-gray-200 truncate max-w-[240px]" title={`${unitName}_${barInd2}`}>
                                                {unitName}_{barInd2}
                                            </h3>
                                            <div className="flex items-center space-x-2">
                                                <ExportButtons
                                                    containerId="chart-bar-2"
                                                    filename={`bar_${barInd2 || '2'}`}
                                                    chartTitle={`${unitName} Ranking by ${barInd2}`}
                                                    chartType="bar"
                                                    chartData={barData2}
                                                    dataPrompt={`Ranking of ${unitName} by "${barInd2}" indicator.\n` +
                                                        `Top classified entities:\n` +
                                                        barData2.slice(0, 25).map((d: any, i: number) => `${i + 1}. ${d.entity}: ${typeof d.value === 'number' ? d.value.toFixed(2) : d.value}`).join('\n')
                                                    }
                                                />
                                                <select
                                                    value={barInd2}
                                                    onChange={e => setBarInd2(e.target.value)}
                                                    className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 max-w-[200px] truncate"
                                                >
                                                    {unit.indicators.map((ind: string) => (
                                                        <option key={ind} value={ind}>{ind}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="w-full overflow-y-auto custom-scrollbar h-[520px] bg-white rounded-xl" id="chart-bar-2">
                                            <div style={{ height: dynamicChartHeight }}>
                                                <ResponsiveContainer width="100%" height={dynamicChartHeight} minHeight={300} key={`barchart2_${barInd2}_${dynamicChartHeight}`}>
                                                    <BarChart data={barData2} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                                    <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10, fill: '#1e293b', fontWeight: 500 }} />
                                                    <YAxis dataKey="entity" type="category" width={180} stroke="#64748b" tick={{ fontSize: 9, fill: '#1e293b', fontWeight: 500 }} interval={0} />
                                                    <RechartsTooltip
                                                        content={({ active, payload, label }) => {
                                                            if (!active || !payload || !payload.length) return null;
                                                            const val = payload[0].value;
                                                            return (
                                                                <div className="bg-gray-900 border border-gray-700 p-2.5 rounded-xl shadow-xl text-xs">
                                                                    <p className="font-bold text-gray-200">{label}</p>
                                                                    <p className="text-purple-400 font-bold mt-1">
                                                                        {barInd2}: {typeof val === 'number' ? val.toFixed(2) : val}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }}
                                                    />
                                                    <Bar dataKey="value" name={barInd2} fill="#a855f7" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Sunburst Hierarchy (Topic / Micro Topics only) */}
                            {(unitName === 'Research Areas Topic' || unitName === 'Micro Topics') && activeSunburst && activeSunburst.nodes && activeSunburst.nodes.length > 0 && (
                                <SunburstChart data={activeSunburst} />
                            )}
                        </>
                    )}
                </div>
            </div>
            {/* AI Assistant for Unit Profile */}
            <AIAssistantCard 
                cacheKey={`tlachia_${unitName}`}
                systemPrompt={`Eres un investigador cienciómetra sénior. Redacta exactamente de dos a tres párrafos con estilo de artículo científico (sección de Resultados y Discusión) analizando el perfil bibliométrico de TlachIA Metrics de la unidad "${unitName}". Describe la estructura general de producción, profundiza en las entidades con mayor impacto normalizado (CNCI/citas) y sintetiza las implicaciones metodológicas e institucionales.`}
                contextData={{
                    unidad: unitName,
                    indicadores_disponibles: unit.indicators,
                    top_20_entidades: unit.profile?.slice(0, 20) || []
                }}
            />

            {/* ── GLOBAL FILTER UNITS MODAL DIALOG (Rendered directly via Portal to body) ── */}
            {isFilterModalOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[999999] bg-gray-950/85 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-150 relative z-[999999]">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <div className="flex items-center space-x-2.5">
                                <div className="p-2 bg-indigo-950/80 border border-cyan-500/50 rounded-xl text-cyan-400 shadow-inner">
                                    <Filter className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-200 uppercase tracking-wider">
                                        Filter Units for SOM
                                    </h3>
                                    <p className="text-[10px] text-gray-400">
                                        Select indicator and minimum threshold to filter before SOM training.
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsFilterModalOpen(false)}
                                className="text-gray-500 hover:text-gray-300 text-xs font-bold p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Indicator to filter by */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                                Filter Indicator (from dataset):
                            </label>
                            <select
                                value={filterIndicator}
                                onChange={(e) => setTlachiaState({ tlachiaFilterIndicator: e.target.value })}
                                className="w-full bg-gray-950 border border-gray-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none cursor-pointer"
                            >
                                {unit.indicators?.map((ind: string) => (
                                    <option key={ind} value={ind}>{ind}</option>
                                ))}
                            </select>
                        </div>

                        {/* Minimum threshold input */}
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                                Minimum Threshold (≥):
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="e.g. 10"
                                value={filterMinValue}
                                onChange={(e) => setTlachiaState({ tlachiaFilterMinValue: e.target.value })}
                                className="w-full bg-gray-950 border border-gray-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none"
                            />
                            {/* Quick Presets */}
                            <div className="flex items-center space-x-1.5 pt-1 flex-wrap gap-y-1">
                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mr-1">Presets:</span>
                                {[5, 10, 25, 50, 100].map((val) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => {
                                            setTlachiaState({
                                                tlachiaFilterMinValue: val,
                                                tlachiaIsFilterActive: true,
                                                tlachiaLimitTop50: false // Automatically uncheck Max 50 on filter selection!
                                            });
                                        }}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition border cursor-pointer ${
                                            Number(filterMinValue) === val
                                                ? 'bg-cyan-600 text-white border-cyan-500'
                                                : 'bg-gray-950 hover:bg-gray-800 text-gray-300 border-gray-800'
                                        }`}
                                    >
                                        ≥ {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Real-time Match Summary Card */}
                        <div className="bg-gray-950/80 rounded-xl p-3 border border-gray-800/80 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-gray-400">
                                <span>Total Entities:</span>
                                <span className="font-mono font-bold text-gray-200">{activeProfile?.length ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-cyan-300 font-semibold">
                                <span>Matching Criteria (≥ {filterMinValue || 0}):</span>
                                <span className="font-mono font-bold text-emerald-400">
                                    {matchingFilterCount} units {activeProfile?.length ? `(${((matchingFilterCount / activeProfile.length) * 100).toFixed(0)}%)` : ''}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-gray-400 border-t border-gray-800/60 pt-1.5 text-[11px]">
                                <span>Sent to SOM {limitTop50 ? '(Max 50 limit)' : '(All matching)'}:</span>
                                <span className="font-mono font-bold text-white">
                                    {limitTop50 ? Math.min(matchingFilterCount, 50) : matchingFilterCount} units
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 pt-2 border-t border-gray-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setTlachiaState({
                                        tlachiaFilterMinValue: '',
                                        tlachiaIsFilterActive: false
                                    });
                                    setIsFilterModalOpen(false);
                                }}
                                className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition cursor-pointer"
                            >
                                Clear Filter
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const hasVal = filterMinValue !== '' && Number(filterMinValue) > 0;
                                    setTlachiaState({
                                        tlachiaIsFilterActive: hasVal,
                                        tlachiaLimitTop50: hasVal ? false : limitTop50 // Automatically uncheck Max 50 when active filter is applied!
                                    });
                                    setIsFilterModalOpen(false);
                                }}
                                className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-950"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>Apply Filter</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};


const PREFERRED_TLACHIA_ORDER = [
    'Locations',
    'Locations Subnational',
    'Publication Sources',
    'Organizations',
    'Organizations Colab',
    'Sector Types',
    'Researchers',
    'Funding Agencies',
    'Research Areas Domain',
    'Research Areas Field',
    'Research Areas Subfield',
    'Research Areas Topic',
    'Research Areas ESI',
    'Research Areas SDG',
    'Concepts',
    'Keywords',
    'Economic APC Breakdown',
    // Legacy InCites names (backwards compat)
    'SDG',
    'ESI',
    'WoS Categories',
    'Macro Topics',
    'Meso Topics',
    'Micro Topics',
];

const sortTlachIAUnits = (names: string[]): string[] => {
    return [...names].sort((a, b) => {
        const idxA = PREFERRED_TLACHIA_ORDER.indexOf(a);
        const idxB = PREFERRED_TLACHIA_ORDER.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });
};

// ── Data Indicators Panel Component ───────────────────────────────────────
const TlachIADataIndicatorsPanel: React.FC = () => {
    const { tlachiaBaseline, tlachiaSelectedBaselineSource, setTlachiaState } = useSomStore();
    const [selectedIndicator, setSelectedIndicator] = useState<string>('Category Normalized Citation Impact');

    if (!tlachiaBaseline || !tlachiaBaseline.sources) {
        return (
            <div className="p-8 text-center text-gray-500 bg-gray-900 border border-gray-800 rounded-2xl">
                No baseline indicators found in uploaded files.
            </div>
        );
    }

    const sourceKeys = Object.keys(tlachiaBaseline.sources);
    const activeSourceKey = tlachiaSelectedBaselineSource && tlachiaBaseline.sources[tlachiaSelectedBaselineSource] 
        ? tlachiaSelectedBaselineSource 
        : (tlachiaBaseline.default_source || sourceKeys[0]);

    const activeSource = tlachiaBaseline.sources[activeSourceKey];

    if (!activeSource) return null;

    const summaryItems: any[] = activeSource.summary || [];
    const trendData: any[] = activeSource.trend || [];
    const indicators: string[] = activeSource.indicators || [];

    const datasetBaselineSummary = summaryItems.find(s => s.name?.toLowerCase().includes('dataset')) || summaryItems[0];
    const allItemsBaselineSummary = summaryItems.find(s => s.name?.toLowerCase().includes('all items')) || summaryItems[1];

    // Format trend data for WoS Documents & Times Cited growth chart
    // Format trend data for WoS Documents & Times Cited growth chart (prioritizing Baseline for All Items)
    const growthChartData = trendData.map(item => {
        const datasetDocs = item['Dataset Baseline']?.['Documents'] ?? 0;
        const datasetCites = item['Dataset Baseline']?.['Times Cited'] ?? 0;
        const allItemsDocs = item['Baseline for All Items']?.['Documents'] ?? 0;
        const allItemsCites = item['Baseline for All Items']?.['Times Cited'] ?? 0;

        const finalAllItemsDocs = allItemsDocs > 0 ? allItemsDocs : datasetDocs;
        const finalAllItemsCites = allItemsCites > 0 ? allItemsCites : datasetCites;

        const isDistinct = (datasetDocs > 0 || datasetCites > 0) &&
            (datasetDocs !== finalAllItemsDocs || datasetCites !== finalAllItemsCites);

        return {
            year: item.year,
            'All Items WoS Docs': finalAllItemsDocs,
            'All Items Times Cited': finalAllItemsCites,
            'Dataset WoS Docs': datasetDocs,
            'Dataset Times Cited': datasetCites,
            isDistinct
        };
    });

    // Format trend data for selected indicator
    const currentInd = indicators.includes(selectedIndicator) ? selectedIndicator : (indicators[0] || 'Category Normalized Citation Impact');
    
    const indicatorChartData = trendData.map(item => {
        const datasetVal = item['Dataset Baseline']?.[currentInd] ?? 0;
        const allItemsVal = item['Baseline for All Items']?.[currentInd] ?? 0;
        const finalAllItemsVal = allItemsVal !== 0 ? allItemsVal : datasetVal;
        const isDistinct = datasetVal !== 0 && datasetVal !== finalAllItemsVal;

        return {
            year: item.year,
            'Baseline for All Items': finalAllItemsVal,
            'Dataset Baseline': datasetVal,
            isDistinct
        };
    });

    return (
        <div className="flex flex-col space-y-6 overflow-y-auto custom-scrollbar h-full pr-2">
            {/* Header & Source Selector */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg">
                <div>
                    <div className="flex items-center space-x-3">
                        <h3 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
                            <span>Data Indicators</span>
                            <span className="text-xs bg-indigo-950 text-cyan-300 border border-indigo-700/60 px-2.5 py-0.5 rounded-full font-semibold">
                                Global Baseline
                            </span>
                        </h3>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                        Global metrics for the loaded dataset filter vs. Web of Science All Items baseline.
                    </p>
                </div>

                <div className="flex items-center space-x-3 bg-gray-950 p-2 rounded-xl border border-gray-800">
                    <span className="text-xs font-semibold text-gray-400 pl-1">Baseline Source:</span>
                    <span className="text-xs text-cyan-400 font-bold bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-800">
                        {activeSource.whole_filename || activeSource.trend_filename || activeSourceKey}
                    </span>
                    {sourceKeys.length > 1 && (
                        <select
                            value={activeSourceKey}
                            onChange={e => setTlachiaState({ tlachiaSelectedBaselineSource: e.target.value })}
                            className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-lg px-2.5 py-1 font-medium focus:outline-none focus:border-cyan-500"
                        >
                            {sourceKeys.map(k => (
                                <option key={k} value={k}>{k} ({tlachiaBaseline.sources[k].whole_filename || k})</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* SECTION 1: Baseline Summary Cards & Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5 shadow-lg">
                <h4 className="text-sm font-bold text-gray-200 uppercase tracking-wider border-b border-gray-800 pb-2 flex items-center space-x-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>Sección 1: Indicadores Baseline Comparativos</span>
                </h4>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
                        <span className="text-xs font-semibold text-gray-400">Web of Science Documents</span>
                        <div className="mt-2 flex items-baseline justify-between">
                            <div>
                                <p className="text-2xl font-black text-white">{datasetBaselineSummary?.['Documents']?.toLocaleString() ?? '-'}</p>
                                <p className="text-[10px] text-cyan-400 font-medium">Dataset Baseline</p>
                            </div>
                            {allItemsBaselineSummary && (
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-400">{allItemsBaselineSummary['Documents']?.toLocaleString() ?? '-'}</p>
                                    <p className="text-[10px] text-gray-500">All Items</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
                        <span className="text-xs font-semibold text-gray-400">Times Cited</span>
                        <div className="mt-2 flex items-baseline justify-between">
                            <div>
                                <p className="text-2xl font-black text-amber-400">{datasetBaselineSummary?.['Times Cited']?.toLocaleString() ?? '-'}</p>
                                <p className="text-[10px] text-cyan-400 font-medium">Dataset Baseline</p>
                            </div>
                            {allItemsBaselineSummary && (
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-400">{allItemsBaselineSummary['Times Cited']?.toLocaleString() ?? '-'}</p>
                                    <p className="text-[10px] text-gray-500">All Items</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
                        <span className="text-xs font-semibold text-gray-400">Category Norm. Citation Impact (CNCI)</span>
                        <div className="mt-2 flex items-baseline justify-between">
                            <div>
                                <p className="text-2xl font-black text-emerald-400">{typeof datasetBaselineSummary?.['Category Normalized Citation Impact'] === 'number' ? datasetBaselineSummary['Category Normalized Citation Impact'].toFixed(2) : '-'}</p>
                                <p className="text-[10px] text-cyan-400 font-medium">Dataset Baseline</p>
                            </div>
                            {allItemsBaselineSummary && (
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-400">{typeof allItemsBaselineSummary['Category Normalized Citation Impact'] === 'number' ? allItemsBaselineSummary['Category Normalized Citation Impact'].toFixed(2) : '-'}</p>
                                    <p className="text-[10px] text-gray-500">All Items</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
                        <span className="text-xs font-semibold text-gray-400">% Documents Cited</span>
                        <div className="mt-2 flex items-baseline justify-between">
                            <div>
                                <p className="text-2xl font-black text-sky-400">{datasetBaselineSummary?.['% Docs Cited'] != null ? `${datasetBaselineSummary['% Docs Cited']}%` : '-'}</p>
                                <p className="text-[10px] text-cyan-400 font-medium">Dataset Baseline</p>
                            </div>
                            {allItemsBaselineSummary && (
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-400">{allItemsBaselineSummary['% Docs Cited'] != null ? `${allItemsBaselineSummary['% Docs Cited']}%` : '-'}</p>
                                    <p className="text-[10px] text-gray-500">All Items</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Side by Side Comparison Table */}
                <div className="overflow-x-auto custom-scrollbar rounded-xl border border-gray-800 max-h-80">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-gray-950 text-gray-400 font-semibold border-b border-gray-800 sticky top-0">
                            <tr>
                                <th className="py-3 px-4 bg-gray-950">Bibliometric Indicator</th>
                                <th className="py-3 px-4 text-right text-cyan-400 bg-gray-950">Dataset Baseline</th>
                                <th className="py-3 px-4 text-right text-gray-400 bg-gray-950">Baseline for All Items</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60 bg-gray-900/40">
                            {indicators.map(indKey => {
                                const val1 = datasetBaselineSummary?.[indKey];
                                const val2 = allItemsBaselineSummary?.[indKey];
                                return (
                                    <tr key={indKey} className="hover:bg-gray-800/40 transition-colors">
                                        <td className="py-2.5 px-4 font-medium text-gray-200">{indKey}</td>
                                        <td className="py-2.5 px-4 text-right font-bold text-cyan-300">
                                            {typeof val1 === 'number' ? (val1 % 1 !== 0 ? val1.toFixed(2) : val1.toLocaleString()) : (val1 ?? '-')}
                                        </td>
                                        <td className="py-2.5 px-4 text-right font-semibold text-gray-400">
                                            {typeof val2 === 'number' ? (val2 % 1 !== 0 ? val2.toFixed(2) : val2.toLocaleString()) : (val2 ?? '-')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION 2: Baseline Time Series Charts */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-6 shadow-lg">
                <h4 className="text-sm font-bold text-gray-200 uppercase tracking-wider border-b border-gray-800 pb-2 flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <span>Section 2: Baseline Time Series Charts</span>
                </h4>

                {/* Chart 1: Web of Science Documents & Times Cited Growth */}
                <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-4 flex flex-col space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                            <h5 className="text-sm font-bold text-white">Document & Citation Growth</h5>
                            <p className="text-[11px] text-gray-400">Time series evolution of Web of Science Documents and Times Cited by publication year.</p>
                        </div>
                        <ExportButtons
                            containerId="chart-baseline-growth"
                            filename="baseline_document_citation_growth"
                            chartTitle="Baseline Document & Citation Growth"
                            chartType="trend"
                            chartData={growthChartData}
                            dataPrompt={`Time series of Web of Science production and citations (Reference Baseline).\n` +
                                `Years included: ${growthChartData.map((d: any) => d.year).join(', ')}.\n` +
                                `Annual breakdown:\n` +
                                growthChartData.map((d: any) => `- Year ${d.year}: WoS Documents = ${d['All Items WoS Docs']}, Times Cited = ${d['All Items Times Cited']}`).join('\n')
                            }
                        />
                    </div>

                    <div className="w-full min-h-[350px]" id="chart-baseline-growth">
                        <ResponsiveContainer width="100%" height={350} minHeight={350}>
                            <LineChart data={growthChartData} margin={{ top: 10, right: 35, left: 15, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 10, fill: '#cbd5e1' }} />
                                <YAxis yAxisId="left" stroke="#06b6d4" tick={{ fontSize: 10, fill: '#22d3ee' }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fontSize: 10, fill: '#fbbf24' }} />
                                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                <Line yAxisId="left" type="monotone" dataKey="All Items WoS Docs" stroke="#06b6d4" strokeWidth={2.5} dot={false} name="All Items WoS Docs (Eje Izq.)" />
                                <Line yAxisId="right" type="monotone" dataKey="All Items Times Cited" stroke="#f59e0b" strokeWidth={2.5} dot={false} name="All Items Times Cited (Eje Der.)" />
                                {growthChartData.some(d => d.isDistinct) && (
                                    <>
                                        <Line yAxisId="left" type="monotone" dataKey="Dataset WoS Docs" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Dataset WoS Docs (Eje Izq.)" />
                                        <Line yAxisId="right" type="monotone" dataKey="Dataset Times Cited" stroke="#d97706" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Dataset Times Cited (Eje Der.)" />
                                    </>
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2: Dropdown Indicator Selector Chart */}
                <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-4 flex flex-col space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                            <h5 className="text-sm font-bold text-white">Selectable Indicator Over Time</h5>
                            <p className="text-[11px] text-gray-400">Select any indicator to inspect its annual trend.</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <ExportButtons
                                containerId="chart-baseline-indicator"
                                filename={`baseline_${currentInd.replace(/\s+/g, '_')}`}
                                chartTitle={`Baseline Indicator Trend: ${currentInd}`}
                                chartType="trend"
                                chartData={indicatorChartData}
                                dataPrompt={`Time series trend for indicator "${currentInd}" across the reference baseline (TlachIA Metrics Baseline).\n` +
                                    `Values by publication year:\n` +
                                    indicatorChartData.map((d: any) => `- Year ${d.year}: Baseline = ${d['Baseline for All Items']}`).join('\n')
                                }
                            />
                            <select
                                value={currentInd}
                                onChange={e => setSelectedIndicator(e.target.value)}
                                className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-lg px-3 py-1.5 font-bold focus:outline-none focus:border-cyan-500 max-w-[280px] truncate"
                            >
                                {indicators.map(ind => (
                                    <option key={ind} value={ind}>{ind}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="w-full min-h-[350px]" id="chart-baseline-indicator">
                        <ResponsiveContainer width="100%" height={350} minHeight={350}>
                            <LineChart data={indicatorChartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 10, fill: '#cbd5e1' }} />
                                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#cbd5e1' }} />
                                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                <Line type="monotone" dataKey="Baseline for All Items" stroke="#10b981" strokeWidth={2.5} dot={false} name={`All Items Baseline (${currentInd})`} />
                                {indicatorChartData.some(d => d.isDistinct) && (
                                    <Line type="monotone" dataKey="Dataset Baseline" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name={`Dataset Baseline (${currentInd})`} />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Main Explorer Shell ────────────────────────────────────────────────────
export const TlachIAMetricsExplorer: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoadingUnit, setIsLoadingUnit] = useState(false);

    // Get state and setters from global store to persist across tab changes
    const { 
        tlachiaUnitNames: unitNames, 
        tlachiaUnitCache: unitCache, 
        tlachiaActiveUnit: activeUnit, 
        tlachiaIsUploading: isUploading,
        tlachiaBaseline: baselineData,
        semanticRecords,
        uploadTlachIAFiles,
        setTlachiaState 
    } = useSomStore();

    // Helper setters to keep code similar
    const setActiveUnit = (unit: string | null) => setTlachiaState({ tlachiaActiveUnit: unit });

    const sortedUnitNames = useMemo(() => {
        if (!unitNames) return [];
        return sortTlachIAUnits(unitNames);
    }, [unitNames]);

    const allUnitNames = useMemo(() => {
        if (!sortedUnitNames) return [];
        if (baselineData && baselineData.sources && Object.keys(baselineData.sources).length > 0) {
            return ['Data Indicators', ...sortedUnitNames];
        }
        return sortedUnitNames;
    }, [sortedUnitNames, baselineData]);

    // Ensure default active tab is Data Indicators if available, or Locations
    useEffect(() => {
        if (allUnitNames.length > 0 && (!activeUnit || !allUnitNames.includes(activeUnit))) {
            const defaultUnit = allUnitNames.includes('Data Indicators') ? 'Data Indicators' : (sortedUnitNames.includes('Locations') ? 'Locations' : sortedUnitNames[0]);
            setActiveUnit(defaultUnit);
        }
    }, [allUnitNames, sortedUnitNames, activeUnit]);

    // ── Step 1: Upload → get names only ───────────────────────────────
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const formData = new FormData();
        Array.from(e.target.files).forEach(file => formData.append('files', file));

        // Background upload in store (persists across tab changes)
        uploadTlachIAFiles(formData);

        // Reset input so the same file can be re-uploaded
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Step 2: Tab click → fetch that unit on demand ─────────────────
    useEffect(() => {
        if (!activeUnit || activeUnit === 'Data Indicators') return;
        if (unitCache[activeUnit]) return; // already fetched

        const fetchUnit = async () => {
            setIsLoadingUnit(true);
            try {
                const res = await fetch(getApiUrl(`/api/tlachia/unit/${encodeURIComponent(activeUnit)}`));
                const data = await res.json();
                if (data.success && data.unit) {
                    setTlachiaState({
                        tlachiaUnitCache: { ...useSomStore.getState().tlachiaUnitCache, [activeUnit]: data.unit }
                    });
                } else {
                    alert(`Error cargando la unidad '${activeUnit}': ${data.error}`);
                }
            } catch (err) {
                alert(`Error cargando la unidad '${activeUnit}': ${err}`);
            } finally {
                setIsLoadingUnit(false);
            }
        };

        fetchUnit();
    }, [activeUnit, unitCache]);

    const currentUnit = (activeUnit && activeUnit !== 'Data Indicators') ? unitCache[activeUnit] : null;

    return (
        <div className="flex flex-col h-full bg-gray-950 p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">TlachIA Metrics Data</h2>
                    <p className="text-sm text-gray-400 mt-1">Explore and process OpenAlex TlachIA bibliometric indicators</p>
                </div>
                <div className="flex items-center space-x-4">
                    {semanticRecords && semanticRecords.length > 0 && (
                        <div className="px-3 py-1.5 bg-emerald-950/70 border border-emerald-700/80 text-emerald-300 text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-sm animate-fade-in">
                            <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span><strong>OpenAlex Works:</strong> {semanticRecords.length.toLocaleString()} trabajos vinculados</span>
                        </div>
                    )}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-cyan-900/50 transition flex items-center space-x-2 disabled:opacity-50"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>{isUploading ? 'Processing...' : 'Upload ZIP / Excel'}</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        accept=".zip,.csv,.xlsx"
                        onChange={handleUpload}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Empty state or no units state */}
            {(!unitNames || unitNames.length === 0) && !isUploading && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-800 rounded-3xl p-8 text-center">
                    <BarChart2 className="w-16 h-16 mb-4 text-gray-700" />
                    {unitNames && unitNames.length === 0 ? (
                        <>
                            <p className="text-gray-300 font-semibold text-base mb-1">No recognized TlachIA Metrics units found</p>
                            <p className="text-xs text-gray-500 max-w-md">
                                Upload a ZIP archive generated by <span className="text-cyan-400">openalex_indicators_engine</span> (e.g. <span className="text-cyan-400">metricas_*.zip</span>) containing TlachIA Metrics exports.
                            </p>
                        </>
                    ) : (
                        <p>Upload TlachIA Metrics CSV/Excel files or a ZIP file to get started.</p>
                    )}
                </div>
            )}

            {/* Processing spinner */}
            {isUploading && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <Loader2 className="w-12 h-12 animate-spin mb-4 text-cyan-500" />
                    <p className="text-sm font-medium">Processing TlachIA Metrics files…</p>
                    <p className="text-xs text-gray-600 mt-1">This may take 30–60 seconds for large ZIPs</p>
                </div>
            )}

            {/* Tabs + content */}
            {allUnitNames && allUnitNames.length > 0 && (
                <div className="flex-1 flex flex-col space-y-4 min-h-0">
                    {/* Unit Tabs */}
                    <div className="flex space-x-2 border-b border-gray-800 pb-2 overflow-x-auto shrink-0">
                        {allUnitNames.map(name => (
                            <button
                                key={name}
                                onClick={() => setActiveUnit(name)}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${activeUnit === name
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                    }`}
                            >
                                {name}
                                {name === 'Data Indicators' ? (
                                    <span className="ml-1.5 inline-block w-2 h-2 bg-indigo-400 rounded-full align-middle animate-pulse" />
                                ) : (
                                    unitCache[name] && <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full align-middle" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 min-h-0">
                        {activeUnit === 'Data Indicators' ? (
                            <TlachIADataIndicatorsPanel />
                        ) : (
                            <>
                                {isLoadingUnit && (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <Loader2 className="w-8 h-8 animate-spin mb-3 text-cyan-400" />
                                        <p className="text-sm">Cargando {activeUnit}…</p>
                                    </div>
                                )}
                                {!isLoadingUnit && currentUnit && (
                                    <TlachIAUnitPanel unitName={activeUnit!} unit={currentUnit} />
                                )}
                                {!isLoadingUnit && !currentUnit && activeUnit && (
                                    <div className="flex items-center justify-center h-full text-gray-600">
                                        <p>Selecciona una pestaña para ver sus datos.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
