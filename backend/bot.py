import asyncio
import urllib.parse
import os
from datetime import date
from geopy.geocoders import Nominatim
from geopy.location import Location
from typing import cast
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
Ask one short follow-up question at a time until you know the site location, problem,
budget, and required service date. Keep spoken replies brief and natural. Infer
serviceType yourself from the problem described; do not ask the user to choose it.
Use the concise vendor trade that should handle the work, such as Janitor, Plumber,
HVAC, Electrical, Locksmith, Pest Control, or another best-fitting trade.
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
never invent details. Infer serviceType yourself from the user's description; do not
ask the user to choose it. Use the concise vendor trade that should handle the work,
such as Janitor, Plumber, HVAC, Electrical, Locksmith, Pest Control, or another
best-fitting trade. Addresses must use "Street Number Street Name, City State ZIP".
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


firecrawl = Firecrawl(api_key=os.environ.get("FIRECRAWL_API_KEY", ""))

# _vendor_cache: dict[str, dict] = {}  # ponytail: in-process cache, cleared on restart
# _vendor_in_flight: dict[str, asyncio.Task] = {}  # dedupe concurrent identical requests
# _VENDOR_SCHEMA = VendorSearchResponse.model_json_schema()
#
# # ponytail: hardcoded mocks, regenerate if the schema changes
# _MOCK_VENDORS = {
#     "vendors": [
#         {"name": "Sunbelt Mechanical Services", "contactInfo": "(602) 555-0142 · 4120 E Broadway Rd, Phoenix AZ 85040 · sunbeltmech.com", "reviewScore": "A+ BBB rating · 4.9/5 (312 reviews)", "avgCost": "$9,500", "distanceMiles": 2.4},
#         {"name": "Desert Climate Pros", "contactInfo": "(480) 555-0118 · 2200 W Guadalupe Rd, Mesa AZ 85202 · desertclimatepros.com", "reviewScore": "A+ BBB rating · 4.8/5 (248 reviews)", "avgCost": "$11,200", "distanceMiles": 5.1},
#         {"name": "Valley HVAC Specialists", "contactInfo": "(602) 555-0177 · 815 N 7th Ave, Phoenix AZ 85007 · valleyhvac.com", "reviewScore": "A BBB rating · 4.7/5 (189 reviews)", "avgCost": "$8,800", "distanceMiles": 6.8},
#         {"name": "Premier Commercial Refrigeration", "contactInfo": "(623) 555-0156 · 9701 W Camelback Rd, Glendale AZ 85305 · premiercommref.com", "reviewScore": "A+ BBB rating · 4.7/5 (164 reviews)", "avgCost": "", "distanceMiles": 9.3},
#         {"name": "Arizona Air & Energy", "contactInfo": "(480) 555-0193 · 1450 E Indian School Rd, Scottsdale AZ 85251 · azairenergy.com", "reviewScore": "A BBB rating · 4.6/5 (411 reviews)", "avgCost": "$12,400", "distanceMiles": 11.7},
#         {"name": "Copperline Mechanical", "contactInfo": "(602) 555-0164 · 320 E Buckeye Rd, Phoenix AZ 85004 · copperlinemech.com", "reviewScore": "A BBB rating · 4.5/5 (97 reviews)", "avgCost": "$10,150", "distanceMiles": 14.2},
#         {"name": "Saguaro Service Co.", "contactInfo": "(480) 555-0109 · 6310 E Thomas Rd, Scottsdale AZ 85251 · saguaroservice.com", "reviewScore": "A BBB rating · 4.5/5 (76 reviews)", "avgCost": "", "distanceMiles": 16.0},
#         {"name": "Cactus State HVAC", "contactInfo": "(623) 555-0131 · 5050 N 35th Ave, Phoenix AZ 85017 · cactusstatehvac.com", "reviewScore": "B+ BBB rating · 4.3/5 (58 reviews)", "avgCost": "$7,900", "distanceMiles": 17.8},
#         {"name": "Mesa Climate Control", "contactInfo": "(480) 555-0175 · 1230 S Country Club Dr, Mesa AZ 85210 · mesaclimate.com", "reviewScore": "B+ BBB rating · 4.2/5 (44 reviews)", "avgCost": "$9,000", "distanceMiles": 18.9},
#         {"name": "Phoenix Mechanical Group", "contactInfo": "(602) 555-0186 · 7707 N Black Canyon Hwy, Phoenix AZ 85021 · phxmechgroup.com", "reviewScore": "B BBB rating · 4.0/5 (29 reviews)", "avgCost": "", "distanceMiles": 19.6},
#     ],
# }



geolocator = Nominatim(user_agent="tavi-hackathon")

@app.post("/api/vendor-search", response_model=VendorSearchResponse)
async def vendor_search(order: WorkOrder) -> VendorSearchResponse:
    if not order.siteLocation or not order.serviceType:
        raise HTTPException(422, "siteLocation and serviceType are required")

    address_string = order.siteLocation

    location = cast(Location | None, geolocator.geocode(address_string))

    # 2. Define the base URL
    base_url = "https://www.bbb.org/search"


    if not location:
        raise HTTPException(status_code=403)
        
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
        "touched": "4"
    }

    # 4. Generate the final, safe URL
    final_url = f"{base_url}?{urllib.parse.urlencode(params)}"



    data = firecrawl.scrape(
        final_url, 
        formats=[{
            "type": "json", 
            "schema": VendorSearchResponse, 
            "prompt": "I just want a simple JSON object in the aforementioned schema"
        }]
    )

    search_result = data.json

    return VendorSearchResponse.model_validate(search_result)


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
