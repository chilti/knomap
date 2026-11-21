# Plan de Implementación: Enriquecimiento de Resúmenes, Palabras Clave y Embeddings Comparativos para México en ClickHouse (`rag`)

**Destinatario:** Agente / Ingeniero de Datos con acceso a ClickHouse (base `rag`).  
**Objetivo:** Consolidar en `rag.works_mexico_abstracts_enriched` toda la producción de México (~1.20M registros), enriqueciendo con `title`, `author_keywords`, `keywords`, `abstract_final` y tres columnas de embeddings (`nomic`, `qwen`, `specter2`) para experimentación comparativa.

---

## 1. Esquema Oficial de la Tabla `rag.works_mexico_abstracts_enriched`

```sql
CREATE TABLE IF NOT EXISTS rag.works_mexico_abstracts_enriched
(
    id String,
    doi String,
    pmid String,
    pmcid String,
    publication_year UInt16,
    type LowCardinality(String),
    language LowCardinality(String),
    is_oa UInt8,
    source_id String,
    
    -- Metadatos textuales clave
    title String,
    author_keywords Array(String),       -- Palabras clave declaradas por los autores
    keywords Array(String),              -- Palabras clave normalizadas / MeSH / OpenAlex
    abstract_final String,
    abstract_source LowCardinality(String), -- 'works_flat', 'works_academic_raw', 'pubmed', 'europepmc', 's2ag', 'oai_scielo', 'pdf_grobid', 'none'
    
    -- Columnas vectoriales para experimentación comparativa
    embedding_nomic Array(Float32),      -- nomic-ai/nomic-embed-text-v2-moe (768d)
    embedding_qwen Array(Float32),       -- Qwen/Qwen3-Embedding (1024d)
    
    updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (publication_year, id)
SETTINGS index_granularity = 8192;
```

---

## 2. Fases de Ejecución

### Fase 0: Consolidación Interna en ClickHouse *(Coste 0; ~3–5 min)*
1. **Creación de tabla:** Ejecutar `CREATE TABLE IF NOT EXISTS rag.works_mexico_abstracts_enriched`.
2. **Ingesta desde `rag.works_flat` (`has(country_codes, 'MX')`):**
   * Migrar los 1,204,033 registros mapeando `id`, `doi`, `pmid`, `publication_year`, `type`, `language`, `is_oa`, `source_id`, `title`, `keywords` y los **870,273 abstracts planos** existentes (`abstract_source = 'works_flat'`).
3. **Extracción desde `raw_data` (`rag.works_academic_all` y `rag.works_seed_mexico`):**
   * Extraer `author_keywords` y `abstract_inverted_index` contenidos en el JSON.
   * Reconstruir texto plano en Python para obras sin abstract en `works_flat`.
4. **Resultado de Fase 0:** ~73%–75% con resumen plano. Generación de lista de `pending_ids` (~330,000 registros faltantes).

---

### Fase 1: PubMed `efetch` XML y Europe PMC *(Biomedicina y Ciencias de la Salud)*
Para los registros pendientes con `pmid` o `doi` biomédico (~58,000+ registros):
1. **PubMed `efetch` en bloques de 150–200 PMIDs:**
   * Endpoint: `POST https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi` (`db=pubmed&retmode=xml`).
   * Extraer texto plano de `<AbstractText>` conservando subtítulos estructurados.
   * Extraer **`<KeywordList Owner="NOTNLM">`** para poblar `author_keywords`.
   * Extraer términos `<MeshHeading>` para complementar `keywords`.
   * Marcar `abstract_source = 'pubmed'`.
2. **Europe PMC REST API:** Consultar DOIs residuales (`search?query=DOI:"..."`) extrayendo `abstractText`.

---

### Fase 2: Semantic Scholar Academic Graph (`S2AG`) + OpenAIRE *(Exactas, Sociales, Ingenierías)*
Para los ~150k–200k DOIs de editoriales comerciales (Springer, Wiley, IEEE, etc.) sin PMID:
1. **S2AG Batch API:**
   * Endpoint: `POST https://api.semanticscholar.org/graph/v1/paper/batch?fields=externalIds,abstract,keywords`.
   * Extraer resúmenes y palabras clave de autor (`abstract_source = 's2ag'`).
2. **OpenAIRE Graph API:** Consultar DOIs de repositorios abiertos universitarios y preprints aún vacíos.

---

### Fase 3: Revistas Mexicanas e Iberoamericanas (SciELO, Redalyc, OJS / PDF OA con GROBID)
Para las ~85,000 obras `is_oa = 1` de revistas nacionales sin abstract en Crossref ni PubMed:
1. **Metadatos HTML OJS / OAI-PMH:**
   * Cosecha concurrente (`<= 5 req/s`) sobre `landing_page_url`.
   * Extraer `<meta name="citation_title">`, `<meta name="citation_abstract">` y `<meta name="citation_keywords">`.
2. **Extracción de PDF OA (primeras 2 páginas):**
   * Descargar PDFs verificando cabecera `%PDF-`.
   * Extraer secciones de **Resumen / Abstract** y **Palabras Clave / Keywords** vía GROBID o regex estructurado.

---

### Fase 3.5: Caracterización y Diagnóstico Forense de Documentos sin Resumen
Análisis forense de la estructura intrínseca de los documentos que aún carecen de abstract en ClickHouse:
1. **Presencia de Identificador Persistente:** Desglose porcentual con DOI (`68.60%`) vs. sin DOI (`31.40%`).
2. **Verificación Externa de Tipos de Documento:** Auditoría fuera de OpenAlex para detectar no-artículos sobre-indexados como `article` (reseñas de libros, notas editoriales, fe de erratas, obituarios, resúmenes de congresos y preliminares).
3. **Distribución Temporal y Épocas:** Fracción histórica del siglo XX pre-2000 (`21.24%`) vs. era moderna.
4. **Modelo de Acceso:** Proporción de paywall comercial cerrado (`72.66%`) frente a acceso abierto (`27.34%`).
5. **Concentración Editorial:** Cuantificación de vacíos por editorial comercial (Elsevier `10.1016`, Springer `10.1007`, SSRN, UAM, UNAM).

---

### Fase 4: Generación Masiva de Embeddings para Toda la Producción Mexicana

#### A. Formato Canónico de Entrada para Embeber
Se utiliza la plantilla estructurada de campos explícitos requerida:
$$\text{Input Text} = \text{"Title: "} + \text{title} + \text{"\nAbstract: "} + \text{abstract\_final} + \text{"\nKeywords: "} + \text{join(author\_keywords, ", ")}$$
*(Si `author_keywords` está vacío, se complementa con los descriptores temáticos/MeSH de `keywords` para maximizar la riqueza conceptual).*

#### B. Modelos Evaluados en Inferencia Local GPU (RTX 4090)

| Modelo | Dimensión | Contexto | Endpoint Local (LM Studio / GPU) |
| :--- | :---: | :---: | :--- |
| **`nomic-embed-text-v2-moe`** | **768d** | 8,192 | `text-embedding-nomic-ai-nomic-embed-text-v2-moe` |
| **`Qwen3-Embedding-0.6B`** | **1024d** | 8,192 | `text-embedding-qwen3-embedding-0.6b` |

*(Se descartó `allenai/specter2_base` y se eliminó la columna `embedding_specter2` de la tabla oficial).*

#### C. Estrategia de Procesamiento y Streaming Multihilo
1. **Validación de Concurrencia GPU:** Se evaluó el comportamiento multihilo del servidor LM Studio / CUDA alcanzando **~445 docs/s** en Nomic y **~140 docs/s** en Qwen3 con 4 trabajadores concurrentes.
2. **Generación Exhaustiva:** Procesamiento de la totalidad de registros (~1.20M obras) divididos en lotes de 1,000 registros, calculando `embedding_nomic` y `embedding_qwen`.
3. **Persistencia Directa:** Inserción en streaming hacia `rag.works_mexico_abstracts_enriched` con motor `ReplacingMergeTree`.

---

## 3. Lista de Verificación y Control de Progreso

- [x] **Paso 0.1:** Crear la tabla `rag.works_mexico_abstracts_enriched` en ClickHouse. (Ejecutado con motor `ReplacingMergeTree(updated_at) ORDER BY (publication_year, id)` con columnas de embeddings y palabras clave).
- [x] **Paso 0.2:** Migrar los 1.20M registros de `rag.works_flat` (`MX`) con sus 870k abstracts y keywords. (Ejecutado: 1,204,033 registros migrados; 870,273 resúmenes `works_flat` consolidados).
- [x] **Paso 0.3:** Extraer `author_keywords` y abstracts invertidos desde `raw_data` de `works_academic_all` y `works_seed_mexico`. (Verificado: extracción en Python de índices invertidos de `works_seed_mexico`).
- [x] **Paso 0.4:** Generar inventario de `pending_ids` y reportar conteo exacto de faltantes. (Ejecutado: 333,760 iniciales; 58,060 con PMID, 198,439 con DOI residuales, 85k OA).
- [x] **Paso 1.1:** Ejecutar extractor PubMed `efetch` (PMIDs) y guardar abstracts + `author_keywords` (`<KeywordList>`). (Ejecutado al 100%: 58,060 PMIDs consultados en 527s, **44,566 resúmenes recuperados e inyectados [76.8% de éxito]**).
- [x] **Paso 1.2:** Ejecutar extractor Europe PMC sobre DOIs/PMCIDs residuales. (Ejecutado).
- [x] **Paso 2.1:** Ejecutar extractor Semantic Scholar S2AG batch API sobre DOIs sin PMID. (Implementado y verificado en `enrich_fase2_s2ag.py`).
- [x] **Paso 2.2:** Consultar OpenAIRE para DOIs universitarios/preprints. (Implementado e integrado como fallback concurrente con 90% de éxito en editoriales/repositorios).
- [x] **Paso 3.1:** Ejecutar extractor OAI-PMH / OJS HTML meta tags para revistas mexicanas e iberoamericanas. (Mapeados prefijos UNAM 10.22201, UAM 10.24275, Medigraphic 10.35366 y cosecha de repositorios).
- [x] **Paso 3.2:** Reconstrucción de índices invertidos locales y enlaces OA para revistas mexicanas. (Implementada lógica de descompresión de `abstract_inverted_index`).
- [x] **Paso 3.5:** Caracterización forense de obras sin resumen. (Ejecutado script `enrich_mexico_fase3_5_characterization.py`: 68.6% con DOI, 31.4% sin DOI, 72.7% bajo paywall cerrado, 21.2% pre-2000 y reclasificación de paratexto/reseñas).
- [x] **Paso 4.1:** Descartar `specter2` y eliminar columna `embedding_specter2` de ClickHouse. (Ejecutado vía `ALTER TABLE DROP COLUMN`).
- [x] **Paso 4.2:** Benchmarking de concurrencia y validación multihilo en GPU RTX 4090 con LM Studio. (Completado: 445 docs/s en Nomic y 140 docs/s en Qwen3 con 4 hilos).
- [x] **Paso 4.3:** Ejecutar generación masiva y streaming de `embedding_nomic` y `embedding_qwen` para toda la producción científica de México. (Completado al 100%: **1,203,750** obras vectorizadas con ambos modelos en 416.6 min a 48.1 docs/s; solo 283 registros residuales sin texto válido).
- [ ] **Paso 5.0:** Emitir reporte final de cobertura por fuente, idioma y área temática.

