import os
import httpx
from typing import Optional

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

async def generate_explanation(impact_data: dict, recs: dict, event_data: dict) -> Optional[str]:
    """Generates an explanation using OpenRouter."""
    if not OPENROUTER_API_KEY:
        # Provide a fallback deterministic explanation if no key is set
        return (f"Event '{event_data.get('event_cause')}' at {event_data.get('zone')} "
                f"was assessed with severity {impact_data['severity']} "
                f"(score: {impact_data['impact_score']}). Deploying {recs['officers_required']} officers "
                f"and {recs['barricades_required']} barricades.")

    prompt = f"""
    You are an AI Traffic Operations Assistant. Explain the following traffic operational plan clearly and concisely in one or two sentences.
    Do NOT generate new recommendations. Just explain WHY the current ones were made based on the severity.

    Context:
    - Event Cause: {event_data.get('event_cause')}
    - Road Closure Required: {event_data.get('requires_road_closure')}
    - Impact Score: {impact_data['impact_score']}
    - Severity: {impact_data['severity']}

    Recommendations:
    - Officers: {recs['officers_required']}
    - Barricades: {recs['barricades_required']}
    - Diversion Required: {recs['diversion_required']}

    Explanation:
    """

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openai/gpt-4o-mini", # Cost-effective default
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 100
                },
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Error calling OpenRouter: {e}")
        return "Explanation could not be generated due to an API error."
