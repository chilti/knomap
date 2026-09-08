# Guía de Formatos Bibliográficos Crudos Soportados

Esta guía documenta los formatos de exportación bibliográfica cruda soportados por el motor de ingesta de KnoMap y sus firmas heurísticas.

---

## 1. Formatos Soportados

| Formato | Extensión | Firma Heurística / Encabezados | Campos Clave Extraídos |
|---|---|---|---|
| **Scopus CSV** | `.csv` | Encabezados: `Authors`, `Title`, `Year`, `Source title`, `Cited by`, `EID` | Autores, Citas, Afiliaciones, Palabras Clave de Autor e Indexadas |
| **Web of Science Plano** | `.txt`, `.ciw` | Líneas que inician con `FN `, `VR `, o registros que terminan en `ER` | `AU`, `TI`, `SO`, `PY`, `TC`, `UT`, `DE`, `ID`, `C1`, `CR` |
| **RIS (Research Information Systems)** | `.ris` | Registros delimitados por `TY  -` y `ER  -` | `AU`/`A1`, `TI`/`T1`, `JO`/`JF`, `PY`/`Y1`, `KW`, `DO` |
| **OpenAlex JSON / JSONL** | `.json`, `.jsonl` | Objetos JSON con llaves `authorships`, `primary_location`, `open_access` | Metadatos completos, `openalex_id`, citas, conceptos y topics |
| **Dimensions CSV** | `.csv` | Encabezados: `Publication Title`, `Times cited`, `Fields of Research` | Títulos, citas, autores normalizados y categorías |

---

## 2. Recomendaciones de Exportación

* **Scopus:** Al exportar desde Scopus, seleccionar formato CSV y marcar las casillas: *Citation information*, *Bibliographical information*, *Abstract & keywords*, *Funding details* y *Other information* (incluyendo Referencias si se analizará co-citación o acoplamiento).
* **Web of Science:** Exportar como *Plain text file* o *Tab delimited file*, seleccionando *Full Record and Cited References* en paquetes de hasta 1,000 registros.
* **OpenAlex:** Los archivos JSON obtenidos vía API o descargados de volcados masivos contienen la estructura más rica para analítica cienciométrica.
