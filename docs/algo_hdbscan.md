# Algoritmo: HDBSCAN (Hierarchical Density-Based Spatial Clustering)

## 1. Introducción
HDBSCAN es una evolución del clásico algoritmo DBSCAN. Es un método de agrupamiento espacial basado en densidad que permite descubrir clústeres de diversas formas y tamaños en presencia de ruido estadístico. Su mayor ventaja es que extrae una jerarquía de clústeres, y luego selecciona los agrupamientos planos "más estables" de esa jerarquía.

## 2. Fundamentos Matemáticos

### 2.1 Distancia de Alcance Mutuo (Mutual Reachability Distance)
HDBSCAN combate el ruido "alejando" artificialmente los puntos esporádicos para evitar que formen puentes falsos entre clústeres reales. 
Define la **Distancia Central** (*Core Distance*), $\text{core}_k(x)$, como la distancia desde $x$ a su $k$-ésimo vecino más cercano. Con base en esto, transforma el espacio de distancias original $d(a,b)$ en una nueva métrica llamada Distancia de Alcance Mutuo:
```math
d_{\text{mreach}-k}(a, b) = \max\{\text{core}_k(a), \text{core}_k(b), d(a,b)\}
```
Si dos puntos están en zonas densas, su distancia mreach es igual a la real. Si alguno está en una zona dispersa, la distancia mreach equivale a su Core Distance, empujándolo lejos.

### 2.2 Árbol de Recubrimiento Mínimo (MST)
Con la matriz de $d_{\text{mreach}-k}$, HDBSCAN trata los datos como un grafo conexo pesado y encuentra el Árbol de Recubrimiento Mínimo (Minimum Spanning Tree). A medida que se van cortando las aristas de mayor peso del MST de forma iterativa, el grafo se rompe en componentes conexas, formando un dendrograma jerárquico.

### 2.3 Condensación y Selección de Clústeres
El dendrograma resultante suele ser muy ruidoso porque pequeñas porciones de puntos caen en cada corte. HDBSCAN "condensa" el árbol ignorando desprendimientos de puntos que sean menores al parámetro `min_cluster_size`. 
Finalmente, para seleccionar clústeres independientes, define una medida de **Estabilidad** (basada en el recíproco de la distancia durante la cual un clúster sobrevive antes de dividirse). HDBSCAN extrae los clústeres que maximizan esta estabilidad global, marcando los puntos no seleccionados como ruido.

## 3. Referencias
- Campello, R. J., Moulavi, D., & Sander, J. (2013). **Density-based clustering based on hierarchical density estimates.** In *Advances in Knowledge Discovery and Data Mining* (pp. 160-172). Springer Berlin Heidelberg.
