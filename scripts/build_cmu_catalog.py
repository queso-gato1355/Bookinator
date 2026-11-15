#!/usr/bin/env python3
"""Build the runtime catalog for the CMU "Core" pack from validated matrix responses.

    python3 scripts/build_cmu_catalog.py --limit 100      # consider the first 100 priority records

Reads   <pack>/data/priority_500.jsonl, <pack>/questions_64.json, data/cmu/responses/*.json
Writes  src/data/cmu.catalog.json     compact runtime catalog: PLAYABLE books only, no plot text, no quotes
        data/cmu/coverage_report.json every imported record with its status and the reason

Four different numbers, never to be confused:
  imported   source records considered (evidence only)
  labelled   records with a validated question matrix (machine-made, exact-quote checked)
  reviewed   records with at least one human-reviewed cell (0 until someone reviews)
  playable   records the engine can tell apart from every other playable book (the gate below)

Playability gate, applied in priority order (greedy):
  1. at least --min-supported supported cells on active questions, and
  2. against every already-playable book, in BOTH directions: if a reader answers Yes/No exactly as
     book A's supported labels say (one question per correlation group, as the engine asks them),
     A's likelihood beats B's by at least the engine's guess ratio (4x).
A book that fails is still imported and labelled; it is just not offered as a game target.
The gate is a necessary condition measured on the labels themselves, not a measured success rate:
run the simulator on the output, and playtest with people, before claiming anything more.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cmu_labels import RESPONSES, ROOT, pack_dir, read_jsonl  # noqa: E402
from merge_research import pack_root as research_root  # noqa: E402

LANG = {"English": "en", "French": "fr", "Spanish": "es", "Russian": "ru", "German": "de", "Japanese": "ja",
        "Korean": "ko", "Italian": "it", "Swedish": "sv", "Portuguese": "pt", "Chinese": "zh", "Norwegian": "no",
        "Danish": "da", "Dutch": "nl", "Czech": "cs", "Polish": "pl", "Hebrew": "he", "Greek": "el"}

# Mirrors DEFAULT_CHANNEL / guessMinRatio in src/engine/config.ts (tests/test_cmu.py checks they agree).
CH_YES = {"yes": 0.55, "no": 0.05}
CH_NO = {"yes": 0.05, "no": 0.55}
GUESS_RATIO = 4.0
UNDETERMINED = "und"  # ISO 639-2 "undetermined": the pack deliberately leaves original language unresolved

CREDITS = "Book evidence: CMU Book Summary Corpus (Bamman & Smith, 2013) and current Wikipedia articles / Wikipedia contributors, CC BY-SA; metadata: goodbooks-10k (Zygmunt Zając, 2017), CC BY-SA 4.0; Wikidata, CC0; Nobel Prize API. Details: data/cmu/ATTRIBUTION.md, data/research/ATTRIBUTION.md"


def lik(x: float, answer: str) -> float:
    return x * CH_YES[answer] + (1 - x) * CH_NO[answer]


def advantage(a: dict[str, float], b: dict[str, float], group: dict[str, str]) -> float:
    """log likelihood ratio in favour of A when answers follow A's supported labels, best question per group."""
    best: dict[str, float] = {}
    for qid, x in a.items():
        ans = "yes" if x > 0.5 else "no"
        llr = math.log(lik(x, ans) / lik(b.get(qid, 0.5), ans))
        g = group[qid]
        best[g] = max(best.get(g, -math.inf), llr)
    return sum(best.values())


# ------------------------------------------------------------------ AI-recall labels
AI_RECALL = ROOT / "data" / "ai_recall" / "labels.txt"
RECALL_VALUE = {"Y": 0.9, "y": 0.7, "n": 0.3, "N": 0.1}
# A question is "unreliable" when labellers answering the same books agree on it less than this often
# (over at least RELIABILITY_MIN_N shared cells). This is a data-quality rule, not an engine threshold.
RELIABILITY_MIN_AGREE = 0.75
RELIABILITY_MIN_N = 30


def read_recall_file(path: Path, qids: set[str], books: set[str]) -> dict[tuple[str, str], float]:
    """One labeller's file: `book_id | title | tokens`, tokens like 01Y 13N m01n (see labels.txt header)."""
    out: dict[tuple[str, str], float] = {}
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        bid, _title, tokens = (x.strip() for x in line.split("|", 2))
        if ":" not in bid:
            bid = "cmu:enwiki:" + bid
        if bid not in books:
            sys.exit(f"{path.name} line {n}: unknown book {bid}")
        for tok in tokens.split():
            qid, code = ("q" + tok[:-1]) if tok[0].isdigit() else tok[:-1], tok[-1]
            if qid not in qids or code not in RECALL_VALUE or (bid, qid) in out:
                sys.exit(f"{path.name} line {n}: bad or repeated token {tok!r}")
            out[(bid, qid)] = RECALL_VALUE[code]
    return out


def merge_ai_recall(cells: dict[str, list[dict]], qids: set[str]) -> dict | None:
    """Fill UNKNOWN cells from AI-recall files in data/ai_recall/ (labels.txt = Claude; any other *.txt = another
    labeller, named after the file, e.g. gpt.txt). Rules, per cell:
      * labellers disagree with each other           -> no recall answer (unknown unless a sourced label exists)
      * labellers agree                              -> the strongest of their values
      * recall agrees with a sourced label           -> the sourced label is kept
      * recall disagrees with a sourced label        -> unknown
    Agreement rates (vs sourced labels, and between labellers) are reported as checks. None is a human review."""
    files = sorted(AI_RECALL.parent.glob("*.txt"), key=lambda f: (f.name != "labels.txt", f.name))
    if not files:
        return None
    books = set(cells)
    per = {("claude" if f.name == "labels.txt" else f.stem): read_recall_file(f, qids, books) for f in files}
    stats: dict = {"labellers": {name: {"answers": len(v), "agree_with_sourced": 0, "conflict_with_sourced": 0}
                                 for name, v in per.items()}}
    # Question-level reliability: where labellers answer the same cells, how often do they agree per question?
    # A question they often disagree on is being read differently, so a lone labeller's answer is not trusted.
    pair_agree: dict[str, list[int]] = {}
    if len(per) > 1:
        for key in {k for v in per.values() for k in v}:
            vals = [v[key] for v in per.values() if key in v]
            if len(vals) > 1:
                same = not (any(x > 0.5 for x in vals) and any(x < 0.5 for x in vals))
                pair_agree.setdefault(key[1], [0, 0])[0 if same else 1] += 1
    unreliable = {q for q, (a, d) in pair_agree.items() if a + d >= RELIABILITY_MIN_N and a / (a + d) < RELIABILITY_MIN_AGREE}
    stats["unreliable_questions"] = {q: {"agree": pair_agree[q][0], "disagree": pair_agree[q][1],
                                         "rule": "single-labeller answers dropped; agreed answers kept"}
                                     for q in sorted(unreliable)}
    single_dropped = 0
    cross_agree = cross_conflict = added = agree = conflict = 0
    conflicts = []
    keys = sorted({k for v in per.values() for k in v})
    for bid, qid in keys:
        vals = {name: v[(bid, qid)] for name, v in per.items() if (bid, qid) in v}
        known = next((c["p_yes"] for c in cells[bid] if c["question_id"] == qid and c["p_yes"] != 0.5), None)
        for name, v in vals.items():
            if known is not None:
                k = "agree_with_sourced" if (known - 0.5) * (v - 0.5) > 0 else "conflict_with_sourced"
                stats["labellers"][name][k] += 1
        if len(vals) > 1:
            if any(v > 0.5 for v in vals.values()) and any(v < 0.5 for v in vals.values()):
                cross_conflict += 1
                continue  # the labellers disagree: no recall answer for this cell
            cross_agree += 1
        elif qid in unreliable:
            single_dropped += 1
            continue  # only one labeller answered a question the labellers read differently
        v = max(vals.values(), key=lambda x: abs(x - 0.5))
        if known is not None:
            if (known - 0.5) * (v - 0.5) > 0:
                agree += 1
            else:
                conflict += 1
                conflicts.append({"book_id": bid, "question_id": qid, "sourced": known, "ai_recall": vals,
                                  "resolution": "set to unknown (0.5)"})
                cells[bid] = [c for c in cells[bid] if c["question_id"] != qid or c["p_yes"] == 0.5]
            continue
        cells[bid].append({"question_id": qid, "p_yes": v, "status": "ai_recall", "source_id": None,
                           "evidence_quote": None, "premise_safe": True, "reviewed": False})
        added += 1
    for name, st in stats["labellers"].items():
        n = st["agree_with_sourced"] + st["conflict_with_sourced"]
        st["agreement_with_sourced"] = round(st["agree_with_sourced"] / n, 3) if n else None
    checked = agree + conflict
    stats.update({"cells_added": added, "checked_against_sourced_labels": checked, "agree": agree, "conflict": conflict,
                  "agreement_rate": round(agree / checked, 3) if checked else None,
                  "between_labellers": {"agree": cross_agree, "disagree_dropped": cross_conflict,
                                        "single_labeller_on_unreliable_question_dropped": single_dropped},
                  "conflicts": conflicts,
                  "note": "Recall vs sourced: on conflict the cell becomes unknown. Labellers disagreeing: no recall "
                          "answer. Agreement is with AI-drafted sourced labels, not a human check."})
    return stats


# ------------------------------------------------------------------ series grouping
SERIES_TAG = re.compile(r"\((.+?),?\s*#(\d+(?:\.\d+)?)\)\s*$")
SERIES_ALIAS = {"Hitchhiker's Guide": "Hitchhiker's Guide to the Galaxy"}


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def group_series(records: list[dict], cells: dict[str, list[dict]], quarantine: dict) -> tuple[dict, list[dict]]:
    """Series with ≥2 in-scope volumes become ONE target (the reader then picks the volume from a list).
    Series membership comes from the goodbooks title tag "(Series, #n)" in the source record."""
    by_series: dict[str, list[tuple[float, int, dict]]] = {}
    for i, r in enumerate(records):
        if r["id"] in quarantine or not r["authors"] or r["id"] not in cells:
            continue
        for a in r["aliases"]:
            m = SERIES_TAG.search(a)
            if m:
                name = SERIES_ALIAS.get(m.group(1).strip(), m.group(1).strip())
                by_series.setdefault(name, []).append((float(m.group(2)), i, r))
                break
    series_of: dict[str, str] = {}
    out: list[dict] = []
    for name, vols in sorted(by_series.items()):
        if len(vols) < 2:
            continue
        vols.sort(key=lambda v: (v[0], v[1]))
        sid = "series:" + slug(name)
        per_q: dict[str, list[dict]] = {}
        for _n, _i, r in vols:
            for c in cells[r["id"]]:
                if c["p_yes"] != 0.5:
                    per_q.setdefault(c["question_id"], []).append(c)
        combined = []
        for qid, cs in per_q.items():
            if qid == "q54":  # "first book in its series?" depends on which volume the reader means
                continue
            vals = [c["p_yes"] for c in cs]
            if any(v > 0.5 for v in vals) and any(v < 0.5 for v in vals):
                continue  # volumes disagree: unknown for the series
            mean = sum(vals) / len(vals)
            p = (0.9 if mean >= 0.8 else 0.7) if mean > 0.5 else (0.1 if mean <= 0.2 else 0.3)
            src = next((c for c in cs if c.get("source_id")), cs[0])
            combined.append({"question_id": qid, "p_yes": p, "status": src.get("status", "supported"),
                             "source_id": src.get("source_id"), "evidence_quote": src.get("evidence_quote"),
                             "premise_safe": True, "reviewed": all(c["reviewed"] for c in cs)})
        cells[sid] = combined
        authors = sorted({a for _n, _i, r in vols for a in r["authors"]})
        out.append({
            "id": sid, "title": name if re.search(r"\bseries$", name, re.I) else f"{name} series", "title_ko": None, "authors": authors,
            "aliases": [r["title"] for _n, _i, r in vols], "original_language": None,
            "original_language_claim": next((r.get("original_language_claim") for _n, _i, r in vols), None),
            "first_publication_year": None, "rank": min(i for _n, i, _r in vols),
            "sources": list({s["id"]: s for _n, _i, r in vols for s in r["sources"]}.values()),  # unique ids
            "volumes": [{"id": r["id"], "title": r["title"], "number": n} for n, _i, r in vols],
        })
        for _n, _i, r in vols:
            series_of[r["id"]] = sid
    return series_of, out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pack")
    ap.add_argument("--catalog", default="priority_500.jsonl")
    ap.add_argument("--limit", type=int, required=True, help="number of priority records to import (5, 100, 500 ...)")
    ap.add_argument("--labels", choices=["cmu", "research"], default="research",
                    help="cmu: this project's own responses only; research: data/research/merged_labels.json "
                         "(researched 500-book matrix merged with ours, see scripts/merge_research.py)")
    ap.add_argument("--research")
    ap.add_argument("--no-motifs", action="store_true", help="leave out the motif questions (data/motifs/)")
    ap.add_argument("--no-series", action="store_true", help="keep series volumes as separate targets")
    ap.add_argument("--no-ai-recall", action="store_true", help="leave out data/ai_recall/labels.txt")
    ap.add_argument("--gate", choices=["llr", "none"], default="llr",
                    help="llr: pairwise likelihood-ratio gate here; none: emit every candidate that passes the basic "
                         "checks and let scripts/gate_catalog.ts prune it with the real engine")
    ap.add_argument("--min-supported", type=int, default=6)
    ap.add_argument("--version")
    ap.add_argument("--out", default="src/data/cmu.catalog.json")
    ap.add_argument("--report", default="data/cmu/coverage_report.json")
    args = ap.parse_args()

    pack = pack_dir(args.pack)
    quarantine: dict[str, str] = {}
    if args.labels == "research":
        rpack = research_root(args.research)
        records = read_jsonl(rpack / "data" / "priority_500_researched.jsonl")[: args.limit]
        quarantine = {q["book_id"]: q["form_reason"] for q in
                      json.loads((rpack / "reports" / "form_quarantine.json").read_text(encoding="utf-8"))}
    else:
        records = read_jsonl(pack / "data" / args.catalog)[: args.limit]
    pack_q = json.loads((pack / "questions_64.json").read_text(encoding="utf-8"))
    bank = {q["id"]: q for q in json.loads((ROOT / "data" / "question_bank.json").read_text(encoding="utf-8"))["questions"]}
    if [q["id"] for q in pack_q] != list(bank):
        sys.exit("question ids differ between the pack and data/question_bank.json")

    questions = []
    for q in pack_q:
        b = bank[q["id"]]
        row = {"id": q["id"], "category": b.get("category", q["category"]), "group": b["group"],
               "recallability": q["recallability"], "adaptation_sensitive": b["adaptation_sensitive"],
               "text": q["text"], "definition": q["definition"]}
        if b.get("active") is False:
            row["active"] = False
            row["inactive_reason"] = b.get("inactive_reason", "inactive in the app's question bank")
        questions.append(row)
    motif_q = ROOT / "data" / "motifs" / "motif_questions.json"
    use_motifs = args.labels == "research" and not args.no_motifs and motif_q.exists()
    if use_motifs:  # concrete-story-element questions (scripts/motif_labels.py), positive labels only
        questions += [{k: q[k] for k in ("id", "category", "group", "recallability", "adaptation_sensitive", "text", "definition")}
                      for q in json.loads(motif_q.read_text(encoding="utf-8"))]
    active = {q["id"] for q in questions if q.get("active", True)}
    group = {q["id"]: q["group"] for q in questions}

    cells: dict[str, list[dict]] = {}
    label_files = ([ROOT / "data" / "research" / "merged_labels.json"] if args.labels == "research"
                   else sorted(RESPONSES.glob("books-*.json")))
    for f in label_files:
        for b in json.loads(f.read_text(encoding="utf-8"))["books"]:
            if b["book_id"] in cells:
                sys.exit(f"book {b['book_id']} appears in two responses")
            cells[b["book_id"]] = list(b["answers"])
    if use_motifs:
        for c in json.loads((ROOT / "data" / "motifs" / "motif_labels.json").read_text(encoding="utf-8"))["labels"]:
            if c["book_id"] in cells:
                cells[c["book_id"]].append({k: c[k] for k in ("question_id", "p_yes", "status", "source_id",
                                                              "evidence_quote", "premise_safe", "reviewed")})

    recall_stats = merge_ai_recall(cells, {q["id"] for q in questions}) if use_motifs and not args.no_ai_recall else None
    series_of, series_records = ({}, []) if args.no_series else group_series(records, cells, quarantine)

    playable: list[dict] = []
    vec: dict[str, dict[str, float]] = {}
    rows = []
    need = math.log(GUESS_RATIO) - 1e-9
    ranked = [(i, r) for i, r in enumerate(records)] + [(sr["rank"], sr) for sr in series_records]
    ranked.sort(key=lambda x: (x[0], 0 if x[1]["id"].startswith("series:") else 1))
    for rank, r in ranked:
        bid = r["id"]
        row = {"rank": rank, "id": bid, "title": r["title"], "authors": r["authors"],
               "labelled": bid in cells, "supported_cells": 0, "reviewed_cells": 0, "playable": False, "reason": None}
        if "volumes" in r:
            row["volumes"] = [v["id"] for v in r["volumes"]]
        rows.append(row)
        if bid in series_of:
            row["series"] = series_of[bid]
            row["reason"] = f"part of series target {series_of[bid]}"
            continue
        if bid not in cells:
            row["reason"] = "no question matrix yet (evidence only)"
            continue
        known = {c["question_id"]: c["p_yes"] for c in cells[bid] if c["p_yes"] != 0.5 and c["question_id"] in active}
        row["supported_cells"] = len(known)
        row["reviewed_cells"] = sum(1 for c in cells[bid] if c["reviewed"])
        if not r["authors"]:
            row["reason"] = "no author in the source record"
            continue
        if bid in quarantine:
            row["reason"] = f"form hold: {quarantine[bid]}"
            continue
        if len(known) < args.min_supported:
            row["reason"] = f"only {len(known)} supported cells (minimum {args.min_supported})"
            continue
        clash = None if args.gate == "none" else next((p for p in playable
                      if advantage(known, vec[p["id"]], group) < need or advantage(vec[p["id"]], known, group) < need), None)
        if clash:
            row["reason"] = f"labels cannot separate it from the higher-priority book {clash['title']!r} ({clash['id']})"
            continue
        row["playable"] = True
        vec[bid] = known
        playable.append(r)

    counts = {
        "imported_source_records": len(records),
        "labelled_with_validated_matrix": sum(r["labelled"] for r in rows if not r["id"].startswith("series:")),
        "records_with_human_reviewed_cells": sum(1 for r in rows if r["reviewed_cells"]),
        "playable_game_targets": len(playable),
        "series_targets": len(series_records),
    }
    supported_total = sum(r["supported_cells"] for r in rows)
    version = args.version or f"cmu-priority{len(records)}-v1"
    made_from = ("from Wikipedia, Wikidata and other cited sources" if args.labels == "research"
                 else "from the opening of a Wikipedia-derived plot summary")
    notice = (f"Machine-labelled, unreviewed data. {counts['imported_source_records']} source records imported; "
              f"{counts['labelled_with_validated_matrix']} have a question matrix made by AI assistants {made_from}; "
              f"the game can currently tell apart {counts['playable_game_targets']} of them. Some answers come from an AI "
              "assistant's general knowledge (no source; marked in the clues). No human has reviewed any label.")
    catalog = {
        "catalog_version": version,
        "data_status": "machine_labelled_unreviewed",
        "notice": notice,
        "credits": CREDITS,
        "coverage": counts,
        "books": [{
            "id": r["id"], "title_en": r["title"], "title_ko": r["title_ko"], "aliases": r["aliases"],
            "author": ", ".join(r["authors"]),
            "original_language": r["original_language"] or LANG.get(str(r.get("original_language_claim")), UNDETERMINED),
            "first_publication_year": r["first_publication_year"],
            "series_id": r["id"] if "volumes" in r else None, "series_number": None,
            "openlibrary_work_id": None, "editions": [],
            **({"volumes": r["volumes"]} if "volumes" in r else {}),
            "sources": [{"id": s["id"], "url": s.get("article_url") or s["url"], "license": s["license"],
                         "attribution": s.get("attribution", "")} for s in r["sources"]
                        if s["id"] in {c.get("source_id") for c in cells[r["id"]] if c["p_yes"] != 0.5}],
        } for r in playable],
        "questions": questions,
        "features": [{"book_id": r["id"], "question_id": c["question_id"], "p_yes": c["p_yes"],
                      "status": "ai_recall" if c.get("status") == "ai_recall" else "supported",
                      "source_ids": [c["source_id"]] if c.get("source_id") else [], "reviewed": c["reviewed"]}
                     for r in playable for c in cells[r["id"]] if c["p_yes"] != 0.5],
    }
    out = ROOT / args.out
    out.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    reasons = Counter((r["reason"] or "playable").split(" (cmu:")[0].split(" 'the higher")[0] for r in rows)
    grouped = Counter("playable" if r["playable"] else "not separable from a higher-priority book" if r["reason"].startswith("labels cannot")
                      else "form hold (not a novel)" if r["reason"].startswith("form hold")
                      else "grouped into a series target" if r["reason"].startswith("part of series")
                      else "too few supported cells" if r["reason"].startswith("only") else r["reason"] for r in rows)
    del reasons
    report = {
        "catalog_version": version, "source": f"{args.catalog} (first {len(records)} records)",
        "counts": counts, "supported_cells_total": supported_total,
        "supported_cells_per_labelled_book_mean": round(supported_total / max(1, counts["labelled_with_validated_matrix"]), 2),
        "books_meeting_handoff_heuristic_12_supported": sum(1 for r in rows if r["supported_cells"] >= 12),
        "gate": {"min_supported": args.min_supported, "pairwise_likelihood_ratio": GUESS_RATIO},
        "status_breakdown": dict(grouped),
        "ai_recall": recall_stats,
        "scope": "Counts of records and labels. Not a measure of factual correctness or of game success.",
        "records": rows,
    }
    (ROOT / args.report).write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({**counts, "status_breakdown": dict(grouped), "runtime_bytes": out.stat().st_size}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
