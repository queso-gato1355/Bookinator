#!/usr/bin/env python3
"""Motif questions: concrete, memorable story elements ("Is there a dragon?") labelled from story text.

    python3 scripts/motif_labels.py [--research <pack root>] [--show m01,m02] [--context 40]

The 64 base questions are broad, so hundreds of books share the same answers. These questions ask
about concrete things a reader remembers. Evidence comes ONLY from story text registered in the
research catalog, never from reception, background or category lines:
  * the CMU plot synopsis (source synopsis.source_id), and
  * the premise paragraph that opens the current Wikipedia article (first prose paragraph of the
    registered enwiki evidence text).

Rules (same as the research pass):
  * Labels are POSITIVE ONLY: an explicit mention in the story text gives p_yes 0.9 with an exact
    quote (≤215 characters). A summary not mentioning a dragon is NOT evidence of no dragon, so
    every other cell stays unknown (0.5) and is simply not written.
  * Each pattern was tuned against its hits, with exclusions for false matches (e.g. "Dragon Tattoo",
    "deserted"). REJECT lists (book, question) pairs an AI assistant read and rejected as a
    figurative, minor or off-story mention. No person has reviewed these labels: reviewed=false.
  * Twist-revealing motifs (who dies, who did it) are deliberately not asked.

Writes data/motifs/motif_questions.json and data/motifs/motif_labels.json.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from merge_research import pack_root  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "motifs"
MAX_QUOTE = 215

# id, question text, definition, include regex, exclude regex (tested on the ±40-char context), category
MOTIFS: list[tuple[str, str, str, str, str | None, str]] = [
    ("m01", "Does a dragon appear?", "A dragon is part of the story.", r"\bdragons?\b", r"Dragon Tattoo|dragon tattoo|Dragon Reborn|Dragonlance|dragon's teeth|Red Dragon", "creatures"),
    ("m02", "Are there vampires?", "Vampires are characters in the story.", r"\bvampir(e|es|ic|yre|yres)\b", None, "creatures"),
    ("m03", "Are there werewolves or shape-shifters?", "Characters who turn into animals (werewolves, shape-shifters) appear.", r"\bwerewol(f|ves)\b|\bshape-?shift(er|ers|ing)?\b|\bshapeshift", None, "creatures"),
    ("m04", "Are there wizards or witches?", "Wizards, witches, sorcerers or warlocks are characters.", r"\bwizards?\b|\bwitch(es)?\b|\bsorcer(er|ers|ess|y)\b|\bwarlocks?\b", r"witch.?hunt|Wizard of Oz", "creatures"),
    ("m05", "Are there angels or demons?", "Angels, demons or devils appear as beings in the story.", r"\bangels?\b|\bdemons?\b|\bdemonic\b|\bfallen angel", r"Los Angeles|City of Fallen Angels|Clockwork Angel|Angels & Demons|Angel Clare", "creatures"),
    ("m06", "Are there elves, dwarves, fairies or goblins?", "Folklore beings such as elves, dwarves, fairies, goblins or trolls appear.", r"\belf\b|\belves\b|\bdwar(f|ves|fs)\b|\bfair(y|ies)\b|\bgoblins?\b|\btrolls?\b|\bfaeries?\b|\bpixies?\b", r"fairy[- ]?tales?|fairy godmother of", "creatures"),
    ("m07", "Do gods from mythology appear?", "Gods or demigods from a mythology (Greek, Norse, ...) are characters.", r"\bdemigods?\b|\bgoddess(es)?\b|\bZeus\b|\bPoseidon\b|\bHades\b|\bAthena\b|\bOdin\b|\bApollo\b|\bOlympians?\b", None, "creatures"),
    ("m08", "Are there aliens from another world?", "Extraterrestrial beings appear.", r"\baliens?\b|\bextraterrestrial|\bMartians?\b", r"alien(ated|ation)|illegal alien", "creatures"),
    ("m09", "Are there robots or artificial intelligences?", "Robots, androids or AIs are characters.", r"\brobots?\b|\bandroids?\b|\bartificial intelligence\b|\bcyborgs?\b", None, "creatures"),
    ("m10", "Is there a murder?", "Someone is murdered or killed deliberately in the story.", r"\bmurder(s|ed|er|ers|ing|ous)?\b", None, "crime"),
    ("m11", "Is there a serial killer?", "A serial killer is part of the story.", r"\bserial killer", None, "crime"),
    ("m12", "Is someone kidnapped?", "A character is kidnapped, abducted or held captive.", r"\bkidnap|\babduct", None, "crime"),
    ("m13", "Is there a courtroom trial?", "A trial or court case takes place in the story (a lawyer character alone does not count).", r"\btrial\b|\bjury\b|\bcourtroom\b|\bcourt case\b", r"trial and error|trial run|clinical trial|Trials\b", "crime"),
    ("m14", "Are there spies or secret agents?", "Spying or secret agents are part of the story.", r"\bspy\b|\bspies\b|\bespionage\b|\bsecret agents?\b|\bCIA\b|\bKGB\b|\bMI6\b", r"spy on|spy upon|spies on", "crime"),
    ("m15", "Is there an assassin?", "An assassin or an assassination plot is part of the story.", r"\bassassin", None, "crime"),
    ("m16", "Is there a robbery or a thief?", "A theft, robbery or a thief is part of the story.", r"\bheist\b|\brobber(y|ies|s)?\b|\bthie(f|ves)\b", None, "crime"),
    ("m17", "Is a main character an orphan?", "A central character's parents are dead or unknown.", r"\borphan(s|ed|age)?\b", None, "people"),
    ("m18", "Are there twins?", "Twins are characters in the story.", r"\btwins?\b", r"Twin Peaks|twin bed|twin brother of", "people"),
    ("m19", "Does someone become pregnant?", "A pregnancy is part of the story.", r"\bpregnan(t|cy)\b", None, "people"),
    ("m20", "Is there a wedding or engagement?", "A wedding, engagement or marriage proposal happens.", r"\bwedding\b|\bengaged to\b|\bengagement to\b|\bpropos(?:es|ed) (?:marriage|to her|to him)\b|\bproposal of marriage\b|\bmarriage proposal\b|\bpropos(?:es|ed) that they marry", r"wedding band", "people"),
    ("m21", "Is there an affair?", "Infidelity or an affair is part of the story.", r"\baffair\b|\bunfaithful\b|\b(?:his|a|her husband's) mistress\b|\badulter(y|ous)\b|\binfidelity\b", r"affairs of|Wennerström affair|affair \(described|love affair", "people"),
    ("m22", "Is there a divorce?", "A divorce or separation of a married couple is part of the story.", r"\bdivorc", None, "people"),
    ("m23", "Is there a dog?", "A dog plays a part in the story.", r"\bdogs?\b|\bpuppy\b|\bpuppies\b|\bhound\b", r"Hound of God|dog-?eat-?dog|hot dog", "animals"),
    ("m24", "Are there horses?", "Horses play a part in the story.", r"\bhorses?\b|\bstallion\b|\bmare\b|\bpony\b", r"horsemen of", "animals"),
    ("m25", "Is there a cat?", "A cat plays a part in the story.", r"\bcats?\b|\bkitten\b", r"Cat's Cradle|cat and mouse", "animals"),
    ("m26", "Do wild beasts like wolves, bears or big cats feature?", "Wolves, bears, lions, tigers, sharks or whales play a part.", r"\bwol(f|ves)\b|\b(?:a|the|armou?red|polar|grizzly|cave|great|black|brown|cyborg|three) bears?\b|\blions?\b|\btigers?\b|\bsharks?\b|\bwhales?\b", r"werewol|Lion King|shark tattoo", "animals"),
    ("m27", "Is a train journey part of it?", "Characters travel by train during the story (a railway merely mentioned does not count).", r"\btrains?\b(?! (?:him|her|them|his|for|with|to|as|at|in|under|the))|\brailway\b|\brailroad\b|\bExpress\b", r"Hogwarts Express|trained|training", "places"),
    ("m28", "Is much of it on an island?", "An island is a major place in the story.", r"\bisland\b", r"Long Island|Rhode Island|Island Records", "places"),
    ("m29", "Is there a desert?", "A desert is a place in the story.", r"\b(?:the|a|into the|Texas|Mohaine|New Mexico|California|Sahara|Arabian) desert\b|\bdesert(?:-like)? (?:town|expanse|planet|world|animals|Fremen|back country|sands|island)\b", r"desert(ed|er|ion)|desert (?:the|from|his|her)", "places"),
    ("m30", "Is there a hospital?", "A hospital or asylum is a place in the story.", r"\bhospital\b|\basylum\b|\binfirmary\b|\bsanatorium\b", r"political asylum", "places"),
    ("m31", "Is much of it set in New York?", "New York City is a major setting.", r"\bNew York\b|\bManhattan\b|\bBrooklyn\b", r"New York Times|New York Post|New York Review|published in New York", "places"),
    ("m32", "Is much of it set in London?", "London is a major setting.", r"\bLondon\b", r"published in London|London Review", "places"),
    ("m33", "Is much of it set in Paris or France?", "Paris or France is a major setting.", r"\bParis\b|\bFrance\b", None, "places"),
    ("m34", "Is there a castle or palace?", "A castle or palace is a place in the story.", r"\bcastles?\b|\bpalaces?\b", r"castles in the air", "places"),
    ("m35", "Are there kings, queens or princes?", "Royalty are characters in the story.", r"\bking\b|\bqueen\b|\bprinces?\b|\bprincess(es)?\b|\bkings\b|\bqueens\b", r"Stephen King|King's (?:Landing|Cross)|Queens,|drag queen|Prince Charming|Half-Blood Prince|Prince Caspian|King James|Queen Anne's", "people"),
    ("m36", "Is there a battle or an army?", "A battle is fought or an army takes part in the story (soldiers merely present do not count).", r"\bbattles?\b|\barm(y|ies)\b", r"battle royale|Salvation Army|battle (?:with|against) (?:cancer|depression|addiction)", "conflict"),
    ("m37", "Is there a curse or a prophecy?", "A curse or a prophecy drives part of the story.", r"\bcurse[sd]?\b|\bprophec(y|ies)\b|\bprophes(y|ied)\b", None, "magic"),
    ("m38", "Does someone hide their identity?", "A character uses a disguise, false identity or impersonation.", r"\bin disguise\b|\bdisguis(?:es|ed) (?:himself|herself|themselves)\b|\bdisguised as (?:a|an|his|her) (?:man|woman|boy|girl|servant|beggar|monk|nun|peasant|soldier|musicians?)\b|\bimpersonat(?:e|es|ed|ing|or)\b|\bfalse identity\b|\bsecret identity\b|\bposing as\b|\bpretends? to be\b", None, "plot"),
    ("m39", "Does a sport or game play a part?", "A sport or game (football, chess, Quidditch, racing, ...) matters in the story.", r"\bfootball\b|\bbaseball\b|\bbasketball\b|\bsoccer\b|\btennis\b|\bboxing\b|\bboxer\b|\bhockey\b|\bQuidditch\b|\bchess\b|\bgolf\b|\brace car\b|\bcar racing\b", r"Quidditch Through the Ages", "plot"),
    ("m40", "Is there a hunt for treasure?", "A treasure or hidden fortune is sought.", r"\btreasure\b", r"treasured|Treasure Island", "plot"),
    ("m41", "Does someone lose their memory?", "Amnesia or erased memories are part of the story.", r"\bamnesi(a|ac)\b|\bmemor(y|ies) (?:wiped|erased|loss)\b|\blost (?:his|her|their) memor", None, "plot"),
    ("m42", "Are there clones or genetic engineering?", "Cloning or genetic engineering is part of the story.", r"\bclon(e|es|ed|ing)\b|\bgenetic(ally)? engineer", None, "science"),
    ("m43", "Is there cancer?", "Cancer is part of the story.", r"\bcancer\b|\bleuk(a)?emia\b|\btumou?rs?\b", None, "people"),
    ("m44", "Do drugs or drinking problems feature?", "Alcoholism, drunkenness or drug use is part of the story.", r"\balcoholi(c|sm)\b|\bdrunk(en|ard)?\b|\bdrug addict|\bdrug (?:use|dealer|deal|lord|habit)\b|\baddict(ed|ion)?\b|\bheroin\b|\bcocaine\b|\bmorphine\b", None, "people"),
    ("m45", "Is music important?", "A musician, singer, band or instrument matters in the story.", r"\bmusicians?\b|\bsingers?\b|\bguitar(?:ist)?\b|\bpian(?:o|ist)\b|\bcell(o|ist)\b|\bviolin(?:ist)?\b|\bcomposer\b|\brock band\b|\bband's\b|\bjazz\b|\borchestra\b", r"title comes from", "arts"),
    ("m46", "Is a writer or journalist a character?", "A writer, novelist, poet or journalist is a character.", r"\bwriters?\b|\bnovelists?\b|\bjournalists?\b|\breporters?\b|\bpoets?\b", r"novel by|book by|novella by|series by|work by|written by|by (?:the )?(?:\w+ )?(?:writer|novelist|journalist|poet)|writer himself|writer herself|writer of|the writers were|the writer worked|(?:American|British|English|Irish|Scottish|Canadian|Australian|Japanese|French|German|Russian|Colombian|Indian|Chilean|Swedish|Nigerian|Korean|Italian|Spanish|Czech|Norwegian) (?:writer|novelist|poet|journalist)", "people"),
    ("m47", "Is a teacher or professor a character?", "A teacher, tutor, governess or professor is a character.", r"\bteachers?\b|\bprofessors?\b|\btutors?\b|\bgoverness\b|\bheadmaster\b|\bheadmistress\b", None, "people"),
    ("m48", "Is a doctor or nurse a character?", "A doctor, nurse or surgeon is a character.", r"\bdoctors?\b|\bnurses?\b|\bsurgeon\b|\bphysician\b|\bpsychiatrist\b|\btherapist\b", r"Doctor Who|Doctor Zhivago", "people"),
    ("m49", "Is slavery part of it?", "Slavery or enslaved people are part of the story.", r"\bslave(s|ry)?\b|\benslave", r"slave to", "society"),
    ("m50", "Is there a circus, theatre or show?", "A circus, carnival, theatre or performers are part of the story.", r"\bcircus\b|\bcarnival\b(?! glass)|\bactress\b|\btroupe\b|\bplaywright\b|\btheat(?:re|er) (?:company|troupe|group)\b|\bon stage\b|\bstage play\b", r"film, television|radio, theatre|actors read|adapted|adaptation", "places"),
    ("m51", "Is there a farm?", "A farm or ranch is a place in the story.", r"\bfarms?\b|\branch\b|\bplantation\b|\bfarmer\b", None, "places"),
    ("m52", "Is there a secret society or cult?", "A secret society, cult, order or brotherhood is part of the story.", r"\bsecret society\b|\bcult\b|\bbrotherhood\b|\bOrder of the\b|\bguild\b|\bsect\b|\bPriory\b|\bIlluminati\b|\bFreemason|\bMasonic\b|\bdegree Mason\b", r"cult classic|cult following|cult film", "plot"),
]

KEEP_LEAD_CHARS = 1200


def lead_paragraph(text: str) -> str:
    """First prose paragraph after the infobox 'field: value' lines of an enwiki evidence text."""
    for para in text.split("\n\n"):
        lines = [ln for ln in para.splitlines() if ln.strip()]
        if not lines or lines[0].startswith("Article title:"):
            continue
        if all(re.match(r"^[a-z_0-9]+: ", ln) for ln in lines):
            continue
        if len(para) > 120:
            return para[:KEEP_LEAD_CHARS]
    return ""


def quote_around(text: str, start: int, end: int) -> str:
    lo = max(0, start - (MAX_QUOTE - (end - start)) // 2)
    hi = min(len(text), lo + MAX_QUOTE)
    lo = max(0, hi - MAX_QUOTE)
    while lo > 0 and lo < start and not text[lo - 1].isspace():
        lo += 1
    while hi < len(text) and hi > end and not text[hi].isspace():
        hi -= 1
    q = text[lo:hi].strip()
    assert q and q in text and len(q) <= MAX_QUOTE
    return q


# (book_id, question_id) pairs read and rejected: figurative, minor, or not about the story itself.
REJECT: set[tuple[str, str]] = set()
REJECT_FILE = OUT / "rejected.json"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--research")
    ap.add_argument("--show", help="comma-separated motif ids: print every hit with context for review")
    ap.add_argument("--context", type=int, default=40)
    args = ap.parse_args()
    pack = pack_root(args.research)
    records = [json.loads(s) for s in (pack / "data" / "priority_500_researched.jsonl").read_text(encoding="utf-8").splitlines()]
    reject = {tuple(x) for x in json.loads(REJECT_FILE.read_text(encoding="utf-8"))["rejected"]} if REJECT_FILE.exists() else set()
    show = set(args.show.split(",")) if args.show else set()

    labels, hits = [], Counter()
    for r in records:
        texts = [(r["synopsis"]["source_id"], r["synopsis"]["text"])]
        for sid, t in r.get("evidence_texts", {}).items():
            if sid.startswith("enwiki:") and any(s["id"] == sid for s in r["sources"]):
                lead = lead_paragraph(t)
                if lead:
                    texts.append((sid, lead))
        for mid, _q, _d, inc, exc, _c in MOTIFS:
            found = None
            for sid, t in texts:
                for m in re.finditer(inc, t):
                    ctx = t[max(0, m.start() - args.context): m.end() + args.context]
                    if exc and re.search(exc, ctx):
                        continue
                    found = (sid, t, m)
                    break
                if found:
                    break
            if not found:
                continue
            sid, t, m = found
            if mid in show:
                ctx = t[max(0, m.start() - args.context): m.end() + args.context].replace("\n", " ")
                flag = "REJ " if (r["id"], mid) in reject else ""
                print(f"{mid} {flag}{r['id']:<22} {r['title'][:28]:<28} …{ctx}…")
            if (r["id"], mid) in reject:
                continue
            hits[mid] += 1
            labels.append({"book_id": r["id"], "question_id": mid, "p_yes": 0.9, "status": "supported",
                           "source_id": sid, "evidence_quote": quote_around(t, m.start(), m.end()),
                           "premise_safe": True, "reviewed": False,
                           "method": "explicit_mention_in_story_text (keyword match, AI-checked)"})

    questions = [{"id": mid, "category": f"motif:{cat}", "group": f"motif_{mid}", "recallability": 0.9,
                  "adaptation_sensitive": False, "text": q, "definition": d,
                  "spoiler_policy": "Concrete story element; twist-revealing motifs are not asked.",
                  "evidence_rule": "Positive only: an explicit mention in the plot synopsis or the article's premise paragraph. Absence is unknown, not No."}
                 for mid, q, d, _i, _e, cat in MOTIFS]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "motif_questions.json").write_text(json.dumps(questions, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (OUT / "motif_labels.json").write_text(json.dumps({"labels": labels}, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    if not show:
        print(json.dumps({"motif_questions": len(MOTIFS), "labels": len(labels), "rejected": len(reject),
                          "books_with_any": len({x['book_id'] for x in labels}),
                          "per_question": dict(sorted(hits.items()))}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
