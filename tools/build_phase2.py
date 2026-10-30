"""Build the participant rulebook (Markdown + 2-page PDF) from scenario.json parameters.

Usage: python -I tools/build_phase2.py
"""
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parent.parent
SCN = json.loads((ROOT / "app" / "src" / "scenario" / "scenario.json").read_text(encoding="utf-8"))
P = SCN["params"]
RV = P["referenceValue"]
MM = P["marketMaker"]
R7 = SCN["rounds"][6].get("marketMaker", MM)
OUT = ROOT / "docs" / "phase-2-documentation"
OUT.mkdir(parents=True, exist_ok=True)
forecast_rounds = [str(r["round"]) for r in SCN["rounds"] if r.get("forecast")]
trade_min = P["tradingSeconds"] // 60
trade_sec = P["tradingSeconds"] % 60

# Content: list of (heading, [paragraph or ("table", rows) or ("bullets", [...])])
SECTIONS = [
    ("1. Your objective", [
        f"Finish Round {P['rounds']} with the <b>highest portfolio equity</b>. Every team starts with exactly "
        f"<b>{P['startingCapital']:,} credits</b>: a holding worth about {P['endowmentPerStock']:,} credits in each of the ten stocks, plus cash "
        f"(about {P['startingCash']:,}). The ten companies are fictional. Real-world news cannot help you.",
        "<b>Equity = cash + sum of (shares held x reference value)</b>. Return % = (equity - starting capital) / starting capital.",
    ]),
    ("2. How a round works", [
        ("table", [["Phase", "Length", "What happens"],
                   ["News", f"{P['newsSeconds']} s", "Public news is released to everyone. Your team may also receive private intelligence."],
                   ["Trading", f"{trade_min}:{trade_sec:02d}", "Place, modify and cancel orders. Trades execute in the central order book."],
                   ["Settlement", f"{P['settleSeconds']} s", "Trading stops. All open orders are cancelled, reference values are published and portfolios are marked."]]),
        f"There are {P['rounds']} rounds of 4 minutes each. The server clock controls everything; the countdown on your screen is the official time. "
        "Orders cannot be placed, edited or cancelled after the cutoff.",
    ]),
    ("3. Two prices: do not confuse them", [
        "<b>Last traded price</b>: the price of the most recent actual trade. It is a fact about one trade, not proof you could sell everything at that price.",
        "<b>Reference value (RV)</b>: the official end-of-round valuation used to score <i>every</i> team. It follows each company's hidden economic "
        f"fundamentals, plus a small, capped pull toward the round's traded prices: RV = F + {RV['weight']} x (VWAP - F), with the pull capped at "
        f"{RV['capPct']}% of F (so trading can move RV by at most {RV['weight'] * RV['capPct']:.1f}%). The pull only applies if the round had at least "
        f"{RV['minVolumeShares']} shares traded in {RV['minTrades']}+ trades involving {RV['minDistinctTeams']}+ different teams. "
        "One small trade at an extreme price cannot change your score. Unfilled orders never affect RV.",
    ]),
    ("4. Orders", [
        ("bullets", [
            "<b>Limit order</b>: buy at or below your price, or sell at or above it. Any unfilled part rests in the book until filled, cancelled, or the round ends.",
            f"<b>Market order</b>: executes immediately against resting orders at the best available prices, but only within "
            f"{P['marketOrderCollarPct']}% of the best price at the moment you submit. Anything not filled at once is cancelled. "
            "Execution is not guaranteed; the ticket tells you whether you were fully filled, partially filled or unfilled.",
            "<b>Modify</b>: reducing quantity keeps your place in the queue. Changing the price or increasing quantity sends the order to the back of the queue (it may also trade immediately).",
            "<b>Cancel</b>: removes the unfilled part of a resting order.",
            "<b>Matching</b>: best price first; at the same price, the earliest order first. Trades execute at the resting order's price.",
            "<b>Self-trades</b>: if your new order would trade with your own resting order, your resting order is cancelled instead.",
        ]),
    ]),
    ("5. Limits (identical for every team)", [
        ("bullets", [
            "No short selling, no borrowing, no leverage. You can only sell shares you own, and only buy with cash you have. Open orders reserve the cash or shares they need.",
            f"Maximum buy order value: {P['maxBuyOrderNotional']:,} credits per order. Sell orders have no value limit, and there is no limit on total trading in a round. Maximum open orders: {P['maxOpenOrders']}.",
            f"Position limit: up to {P['maxPositionValuePerStock']:,} credits per stock at its starting price (shown as a share limit in the terminal; includes open buy orders).",
            f"Limit prices must be within ±{P['limitPriceBandPct']}% of the stock's reference value at the start of the round.",
            f"Up to {P['rateLimit']['count']} order actions per {P['rateLimit']['windowSeconds']} seconds. Double clicks are recognised and executed only once.",
        ]),
    ]),
    ("6. Liquidity: the market maker", [
        f"An automated, rule-based market maker always quotes in every stock so you can trade even when other teams are not. Each round it quotes "
        f"{MM['levels']} price levels on each side, starting {MM['halfSpreadPct']}% either side of a mid price, each level worth about {MM['levelNotional']:,} credits. "
        f"Its mid starts at the round's opening RV and moves {MM['skewPctPer10k']}% for every 10,000 credits that teams net-buy from it (or down when they sell), "
        f"up to ±{MM['maxSkewPct']}%. It does not know the future and cannot be identified in the book. "
        f"<b>Pre-announced: in Round 7, liquidity is reduced</b> (spread {R7['halfSpreadPct']}%, {R7['levels']} levels of {R7['levelNotional']:,} credits, "
        f"moves {R7['skewPctPer10k']}% per 10,000). Market orders may fill at worse prices or only partly.",
    ]),
    ("7. Information", [
        ("bullets", [
            "<b>Public news</b>: the same bulletin for all teams each round. It can be ambiguous; work out who wins and who loses.",
            "<b>Private intelligence</b>: your team may receive signals others do not. Each shows its source (Market chatter / Industry contact / Analyst research) "
            "and a stated reliability. Signals may be accurate, incomplete, outdated or misleading. Signals are allocated by a fixed plan prepared before the event.",
            f"<b>Research credits</b>: {P['researchCredits']} for the whole event, separate from cash. Spend 1 credit to buy a verification item "
            "(second source, supply-chain check, extra indicator). Research reduces uncertainty; it never reveals future prices.",
            "<b>Order book and trade tape</b>: anonymous. You can see resting orders and executed trades, never who placed them. A big order may be conviction, a hedge, a mistake or a bluff.",
        ]),
    ]),
    ("8. Forecasts (separate award)", [
        f"Before Rounds {', '.join(forecast_rounds)} you may predict whether one named stock's RV will finish the round higher or lower. "
        f"Forecasts lock when trading opens and score {P['forecastPoints']} point each if correct. Forecast points decide the Best Forecaster award only; they never change equity or rank.",
    ]),
    ("9. Winning and tie-breaks", [
        "Final ranking is by equity after Round 10 settles. Ties are broken by: (1) higher realised profit from completed trades, (2) lower maximum drawdown "
        "(largest fall from a peak in round-end equity), (3) higher cash.",
    ]),
    ("10. Fair play", [
        ("bullets", [
            "One device and one active session per team. No communication with other teams during trading. Trade only through your own account.",
            "Do not exploit software bugs or try to access data outside your interface; report bugs to technical support.",
            "The scenario, signal plan and rules are locked before Round 1 and are the same for everyone. Organisers never change outcomes during the event; every administrative action is logged.",
            "Technical problems: the organiser may pause the market (the clock stops). If a failure makes a round unreliable, that round may be voided and replayed from its starting positions. "
            "After a server restart the market is paused and resumes with at least 30 seconds remaining.",
            "Aggressive, contrarian and clever trading within these rules is encouraged.",
        ]),
    ]),
    ("11. The ten stocks", [
        ("table", [["Ticker", "Company", "Sector", "Start", "Volatility", "Known links"]] +
                  [[s["ticker"], s["name"], s["sector"], f"{s['startPrice']}", s["volatility"], s["links"]] for s in SCN["stocks"]]),
        "Typical round-to-round RV moves are within ±10%; 'Very high' stocks can move ±20% on a major event.",
    ]),
    ("12. The terminal at a glance", [
        ("bullets", [
            "<b>Top bar</b>: round, phase and countdown; your equity, return, available cash (cash not reserved by open orders) and rank after the last round.",
            "<b>Watchlist</b> (left): RV, last trade and RV change for each stock. Click a stock to load it. Public news is below.",
            "<b>Centre</b>: the stock's RV history, the anonymous order book (click a price to copy it into the ticket), the order ticket, and tabs for "
            "Holdings, Open orders (modify / cancel), My trades and Round history.",
            "<b>Right</b>: your private intelligence, research purchases, the forecast question and the anonymous trade tape.",
            "If your screen says <i>reconnecting</i>, wait: the terminal restores itself. If you are signed out, ask technical support; staff never give trading advice.",
        ]),
    ]),
]

TAGLINE = "Make the rules clear. Make the information uncertain. Make the consequences matter."


def to_md():
    lines = ["# The Information War — Participant Rulebook", "", f"*{TAGLINE}*", ""]
    strip = lambda s: s.replace("<b>", "**").replace("</b>", "**").replace("<i>", "*").replace("</i>", "*")
    for heading, items in SECTIONS:
        lines += [f"## {heading}", ""]
        for it in items:
            if isinstance(it, tuple) and it[0] == "table":
                rows = it[1]
                lines.append("| " + " | ".join(rows[0]) + " |")
                lines.append("|" + "---|" * len(rows[0]))
                for r in rows[1:]:
                    lines.append("| " + " | ".join(r) + " |")
                lines.append("")
            elif isinstance(it, tuple) and it[0] == "bullets":
                lines += [f"- {strip(b)}" for b in it[1]] + [""]
            else:
                lines += [strip(it), ""]
    (OUT / "participant-rulebook.md").write_text("\n".join(lines), encoding="utf-8")


def to_pdf():
    ink = colors.HexColor("#0b1f33")
    accent = colors.HexColor("#b7791f")
    base = ParagraphStyle("b", fontName="Helvetica", fontSize=8.3, leading=10.4, textColor=ink, spaceAfter=2.5)
    bullet = ParagraphStyle("bl", parent=base, leftIndent=9, bulletIndent=1, spaceAfter=1.5)
    h = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=accent, spaceBefore=5, spaceAfter=2)
    title = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=19, leading=22, textColor=ink, alignment=TA_CENTER)
    sub = ParagraphStyle("s", parent=base, alignment=TA_CENTER, fontName="Helvetica-Oblique", fontSize=9)
    cell = ParagraphStyle("c", parent=base, fontSize=7.8, leading=9.4, spaceAfter=0)
    story = [Paragraph("THE INFORMATION WAR", title), Paragraph("Participant Rulebook · Trading floor simulation · 10 rounds · 48 minutes", sub),
             Paragraph(TAGLINE, sub), Spacer(1, 4)]
    for heading, items in SECTIONS:
        block = [Paragraph(heading, h)]
        for it in items:
            if isinstance(it, tuple) and it[0] == "table":
                rows = [[Paragraph(f"<b>{c}</b>" if i == 0 else c, cell) for c in r] for i, r in enumerate(it[1])]
                widths = [22 * mm, 16 * mm, 142 * mm] if len(it[1][0]) == 3 else [13 * mm, 38 * mm, 34 * mm, 11 * mm, 16 * mm, 68 * mm]
                t = Table(rows, colWidths=widths, repeatRows=1)
                t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c8d0da")), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2f6")),
                                       ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
                block += [t, Spacer(1, 3)]
            elif isinstance(it, tuple) and it[0] == "bullets":
                block += [Paragraph(b, bullet, bulletText="•") for b in it[1]]
            else:
                block.append(Paragraph(it, base))
        story.append(KeepTogether(block))

    def footer(c, doc):
        c.saveState()
        c.setFont("Helvetica", 7)
        c.setFillColor(colors.HexColor("#6b7785"))
        c.drawString(15 * mm, 9 * mm, f"The Information War · Rulebook v{SCN['meta']['version']} · All teams play under identical rules")
        c.drawRightString(195 * mm, 9 * mm, f"Page {doc.page}")
        c.restoreState()

    doc = SimpleDocTemplate(str(OUT / "participant-rulebook.pdf"), pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=12 * mm, bottomMargin=14 * mm,
                            title="The Information War — Participant Rulebook", author="Event organisers")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    to_md()
    to_pdf()
    from pypdf import PdfReader
    print("pages:", len(PdfReader(str(OUT / "participant-rulebook.pdf")).pages))
