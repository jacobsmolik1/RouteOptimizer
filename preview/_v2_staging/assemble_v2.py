#!/usr/bin/env python3
"""Assemble preview/index.html from staging parts and verify sha256."""
from pathlib import Path
import hashlib, shutil

root = Path('preview/_v2_staging')
css = (root/'revamp.css.part0').read_text() + (root/'revamp.css.part1').read_text()
js = (root/'revamp.js.part0').read_text() + (root/'revamp.js.part1').read_text()
shell = (root/'shell.html').read_text()
html = shell.replace('<link rel="stylesheet" href="revamp.css">', f'<style>{css}</style>', 1)
html = html.replace('<script src="revamp.js"></script>', f'<script>{js}</script>', 1)
expected = 'a609e0a47a8843179aa6875c631cffa89562eea6e9c2982123d6731b7a1db4f6'
got = hashlib.sha256(html.encode()).hexdigest()
print('chars', len(html))
print('sha256', got)
print('match', got == expected)
if got != expected:
    raise SystemExit('SHA mismatch — aborting')
Path('preview/index.html').write_text(html)
# cleanup staging + bad chunks
for p in [root, Path('preview/.v2-chunks')]:
    if p.exists():
        shutil.rmtree(p)
print('wrote preview/index.html and cleaned staging')
