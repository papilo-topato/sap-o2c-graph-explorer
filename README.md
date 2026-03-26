# SAP Order-to-Cash (O2C) Knowledge Graph

A modern Business Intelligence tool designed to unify complex SAP ERP data (Sales Orders, Deliveries, Invoices, Payments) into an interactive, spatial Knowledge Graph queryable via Natural Language.

## The Technology Stack

| Architecture Layer | Core Technology | Rationale |
| :--- | :--- | :--- |
| **Cognitive Brain** | `Groq API (Llama 3)` | Zero-shot Text-to-SQL logic execution coupled with extreme low-latency 70B inference. |
| **Relational Graph** | `SQLite (Python)` | Operational stability over Neo4j. We serialize graph relationships virtually during ingestion and leverage native SQL `JOIN` mapping over Cypher to ensure LLM accuracy. |
| **Semantic Search** | `SQLite FTS5` | Blistering fast MATCH text searching across hundreds of merged JSON payloads with zero Vector Database bloat (No ChromaDB necessary). |
| **Spatial UI** | `react-force-graph-2d` | High-performance WebGL 2D engine powering organic D3.js physics for document flow visualization. |
| **Frontend Framework** | `Next.js 14` + `Tailwind` | Modern, responsive split-pane UI architecture with smooth interactions and dark-mode aesthetics. |

---

## Architecture Paradigm

### 1. The Dual-Tier Semantic Guardrail
To ensure zero hallucination and strict business bounds, the API runs every query against:
*   **Tier 1:** An ultra-fast local logic string matcher blocking malicious intent (`drop`, `delete`, `poem`, etc).
*   **Tier 2:** A blistering fast LLM classifier evaluating "Is this query explicitly about SAP/O2C Data? YES or NO."

### 2. "Think Graph, Store SQL" Architecture
When queries pass the guardrails, we inject the exact `camelCase` schema and the **Golden Join Path** (mandating `billing_document_items.referenceSdDocument` linkages). The LLM translates natural language perfectly to a `SELECT` statement. The query is evaluated defensively via `sqlparse` and executed against the `?mode=ro` connection.

### 3. Visual "Wow" Polish
*   **Interactive Node Search:** Search by exact ID or fuzzy Customer name. The 3D Camera natively tracks and zooms `d3VelocityDecay` straight to the node!
*   **Visual Highlights:** Text output intelligently parses IDs and projects them to the WebGL Canvas context as Glowing Red Rings over the requested documents.
*   **Node Inspector:** Instantly read the deep nested `properties_json` payloads when evaluating graph paths.

---

## Local Setup Instructions

### 1. Initialize the SQLite Cognitive Engine
```bash
cd backend
python ingest_data.py
python -m uvicorn main:app --port 8000 --reload
```
*(Ensure `.env` contains your `GROQ_API_KEY`)*

### 2. Launch the Forward-Deployed Dashboard 
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to interact.

---

## ☁️ Cloud Deployment (Production)

We have explicitly structured this repository for easy horizontal deployment.

### 1. Backend (Render / Railway)
The backend is a fully containerized ASGI worker.
1. Create a New **Web Service** on Render and point to the `backend/` directory.
2. In the setup UI, use the autodetected environment but verify:
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `bash start.sh` (This script dynamically runs `ingest_data.py` to rebuild the Ephemeral SQL disk database, then boots Uvicorn on `$PORT`).
3. Add your `GROQ_API_KEY` to the environment variables.

### 2. Frontend (Vercel)
1. Import the `frontend/` directory as a Next.js project into Vercel.
2. Under Environment Variables, add:
   `NEXT_PUBLIC_API_URL=https://your-new-render-backend-url.onrender.com`
3. Hit Deploy!
