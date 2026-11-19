#!/usr/bin/env python3
"""Stamp a release: set APP_VERSION in the app pages and write version.json beside them.
Usage: python3 tools/stamp_version.py [repo_dir] ["optional one-line release note"]
Open tabs compare their APP_VERSION with version.json and show a 'new version ready' banner."""
import sys, re, json, datetime, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
note = sys.argv[2] if len(sys.argv) > 2 else ''
ver = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
for name in ('index.html', 'index-unified.html'):
    f = root / name
    s = f.read_text()
    s2, n = re.subn(r"const APP_VERSION = '[^']*';", f"const APP_VERSION = '{ver}';", s)
    assert n == 1, f'{name}: APP_VERSION line not found'
    f.write_text(s2)
(root / 'version.json').write_text(json.dumps({'version': ver, 'notes': note}) + '\n')
print('stamped', ver)
