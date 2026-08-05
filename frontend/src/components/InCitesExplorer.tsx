import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Activity, BarChart2, CheckSquare, Square, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useSomStore, getApiUrl } from '../store/somStore';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';

// ── Unit Detail Panel ──────────────────────────────────────────────────────
// Receives the already-loaded data for ONE unit and renders its charts/table.
const UnitPanel: React.FC<{ unitName: string; unit: any }> = ({ unit }) => {
    const [selectedProfileIndicators, setSelectedProfileIndicators] = useState<string[]>([]);
    const [isProfileExpanded, setIsProfileExpanded] = useState<boolean>(false);
    const [tsIndicator, setTsIndicator] = useState<string>('');
    const [tsSmoothing, setTsSmoothing] = useState<'raw' | 'ecma3' | 'ecma5'>('raw');
    const { loadCsvData, setActiveTab, setConfig } = useSomStore();

    // Initialise defaults when unit data arrives
    useEffect(() => {
        if (!unit) return;
        if (unit.indicators && unit.indicators.length > 0) {
            const defaults = ['Share', 'National Share (%, E-3)', 'Category Normalized Citation Impact', '% Documents in Top 10%', 'Impact Factor'];
            const initialSelected = unit.indicators.filter((ind: string) => defaults.includes(ind));
            if (initialSelected.length === 0) initialSelected.push(unit.indicators[0]);
            setSelectedProfileIndicators(initialSelected);
        }
        if (unit.time_series) {
            const tsKeys = Object.keys(unit.time_series);
            if (tsKeys.length > 0) {
                setTsIndicator(tsKeys.includes('Web of Science Documents') ? 'Web of Science Documents' : tsKeys[0]);
            }
        }
    }, [unit]);

    const toggleProfileIndicator = (ind: string) => {
        setSelectedProfileIndicators(prev =>
            prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
        );
    };

    const handleTrainSOM = () => {
        if (!unit || selectedProfileIndicators.length === 0) return;
        if (!unit.profile || unit.profile.length === 0) {
            alert("No profile data available for this unit.");
            return;
        }
        let csvContent = "Entity," + selectedProfileIndicators.join(",") + "\n";
        unit.profile.forEach((row: any) => {
            const rowData = [
                `"${row.entity}"`,
                ...selectedProfileIndicators.map(ind => row[ind] ?? 0)
            ];
            csvContent += rowData.join(",") + "\n";
        });
        loadCsvData(csvContent, 0, [], 'csv');
        setConfig({ method: 'batch', init: 'pca' });
        setActiveTab('multidimensional');
    };

    // Build chart data for time series
    const { tsChartData, tsEntities, totalEntities } = useMemo(() => {
        if (!unit?.time_series || !tsIndicator || !unit.time_series[tsIndicator]) {
            return { tsChartData: [], tsEntities: [], totalEntities: 0 };
        }
        const rawSeries: any[] = unit.time_series[tsIndicator];
        if (!rawSeries || rawSeries.length === 0) {
            return { tsChartData: [], tsEntities: [], totalEntities: 0 };
        }

        // Sort by last value and take top 20
        const seriesWithScore = rawSeries.map((series: any) => {
            const values = series[tsSmoothing];
            const lastVal = (values && values.length > 0) ? values[values.length - 1] : 0;
            return { ...series, _score: lastVal };
        });
        seriesWithScore.sort((a, b) => b._score - a._score);
        const topSeries = seriesWithScore.slice(0, 20);

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
    }, [unit, tsIndicator, tsSmoothing]);

    const colors = ['#818cf8', '#34d399', '#f87171', '#fbbf24', '#c084fc', '#2dd4bf', '#fb923c', '#f472b6',
                    '#60a5fa', '#a78bfa', '#4ade80', '#facc15', '#f97316', '#ec4899', '#22d3ee', '#84cc16'];

    return (
        <div className="flex flex-col h-full space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Controls Sidebar */}
                <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col space-y-6">
                    <div>
                        <button
                            onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                            className="w-full flex items-center justify-between text-left group mb-2 bg-transparent border-0"
                        >
                            <div>
                                <h3 className="text-sm font-bold text-gray-200 group-hover:text-indigo-400 transition-colors">Multidimensional Profile</h3>
                                <p className="text-xs text-gray-500">Select indicators for the profile table and SOM export.</p>
                            </div>
                            {isProfileExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        </button>

                        {isProfileExpanded && (
                            <div className="max-h-48 overflow-y-auto space-y-1 pr-2 mt-3 bg-gray-950 p-2 rounded-xl border border-gray-800">
                                {unit.indicators?.map((ind: string) => (
                                    <button
                                        key={ind}
                                        onClick={() => toggleProfileIndicator(ind)}
                                        className={`flex items-center space-x-2 text-xs w-full text-left p-1.5 rounded transition border-0 ${
                                            selectedProfileIndicators.includes(ind)
                                                ? 'bg-gray-800 hover:bg-gray-800'
                                                : 'bg-transparent hover:bg-gray-800'
                                        }`}
                                    >
                                        {selectedProfileIndicators.includes(ind)
                                            ? <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                                            : <Square className="w-4 h-4 text-gray-600 shrink-0" />
                                        }
                                        <span className={`truncate ${selectedProfileIndicators.includes(ind) ? 'text-gray-200' : 'text-gray-500'}`} title={ind}>
                                            {ind}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-200 mb-3">Time Series Config</h3>
                        <select
                            value={tsIndicator}
                            onChange={e => setTsIndicator(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 mb-2"
                        >
                            {unit.time_series && Object.keys(unit.time_series).map(ind => (
                                <option key={ind} value={ind}>{ind}</option>
                            ))}
                        </select>
                        <div className="flex space-x-2">
                            {(['raw', 'ecma3', 'ecma5'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setTsSmoothing(mode)}
                                    className={`flex-1 text-[10px] uppercase font-bold py-1.5 rounded-lg border ${
                                        tsSmoothing === mode
                                        ? 'bg-indigo-600 border-indigo-500 text-white'
                                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-800 mt-auto">
                        <button
                            onClick={handleTrainSOM}
                            disabled={selectedProfileIndicators.length === 0}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-900/50 transition-all flex items-center justify-center space-x-2"
                        >
                            <Activity className="w-4 h-4" />
                            <span>Entrenar en SOM</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3 flex flex-col space-y-6">

                    {/* Time Series Chart */}
                    {tsChartData.length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 h-80 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-200">
                                    {tsIndicator} ({tsSmoothing.toUpperCase()})
                                    {tsEntities.length > 0 && <span className="text-gray-500 ml-2 font-normal">(Top {tsEntities.length} de {totalEntities})</span>}
                                </h3>
                            </div>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={tsChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                        <XAxis dataKey="time" stroke="#4b5563" tick={{fontSize: 10}} />
                                        <YAxis stroke="#4b5563" tick={{fontSize: 10}} width={40} />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', fontSize: '12px' }}
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
                    )}

                    {/* Quartiles Chart */}
                    {unit.quartiles && unit.quartiles.length > 0 && (
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 h-64 flex flex-col">
                            <h3 className="text-sm font-bold text-gray-200 mb-4">Quartile Distribution</h3>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={unit.quartiles.slice(0, 20)} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="entity" type="category" width={150} stroke="#4b5563" tick={{fontSize: 9}} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', fontSize: '12px' }}/>
                                        <Legend wrapperStyle={{ fontSize: '10px' }}/>
                                        <Bar dataKey="Q1" stackId="q" fill="#6366f1" />
                                        <Bar dataKey="Q2" stackId="q" fill="#34d399" />
                                        <Bar dataKey="Q3" stackId="q" fill="#fbbf24" />
                                        <Bar dataKey="Q4" stackId="q" fill="#f87171" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Table */}
            {unit.profile && unit.profile.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-gray-800">
                        <h3 className="text-sm font-bold text-gray-200">
                            Profile Data
                            <span className="text-gray-500 ml-2 font-normal text-xs">({unit.profile.length} entities)</span>
                        </h3>
                    </div>
                    <div className="overflow-x-auto max-h-64">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
                                <tr>
                                    <th className="text-left px-4 py-2 text-gray-400 font-semibold whitespace-nowrap">Entity</th>
                                    {unit.indicators?.slice(0, 8).map((ind: string) => (
                                        <th key={ind} className="text-right px-3 py-2 text-gray-400 font-semibold whitespace-nowrap">{ind}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {unit.profile.slice(0, 100).map((row: any, i: number) => (
                                    <tr key={i} className="hover:bg-gray-800/40 transition-colors">
                                        <td className="px-4 py-1.5 text-gray-300 max-w-[200px] truncate">{row.entity}</td>
                                        {unit.indicators?.slice(0, 8).map((ind: string) => (
                                            <td key={ind} className="px-3 py-1.5 text-right text-gray-400">
                                                {typeof row[ind] === 'number' ? row[ind].toFixed(2) : row[ind] ?? '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};


// ── Main Explorer Shell ────────────────────────────────────────────────────
export const InCitesExplorer: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingUnit, setIsLoadingUnit] = useState(false);
    
    // Get state and setter from global store to persist across tab changes
    const { incitesUnitNames: unitNames, incitesUnitCache: unitCache, incitesActiveUnit: activeUnit, setIncitesState } = useSomStore();

    // Helper setters to keep code similar
    const setUnitNames = (names: string[] | null) => setIncitesState({ incitesUnitNames: names });
    const setActiveUnit = (unit: string | null) => setIncitesState({ incitesActiveUnit: unit });
    const setUnitCache = (value: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => {
        if (typeof value === 'function') {
            setIncitesState({ incitesUnitCache: value(unitCache) });
        } else {
            setIncitesState({ incitesUnitCache: value });
        }
    };

    // ── Step 1: Upload → get names only ───────────────────────────────
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setIsUploading(true);
        setUnitNames(null);
        setUnitCache({});
        setActiveUnit(null);

        const formData = new FormData();
        Array.from(e.target.files).forEach(file => formData.append('files', file));

        try {
            const response = await fetch(getApiUrl('/api/incites/process'), {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (!data.success) {
                alert("Error procesando InCites: " + data.error);
                return;
            }

            const names: string[] = data.unit_names ?? [];
            setUnitNames(names);

            // Auto-select first unit
            if (names.length > 0) {
                const first = names.includes('Researchers') ? 'Researchers' : names[0];
                setActiveUnit(first);
            }
        } catch (err) {
            alert('Upload failed: ' + err);
        } finally {
            setIsUploading(false);
            // Reset input so the same file can be re-uploaded
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Step 2: Tab click → fetch that unit on demand ─────────────────
    useEffect(() => {
        if (!activeUnit) return;
        if (unitCache[activeUnit]) return; // already fetched

        const fetchUnit = async () => {
            setIsLoadingUnit(true);
            try {
                const res = await fetch(getApiUrl(`/api/incites/unit/${encodeURIComponent(activeUnit)}`));
                const data = await res.json();
                if (data.success && data.unit) {
                    setUnitCache(prev => ({ ...prev, [activeUnit]: data.unit }));
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

    const currentUnit = activeUnit ? unitCache[activeUnit] : null;

    return (
        <div className="flex flex-col h-full bg-gray-950 p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">InCites Data</h2>
                    <p className="text-sm text-gray-400 mt-1">Explora y procesa indicadores bibliométricos de Clarivate InCites</p>
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-900/50 transition flex items-center space-x-2 disabled:opacity-50"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>{isUploading ? 'Procesando...' : 'Cargar ZIP / Excel'}</span>
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

            {/* Empty state */}
            {!unitNames && !isUploading && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-800 rounded-3xl">
                    <BarChart2 className="w-16 h-16 mb-4 text-gray-700" />
                    <p>Carga archivos CSV/Excel de InCites o un archivo ZIP para comenzar.</p>
                </div>
            )}

            {/* Processing spinner */}
            {isUploading && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
                    <p className="text-sm font-medium">Procesando archivos InCites…</p>
                    <p className="text-xs text-gray-600 mt-1">Esto puede tomar 30–60 segundos para ZIPs grandes</p>
                </div>
            )}

            {/* Tabs + content */}
            {unitNames && unitNames.length > 0 && (
                <div className="flex-1 flex flex-col space-y-4 min-h-0">
                    {/* Unit Tabs */}
                    <div className="flex space-x-2 border-b border-gray-800 pb-2 overflow-x-auto shrink-0">
                        {unitNames.map(name => (
                            <button
                                key={name}
                                onClick={() => setActiveUnit(name)}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                                    activeUnit === name
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                }`}
                            >
                                {name}
                                {/* Show dot if already cached */}
                                {unitCache[name] && <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full align-middle" />}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 min-h-0">
                        {isLoadingUnit && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-400" />
                                <p className="text-sm">Cargando {activeUnit}…</p>
                            </div>
                        )}
                        {!isLoadingUnit && currentUnit && (
                            <UnitPanel unitName={activeUnit!} unit={currentUnit} />
                        )}
                        {!isLoadingUnit && !currentUnit && activeUnit && (
                            <div className="flex items-center justify-center h-full text-gray-600">
                                <p>Selecciona una pestaña para ver sus datos.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
