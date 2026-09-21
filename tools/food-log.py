#!/usr/bin/env python3
"""Local food-log client. No image ingestion, API keys, or third-party uploads."""
import argparse
import json
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
sub = parser.add_subparsers(dest="command", required=True)
sub.add_parser("catalog")
save = sub.add_parser("save")
save.add_argument("file", help="JSON record; '-' reads stdin")
log = sub.add_parser("list")
log.add_argument("start", help="Inclusive local date")
log.add_argument("end", help="Exclusive local date")
history = sub.add_parser("history")
history.add_argument("id")
args = parser.parse_args()
base = "http://127.0.0.1:8080/api/v1/food"
body = None
if args.command == "catalog":
    url = base + "/catalog"
elif args.command == "save":
    raw = sys.stdin.read() if args.file == "-" else pathlib.Path(args.file).read_text()
    body = json.dumps(json.loads(raw), allow_nan=False).encode()
    url = base
elif args.command == "list":
    url = base + "?" + urllib.parse.urlencode({"start": args.start, "end": args.end})
else:
    url = base + "/" + urllib.parse.quote(args.id, safe="") + "/history"
try:
    request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        print(json.dumps(json.load(response), indent=2))
except urllib.error.HTTPError as error:
    print(f"Food log request failed ({error.code}): {error.read().decode()}", file=sys.stderr)
    sys.exit(1)
except urllib.error.URLError as error:
    print(f"FreeReps is unavailable: {error.reason}", file=sys.stderr)
    sys.exit(1)
