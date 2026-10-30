"""Write the briefing-period company profiles into app/src/scenario/scenario.json.

Profiles are deliberately balanced: every company gets the same fields, a mix of
strengths and exposures, and neutral "what analysts watch" questions. They must
not reveal any round's hidden state or signal truth.

    python -I tools/company_profiles.py
"""
import json
from pathlib import Path

SCENARIO = Path(__file__).resolve().parent.parent / "app" / "src" / "scenario" / "scenario.json"

PROFILES = {
    "NVTX": {
        "founded": 2004, "headquarters": "Marrenburg", "employees": "9,800",
        "revenue": "6.1bn cr", "margin": "11% operating", "debt": "Low", "dividend": "None (reinvests)",
        "revenueMix": "Handsets 58% · Wearables 24% · Home devices 18%",
        "overview": "Valdoria's best-known consumer electronics brand. Designs in-house and assembles locally, but imports most chips and displays. The new flagship handset launches this season.",
        "watch": ["Launch demand compared with previous handsets", "Prices and availability of imported components", "Interest rates: much of its value rests on future growth"],
    },
    "HBFG": {
        "founded": 1921, "headquarters": "Valdor", "employees": "14,200",
        "revenue": "3.4bn cr", "margin": "2.6% net interest margin", "debt": "Bank (41bn cr deposits)", "dividend": "4.8% yield",
        "revenueMix": "Retail banking 45% · Business lending 35% · Markets & trading 20%",
        "overview": "Third-largest bank in Valdoria. Lends to households and mid-sized companies, including renewables developers and logistics firms. Its markets division has grown quickly in recent years.",
        "watch": ["Central bank interest-rate decisions", "Loan quality among its business borrowers", "Capital buffers and regulator stress tests"],
    },
    "PTRL": {
        "founded": 1968, "headquarters": "Ashmouth", "employees": "7,400",
        "revenue": "8.9bn cr", "margin": "14% operating", "debt": "Moderate", "dividend": "5.6% yield",
        "revenueMix": "Offshore production 62% · Fuel distribution 38%",
        "overview": "Produces oil and gas from three offshore fields, the oldest of which is slowly declining, and runs a national chain of fuel depots. Has applied for new offshore licences.",
        "watch": ["Timing of the energy ministry's licence decisions", "Government energy policy, fossil fuels versus renewables", "World oil prices and the exchange rate"],
    },
    "CLVH": {
        "founded": 1997, "headquarters": "Haldane", "employees": "3,100",
        "revenue": "1.2bn cr", "margin": "Slightly loss-making (R&D is 40% of revenue)", "debt": "Low", "dividend": "None",
        "revenueMix": "Generic medicines 70% · Licensing 30% (VX-7 not yet on sale)",
        "overview": "Mid-sized drug developer. Existing generic medicines fund its research. VX-7, an arthritis treatment in late-stage trials, would be its first major branded drug.",
        "watch": ["VX-7 trial data and the regulator's decision", "How many patients VX-7 could eventually reach", "Other arthritis treatments in development"],
    },
    "MRLW": {
        "founded": 1889, "headquarters": "Valdor", "employees": "22,000",
        "revenue": "5.3bn cr", "margin": "6% operating", "debt": "Moderate", "dividend": "3.1% yield",
        "revenueMix": "Department stores 64% · Online 36%",
        "overview": "Valdoria's largest department-store chain, with 48 stores and a growing online business. About half of each year's profit is made in the holiday season.",
        "watch": ["Consumer confidence and household spending", "Holiday stock arriving on time through the Port of Ashmouth", "Online growth versus the cost of running stores"],
    },
    "FRGE": {
        "founded": 1952, "headquarters": "Kestrel Bay", "employees": "6,500",
        "revenue": "2.8bn cr", "margin": "9% operating", "debt": "Moderate", "dividend": "2.4% yield",
        "revenueMix": "Electronics parts 40% · Wind-turbine gearboxes 35% · Industrial bearings 25%",
        "overview": "Precision engineering group. Its two largest customers are Novatex and the wind-power industry, and it imports specialist steel for its bearings.",
        "watch": ["Order books at Novatex and wind-farm builders", "Supply of imported bearings and steel", "Renewable energy subsidy policy"],
    },
    "TDWL": {
        "founded": 1979, "headquarters": "Ashmouth", "employees": "8,900",
        "revenue": "2.2bn cr", "margin": "8% operating", "debt": "Moderate to high", "dividend": "3.5% yield",
        "revenueMix": "Container terminals 45% · Trucking 30% · Rail freight 25%",
        "overview": "Runs container terminals at the Port of Ashmouth, a national trucking fleet and the country's only inland rail-freight corridor. Fuel is its largest operating cost.",
        "watch": ["Fuel prices", "Trade volumes through the Port of Ashmouth", "Freight rates across port, road and rail"],
    },
    "ARCM": {
        "founded": 1991, "headquarters": "Valdor", "employees": "11,300",
        "revenue": "4.0bn cr", "margin": "12% operating (before interest)", "debt": "Very high", "dividend": "1.9% yield",
        "revenueMix": "Mobile 55% · Broadband 35% · Business services 10%",
        "overview": "Valdoria's second-largest network operator. Borrowed heavily to build its 5G network and is now bidding in the 6G spectrum auction.",
        "watch": ["The final price of 6G spectrum", "Interest rates and refinancing of its debt", "Subscriber growth and pricing"],
    },
    "GRNF": {
        "founded": 1936, "headquarters": "Brightwater", "employees": "12,600",
        "revenue": "3.7bn cr", "margin": "7% operating", "debt": "Low", "dividend": "3.8% yield",
        "revenueMix": "Grain 40% · Dairy 30% · Packaged foods 30% (about 45% exported)",
        "overview": "Farming and food group with its own farms, dairies and packaging plants. Exports a large share of what it produces through the Port of Ashmouth.",
        "watch": ["Harvest yields and the weather", "Export routes and shipping costs", "Food prices in export markets"],
    },
    "SLRD": {
        "founded": 2009, "headquarters": "Kestrel Bay", "employees": "1,900",
        "revenue": "0.9bn cr", "margin": "31% operating (before interest)", "debt": "Very high", "dividend": "2.0% yield",
        "revenueMix": "Solar 55% · Wind 45%",
        "overview": "Builds and runs solar and wind farms, financed with long-term borrowing. Part of its income comes from government subsidy contracts. Buys its gearboxes from Forgeline.",
        "watch": ["Parliament's renewable energy subsidy plans", "Interest rates", "Construction costs for new farms"],
    },
}

scn = json.loads(SCENARIO.read_text(encoding="utf8"))
for stock in scn["stocks"]:
    stock["profile"] = PROFILES[stock["ticker"]]
SCENARIO.write_text(json.dumps(scn, indent=2) + "\n", encoding="utf8", newline="\n")
print(f"profiles written for {len(scn['stocks'])} stocks")
