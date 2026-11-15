"""Refresh display-only covers from Open Library; never modifies the game catalog.

Only an exact normalized title/alias AND a sole matching author are accepted.
Stored Open Library work IDs take precedence. Series keep a title card rather than
borrowing a volume's jacket. Requests are spaced by one second; optional --cache
keeps successful and missing lookups so an interrupted refresh can resume.
Docs: https://openlibrary.org/dev/docs/api/search
"""
import argparse
import datetime
import json
import pathlib
import re
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]


def normalize(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text).casefold()
                   if c.isalnum())


def matching_cover(book, docs):
    titles = {normalize(t) for t in [book["title_en"], *book.get("aliases", [])]}
    for doc in docs:
        authors = doc.get("author_name", [])
        cover = doc.get("cover_i")
        key = doc.get("key", "")
        if (normalize(doc.get("title", "")) in titles
                and len(authors) == 1 and normalize(authors[0]) == normalize(book["author"])
                and type(cover) is int and cover > 0
                and re.fullmatch(r"(?:/works/)?OL\d+W", key)):
            return {"coverId": cover, "workUrl": "https://openlibrary.org/works/" + key.split("/")[-1],
                    "title": doc["title"], "author": authors[0]}
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=pathlib.Path)
    args = parser.parse_args()
    cache = json.loads(args.cache.read_text()) if args.cache and args.cache.exists() else {}
    books = []
    for filename in ["fixture.catalog.json", "cmu.catalog.json"]:
        books.extend(json.loads((ROOT / "src/data" / filename).read_text())["books"])
    covers = {}
    last_request = 0

    def get_json(url):
        nonlocal last_request
        time.sleep(max(0, 1.1 - (time.monotonic() - last_request)))
        last_request = time.monotonic()
        req = urllib.request.Request(url, headers={"User-Agent": "Bookinator-Catalog-Covers/1.0 (https://github.com/WiseShrestha/Bookinator)"})
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.load(response)

    for i, book in enumerate(books):
        if book.get("volumes"):
            continue
        cache_key = book.get("openlibrary_work_id") or normalize(book["title_en"] + " " + book["author"])
        if cache_key not in cache:
            try:
                work = book.get("openlibrary_work_id")
                if work and re.fullmatch(r"OL\d+W", work):
                    data = get_json(f"https://openlibrary.org/works/{work}.json")
                    cover = next((v for v in data.get("covers", []) if type(v) is int and v > 0), None)
                    cache[cache_key] = {"coverId": cover, "workUrl": f"https://openlibrary.org/works/{work}",
                                        "title": book["title_en"], "author": book["author"]} if cover else None
                else:
                    params = urllib.parse.urlencode({"title": book["title_en"], "author": book["author"],
                                                     "fields": "key,title,author_name,cover_i", "limit": 20})
                    data = get_json("https://openlibrary.org/search.json?" + params)
                    cache[cache_key] = matching_cover(book, data.get("docs", []))
                if args.cache:
                    args.cache.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n")
            except Exception as error:
                print(f"Skipped {book['title_en']}: {error}", flush=True)
                continue
        if cache[cache_key]:
            covers[book["id"]] = cache[cache_key]
        if i % 25 == 0:
            print(f"Checked {i + 1}/{len(books)} targets; {len(covers)} covers", flush=True)
    output = {"provider": "Open Library", "checkedOn": datetime.date.today().isoformat(),
              "documentation": "https://openlibrary.org/dev/docs/api/search", "books": covers}
    (ROOT / "src/data/catalog-covers.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"Saved {len(covers)} sourced covers", flush=True)


if __name__ == "__main__":
    main()
