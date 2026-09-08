# Reglas Sintácticas de Archivos de Tesauro (Thesaurus)

Esta referencia define el formato de intercambio y las restricciones formales de los tesauros utilizados en KnoMap y compatibles con VOSviewer.

---

## 1. Estructura del Archivo

El archivo debe ser un archivo CSV codificado en UTF-8 con encabezado estricto:

```csv
label,replace by
Garcia, M.,Garcia-Perez, Maria
Garcia Perez, M.,Garcia-Perez, Maria
UNAM,Universidad Nacional Autonoma de Mexico
National Autonomous University of Mexico,Universidad Nacional Autonoma de Mexico
machine learning,artificial intelligence
```

## 2. Reglas de Validación

1. **Encabezado Obligatorio:** La primera línea debe ser `label,replace by`.
2. **Mayúsculas y Minúsculas:** La comparación de la columna `label` es insensible a mayúsculas y acentos durante la búsqueda, pero se reemplaza por el texto exacto definido en `replace by`.
3. **Eliminación de Nodos / Stopwords:** Si la columna `replace by` está vacía (ej. `unknown author,`), el término se elimina por completo de la red y del corpus.
4. **Prohibición de Ciclos:** No se permiten reglas circulares directas ($A \to B$ y $B \to A$).
5. **Idempotencia:** Si un término ya es idéntico a su forma canónica, no debe incluirse la regla redundante.
