---
name: neural-longitudinal-mapping
description: >-
  Experto en Mapeo Longitudinal con redes neuronales de Kohonen (SOM) y encadenamiento Warm-Start intertemporal (Jiménez-Andrade, Martí-Lahera & Carrillo-Calvet, 2024). Modela la evolución temporal de perfiles multidimensionales de desempeño institucional y secuencias de matrices de redes en 3 niveles: Macro (tendencias y mapas de componentes), Meso (dinámica de clusters: escisión/diferenciación vs. fusión/homogeneización) y Micro (desplazamientos de entidades y perfiles singulares), cuantificando la tensión de deriva sináptica (\Delta W).
---

# Neural Longitudinal Mapping (SOM Warm-Start Chaining)

## Overview

Esta skill implementa y orquesta la metodología científica de **Mapeo Longitudinal Neurocomputacional con Redes Autoorganizadas de Kohonen (SOM)** publicada en:

> **Jiménez-Andrade, J. L., Martí-Lahera, Y., & Carrillo-Calvet, H. (2024).** *Neural longitudinal mapping of multidimensional performance profiles of Latin American universities.* **Iberoamerican Journal of Science Measurement and Communication**, 4(1), 1–16. https://doi.org/10.47909/ijsmc.92

El método supera el problema de la estocasticidad e invarianza rotacional que impedía el uso de mapas autoorganizados en series de tiempo, permitiendo generar secuencias de mapas espacialmente alineadas para rastrear la evolución temporal continua de:
1. **Perfiles Multidimensionales de Desempeño Institucional:** Indicadores de rankings (THE-LA, QS, Leiden), métricas de producción/impacto de InCites o matrices temporales de TlachIA Metrics.
2. **Secuencias de Redes Bibliométricas:** Matrices de adyacencia/co-ocurrencia generadas por ventanas temporales en KnoMap (Biblio Networks y SOM & UNAM).

---

## Dependencies

Esta skill se apoya y coordina con el ecosistema de skills analíticas de KnoMap:
- [`bibliometrics-som-flow`](file:///home/labsom/knomap/engine/skills/bibliometrics-som-flow/SKILL.md): Ingesta de corpus y construcción de secuencias temporales de matrices de co-ocurrencia.
- [`incites-som-pipeline`](file:///home/labsom/knomap/engine/skills/incites-som-pipeline/SKILL.md): Extracción de perfiles cienciométricos multidimensionales normalizados.
- [`som-methodological-expert`](file:///mnt/expansion/desplegados/sos-mcp-services/.agents/skills/som-methodological-expert/SKILL.md): Fundamentos de Kohonen, topología hexagonal y calibración dimensional.
- [`project-hub-manager`](file:///home/labsom/knomap/engine/skills/project-hub-manager/SKILL.md): Persistencia de modelos longitudinales en SQLite (`knomap_hub.db`) y manifiesto `.knomap`.
- [`infotlachia-scholar-intelligence`](file:///mnt/expansion/desplegados/sos-mcp-services/.agents/skills/infotlachia-scholar-intelligence/SKILL.md): Extracción de indicadores institucionales por ventanas temporales en TlachIA Metrics.

---

## Quick Start

Para entrenar y analizar una serie longitudinal a partir de un archivo CSV o JSON:

```bash
# 1. Preparar serie temporal
/home/ambientesPy/revistaslatam/bin/python /home/labsom/knomap/engine/skills/neural-longitudinal-mapping/scripts/neural_longitudinal_cli.py prepare \
  --input /ruta/al/dataset.csv \
  --entity-col university \
  --period-col year \
  --output ./prepared_series.json

# 2. Entrenar secuencia longitudinal (Warm-Start Chaining)
/home/ambientesPy/revistaslatam/bin/python /home/labsom/knomap/engine/skills/neural-longitudinal-mapping/scripts/neural_longitudinal_cli.py train \
  --input ./prepared_series.json \
  --rows 10 --cols 20 \
  --output ./longitudinal_results.json

# 3. Extraer análisis evolutivo de tres niveles (Macro, Meso, Micro)
/home/ambientesPy/revistaslatam/bin/python /home/labsom/knomap/engine/skills/neural-longitudinal-mapping/scripts/neural_longitudinal_cli.py analyze \
  --input ./longitudinal_results.json \
  --output ./dynamics_analysis.json

# 4. Generar reporte Markdown publicable
/home/ambientesPy/revistaslatam/bin/python /home/labsom/knomap/engine/skills/neural-longitudinal-mapping/scripts/neural_longitudinal_cli.py report \
  --analysis ./dynamics_analysis.json \
  --mode external_mcp \
  --output ./report_longitudinal.md
```

---

## Protocolo Canónico de Hiperparámetros (Table 1)

Para cualquier malla hexagonal de $R \times C$, el tamaño promedio es $\bar{D} = \frac{R + C}{2}$.

| Fase de Entrenamiento | Épocas | Tasa de Aprendizaje ($\alpha$) | Radio de Vecindad ($\sigma$) | Inicialización Sináptica |
| :--- | :---: | :---: | :---: | :--- |
| **Periodo 1: Full Training (Base)** | **1000** | $\alpha_0 = \mathbf{0.9}$ | $\sigma_0 = \frac{1}{2} \bar{D}$ <br>*(Para $10 \times 20 \rightarrow \mathbf{7.5}$)* | Global (PCA o Aleatorio) |
| **Periodos 2+: Refinement Phase (Warm-Start)** | **200** | $\alpha = \mathbf{0.1}$ | $\sigma = \frac{1}{8} \bar{D}$ <br>*(Para $10 \times 20 \rightarrow \mathbf{1.875}$)* | Pesos del periodo previo ($W_{t-1}^*$) |

### Fundamento de Refinamiento:
Al saltar la fase de ordenamiento global en $t \ge 2$, los vectores de pesos conservan la orientación topológica adquirida en $T_1$, limitando la adaptación al ajuste de frontera y evitando giros especulares o rotaciones estocásticas.

---

## Marco Analítico de Tres Niveles (Macro, Meso, Micro)

Al interpretar la evolución de los mapas longitudinales, el agente debe estructurar sus respuestas y reportes en los 3 niveles formulados en el artículo:

### 1. Nivel Macro: Evolución Sistémica y Componentes
- Examinar la secuencia de mapas de dimensiones (Teaching, Research, Citations, etc.).
- Identificar el **desplazamiento de gradientes cromáticos** (expansión de zonas rojas de alta intensidad vs. zonas verdes de rezago).
- Evaluar correlaciones visuales entre dimensiones (covarianza estructural en el sistema analizado).

### 2. Nivel Meso: Dinámica de Clusters (Vesanto)
- Evaluar las agrupaciones jerárquicas en la malla hexagonal.
- **Cluster Splitting (Escisión):** Entidades unidas en $T_{t-1}$ que divergen en clusters separados en $T_t$. Diagnóstico: *Diferenciación de perfiles*.
- **Cluster Merging (Fusión):** Entidades de clusters distintos en $T_{t-1}$ que se unifican en $T_t$. Diagnóstico: *Homogeneización de perfiles*.

### 3. Nivel Micro: Dinámica Individual y Perfiles Singulares
- Calcular el desplazamiento Euclidiano $(\Delta x, \Delta y)$ de cada entidad a través de los hexágonos entre cortes temporales.
- Identificar **Perfiles Singulares:** Entidades aisladas que constituyen el único miembro de su cluster ($|C_k| = 1$). El análisis longitudinal demuestra su naturaleza típicamente *transitoria* (convergen o se integran a otros clusters en periodos adyacentes).

### 4. Cuantificación de Deriva Sináptica ($\Delta W$)
Calcular la tensión adaptativa por neurona entre cortes contiguos:
$$\Delta W_j = \| W_j^{(t)} - W_j^{(t-1)} \|_2$$
Identifica cuadrantes semánticos con mayor dinamismo frente a zonas rígidas o anclas.

---

## Utility Scripts: `neural_longitudinal_cli.py`

Ubicación: [`scripts/neural_longitudinal_cli.py`](file:///home/labsom/knomap/engine/skills/neural-longitudinal-mapping/scripts/neural_longitudinal_cli.py)

### 1. `prepare`
Transforma tablas CSV o JSON heterogéneas en la estructura estandarizada de KnoMap.
- `--input`: Ruta al archivo CSV o JSON.
- `--entity-col`: Nombre de la columna de entidad/universidad.
- `--period-col`: Nombre de la columna de periodo/año.
- `--indicator-cols`: Lista separada por comas de columnas de indicadores.
- `--output`: Archivo JSON de salida (`prepared_series.json`).

### 2. `train`
Ejecuta el entrenamiento secuencial con encadenamiento Warm-Start.
- `--input`: Archivo `prepared_series.json`.
- `--rows` y `--cols`: Dimensiones de la malla (por defecto: 10 y 20).
- `--base-epochs`: Épocas para Periodo 1 (por defecto: 1000).
- `--refine-epochs`: Épocas de refinamiento (por defecto: 200).
- `--api-url`: (Opcional) URL del backend de KnoMap (e.g. `http://localhost:5015` o `http://localhost:5123`). Si no se especifica, ejecuta directamente el motor PyTorch local con aceleración GPU.
- `--output`: Archivo JSON de resultados (`longitudinal_results.json`).

### 3. `analyze`
Computa las métricas de Macro, Meso, Micro y Deriva Sináptica ($\Delta W$).
- `--input`: Archivo `longitudinal_results.json`.
- `--output`: Archivo JSON de análisis (`dynamics_analysis.json`).

### 4. `report`
Genera el reporte Markdown consolidado y listo para publicación.
- `--analysis`: Archivo `dynamics_analysis.json`.
- `--mode`: `knomap_internal` (emite directivas de navegación visual) o `external_mcp` (artefacto markdown completo para clientes externos).
- `--output`: Archivo Markdown de salida (`report.md`).

---

## Integración en KnoMap y Clientes MCP

### Si el Agente vive dentro de KnoMap:
1. Una vez ejecutado el entrenamiento, emite la directiva:
   `NavigateToTab: longitudinal`
2. El frontend cargará automáticamente los resultados en [`LongitudinalSomViewer.tsx`](file:///home/labsom/knomap/frontend/src/components/LongitudinalSomViewer.tsx), permitiendo al usuario utilizar:
   - **Timeline Player:** Reproducción animada continua del paso de los años.
   - **Side-by-Side:** Inspección comparativa lado a lado de todos los años analizados.
   - **Knowledge Drift (ΔW):** Mapa de calor con la tensión sináptica de cada neurona.
   - **Thematic Migration:** Gráfico de flujo aluvial de entidades entre clusters.

### Si el Agente es externo (Vía MCP o Línea de Comandos):
1. Ejecuta el pipeline completo mediante `neural_longitudinal_cli.py`.
2. Genera el artefacto Markdown con `--mode external_mcp`.
3. Presenta al usuario el resumen estructurado en Macro, Meso y Micro con tablas comparativas.

---

## Common Mistakes & Best Practices

1. **Reentrenar periodos sucesivos desde cero:**
   *Error:* Ejecutar `train_basic` en cada año con inicialización aleatoria independiente.
   *Consecuencia:* Los mapas rotan 90° o 180°, rompiendo toda posibilidad de análisis visual comparativo.
   *Solución:* Utilizar siempre el protocolo Warm-Start donde $W_{t}^{(0)} = W_{t-1}^*$.

2. **Usar tasas de aprendizaje o sigmas altos en el refinamiento:**
   *Error:* Mantener $\alpha_0 = 0.9$ y $\sigma_0 = 7.5$ en los periodos 2+.
   *Consecuencia:* Destrucción del ordenamiento global previo y distorsión de cuadrantes.
   *Solución:* Forzar $\alpha = 0.1$, $\sigma = \frac{1}{8} \bar{D}$ y épocas reducidas (200).

3. **Reescalar artificialmente indicadores que ya están en $[0, 100]$:**
   *Error:* Aplicar estandarización z-score a sub-scores que naturalmente varían de 0 a 100.
   *Consecuencia:* Pérdida de la escala cromática intuitiva donde el color verde representa rezago (<50) y el rojo excelencia (>75).

---

## Referencias y Cómo Citar

Si utilizas este método, la herramienta CLI o los reportes generados por esta skill en investigaciones o publicaciones académicas, incluye la siguiente atribución formal:

### Formato APA:
> Jiménez-Andrade, J. L., Martí-Lahera, Y., & Carrillo-Calvet, H. (2024). Neural longitudinal mapping of multidimensional performance profiles of Latin American universities. *Iberoamerican Journal of Science Measurement and Communication*, 4(1), 1–16. https://doi.org/10.47909/ijsmc.92

### Formato BibTeX:
```bibtex
@article{jimenez2024neural,
  title={Neural longitudinal mapping of multidimensional performance profiles of Latin American universities},
  author={Jim{\'e}nez-Andrade, Jos{\'e} Luis and Mart{\'i}-Lahera, Yohannis and Carrillo-Calvet, Humberto},
  journal={Iberoamerican Journal of Science Measurement and Communication},
  volume={4},
  number={1},
  pages={1--16},
  year={2024},
  publisher={IJSMC},
  doi={10.47909/ijsmc.92},
  url={https://doi.org/10.47909/ijsmc.92}
}
```
