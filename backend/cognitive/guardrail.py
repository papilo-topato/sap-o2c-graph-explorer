from .llm_client import LLMClient

BLOCKLIST = ["poem", "story", "ignore previous instructions", "forget", "delete", "drop table", "truncate"]

def check_tier1(query: str) -> bool:
    """Returns True if safe, False if blocked."""
    query_lower = query.lower()
    for word in BLOCKLIST:
        if word in query_lower:
            return False
    return True

def check_tier2(query: str) -> bool:
    """Returns True if O2C related, False otherwise."""
    client = LLMClient()
    system_prompt = "You are a Tier 2 security classifier for an SAP Order-to-Cash (O2C) Database. Respond EXACTLY with the word 'YES' if the user's query is about Sales Orders, Deliveries, Invoices, Payments, Customers, Materials, Products, Items, Line Items, Plants, or Quantities. Respond EXACTLY with the word 'NO' if the query is a story, coding question, poem, or completely unrelated to O2C. Do not explain."
    
    # We use the faster 8b model for the binary check.
    response = client.chat(query, system_prompt, model="llama-3.1-8b-instant").strip().upper()
    return "YES" in response

def run_guardrails(query: str) -> bool:
    print(f"[GUARDRAIL] T1 check on: {query}")
    if not check_tier1(query): 
        print(f"[GUARDRAIL] T1 Blocked.")
        return False
        
    print(f"[GUARDRAIL] T2 check...")
    if not check_tier2(query): 
        print(f"[GUARDRAIL] T2 Blocked. Not O2C data.")
        return False
        
    return True
