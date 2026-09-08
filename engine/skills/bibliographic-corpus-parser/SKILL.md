---
name: bibliographic-corpus-parser
description: Ingesta y normalización de archivos bibliográficos heterogéneos (WoS plano/tab, Scopus CSV, RIS, PubMed XML, OpenAlex JSON) hacia tablas canónicas estandarizadas (Parquet, CSV, JSON).
dependencies:
  - python: "/home/ambientesPy/revistaslatam"
  - script: "scripts/corpus_parser_cli.py"
---

# Bibliographic Corpus Parser

Convierte exportaciones de bases de datos científicas heterogéneas en un esquema tabular estandarizado de alto rendimiento para el pipeline cienciométrico de KnoMap y SOS-MCP-Services.

## Overview
Los formatos de exportación cienciométrica presentan discrepancias estructurales críticas (WoS utiliza tags de 2 letras como `TI`, `AU`; Scopus utiliza encabezados CSV en inglés; RIS utiliza delimitadores `TY  -`; OpenAlex utiliza estructuras JSON anidadas). Este skill desacopla la lectura cruda y produce un archivo canónico (`.parquet`, `.csv` o `.json`) listo para análisis de redes, EDA, modelado de tópicos y proyecciones SOM.

## Dependencies
- Entorno Python: `/home/ambientesPy/revistaslatam`
- Paquetes clave: `pandas`, `pyarrow` (opcional para Parquet), `json`, `csv`
- Script ejecutable: [`scripts/corpus_parser_cli.py`](file:///home/labsom/knomap/engine/skills/bibliographic-corpus-parser/scripts/corpus_parser_cli.py)

## Scripts & CLI Tools

### Ingesta y Normalización (`parse`)
Normaliza cualquier archivo bibliográfico al esquema estándar:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/corpus_parser_cli.py parse \
  --input /ruta/al/archivo_crudo.csv \
  --output /ruta/al/corpus_normalizado.parquet \
  --format auto
```

Opciones:
- `--input`: Ruta al archivo crudo descargado.
- `--output`: Ruta al archivo destino (`.parquet` recomendado por velocidad y compresión, o `.csv` / `.json`).
- `--format`: `auto` (detección heurística), `scopus-csv`, `wos-plain`, `ris`, `openalex-json`.
- `--limit`: Límite opcional de documentos para pruebas rápidas (ej. `--limit 500`).

### Inspección Rápida de Formato (`inspect`)
Permite al agente verificar la validez y encabezados del archivo antes de procesar lotes masivos:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/corpus_parser_cli.py inspect \
  --input /ruta/al/archivo_crudo.txt \
  --output /ruta/al/diagnostico.json
```

## Workflow Steps
1. **Inspeccionar Formato:** Ejecutar `inspect` para verificar la codificación y estructura del archivo.
2. **Normalizar Corpus:** Ejecutar `parse` especificando salida `.parquet` o `.csv`.
3. **Paso a Siguientes Skills:**
   - Si se requiere limpieza de nombres $\to$ Invocar [`bibliometric-entity-normalizer`](file:///home/labsom/knomap/engine/skills/bibliometric-entity-normalizer/SKILL.md).
   - Si se requiere cálculo de métricas de autor $\to$ Invocar [`bibliometric-eda-profiler`](file:///home/labsom/knomap/engine/skills/bibliometric-eda-profiler/SKILL.md).
   - Si se requiere construcción de redes $\to$ Invocar [`bibliometric-network-analyst`](file:///mnt/expansion/desplegados/sos-mcp-services/.agents/skills/bibliometric-network-analyst/SKILL.md).

## References
- [Guía de Formatos Bibliográficos](references/bibliographic_formats_guide.md)
- [Definición del Esquema Canónico Tabular](references/canonical_schema_definition.md)

## Troubleshooting & Edge Cases
- **Codificación con BOM o caracteres corruptos:** El parser abre automáticamente con `utf-8-sig` y `errors='replace'` para tolerar diacríticos en nombres hispanos, franceses o nórdicos.
- **Campos de citas faltantes:** Cuando la columna de citas no está presente (habitual en exportaciones RIS), se asigna `0` de forma predeterminada sin abortar el proceso.
- **Parquet no disponible:** Si el entorno carece de `pyarrow`, el CLI emite una advertencia en stderr y vuelca el resultado en JSON.
