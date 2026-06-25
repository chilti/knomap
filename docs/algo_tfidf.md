# Algoritmo: TF-IDF (Term Frequency - Inverse Document Frequency)

## 1. Introducción
En el procesamiento de lenguaje natural (NLP), no todas las palabras tienen el mismo valor semántico. Palabras muy frecuentes en un idioma (como "el", "de", "que") no aportan significado diferencial, mientras que palabras raras o altamente específicas son indicativas del tema. TF-IDF es un algoritmo estadístico clásico que evalúa cuán relevante es una palabra para un documento dentro de una colección mayor (corpus).

En LabSOM, el TF-IDF se utiliza como mecanismo para extraer las **palabras clave** representativas de los clústeres descubiertos por HDBSCAN.

## 2. Fundamentos Matemáticos

El valor de TF-IDF se compone del producto de dos métricas independientes: la Frecuencia del Término (TF) y la Frecuencia Inversa del Documento (IDF).

### 2.1 Frecuencia de Término (TF)
Mide la frecuencia bruta con la que ocurre un término $t$ en un documento específico $d$. Existen múltiples variantes de normalización, pero matemáticamente la más sencilla es:
```math
\text{tf}(t, d) = \frac{f_{t,d}}{\sum_{t' \in d} f_{t',d}}
```
Donde $f_{t,d}$ es el número de apariciones de la palabra $t$ en el documento $d$.

### 2.2 Frecuencia Inversa de Documento (IDF)
Mide cuánta información proporciona el término, asignando un peso menor a términos frecuentes y mayor a términos raros.
```math
\text{idf}(t, D) = \log\left(\frac{N}{|\{d \in D : t \in d\}|}\right)
```
- $N$: Número total de documentos en el corpus $D$.
- $|\{d \in D : t \in d\}|$: Número de documentos donde aparece el término $t$.

### 2.3 Ponderación Final
La estadística final es el producto algebraico de ambas métricas:
```math
\text{tf-idf}(t, d, D) = \text{tf}(t, d) \cdot \text{idf}(t, D)
```
LabSOM calcula estos valores para todos los títulos y resúmenes de los artículos pertenecientes a un clúster específico. Los términos con los valores TF-IDF más altos se consideran las **Keywords** representativas y son enviadas al LLM generativo como contexto léxico para bautizar al clúster.

## 3. Referencias
- Salton, G., & Buckley, C. (1988). **Term-weighting approaches in automatic text retrieval.** *Information processing & management*, 24(5), 513-523.
