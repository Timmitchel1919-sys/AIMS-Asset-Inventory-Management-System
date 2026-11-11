#!/usr/bin/env python3
"""Offline package integrity check; not an agent/UX benchmark."""
from pathlib import Path
import re, json, sys
root=Path(__file__).resolve().parents[1]
expected=['intent-discovery','information-hierarchy','state-completeness','form-ux','feedback-affordance','ux-auditor','design-system','visual-character','responsive']
errors=[]
for slug in expected:
 p=root/'skills'/slug/'SKILL.md'
 if not p.exists(): errors.append(f'Missing {p}'); continue
 s=p.read_text(encoding='utf-8')
 if not re.match(r'^---\nname: '+re.escape(slug)+r'\ndescription: .+\n---',s): errors.append(f'Bad frontmatter: {slug}')
 for h in ['## Procedure','## Acceptance criteria','## Stop conditions','## Operating contract']:
  if h not in s: errors.append(f'Missing {h}: {slug}')
 if len(s)<2500: errors.append(f'Skill too short: {slug}')
for cmd in ['ux-design','ux-audit','ux-review','restyle','color-design','typography-design']:
 if not (root/'commands'/f'{cmd}.md').exists():errors.append(f'Missing command {cmd}')
json.loads((root/'examples/ux.config.example.json').read_text())
json.loads((root/'templates/audit-findings.schema.json').read_text())
for p in (root/'skills').glob('*/SKILL.md'):
 s=p.read_text()
 for ref in re.findall(r'`(\.\./\.\./references/[^`]+)`',s):
  if not (p.parent/ref).resolve().exists(): errors.append(f'Broken ref {ref} in {p}')
print(f'Checked {len(expected)} skills and 6 command workflows; errors: {len(errors)}')
for e in errors:print('ERROR:',e)
sys.exit(bool(errors))
