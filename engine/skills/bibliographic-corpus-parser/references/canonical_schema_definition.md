# Definición del Esquema Canónico Tabular

Todo archivo bibliográfico procesado por `corpus_parser_cli.py` se estandariza en una tabla tabular (`.parquet`, `.csv` o `.json`) con el siguiente esquema formal:

---

## Esquema de Columnas

| Campo | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `id` | String | Identificador unívoco del documento (DOI, EID, UT de WoS o ID de OpenAlex) | `W3123456789` o `10.1016/j...` |
| `title` | String | Título completo normalizado de la publicación | `Neural network analysis in science...` |
| `abstract` | String | Resumen del documento | `This study analyzes the longitudinal...` |
| `authors` | String | Lista de autores separados por punto y coma (`; `) | `García, M.; Torres, R.; Smith, J.` |
| `year` | Integer | Año de publicación de 4 dígitos | `2024` |
| `source_title` | String | Revista, libro, memoria de congreso o serie editorial | `Journal of Informetrics` |
| `citations` | Integer | Conteo acumulado de citas recibidas (entero $\ge 0$) | `42` |
| `doi` | String | Digital Object Identifier limpio | `10.1016/j.joi.2024.101234` |
| `keywords_author` | String | Palabras clave propuestas por los autores (separadas por `; `) | `scientometrics; self-organizing maps; neural networks` |
| `keywords_plus` | String | Palabras clave indexadas (Keywords Plus / Index Keywords) | `citation analysis; topology; algorithms` |
| `affiliations` | String | Instituciones y países de los autores | `Universidad Nacional Autónoma de México; CONAHCYT` |
| `oa_status` | String | Vía de Acceso Abierto (`gold`, `diamond`, `green`, `hybrid`, `bronze`, `closed`) | `gold` |
| `references` | String | Cadena de referencias citadas para acoplamiento bibliográfico | `References...` |
