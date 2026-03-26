from fastapi import APIRouter
import sqlite3
import json

router = APIRouter()
DB_PATH = "data.db"

@router.get("/api/graph/init")
def init_graph():
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Fetch first 50 nodes
    cursor.execute("SELECT * FROM nodes LIMIT 50")
    nodes_raw = cursor.fetchall()
    
    nodes = []
    node_ids = set()
    for r in nodes_raw:
        d = dict(r)
        d["properties"] = json.loads(d["properties_json"]) if d["properties_json"] else {}
        del d["properties_json"]
        nodes.append(d)
        node_ids.add(d["node_id"])
        
    # Find edges ONLY between these 50 nodes
    if node_ids:
        placeholders = ",".join("?" for _ in node_ids)
        cursor.execute(f"SELECT * FROM edges WHERE source_id IN ({placeholders}) AND target_id IN ({placeholders})", list(node_ids) + list(node_ids))
        edges = [dict(r) for r in cursor.fetchall()]
    else:
        edges = []
        
    conn.close()
    return {"nodes": nodes, "links": edges}

@router.get("/api/search")
def search_nodes(q: str):
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    safe_q = q.replace('"', '""')
    try:
        # FTS5 match query prioritizing exact prefix matches
        cursor.execute("SELECT node_id, node_type, label FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 10", (f'"{safe_q}"*', ))
        results = [dict(r) for r in cursor.fetchall()]
    except Exception:
        # Fallback to LIKE
        cursor.execute("SELECT node_id, node_type, label FROM search_index WHERE search_text LIKE ? LIMIT 10", (f"%{q}%", ))
        results = [dict(r) for r in cursor.fetchall()]
        
    conn.close()
    return {"results": results}

@router.get("/api/graph/neighbors/{id}")
def get_neighbors(id: str):
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Find edges
    cursor.execute("SELECT * FROM edges WHERE source_id = ? OR target_id = ?", (id, id))
    edges = [dict(r) for r in cursor.fetchall()]
    
    node_ids = set()
    for e in edges:
        node_ids.add(e["source_id"])
        node_ids.add(e["target_id"])
        
    node_ids.add(id)
    
    # Find nodes
    if node_ids:
        placeholders = ",".join("?" for _ in node_ids)
        cursor.execute(f"SELECT * FROM nodes WHERE node_id IN ({placeholders})", list(node_ids))
        nodes = []
        for r in cursor.fetchall():
            d = dict(r)
            d["properties"] = json.loads(d["properties_json"]) if d["properties_json"] else {}
            del d["properties_json"]
            nodes.append(d)
    else:
        nodes = []
        
    conn.close()
    
    return {
        "nodes": nodes,
        "links": edges
    }
