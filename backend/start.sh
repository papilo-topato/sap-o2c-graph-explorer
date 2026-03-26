#!/bin/bash
# Rebuild the dataset and FTS index on every deploy (since Render uses ephemeral disks)
python ingest_data.py

# Launch the FastAPI Uvicorn ASGI server binding to Render's allocated PORT
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
