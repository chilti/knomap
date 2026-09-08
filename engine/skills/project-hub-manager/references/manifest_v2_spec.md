# Especificación del Manifiesto de Proyecto `.knomap` (v2.0)

Un archivo `.knomap` es el contenedor portátil que permite transferir sesiones completas de investigación entre instancias de KnoMap o compartirlas en repositorios de ciencia abierta.

---

## Estructura JSON del Manifiesto

```json
{
  "version": "2.0.0",
  "id": "knomap-8f3a1b2c",
  "name": "Evolución de la IA en México 2015-2025",
  "created_at": "2026-09-07T12:00:00Z",
  "updated_at": "2026-09-07T12:30:00Z",
  "source_file": "openalex_ia_mexico.parquet",
  "source_format": "openalex-parquet",
  "metadata": {
    "tags": ["cienciometria", "inteligencia-artificial", "mexico", "som"],
    "description": "Análisis longitudinal de coautoría y frentes temáticos con mapas de Kohonen.",
    "author": "Antigravity Agent"
  },
  "som_state": {
    "rows": 15,
    "cols": 25,
    "epochs": 1000,
    "alpha": 0.5,
    "grid_type": "hexagonal",
    "toroid": false,
    "codebook_shape": [375, 45],
    "quantization_error": 0.042,
    "topographic_error": 0.015
  },
  "clusters": {
    "algorithm": "kmeans",
    "k": 7,
    "silhouette_score": 0.48,
    "assignments": [1, 1, 2, 4, 3, 5]
  },
  "report_markdown": "# Informe Ejecutivo de Investigación..."
}
```
