---
name: bibliometric-entity-normalizer
description: Detección y normalización de entidades bibliométricas (autores, instituciones, palabras clave) mediante algoritmos difusos (Jaro-Winkler, Levenshtein) y gestión de tesauros compatibles con VOSviewer y KnoMap.
dependencies:
  - python: "/home/ambientesPy/revistaslatam"
  - script: "scripts/entity_normalizer_cli.py"
---

# Bibliometric Entity Normalizer

Módulo especializado en la detección de variantes ortográficas y la aplicación de tesauros para limpiar el ruido espectral en corpus cienciométricos antes de la extracción de redes o entrenamiento neuronal.

## Overview
La falta de normalización de nombres (e.g. `Torres, Rafael` vs `Torres-Córdoba, R.`) fragmenta el impacto de autores e infla artificialmente la dimensionalidad de las matrices de coocurrencia. Este skill permite a un agente autónomo escanear un corpus, descubrir duplicados potenciales con similitud difusa estructurada, y generar o aplicar reglas de tesauro estandarizadas.

## Dependencies
- Entorno Python: `/home/ambientesPy/revistaslatam`
- Paquetes clave: `pandas` (para Parquet), `json`, `csv`
- Script ejecutable: [`scripts/entity_normalizer_cli.py`](file:///home/labsom/knomap/engine/skills/bibliometric-entity-normalizer/scripts/entity_normalizer_cli.py)

## Scripts & CLI Tools

### Sugerencia Automática de Fusiones (`suggest-merges`)
Escanea el corpus y emite un archivo JSON con pares candidatos a fusión y su puntaje de similitud:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/entity_normalizer_cli.py suggest-merges \
  --input /ruta/al/corpus.parquet \
  --output /ruta/a/sugerencias.json \
  --entity authors \
  --threshold 0.88 \
  --metric jaro-winkler
```

Opciones:
- `--input`: Archivo de corpus (`.parquet`, `.csv`, `.json`).
- `--output`: Archivo JSON estructurado con la lista de fusiones recomendadas.
- `--entity`: `authors`, `institutions` o `keywords`.
- `--threshold`: Umbral de corte mínimo (recomendado: `0.88` para autores, `0.85` para instituciones).
- `--metric`: `jaro-winkler` (óptimo para personas) o `levenshtein` (óptimo para instituciones).

### Aplicación de Tesauro (`apply-thesaurus`)
Aplica las reglas de un archivo CSV (`label,replace by`) sobre una columna del dataset:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/entity_normalizer_cli.py apply-thesaurus \
  --input /ruta/al/corpus.parquet \
  --thesaurus /ruta/al/thesaurus.csv \
  --column authors \
  --output /ruta/al/corpus_limpio.parquet
```

### Validación de Integridad de Tesauro (`validate-thesaurus`)
Comprueba que un archivo de tesauro no contenga referencias circulares ni inconsistencias:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/entity_normalizer_cli.py validate-thesaurus \
  --thesaurus /ruta/al/thesaurus.csv \
  --output /ruta/al/diagnostico.json
```

## Workflow Steps
1. **Detección Difusa:** Ejecutar `suggest-merges` para obtener los candidatos a variante.
2. **Decisión del Agente:** El agente analiza el JSON resultante y construye o actualiza el archivo `thesaurus.csv`.
3. **Validación:** Ejecutar `validate-thesaurus` para confirmar que no hay bucles.
4. **Limpieza:** Ejecutar `apply-thesaurus` sobre el corpus limpio para los pipelines subsecuentes.

## References
- [Reglas Sintácticas de Tesauros](references/thesaurus_syntax_rules.md)
- [Algoritmos de Similitud de Cadenas](references/string_similarity_algorithms.md)

## Troubleshooting & Edge Cases
- **Grandes Volúmenes ($N > 2,000$ entidades):** Por defecto, el CLI prioriza las 2,000 entidades más frecuentes para evitar el coste $O(N^2)$. Si se requiere un barrido más amplio, ajustar con `--max-compare 5000`.
- **Eliminación Intencional de Stopwords:** Para eliminar palabras vacías o autores irrelevantes, la regla de tesauro debe dejar vacía la segunda columna (`stopword,`).
