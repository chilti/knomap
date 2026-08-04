import React from 'react';
import { Activity, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  errors: number[];
}

export const TrainingErrorPanel: React.FC<Props> = ({ errors }) => {
  const chartData = errors.map((err, idx) => ({
    epoch: idx + 1,
    error: err,
  }));

  const handleDownload = () => {
    const container = document.getElementById('chart-training-error');
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
      a.download = `som_training_quantization_error_chart.png`;
      a.click();
    };
    img.src = svgData;
  };

  const handleExportCSV = () => {
    const csvContent = "Epoch,Quantization_Error\n" + 
      errors.map((err, idx) => `${idx + 1},${err}`).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `som_training_quantization_errors.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col space-y-6 lg:col-span-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-md font-bold text-gray-200 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span>Error de Entrenamiento (Cuantización)</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">Evolución del error de cuantización promedio por época durante el entrenamiento.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 text-white rounded-xl transition cursor-pointer shadow-lg flex items-center space-x-2 text-xs font-bold uppercase tracking-wider"
            title="Exportar lista de errores a CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Errores (CSV)</span>
          </button>
          <button
            onClick={handleDownload}
            className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white rounded-xl transition cursor-pointer"
            title="Guardar gráfica como PNG"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-gray-950 p-4 rounded-xl border border-gray-850">
        <div id="chart-training-error" style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 15, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis 
                dataKey="epoch" 
                stroke="#9ca3af" 
                label={{ value: 'Época / Iteración', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 11, fontWeight: 'bold' }} 
                fontSize={10} 
              />
              <YAxis 
                stroke="#9ca3af" 
                domain={['auto', 'auto']} 
                label={{ value: 'Error de Cuantización', angle: -90, position: 'insideLeft', offset: -10, fill: '#9ca3af', fontSize: 11, fontWeight: 'bold' }}
                fontSize={10} 
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#030712', borderColor: '#1f2937', color: '#fff', fontSize: 12 }} 
                labelFormatter={(label) => `Época: ${label}`}
                formatter={(value) => [`${parseFloat(value as string).toFixed(5)}`, 'Error']}
              />
              <Line 
                type="monotone" 
                dataKey="error" 
                stroke="#a78bfa" 
                strokeWidth={2.5} 
                dot={errors.length <= 100 ? { r: 3, stroke: '#8b5cf6', strokeWidth: 1 } : false} 
                activeDot={{ r: 5 }} 
                name="Error de Cuantización" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
