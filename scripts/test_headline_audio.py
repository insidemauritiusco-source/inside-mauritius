import unittest, tempfile, pathlib, json
from generate_headline_audio import entries, language, key, valid_mp3
class VoiceTests(unittest.TestCase):
    def test_languages(self):
        self.assertEqual(language("Le gouvernement annonce de nouvelles mesures pour les familles"),"fr")
        self.assertEqual(language("The government announces new measures for families"),"en")
        self.assertIsNone(language("bonjour","mfe"))
    def test_cache(self):
        self.assertEqual(key("a","https://a.com","v"),key("a","https://a.com","v"))
        self.assertNotEqual(key("a","https://a.com","v"),key("b","https://a.com","v"))
    def test_feed(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)
            (p/"newsroom-data.js").write_text("window.x = "+json.dumps([{"title":"valid","sourceUrl":"https://example.com/a"},{"title":"bad","sourceUrl":"javascript:alert(1)"}])+";")
            (p/"world-news-data.js").write_text('window.y = {"headlines":[{"title":"duplicate","url":"https://example.com/a"}]};')
            self.assertEqual(list(entries(p)),[("valid","https://example.com/a",None)])
            self.assertFalse(valid_mp3(p/"missing.mp3"))
if __name__ == "__main__": unittest.main()
