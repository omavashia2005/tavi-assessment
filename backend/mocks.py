#
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
#
#
#
