#: Tavi backend

Requires Python 3.11+ and an OpenAI API key.

```bash
cd backend
cp .env.example .env
# Add OPENAI_API_KEY to .env
uv sync
uv run python bot.py -t webrtc
```

FastAPI runs at `http://localhost:7860`; stop it with `Ctrl+C`.

The frontend uses `POST /start` for Pipecat voice sessions and `POST /api/chat`
for plain OpenAI text chat. Both return validated work-order data.



