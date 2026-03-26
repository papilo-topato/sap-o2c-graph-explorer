import sqlparse

def validate_sql(raw_sql: str) -> str:
    """
    Validates that the given SQL string is safe to execute for read-only purposes.
    Returns the cleaned SQL if valid. Raises ValueError if invalid.
    """
    # Clean markdown if LLM disobeyed
    clean_sql = raw_sql.strip()
    if clean_sql.startswith("```sql"):
        clean_sql = clean_sql[6:]
    if clean_sql.startswith("```"):
        clean_sql = clean_sql[3:]
    if clean_sql.endswith("```"):
        clean_sql = clean_sql[:-3]
    
    clean_sql = clean_sql.strip()

    # Parse using sqlparse
    try:
        parsed = sqlparse.parse(clean_sql)
        if not parsed:
            raise ValueError("Empty SQL")
        
        statement = parsed[0]
        # Check first token is SELECT
        first_token = statement.token_first()
        if not first_token or first_token.value.upper() != "SELECT":
            raise ValueError(f"SQL must start with SELECT. Found: {first_token.value if first_token else 'None'}")
            
        return clean_sql
        
    except Exception as e:
        raise ValueError(f"Invalid SQL Query: {str(e)}")
