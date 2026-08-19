import React, { useRef, useEffect } from 'react';

interface VosViewerContainerProps {
  data?: any;
  parameters?: Record<string, any>;
  className?: string;
  onlyLargestComponent?: boolean;
  onReclusterRequest?: (params: { resolution: number; minClusterSize: number }) => Promise<{ clusters?: Record<number, number> } | null>;
}

/**
 * Converts a standard knoMap network { nodes, edges } into the official VOSviewer JSON structure
 * if raw vosviewer_json is not already provided.
 */
export function networkToVosJson(network: { nodes: any[]; edges: any[] }, options?: { defaultScoreName?: string }): any {
  if (!network || !network.nodes || network.nodes.length === 0) {
    return { network: { items: [], links: [] } };
  }

  // Map each unique node ID to a 1-based integer index for VOSviewer
  const idToIndexMap = new Map<string, number>();
  const indexToIdMap = new Map<number, string>();

  network.nodes.forEach((n, idx) => {
    const rawId = String(n.data?.id ?? idx);
    const vosId = idx + 1;
    idToIndexMap.set(rawId, vosId);
    indexToIdMap.set(vosId, rawId);
  });

  // Calculate Link Count and Total Link Strength per node
  const linkCountMap = new Map<string, number>();
  const totalLinkStrengthMap = new Map<string, number>();

  network.nodes.forEach(n => {
    const rawId = String(n.data?.id);
    linkCountMap.set(rawId, 0);
    totalLinkStrengthMap.set(rawId, 0);
  });

  const links: Array<{ source_id: number; target_id: number; strength: number }> = [];

  network.edges.forEach(e => {
    const srcRaw = typeof e.data?.source === 'object' ? String(e.data.source.id) : String(e.data?.source);
    const tgtRaw = typeof e.data?.target === 'object' ? String(e.data.target.id) : String(e.data?.target);
    const weight = Number(e.data?.weight ?? 1);

    const srcId = idToIndexMap.get(srcRaw);
    const tgtId = idToIndexMap.get(tgtRaw);

    if (srcId !== undefined && tgtId !== undefined && srcId !== tgtId) {
      links.push({
        source_id: srcId,
        target_id: tgtId,
        strength: weight
      });

      linkCountMap.set(srcRaw, (linkCountMap.get(srcRaw) ?? 0) + 1);
      linkCountMap.set(tgtRaw, (linkCountMap.get(tgtRaw) ?? 0) + 1);
      totalLinkStrengthMap.set(srcRaw, (totalLinkStrengthMap.get(srcRaw) ?? 0) + weight);
      totalLinkStrengthMap.set(tgtRaw, (totalLinkStrengthMap.get(tgtRaw) ?? 0) + weight);
    }
  });

  // Build items array
  const items = network.nodes.map((n, idx) => {
    const rawId = String(n.data?.id ?? idx);
    const vosId = idToIndexMap.get(rawId) ?? (idx + 1);
    const label = String(n.data?.label ?? rawId);
    const frequency = Number(n.data?.frequency ?? 1);
    const cluster = n.data?.cluster ?? (n.data?.group_type?.includes('t2') ? 2 : 1);

    const weights: Record<string, number> = {
      Occurrences: frequency,
      'Total link strength': totalLinkStrengthMap.get(rawId) ?? 0,
      Links: linkCountMap.get(rawId) ?? 0
    };

    if (n.data?.citations !== undefined) {
      weights['Citations'] = Number(n.data.citations);
    }
    if (n.data?.documents !== undefined) {
      weights['Documents'] = Number(n.data.documents);
    }

    const scores: Record<string, number> = {};
    if (n.data?.avg_year !== undefined) {
      scores['Avg. pub. year'] = Number(n.data.avg_year);
    }
    if (n.data?.avg_citations !== undefined) {
      scores['Avg. citations'] = Number(n.data.avg_citations);
    }
    if (n.data?.score !== undefined) {
      const scoreKey = options?.defaultScoreName ?? 'Score';
      scores[scoreKey] = Number(n.data.score);
    }

    const itemObj: any = {
      id: vosId,
      label,
      cluster: Number(cluster),
      weights
    };

    if (Object.keys(scores).length > 0) {
      itemObj.scores = scores;
    }

    if (n.data?.description) {
      itemObj.description = String(n.data.description);
    }

    if (n.data?.url) {
      itemObj.url = String(n.data.url);
    }

    if (n.data?.x !== undefined && n.data?.y !== undefined) {
      itemObj.x = Number(n.data.x);
      itemObj.y = Number(n.data.y);
    }

    return itemObj;
  });

  return {
    network: {
      items,
      links
    },
    config: {
      parameters: {
        scale: 1.0,
        item_size_variation: 0.5,
        max_n_links: 1000
      }
    }
  };
}

export const VosViewerContainer: React.FC<VosViewerContainerProps> = ({
  data,
  className = 'w-full h-full',
  onlyLargestComponent,
  onReclusterRequest
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendDataToIframe = () => {
    if (iframeRef.current && data) {
      const iframeWin = iframeRef.current.contentWindow;
      if (iframeWin) {
        iframeWin.postMessage({
          type: 'LOAD_VOS_DATA',
          data: data
        }, '*');
      }
    }
  };

  const sendThemeToIframe = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('labsom-theme') || 'dark';
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'SET_THEME',
        theme: currentTheme
      }, '*');
    }
  };

  useEffect(() => {
    sendDataToIframe();
  }, [data]);

  useEffect(() => {
    sendThemeToIframe();

    // Listen to theme mutations on <html> element
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          sendThemeToIframe();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow && onlyLargestComponent !== undefined) {
      iframeRef.current.contentWindow.postMessage({
        type: 'SET_ONLY_LCC',
        value: onlyLargestComponent
      }, '*');
    }
  }, [onlyLargestComponent]);

  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      if (!e.data) return;

      if (e.data.type === 'VOS_READY') {
        sendDataToIframe();
        sendThemeToIframe();
        if (onlyLargestComponent !== undefined) {
          iframeRef.current?.contentWindow?.postMessage({ type: 'SET_ONLY_LCC', value: onlyLargestComponent }, '*');
        }
      } else if (e.data.type === 'REQUEST_RECLUSTER' && onReclusterRequest) {
        const result = await onReclusterRequest({
          resolution: e.data.resolution ?? 1.0,
          minClusterSize: e.data.minClusterSize ?? 2
        });
        // Forward result back to iframe regardless of success/failure
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'RECLUSTER_RESULT',
            clusters: result?.clusters ?? {}
          }, '*');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [data, onReclusterRequest]);

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ minHeight: '620px', height: '100%', width: '100%' }}>
      <iframe
        ref={iframeRef}
        src="./vosviewer_map.html"
        className="w-full h-full border-none"
        title="VOSviewer Map Engine"
      />
    </div>
  );
};
