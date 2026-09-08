# Algoritmos de Similitud de Cadenas para Entidades Bibliométricas

Para la normalización no supervisada por agentes autónomos, se implementan dos métricas complementarias:

---

## 1. Métrica Jaro-Winkler

La métrica Jaro-Winkler está especialmente calibrada para **nombres propios de personas** y **términos cortos**, otorgando mayor peso a coincidencias en el prefijo inicial (primeras letras de apellidos o nombres):

$$d_{jw} = d_j + \ell \cdot p \cdot (1 - d_j)$$

donde $d_j$ es la distancia Jaro estándar, $\ell$ es la longitud del prefijo común (máximo 4 caracteres) y $p = 0.1$ es el factor de escala constante.

* **Ventaja:** Detecta de forma excelente variaciones como `Torres, R.` vs `Torres-Cordoba, Rafael` o `Garcia, Maria` vs `Garcia-Perez, M.`.
* **Umbral Sugerido para Agentes:** $\text{threshold} \ge 0.88$.

---

## 2. Distancia Normalizada de Levenshtein

Mide el número mínimo de operaciones de edición de un solo carácter (inserciones, eliminaciones o sustituciones) necesarias para cambiar una palabra en otra:

$$\text{sim}(s_1, s_2) = 1.0 - \frac{\text{Levenshtein}(s_1, s_2)}{\max(|s_1|, |s_2|)}$$

* **Ventaja:** Ideal para **nombres de instituciones** y **palabras clave compuestas** donde puede haber errores tipográficos o inversiones menores.
* **Umbral Sugerido para Agentes:** $\text{threshold} \ge 0.85$.

---

## 3. Protocolo de Decisión del Agente Autónomo

Cuando el agente recibe la lista de sugerencias generada por `suggest-merges`:
1. Si `similarity_score >= 0.92`: El agente puede aprobar automáticamente el reemplazo, asignando como forma canónica la que posee mayor volumen de ocurrencias (`occurrences_canonical`).
2. Si `0.85 <= similarity_score < 0.92`: El agente debe evaluar el contexto (coautorías o afiliaciones compartidas) antes de generar la regla de tesauro.
3. Si `similarity_score < 0.85`: Descartar como entidades homónimas o independientes.
