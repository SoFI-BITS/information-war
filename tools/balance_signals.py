"""Assign private signals to intel groups so every group's information is balanced.

Each round has three signals and six groups (A-F). Every round, each signal goes
to exactly two groups, so every group receives one signal per round. This script
searches the 15 possible pairings x 6 signal orders per round to minimise:
  - the spread of each group's total "edge" (sum of impliedDirection x actual move)
  - the spread of each group's count of accurate signals
  - repeated pairings of the same two groups
The result is written back into scenario.json (signal.groups). Deterministic (seeded).

Usage: python -I tools/balance_signals.py [path/to/scenario.json]
"""
import itertools
import json
import random
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "app" / "src" / "scenario" / "scenario.json"


def matchings(items):
    if not items:
        yield []
        return
    first, rest = items[0], items[1:]
    for i, other in enumerate(rest):
        for m in matchings(rest[:i] + rest[i + 1:]):
            yield [(first, other)] + m


def edge(scn, sig):
    rnd = scn["rounds"][sig["targetRound"] - 1]
    return sig["impliedDirection"] * rnd["fundamentals"][sig["ticker"]]


def score(scn, plan, groups):
    edges = {g: 0.0 for g in groups}
    acc = {g: 0 for g in groups}
    pairs = {}
    for rnd, (matching, order) in zip(scn["rounds"], plan):
        for pair, sig_idx in zip(matching, order):
            sig = rnd["signals"][sig_idx]
            for g in pair:
                edges[g] += edge(scn, sig)
                acc[g] += sig["reliability"] == "ACCURATE"
            key = tuple(sorted(pair))
            pairs[key] = pairs.get(key, 0) + 1
    e = list(edges.values())
    a = list(acc.values())
    repeat_penalty = sum(max(0, c - 1) ** 2 for c in pairs.values())
    return (max(e) - min(e)) * 1.0 + statistics.pstdev(e) * 2 + (max(a) - min(a)) * 6 + repeat_penalty * 3, edges, acc


def main():
    scn = json.loads(PATH.read_text(encoding="utf-8"))
    groups = scn["params"]["groups"]
    all_m = list(matchings(groups))
    options = [(m, o) for m in all_m for o in itertools.permutations(range(3))]
    rng = random.Random(20261028)
    best_plan, best = None, float("inf")
    for _restart in range(40):
        plan = [rng.choice(options) for _ in scn["rounds"]]
        cur, _, _ = score(scn, plan, groups)
        improved = True
        while improved:
            improved = False
            for r in range(len(plan)):
                for opt in options:
                    trial = plan[:r] + [opt] + plan[r + 1:]
                    s, _, _ = score(scn, trial, groups)
                    if s < cur - 1e-9:
                        plan, cur, improved = trial, s, True
        if cur < best:
            best, best_plan = cur, plan
    _, edges, acc = score(scn, best_plan, groups)
    for rnd, (matching, order) in zip(scn["rounds"], best_plan):
        for pair, sig_idx in zip(matching, order):
            rnd["signals"][sig_idx]["groups"] = sorted(pair)
    PATH.write_text(json.dumps(scn, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("score", round(best, 2))
    for g in groups:
        print(f"group {g}: edge {edges[g]:+.0f}  accurate {acc[g]}/10")


if __name__ == "__main__":
    main()
