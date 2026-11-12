/**
 * chartExport.ts - High-Fidelity SVG & PNG Chart Exporter
 * Inlines computed styles, handles Recharts ResponsiveContainers & D3 SVGs,
 * and provides pixel-perfect PNG rendering with fallback.
 */
import html2canvas from 'html2canvas';

const SVG_SHAPE_PROPERTIES = [
    'fill', 'fill-opacity', 'fill-rule',
    'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity',
    'opacity', 'visibility', 'display'
];

const SVG_TEXT_PROPERTIES = [
    'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'word-spacing',
    'text-anchor', 'dominant-baseline', 'alignment-baseline',
    'fill', 'fill-opacity', 'stroke', 'stroke-width', 'color', 'opacity', 'visibility', 'display'
];

/**
 * Traverses source and cloned SVG in lockstep to inline all computed styles.
 */
function inlineComputedStyles(sourceSvg: SVGElement, targetSvg: SVGElement, bgColor: string = '#ffffff') {
    const isLightBg = bgColor === '#ffffff' || bgColor === 'white' || bgColor.toLowerCase().startsWith('#f') || bgColor.toLowerCase().startsWith('#e');
    const sourceElements = [sourceSvg, ...Array.from(sourceSvg.querySelectorAll('*'))];
    const targetElements = [targetSvg, ...Array.from(targetSvg.querySelectorAll('*'))];

    const len = Math.min(sourceElements.length, targetElements.length);
    for (let i = 0; i < len; i++) {
        const src = sourceElements[i] as HTMLElement | SVGElement;
        const tgt = targetElements[i] as HTMLElement | SVGElement;
        if (!src || !tgt) continue;

        const tagName = (src.tagName || '').toLowerCase();

        // Never set direct fill/stroke on root SVG or <defs>/<clipPath> to prevent cascade corruption
        if (i === 0 || tagName === 'svg' || tagName === 'defs' || tagName === 'clippath') {
            tgt.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
            continue;
        }

        try {
            const computed = window.getComputedStyle(src);

            // For <g> grouping containers, do not force computed fill/stroke to avoid breaking child inheritance
            if (tagName === 'g') {
                const opacity = computed.opacity;
                if (opacity && opacity !== '1') {
                    tgt.style.opacity = opacity;
                }
                const display = computed.display;
                if (display === 'none') {
                    tgt.style.display = 'none';
                }
                continue;
            }

            // Handle text and tspans specifically to ensure high-contrast readability
            if (tagName === 'text' || tagName === 'tspan') {
                for (const prop of SVG_TEXT_PROPERTIES) {
                    const val = computed.getPropertyValue(prop);
                    if (val && val !== 'initial' && val !== 'inherit') {
                        tgt.style.setProperty(prop, val);
                    }
                }

                const fill = computed.fill;
                const color = computed.color;
                
                if (isLightBg) {
                    // On light background, if text is transparent, light, or unspecified, make it dark slate
                    if (!fill || fill === 'none' || fill === 'rgba(0, 0, 0, 0)' || fill === 'rgb(255, 255, 255)' || fill.includes('203, 213, 225') || fill.includes('148, 163, 184')) {
                        const resolved = (color && color !== 'rgb(255, 255, 255)' && color !== 'rgba(0, 0, 0, 0)' && !color.includes('203, 213, 225')) ? color : '#1e293b';
                        tgt.setAttribute('fill', resolved);
                        tgt.style.fill = resolved;
                    } else {
                        tgt.setAttribute('fill', fill);
                        tgt.style.fill = fill;
                    }
                } else {
                    if (!fill || fill === 'none' || fill === 'rgba(0, 0, 0, 0)' || fill === 'rgb(0, 0, 0)') {
                        const resolved = (color && color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') ? color : '#cbd5e1';
                        tgt.setAttribute('fill', resolved);
                        tgt.style.fill = resolved;
                    } else {
                        tgt.setAttribute('fill', fill);
                        tgt.style.fill = fill;
                    }
                }
                tgt.style.fontFamily = computed.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';
                continue;
            }

            // Handle graphic shapes: path, rect, circle, polygon, polyline, line
            for (const prop of SVG_SHAPE_PROPERTIES) {
                const val = computed.getPropertyValue(prop);
                if (val && val !== 'initial' && val !== 'inherit') {
                    tgt.style.setProperty(prop, val);
                }
            }

            // Ensure grid lines and axis ticks have proper stroke
            if (tagName === 'line' || tagName === 'path') {
                const stroke = computed.stroke;
                if (stroke && stroke !== 'none') {
                    tgt.setAttribute('stroke', stroke);
                    tgt.style.stroke = stroke;
                }
            }

            // Ensure polygons (radar, SOM cells) preserve fill & opacity
            if (tagName === 'polygon') {
                const fill = computed.fill;
                const fillOpacity = computed.fillOpacity || computed.getPropertyValue('fill-opacity');
                if (fill && fill !== 'none') {
                    tgt.setAttribute('fill', fill);
                    tgt.style.fill = fill;
                }
                if (fillOpacity) {
                    tgt.setAttribute('fill-opacity', fillOpacity);
                    tgt.style.fillOpacity = fillOpacity;
                }
            }
        } catch {
            // Ignore detached or uncomputable elements
        }
    }
}

/**
 * Accurately finds the primary chart SVG element inside a container,
 * ignoring tiny legend icons, buttons, toolbars, and Lucide icons.
 */
export function findMainChartSvg(container: HTMLElement): SVGElement | null {
    // 1. Check for explicit main Recharts surface as direct child of .recharts-wrapper
    const rechartsDirect = container.querySelector('.recharts-wrapper > svg.recharts-surface') as SVGElement | null;
    if (rechartsDirect) return rechartsDirect;

    // 2. Check for SOM hex map SVG or Sunburst
    const specialSvg = container.querySelector('svg.map-hexagonal-svg, #sunburst-chart-container svg, svg[id*="som"], svg[id*="hex"]') as SVGElement | null;
    if (specialSvg) return specialSvg;

    // 3. Filter all SVGs inside container
    const allSvgs = Array.from(container.querySelectorAll('svg')) as SVGElement[];
    const candidates = allSvgs.filter(svg => {
        // Exclude buttons and controls
        if (svg.closest('button')) return false;
        // Exclude legend containers and legend item icons
        if (svg.closest('.recharts-legend-wrapper, .recharts-default-legend, .recharts-legend-item, .legend-item')) return false;
        
        const cls = (svg.getAttribute('class') || '') + ' ' + (svg.className?.baseVal || '');
        if (cls.includes('lucide') || cls.includes('recharts-legend-icon')) return false;

        const attrW = parseFloat(svg.getAttribute('width') || '0');
        const attrH = parseFloat(svg.getAttribute('height') || '0');
        if ((attrW > 0 && attrW <= 40) || (attrH > 0 && attrH <= 40)) {
            return false;
        }

        const bbox = svg.getBoundingClientRect();
        if ((bbox.width > 0 && bbox.width <= 40) || (bbox.height > 0 && bbox.height <= 40)) {
            return false;
        }

        return true;
    });

    if (candidates.length > 0) {
        // Pick the largest candidate SVG by area
        candidates.sort((a, b) => {
            const aW = parseFloat(a.getAttribute('width') || '0') || a.getBoundingClientRect().width || 0;
            const aH = parseFloat(a.getAttribute('height') || '0') || a.getBoundingClientRect().height || 0;
            const bW = parseFloat(b.getAttribute('width') || '0') || b.getBoundingClientRect().width || 0;
            const bH = parseFloat(b.getAttribute('height') || '0') || b.getBoundingClientRect().height || 0;
            return (bW * bH) - (aW * aH);
        });
        return candidates[0];
    }

    // 4. Fallback: Any SVG not inside a button or legend
    return allSvgs.find(s => !s.closest('button') && !s.closest('.recharts-legend-wrapper')) || null;
}

/**
 * Prepares and serializes an SVG from a DOM container into a standalone XML string.
 */
export function getSerializedSvg(containerIdOrElement: string | HTMLElement, bgColor: string = '#ffffff'): {
    svgString: string;
    width: number;
    height: number;
} | null {
    const container = typeof containerIdOrElement === 'string'
        ? document.getElementById(containerIdOrElement)
        : containerIdOrElement;

    if (!container) return null;

    const svgElement = findMainChartSvg(container);
    if (!svgElement) return null;

    const bbox = svgElement.getBoundingClientRect();
    const attrW = parseFloat(svgElement.getAttribute('width') || '0');
    const attrH = parseFloat(svgElement.getAttribute('height') || '0');
    
    // Check viewBox attribute if present
    const viewBoxAttr = svgElement.getAttribute('viewBox');
    let viewBoxWidth = 0;
    let viewBoxHeight = 0;
    if (viewBoxAttr) {
        const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && !isNaN(parts[2]) && !isNaN(parts[3]) && parts[2] > 0 && parts[3] > 0) {
            viewBoxWidth = parts[2];
            viewBoxHeight = parts[3];
        }
    }

    const scrollW = (svgElement as any).scrollWidth || (svgElement as any).clientWidth || container.scrollWidth;
    const scrollH = (svgElement as any).scrollHeight || (svgElement as any).clientHeight || container.scrollHeight;

    // Determine the true rendered dimensions (accounting for vertical scroll lists like Quartiles)
    const width = Math.max(Math.round(attrW || viewBoxWidth || scrollW || bbox.width || container.clientWidth || 800), 300);
    const height = Math.max(Math.round(attrH || viewBoxHeight || scrollH || bbox.height || container.clientHeight || 500), 200);

    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clonedSvg.setAttribute('width', String(width));
    clonedSvg.setAttribute('height', String(height));
    if (viewBoxAttr) {
      clonedSvg.setAttribute('viewBox', viewBoxAttr);
    } else {
      clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    
    clonedSvg.style.backgroundColor = bgColor;
    clonedSvg.style.borderRadius = '12px';
    clonedSvg.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';

    // Inline CSS styles
    inlineComputedStyles(svgElement as SVGElement, clonedSvg, bgColor);

    // Insert background rectangle with explicit non-inheriting style
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', bgColor);
    bgRect.style.setProperty('fill', bgColor, 'important');
    bgRect.setAttribute('rx', '8');
    clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);

    return { svgString, width, height };
}

/**
 * Converts serialized SVG XML string into high-resolution PNG Data URL via HTML5 Canvas and Blob.
 */
export const convertSvgStringToPngDataUrl = (
    svgString: string, 
    width: number, 
    height: number, 
    scale: number = 2, 
    bgColor: string = '#ffffff'
): Promise<string | null> => {
    return new Promise((resolve) => {
        try {
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(width * scale, 300);
                    canvas.height = Math.max(height * scale, 200);
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.fillStyle = bgColor;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const pngUrl = canvas.toDataURL('image/png', 1.0);
                        URL.revokeObjectURL(url);
                        resolve(pngUrl);
                        return;
                    }
                } catch (e) {
                    console.warn('[convertSvgStringToPngDataUrl] Canvas error:', e);
                }
                URL.revokeObjectURL(url);
                resolve(null);
            };

            img.onerror = (e) => {
                console.warn('[convertSvgStringToPngDataUrl] Image load error:', e);
                URL.revokeObjectURL(url);
                resolve(null);
            };

            img.src = url;
        } catch (err) {
            console.warn('[convertSvgStringToPngDataUrl] Exception:', err);
            resolve(null);
        }
    });
};

/**
 * Triggers browser download for a data URL or Blob URL.
 */
function triggerDownload(url: string, filename: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Exports chart as standalone SVG file.
 */
export const exportChartAsSVG = (containerId: string, filename: string, bgColor: string = '#ffffff') => {
    const serialized = getSerializedSvg(containerId, bgColor);
    if (!serialized) {
        console.warn(`[exportChartAsSVG] SVG not found for container: ${containerId}`);
        return;
    }

    const { svgString } = serialized;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${filename}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Robust fallback using html2canvas.
 */
async function fallbackHtml2Canvas(container: HTMLElement, filename: string, scale: number = 2, bgColor: string = '#ffffff') {
    try {
        const canvas = await html2canvas(container, {
            backgroundColor: bgColor,
            scale: scale,
            useCORS: true,
            logging: false,
            allowTaint: true
        });
        const pngUrl = canvas.toDataURL('image/png', 1.0);
        triggerDownload(pngUrl, `${filename}.png`);
    } catch (error) {
        console.error('[exportChartAsPNG] html2canvas export failed:', error);
    }
}

/**
 * Exports chart as high-resolution PNG file with rasterization and html2canvas fallback.
 */
export const exportChartAsPNG = async (containerId: string, filename: string, scale: number = 2, bgColor: string = '#ffffff') => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`[exportChartAsPNG] Container not found: ${containerId}`);
        return;
    }

    const serialized = getSerializedSvg(container, bgColor);

    if (serialized) {
        const { svgString, width, height } = serialized;
        const pngUrl = await convertSvgStringToPngDataUrl(svgString, width, height, scale, bgColor);
        if (pngUrl) {
            triggerDownload(pngUrl, `${filename}.png`);
            return;
        }
    }

    // Fallback if SVG rasterization couldn't complete
    await fallbackHtml2Canvas(container, filename, scale, bgColor);
};

/**
 * Reads user theme from localStorage for standalone popup styling.
 */
function getPopupTheme() {
    const t = typeof window !== 'undefined' ? localStorage.getItem('labsom-theme') || 'dark' : 'dark';
    if (t === 'light') return {
        bg: '#eef2f7', card: '#ffffff', border: '#e2e8f0',
        text: '#1e293b', textSub: '#334155', accent: '#2563eb', accentSub: '#1d4ed8'
    };
    if (t === 'navy') return {
        bg: '#0d1b2a', card: '#112030', border: '#1a2e44',
        text: '#d0e8ff', textSub: '#90b8d8', accent: '#00f0ff', accentSub: '#00a2ff'
    };
    return {
        bg: '#050508', card: '#0e121a', border: '#1e293b',
        text: '#cbd5e1', textSub: '#94a3b8', accent: '#00F0FF', accentSub: '#0088ff'
    };
}

/**
 * Opens any chart in a standalone, high-resolution interactive popup window
 * with pan/zoom (wheel & drag), reset, and direct SVG/PNG exports.
 */
export const openChartStandalone = (containerId: string, chartTitle?: string, customBgColor?: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`[openChartStandalone] Container not found: ${containerId}`);
        alert(`Chart container not found: ${containerId}`);
        return;
    }

    const title = chartTitle || containerId.replace(/_/g, ' ').replace(/-/g, ' ').toUpperCase();
    const theme = getPopupTheme();

    let resolvedBg = customBgColor;
    if (!resolvedBg) {
        if (container.classList.contains('bg-white') || window.getComputedStyle(container).backgroundColor.includes('255, 255, 255')) {
            resolvedBg = '#ffffff';
        } else {
            resolvedBg = theme.card;
        }
    }

    const serialized = getSerializedSvg(container, resolvedBg);
    if (!serialized) {
        alert("SVG element not found inside chart container. Please ensure the chart is fully loaded.");
        return;
    }

    const { svgString, width, height } = serialized;

    const popup = window.open("", "_blank", "width=1150,height=800,resizable=yes,scrollbars=yes");
    if (!popup) {
        alert("Popup blocker active. Please allow popups for knoMap to open stand-alone charts.");
        return;
    }

    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} — knoMap Standalone</title>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              background-color: ${theme.bg};
              color: ${theme.text};
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 16px 20px;
              display: flex;
              flex-direction: column;
              height: 100vh;
              overflow: hidden;
            }
            .header-bar {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1px solid ${theme.border};
              padding-bottom: 12px;
              margin-bottom: 14px;
              flex-shrink: 0;
            }
            .header-titles {
              display: flex;
              flex-direction: column;
              gap: 2px;
              min-width: 0;
            }
            .title {
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 0.02em;
              color: ${theme.text};
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .subtitle {
              font-size: 11px;
              color: ${theme.accent};
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .export-actions {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-shrink: 0;
            }
            .export-btn {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 6px 12px;
              background-color: ${theme.card};
              color: ${theme.text};
              border: 1px solid ${theme.border};
              border-radius: 8px;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              cursor: pointer;
              transition: all 0.2s ease;
              box-shadow: 0 2px 4px rgba(0,0,0,0.25);
            }
            .export-btn:hover {
              background-color: ${theme.accent};
              color: #050508;
              border-color: ${theme.accent};
              box-shadow: 0 0 12px ${theme.accent}55;
              transform: translateY(-1px);
            }
            .export-btn:active {
              transform: translateY(0);
            }
            .export-btn.active {
              background-color: ${theme.accent}25;
              color: ${theme.accent};
              border-color: ${theme.accent};
            }
            .btn-group {
              display: inline-flex;
              align-items: center;
              background-color: ${theme.card};
              border: 1px solid ${theme.border};
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.25);
            }
            .btn-group-btn {
              background: transparent;
              color: ${theme.text};
              border: none;
              border-right: 1px solid ${theme.border};
              padding: 6px 10px;
              font-size: 11px;
              font-weight: 800;
              cursor: pointer;
              transition: all 0.15s ease;
            }
            .btn-group-btn:last-child {
              border-right: none;
            }
            .btn-group-btn:hover {
              background-color: ${theme.accent};
              color: #050508;
            }
            .btn-group-btn:active {
              transform: translateY(1px);
            }
            .chart-container {
              flex: 1;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: ${resolvedBg};
              border: 1px solid ${theme.border};
              border-radius: 14px;
              padding: 16px;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
              overflow: hidden;
              position: relative;
            }
            svg {
              width: 100%;
              height: 100%;
              max-width: 100%;
              max-height: 100%;
              display: block;
              filter: drop-shadow(0 4px 12px rgba(0,0,0,0.1));
              cursor: grab;
              user-select: none;
            }
            svg.dragging {
              cursor: grabbing;
            }
            svg.stretch-mode text {
              transform-box: fill-box;
              transform-origin: center center;
              transform: scaleY(var(--text-scale-y, 1));
            }
            .zoom-hint {
              position: fixed;
              bottom: 10px;
              right: 14px;
              font-size: 10px;
              color: ${theme.textSub};
              opacity: 0.75;
              pointer-events: none;
              background: rgba(0,0,0,0.55);
              padding: 4px 10px;
              border-radius: 6px;
              backdrop-filter: blur(4px);
              border: 1px solid ${theme.border};
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div class="header-titles">
              <span class="title">${title}</span>
              <span class="subtitle">knoMap Standalone View</span>
            </div>
            <div class="export-actions">
              <button id="btnAspect" class="export-btn active" title="Alternar entre modo Estirado (Fill Window) o Proporción Fija">
                <span>Aspect: Stretch</span>
              </button>
              <div class="btn-group" title="Ajuste de Escala de Ejes">
                <button id="btnScaleYPlus" class="btn-group-btn" title="Agrandar escala vertical (Eje Y +) [Shift + Scroll]">+ Y</button>
                <button id="btnScaleYMinus" class="btn-group-btn" title="Achicar escala vertical (Eje Y -) [Shift + Scroll]">- Y</button>
                <button id="btnScaleXPlus" class="btn-group-btn" title="Agrandar escala horizontal (Eje X +) [Alt + Scroll]">+ X</button>
                <button id="btnScaleXMinus" class="btn-group-btn" title="Achicar escala horizontal (Eje X -) [Alt + Scroll]">- X</button>
              </div>
              <button id="btnReset" class="export-btn" title="Restablecer escala y paneo (100%) [Doble clic]">
                <span>Reset</span>
              </button>
              <button id="btnDownloadPng" class="export-btn" title="Descargar PNG en alta resolución (2400px)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>PNG</span>
              </button>
              <button id="btnDownloadSvg" class="export-btn" title="Descargar archivo vectorial SVG">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>SVG</span>
              </button>
            </div>
          </div>
          <div class="chart-container" id="zoomWrap">
            ${svgString}
          </div>
          <div class="zoom-hint">Scroll: Zoom · Shift+Scroll: Eje Y · Alt+Scroll: Eje X · Arrastrar: Paneo · Doble clic: Reset</div>
          <script>
            (function() {
              const wrap = document.getElementById('zoomWrap');
              const svg  = wrap ? wrap.querySelector('svg') : null;
              if (!svg) return;

              svg.style.width = '100%';
              svg.style.height = '100%';

              const btnAspect = document.getElementById('btnAspect');
              const btnReset  = document.getElementById('btnReset');
              const btnScaleYPlus  = document.getElementById('btnScaleYPlus');
              const btnScaleYMinus = document.getElementById('btnScaleYMinus');
              const btnScaleXPlus  = document.getElementById('btnScaleXPlus');
              const btnScaleXMinus = document.getElementById('btnScaleXMinus');

              let scaleX = 1, scaleY = 1, tx = 0, ty = 0;
              let isStretch = true;
              let dragging = false, startX = 0, startY = 0;

              const origVbW = ${width};
              const origVbH = ${height};

              function updateAspect() {
                if (isStretch) {
                  svg.setAttribute('preserveAspectRatio', 'none');
                  svg.classList.add('stretch-mode');
                  if (btnAspect) {
                    btnAspect.innerHTML = '<span>Aspect: Stretch</span>';
                    btnAspect.classList.add('active');
                  }
                } else {
                  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                  svg.classList.remove('stretch-mode');
                  svg.style.removeProperty('--text-scale-y');
                  svg.style.removeProperty('--text-scale-x');
                  if (btnAspect) {
                    btnAspect.innerHTML = '<span>Aspect: Fixed</span>';
                    btnAspect.classList.remove('active');
                  }
                }
                updateTextCompensation();
              }

              function updateTextCompensation() {
                if (!isStretch) return;
                const wrapRect = wrap.getBoundingClientRect();
                const curW = (wrapRect.width - 32) * scaleX;
                const curH = (wrapRect.height - 32) * scaleY;
                if (curW <= 0 || curH <= 0 || origVbW <= 0 || origVbH <= 0) return;
                const sx = curW / origVbW;
                const sy = curH / origVbH;
                if (sy > 0) {
                  const compY = sx / sy;
                  svg.style.setProperty('--text-scale-y', Math.max(0.2, Math.min(5, compY)));
                }
              }

              function apply() {
                svg.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scaleX + ', ' + scaleY + ')';
                svg.style.transformOrigin = '50% 50%';
                updateTextCompensation();
              }

              updateAspect();
              apply();

              window.addEventListener('resize', function() {
                updateTextCompensation();
              });

              wrap.addEventListener('wheel', function(e) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                if (e.shiftKey) {
                  scaleY = Math.min(20, Math.max(0.1, scaleY * delta));
                } else if (e.altKey || e.ctrlKey) {
                  scaleX = Math.min(20, Math.max(0.1, scaleX * delta));
                } else {
                  scaleX = Math.min(20, Math.max(0.1, scaleX * delta));
                  scaleY = Math.min(20, Math.max(0.1, scaleY * delta));
                }
                apply();
              }, { passive: false });

              wrap.addEventListener('mousedown', function(e) {
                if (e.target && e.target.closest('button')) return;
                dragging = true;
                startX = e.clientX - tx;
                startY = e.clientY - ty;
                svg.classList.add('dragging');
              });

              window.addEventListener('mousemove', function(e) {
                if (!dragging) return;
                tx = e.clientX - startX;
                ty = e.clientY - startY;
                apply();
              });

              window.addEventListener('mouseup', function() {
                dragging = false;
                svg.classList.remove('dragging');
              });

              function reset() {
                scaleX = 1; scaleY = 1; tx = 0; ty = 0;
                apply();
              }

              wrap.addEventListener('dblclick', reset);
              if (btnReset) btnReset.addEventListener('click', reset);

              if (btnAspect) {
                btnAspect.addEventListener('click', function() {
                  isStretch = !isStretch;
                  updateAspect();
                  apply();
                });
              }

              if (btnScaleYPlus) btnScaleYPlus.addEventListener('click', function() {
                scaleY = Math.min(20, scaleY * 1.25); apply();
              });
              if (btnScaleYMinus) btnScaleYMinus.addEventListener('click', function() {
                scaleY = Math.max(0.1, scaleY / 1.25); apply();
              });
              if (btnScaleXPlus) btnScaleXPlus.addEventListener('click', function() {
                scaleX = Math.min(20, scaleX * 1.25); apply();
              });
              if (btnScaleXMinus) btnScaleXMinus.addEventListener('click', function() {
                scaleX = Math.max(0.1, scaleX / 1.25); apply();
              });

              function getFilename(ext) {
                const safe = (${JSON.stringify(title)}).replace(/[^a-zA-Z0-9_\\-\\s]/g, '').trim().replace(/\\s+/g, '_').toLowerCase();
                return (safe || 'knomap_chart') + '.' + ext;
              }

              // Download SVG
              const btnSvg = document.getElementById('btnDownloadSvg');
              if (btnSvg) {
                btnSvg.addEventListener('click', function() {
                  const currentSvg = wrap.querySelector('svg');
                  if (!currentSvg) return;
                  const cloned = currentSvg.cloneNode(true);
                  cloned.removeAttribute('style');
                  cloned.classList.remove('dragging');
                  if (isStretch) {
                    cloned.setAttribute('preserveAspectRatio', 'none');
                  } else {
                    cloned.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                  }

                  const serializer = new XMLSerializer();
                  let source = serializer.serializeToString(cloned);
                  if (!source.match(/^<svg[^>]+xmlns="http\\:\\/\\/www\\.w3\\.org\\/2000\\/svg"/)) {
                    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                  }
                  const svgData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<?xml version="1.0" standalone="no"?>\\r\\n' + source);
                  const a = document.createElement('a');
                  a.href = svgData;
                  a.download = getFilename('svg');
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                });
              }

              // Download PNG (High Resolution rasterization at 2400px)
              const btnPng = document.getElementById('btnDownloadPng');
              if (btnPng) {
                btnPng.addEventListener('click', function() {
                  const currentSvg = wrap.querySelector('svg');
                  if (!currentSvg) return;
                  const cloned = currentSvg.cloneNode(true);
                  cloned.removeAttribute('style');
                  cloned.classList.remove('dragging');

                  let vbW = origVbW, vbH = origVbH;
                  const vb = cloned.getAttribute('viewBox');
                  if (vb) {
                    const p = vb.trim().split(/[\\s,]+/).map(Number);
                    if (p.length >= 4 && p[2] > 0 && p[3] > 0) {
                      vbW = p[2];
                      vbH = p[3];
                    }
                  }

                  const wrapRect = wrap.getBoundingClientRect();
                  let aspect = vbH / vbW;
                  if (isStretch && wrapRect.width > 0 && wrapRect.height > 0) {
                    aspect = (wrapRect.height * scaleY) / (wrapRect.width * scaleX);
                  }

                  const targetW = 2400;
                  const targetH = Math.max(200, Math.round(targetW * aspect));
                  cloned.setAttribute('width', targetW);
                  cloned.setAttribute('height', targetH);
                  if (isStretch) {
                    cloned.setAttribute('preserveAspectRatio', 'none');
                  } else {
                    cloned.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                  }

                  const serializer = new XMLSerializer();
                  let source = serializer.serializeToString(cloned);
                  if (!source.match(/^<svg[^>]+xmlns="http\\:\\/\\/www\\.w3\\.org\\/2000\\/svg"/)) {
                    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                  }

                  const svgData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<?xml version="1.0" standalone="no"?>\\r\\n' + source);
                  const img = new Image();
                  img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.fillStyle = '${resolvedBg}';
                    ctx.fillRect(0, 0, targetW, targetH);
                    ctx.drawImage(img, 0, 0, targetW, targetH);

                    const pngData = canvas.toDataURL('image/png', 1.0);
                    const a = document.createElement('a');
                    a.href = pngData;
                    a.download = getFilename('png');
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  };
                  img.src = svgData;
                });
              }
            })();
          </script>
        </body>
      </html>
    `);
    popup.document.close();
};


