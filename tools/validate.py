"""
Checks the exercise data for mistakes.

Run it by double-clicking  validate.bat  (in the main folder),
or in a terminal:  python tools/validate.py

It reports:
  ERRORS    – things that will break the app (fix these)
  WARNINGS  – things that look suspicious
  CHECK LIST – irregular forms / exceptions to double-check in a grammar
               source such as https://prirucka.ujc.cas.cz
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

CASES = ["nom", "gen", "dat", "acc", "voc", "loc", "ins"]
CATS = ["nouns", "adjectives", "pronouns", "prepositions", "phrases"]
TYPES = ["fill", "prepcase", "chooseprep", "choose", "decline", "phrase", "translate", "error"]
GENDERS = ["Ma", "Mi", "F", "N"]
NEEDS_BLANK = ["fill", "phrase", "chooseprep", "choose"]
CHECK_TAGS = {"exception", "irregular", "fleeting-e", "-l", "ů→o", "Jiří", "adjective-noun",
              "-a masculine", "svůj", "locative-preview", "instrumental-preview", "days", "check",
              "inserted-e", "variant", "consonant change"}
CZ_CHARS = set("aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž")

errors, warnings = [], []


def err(where, msg):
    errors.append(f"{where}: {msg}")


def warn(where, msg):
    warnings.append(f"{where}: {msg}")


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        err(path.name, "file not found")
    except json.JSONDecodeError as e:
        err(path.name, f"invalid JSON (line {e.lineno}, column {e.colno}): {e.msg}")
    return None


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def main():
    index = load(DATA / "index.json") or {"exercises": []}
    rules = load(DATA / "rules.json") or {}
    tables = load(DATA / "tables.json") or {}
    preps = load(DATA / "prepositions.json") or {}

    exercises = []
    for rel in index.get("exercises", []):
        lst = load(DATA / rel)
        if lst is None:
            continue
        if not isinstance(lst, list):
            err(rel, "must be a list [ ... ] of exercises")
            continue
        for e in lst:
            e["_file"] = rel
            exercises.append(e)

    ids = Counter(e.get("id") for e in exercises)
    for i, n in ids.items():
        if n > 1:
            err(str(i), f"duplicate id (used {n} times)")

    seen_prompts = {}
    for e in exercises:
        w = e.get("id", "<no id>")
        for field in ("id", "case", "cat", "type", "prompt", "answers", "explain", "rule"):
            if field not in e or e[field] in ("", None, []):
                err(w, f"missing '{field}'")
        if e.get("case") not in CASES:
            err(w, f"unknown case '{e.get('case')}'")
        if e.get("cat") not in CATS:
            err(w, f"unknown category '{e.get('cat')}'")
        t = e.get("type")
        if t not in TYPES:
            err(w, f"unknown type '{t}'")
        if e.get("g") is not None and e["g"] not in GENDERS:
            err(w, f"unknown gender '{e['g']}' (use Ma, Mi, F or N)")
        if e.get("num", "sg") not in ("sg", "pl"):
            err(w, "num must be 'sg' or 'pl'")
        if e.get("rule") and e["rule"] not in rules:
            err(w, f"rule '{e['rule']}' does not exist in rules.json")

        answers = e.get("answers") or []
        if not isinstance(answers, list):
            err(w, "answers must be a list, e.g. [\"Tomáše\"]")
            answers = []
        for a in answers:
            if not isinstance(a, str) or not a.strip():
                err(w, "empty answer")
                continue
            if a != a.strip() or "  " in a:
                warn(w, f"extra spaces in answer '{a}'")
            if unicodedata.normalize("NFC", a) != a:
                warn(w, f"answer '{a}' uses unusual accent encoding")
            letters = set(re.sub(r"[^\w]", "", a.lower()))
            odd = {c for c in letters if c.isalpha() and c not in CZ_CHARS}
            if odd and t != "prepcase":
                warn(w, f"answer '{a}' contains non-Czech letters: {''.join(sorted(odd))}")
        if len({a.lower() for a in answers}) != len(answers):
            warn(w, "the same answer is listed twice")

        prompt = e.get("prompt", "")
        if t in NEEDS_BLANK and "___" not in prompt:
            err(w, "prompt needs a ___ blank")
        if t == "phrase" and answers:
            blanks = prompt.count("___")
            for a in answers:
                if blanks > 1 and len(a.split()) != blanks:
                    err(w, f"answer '{a}' has {len(a.split())} words but the prompt has {blanks} blanks")
        if t in ("fill", "phrase", "decline", "translate", "error", "prepcase") and not e.get("base"):
            err(w, "missing 'base' (the word / sentence shown to you)")
        if t == "prepcase":
            for a in answers:
                if a not in CASES:
                    err(w, f"prepcase answers must be case codes like 'acc', not '{a}'")
        if t in ("chooseprep", "choose"):
            opts = e.get("options") or []
            if not opts:
                err(w, f"{t} needs 'options'")
            for a in answers:
                if a not in opts:
                    err(w, f"answer '{a}' is not among the options")
        if t == "error":
            full = e.get("full")
            if not full:
                err(w, "spot-the-error exercise needs 'full' (the corrected sentence)")
            else:
                if full == e.get("base"):
                    err(w, "'full' is identical to the wrong sentence")
                if answers and answers[0] not in full:
                    err(w, f"corrected word '{answers[0]}' does not appear in 'full'")
        if t in ("fill", "decline") and e.get("g") is None:
            warn(w, "no gender 'g' – the table row cannot be highlighted")

        rc = rules.get(e.get("rule"), {}).get("case", e.get("case"))
        if f"{rc}-{e.get('num', 'sg')}" not in tables:
            warn(w, f"no declension table '{rc}-{e.get('num', 'sg')}' to show after a mistake")

        key = (e.get("type"), e.get("num", "sg"), prompt, e.get("base"), tuple(e.get("options") or []))
        if key in seen_prompts:
            err(w, f"same exercise as {seen_prompts[key]}")
        else:
            seen_prompts[key] = w

    # rules & tables
    for rid, r in rules.items():
        for field in ("case", "title", "explain", "tip"):
            if not r.get(field):
                err(f"rule {rid}", f"missing '{field}'")
    for tid, t in tables.items():
        for row in t.get("rows", []):
            if len(row.get("cells", [])) != len(t.get("columns", [])):
                err(f"table {tid}", f"row {row.get('label')} has the wrong number of cells")
            for cell in row.get("cells", []):
                for form in cell:
                    if form.count("[") != form.count("]"):
                        err(f"table {tid}", f"unbalanced [ ] in '{form}'")
    for ck, lst in preps.items():
        if ck not in CASES:
            err("prepositions.json", f"unknown case '{ck}'")
        for p in lst:
            if not p.get("p") or not p.get("ex"):
                err("prepositions.json", f"incomplete entry {p}")
            if p.get("two") and p["two"] not in CASES:
                err("prepositions.json", f"unknown case in 'two': {p['two']}")

    # every exercise file must be in the offline list of sw.js
    try:
        sw = (ROOT / "sw.js").read_text(encoding="utf-8")
        for rel in index.get("exercises", []):
            if f"'data/{rel}'" not in sw:
                err("sw.js", f"add 'data/{rel}' to the CORE list so it works offline")
    except FileNotFoundError:
        pass

    # ---------- report ----------
    print("=" * 64)
    print(f"Pády data check — {len(exercises)} exercises in {len(index.get('exercises', []))} file(s)")
    print("=" * 64)
    by_case = Counter(e.get("case") for e in exercises)
    by_cn = Counter((e.get("case"), e.get("num", "sg")) for e in exercises)
    by_type = Counter(e.get("type") for e in exercises)
    by_cat = Counter(e.get("cat") for e in exercises)
    print("By case:     " + ", ".join(f"{k} {by_case[k]} (sg {by_cn[(k, 'sg')]} / pl {by_cn[(k, 'pl')]})" for k in CASES if by_case[k]))
    print("By type:     " + ", ".join(f"{k} {v}" for k, v in by_type.items()))
    print("By category: " + ", ".join(f"{k} {v}" for k, v in by_cat.items()))
    rule_use = Counter(e.get("rule") for e in exercises)
    unused = [r for r in rules if r not in rule_use]
    if unused:
        print("Rules with no exercises yet: " + ", ".join(unused))
    print()

    print(f"ERRORS ({len(errors)})" + (" — none, good!" if not errors else ""))
    for x in errors:
        print("  ✗ " + x)
    print(f"\nWARNINGS ({len(warnings)})" + (" — none" if not warnings else ""))
    for x in warnings:
        print("  ! " + x)

    print("\nCHECK LIST — irregular forms and exceptions worth confirming")
    print("(look them up at https://prirucka.ujc.cas.cz – type the base word)")
    groups = defaultdict(list)
    for e in exercises:
        hit = sorted(set(e.get("tags", [])) & CHECK_TAGS)
        if hit:
            groups[", ".join(hit)].append(e)
    for tag, lst in sorted(groups.items()):
        print(f"\n  [{tag}]")
        for e in lst:
            print(f"    {e['id']:<11} {(e.get('base') or e.get('prompt', '')):<28} → {' / '.join(e.get('answers', []))}")

    print()
    return 1 if errors else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
