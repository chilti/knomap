# Algoritmo: UMAP (Uniform Manifold Approximation and Projection)

## 1. Introducción
UMAP es un algoritmo de reducción de dimensionalidad no lineal. A diferencia de técnicas lineales como PCA, UMAP es excepcionalmente hábil para preservar la topología de los datos (la estructura global y local), permitiendo proyectar datos de alta dimensión en espacios manejables de 2 o 3 dimensiones para visualización, o en $K$ dimensiones para clustering.

## 2. Fundamentos Matemáticos

### 2.1 Construcción del Complejo Simplicial Difuso
UMAP asume que los datos están distribuidos de manera uniforme en una variedad de Riemann. Para modelar esto, se crea un grafo (un conjunto simplicial difuso) donde cada arista tiene una probabilidad de existir basándose en la distancia entre puntos.

Para un punto $x_i$, la probabilidad de conectarse con $x_j$ decrece exponencialmente con la distancia:
```math
p_{i|j} = \exp\left(-\frac{d(x_i, x_j) - \rho_i}{\sigma_i}\right)
```
- $d(x_i, x_j)$: Distancia entre los puntos (usualmente similitud coseno para texto).
- $\rho_i$: Distancia al vecino más cercano de $x_i$ (asegura que todo punto esté conectado al menos a otro).
- $\sigma_i$: Factor de escala de vecindad que garantiza que el volumen topológico se preserve.

La matriz probabilística simétrica se define como:
```math
p_{ij} = p_{i|j} + p_{j|i} - p_{i|j}p_{j|i}
```

### 2.2 Optimización en Baja Dimensión
En el espacio de baja dimensión (ej. 2D), UMAP inicializa las coordenadas (usualmente con Spectral Embedding) y define probabilidades equivalentes $q_{ij}$ modeladas a través de una función similar a la distribución t de Student para manejar el "problema del apiñamiento" (*crowding problem*):
```math
q_{ij} = \left( 1 + a \|\mathbf{y}_i - \mathbf{y}_j\|_2^{2b} \right)^{-1}
```
Donde $a$ y $b$ son parámetros ajustables según la densidad deseada (determinado por el hiperparámetro `min_dist`).

Las coordenadas finales $\mathbf{y}$ se optimizan utilizando Descenso de Gradiente Estocástico (SGD) para minimizar la Entropía Cruzada (*Cross Entropy*) entre las distribuciones $p$ (alta dimensión) y $q$ (baja dimensión):
```math
C = \sum_{i \ne j} \left( p_{ij} \log \left(\frac{p_{ij}}{q_{ij}}\right) + (1 - p_{ij}) \log \left(\frac{1 - p_{ij}}{1 - q_{ij}}\right) \right)
```

## 3. Referencias
- McInnes, L., Healy, J., & Melville, J. (2018). **UMAP: Uniform Manifold Approximation and Projection for Dimension Reduction.** *arXiv preprint arXiv:1802.03426*.
