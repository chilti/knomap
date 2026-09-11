# TODO / Roadmap: Integración de Analítica de Revistas, Países Editoriales y Filtro de Hiperautoría en knoMap

**Estado:** Documentado como TODO / Especificación Técnica para Futura Implementación  
**Módulo Objetivo:** `knomap/engine` (Python) + `backend` (C# .NET) + `frontend` (React)  
**Proyecto Piloto de Validación:** Investigación Bibliométrica en Enfermedades Respiratorias (Neumología México, 1980–2025)

---

## 1. Contexto y Justificación Científica

Durante la investigación cienciométrica sobre la producción mexicana en Enfermedades Respiratorias (1980–2025 y 2021–2025) a partir de datos de Clarivate InCites (Web of Science Core Collection + ESCI), se identificaron dos necesidades metodológicas clave que deben formalizarse dentro de la plataforma **knoMap**:

1. **Analítica de Revistas y Geografía Editorial (`Publication Sources & Country Venues`):**
   * Evaluar no solo qué instituciones producen ciencia, sino en qué revistas y bajo qué soberanías editoriales (país de la revista) se disemina la producción.
   * Identificar la tasa de retención nacional (endogamia editorial) vs. diáspora internacional, detectando la cuota de producción capturada por editoriales dominantes (EE. UU., Reino Unido, Países Bajos, Suiza/MDPI/Frontiers).
   * Monitorear el impacto diferencial (citas por artículo y CNCI) entre las publicaciones en revistas nacionales vs. revistas internacionales (*Dual-Track Communication Model*).

2. **Filtro de Sensibilidad ante Hiperautoría / Megacolaboraciones (`Hyper-Authorship Sensitivity Filter`):**
   * En biomedicina y física de altas energías, los consorcios internacionales con cientos o miles de coautores (*consortium papers*) generan distorsiones severas en los indicadores agregados (citas brutas, citas por documento y CNCI).
   * Se requiere una función nativa en knoMap para contrastar automáticamente un **Corpus Completo (Unrestricted)** frente a un **Corpus Restringido (ej. ≤100 autores por documento)**, permitiendo verificar si el impacto de una disciplina u organización es genuino y evaluar el liderazgo intelectual nacional a través de las tasas de **Primer Autor** y **Autor de Correspondencia**.

---

## 2. Especificación de Componentes a Implementar

### A. Motor Analítico Python (`engine/`)

#### 1. Módulo `engine/journal_editorial_engine.py` (o extensión de `incites_parser.py`)
- **Ingesta de `Incites Publication Sources` (.xlsx / .csv):**
  - Mapeo y limpieza de la columna `Publication Source Country/Region`.
  - Normalización canónica de países (`USA` -> `United States`, `ENGLAND` -> `United Kingdom`, `GERMANY (FED REP GER)` -> `Germany`, `CHINA MAINLAND` -> `China`, etc.).
- **Métricas de Agregación Editorial:**
  - Conteo de revistas únicas activas por país.
  - Conteo y proporción (%) de artículos publicados por país de la revista.
  - Citas brutas, promedio de citas por artículo (C/D) e impacto normalizado (CNCI) por país editorial.
  - Cálculo de la **Tasa de Retención Nacional (Endogamia Editorial):** $\text{Share}_{\text{Domestic}} = \frac{\text{Artículos en Revistas Nacionales}}{\text{Total de Artículos}} \times 100$.
  - Detección del **Núcleo de Bradford** (revistas que concentran el primer tercio de la producción).
- **Generación de Visualizaciones Publicables:**
  - Función `plot_publication_countries_2x2()`: Gráfico multicanal de 4 paneles (horizontal bar charts) comparando dos periodos temporales (Histórico vs. Quinquenio Reciente) con dos dimensiones (Revistas y Artículos), destacando automáticamente al país sede del estudio en color contrastante.
  - Exportación automática a PNG (300 DPI), SVG y PDF vectorial.

#### 2. Módulo `engine/sensitivity_filter.py`
- **Gestión de Umbrales de Hiperautoría (`Authors per Document`):**
  - Soporte para procesar datasets exportados con filtros de InCites: `[1, 50]`, `[1, 100]`, `[1, 1000]`.
  - Comparativa pareada automatizada entre **Corpus Completo** y **Corpus Filtrado (≤ N autores)**.
- **Cálculo de Robustez y Liderazgo:**
  - Delta de retención de citas: $\Delta \text{Citas} = \frac{\text{Citas}_{\le 100} - \text{Citas}_{\text{Total}}}{\text{Citas}_{\text{Total}}} \times 100$.
  - Estabilidad del CNCI y ratios de ventaja frente a la media nacional y de área macro.
  - Métricas de gobernanza científica: Porcentaje de **Primer Autor** (`% First Author`), **Último Autor** (`% Last Author`) y **Autor de Correspondencia** (`% Corresponding Author`).

#### 3. Módulo `engine/benchmarking_report_bridge.py`
- Generación automatizada de libros Excel ejecutivos con formato corporativo (paleta Navy, bordes, formatos numéricos estrictos y metadatos auditables).
- Generación / inyección automatizada de tablas (Table 1, Table 2, Table 3) y figuras en documentos Word (`.docx`) mediante `python-docx`.

---

### B. Backend .NET Core (`backend/src/LabSOM.Backend.Core/`)

- **DTOs y Modelos:**
  - `JournalCountryDistributionDto`: Lista de países con conteo de revistas, artículos, citas, CNCI y porcentaje.
  - `SensitivityAnalysisDto`: Matriz comparativa entre corpus completo y filtrado, incluyendo deltas y métricas de autoría.
- **Servicios (`InCitesService.cs`):**
  - Métodos `GetJournalCountryAnalyticsAsync(string datasetId, string period)`
  - Método `GetSensitivityBenchmarkAsync(string fullDatasetId, string filteredDatasetId)`
- **Endpoints API (`Program.cs` / Controladores):**
  - `POST /api/incites/journal-analytics`: Procesa archivos de *Publication Sources* y retorna la distribución geográfica y revistas líderes.
  - `POST /api/incites/sensitivity-benchmark`: Procesa reportes cruzados con y sin filtro de autores y retorna el reporte de robustez.

---

### C. Frontend React (`frontend/src/`)

- **Nueva Pestaña / Vista en `InCitesExplorer.tsx`:**
  - **Panel "Revistas y Geografía Editorial":**
    - Gráficas de barras interactivas (ECharts / Recharts) conmutables entre número de revistas y volumen de artículos por país de publicación.
    - Selector interactivo para destacar el país local.
    - Tabla dinámica de revistas nacionales e internacionales con búsqueda por ISSN, cuartil JCR y CNCI.
  - **Control "Filtro de Hiperautoría (Megacolaboraciones)":**
    - Switch toggle en el encabezado de InCites: *[ Todos los autores | Máximo 100 autores ]*.
    - Vista comparativa lado a lado (Side-by-Side Diff) que muestre en tiempo real la variación del CNCI y la tasa de liderazgo (Primer Autor y Corresponsal).

---

## 3. Scripts de Referencia Desarrollados en el Piloto

Los algoritmos y flujos validados se encuentran documentados y listos para ser adaptados desde los siguientes scripts de referencia del proyecto de Neumología:

| Script / Artefacto | Funcionalidad Clave Validada |
| :--- | :--- |
| `scratch/analyze_pub_sources.py` | Agregación por país de revista, limpieza de nombres canónicos y cálculo de proporciones. |
| `scratch/generate_journal_country_figures.py` | Generación de la figura 2x2 en Matplotlib con barras horizontales, etiquetas de conteo y porcentaje, y destaque de México. |
| `scratch/inspect_top_journals.py` | Extracción del top de revistas mexicanas e internacionales con cálculo de Citas/Doc y CNCI. |
| `scratch/update_workbook_with_max100.py` | Construcción de la hoja Excel `Comparativa_Max100_Autores` y sincronización de metadatos. |
| `scratch/add_journals_table_to_manuscript.py` | Inyección de la Tabla 3 y Figura 1 en `manuscrito.docx` con formato de imprenta. |

---

## 4. Prioridad y Dependencias

* **Prioridad:** Media / Alta (después de consolidar el módulo base de InCites / La Maquinita en knoMap).
* **Dependencias:** `pandas`, `openpyxl`, `matplotlib`, `python-docx`, `pythonnet` (para IPC con .NET).
* **Fecha de Registro:** Septiembre 2026.
