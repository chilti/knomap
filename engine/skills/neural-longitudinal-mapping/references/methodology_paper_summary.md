# Fundamentación Metodológica: Mapeo Longitudinal con SOM

**Referencia Científica:**
> **Jiménez-Andrade, J. L., Martí-Lahera, Y., & Carrillo-Calvet, H. (2024).** *Neural longitudinal mapping of multidimensional performance profiles of Latin American universities.* **Iberoamerican Journal of Science Measurement and Communication**, 4(1), 1–16. https://doi.org/10.47909/ijsmc.92

---

## 1. El Problema Fundamental del Mapeo Temporal con SOM

Las redes neuronales autoorganizadas de Kohonen (SOM) son técnicas no supervisadas ideales para proyectar espacios de alta dimensión ($D > 3$) en un plano bidimensional discreto (típicamente una malla hexagonal). Sin embargo, una aplicación directa e independiente del algoritmo SOM a diferentes cortes temporales sucesivos ($T_1, T_2, \dots, T_k$) produce resultados incoherentes para el análisis temporal:

1. **Estocasticidad e Invarianza Rotacional:** Dada la inicialización aleatoria y la estocasticidad en la presentación de los datos, mapas entrenados independientemente con datos muy similares (o incluso idénticos) adoptan orientaciones arbitrarias (rotaciones de 90°/180° o inversiones en espejo).
2. **Imposibilidad de Comparación Visual Intertemporal:** Si la cartografía de referencia rota o permuta sus cuadrantes temáticos entre el año $t$ y el año $t+1$, es imposible rastrear trayectorias continuas o interpretar si un movimiento responde a una transformación real de la entidad o a un artefacto del algoritmo.

---

## 2. La Solución: Encadenamiento Temporal (Warm-Start Chaining)

El entrenamiento estándar de un SOM se conceptualiza en dos etapas:
1. **Fase de Ordenamiento Global:** Con radios de vecindad grandes ($\sigma_0$) y tasas de aprendizaje altas ($\alpha_0$), donde se determina la topología macroscópica de la malla.
2. **Fase de Refinamiento:** Con radios de vecindad reducidos ($\sigma \to 1$) y tasas de aprendizaje pequeñas ($\alpha \ll 1$), donde se ajustan los vectores de pesos sinápticos a un nivel fino sin alterar la orientación macroscópica.

### Observación Empírica Clave:
En sistemas bibliométricos, rankings universitarios o dinámicas de redes de investigación, **los perfiles de las entidades no cambian de forma caótica ni instantánea de un año al siguiente**. La distribución global se mantiene relativamente estable.

Por lo tanto:
- **Periodo 1 ($T_1$ - Full Training):** Se entrena un mapa completo desde cero para estructurar el espacio semántico base.
- **Periodos Sucesivos ($T_2 \dots T_k$ - Refinement Only):** Se omiten por completo la inicialización aleatoria y la fase de ordenamiento global. La red en el tiempo $t$ se inicializa con los pesos resultantes del tiempo previo $W_{t-1}^*$, y se ejecuta **exclusivamente la fase de refinamiento** con vecindades y tasas de aprendizaje reducidas.

---

## 3. Formulación Canónica de Hiperparámetros

Para una malla hexagonal de dimensiones $R \times C$:

$$\bar{D} = \frac{R + C}{2} \quad \text{(Tamaño promedio de la malla)}$$

| Fase | Épocas | Tasa de Aprendizaje Inicial ($\alpha$) | Radio de Vecindad Inicial ($\sigma$) | Inicialización de Pesos ($W_0$) |
| :--- | :---: | :---: | :---: | :---: |
| **Periodo 1 (Base)** | 1000 | $\alpha_0 = 0.9$ | $\sigma_{\text{base}} = \frac{1}{2} \bar{D} = \frac{R + C}{4}$ | Global (PCA o Aleatorio) |
| **Periodos 2+ (Refinamiento)** | 200 | $\alpha = 0.1$ | $\sigma_{\text{refine}} = \frac{1}{8} \bar{D} = \frac{R + C}{16}$ | Pesos del periodo previo: $W_{t-1}^*$ |

*Nota sobre decaimiento:* En el algoritmo secuencial/online de Kohonen, $\sigma(t)$ y $\alpha(t)$ decaen lineal o exponencialmente a lo largo de las épocas, convergiendo a $\sigma \to 1.0$ y $\alpha \to 0.02$.

---

## 4. Marco de Análisis en Tres Niveles (Macro, Meso, Micro)

El artículo introduce una metodología rigurosa para interpretar la secuencia temporal de mapas de conocimiento resultantes:

```
┌─────────────────────────────────────────────────────────────┐
│  NIVEL MACRO: Tendencias Sistémicas y Mapas de Componentes  │
│  - Desplazamiento de gradientes cromáticos (verde → rojo)   │
│  - Homogeneización o diversificación regional/nacional      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│  NIVEL MESO: Dinámica de Clusters (Vesanto)                 │
│  - Escisión de clusters: Diferenciación de perfiles         │
│  - Fusión de clusters: Homogeneización de perfiles          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│  NIVEL MICRO: Dinámica Individual y Trayectorias            │
│  - Desplazamiento Euclidiano (Δx, Δy) en la malla           │
│  - Identificación de Perfiles Singulares (transitorios)     │
└─────────────────────────────────────────────────────────────┘
```

### Nivel Macro (Sistémico)
- Se examinan los **mapas de dimensiones/componentes** (un mapa de calor por cada indicador evaluado, e.g., Docencia, Investigación, Citas).
- Permite detectar evoluciones estructurales del conjunto (e.g., dominancia progresiva de zonas de alto rendimiento) y contrastes de especialización regional (e.g., perfiles con alta docencia e investigación vs. perfiles con altas citas e impacto internacional).

### Nivel Meso (Dinámica de Clusters)
- Aplica clustering jerárquico aglomerativo sobre los pesos de las neuronas (metodología de Vesanto & Alhoniemi, 2000).
- Cada cluster representa un **perfil cualitativo institucional**.
- **Cluster Splitting (Escisión):** Cuando entidades que compartían un cluster en $T_{t-1}$ se separan en $T_t$, indicando **diferenciación de perfiles**.
- **Cluster Merging (Fusión):** Cuando entidades provenientes de clusters distintos convergen en un mismo cluster en $T_t$, indicando **homogeneización de perfiles**.

### Nivel Micro (Individual)
- Evalúa el movimiento de entidades particulares en la cuadrícula hexagonal.
- **Perfiles Singulares:** Entidades que ocupan de forma aislada un cluster propio. El análisis longitudinal revela su carácter típicamente **transitorio**: en años previos o posteriores suelen compartir cluster con otros pares conforme maduran sus indicadores.

---

## 5. Cuantificación de la Deriva Sináptica ($\Delta W$)

Para medir objetivamente la tensión adaptativa de la malla entre dos periodos consecutivos $T_{t-1}$ y $T_t$, se calcula la deriva de los vectores de pesos por neurona $j$:

$$\Delta W_j = \| W_j^{(t)} - W_j^{(t-1)} \|_2 = \sqrt{\sum_{d=1}^D (w_{j,d}^{(t)} - w_{j,d}^{(t-1)})^2}$$

- Un valor bajo de $\Delta W$ indica una región semántica conservada y altamente estable.
- Un valor alto de $\Delta W$ señala cuadrantes donde ocurrió una profunda reestructuración conceptual o de desempeño en el colectivo analizado.
