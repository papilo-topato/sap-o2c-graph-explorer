import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class LLMClient:
    def __init__(self):
        self.client = Groq(api_key=os.environ.get("GROQ_API_KEY", "your_key_here"))

    def chat(self, prompt: str, system_prompt: str = "", model: str = "llama-3.3-70b-versatile") -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            chat_completion = self.client.chat.completions.create(
                messages=messages,
                model=model,
                temperature=0.0
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            print(f"LLM Error: {str(e)}")
            return ""
