import React, { useState } from 'react';
import { Download, FileText, Image as ImageIcon, Code, X, Check, Share2, Layers } from 'lucide-react';
import { useSomStore } from '../../store/somStore';

interface VosExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VosExportModal: React.FC<VosExportModalProps> = ({ isOpen, onClose }) => {
  const vosviewerJson = useSomStore(state => state.vosviewerJson);
  const cooccurrenceCsv = useSomStore(state => state.cooccurrenceCsv);
  const fileName = useSomStore(state => state.fileName);

  const [activeTab, setActiveTab] = useState<'image' | 'data'>('image');
  const [scale, setScale] = useState<number>(2);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "bibliometric_map";

  // Trigger high-res canvas download via postMessage to iframe
  const handleExportCanvasImage = (format: 'png' | 'svg') => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'EXPORT_VOS_IMAGE',
        format,
        scale,
        filename: `${baseName}_vosviewer.${format}`
      }, '*');
    }
    onClose();
  };

  // Download raw JSON
  const handleDownloadVosJson = () => {
    if (!vosviewerJson) return;
    const blob = new Blob([JSON.stringify(vosviewerJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_vosviewer.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate and download VOSviewer classic map.txt & network.txt
  const handleDownloadVosMapAndNet = () => {
    if (!vosviewerJson || !vosviewerJson.network) return;
    const items = vosviewerJson.network.items || [];
    const links = vosviewerJson.network.links || [];

    // 1. Map file: id, label, x, y, cluster, weight<Total link strength>
    let mapText = "id\tlabel\tx\ty\tcluster\tweight<Total link strength>\n";
    items.forEach((it: any) => {
      mapText += `${it.id}\t${it.label}\t${(it.x || 0).toFixed(4)}\t${(it.y || 0).toFixed(4)}\t${it.cluster || 1}\t${(it.weights?.total_link_strength || 1).toFixed(2)}\n`;
    });

    // 2. Network file: id1, id2, strength
    let netText = "";
    links.forEach((lk: any) => {
      netText += `${lk.source_id}\t${lk.target_id}\t${(lk.strength || 1).toFixed(2)}\n`;
    });

    // Download map.txt
    const mapBlob = new Blob([mapText], { type: 'text/plain;charset=utf-8' });
    const mapUrl = URL.createObjectURL(mapBlob);
    const a1 = document.createElement('a');
    a1.href = mapUrl;
    a1.download = `${baseName}_map.txt`;
    a1.click();
    URL.revokeObjectURL(mapUrl);

    // Download net.txt
    setTimeout(() => {
      const netBlob = new Blob([netText], { type: 'text/plain;charset=utf-8' });
      const netUrl = URL.createObjectURL(netBlob);
      const a2 = document.createElement('a');
      a2.href = netUrl;
      a2.download = `${baseName}_network.txt`;
      a2.click();
      URL.revokeObjectURL(netUrl);
    }, 200);
  };

  // Download Adjacency Matrix CSV
  const handleDownloadCsv = () => {
    if (!cooccurrenceCsv) return;
    const blob = new Blob([cooccurrenceCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}_cooccurrence_matrix.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy JSON to clipboard
  const handleCopyJson = () => {
    if (!vosviewerJson) return;
    navigator.clipboard.writeText(JSON.stringify(vosviewerJson, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100">Export Bibliometric Visualizations & Data</h3>
              <p className="text-[11px] text-gray-400">Publication-ready figures, high-resolution graphics, and VOSviewer file packages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-1.5 rounded-lg hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-800 bg-gray-950/40 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'image'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>High-Res Images & Figures</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'data'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>VOS Files & Raw Data</span>
          </button>
        </div>

        {/* Tab 1: Image Export */}
        {activeTab === 'image' && (
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Resolution / DPI Scale</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { scale: 1, label: '1x Screen', desc: 'Standard display' },
                  { scale: 2, label: '2x Retina (300 DPI)', desc: 'Recommended for presentations' },
                  { scale: 4, label: '4x Ultra-HD (600 DPI)', desc: 'High-res journals & print' }
                ].map(opt => (
                  <button
                    key={opt.scale}
                    type="button"
                    onClick={() => setScale(opt.scale)}
                    className={`p-3 rounded-xl border text-left transition ${
                      scale === opt.scale
                        ? 'bg-indigo-950/50 border-indigo-500 text-white'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => handleExportCanvasImage('png')}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-between shadow-lg shadow-indigo-600/30"
              >
                <div className="flex items-center space-x-2">
                  <ImageIcon className="w-4 h-4" />
                  <span>Download Raster PNG ({scale}x DPI)</span>
                </div>
                <Download className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleExportCanvasImage('svg')}
                className="w-full py-3 px-4 bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-indigo-500 text-gray-200 font-bold text-xs rounded-xl transition flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Download Vector SVG (Infinite Scalability)</span>
                </div>
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: VOS Data Export */}
        {activeTab === 'data' && (
          <div className="p-6 space-y-4">
            <p className="text-xs text-gray-400">
              Download native VOSviewer file packages to open directly in desktop VOSviewer, VOSviewer Online, Pajek, or Gephi.
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleDownloadVosJson}
                disabled={!vosviewerJson}
                className="w-full p-3 bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-indigo-500 rounded-xl text-left transition flex items-center justify-between text-xs font-semibold text-gray-200 disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-mono font-bold text-[11px]">
                    JSON
                  </div>
                  <div>
                    <div className="font-bold text-white">VOSviewer JSON (.json)</div>
                    <div className="text-[10px] text-gray-500">Universal package with coordinates, clusters & weights</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={handleDownloadVosMapAndNet}
                disabled={!vosviewerJson}
                className="w-full p-3 bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-indigo-500 rounded-xl text-left transition flex items-center justify-between text-xs font-semibold text-gray-200 disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-[11px]">
                    MAP
                  </div>
                  <div>
                    <div className="font-bold text-white">VOSviewer Map & Network (.txt)</div>
                    <div className="text-[10px] text-gray-500">Classic dual-file format (map.txt & network.txt)</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={!cooccurrenceCsv}
                className="w-full p-3 bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-indigo-500 rounded-xl text-left transition flex items-center justify-between text-xs font-semibold text-gray-200 disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center font-mono font-bold text-[11px]">
                    CSV
                  </div>
                  <div>
                    <div className="font-bold text-white">Adjacency Co-occurrence Matrix (.csv)</div>
                    <div className="text-[10px] text-gray-500">Full symmetric co-occurrence matrix table</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleCopyJson}
                className="px-3 py-1.5 bg-gray-950 hover:bg-gray-800 border border-gray-800 rounded-lg text-xs font-semibold text-gray-300 transition flex items-center space-x-1.5"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
                <span>{isCopied ? "Copied JSON!" : "Copy JSON to Clipboard"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-800 bg-gray-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-bold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
