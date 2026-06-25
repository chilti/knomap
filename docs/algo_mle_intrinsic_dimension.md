# Algoritmo: Estimación de Dimensión Intrínseca (skdim suite)

## 1. Introducción
Los datos de texto vectorizados habitan en un espacio de altísima dimensionalidad (ej. 768 dimensiones). Sin embargo, los documentos reales no ocupan todo ese espacio de manera uniforme, sino que yacen sobre una variedad topológica (*manifold*) de mucha menor dimensión. Conocer esta "dimensión intrínseca" es crucial para optimizar algoritmos de reducción y clustering sin perder información crítica.

## 2. Fundamentos Matemáticos

### 2.1 Estimador de Máxima Verosimilitud (Levina & Bickel)
En LabSOM se emplea el método propuesto por Levina y Bickel (2004). El algoritmo asume que, en una vecindad suficientemente pequeña alrededor de un punto $x$, la densidad espacial de los datos es constante. 

Si modelamos la distribución de las distancias desde $x$ a sus vecinos más cercanos como un Proceso de Poisson espacial, podemos derivar un estimador de Máxima Verosimilitud (MLE) para la dimensión $m$ de esa vecindad.

Sea $T_j(x)$ la distancia euclidiana desde $x$ hasta su $j$-ésimo vecino más cercano, ordenadas de tal forma que $T_1(x) \le T_2(x) \le \dots \le T_k(x)$.
La dimensión intrínseca local $\hat{m}_k(x)$ para un tamaño de vecindad $k$ se estima como:
$$ \hat{m}_k(x) = \left[ \frac{1}{k-1} \sum_{j=1}^{k-1} \log \frac{T_k(x)}{T_j(x)} \right]^{-1} $$

### 2.2 Estimación Global en LabSOM
El cálculo anterior se realiza para cada documento (punto) en el corpus. Dado que los conjuntos de datos pueden tener densidades variables, LabSOM agrega estas dimensiones locales extrayendo un estadístico robusto. En concreto, utiliza el **Percentil 95 (P95)** de todas las estimaciones locales. Esto asegura que el espacio destino tenga suficientes dimensiones para albergar el $95\%$ de las estructuras complejas del corpus sin recurrir a la dimensionalidad original.

## 3. Algoritmos Adicionales (Suite `skdim`)

Aunque LabSOM utiliza MLE como el estimador heurístico principal (default) para calcular el "techo" de la dimensionalidad, el motor de backend (*Semantic Engine*) implementa de forma completa la suite de la librería `skdim`. Esto permite a los usuarios avanzados explorar métodos alternativos para calcular el *Target K*, dependiendo de la naturaleza geométrica de sus datos. 

Entre los algoritmos adicionales soportados bajo la modalidad manual se encuentran:

1. **Estimadores Basados en Distancia y Vecindad:**
   - **TwoNN:** Estima la dimensión comparando las distancias del primer y segundo vecino más cercano, bajo la premisa de que su ratio obedece a una distribución específica que depende de la dimensión intrínseca.
   - **KNN:** Basado en la tasa de crecimiento del volumen de la hiperesfera que contiene a los $k$ vecinos más cercanos a medida que $k$ aumenta.
   - **MiND_ML (Minimum Neighbor Distance MLE):** Una variante del estimador de máxima verosimilitud optimizada para pequeñas variaciones locales.
   
2. **Estimadores Topológicos y de Correlación:**
   - **CorrInt (Correlation Integral):** Basado en la dimensión fractal de Grassberger-Procaccia. Mide cómo escala el número de pares de puntos dentro de un radio $r$ conforme el radio crece.
   - **DANCo (Dimensionality from Angle and Norm Concentration):** Utiliza no solo la distancia (norma), sino también la concentración de los ángulos entre los puntos vecinos para estimar la dimensión.
   
3. **Estimadores Geométricos Lineales Locales:**
   - **lPCA (Local PCA):** Aplica Análisis de Componentes Principales a nivel local (solo considerando los vecinos de un punto) y cuenta el número de eigenvalores significativos que explican la mayoría de la varianza local.

4. **Otros métodos estadísticos:**
   - **MADA (Manifold-Adaptive Dimension Estimation):** Se adapta dinámicamente a curvaturas variables en la topología de los datos.
   - **TLE, MOM, ESS, FisherS:** Familias de estimadores estadísticos robustos disponibles en el motor para propósitos de experimentación algorítmica profunda.

## 4. Referencias
- Levina, E., & Bickel, P. J. (2004). **Maximum likelihood estimation of intrinsic dimension.** *Advances in neural information processing systems*, 17.
