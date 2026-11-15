"""Cover enrichment must not confuse a similarly titled book or invent identity."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("catalog_covers", pathlib.Path(__file__).resolve().parents[1] / "scripts/catalog_covers.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CatalogCoverTests(unittest.TestCase):
    def setUp(self):
        self.book = {"title_en": "Nineteen Eighty-Four", "author": "George Orwell", "aliases": ["1984"]}
        self.doc = {"title": "1984", "author_name": ["George Orwell"], "key": "/works/OL1168007W", "cover_i": 123}

    def test_only_accepts_title_and_sole_author_match(self):
        self.assertEqual(module.matching_cover(self.book, [self.doc])["coverId"], 123)
        self.assertIsNone(module.matching_cover(self.book, [{**self.doc, "title": "1984 (adaptation)"}]))
        self.assertIsNone(module.matching_cover(self.book, [{**self.doc, "author_name": ["Another Author"]}]))
        self.assertIsNone(module.matching_cover(self.book, [{**self.doc, "author_name": ["George Orwell", "Another Author"]}]))

    def test_invalid_cover_and_work_identifiers_are_rejected(self):
        for value in [-1, 0, "123", True, None]:
            self.assertIsNone(module.matching_cover(self.book, [{**self.doc, "cover_i": value}]))
        self.assertIsNone(module.matching_cover(self.book, [{**self.doc, "key": "https://untrusted.example/work"}]))

    def test_normalization_handles_punctuation_and_accents(self):
        book = {"title_en": "A Study in Scarlet", "author": "Arthur Conan Doyle", "aliases": []}
        doc = {**self.doc, "title": "A STUDY IN SCARLET.", "author_name": ["Arthur Conan Doyle"]}
        self.assertIsNotNone(module.matching_cover(book, [doc]))
        self.assertEqual(module.normalize("Gabriel García Márquez"), module.normalize("Gabriel Garcia Marquez"))
