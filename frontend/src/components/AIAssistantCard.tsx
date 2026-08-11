import { useSomStore, getApiUrl } from '../store/somStore';

interface AIAssistantCardProps {
    systemPrompt: string;
    contextData: any;
    title?: string;
    cacheKey?: string;
}

export const AIAssistantCard: React.FC<AIAssistantCardProps> = ({ systemPrompt, contextData, title = "Análisis Asistido por IA", cacheKey }) => {
    const { incitesLlmCache, setIncitesState } = useSomStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const response = cacheKey ? incitesLlmCache[cacheKey] || null : null;

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            // Compress context data to avoid huge payloads
            const dataString = typeof contextData === 'string' ? contextData : JSON.stringify(contextData, null, 2);
            
            const reqBody = {
                systemPrompt: systemPrompt,
                userPrompt: `Contexto de datos:\n\`\`\`json\n${dataString}\n\`\`\`\n\nPor favor analiza estos datos y proporciona tus conclusiones:`
            };

            const res = await fetch(getApiUrl('/api/llm/analyze'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });

            const result = await res.json();
            
            if (result.success) {
                if (cacheKey) {
                    setIncitesState({
                        incitesLlmCache: {
                            ...useSomStore.getState().incitesLlmCache,
                            [cacheKey]: result.response
                        }
                    });
                }
            } else {
                setError(result.error || "Ocurrió un error desconocido.");
            }
        } catch (e: any) {
            setError(e.message || "Fallo de conexión con el backend.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl p-6 mt-6 shadow-lg shadow-indigo-900/10">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>
                {!isLoading && !response && (
                    <button 
                        onClick={handleAnalyze}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-md shadow-indigo-900/50 text-sm"
                    >
                        Analizar con IA (Modelo Local)
                    </button>
                )}
            </div>

            {isLoading && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p className="text-indigo-400 text-sm animate-pulse">El modelo local está analizando los datos...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 mt-2">
                    <p className="text-red-400 text-sm">{error}</p>
                    <button onClick={handleAnalyze} className="mt-2 text-xs text-red-300 hover:text-white underline">Intentar de nuevo</button>
                </div>
            )}

            {response && (
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 mt-2 prose prose-invert prose-sm max-w-none prose-indigo">
                    <div className="text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                        {response.split('\n').map((line, i) => {
                            if (line.startsWith('#')) return <h4 key={i} className="text-white font-bold mt-3 mb-1">{line.replace(/#/g, '').trim()}</h4>;
                            if (line.startsWith('-')) return <li key={i} className="ml-4">{line.substring(1).trim()}</li>;
                            if (line.trim() === '') return <br key={i} />;
                            // Basic bold parsing
                            const formattedLine = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={j} className="text-indigo-300">{part.substring(2, part.length - 2)}</strong>;
                                }
                                return part;
                            });
                            return <p key={i} className="my-1">{formattedLine}</p>;
                        })}
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                        <button 
                            onClick={handleAnalyze}
                            className="text-xs text-gray-500 hover:text-gray-300 flex items-center"
                        >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Re-analizar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
