# Documentación Integral del Ecosistema de Skills Agénticas (UNAM / Antigravity)

**Fecha:** Octubre 2026  
**Ecosistema:** knoMap · SinapsisAI · TlachIA-Hands · Topics · PLmetrix · RevistasLATAM · sos-mcp-services  
**Referencia Metodológica:** `workflow-skill-creator` y Guía de Customizaciones de Antigravity (`agy-customizations`).  

---

## 1. Resumen Ejecutivo y Marco Normativo

El ecosistema de Inteligencia Científica y Cienciometría Computacional de la UNAM cuenta con un catálogo de **35 habilidades modulares (Skills)** diseñadas para capacitar a los agentes de IA (Antigravity IDE, OpenHands / TlachIA-Hands) en la ejecución de flujos de trabajo especializados.

### Estándar de Calidad según `workflow-skill-creator`

Toda Skill en el ecosistema debe satisfacer los siguientes principios canónicos:

1. **Estructura de Directorio:**
   ```text
   skills/<skill-name>/
   ├── SKILL.md          # Especificación principal con YAML frontmatter
   ├── scripts/          # Herramientas ejecutables CLI con argparse y --output
   ├── references/       # Documentación teórica, esquemas y taxonomías
   └── examples/         # Casos de uso de referencia y datasets de prueba
   ```
2. **YAML Frontmatter Obligatorio:**
   - `name`: Identificador único en minúsculas y separado por guiones (`^[a-z0-9]+(-[a-z0-9]+)*$`), $\le 64$ caracteres.
   - `description`: Redactada en tercera persona, explicando con precisión **qué hace** y **cuándo debe activarse** ($\le 1024$ caracteres).
   - `dependencies`: Declaración explícita del entorno Python (`/home/ambientesPy/revistaslatam`) y scripts CLI asociados.
3. **Patrón CLI Orientado a Archivos:**
   - Las operaciones de extracción, cálculo o transformación deben generar archivos en disco (`--output <ruta>`), nunca volcar payloads masivos a `stdout`.
   - Control estricto de tasas de petición (*rate limiting*) en scrapers y APIs externas.
4. **Divulgación Progresiva (*Progressive Disclosure*):**
   - El archivo `SKILL.md` debe mantenerse conciso y accionable. Tablas extensas, manuales matemáticos y esquemas de base de datos se desacoplan en `references/*.md`.

---

## 2. Ubicaciones y Jerarquía de Resolución

Las skills se gestionan en cuatro capas principales del entorno de trabajo:

| Ubicación | Repositorio / Ámbito | Rol en el Ecosistema |
|---|---|---|
| `/home/labsom/knomap/.agents/skills/` | `knoMap` | Motor neuronal SOM, reducción dimensional (MLE, UMAP), ingesta y tesauros. *(Enlazado simbólicamente desde `engine/skills/`)*. |
| `/mnt/expansion/desplegados/sos-mcp-services/.agents/skills/` | `sos-mcp-services` | Repositorio maestro de servicios analíticos, scrapers/harvesters y herramientas CLI autónomas. |
| `/mnt/expansion/desplegados/TlachIA-Hands/.agents/skills/` | `TlachIA-Hands` | Orquestador y frontend para agentes. Incluye el índice maestro `tlachia-master-index` y protocolos de invocación MCP. |
| `/home/jlja/.gemini/config/skills/` | Configuración Global (`~/.gemini/config`) | Skills disponibles universalmente en cualquier espacio de trabajo de la estación. |

---

## 3. Catálogo y Taxonomía de Skills por Dominio

El ecosistema se estructura en **6 dominios analíticos**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TAXONOMÍA DE SKILLS DEL ECOSISTEMA UNAM                               │
├───────────────────────────────┬───────────────────────────────┬─────────────────────────────────────────┤
│ 1. Ingesta & Harvesters       │ 2. Normalización & Entidades  │ 3. Modelado Topológico & SOM            │
│ • arxiv-harvester             │ • bibliographic-corpus-parser │ • bibliometrics-som-flow                │
│ • openalex-harvester          │ • bibliometric-entity-norm    │ • incites-som-pipeline                  │
│ • scopus-harvester            │ • bibliometric-eda-norm       │ • neural-longitudinal-mapping           │
│ • semantic-scholar-harvester  │ • snii-identity-resolver      │ • semantic-manifold-expert (y MLE)      │
│                               │                               │ • som-methodological-expert             │
├───────────────────────────────┼───────────────────────────────┼─────────────────────────────────────────┤
│ 4. Cienciometría Cuantitativa │ 5. Geopolítica, OA & Editorial│ 6. Orquestación & Meta-Skills           │
│ • bibliometric-eda-profiler   │ • geopolitical-collab-analyst │ • knomap-unified-orchestrator           │
│ • bibliometric-network-analyst│ • geopolitical-science-map    │ • project-hub-manager                   │
│ • classical-bibliometrics-laws│ • open-access-monitor         │ • tlachia-master-index                  │
│ • tlachia-metrics-engine      │ • openalex-search-engineer    │ • workflow-skill-creator                │
│ • scientometrics-incites      │ • revistaslatam-indicators    │                                         │
│                               │ • revistaslatam-editorial     │                                         │
│                               │ • topics-research-fronts      │                                         │
│                               │ • graphrag-scientific-intel   │                                         │
│                               │ • research-fronts-detection   │                                         │
│                               │ • sdg-impact-intelligence     │                                         │
│                               │ • infotlachia-scholar-intel   │                                         │
└───────────────────────────────┴───────────────────────────────┴─────────────────────────────────────────┘
```

---

### Grupo Especializado: `openalex-mexico-clickhouse` (Producción Científica de México en ClickHouse)

Grupo de 5 skills optimizadas para consultar las tablas materializadas del corpus mexicano (`rag.works_academic_all`, `rag.authors_seed_mexico`, `rag.academics_all`, `rag.institutions_seed_mexico`):

| Skill | Tipo | Script CLI | Salidas | Resumen y Activación |
|---|---|---|---|---|
| `openalex-mexico-author-search` | CLI Autónoma | `openalex_mexico_cli.py` | JSON | Búsqueda y desambiguación de investigadoras/es de México en `rag.authors_seed_mexico` (2.57M) y `rag.academics_all`, con filtros por nivel SNII y variantes de nombres hispanos. |
| `openalex-mexico-works-search` | CLI Autónoma | `openalex_mexico_cli.py` | JSON | Búsqueda granular sobre `rag.works_academic_all` (~1.65M de publicaciones de México) por institución ROR, año, vía OA y percentiles Top 10% / Top 1%. |
| `openalex-mexico-aggregations` | CLI Autónoma | `openalex_mexico_cli.py` | JSON | Agregaciones analíticas instantáneas: distribución de vías OA, gasto acumulado en APC comercial (USD), porcentaje en el Top 10% mundial y series anuales. |
| `openalex-mexico-institutions` | CLI Autónoma | `openalex_mexico_cli.py` | JSON | Catálogo nacional de universidades y centros de investigación en `rag.institutions_seed_mexico`, resolviendo identificadores ROR y acrónimos (UNAM, IPN, UAM, Cinvestav). |
| `openalex-mexico-query-architect` | Metodológica / Seg | `openalex_mexico_cli.py` | JSON / Reporte | Asesor técnico de diseño de consultas ClickHouse sobre el corpus mexicano y guardián de la regla inquebrantable de **CERO JOINs**. |

---

### Dominio 1: Ingesta y Extracción Masiva de Literatura Científica

| Skill | Tipo | Script CLI | Salidas | Resumen y Activación |
|---|---|---|---|---|
| `arxiv-harvester` | CLI Autónoma | `arxiv_harvest_cli.py` | Parquet / JSON | Descarga y normalización de preprints científicos desde la API Atom XML de arXiv hacia tablas canónicas estandarizadas. |
| `openalex-harvester` | CLI Autónoma | `openalex_harvest_cli.py` | Parquet / JSON | Extracción y paginación por cursor de metadatos de obras desde la API REST pública de OpenAlex con control de cuota. |
| `scopus-harvester` | CLI Autónoma | `scopus_harvest_cli.py` | Parquet / JSON | Consulta a la Search API de Elsevier Scopus con rate-limiting estricto y normalización de identificadores Scopus. |
| `semantic-scholar-harvester` | CLI Autónoma | `s2_harvest_cli.py` | Parquet / JSON | Extracción de grafos de citas e identificación de citas influyentes (*influential citations*) vía Semantic Scholar Graph API. |

---

### Dominio 2: Limpieza, Normalización y Resolución de Identidad

| Skill | Tipo | Script CLI | Salidas | Resumen y Activación |
|---|---|---|---|---|
| `bibliographic-corpus-parser` | CLI Autónoma | `corpus_parser_cli.py` | Parquet / CSV | Ingesta de formatos heterogéneos (WoS plano/tab, Scopus CSV, RIS, PubMed XML, OpenAlex JSON) hacia esquema tabular unificado. |
| `bibliometric-entity-normalizer` | CLI Autónoma | `entity_normalizer_cli.py` | Tesauro TXT/JSON | Detección de variantes y desambiguación difusa (Jaro-Winkler, Levenshtein) para autores, instituciones y términos compatibles con VOSviewer. |
| `bibliometric-eda-normalization` | Metodológica | — | N/A | Protocolo de validación interactiva para normalización previa a cálculos topológicos. |
| `snii-identity-resolver` | CLI Autónoma | `snii_resolver_cli.py` | JSON / Reporte | Verificación oficial, homonimia y desambiguación de investigadoras/es en el Padrón Nacional SNII México 2025 (área, nivel, vigencia). |

---

### Dominio 3: Modelado Topológico y Redes Neuronales (SOM)

| Skill | Tipo | Script CLI | Salidas | Resumen y Activación |
|---|---|---|---|---|
| `bibliometrics-som-flow` | Metodológica | — | N/A | Flujo end-to-end de ingesta bibliográfica, extracción de co-ocurrencias y proyección topológica en mapas de Kohonen. |
| `incites-som-pipeline` | Metodológica | — | N/A | Protocolo de calibración SOM especializado en exportaciones multidimensionales del InCites Benchmarking de Clarivate. |
| `neural-longitudinal-mapping` | CLI Autónoma | `neural_longitudinal_cli.py` | JSON / Pesos SOM | Modelado de series temporales multivariadas y deriva sináptica intertemporal (*warm-start*) en niveles macro, meso y micro. |
| `semantic-manifold-expert` | Metodológica | — | N/A | Análisis teórico de variedades semánticas, compresión no lineal y preservación de curvatura. |
| `semantic-manifold-mle` | Metodológica | — | N/A | Estimación rigurosa de Dimensión Intrínseca Local mediante MLE (percentil 95) y TwoNN con `skdim`. |
| `som-methodological-expert` | Metodológica | — | N/A | Calibración de topología neuronal, tamaño espectral de malla por SVD, cálculo de U-Matrix y calidad topológica/cuantización. |

---

### Dominio 4: Cienciometría Cuantitativa y Leyes Clásicas

| Skill | Tipo | Script CLI | Salidas | Resumen y Activación |
|---|---|---|---|---|
| `bibliometric-eda-profiler` | CLI Autónoma | `biblio_eda_cli.py` | JSON | Perfilado de impacto de autores (Índices H, G, M), análisis de supervivencia temporal de palabras clave y métricas de dispersión. |
| `bibliometric-network-analyst` | CLI / Protocolo | `biblio_network_cli.py` | GML / JSON | Redes de coautoría, co-ocurrencia y acoplamiento bibliográfico; cálculo de fuerza de asociación (Salton) y partición Louvain. |
| `classical-bibliometrics-laws` | CLI / Protocolo | `bibliometric_laws_cli.py` | JSON / Parquet | Ajuste matemático de leyes clásicas: Lotka (autores), Bradford (dispersión de revistas), Zipf (vocabulario) e Índice de Price. |
| `scientometrics-incites-expert` | Metodológica | — | N/A | Benchmarking institucional con indicadores normalizados por categoría (CNCI, FWCI, % Top 10%, colaboración internacional). |
| `tlachia-metrics-engine` | CLI Autónoma | `tlachia_metrics_cli.py` | Parquet / JSON | Motor integral con más de 30 indicadores cienciométricos, gasto comercial APC, distribución OA y desglose temporal. |

---

### Dominio 5: Inteligencia Estratégica, Geopolítica y Editorial

| Skill | Tipo | Script CLI | Salidas | Resumen y Activación |
|---|---|---|---|---|
| `geopolitical-collaboration-analyst` | CLI Autónoma | `geopolitical_collab_cli.py` | JSON | Cartografía geopolítica, matrices de coautoría ISO-3166-1 alpha-3, Coseno de Salton bilateral, benchmarking regional y tasa de liderazgo científico. |
| `geopolitical-science-mapping` | Protocolo MCP | — | N/A | Enrutador agéntico hacia el microservicio MCP `topics-research-fronts-engine`. |
| `graphrag-scientific-intelligence` | Protocolo MCP | — | N/A | Consultas híbridas GraphRAG combinando Neo4j (grafo), Qdrant (vectores) y ClickHouse. |
| `infotlachia-scholar-intelligence` | CLI / Protocolo | `infotlachia_cli.py` | JSON | Inteligencia profunda sobre el Padrón SNII 2025, caché DuckDB de 14 tablas, APC y UMAP 2D/3D. |
| `journal-editorial-intelligence` | Protocolo MCP | — | N/A | Evaluación cienciométrica de revistas, Acceso Abierto Diamante, indización SciELO/DOAJ/Redalyc. |
| `open-access-monitor` | CLI Autónoma | `open_access_monitor_cli.py` | JSON | Auditoría de las 6 vías canónicas de OA (Diamante, Gold, Híbrido, Verde, Bronce, Cerrado), estimación de gasto en APC y transición anual. |
| `openalex-search-engineer` | CLI / Protocolo | `openalex_search_cli.py` | JSON | Optimización de consultas sobre la instancia ClickHouse local (569M trabajos), tokenización y diacríticos. |
| `research-fronts-detection-expert` | Protocolo MCP | — | N/A | Detección multimodal de frentes (v5.0), evolución longitudinal con AMI y análisis aluvial de linajes temáticos. |
| `revistaslatam-editorial-intelligence` | Protocolo MCP | — | N/A | Catálogo de revistas iberoamericanas, evaluación editorial integral y checklist de indización. |
| `revistaslatam-indicators-engine` | CLI Autónoma | `revistaslatam_indicators_cli.py` | JSON | Cálculo de endogamia editorial institucional, balance de multilingüismo y auditoría de los 38 criterios de Latindex Catálogo 2.0. |
| `sdg-impact-intelligence` | Metodológica | — | N/A | Mapeo y evaluación de la producción científica en los 17 Objetivos de Desarrollo Sostenible (ODS ONU 2030). |
| `topics-research-fronts-intelligence`| Protocolo MCP | — | N/A | Diccionario de linajes temáticos AMI, cuadrantes geopolíticos y taxonomía jerárquica Sunburst. |

---

### Dominio 6: Meta-Habilidades, Hubs y Orquestación

| Skill | Tipo | Script CLI | Salidas | Resumen y Activación |
|---|---|---|---|---|
| `knomap-unified-orchestrator` | Metodológica | — | N/A | Coordinación de flujos multi-fase desde extracción de datos masivos hasta modelado topológico. |
| `project-hub-manager` | CLI Autónoma | `knomap_project_cli.py` | SQLite / ZIP | Persistencia y gestión relacional de proyectos en `knomap_hub.db`, manifiestos v2 y paquetes portables `.knomap`. |
| `tlachia-master-index` | Índice Maestro | — | N/A | Índice de arranque *always-active* en TlachIA-Hands con el mapa de herramientas MCP y slash commands. |
| `workflow-skill-creator` | Meta-Habilidad | `cli_script_template.py` | Skill Folder | Generador e ingeniería de nuevas habilidades agénticas a partir de flujos de trabajo completados. |

---

## 4. Matriz de Auditoría y Estado Actual de Implementación

| Skill | Repositorios Presentes | Scripts CLI | Referencias | Estado / Observación |
|:---|:---|:---:|:---:|:---|
| `arxiv-harvester` | `sos-mcp`, `gemini-config` | Sí | 2 docs | Conforme a estándar. |
| `bibliographic-corpus-parser` | `knomap` | Sí | 2 docs | Conforme a estándar. |
| `bibliometric-eda-normalization` | `knomap` | No | — | Metodológica pura. Conforme. |
| `bibliometric-eda-profiler` | `knomap` | Sí | 2 docs | Conforme a estándar. |
| `bibliometric-entity-normalizer` | `knomap` | Sí | 2 docs | Conforme a estándar. |
| `bibliometric-network-analyst` | `TlachIA`, `sos-mcp`, `gemini-config` | Sí | 2 docs | Divergencia: TlachIA tiene versión resumen (19 líns), sos-mcp tiene versión completa (164 líns). |
| `bibliometrics-som-flow` | `knomap` | No | — | Metodológica pura. Conforme. |
| `classical-bibliometrics-laws` | `TlachIA`, `sos-mcp`, `gemini-config` | Sí | 2 docs | Divergencia: TlachIA tiene versión resumen (21 líns), sos-mcp tiene versión completa (73 líns). |
| `geopolitical-collaboration-analyst` | `sos-mcp`, `gemini-config` | Sí | 2 docs | Conforme a estándar. |
| `geopolitical-science-mapping` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Versión corta (14 líns, MCP stub). |
| `graphrag-scientific-intelligence` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Versión corta (14 líns, MCP stub). |
| `incites-som-pipeline` | `knomap` | No | — | Metodológica pura. Conforme. |
| `infotlachia-scholar-intelligence` | `TlachIA`, `sos-mcp`, `gemini-config` | Sí | 2 docs | Completa en sos-mcp (76 líns), resumen en TlachIA (66 líns). |
| `journal-editorial-intelligence` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Protocolo MCP. Conforme. |
| `knomap-unified-orchestrator` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Protocolo agéntico. Conforme. |
| `neural-longitudinal-mapping` | `knomap`, `sos-mcp`, `gemini-config` | Sí | 2 docs | Altamente completa (190 líns, papers de referencia). |
| `open-access-monitor` | `sos-mcp`, `gemini-config` | Sí | — | **Anomalía:** `SKILL.md` faltaba en `sos-mcp-services` (el script CLI sí existía). |
| `openalex-harvester` | `sos-mcp`, `gemini-config` | Sí | 2 docs | Conforme a estándar. |
| `openalex-search-engineer` | `TlachIA`, `sos-mcp`, `gemini-config` | Sí | 2 docs | Completa en sos-mcp (63 líns), resumen en TlachIA (26 líns). |
| `project-hub-manager` | `knomap` | Sí | 2 docs | Conforme a estándar. |
| `research-fronts-detection-expert` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Protocolo MCP. Conforme. |
| `revistaslatam-editorial-intelligence` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Protocolo MCP. Conforme. |
| `revistaslatam-indicators-engine` | `sos-mcp`, `gemini-config` | Sí | 2 docs | Conforme a estándar. |
| `scientometrics-incites-expert` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Protocolo MCP. Conforme. |
| `scopus-harvester` | `sos-mcp`, `gemini-config` | Sí | 2 docs | Conforme a estándar. |
| `sdg-impact-intelligence` | `sos-mcp`, `gemini-config` | No | — | **Anomalía:** En `gemini-config` solo tiene borrador de 9 líns; en `sos-mcp` falta `SKILL.md`. |
| `semantic-manifold-expert` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Metodológica pura. Conforme. |
| `semantic-manifold-mle` | `knomap` | No | — | Metodológica pura. Conforme. |
| `semantic-scholar-harvester` | `sos-mcp`, `gemini-config` | Sí | 2 docs | Conforme a estándar. |
| `snii-identity-resolver` | `sos-mcp`, `gemini-config` | Sí | 2 docs | Conforme a estándar. |
| `som-methodological-expert` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Metodológica pura. Conforme. |
| `tlachia-master-index` | `TlachIA` | No | — | Índice maestro frontend. Conforme. |
| `tlachia-metrics-engine` | `sos-mcp`, `gemini-config` | Sí | 3 docs | Conforme a estándar (96 líns, 3 referencias analíticas). |
| `topics-research-fronts-intelligence` | `TlachIA`, `sos-mcp`, `gemini-config` | No | — | Protocolo MCP. Conforme. |
| `workflow-skill-creator` | `sos-mcp`, `knomap`, `gemini-config` | No | 1 doc | **Anomalía:** Carpeta con guión bajo `workflow_skill_creator` en knomap y gemini-config vs guión medio en sos-mcp. |

---

## 5. Hallazgos y Plan de Estandarización Propuesto

1. **Sincronización de `open-access-monitor`:**
   Copiar el `SKILL.md` canónico desde `~/.gemini/config/skills/open-access-monitor/` hacia `/mnt/expansion/desplegados/sos-mcp-services/.agents/skills/open-access-monitor/`.
2. **Definición de `sdg-impact-intelligence`:**
   Completar el `SKILL.md` (actualmente un borrador trunco de 9 líneas) documentando formalmente el mapeo hacia los 17 ODS de la ONU y su integración con los servicios `topics-research-fronts-engine`.
3. **Normalización del nombre de `workflow-skill-creator`:**
   Renombrar la carpeta de `workflow_skill_creator` a `workflow-skill-creator` en `knomap` y `~/.gemini/config/skills/` para cumplir la especificación canónica.
4. **Armonización TlachIA-Hands vs sos-mcp-services:**
   Las versiones en `TlachIA-Hands` para `bibliometric-network-analyst`, `classical-bibliometrics-laws` y `openalex-search-engineer` son resúmenes breves que sólo apuntan a herramientas MCP. Se recomienda actualizar `TlachIA-Hands` con la versión rica de `sos-mcp-services` para que el agente tenga acceso tanto a las invocaciones CLI locales como al contexto teórico completo.
