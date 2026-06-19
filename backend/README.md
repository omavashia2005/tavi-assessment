# Tavi backend

Requires Python 3.11+ and an OpenAI API key.

```bash
cp .env.example .env
uv sync
uv run python bot.py -t webrtc
```

The Pipecat runner serves FastAPI on `http://localhost:7860`. The frontend starts
voice sessions with `POST /start`; SmallWebRTC then carries microphone audio,
spoken bot audio, transcripts, and validated `WorkOrder` updates.
