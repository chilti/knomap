# Guía de Usuario: Análisis Longitudinal de Coocurrencia y Mapas SOM en la Interfaz Web de KnoMap

Esta guía describe, paso a paso y exclusivamente mediante texto e instrucciones estructuradas (sin capturas de pantalla), cómo utilizar la **interfaz gráfica web de KnoMap** para llevar a cabo un **análisis cienciométrico longitudinal de coocurrencia de palabras clave** en ventanas temporales (ej. decenales o quinquenales) y su posterior modelado neurocomputacional mediante **mapas autoorganizados de Kohonen (SOM)** con el protocolo de encadenamiento *Warm-Start*.

---

## 1. Requisitos Previos y Entorno

1. **Acceso a la Plataforma:**
   - Abra su navegador web (Chrome, Firefox o Edge recomendados).
   - Ingrese a la dirección local o de servidor donde está desplegado KnoMap (habitualmente `http://localhost:5015` o `http://localhost:5173`).
2. **Credenciales de Acceso:**
   - Si la instancia cuenta con autenticación activada, introduzca su usuario y contraseña (por defecto de fábrica: usuario `admin`, contraseña `admin123`).
3. **Corpus de Publicaciones:**
   - Asegúrese de tener a mano el archivo bibliográfico que desea analizar en formato compatible: OpenAlex (`.json`), Scopus (`.csv`), Web of Science (`.txt` tab-delimited / plano) o tabla canónica (`.parquet`).
   - Verifique que el corpus contenga registros multianuales (por ejemplo, una serie de 10 a 60 años) y campos de palabras clave del autor (*Author Keywords* / `DE`) o descriptores (*Keywords Plus* / `ID`).

---

## 2. Paso 1: Navegación y Carga del Corpus

1. **Localizar el Módulo Bibliométrico:**
   - En la barra lateral izquierda de navegación principal, identifique el menú con icono de red o grafo denominado **Bibliometrics**.
   - Al hacer clic, se desplegarán las opciones del módulo. Seleccione la subvista **Biblio Networks**.
2. **Cargar el Archivo:**
   - En la parte superior izquierda o central de la pantalla, ubique la zona de carga de archivos etiquetada como **Select Dataset File** o **Drop files here to upload**.
   - Arrastre su archivo bibliográfico o haga clic sobre el recuadro para seleccionarlo desde su explorador de archivos.
   - Espere unos segundos mientras el sistema realiza el parseo preliminar.
   - **Confirmación visual:** Verifique que en la barra de estado superior aparezca el mensaje de confirmación indicando el número total de documentos leídos (por ejemplo: `Loaded 1,999 documents`).

---

## 3. Paso 2: Configuración del Preprocesamiento Temporal por Ventanas

En el panel lateral izquierdo denominado **Bibliometric Preprocessing**, configure los siguientes parámetros uno a uno:

| Parámetro en Pantalla | Valor Recomendado | Explicación para el Usuario |
| :--- | :---: | :--- |
| **Network Type** | `Co-occurrence (Keywords, etc.)` | Selecciona la tipología de análisis semántico conceptual basada en términos que aparecen juntos en las publicaciones. |
| **Tag / Extraction Source** | `DE` (o `ID`) | Define el campo de extracción. `DE` corresponde a las palabras clave asignadas por los autores (*Author Keywords*); `ID` a descriptores automáticos de la base de datos. |
| **Max Nodes / Terms** | `40` (o `50`) | Limita el análisis a los conceptos más prominentes y persistentes del corpus. Mantener entre 40 y 50 términos previene la saturación visual y garantiza una cuadrícula SOM legible. |
| **Min Co-occurrence** | `2` | Umbral mínimo de coapariciones para registrar un enlace. Filtra coocurrencias aisladas o accidentales. |
| **Counting Method** | `Full` | Conteo entero estándar de coaparición. |
| **Generate Temporal Sequences** | **[Activado / Casilla Marcada]** | **Paso Crítico:** Habilita el particionamiento longitudinal del corpus en múltiples cortes históricos sucesivos. |
| **Custom Temporal Window** | `10` (o `5`) | Duración en años de cada corte temporal. Introduzca `10` para ventanas decenales o `5` para quinquenios. |

**Ejecución:**
- Presione el botón azul principal ubicado en la base del panel lateral: **Process Bibliometrics**.
- Espere a que el motor analítico complete la construcción de la red global y la segmentación temporal.
- Al finalizar, el sistema mostrará la notificación de éxito indicando el número de periodos generados (por ejemplo: `Generated 6 consecutive subperiods: 1967-1976, 1977-1986, 1987-1996, 1997-2006, 2007-2016, 2017-2026`).

---

## 4. Paso 3: Exploración Interactiva de las Redes por Periodo

Tras el procesamiento, la pantalla principal renderiza el visualizador interactivo de grafos:

1. **Uso del Selector Temporal Superior:**
   - En la barra superior, localice el menú desplegable de periodos (**Period Selector**).
   - Por defecto se muestra la red `Global`.
   - Haga clic en el desplegable y seleccione cualquiera de los periodos individuales (ejemplo: `1977-1986`). El grafo se actualizará de inmediato para mostrar exclusivamente la estructura conceptual de esa década.
2. **Interpretación del Grafo de Fuerzas (D3 Force-Directed):**
   - **Tamaño del nodo:** Es directamente proporcional a la frecuencia de uso de esa palabra clave durante el periodo seleccionado.
   - **Color del nodo:** Corresponde a la comunidad o cluster temático detectado mediante partición modular (algoritmo Louvain / Leiden). Los términos del mismo color forman un colegio o frente temático cohesionado.
   - **Grosor del enlace (arista):** Indica la intensidad de coocurrencia normalizada mediante Fuerza de Asociación (*Association Strength*) o Coseno de Salton.
3. **Interacción Directa con el Grafo:**
   - Puede hacer clic y arrastrar cualquier nodo para reorganizar visualmente la red.
   - Utilice la rueda del ratón (*scroll*) para hacer zoom de acercamiento o alejamiento.
   - Al posar el cursor (*hover*) sobre un término, se resaltan sus conexiones directas y se atenúa el resto del mapa.
4. **Filtros de Apoyo:**
   - Active la casilla **Only Largest Component** si desea filtrar términos periféricos aislados y concentrarse en el núcleo conectado de la red.
   - Si desea inspeccionar los datos tabulares, alterne a la pestaña **Matrix** para visualizar la matriz de adyacencia numérica $40 \times 40$.
5. **Transferencia de Datos al Módulo Neuronal:**
   - En la barra superior derecha, presione el botón azul: **Send Data to SOM & Switch**.
   - Esta acción empaca la secuencia temporal multidimensional completa (las matrices de todos los periodos) y transfiere la sesión activa al motor de entrenamiento neuronal.

---

## 5. Paso 4: Configuración y Entrenamiento del SOM Longitudinal (*Warm-Start*)

Al presionar *Send Data to SOM & Switch*, la aplicación cambiará automáticamente a la pestaña principal **SOM & UMAP**:

1. **Acceso al Submódulo Longitudinal:**
   - En la barra superior de subpestañas, haga clic en **5. Longitudinal SOM Evolution**.
   - En la parte superior de este panel, verifique que aparezca el encabezado de confirmación:
     `6 Periodos (1967-1976, 1977-1986, 1987-1996, 1997-2006, 2007-2016, 2017-2026)`.
2. **Calibración de la Cuadrícula Hexagonal:**
   - En el panel de configuración, revise el criterio de tamaño de malla:
     - **Densidad Óptima ($\sqrt{5\sqrt{N}}$):** Recomendada para redes densas (malla más compacta, garantiza clusters bien poblados).
     - **BigSOM ($5\sqrt{N}$):** Recomendada cuando se busca aislar conceptos singulares o frentes emergentes finos.
   - La relación de aspecto (número de filas $R$ vs. columnas $C$) es calibrada automáticamente por el sistema mediante descomposición en valores singulares (**SVD espectral**) para reflejar la dispersión natural de los datos ($\frac{C}{R} \approx \sqrt{\frac{\lambda_1}{\lambda_2}}$).
3. **Protocolo Canónico de Hiperparámetros (Jiménez-Andrade et al., 2024):**
   - **Periodo 1 (Base - $T_1$):**
     - *Base Iterations / Epochs:* `1000`.
     - *Base Learning Rate ($\alpha_0$):* `0.90`.
     - *Radio de Vecindad Inicial:* $\sigma_0 = \frac{1}{2}\bar{D}$ (orientación topológica global).
   - **Periodos 2+ (Refinamiento - $T_2 \dots T_k$):**
     - *Refine Iterations / Epochs:* `200`.
     - *Refine Learning Rate ($\alpha$):* `0.10`.
     - *Radio de Vecindad Acotado:* $\sigma = \frac{1}{8}\bar{D}$ (ajuste fino sin giros de cuadrícula).
     - *Inicialización:* Automática por **Warm-Start** ($W_t^{(0)} = W_{t-1}^*$).
   - **Normalización Intertemporal:** Seleccione `Cosine` (ideal para matrices de coocurrencia).
4. **Ejecutar el Entrenamiento:**
   - Presione el botón **Train Longitudinal SOMs**.
   - Una barra de progreso indicará el avance secuencial ($T_1 \to T_2 \dots \to T_k$). Gracias a la aceleración por PyTorch/GPU en el servidor, el cálculo suele tomar pocos segundos.

---

## 6. Paso 5: Interpretación y Lectura de Resultados en Tres Niveles

Al concluir el entrenamiento, la pestaña **Longitudinal SOM Evolution** habilita herramientas de exploración visual en tres escalas cienciométricas:

### A. Nivel Macro: Trayectorias y Deriva Global
1. **Timeline Player (Barra de Reproducción Temporal):**
   - En la parte inferior, localice el control con botón de reproducción (*Play*) y barra deslizante temporal.
   - Presione *Play*: observará una animación continua donde los hexágonos y las etiquetas se reorganizan suavemente de década en década.
   - **Qué observar:** Note cómo los cuadrantes temáticos principales se mantienen espacialmente orientados sin rotar arbitrariamente, permitiendo rastrear el desplazamiento gradual de los conceptos.
2. **Side-by-Side (Comparativa Multidecenal Lado a Lado):**
   - Seleccione la opción de visualización **Side-by-Side**.
   - La pantalla mostrará los mapas de todos los periodos colocados en paralelo. Permite comparar instantáneamente la estructura de la primera década frente a la más reciente.

### B. Nivel Meso: Dinámica de Clusters (Escisión y Fusión de Paradigmas)
1. **Cluster Splitting (Escisión o Diferenciación Temática):**
   - Examine las agrupaciones neuronales coloreadas.
   - Si dos palabras compartían el mismo cluster en décadas iniciales y en décadas recientes aparecen en clusters separados, indica **especialización y madurez disciplinar** (el área creció lo suficiente para constituir una subdisciplina propia).
2. **Cluster Merging (Fusión o Hibridación):**
   - Términos de clusters independientes que convergen en la misma agrupación neuronal en décadas recientes señalan **interdisciplinariedad e hibridación conceptual**.
3. **Thematic Migration (Diagrama Aluvial):**
   - Active la vista de **Thematic Migration / Alluvial Plot**.
   - Muestra un diagrama de flujos continuos donde el ancho de cada banda refleja el volumen de términos que transitan de una comunidad a otra a través de las décadas.

### C. Nivel Micro: Deriva Sináptica y Perfiles Singulares
1. **Knowledge Drift / Deriva Sináptica ($\Delta W$):**
   - Seleccione la capa de calor **Synaptic Drift ($\Delta W$)**.
   - Cada celda hexagonal se colorea según la fórmula:
     $$\Delta W_j = \| W_j^{(t)} - W_j^{(t-1)} \|_2$$
   - Las neuronas en tonos cálidos (rojo/naranja) señalan los cuadrantes conceptuales que sufrieron mayor tensión de cambio y transformación metodológica. Las celdas frías (azul/verde) representan núcleos de conocimiento conservados y estables.
2. **Perfiles Singulares:**
   - Identifique neuronas que contienen una única palabra clave aislada.
   - El visualizador longitudinal permite comprobar si dicho término representó un frente emergente efímero de una década o el precursor que atrajo nuevos conceptos en las décadas siguientes.

---

## 7. Paso 6: Inspección de Etiquetas (BMUs) y Mapas de Componentes

Para profundizar en conceptos específicos:
1. Haga clic en la subpestaña **3. SOM Maps** (dentro del módulo SOM & UMAP).
2. **Etiquetas de Neuronas (BMUs):**
   - Marque la casilla **Show Entity Labels**.
   - Cada celda hexagonal mostrará las palabras clave proyectadas sobre su coordenada de máxima activación.
   - La **U-Matrix** (matriz de distancias unificadas) revela valles claros (núcleos temáticos compactos) separados por crestas oscuras (fronteras semánticas).
3. **Mapas de Componentes (Component Planes):**
   - En el menú desplegable **Select Component / Indicator**, elija cualquier palabra clave del estudio (por ejemplo: *Demography*, *Urbanization*, *Migration*).
   - El mapa mostrará la distribución de pesos de ese concepto en toda la red neuronal.
   - **Regla de lectura:** Si dos palabras presentan patrones cromáticos idénticos (zonas cálidas en la misma posición de la cuadrícula), indica que coocurren sistemáticamente y forman un frente cognitivo común.

---

## 8. Paso 7: Exportación de Figuras y Persistencia del Proyecto

1. **Exportación de Manuscritos (Figuras de Alta Calidad):**
   - En la cabecera del visualizador de redes o del mapa SOM, utilice los botones:
     - **SVG:** Gráfico vectorial escalable óptimo para edición en Illustrator o Inkscape.
     - **PNG:** Imagen rasterizada en alta resolución lista para incluir en tesis o artículos científicos.
2. **Persistencia en el Servidor (KnoMap Hub):**
   - En la barra superior derecha del sistema, haga clic en **Save Project to Server**.
   - Asigne un nombre al estudio (ejemplo: `Analisis_Longitudinal_Coocurrencia_1967_2026`) y etiquetas descriptivas.
   - Esto guarda el estado completo (redes, periodos, modelos SOM entrenados y proyecciones) en la base relacional SQLite (`knomap_hub.db`), garantizando que pueda reabrir el experimento en cualquier momento sin necesidad de recalcular.
