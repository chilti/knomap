# Integración de La Maquinita 2.0 (InCites Analytics) en newLabSOM

Este plan define la arquitectura e implementación para trasladar el conjunto de scripts y notebooks de **La Maquinita 2.0** a una interfaz web interactiva integrada en **newLabSOM**, permitiendo su ejecución tanto en escritorio (vía ejecutable/installer) como en servidor (vía Docker).

## Consideraciones Generales

> [!IMPORTANT]
> **Formato de carga de archivos InCites:**
> La Maquinita original procesa múltiples archivos CSV/Excel descargados de InCites (ej. *Incites Locations.csv*, *Incites Organizations.csv*, *Incites Research Areas Micro Topics.csv*, etc.). En la nueva interfaz se permitirá al usuario subir un archivo individual o un archivo ZIP / selección múltiple con los archivos del estudio para analizarlos de forma integrada.

> [!NOTE]
> **Flujo 1-Clic a SOM:**
> La matriz de perfiles generada por La Maquinita (`entities_performance_profiles`) podrá enviarse directamente al motor SOM de newLabSOM para entrenar la red neuronal y generar los mapas hexagonales y UMAP sin necesidad de exportar ni importar archivos manualmente.

---

## Cambios Propuestos por Componente

### 1. Motor Analítico Python (`engine/`)

#### [NUEVO] `engine/incites_parser.py`
- Modularizar y migrar la clase `incitesProcessor` de `IncitesScripts.py`.
- Implementar la ingesta y parseo de archivos CSV/Excel de InCites (Locations, Organizations, Funding Agencies, WoS Categories, Micro/Meso/Macro Topics, ESI, SDG).
- Implementar el cálculo de perfiles multidimensionales (Share, National Share, CNCI, % Top 1%, % Top 10%, Percentil Promedio, Impact Factor, Colaboraciones Internacionales/Industria/Domésticas, Citas de Patentes).
- Implementar el algoritmo de proyección MDS 2D (`sklearn.manifold.MDS`).
- Implementar la estructuración de datos para gráficos Sunburst (Topics Macro/Meso/Micro).
- Implementar cálculo de distribuciones por cuartiles (Q1, Q2, Q3, Q4) y estadísticas para gráficos de violín.
- Implementar series de tiempo con suavizado por medias móviles exponenciales (3-ECMA y 5-ECMA).
- Generar la matriz lista para SOM con formato `{ data: number[][], labels: string[], features: string[] }`.

#### [MODIFICAR] `engine/main_engine.py`
- Agregar la función `handle_incites_preprocess(params)` para recibir peticiones JSON de la API C# y retornar los resultados en formato JSON estándar.

---

### 2. Backend Core C# (`backend/src/LabSOM.Backend.Core`)

#### [NUEVO] `backend/src/LabSOM.Backend.Core/Services/InCitesService.cs`
- Crear el servicio C# `InCitesService` que administre el guardado temporal de archivos de InCites subidos por el usuario.
- Invocar la ejecución de `main_engine.py incites_preprocess <payloadFile>` vía subprocess.
- Retornar el DTO con todas las métricas, coordenadas MDS, jerarquías Sunburst, series de tiempo y matriz para SOM.

#### [MODIFICAR] `backend/src/LabSOM.Backend.Core/Program.cs`
- Registrar `InCitesService` como servicio Singleton.
- Crear el endpoint HTTP POST `/api/incites/process` para procesar archivos de InCites.

---

### 3. Frontend React (`frontend/src`)

#### [NUEVO] `frontend/src/components/InCitesExplorer.tsx`
- Componente principal para el módulo **La Maquinita - InCites Analytics**.
- **Panel de Carga**: Zonas de drop/upload para archivos de InCites (Archivos sueltos o paquete ZIP).
- **Controles de Configuración**: Selección de entidad (*Locations, Organizations, Funding Agencies, WoS Categories, Micro/Meso/Macro Topics*), ventana temporal (Periodo completo vs Últimos 5 años), nivel de corte (Cut-off) y grado de suavizado ECMA.
- **Tablero Visual Interactivo**:
  - *MDS Scatter plot*: Visualizador interactivo 2D de disimilitud multidimensional.
  - *Sunburst Topics Chart*: Jerarquía de áreas de investigación con codificación de color según CNCI, percentiles o Top 1%.
  - *Distribución de Cuartiles*: Gráfico de barras acumulativas Q1–Q4 por entidad.
  - *Series Temporales Smoothed*: Gráfico de líneas con filtro de suavizado ECMA (Raw, 3-ECMA, 5-ECMA).
  - *Tabla de Perfil Multidimensional*: Tabla filtrable y exportable a CSV/Excel.
- **Acción "Entrenar en SOM"**: Botón directo para transferir la matriz de perfiles calculada al explorador SOM de `newLabSOM`.

#### [MODIFICAR] `frontend/src/App.tsx`
- Agregar la pestaña / selector en la barra superior de navegación: **"📊 InCites (La Maquinita)"**.
- Integrar la navegación fluida entre el análisis de InCites y el entrenamiento de mapas SOM.

---

## Plan de Verificación

### Pruebas Automatizadas
- Pruebas con Python invocando `main_engine.py incites_preprocess` pasando archivos de prueba de InCites (ej. `Incites Locations.csv`) y validar que el resultado JSON contenga las matrices, coordenadas MDS y estructuras Sunburst correctas.
- Compilación del Backend .NET: `dotnet build backend/src/LabSOM.Backend.Core`.

### Verificación Manual
- Iniciar el servidor localmente (`dotnet run` + `npm run dev`).
- Cargar archivos InCites en la nueva pestaña **InCites (La Maquinita)**.
- Verificar que los gráficos interactivos (MDS, Sunburst, Cuartiles, Violines, Series de tiempo ECMA) se rendericen correctamente.
- Probar el botón **"Entrenar en SOM"** y verificar que la matriz pase automáticamente al módulo de entrenamiento de redes SOM y genere los mapas hexagonales.
