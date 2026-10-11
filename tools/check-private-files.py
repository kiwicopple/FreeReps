#!/usr/bin/env python3
"""Reject tracked private files and obvious secrets without printing their contents."""
import re
import subprocess
import sys

run = lambda *args: subprocess.check_output(args)
ignored = run('git', 'ls-files', '-ci', '--exclude-standard', '-z').decode().split('\0')
failures = [(p, 'tracked despite ignore rule') for p in ignored if p]
patterns = {
    'private key': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'access token': rb'(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|tskey-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})',
    'database dump': rb'(?m)^-- PostgreSQL database dump|^PGDMP|^COPY public\.[^\n]+ FROM stdin;',
    'health export': rb'<HealthData\s+locale=|<Record\s+type="HKQuantityType',
}
for path in filter(None, run('git', 'ls-files', '-z').decode().split('\0')):
    # Check the index, including staged forced additions, rather than working files.
    data = run('git', 'show', ':' + path)
    for label, pattern in patterns.items():
        if re.search(pattern, data): failures.append((path, label))
if '--push' in sys.argv:
    for line in sys.stdin:
        fields = line.split()
        if len(fields) != 4: continue
        _, local, _, remote = fields
        if local == '0' * 40: continue
        revisions = [local]
        if remote != '0' * 40 and subprocess.run(['git', 'cat-file', '-e', remote], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            revisions.append('^' + remote)
        for entry in run('git', 'rev-list', '--objects', *revisions).decode().splitlines():
            oid, _, path = entry.partition(' ')
            if not path or run('git', 'cat-file', '-t', oid).strip() != b'blob': continue
            if subprocess.run(['git', 'check-ignore', '--no-index', '-q', '--', path]).returncode == 0:
                failures.append((path, 'private path in outgoing history'))
            data = run('git', 'cat-file', 'blob', oid)
            for label, pattern in patterns.items():
                if re.search(pattern, data): failures.append((path, label + ' in outgoing history'))
for path, label in failures:
    print(f'Privacy check blocked: {path} ({label})', file=sys.stderr)
if failures: sys.exit(1)
print('Tracked-file privacy check passed (patterns are not a substitute for review).')
