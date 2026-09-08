---
name: project-hub-manager
description: Gestión de persistencia relacional en SQLite (knomap_hub.db), inspección de manifiestos de proyecto, exportación/importación de paquetes portables .knomap y filtrado por fechas y etiquetas.
dependencies:
  - python: "/home/ambientesPy/revistaslatam"
  - script: "scripts/knomap_project_cli.py"
---

# KnoMap Project Hub Manager

Permite a los agentes interactuar con el almacén local de proyectos de KnoMap para consultar el catálogo de investigaciones, recuperar sesiones, clonar proyectos y generar respaldos íntegros de la base de datos relacional.

## Overview
KnoMap utiliza un modelo de persistencia dual: SQLite local (`knomap_hub.db`) para consultas rápidas e indexación multi-proyecto, y archivos portables `.knomap` para transferir investigaciones completas (incluyendo pesos del SOM, asignación de clusters e informes Markdown). Este skill proporciona herramientas de terminal estructuradas con E/S basada en archivos.

## Dependencies
- Entorno Python: `/home/ambientesPy/revistaslatam`
- Base de datos predeterminada: `/home/labsom/knomap/engine/knomap_hub.db`
- Script ejecutable: [`scripts/knomap_project_cli.py`](file:///home/labsom/knomap/engine/skills/project-hub-manager/scripts/knomap_project_cli.py)

## Scripts & CLI Tools

### Listar Proyectos (`list`)
Consulta el repositorio SQLite con filtros opcionales de fecha y temática:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/knomap_project_cli.py list \
  --since 2025-01-01 \
  --tag "cienciometria" \
  --output /ruta/a/proyectos_filtrados.json
```

### Inspeccionar Estado y Manifiesto (`inspect`)
Extrae los detalles de entrenamiento SOM, hiperparámetros y clusters de un proyecto específico:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/knomap_project_cli.py inspect \
  --project-id knomap-8f3a1b2c \
  --output /ruta/al/manifiesto_inspeccionado.json
```

### Exportar a Archivo `.knomap` (`export`)
Empaqueta un proyecto desde SQLite hacia un archivo portable:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/knomap_project_cli.py export \
  --project-id knomap-8f3a1b2c \
  --output /ruta/al/estudio_ia.knomap
```

### Importar Archivo `.knomap` (`import`)
Registra un archivo de sesión externo dentro de la base de datos local:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/knomap_project_cli.py import \
  --input /ruta/al/estudio_externo.knomap \
  --output /ruta/al/resultado_importacion.json
```
*Nota:* En caso de colisión de identificadores UUID, el CLI genera un nuevo UUID automáticamente preservando la integridad de ambos proyectos.

### Respaldo en Caliente (`backup`)
Crea una copia de seguridad íntegra de la base de datos SQLite en modo online:
```bash
/home/ambientesPy/revistaslatam/bin/python scripts/knomap_project_cli.py backup \
  --output /ruta/a/knomap_hub_backup.db
```

## Workflow Steps
1. **Verificar Sesiones Previas:** Ejecutar `list` para comprobar si ya existe un proyecto sobre la temática de interés.
2. **Reanudar o Inspeccionar:** Ejecutar `inspect` para conocer las dimensiones del mapa y los clusters calculados.
3. **Persistir y Exportar:** Al finalizar un pipeline de análisis, exportar el archivo `.knomap` para su distribución.

## References
- [Esquema de Base de Datos SQLite](references/knomap_hub_db_schema.md)
- [Especificación del Manifiesto de Proyecto v2.0](references/manifest_v2_spec.md)

## Troubleshooting & Edge Cases
- **Base de Datos No Existente:** Si la base de datos `knomap_hub.db` no existe al ejecutar el comando, el CLI inicializa el esquema automáticamente en modo WAL.
- **Colisiones de UUID:** El subcomando `import` detecta si el UUID del archivo entrante ya existe en la base de datos y genera un identificador nuevo derivado de `uuid4`, renombrando el proyecto para evitar sobrescrituras accidentales.
