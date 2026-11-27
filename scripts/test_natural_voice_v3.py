import unittest, tempfile, pathlib, json, datetime as dt
from unittest.mock import patch
from natural_voice_v3 import build, MUT, PREFIX, BULLETIN_PREFIX
from generate_headline_audio import key
class V3Tests(unittest.TestCase):
    def test_reuse_and_protect_legacy(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d);(p/"audio").mkdir()
            title="The latest government announcement";url="https://example.com/news"
            rel="audio/headline-"+key(title,url,"bm_george")+".mp3"
            (p/rel).write_bytes(b"test")
            legacy="audio/headline-"+"a"*32+".mp3";(p/legacy).write_bytes(b"legacy")
            (p/"newsroom-data.js").write_text("window.x = "+json.dumps([dict(title=title,sourceUrl=url,language="en")])+";")
            (p/"world-news-data.js").write_text('window.y = {"headlines":[]};')
            old=[dict(title="Old",sourceUrl="https://example.com/old",audioUrl=legacy,engine="Kokoro",language="en")]
            (p/"headline-audio-data.js").write_text(PREFIX+json.dumps(old)+";")
            with patch("natural_voice_v3.valid_mp3",side_effect=lambda x:x.exists()),patch("natural_voice_v3.synthesize") as synth:
                build(p,0,dt.datetime(2026,11,27,8,tzinfo=MUT));synth.assert_not_called()
            self.assertTrue((p/legacy).exists())
            self.assertIn("legacyV2",(p/"headline-audio-data.js").read_text())
    def test_empty_feed_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)
            (p/"newsroom-data.js").write_text("window.x = [];")
            (p/"world-news-data.js").write_text('window.y = {"headlines":[]};')
            manifest=p/"headline-audio-data.js";manifest.write_text(PREFIX+"[];")
            with self.assertRaises(RuntimeError):build(p,0)
            self.assertEqual(manifest.read_text(),PREFIX+"[];")
if __name__=="__main__":unittest.main()
