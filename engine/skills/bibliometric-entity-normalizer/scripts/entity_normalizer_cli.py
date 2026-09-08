#!/usr/bin/env python3
"""
CLI Helper: Bibliometric Entity Normalizer
Provides fuzzy string matching (Levenshtein, Jaro-Winkler) to detect entity variants,
suggest merger pairs for autonomous agents, and apply/validate thesaurus rules.
"""

import sys
import os
import json
import csv
import argparse
from typing import Dict, List, Any, Tuple, Optional, Set

# Ensure knomap engine is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
KNOMAP_ENGINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", ".."))
if not os.path.exists(os.path.join(KNOMAP_ENGINE_DIR, "vos_thesaurus.py")):
    KNOMAP_ENGINE_DIR = "/home/labsom/knomap/engine"

if KNOMAP_ENGINE_DIR not in sys.path and os.path.exists(KNOMAP_ENGINE_DIR):
    sys.path.insert(0, KNOMAP_ENGINE_DIR)


def levenshtein_distance(s1: str, s2: str) -> int:
    """Computes the Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def normalized_similarity(s1: str, s2: str) -> float:
    """Calculates normalized similarity ratio [0.0, 1.0] based on Levenshtein."""
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0
    dist = levenshtein_distance(s1, s2)
    return 1.0 - (dist / max_len)


def jaro_winkler_similarity(s1: str, s2: str, p: float = 0.1) -> float:
    """Computes the Jaro-Winkler similarity between two strings."""
    len1, len2 = len(s1), len(s2)
    if len1 == 0 and len2 == 0:
        return 1.0
    if len1 == 0 or len2 == 0:
        return 0.0

    match_distance = (max(len1, len2) // 2) - 1
    s1_matches = [False] * len1
    s2_matches = [False] * len2
    matches = 0

    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len2)
        for j in range(start, end):
            if s2_matches[j]:
                continue
            if s1[i] == s2[j]:
                s1_matches[i] = True
                s2_matches[j] = True
                matches += 1
                break

    if matches == 0:
        return 0.0

    # Count transpositions
    k = 0
    transpositions = 0
    for i in range(len1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1

    transpositions //= 2
    jaro = (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3.0

    # Common prefix length up to 4 characters
    prefix = 0
    for i in range(min(len1, len2, 4)):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break

    return jaro + prefix * p * (1.0 - jaro)


def extract_entities_from_corpus(filepath: str, entity_type: str) -> Dict[str, int]:
    """Extracts unique entity names and their frequencies from a corpus file."""
    counts: Dict[str, int] = {}
    lower = filepath.lower()

    if lower.endswith(".parquet"):
        import pandas as pd
        df = pd.read_parquet(filepath)
        col_map = {
            "authors": ["authors", "author", "AU"],
            "institutions": ["affiliations", "institutions", "C1"],
            "keywords": ["keywords_author", "keywords_plus", "DE", "ID"]
        }
        target_cols = col_map.get(entity_type, [entity_type])
        found_col = next((c for c in target_cols if c in df.columns), None)
        if not found_col:
            found_col = df.columns[0]

        for val in df[found_col].dropna():
            for item in str(val).split(";"):
                item_clean = item.strip()
                if item_clean and len(item_clean) > 1:
                    counts[item_clean] = counts.get(item_clean, 0) + 1
        return counts

    if lower.endswith(".csv"):
        with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
            reader = csv.DictReader(f)
            fields = reader.fieldnames or []
            target = next((f for f in fields if entity_type.lower() in f.lower()), fields[0] if fields else None)
            if not target:
                return {}
            for row in reader:
                val = row.get(target, "")
                for item in str(val).split(";"):
                    item_clean = item.strip()
                    if item_clean and len(item_clean) > 1:
                        counts[item_clean] = counts.get(item_clean, 0) + 1
        return counts

    if lower.endswith(".json"):
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            items = data.get("records", data) if isinstance(data, dict) else data
            for item in items:
                val = item.get(entity_type) or item.get("authors") or item.get("keywords") or ""
                for part in str(val).split(";"):
                    p_clean = part.strip()
                    if p_clean:
                        counts[p_clean] = counts.get(p_clean, 0) + 1
        return counts

    return counts


def cmd_suggest_merges(args):
    """Detects entity variants and outputs structured merge suggestions for agents."""
    input_path = args.input
    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: Input file does not exist: {input_path}\n")
        sys.exit(1)

    threshold = args.threshold
    metric = args.metric  # "jaro-winkler" or "levenshtein"
    entity_type = args.entity  # "authors", "institutions", "keywords"

    counts = extract_entities_from_corpus(input_path, entity_type)
    if not counts:
        sys.stderr.write(f"Warning: No entities found in {input_path} for type '{entity_type}'.\n")
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump({"total_entities": 0, "suggested_merges": []}, f, indent=2)
        sys.exit(0)

    # Sort entities by frequency descending
    sorted_entities = sorted(counts.keys(), key=lambda e: counts[e], reverse=True)
    # Cap comparison to top N if requested to prevent O(N^2) explosion
    max_compare = args.max_compare or 2000
    candidates = sorted_entities[:max_compare]

    suggestions = []
    seen_pairs: Set[Tuple[str, str]] = set()

    for i in range(len(candidates)):
        ent_a = candidates[i]
        freq_a = counts[ent_a]
        norm_a = ent_a.lower().replace(".", "").replace("-", " ")

        for j in range(i + 1, len(candidates)):
            ent_b = candidates[j]
            freq_b = counts[ent_b]
            norm_b = ent_b.lower().replace(".", "").replace("-", " ")

            if abs(len(norm_a) - len(norm_b)) > 15:
                continue

            if metric == "jaro-winkler":
                score = jaro_winkler_similarity(norm_a, norm_b)
            else:
                score = normalized_similarity(norm_a, norm_b)

            if score >= threshold:
                # The entity with higher frequency or longer canonical name is proposed as canonical
                canonical = ent_a if freq_a >= freq_b else ent_b
                variant = ent_b if canonical == ent_a else ent_a
                pair_key = (canonical, variant)

                if pair_key not in seen_pairs:
                    seen_pairs.add(pair_key)
                    suggestions.append({
                        "canonical_candidate": canonical,
                        "variant_candidate": variant,
                        "similarity_score": round(score, 3),
                        "metric": metric,
                        "occurrences_canonical": counts[canonical],
                        "occurrences_variant": counts[variant]
                    })

    output_data = {
        "input_file": input_path,
        "entity_type": entity_type,
        "total_unique_entities": len(counts),
        "analyzed_entities": len(candidates),
        "total_suggestions": len(suggestions),
        "suggested_merges": suggestions
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"Detected {len(suggestions)} merge candidates (threshold={threshold}). Results saved to {args.output}")
    sys.exit(0)


def cmd_apply_thesaurus(args):
    """Applies a thesaurus CSV file (label,replace by) to a corpus or matrix."""
    input_path = args.input
    thesaurus_path = args.thesaurus
    output_path = args.output

    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: Input file does not exist: {input_path}\n")
        sys.exit(1)
    if not os.path.exists(thesaurus_path):
        sys.stderr.write(f"Error: Thesaurus file does not exist: {thesaurus_path}\n")
        sys.exit(1)

    # Load thesaurus mapping
    thesaurus_map: Dict[str, str] = {}
    with open(thesaurus_path, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        for row in reader:
            if len(row) >= 2:
                original = row[0].strip()
                replacement = row[1].strip()
                if original:
                    thesaurus_map[original.lower()] = replacement

    # Apply to input
    lower = input_path.lower()
    replacements_count = 0

    if lower.endswith(".parquet"):
        import pandas as pd
        df = pd.read_parquet(input_path)
        col = args.column or "authors"
        if col in df.columns:
            def replace_item(val):
                nonlocal replacements_count
                if pd.isna(val):
                    return val
                parts = [p.strip() for p in str(val).split(";")]
                new_parts = []
                for p in parts:
                    low = p.lower()
                    if low in thesaurus_map:
                        new_parts.append(thesaurus_map[low])
                        replacements_count += 1
                    else:
                        new_parts.append(p)
                return "; ".join(new_parts)

            df[col] = df[col].apply(replace_item)
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            df.to_parquet(output_path, index=False)
            print(f"Applied {replacements_count} replacements to column '{col}'. Output: {output_path}")
            sys.exit(0)

    # Default CSV/JSON handler
    if lower.endswith(".csv"):
        with open(input_path, "r", encoding="utf-8-sig", errors="replace") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            rows = []
            col = args.column or fieldnames[0]
            for r in reader:
                val = r.get(col, "")
                parts = [p.strip() for p in str(val).split(";")]
                new_parts = []
                for p in parts:
                    low = p.lower()
                    if low in thesaurus_map:
                        new_parts.append(thesaurus_map[low])
                        replacements_count += 1
                    else:
                        new_parts.append(p)
                r[col] = "; ".join(new_parts)
                rows.append(r)

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"Applied {replacements_count} replacements to CSV. Output: {output_path}")
        sys.exit(0)

    sys.stderr.write(f"Error: Unsupported input format for {input_path}\n")
    sys.exit(1)


def cmd_validate_thesaurus(args):
    """Validates a thesaurus CSV file for circular references or format errors."""
    thesaurus_path = args.thesaurus
    if not os.path.exists(thesaurus_path):
        sys.stderr.write(f"Error: Thesaurus file does not exist: {thesaurus_path}\n")
        sys.exit(1)

    issues = []
    mapping = {}
    row_count = 0

    with open(thesaurus_path, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header or len(header) < 2:
            issues.append("Missing standard header: expected 'label,replace by'.")

        for idx, row in enumerate(reader, start=2):
            row_count += 1
            if len(row) < 2:
                issues.append(f"Line {idx}: Insufficient columns (expected 2, got {len(row)}).")
                continue
            orig, repl = row[0].strip(), row[1].strip()
            if not orig:
                issues.append(f"Line {idx}: Empty original label.")
            if orig.lower() == repl.lower() and orig:
                issues.append(f"Line {idx}: Self-replacement for '{orig}'.")
            if orig.lower() in mapping:
                issues.append(f"Line {idx}: Duplicate mapping for '{orig}'.")
            mapping[orig.lower()] = repl.lower()

    # Check circular references A -> B and B -> A
    for k, v in mapping.items():
        if v in mapping and mapping[v] == k:
            issues.append(f"Circular reference detected between '{k}' and '{v}'.")

    result = {
        "thesaurus_path": thesaurus_path,
        "total_rules": row_count,
        "valid": len(issues) == 0,
        "issues_found": len(issues),
        "issues": issues
    }

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"Validation written to {args.output}")
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))

    sys.exit(0 if result["valid"] else 1)


def main():
    parser = argparse.ArgumentParser(description="CLI for Bibliometric Entity Normalizer")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: suggest-merges
    p_sug = subparsers.add_parser("suggest-merges", help="Suggest merge candidate pairs for variants")
    p_sug.add_argument("--input", required=True, help="Path to corpus file (.parquet, .csv, or .json)")
    p_sug.add_argument("--output", required=True, help="Path to output suggestions JSON")
    p_sug.add_argument("--entity", choices=["authors", "institutions", "keywords"], default="authors", help="Entity type to normalize")
    p_sug.add_argument("--threshold", type=float, default=0.85, help="Similarity threshold [0.0 - 1.0]")
    p_sug.add_argument("--metric", choices=["jaro-winkler", "levenshtein"], default="jaro-winkler", help="Distance metric")
    p_sug.add_argument("--max-compare", type=int, default=2000, help="Maximum number of top entities to compare")
    p_sug.set_defaults(func=cmd_suggest_merges)

    # Subcommand: apply-thesaurus
    p_app = subparsers.add_parser("apply-thesaurus", help="Apply thesaurus CSV to a corpus")
    p_app.add_argument("--input", required=True, help="Path to input corpus file")
    p_app.add_argument("--thesaurus", required=True, help="Path to thesaurus CSV (label,replace by)")
    p_app.add_argument("--output", required=True, help="Path to output cleaned file")
    p_app.add_argument("--column", default=None, help="Target column name to apply thesaurus to")
    p_app.set_defaults(func=cmd_apply_thesaurus)

    # Subcommand: validate-thesaurus
    p_val = subparsers.add_parser("validate-thesaurus", help="Validate thesaurus integrity")
    p_val.add_argument("--thesaurus", required=True, help="Path to thesaurus CSV")
    p_val.add_argument("--output", help="Optional output JSON path")
    p_val.set_defaults(func=cmd_validate_thesaurus)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
