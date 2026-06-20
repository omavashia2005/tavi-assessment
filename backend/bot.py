import asyncio
import json
import os
import random
import re
import urllib.parse
from typing import cast
from db import (
    DB_PATH,
    create_vendor,
    create_work_order,
    get_vendor,
    get_work_order,
    update_order_vendor_states,
)
from dotenv import load_dotenv
from fastapi import BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firecrawl import Firecrawl
from geopy.geocoders import Nominatim
from geopy.location import Location
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
from starlette.responses import StreamingResponse

from schemas import (
    ChatRequest,
    ChatResponse,
    ReceiveMessageRequest,
    SendMessageRequest,
    SendMessageResponse,
    StateTransition,
    VendorConversation,
    VendorResult,
    VendorSearchResponse,
    WorkOrder,
    WorkOrderResponse,
)
from system_prompts import (
    CHAT_INSTRUCTION,
    STATE_TRANSITION,
    SYSTEM_INSTRUCTION,
    VENDOR_REPLY,
    VENDOR_ROLEPLAY,
)

load_dotenv()
openai = AsyncOpenAI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


firecrawl = Firecrawl(api_key=os.environ.get("FIRECRAWL_API_KEY", ""))
geolocator = Nominatim(user_agent="tavi-hackathon")
transport_params = {
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
    ),
}
# ponytail: process-local stream is enough for one server; use DB/pubsub for multiple workers.
vendor_messages: dict[str, VendorConversation] = {}
message_subscribers: set[asyncio.Queue[VendorConversation]] = set()
WORK_ORDER_STATES = (
    "CONTACTING_VENDORS",
    "AUCTIONING",
    "VENDOR ASSIGNED",
    "SITE_VISIT",
    "COMPLETE",
)
WORK_ORDER_STATE_LABELS = {
    "CONTACTING_VENDORS": "Contacting Vendors",
    "AUCTIONING": "Auctioning",
    "VENDOR ASSIGNED": "Vendor Assigned",
    "SITE_VISIT": "Site Visit",
    "COMPLETE": "Order Complete",
}
VENDOR_STATES = (
    "AWAITING_RESPONSE",
    "NEGOTIATING",
    "QUOTE_RECEIVED",
    "SELECTED",
)


def _money(value: str) -> float:
    match = re.search(r"\d[\d,]*(?:\.\d+)?", value)
    return float(match.group().replace(",", "")) if match else 0.0


def _progress_state(current: str, proposed: str, states: tuple[str, ...]) -> str:
    return states[max(states.index(current), states.index(proposed))]


def _persist_work_order_vendors(
    order: WorkOrder, vendors: list[VendorResult], *, db_path=DB_PATH
) -> tuple[dict, list[dict]]:
    work_order = create_work_order(
        location=order.siteLocation,
        type=order.serviceType,
        budget=_money(order.budget),
        date=order.requiredServiceDate,
        db_path=db_path,
    )
    saved_vendors = []
    for vendor in vendors:
        saved_vendors.append(
            create_vendor(
                work_order_id=work_order["work_order_id"],
                name=vendor.name,
                # ponytail: DB requires a price; use 0 until it supports unknown costs.
                price=_money(vendor.avgCost),
                outreach_message=order.outreachMessage,
                vendor_state=vendor.vendorState,
                db_path=db_path,
            )
        )
    return work_order, saved_vendors


async def generate_response(
    manager_message: str, vendor_id: str, work_order_id: str
) -> None:
    work_order = get_work_order(work_order_id)
    vendor = get_vendor(vendor_id)
    if not work_order or not vendor or vendor["work_order_id"] != work_order_id:
        raise RuntimeError("Work order or vendor not found")

    response = await openai.responses.create(
        model=os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
        input=VENDOR_ROLEPLAY.format(
            vendor_name=vendor["name"],
            work_order=work_order,
            vendor=vendor,
            manager_message=manager_message,
        ),
    )
    if not response.output_text:
        raise RuntimeError("OpenAI returned no vendor response")
    await process_vendor_message(
        ReceiveMessageRequest(
            vendor_id=vendor_id,
            work_order_id=work_order_id,
            generated_message=response.output_text,
        )
    )


async def process_vendor_message(
    request: ReceiveMessageRequest,
) -> VendorConversation:
    work_order = get_work_order(request.work_order_id)
    vendor = get_vendor(request.vendor_id)
    if not work_order or not vendor or vendor["work_order_id"] != request.work_order_id:
        raise HTTPException(404, "Work order or vendor not found")

    response = await openai.responses.create(
        model=os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
        input=VENDOR_REPLY.format(
            work_order_id=work_order["work_order_id"],
            vendor_id=vendor["vendor_id"],
            outreach_message=vendor["outreach_message"],
            vendor_message=request.generated_message,
        ),
    )
    if not response.output_text:
        raise HTTPException(502, "OpenAI returned no agent response")

    conversation = VendorConversation(
        vendor_id=vendor["vendor_id"],
        vendor_response=request.generated_message,
        agent_response=response.output_text,
    )
    vendor_messages[conversation.vendor_id] = conversation
    for subscriber in message_subscribers.copy():
        subscriber.put_nowait(conversation)
    return conversation


@app.get("/api/receive-messages")
async def receive_messages() -> StreamingResponse:
    queue: asyncio.Queue[VendorConversation] = asyncio.Queue()

    async def events():
        message_subscribers.add(queue)
        try:
            for message in vendor_messages.values():
                yield f"data: {message.model_dump_json()}\n\n"
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {message.model_dump_json()}\n\n"
                except TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            message_subscribers.discard(queue)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@app.post("/api/send-message", response_model=SendMessageResponse)
async def send_message(
    request: SendMessageRequest, background_tasks: BackgroundTasks
) -> SendMessageResponse:
    vendor = get_vendor(request.vendor_id)
    work_order = get_work_order(vendor["work_order_id"]) if vendor else None
    if not vendor or not work_order:
        raise HTTPException(404, "Work order or vendor not found")

    latest = vendor_messages.get(vendor["vendor_id"])
    decision = await openai.responses.parse(
        model=os.getenv("OPENAI_LLM_MODEL", "gpt-4.1-mini"),
        instructions=STATE_TRANSITION,
        input=json.dumps(
            {
                "work_order": work_order,
                "vendor": vendor,
                "latest_conversation": latest.model_dump() if latest else None,
                "facility_manager_response": request.response,
            }
        ),
        text_format=StateTransition,
    )
    if not decision.output_parsed:
        raise HTTPException(502, "OpenAI returned no state transition")

    updated = update_order_vendor_states(
        work_order["work_order_id"],
        vendor["vendor_id"],
        _progress_state(
            work_order["state"],
            decision.output_parsed.work_order_state,
            WORK_ORDER_STATES,
        ),
        _progress_state(
            vendor["vendor_state"],
            decision.output_parsed.vendor_state,
            VENDOR_STATES,
        ),
    )
    if not updated:
        raise HTTPException(404, "Work order or vendor not found")

    background_tasks.add_task(
        generate_response,
        request.response,
        vendor["vendor_id"],
        work_order["work_order_id"],
    )
    return SendMessageResponse(
        work_order_id=updated[0]["work_order_id"],
        work_order_state=WORK_ORDER_STATE_LABELS[updated[0]["state"]],
        vendor_id=updated[1]["vendor_id"],
        vendor_state=updated[1]["vendor_state"],
    )


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


@app.post("/api/vendor-search", response_model=VendorSearchResponse)
async def vendor_search(order: WorkOrder) -> VendorSearchResponse:
    if not order.siteLocation or not order.serviceType:
        raise HTTPException(422, "siteLocation and serviceType are required")

    address_string = order.siteLocation

    location = cast(Location | None, geolocator.geocode(address_string))

    # 2. Define the base URL
    base_url = "https://www.bbb.org/search"

    if not location:
        raise HTTPException(status_code=403, detail="Invalid location")

    city, state, _ = address_string.split(",", 1)[1].strip().rsplit(" ", 2)

    # 3. Put all your fields into a dictionary
    params = {
        "filter_category": "10113-100",
        "filter_distance": "25",
        "filter_ratings": "A",
        "filter_sa": "1",
        "find_country": "USA",
        "find_entity": "10113-000",
        "find_latlng": f"{location.latitude},{location.longitude}",
        "find_loc": f"{city}, {state}",
        "find_text": f"{order.serviceType}",
        "find_type": "Category",
        "page": "1",
        "touched": "4",
    }

    # 4. Generate the final, safe URL
    final_url = f"{base_url}?{urllib.parse.urlencode(params)}"

    data = firecrawl.scrape(
        final_url,
        formats=[
            {
                "type": "json",
                "schema": VendorSearchResponse,
                "prompt": "I just want a simple JSON object in the aforementioned schema",
            }
        ],
    )

    result = VendorSearchResponse.model_validate(data.json)
    for vendor in result.vendors:
        vendor.vendorState = "AWAITING_RESPONSE"
    return result


@app.post("/api/work-order", response_model=WorkOrderResponse)
async def submit_work_order(
    order: WorkOrder, background_tasks: BackgroundTasks
) -> WorkOrderResponse:
    if not all(
        (
            order.siteLocation,
            order.serviceType,
            order.budget,
            order.requiredServiceDate,
        )
    ):
        raise HTTPException(
            422,
            "siteLocation, serviceType, budget, and requiredServiceDate are required",
        )

    result = await vendor_search(order)
    selected_vendors = [
        vendor.model_copy(update={"vendorState": "AWAITING_RESPONSE"})
        for vendor in result.vendors[:5]
    ]
    if not selected_vendors:
        raise HTTPException(404, "No vendors found")
    work_order, vendors = _persist_work_order_vendors(order, selected_vendors)
    response = WorkOrderResponse(
        work_order_id=work_order["work_order_id"],
        vendors=[
            vendor.model_copy(update={"id": saved["vendor_id"]})
            for vendor, saved in zip(selected_vendors, vendors, strict=True)
        ]
    )
    vendor = random.choice(vendors)
    background_tasks.add_task(
        generate_response,
        order.outreachMessage,
        vendor["vendor_id"],
        work_order["work_order_id"],
    )
    return response


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
                    else (
                        "Concise vendor trade inferred from the user's problem, such "
                        "as Janitor, Plumber, HVAC, Electrical, Locksmith, Pest "
                        "Control, or another best-fitting trade; empty if the problem "
                        "is not known."
                    )
                    if name == "serviceType"
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
