# knoMap — knoMap

**knoMap** (also known as **knoMap**) is an advanced analytical desktop and web platform developed by the Non-Linear Dynamics Laboratory at UNAM (Mexico). It enables researchers to explore, process, and visualize multidimensional data, bibliometric networks, and institutional indicators through Self-Organizing Maps (SOM), semantic analysis, and dimensionality reduction.

---

## 🚀 System Architecture

The platform uses a three-layer heterogeneous architecture optimized for local performance:

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React + TypeScript + Vite | Interactive UI with SVG, Recharts, and D3.js visualizations |
| **Backend API** | C# (.NET 8) + Photino.NET | Local REST server + native desktop window |
| **Analytical Engine** | Python 3 | Parsing, mathematical computation, and AI models (scikit-learn, UMAP, etc.) |

The backend acts as an orchestrator: it serves the React interface as static files and invokes the Python engine as a subprocess on demand. Heavy data payloads **never travel all at once to the frontend** — the engine writes results to disk and the interface fetches them per unit via REST API.

---

## 💻 Installation (Desktop Version)

The desktop version **does not require installing Python, Node.js, or .NET** separately. Everything is bundled in the installer.

### Windows
Download and run `knoMap_Installer_Lite.exe` from the **Releases** section of this repository and follow the installation wizard.

### macOS (Intel and Apple Silicon)
1. Download `knoMap_Mac_Intel.zip` or `knoMap_Mac_Silicon.zip`.
2. Unzip and drag `knoMap.app` to your Applications folder.

> ⚠️ If macOS blocks the app (Gatekeeper security), refer to `INSTRUCCIONES_MAC.txt` included in the ZIP.

### Linux
Download `knoMap_Linux.zip`, extract the contents, and run the main binary.

---

## 📦 Server Deployment (Web Production)

To host the platform on a server and provide access to multiple users:

**Requirements:** Docker with the Compose V2 plugin. Nvidia Container Toolkit (optional, recommended).

```bash
git clone https://github.com/chilti/newknoMap.git
cd newknoMap
docker compose up -d --build
```

The platform will be available on port `5015`. Configure an Nginx reverse proxy to `http://localhost:5015`.

---

## 🛠 Development Environment (Local)

### 1. Start the Backend (.NET + Python)

Requirements: .NET 8 SDK and Python 3 with the engine dependencies installed.

```powershell
cd backend/src/knoMap.Backend.Core
dotnet run
```

The backend initializes at `http://localhost:5123` and opens the desktop window.

### 2. Start the Frontend in Dev Mode

Requirements: Node.js.

```powershell
cd frontend
npm install
npm run dev
```

The React application will connect to the backend at `http://localhost:5123`.

### 3. Build the Frontend for Production

```powershell
cd frontend
npm run build
```

The compiled artifact is automatically copied to `backend/src/knoMap.Backend.Core/wwwroot/`, which is what the desktop application serves.

---

## ⚙️ Modules and Features

### 🔵 Bibliometrics
Processing of files exported from **Web of Science** or **PubMed** to generate co-occurrence networks.

- **Supported network types:** Co-occurrence (keywords, MeSH terms, custom fields), Co-authorship, Co-citation, Citation, Bibliographic Coupling, Bipartite (two custom fields).
- **Temporal mode:** Generates a network series by year to analyze thematic evolution over time.
- **SOM Integration:** A button transfers the calculated network directly to the "Data & SOM" module for training.

### 🔵 InCites Data
Explorer for institutional indicators exported from **Clarivate InCites**.

- **Loading:** Accepts individual or multiple Excel (`.xlsx`) files, or a full **ZIP** archive containing all indicators for an institution.
- **Automatic unit detection:** Identifies the unit type (Researchers, Organizations, Locations, Publication Sources, Funding Agencies, WoS Categories, ESI, SDG, Macro/Meso/Micro Topics, Patentometrics) from the filename.
- **Lazy loading:** Python processes all files and writes results to disk. The interface downloads **only the active unit** at any time to avoid overloading browser memory.
- **Per-unit visualizations:**
  - **Multidimensional profile table** with up to 1,500 entities (Top by production).
  - **Time series chart** with ECMA-3 and ECMA-5 smoothing, showing the Top 20 entities.
  - **Quartile distribution chart** (Q1–Q4) per entity.
- **Export to SOM:** Select a subset of indicators and train a SOM neural network directly on the entities of the active unit.

### 🔵 Data & SOM
The main panel for training and exploring the **Self-Organizing Map (SOM)**.

- **Data import:** CSV/Excel files or direct transfer from the Bibliometrics and InCites modules.
- **Normalization:** Apply and revert transformations on the data matrix.
- **Batch SOM training:** PCA or random initialization, with real-time quantization error visualization.
- **Interactive hexagonal grid:** Map visualization with color-coding by indicator, cluster contours, and entity labels. Labels can be repositioned by dragging.
- **Re-clustering:** Dynamic adjustment of the number of groups without retraining.
- **UMAP projection:** Visualization of neuron similarity in a 2D space overlaid on the SOM.
- **Project export:** Save and load the complete analysis state (`.json`).

### 🔵 Dim Reduction
Independent **dimensionality reduction** module.

- Estimation of the intrinsic dimension of the dataset.
- Reduction to a target dimension using algorithms available in the Python engine.
- Visualization and export of the reduced matrix for use in the SOM module.

### 🔵 Semantic Bibliometrics
**Deep semantic analysis** of scientific articles exported from Web of Science.

- **Preprocessing:** Extracts and combines titles, abstracts, keywords, and MeSH terms from each document.
- **Embedding generation:** Document vectorization using language models (Nomic Embed, SPECTER).
- **Intrinsic dimension estimation:** Analysis of the semantic space of documents.
- **Dimensionality reduction:** Compression of the semantic space for SOM training.
- **Semantic clustering:** Multi-level hierarchical grouping of documents by thematic content.

---

## 🖥 User Interface

- **Collapsible sidebar** for navigation between the 5 modules.
- **Custom title bar** (desktop mode) with native minimize, maximize, and close controls.
- **Window resizing** with the mouse and keyboard shortcuts (Win + ← / →, etc.).
- **Hardware indicator** in the sidebar: automatically detects if an NVIDIA GPU is available to accelerate computations.
- **Project persistence:** Export and import the complete analysis in `.json` format to resume sessions later.

---

## 👥 Developed by

- **Non-Linear Dynamics Laboratory** — Department of Mathematics, Faculty of Sciences, UNAM
- **Dr. José Luis Jiménez Andrade**
- **Dr. Humberto Andrés Carrillo Calvet**

🔗 [www.dynamics.unam.mx](https://www.dynamics.unam.mx/)
