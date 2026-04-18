from openai import OpenAI
from flask import current_app


def get_client():
    return OpenAI(
        api_key=current_app.config["OPENAI_API_KEY"],
        base_url="https://openrouter.ai/api/v1"
    )


def chat_with_ai(history):
    client = get_client()

    messages = [
        {"role": "system", "content": current_app.config["SYSTEM_PROMPT"]}
    ] + history

    response = client.chat.completions.create(
        model=current_app.config["OPENAI_MODEL"],
        messages=messages,
    )

    return response.choices[0].message.content