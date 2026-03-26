from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import json

from cognitive.guardrail import run_guardrails
from cognitive.prompt_builder import get_text_to_sql_system_prompt, get_summarizer_system_prompt
from cognitive.validator import validate_sql
from cognitive.llm_client import LLMClient
from graph.graph_api import router as graph_router

app = FastAPI(title="O2C Cognitive API")
app.include_router(graph_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "data.db"
client = LLMClient()

class QueryRequest(BaseModel):
    query: str

@app.post("/api/query")
def process_query(req: QueryRequest):
    # 1. Guardrails T1 & T2
    if not run_guardrails(req.query):
        return {
            "answer": "I am an Order-to-Cash AI. Your query violates the safety guidelines or is not related to O2C data.",
            "sql": "",
            "highlight_ids": []
        }
    
    # 2. Text-to-SQL prompt injection & generation
    sys_prompt_sql = get_text_to_sql_system_prompt()
    raw_sql = client.chat(f"Translate this into SQL: {req.query}", sys_prompt_sql)
    
    # 3. Validate generated SQL
    try:
        clean_sql = validate_sql(raw_sql)
    except Exception as e:
        return {
            "answer": f"Failed to validate SQL: {str(e)}",
            "sql": raw_sql,
            "highlight_ids": []
        }
        
    # Execute SQL safely
    try:
        # uri=True enables read-only query parameter for SQLite
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(clean_sql)
        rows = cursor.fetchall()
        data_rows = [dict(row) for row in rows]
        conn.close()
    except Exception as e:
        return {
            "answer": f"SQL Execution Failed: {str(e)}",
            "sql": clean_sql,
            "highlight_ids": []
        }
        
    # 4. Hard Canned Response Check
    if not data_rows:
        return {
            "answer": "No matching records found.",
            "sql": clean_sql,
            "highlight_ids": []
        }
        
    # 5. Summarizer
    sys_prompt_sum = get_summarizer_system_prompt()
    prompt_sum = f"User Question: {req.query}\n\nDATA ROWS:\n{json.dumps(data_rows, indent=2)}"
    
    # Using Llama 3 8b for summarizer as per typical speed needs, but using 70b since it needs to output exact JSON structure
    summarizer_output = client.chat(prompt_sum, sys_prompt_sum, model="llama-3.3-70b-versatile")
    
    # Parse the JSON from the LLM
    try:
        cleaned_json = summarizer_output.strip()
        if cleaned_json.startswith("```json"): cleaned_json = cleaned_json[7:]
        if cleaned_json.startswith("```"): cleaned_json = cleaned_json[3:]
        if cleaned_json.endswith("```"): cleaned_json = cleaned_json[:-3]
        
        parsed = json.loads(cleaned_json.strip())
        answer = parsed.get("answer", "No summary available.")
        highlight_ids = parsed.get("highlight_ids", [])
    except Exception:
        answer = summarizer_output
        highlight_ids = []

    return {
        "answer": answer,
        "sql": clean_sql,
        "highlight_ids": highlight_ids
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
