"""Pretty-prints a product list from stdin. Raw JSON is unreadable on video."""
import json
import sys

D, B, X = "\033[90m", "\033[1m", "\033[0m"

rows = json.load(sys.stdin)
if not isinstance(rows, list) or not rows:
    print("  (empty)")
    raise SystemExit

head = "{:<15}{:<14}{:<12}{:<36}{:>11}{:>7}".format(
    "CATEGORY", "SUBCATEGORY", "BRAND", "PRODUCT", "PRICE", "STOCK")
print("  " + B + head + X)
print("  " + D + "-" * len(head) + X)
for r in rows:
    print("  " + "{:<15}{:<14}{:<12}{:<36}{:>11}{:>7}".format(
        str(r.get("category", ""))[:14],
        str(r.get("subcategory", ""))[:13],
        str(r.get("brand", ""))[:11],
        str(r.get("productName", ""))[:35],
        str(r.get("price", "")),
        str(r.get("stock", "")),
    ))
