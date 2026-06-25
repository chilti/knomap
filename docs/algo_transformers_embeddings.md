# Algoritmo: Transformers y Embeddings Densos

## 1. Introducción
Los "Embeddings" son representaciones vectoriales densas de un texto. A diferencia de las representaciones tradicionales dispersas (como Bag-of-Words o TF-IDF), los embeddings generados por arquitecturas *Transformer* (Vaswani et al., 2017) logran capturar la semántica profunda, el contexto y las relaciones no lineales entre palabras. En LabSOM se utilizan modelos especializados en literatura científica como **SPECTER2** (Cohan et al., 2020).

## 2. Fundamentos Matemáticos

### 2.1 El Mecanismo de Auto-Atención (Self-Attention)
El corazón de los Transformers es la "Atención Autodirigida". Para una secuencia de tokens, se proyectan tres matrices: Consultas ($Q$), Claves ($K$) y Valores ($V$).
La atención se calcula mediante un producto punto escalado:
$$ \text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V $$
Donde $d_k$ es la dimensión de las claves. La función `softmax` transforma los puntajes brutos en una distribución de probabilidad, indicando cuánta "atención" debe prestar un token a los demás en la misma secuencia.

### 2.2 Codificación a Vector de Documento
Los modelos tipo BERT procesan el documento a través de múltiples capas de atención y redes densas (*Feed Forward*). Para obtener un único vector representativo del documento completo $\mathbf{v}_i \in \mathbb{R}^d$, se realiza una técnica de agregación (generalmente extrayendo el token especial `[CLS]` o aplicando un *mean-pooling* sobre todos los tokens).

### 2.3 Similitud Semántica
Para garantizar que la distancia matemática equivalga a la similitud semántica, el vector se normaliza (Norma L2):
$$ \hat{\mathbf{v}}_i = \frac{\mathbf{v}_i}{\|\mathbf{v}_i\|_2} $$
Esto permite calcular la similitud entre dos artículos $i$ y $j$ mediante la similitud del coseno:
$$ \cos(\theta) = \hat{\mathbf{v}}_i \cdot \hat{\mathbf{v}}_j $$

## 3. Comparativa de Modelos Utilizados: SPECTER2 vs Nomic

LabSOM permite elegir entre dos de los mejores modelos de la industria para generar estos vectores, cada uno con fortalezas distintas:

### 3.1 SPECTER2 (Scientific Paper Embeddings using Citation-informed TransformERs)
- **Arquitectura Base:** Basado en SciBERT (variante de BERT).
- **Objetivo de Entrenamiento:** A diferencia de los modelos generales, SPECTER2 se entrenó explícitamente utilizando la red de grafos de citas científicas (si el artículo A cita al artículo B, el modelo es forzado a acercar sus vectores matemáticamente).
- **Ventaja:** Excepcional para capturar el parentesco en disciplinas académicas puras y jerga científica densa.
- **Contexto:** Límite típico de 512 tokens (ideal para concatenaciones de Título + Abstract + Keywords).
- **Ejecución en LabSOM:** Se ejecuta de manera **local** mediante la librería `sentence-transformers`, garantizando total privacidad de los datos sin depender de APIs externas ni servidores de terceros.

### 3.2 Nomic (Nomic-Embed-Text)
- **Arquitectura Base:** Arquitectura moderna de *encoder* altamente optimizada que implementa mecanismos de atención extendida (*Flash Attention*).
- **Objetivo de Entrenamiento:** Entrenamiento contrastivo sobre un corpus masivo, generalista y multimodal de escala planetaria.
- **Ventaja:** Posee una generalización extraordinaria. Entiende tanto conceptos científicos como jerga técnica general, matices interdisciplinarios y múltiples idiomas.
- **Contexto:** Soporta ventanas de contexto enormes (hasta 8192 tokens), lo cual evitará el truncamiento si en el futuro se deciden codificar artículos en texto completo (*full-text*).
- **Ejecución en LabSOM:** Se ejecuta a través de una **API REST compatible con OpenAI** (como LM Studio), lo que permite delegar el peso computacional a un servidor remoto o local con GPUs dedicadas de alta gama, acelerando exponencialmente la vectorización de corpus bibliográficos masivos.

## 4. Referencias
- Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., ... & Polosukhin, I. (2017). **Attention is all you need.** *Advances in neural information processing systems*, 30.
- Cohan, A., Feldman, S., Beltagy, I., Downey, D., & Weld, D. S. (2020). **SPECTER: Document-level Representation Learning using Citation-informed Transformers.** *In Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics* (pp. 2270–2282).
