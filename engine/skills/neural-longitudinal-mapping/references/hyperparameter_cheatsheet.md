# Cheatsheet de Hiperparámetros y Calibración Longitudinal

Esta guía rápida proporciona las tablas de referencia y reglas de cálculo exactas para parametrizar redes SOM longitudinales basadas en la metodología de **Jiménez-Andrade et al. (2024)**.

---

## 1. Tabla de Calibración por Tamaño de Malla

El radio de vecindad gaussiano ($\sigma$) depende directamente del tamaño promedio de la cuadrícula:
$$\bar{D} = \frac{\text{filas} + \text{columnas}}{2}$$

| Dimensiones Malla ($R \times C$) | $\bar{D}$ | $\sigma_{\text{base}} = \frac{1}{2} \bar{D}$ | $\sigma_{\text{refine}} = \frac{1}{8} \bar{D}$ | Épocas Base | Épocas Refinamiento | $\alpha_0$ | $\alpha_{\text{refine}}$ |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **$8 \times 12$** | 10.0 | **5.00** | **1.250** | 1000 | 200 | 0.9 | 0.1 |
| **$10 \times 20$** *(Paper Canónico)* | 15.0 | **7.50** | **1.875** | 1000 | 200 | 0.9 | 0.1 |
| **$12 \times 18$** | 15.0 | **7.50** | **1.875** | 1000 | 200 | 0.9 | 0.1 |
| **$14 \times 24$** | 19.0 | **9.50** | **2.375** | 1200 | 250 | 0.9 | 0.1 |
| **$16 \times 30$** | 23.0 | **11.50** | **2.875** | 1500 | 300 | 0.9 | 0.1 |

---

## 2. Reglas de Normalización de Datos

1. **Indicadores de Desempeño y Rankings (0 a 100):**
   - Si los indicadores ya están acotados en la escala estándar $[0, 100]$ (e.g. sub-scores de THE, QS, Leiden o InCites normalizados), **no se debe aplicar reescalado adicional**. Preservar el rango natural facilita la interpretación visual directa de las zonas de excelencia (rojas) y rezago (verdes).
2. **Matrices de Co-ocurrencia / Frecuencias Bibliométricas:**
   - Para redes de coautoría o co-palabras, aplicar **normalización de coseno (Salton)** o **fuerza de asociación (Inclusión)** para acotar la similitud en $[0, 1]$ antes del entrenamiento.
3. **Métricas Heterogéneas con Escalas Dispares:**
   - Si se combinan indicadores con unidades distintas (e.g. presupuesto en USD vs. conteo de papers vs. porcentaje de impacto), aplicar **Min-Max Scaling** por columna para llevar todas las variables a $[0, 100]$ antes de ensamblar la secuencia longitudinal.

---

## 3. Criterios de Diagnóstico e Interpretación de Resultados

### Nivel Macro (Gradientes Cromáticos en Dimensiones)
- **Dominancia creciente de color rojo:** Incremento sistémico en el indicador a nivel colectivo.
- **Persistencia de zonas verdes:** Brechas estructurales que no se redujeron a lo largo del periodo analizado.
- **Correlación visual entre dimensiones:** Si dos mapas de dimensión exhiben patrones idénticos de coloración (e.g. Docencia e Investigación), indica alta covarianza estructural en el conjunto analizado.

### Nivel Meso (Dinámica de Clusters - Vesanto)
- **Cluster Splitting (Escisión):** Un grupo unificado en $T_{t-1}$ se subdivide en $T_t$. Diagnóstico: *Diferenciación de perfiles*; subconjuntos de entidades adoptaron estrategias de desarrollo divergentes.
- **Cluster Merging (Fusión):** Entidades de clusters distintos en $T_{t-1}$ se agrupan bajo el mismo cluster en $T_t$. Diagnóstico: *Homogeneización de perfiles*; convergencia en patrones de desempeño.

### Nivel Micro (Trayectorias y Perfiles Singulares)
- **Desplazamiento a cluster contiguo:** Ajuste gradual del perfil sin discontinuidades abruptas.
- **Salto transversal a cuadrante opuesto:** Cambio de paradigma o reestructuración mayor en la entidad.
- **Perfil Singular ($|C_k| = 1$):** Entidad aislada en su propio cluster. Suele ser una condición **transitoria** en el tiempo (en periodos posteriores o anteriores suele asociarse a otros pares conforme evoluciona el entorno).

### Cuantificación de Deriva ($\Delta W$)
- **$\Delta W < 0.15 \times \text{rango}$:** Región semántica altamente estable / cuadrante ancla.
- **$\Delta W > 0.40 \times \text{rango}$:** Cuadrante de alta tensión adaptativa; intensa reconfiguración de perfiles.
