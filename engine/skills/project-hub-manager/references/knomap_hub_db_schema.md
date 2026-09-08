# Esquema Relacional de `knomap_hub.db` (SQLite)

La persistencia del servidor KnoMap se gestiona mediante SQLite en modo WAL (*Write-Ahead Logging*) para habilitar alta concurrencia de lectura sin bloqueos.

---

## 1. Tabla `projects`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Identificador único canónico (UUID v4 o prefijo `knomap-xxxx`) |
| `name` | TEXT | NOT NULL | Nombre legible del proyecto de investigación |
| `created_at` | TEXT | NOT NULL | Marca de tiempo ISO-8601 de creación en UTC |
| `updated_at` | TEXT | NOT NULL | Marca de tiempo ISO-8601 de última modificación |
| `source_file` | TEXT | NULL | Ruta o nombre del archivo de datos original |
| `source_format` | TEXT | NULL | Formato (`scopus`, `wos`, `incites`, `openalex`) |
| `is_public` | INTEGER | DEFAULT 1 | Visibilidad compartida (1 = público, 0 = privado) |
| `metadata_json` | TEXT | NULL | Diccionario JSON con tags, descripción, autor y configuración |
| `som_state_json` | TEXT | NULL | Diccionario serializado con dimensiones de malla, épocas y pesos |
| `clusters_json` | TEXT | NULL | Asignación de clusters por neurona y métricas Silhouette |
| `report_markdown` | TEXT | NULL | Informe analítico final generado por el agente |

---

## 2. Tabla `agent_logs`

Registra el historial de acciones efectuadas por agentes autónomos sobre cada proyecto:

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Identificador del log |
| `project_id` | TEXT | FOREIGN KEY | Enlace al proyecto (`ON DELETE CASCADE`) |
| `timestamp` | TEXT | NOT NULL | Fecha y hora de la acción |
| `agent_name` | TEXT | NULL | Nombre del agente (e.g. `Antigravity`, `OpenClaw`) |
| `action` | TEXT | NULL | Acción ejecutada (`train_som`, `apply_thesaurus`, etc.) |
| `details_json` | TEXT | NULL | Parámetros e hiperparámetros utilizados |
