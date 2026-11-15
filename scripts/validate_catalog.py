#!/usr/bin/env python3
"""Validate a That Book catalog JSON against the data contract (build brief section 6).

    python3 scripts/validate_catalog.py src/data/fixture.catalog.json
    python3 scripts/validate_catalog.py data/catalog.full.json --bank data/question_bank.json --strict

Exit code 0 = no errors (warnings allowed unless --strict), 1 = errors found.
Stdlib only.
"""
from __future__ import annotations

import argparse
import itertools
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ALLOWED_P = {0.1, 0.3, 0.5, 0.7, 0.9}
# community_consensus: aggregated reader answers that a reviewer accepted (docs/community/DESIGN.md).
# ai_recall: an AI assistant's general knowledge of the book, no source.
STATUSES = {"supported", "ambiguous", "insufficient_evidence", "unreviewed_fixture", "community_consensus", "ai_recall", "demo_contribution"}
# machine_labelled_unreviewed: labels made by an AI assistant from quoted source text, no human review.
DATA_STATUSES = {"development_fixture", "machine_labelled_unreviewed", "production"}
PLACEHOLDERS = {"VERIFIED_URL", "RECORDED_TERMS", "TODO", "TBD", ""}
OL_WORK = re.compile(r"^OL\d+W$")


def isbn13_ok(isbn: str) -> bool:
    if not re.fullmatch(r"97[89]\d{10}", isbn):
        return False
    total = sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(isbn[:12]))
    return (10 - total % 10) % 10 == int(isbn[12])


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.info: list[str] = []

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def validate(cat: dict, bank: list[dict] | None = None) -> Report:
    r = Report()
    for key in ("catalog_version", "data_status", "books", "questions", "features"):
        if key not in cat:
            r.err(f"missing top-level key '{key}'")
    if r.errors:
        return r
    if not isinstance(cat["catalog_version"], str) or not cat["catalog_version"].strip():
        r.err("catalog_version must be a non-empty string")
    status = cat["data_status"]
    if status not in DATA_STATUSES:
        r.err(f"data_status must be one of {sorted(DATA_STATUSES)}")
    production = status == "production"

    # ---- books
    books: dict[str, dict] = {}
    source_ids: dict[str, set[str]] = {}
    for i, b in enumerate(cat["books"]):
        bid = b.get("id")
        where = f"book[{i}] {bid!r}"
        if not isinstance(bid, str) or not bid.strip():
            r.err(f"{where}: id must be a non-empty string")
            continue
        if bid in books:
            r.err(f"{where}: duplicate book id")
        books[bid] = b
        for field in ("title_en", "author", "original_language"):
            if not isinstance(b.get(field), str) or not b[field].strip():
                r.err(f"{where}: {field} must be a non-empty string")
        for field in ("title_ko", "series_id", "openlibrary_work_id"):
            if b.get(field) is not None and not isinstance(b[field], str):
                r.err(f"{where}: {field} must be a string or null")
        y = b.get("first_publication_year")
        if y is not None and (not isinstance(y, int) or not (-3000 < y < 2100)):
            r.err(f"{where}: first_publication_year must be an integer year or null")
        sn = b.get("series_number")
        if sn is not None and not isinstance(sn, (int, float)):
            r.err(f"{where}: series_number must be a number or null")
        if b.get("series_number") is not None and not b.get("series_id"):
            r.err(f"{where}: series_number set without series_id")
        olid = b.get("openlibrary_work_id")
        if olid and not OL_WORK.match(olid):
            r.err(f"{where}: openlibrary_work_id {olid!r} is not an Open Library work id (OL…W)")
        if not isinstance(b.get("aliases", []), list) or not isinstance(b.get("editions", []), list):
            r.err(f"{where}: aliases and editions must be lists")
        sids: set[str] = set()
        for s in b.get("sources", []):
            sid = s.get("id")
            if not sid or sid in sids:
                r.err(f"{where}: source ids must be present and unique (got {sid!r})")
            sids.add(sid)
            url = s.get("url", "")
            if url in PLACEHOLDERS or not str(url).startswith("https://"):
                r.err(f"{where}: source {sid} url must be a real https URL (got {url!r})")
            if str(s.get("license", "")).strip() in PLACEHOLDERS:
                r.err(f"{where}: source {sid} must record its license/terms")
        source_ids[bid] = sids
        for ed in b.get("editions", []):
            isbn = str(ed.get("isbn") or "")
            if isbn and not isbn13_ok(isbn):
                r.err(f"{where}: edition ISBN {isbn!r} is not a valid ISBN-13 (no hyphens)")
            if ed.get("source_id") and ed["source_id"] not in sids:
                r.err(f"{where}: edition {isbn} cites unknown source {ed['source_id']!r}")
        if production and not sids:
            r.err(f"{where}: production books need at least one source")

    # ---- questions
    questions: dict[str, dict] = {}
    for i, q in enumerate(cat["questions"]):
        qid = q.get("id")
        where = f"question[{i}] {qid!r}"
        if not isinstance(qid, str) or not qid:
            r.err(f"{where}: id must be a non-empty string")
            continue
        if qid in questions:
            r.err(f"{where}: duplicate question id")
        questions[qid] = q
        for field in ("text", "definition", "group"):
            if not isinstance(q.get(field), str) or not q[field].strip():
                r.err(f"{where}: {field} must be a non-empty string")
        rc = q.get("recallability")
        if not isinstance(rc, (int, float)) or not (0 < rc <= 1):
            r.err(f"{where}: recallability must be in (0, 1]")
        if not isinstance(q.get("adaptation_sensitive"), bool):
            r.err(f"{where}: adaptation_sensitive must be boolean")
        if "active" in q and not isinstance(q["active"], bool):
            r.err(f"{where}: active must be boolean")
    if bank is not None:
        bank_ids = [q["id"] for q in bank]
        if list(questions) != bank_ids:
            r.err("question ids/order differ from the question bank")
        for q in bank:
            cq = questions.get(q["id"])
            if cq and cq.get("text") != q["text"]:
                r.err(f"question {q['id']}: text differs from bank")

    # ---- features
    seen: set[tuple[str, str]] = set()
    per_book: dict[str, dict[str, float]] = defaultdict(dict)
    status_count: Counter[str] = Counter()
    unreviewed = 0
    for i, f in enumerate(cat["features"]):
        bid, qid = f.get("book_id"), f.get("question_id")
        where = f"feature[{i}] {bid}/{qid}"
        if bid not in books:
            r.err(f"{where}: unknown book")
            continue
        if qid not in questions:
            r.err(f"{where}: unknown question")
            continue
        if (bid, qid) in seen:
            r.err(f"{where}: duplicate cell")
        seen.add((bid, qid))
        p = f.get("p_yes")
        if not isinstance(p, (int, float)) or round(float(p), 6) not in ALLOWED_P:
            r.err(f"{where}: p_yes {p!r} not in {sorted(ALLOWED_P)}")
            continue
        st = f.get("status")
        status_count[st] += 1
        if st not in STATUSES:
            r.err(f"{where}: status {st!r} not allowed")
        if st in ("unreviewed_fixture", "ai_recall", "demo_contribution") and production:
            r.err(f"{where}: fixture labels are not allowed in a production catalog")
        sids = f.get("source_ids", [])
        if not isinstance(sids, list):
            r.err(f"{where}: source_ids must be a list")
            sids = []
        bad = [s for s in sids if s not in source_ids.get(bid, set())]
        if bad:
            r.err(f"{where}: source_ids {bad} not among this book's sources")
        if st == "supported" and not sids:
            r.err(f"{where}: 'supported' needs at least one source id")
        if st == "insufficient_evidence" and (p != 0.5 or sids):
            r.err(f"{where}: insufficient_evidence must have p_yes 0.5 and no sources")
        if st == "supported" and p == 0.5:
            r.warn(f"{where}: supported but p_yes 0.5")
        if st == "community_consensus":
            ref = f.get("consensus")
            if not isinstance(ref, dict) or not isinstance(ref.get("algorithm_version"), str)                     or not isinstance(ref.get("consensus_id"), int)                     or not isinstance(ref.get("contributors"), int) or ref["contributors"] < 1:
                r.err(f"{where}: community_consensus needs consensus {{algorithm_version, consensus_id, contributors>=1}}")
            if f.get("reviewed") is not True:
                r.err(f"{where}: community_consensus cells must be accepted by a reviewer (reviewed: true)")
            if p == 0.5:
                r.warn(f"{where}: community_consensus with p_yes 0.5 adds nothing")
        elif "consensus" in f:
            r.err(f"{where}: consensus provenance is only allowed on community_consensus cells")
        if not isinstance(f.get("reviewed"), bool):
            r.err(f"{where}: reviewed must be boolean")
        elif not f["reviewed"]:
            unreviewed += 1
        per_book[bid][qid] = float(p)

    # ---- coverage and separability
    active = [qid for qid, q in questions.items() if q.get("active", True)]
    for bid in books:
        known = sum(1 for qid in active if per_book[bid].get(qid, 0.5) != 0.5)
        if known < 8:
            r.warn(f"book {bid}: only {known} informative labels on active questions — hard to identify")
    vecs = {bid: tuple(per_book[bid].get(qid, 0.5) for qid in active) for bid in books}
    dists = []
    for a, b in itertools.combinations(books, 2):
        # count questions where the two books point in clearly different directions
        sep = sum(1 for x, y in zip(vecs[a], vecs[b]) if (x - 0.5) * (y - 0.5) < 0 and abs(x - y) >= 0.4)
        dists.append((sep, a, b))
        if sep == 0:
            r.warn(f"books {a} and {b} have no distinguishing labels — the engine cannot separate them")
    dists.sort()
    for sep, a, b in dists[:5]:
        r.info.append(f"closest pair: {a} vs {b} — {sep} distinguishing question(s)")

    if production and unreviewed:
        r.warn(f"{unreviewed} feature cells are not human-reviewed")
    r.info.insert(
        0,
        f"{status}: {len(books)} books, {len(questions)} questions ({len(active)} active), "
        f"{len(seen)} labeled cells, statuses {dict(status_count)}, unreviewed {unreviewed}",
    )
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("catalog", type=Path)
    ap.add_argument("--bank", type=Path, help="question_bank.json to compare against")
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    ap.add_argument("--max-warnings", type=int, default=30)
    args = ap.parse_args()
    try:
        cat = json.loads(args.catalog.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"ERROR: cannot read {args.catalog}: {e}")
        return 1
    bank = json.loads(args.bank.read_text(encoding="utf-8"))["questions"] if args.bank else None
    r = validate(cat, bank)
    for line in r.info:
        print(f"info: {line}")
    for w in r.warnings[: args.max_warnings]:
        print(f"WARNING: {w}")
    if len(r.warnings) > args.max_warnings:
        print(f"... {len(r.warnings) - args.max_warnings} more warnings")
    for e in r.errors:
        print(f"ERROR: {e}")
    failed = bool(r.errors) or (args.strict and bool(r.warnings))
    print(f"{'FAILED' if failed else 'OK'}: {len(r.errors)} error(s), {len(r.warnings)} warning(s)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
