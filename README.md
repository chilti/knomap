# Sinapsis Map — LabSOM

**Sinapsis Map** (también conocido como **LabSOM**) es una plataforma analítica avanzada de escritorio y web desarrollada por el Laboratorio de Dinámica No Lineal de la UNAM. Permite explorar, procesar y visualizar datos multidimensionales, redes bibliométricas e indicadores institucionales mediante Mapas Auto-organizados (SOM), análisis semántico y reducción de dimensionalidad.

---

## ?? Arquitectura del Sistema

La plataforma sigue una arquitectura de tres capas heterogénea optimizada para rendimiento local:

| Capa | Tecnología | Descripción |
|---|---|---|
| **Frontend** | React + TypeScript + Vite | Interfaz interactiva con visualizaciones SVG, Recharts y D3.js |
| **Backend API** | C# (.NET 8) + Photino.NET | Servidor REST local + ventana nativa de escritorio |
| **Motor Analítico** | Python 3 | Parseo, cómputo matemático y modelos de IA (scikit-learn, UMAP, etc.) |

El backend actúa como orquestador: sirve la interfaz React como archivos estáticos e invoca al motor Python como subproceso bajo demanda. Los datos pesados **jamás viajan completos al frontend**: el motor escribe los resultados en disco y la interfaz los solicita por unidad a través de la API REST.

---

## ?? Instalación (Versión de Escritorio)

La versión de escritorio **no requiere instalar Python, Node.js ni .NET** por separado. Todo está empaquetado en el instalador.

### Windows
Descarga y ejecuta `SinapsisMap_Installer_Lite.exe` desde la sección **Releases** del repositorio y sigue el asistente de instalación.

### macOS (Intel y Apple Silicon)
1. Descarga `SinapsisMap_Mac_Intel.zip` o `SinapsisMap_Mac_Silicon.zip`.
2. Descomprime y arrastra `SinapsisMap.app` a tu carpeta de Aplicaciones.

> ?? Si macOS bloquea la apertura (seguridad Gatekeeper), consulta el archivo `INSTRUCCIONES_MAC.txt` incluido en el ZIP.

### Linux
Descarga `SinapsisMap_Linux.zip`, extrae el contenido y ejecuta el binario principal.

---

## ?? Despliegue en Servidor (Producción Web)

Para alojar la plataforma en un servidor y darle acceso a múltiples usuarios:

**Requisitos:** Docker con el plugin Compose V2. Nvidia Container Toolkit (opcional, recomendado).

```bash
git clone https://github.com/chilti/newLabSOM.git
cd newLabSOM
docker compose up -d --build
```

La plataforma quedará disponible en el puerto `5015`. Configura un proxy inverso Nginx hacia `http://localhost:5015`.

---

## ?? Entorno de Desarrollo (Local)

### 1. Iniciar el Backend (.NET + Python)

Requisitos: SDK de .NET 8 y Python 3 con las dependencias del motor.

```powershell
cd backend/src/LabSOM.Backend.Core
dotnet run
```

El backend se inicializa en `http://localhost:5123` y abre la ventana de escritorio.

### 2. Iniciar el Frontend en modo Dev

Requisitos: Node.js.

```powershell
cd frontend
npm install
npm run dev
```

La aplicación React se conectará al backend en `http://localhost:5123`.

### 3. Compilar el Frontend para Producción

```powershell
cd frontend
npm run build
```

El artefacto compilado se copia automáticamente a `backend/src/LabSOM.Backend.Core/wwwroot/`, que es lo que sirve la aplicación de escritorio.

---

## ?? Módulos y Características

### ?? Bibliometrics
Procesamiento de archivos exportados desde **Web of Science** o **PubMed** para generar redes de co-ocurrencia de términos.

- **Tipos de red soportados:** Co-ocurrencia (keywords, MeSH, campos personalizados), Co-autoría, Co-citación, Citación, Acoplamiento Bibliográfico, Bipartita (dos campos distintos).
- **Modo temporal:** Genera una serie de redes por año para analizar evolución temática.
- **Integración con SOM:** Un botón transfiere la red calculada directamente al módulo "Data & SOM" para entrenamiento.

### ?? InCites Data
Explorador de indicadores institucionales exportados desde **Clarivate InCites**.

- **Carga:** Acepta archivos Excel (`.xlsx`) individuales o múltiples, o un archivo **ZIP** completo con todos los indicadores de una institución.
- **Detección automática de unidades:** Identifica el tipo de unidad (Researchers, Organizations, Locations, Publication Sources, Funding Agencies, WoS Categories, ESI, SDG, Macro/Meso/Micro Topics, Patentometrics) a partir del nombre del archivo.
- **Carga por demanda (lazy loading):** El procesamiento se ejecuta en Python, que escribe los resultados en disco. La interfaz descarga **únicamente la unidad activa** en cada momento para evitar saturar la memoria del navegador.
- **Visualizaciones por unidad:**
  - **Tabla de perfil** multidimensional con hasta 1,500 entidades (Top por producción).
  - **Gráfica de series de tiempo** con suavizado ECMA-3 y ECMA-5, mostrando el Top 20 de entidades.
  - **Distribución de cuartiles** (Q1–Q4) por entidad.
- **Exportar a SOM:** Selecciona un subconjunto de indicadores y entrena directamente una red neuronal SOM sobre las entidades de la unidad activa.

### ?? Data & SOM
Panel principal de entrenamiento y exploración del **Mapa Auto-organizado (SOM)**.

- **Importación de datos:** CSV/Excel o transferencia directa desde los módulos Bibliometrics e InCites.
- **Normalización:** Aplicación y reversión de transformaciones sobre la matriz de datos.
- **Entrenamiento en lote (Batch SOM):** Inicialización PCA o aleatoria, con visualización en tiempo real del error de cuantización.
- **Malla hexagonal interactiva:** Visualización del mapa con colores por indicador, contornos de clúster y etiquetas de entidades. Permite mover etiquetas arrastrando.
- **Re-clusterización:** Ajuste dinámico del número de grupos sin reentrenar.
- **Proyección UMAP:** Visualización de similitud entre neuronas en un espacio 2D superpuesto al SOM.
- **Exportación de proyecto:** Guarda y carga el estado completo del análisis (`.json`).

### ?? Dim Reduction
Módulo independiente de **reducción de dimensionalidad**.

- Estimación de la dimensión intrínseca del conjunto de datos.
- Reducción a dimensión objetivo mediante algoritmos disponibles en el motor Python.
- Visualización y exportación de la matriz reducida para uso en el módulo SOM.

### ?? Semantic Bibliometrics
Análisis **semántico profundo** de artículos científicos exportados desde Web of Science.

- **Preprocesamiento:** Extrae y combina títulos, resúmenes, palabras clave y términos MeSH de cada documento.
- **Generación de embeddings:** Vectorización de documentos usando modelos de lenguaje (Nomic Embed, SPECTER).
- **Estimación de dimensión intrínseca:** Análisis del espacio semántico de los documentos.
- **Reducción de dimensión:** Compresión del espacio semántico para entrenamiento SOM.
- **Clusterización semántica:** Agrupamiento jerárquico multinivel de documentos por contenido temático.

---

## ?? Interfaz de Usuario

- **Barra lateral colapsable** con navegación entre los 5 módulos.
- **Barra de título personalizada** (modo escritorio) con controles nativos de minimizar, maximizar y cerrar.
- **Redimensionamiento de ventana** con el ratón y atajos de teclado (Win + ? / ?, etc.).
- **Indicador de hardware** en la barra lateral: detecta automáticamente si hay GPU NVIDIA disponible para acelerar los cálculos.
- **Persistencia de proyectos:** Exporta e importa el análisis completo en formato `.json` para continuar sesiones posteriores.

---

## ?? Desarrollado por

- **Laboratorio de Dinámica No Lineal** — Departamento de Matemáticas, Facultad de Ciencias, UNAM
- **Dr. José Luis Jiménez Andrade**
- **Dr. Humberto Andrés Carrillo Calvet**

?? [www.dynamics.unam.mx](https://www.dynamics.unam.mx/)
