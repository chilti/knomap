import React from 'react';
import { Loader2, Activity, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface MetricResult {
  k: number;
  silhouette: number;
  davies_bouldin: number;
  calinski_harabasz: number;
  labels: number[];
}

interface Props {
  data: MetricResult[] | null;
  loading: boolean;
  error: string | null;
  nClusters?: number;
  maxK?: number;
  onNClustersChange?: (n: number) => void;
  onMaxKChange?: (n: number) => void;
  onRecluster?: () => void;
  onApplyK?: () => void;
  disabledRecluster?: boolean;
}

export const ClusterMetricsPanel: React.FC<Props> = ({ 
  data, 
  loading, 
  error, 
  nClusters,
  maxK,
  onNClustersChange,
  onMaxKChange,
  onRecluster,
  onApplyK,
  disabledRecluster 
}) => {
  const handleDownload = (chartId: string, filename: string) => {
    const container = document.getElementById(chartId);
    const svgElement = container?.querySelector('svg');
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const svgData = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<?xml version="1.0" standalone="no"?>\r\n' + source);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const scaleFactor = 3; 
    const rect = svgElement.getBoundingClientRect();
    canvas.width = rect.width * scaleFactor;
    canvas.height = rect.height * scaleFactor;
    
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png", 1.0);
      a.download = `${filename}.png`;
      a.click();
    };
    img.src = svgData;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col space-y-6 lg:col-span-2 xl:col-span-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-md font-bold text-gray-200 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span>Clustering Optimization Metrics</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">Evaluate different values of K using agglomerative hierarchies.</p>
          {onMaxKChange && (
            <div className="flex items-center space-x-2 mt-2">
              <label className="text-[10px] text-gray-400 font-semibold">Max K to Evaluate:</label>
              <input
                type="number"
                min={5}
                max={50}
                value={maxK || 15}
                onChange={(e) => onMaxKChange(parseInt(e.target.value) || 15)}
                className="w-14 bg-gray-950 border border-gray-800 rounded px-1.5 py-1 text-[10px] text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {onRecluster && (
          <div className="flex items-center space-x-3 bg-gray-950 p-2.5 rounded-xl border border-gray-800">
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-300 font-bold whitespace-nowrap">Target Clusters (K):</label>
              <input
                type="number"
                min={2}
                max={50}
                value={nClusters || 2}
                onChange={(e) => onNClustersChange?.(parseInt(e.target.value) || 2)}
                className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-100 text-center focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-col space-y-1">
              <button
                onClick={onApplyK}
                disabled={disabledRecluster || !data?.some(d => d.k === nClusters)}
                title="Apply stored clustering instantaneously"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 text-white rounded-lg transition cursor-pointer shadow-md flex items-center justify-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
              >
                <Activity className="w-3 h-3" />
                <span>APPLY K</span>
              </button>
              
              <button
                onClick={onRecluster}
                disabled={disabledRecluster}
                title="Send request to backend to compute new clustering"
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 text-[9px] font-bold uppercase tracking-wider disabled:opacity-50"
              >
                <span>Backend Re-cluster</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-gray-400 text-sm font-semibold">Calculating Agglomerative hierarchies...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          <span className="font-bold">Error: </span> {error}
        </div>
      )}

      {!loading && !error && !data && (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-800 rounded-xl">
          <p className="text-gray-500 text-sm">Click "Analyze Optimal Clusters" to evaluate K.</p>
        </div>
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-gray-300">Silhouette Score (Higher is better)</h3>
              <button onClick={() => handleDownload('chart-silhouette', 'silhouette_score')} className="text-gray-400 hover:text-white transition" title="Save as PNG">
                <Download className="w-4 h-4" />
              </button>
            </div>
            <div id="chart-silhouette" style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="k" stroke="#9ca3af" label={{ value: 'Clusters (K)', position: 'insideBottom', offset: -15, fill: '#9ca3af', fontSize: 10 }} fontSize={10} />
                  <YAxis stroke="#9ca3af" domain={['auto', 'auto']} fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1f2937', color: '#fff', fontSize: 12 }} />
                  <Line type="monotone" dataKey="silhouette" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Silhouette" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-gray-300">Davies-Bouldin Index (Lower is better)</h3>
              <button onClick={() => handleDownload('chart-davies-bouldin', 'davies_bouldin_index')} className="text-gray-400 hover:text-white transition" title="Save as PNG">
                <Download className="w-4 h-4" />
              </button>
            </div>
            <div id="chart-davies-bouldin" style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="k" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" domain={['auto', 'auto']} fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1f2937', color: '#fff', fontSize: 12 }} />
                  <Line type="monotone" dataKey="davies_bouldin" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} name="Davies-Bouldin" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-gray-300">Calinski-Harabasz Score (Higher is better)</h3>
              <button onClick={() => handleDownload('chart-calinski-harabasz', 'calinski_harabasz_score')} className="text-gray-400 hover:text-white transition" title="Save as PNG">
                <Download className="w-4 h-4" />
              </button>
            </div>
            <div id="chart-calinski-harabasz" style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="k" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" domain={['auto', 'auto']} fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1f2937', color: '#fff', fontSize: 12 }} />
                  <Line type="monotone" dataKey="calinski_harabasz" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Calinski-Harabasz" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
