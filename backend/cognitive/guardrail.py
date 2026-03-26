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
    system_prompt = "You are a binary classification filter. You only answer YES or NO. Determine if the user's query is related to Order-to-Cash business data, business queries, SAP data, sales orders, deliveries, invoices, customers, products, payments, business partners or business databases. Reply ONLY with YES or NO. Do not explain."
    
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
