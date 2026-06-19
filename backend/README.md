# Tavi backend

Requires Python 3.11+ and an OpenAI API key.

```bash
cd backend
cp .env.example .env
# Add OPENAI_API_KEY to .env
uv sync
uv run python bot.py -t webrtc
```

FastAPI runs at `http://localhost:7860`; stop it with `Ctrl+C`.

The frontend uses `POST /start` to create a SmallWebRTC session. Voice and typed
chat share the same OpenAI conversation and stream validated `WorkOrder` updates.
