---
name: bibliometric-eda-profiler
description: Análisis exploratorio de datos bibliométricos (EDA), cálculo de impacto de autores (Índices H, G, M), análisis de supervivencia de palabras clave y métricas de dispersión sobre tablas normalizadas.
dependencies:
  - python: "/home/ambientesPy/revistaslatam"
  - script: "scripts/biblio_eda_cli.py"
---

# Bibliometric EDA Profiler

Módulo analítico encargado de calcular métricas cienciométricas descriptivas a nivel de autor, término y publicación a partir de corpus estructurados.

## Overview
A diferencia de herramientas de propósito general, este motor nativo en Python (`biblio_eda_engine.py`) opera sin dependencias pesadas compiladas en C++. Permite a los agentes diagnosticar el impacto real de los investigadores en un corpus, clasificar su madurez profesional y seguir la trayectoria anual de términos clave.

## Dependencies
- Entorno Python: `/home/ambientesPy/revistaslatam`
- Paquetes clave: `pandas` (para Parquet), `json`, `math`
- Script ejecutable: [`scripts/biblio_eda_cli.py`](file:///home/labsom/knomap/engine/skills/bibliometric-eda-profiler/scripts/biblio_eda_cli.py)

## Scripts & CLI Tools

### Reporte Cienciométrico Integral (`eda-report`)
Genera el diagnóstico exploratorio completo del corpus:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/biblio_eda_cli.py eda-report \
  --input /ruta/al/corpus.parquet \
  --output /ruta/al/reporte_eda.json
```

### Métricas de Autores (`author-metrics`)
Clasifica a los autores por H-index, G-index y M-index:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/biblio_eda_cli.py author-metrics \
  --input /ruta/al/corpus.parquet \
  --top-n 50 \
  --current-year 2026 \
  --output /ruta/a/ranking_autores.json
```
*Nota:* Si un documento carece de la columna de citas, se asume `0` citas emitiendo una advertencia por `stderr`.

### Dinámica y Supervivencia de Términos (`term-growth`)
Evalúa el crecimiento anual de palabras clave a lo largo del tiempo:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/biblio_eda_cli.py term-growth \
  --input /ruta/al/corpus.parquet \
  --min-freq 5 \
  --output /ruta/a/trayectoria_terminos.json
```

## Workflow Steps
1. **Entrada Normalizada:** Recibir el dataset limpio de [`bibliographic-corpus-parser`](file:///home/labsom/knomap/engine/skills/bibliographic-corpus-parser/SKILL.md).
2. **Generar Métricas:** Ejecutar `author-metrics` para perfilar a los investigadores líderes del corpus.
3. **Analizar Términos:** Ejecutar `term-growth` para detectar conceptos con trayectoria ascendente.

## References
- [Fundamentos Matemáticos de los Índices H, G y M](references/h_g_m_index_foundations.md)
- [Modelos de Crecimiento y Supervivencia de Términos](references/term_survival_models.md)

## Troubleshooting & Edge Cases
- **Citas Faltantes:** El CLI convierte valores no numéricos en `0` y no interrumpe el cálculo.
- **Años Inválidos:** Años posteriores al año actual o anteriores a 1900 son ignorados en el cálculo del índice M para evitar divisiones anómalas.
