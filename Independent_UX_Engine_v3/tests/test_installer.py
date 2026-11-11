import tempfile, unittest, pathlib, sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from install import install
class InstallerTests(unittest.TestCase):
 def test_all_platforms(self):
  for platform in ('claude','codex','opencode'):
   with self.subTest(platform=platform), tempfile.TemporaryDirectory() as tmp:
    p=pathlib.Path(tmp)
    self.assertEqual(install(p,platform),0)
    base=p/('.agents' if platform=='codex' else '.'+platform)/'skills'
    self.assertEqual(len(list(base.glob('*/SKILL.md'))),15 if platform=='codex' else 9)
    self.assertEqual(install(p,platform),2)
 def test_preserve_project_files(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=pathlib.Path(tmp);(p/'AGENTS.md').write_text('ORIGINAL');(p/'DESIGN.md').write_text('THEME')
   self.assertEqual(install(p,'claude'),0)
   self.assertEqual((p/'AGENTS.md').read_text(),'ORIGINAL')
   self.assertEqual((p/'DESIGN.md').read_text(),'THEME')
 def test_dry_run(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=pathlib.Path(tmp);self.assertEqual(install(p,'opencode',dry_run=True),0)
   self.assertFalse((p/'.opencode').exists())
if __name__=='__main__':unittest.main()
