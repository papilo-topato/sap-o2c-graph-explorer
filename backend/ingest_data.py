import os
import sqlite3
import json
import pandas as pd

DB_PATH = "data.db"
DATA_DIR = "../sap-o2c-data"

def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    conn = sqlite3.connect(DB_PATH)
    
    print("--- Phase 1: Loading Raw Data ---")
    table_counts = {}
    
    # 1. Load Raw Tables
    for folder in sorted(os.listdir(DATA_DIR)):
        folder_path = os.path.join(DATA_DIR, folder)
        if os.path.isdir(folder_path):
            jsonl_files = [f for f in os.listdir(folder_path) if f.endswith('.jsonl')]
            if jsonl_files:
                table_name = folder
                all_records = []
                for file_name in jsonl_files:
                    file_path = os.path.join(folder_path, file_name)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        for line in f:
                            if line.strip():
                                try:
                                    all_records.append(json.loads(line))
                                except Exception:
                                    pass
                if all_records:
                    df = pd.DataFrame(all_records)
                    # For properties_json, we can ensure all dict columns are strings, but JSON strings are flat anyway
                    for col in df.columns:
                        if df[col].dtype == 'object' and df[col].apply(lambda x: isinstance(x, (dict, list))).any():
                            df[col] = df[col].apply(lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x)
                            
                    df.to_sql(table_name, conn, if_exists='replace', index=False)
                    table_counts[table_name] = len(df)
                    print(f"Loaded {table_name}: {len(df)} rows")
    
    print("\n--- Phase 2: Building Special Graph Tables ---")
    
    # Create nodes table
    conn.execute('''
        CREATE TABLE nodes (
            node_id TEXT PRIMARY KEY,
            node_type TEXT,
            label TEXT,
            properties_json TEXT
        )
    ''')
    
    # Create edges table
    conn.execute('''
        CREATE TABLE edges (
            edge_id TEXT PRIMARY KEY,
            source_id TEXT,
            target_id TEXT,
            relation_type TEXT
        )
    ''')
    
    # Helper to load nodes
    def load_nodes(table, n_type, id_col, label_col):
        try:
            df = pd.read_sql(f"SELECT * FROM {table}", conn)
            nodes = []
            for _, row in df.iterrows():
                props = row.dropna().to_dict()
                nodes.append({
                    'node_id': str(row[id_col]),
                    'node_type': n_type,
                    'label': str(row[label_col]) if label_col in row and not pd.isna(row[label_col]) else str(row[id_col]),
                    'properties_json': json.dumps(props)
                })
            if nodes:
                nodes_df = pd.DataFrame(nodes).drop_duplicates(subset=['node_id'])
                nodes_df.to_sql('nodes', conn, if_exists='append', index=False)
        except Exception as e:
            print(f"Error loading nodes from {table}: {e}")

    # Load node types
    load_nodes('business_partners', 'Customer', 'businessPartner', 'businessPartnerFullName')
    load_nodes('sales_order_headers', 'SalesOrder', 'salesOrder', 'salesOrder')
    load_nodes('outbound_delivery_headers', 'Delivery', 'deliveryDocument', 'deliveryDocument')
    load_nodes('billing_document_headers', 'Invoice', 'billingDocument', 'billingDocument')
    load_nodes('products', 'Product', 'product', 'product')

    # Helper to load edges
    def build_edges(query, rel_type):
        try:
            df = pd.read_sql(query, conn).dropna()
            df.columns = ['source_id', 'target_id']
            # Cast to prevent float artifacts
            df['source_id'] = df['source_id'].astype(str)
            df['target_id'] = df['target_id'].astype(str)
            
            df['relation_type'] = rel_type
            df['edge_id'] = df['source_id'] + '_' + rel_type + '_' + df['target_id']
            df = df.drop_duplicates(subset=['edge_id'])
            df.to_sql('edges', conn, if_exists='append', index=False)
        except Exception as e:
            print(f"Error building edges {rel_type}: {e}")

    # Customer -> SalesOrder
    build_edges("SELECT soldToParty, salesOrder FROM sales_order_headers", "PLACED")
    # SalesOrder -> Delivery
    build_edges("SELECT referenceSdDocument, deliveryDocument FROM outbound_delivery_items", "FULFILLED_BY")
    # Delivery -> Invoice (Can also be SalesOrder -> Invoice depending on referenceSdDocument)
    build_edges("SELECT referenceSdDocument, billingDocument FROM billing_document_items", "BILLED_BY")
    # SalesOrder -> Product
    build_edges("SELECT salesOrder, material FROM sales_order_items", "CONTAINS")

    # Record counts for nodes and edges
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM nodes")
    table_counts['nodes'] = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM edges")
    table_counts['edges'] = cur.fetchone()[0]
    
    print("\n--- Phase 2.5: Building Search Index ---")
    conn.execute("CREATE VIRTUAL TABLE search_index USING fts5(node_id UNINDEXED, node_type UNINDEXED, label UNINDEXED, search_text)")
    
    cur.execute("SELECT node_id, node_type, label, properties_json FROM nodes")
    node_rows = cur.fetchall()
    
    search_data = []
    for r in node_rows:
        n_id, n_type, lbl, props = r
        props_dict = json.loads(props) if props else {}
        # Collect all text values to make a fuzzy search blob
        text_blob = f"{n_id} {n_type} {lbl} " + " ".join(str(v) for v in props_dict.values() if v)
        search_data.append((n_id, n_type, lbl, text_blob))
        
    cur.executemany("INSERT INTO search_index (node_id, node_type, label, search_text) VALUES (?, ?, ?, ?)", search_data)
    
    cur.execute("SELECT COUNT(*) FROM search_index")
    table_counts['search_index'] = cur.fetchone()[0]

    print("\n--- Phase 3: Optimising (Creating Indexes) ---")
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_so ON sales_order_headers(salesOrder)",
        "CREATE INDEX IF NOT EXISTS idx_bp ON business_partners(businessPartner)",
        "CREATE INDEX IF NOT EXISTS idx_od ON outbound_delivery_headers(deliveryDocument)",
        "CREATE INDEX IF NOT EXISTS idx_bd ON billing_document_headers(billingDocument)",
        "CREATE INDEX IF NOT EXISTS idx_prod ON products(product)",
        "CREATE INDEX IF NOT EXISTS idx_node_id ON nodes(node_id)",
        "CREATE INDEX IF NOT EXISTS idx_edge_src ON edges(source_id)",
        "CREATE INDEX IF NOT EXISTS idx_edge_tgt ON edges(target_id)"
    ]
    for idx in indexes:
        try:
            conn.execute(idx)
        except Exception as e:
            print(f"Index error: {e}")

    conn.commit()
    conn.close()

    print("\n--- Final Validation Summary ---")
    for t_name, count in sorted(table_counts.items()):
        print(f"Table {t_name}: {count} rows")

if __name__ == "__main__":
    main()
