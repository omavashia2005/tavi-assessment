import asyncio
import os
from datetime import date

from dotenv import load_dotenv
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firecrawl import Firecrawl
from openai import AsyncOpenAI
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.run import app, main
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.llm_service import FunctionCallParams
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.openai.stt import OpenAIRealtimeSTTService
from pipecat.services.openai.tts import OpenAITTSService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.workers.runner import WorkerRunner

from schemas import ChatRequest, ChatResponse, VendorSearchResponse, WorkOrder

load_dotenv()
openai = AsyncOpenAI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_INSTRUCTION = f"""
You are Tavi, a concise voice assistant creating a facility maintenance work order.
Ask one short follow-up question at a time until you know the site location, service
type, budget, and required service date. Keep spoken replies brief and natural.
Store addresses only as "Street Number Street Name, City State ZIP", for example
"712 S Forest Ave, Tempe AZ 85281". Ask the user to clarify incomplete addresses.
Today is {date.today().isoformat()}. Resolve relative dates such as "tomorrow",
"next Friday", or "in 10 days" against today and store requiredServiceDate as
YYYY-MM-DD. Do not ask for clarification when the relative date is unambiguous.

After every user turn that adds or changes work-order information, call
update_work_order with the complete current work order. Use an empty string for
unknown fields. Once the core details are known, draft a short outreachMessage.
Never invent details the user did not provide. The outreach message should contain all the fields you got so the vendor gets 
maximum information about what the job is, where it is, the budget, and when. Keep the outreach message cordial and make sure you're greeting 
the vendor and keeping your message short, informative, and professionally warm.
""".strip()

CHAT_INSTRUCTION = f"""
You are Tavi, a concise chat assistant creating a facility maintenance work order.
Ask one short follow-up question at a time. Preserve known work-order values and
never invent details. Addresses must use "Street Number Street Name, City State ZIP".
Today is {date.today().isoformat()}; resolve relative dates and store them as
YYYY-MM-DD. Return the next assistant message and the complete current work order,
using empty strings for unknown fields. The outreach message should contain all the fields you got so the vendor gets 
maximum information about what the job is, where it is, the budget, and when. Keep the outreach message cordial and make sure you're greeting 
the vendor and keeping your message short, informative, and professionally warm.
""".strip()

transport_params = {
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
    ),
}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    response = await openai.responses.parse(
        model=os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
        instructions=CHAT_INSTRUCTION,
        input=[
            {
                "role": "developer",
                "content": f"Current work order: {request.workOrder.model_dump_json()}",
            },
            *[
                {
                    "role": "assistant" if turn.role == "agent" else "user",
                    "content": turn.text,
                }
                for turn in request.turns
            ],
        ],
        text_format=ChatResponse,
    )
    if not response.output_parsed:
        raise HTTPException(502, "OpenAI returned no structured chat response")
    return response.output_parsed


_fc = Firecrawl(api_key=os.environ.get("FIRECRAWL_API_KEY", ""))
_vendor_cache: dict[str, dict] = {}  # ponytail: in-process cache, cleared on restart

_VENDOR_SCHEMA = {
    "type": "object",
    "properties": {
        "vendors": {
            "type": "array",
            "description": "Businesses ranked best to worst by rating and relevance",
            "items": {
                "type": "object",
                "properties": {
                    "name":         {"type": "string", "description": "Business name"},
                    "contactInfo":  {"type": "string", "description": "Phone, address, and/or website"},
                    "reviewScore":  {"type": "string", "description": "BBB rating or review summary"},
                    "avgCost":      {"type": "string", "description": "Average cost estimate, empty if unavailable"},
                    "distanceMiles":{"type": "number", "description": "Approximate miles from the job site"},
                },
                "required": ["name", "contactInfo", "reviewScore", "distanceMiles"],
            },
        }
    },
    "required": ["vendors"],
}


@app.post("/api/vendor-search", response_model=VendorSearchResponse)
async def vendor_search(order: WorkOrder) -> VendorSearchResponse:
    if not order.siteLocation or not order.serviceType:
        raise HTTPException(422, "siteLocation and serviceType are required")

    cache_key = f"{order.siteLocation}|{order.serviceType}|{order.budget}|{order.requiredServiceDate}"
    if cache_key in _vendor_cache:
        return VendorSearchResponse.model_validate(_vendor_cache[cache_key])

    prompt = (
        f"Search the Better Business Bureau (BBB) for accredited businesses that provide "
        f"'{order.serviceType}' services within a strict 20-mile radius of {order.siteLocation}. "
        f"Do NOT include any business located more than 20 miles away. "
        f"Return the top 20 results ranked from best to worst by BBB rating and customer reviews. "
        f"For each business return: full business name, contact info (phone, address, website), "
        f"BBB rating or a brief review score summary, average cost estimate if listed, "
        f"and approximate distance in miles from {order.siteLocation}. "
        f"Budget context: {order.budget or 'not specified'}. "
        f"Service needed by: {order.requiredServiceDate or 'flexible'}."
    )

    result = await asyncio.to_thread(
        _fc.agent,
        prompt=prompt,
        urls=["http://bbb.org"],
        schema=_VENDOR_SCHEMA,
        model="spark-1-mini",
        max_credits=500,
    )

    if not result or not getattr(result, "data", None):
        raise HTTPException(502, "Firecrawl agent returned no data")

    _vendor_cache[cache_key] = result.data
    return VendorSearchResponse.model_validate(result.data)


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments) -> None:
    api_key = os.environ["OPENAI_API_KEY"]

    stt = OpenAIRealtimeSTTService(
        api_key=api_key,
        settings=OpenAIRealtimeSTTService.Settings(
            model=os.getenv("OPENAI_STT_MODEL", "gpt-4o-transcribe"),
        ),
    )
    llm = OpenAILLMService(
        api_key=api_key,
        settings=OpenAILLMService.Settings(
            model=os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
            system_instruction=SYSTEM_INSTRUCTION,
        ),
    )
    tts = OpenAITTSService(
        api_key=api_key,
        settings=OpenAITTSService.Settings(
            model=os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts"),
            voice=os.getenv("OPENAI_TTS_VOICE", "ballad"),
            instructions="Speak clearly, warmly, and briefly.",
        ),
    )

    async def update_work_order(params: FunctionCallParams) -> None:
        work_order = WorkOrder.model_validate(params.arguments)
        await worker.rtvi.send_server_message(work_order.model_dump())
        await params.result_callback({"saved": True})

    update_work_order_tool = FunctionSchema(
        name="update_work_order",
        description="Publish the complete current maintenance work order to the UI.",
        properties={
            name: {
                "type": "string",
                "description": (
                    "Address formatted as Street Number Street Name, City State ZIP, "
                    "or empty if unknown."
                    if name == "siteLocation"
                    else "Required service date as YYYY-MM-DD, or empty if unknown."
                    if name == "requiredServiceDate"
                    else f"Current {name}, or an empty string if unknown."
                ),
            }
            for name in WorkOrder.model_fields
        },
        required=list(WorkOrder.model_fields),
        handler=update_work_order,
    )

    context = LLMContext(tools=[update_work_order_tool])
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )
    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_out_sample_rate=24000,
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client) -> None:
        await worker.cancel()

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)
    await runner.run()


async def bot(runner_args: RunnerArguments) -> None:
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    main()
