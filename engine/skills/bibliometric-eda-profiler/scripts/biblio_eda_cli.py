#!/usr/bin/env python3
"""
CLI Helper: Bibliometric EDA Profiler
Computes descriptive cienciometric indicators: H-index, G-index, M-index,
term growth/survival dynamics, and publication distributions from standardized tabular datasets.
"""

import sys
import os
import json
import csv
import argparse
from typing import Dict, List, Any, Optional

# Ensure knomap engine is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
KNOMAP_ENGINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", ".."))
if not os.path.exists(os.path.join(KNOMAP_ENGINE_DIR, "biblio_eda_engine.py")):
    KNOMAP_ENGINE_DIR = "/home/labsom/knomap/engine"

if KNOMAP_ENGINE_DIR not in sys.path and os.path.exists(KNOMAP_ENGINE_DIR):
    sys.path.insert(0, KNOMAP_ENGINE_DIR)

from biblio_eda_engine import calculate_h_index, calculate_g_index, calculate_m_index, generate_eda_report


def load_records(filepath: str) -> List[Dict[str, Any]]:
    """Loads standardized records from Parquet, CSV, or JSON."""
    lower = filepath.lower()
    records = []

    if lower.endswith(".parquet"):
        import pandas as pd
        df = pd.read_parquet(filepath)
        # Check citations column
        if "citations" not in df.columns and "Cited by" not in df.columns and "TC" not in df.columns:
            sys.stderr.write("Warning: Missing citation count column ('citations'/'Cited by'/'TC'). Assuming 0 citations.\n")
            df["citations"] = 0
        records = df.to_dict(orient="records")
        return records

    if lower.endswith(".csv"):
        with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            has_cit = any(c in fieldnames for c in ["citations", "Cited by", "TC", "times_cited"])
            if not has_cit:
                sys.stderr.write("Warning: Missing citation count column in CSV. Assuming 0 citations.\n")
            for row in reader:
                records.append(dict(row))
        return records

    if lower.endswith(".json"):
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            records = data.get("records", data) if isinstance(data, dict) else data
        return records

    sys.stderr.write(f"Error: Unsupported format for {filepath}\n")
    sys.exit(1)


def cmd_report(args):
    """Generates the full comprehensive EDA cienciometric report."""
    input_path = args.input
    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: Input file does not exist: {input_path}\n")
        sys.exit(1)

    records = load_records(input_path)
    report = generate_eda_report(records)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"EDA Report generated successfully from {len(records)} records. Output: {args.output}")
    sys.exit(0)


def cmd_author_metrics(args):
    """Calculates author H-index, G-index, and M-index rankings."""
    input_path = args.input
    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: Input file does not exist: {input_path}\n")
        sys.exit(1)

    records = load_records(input_path)
    from collections import defaultdict

    auth_cits = defaultdict(list)
    auth_years = defaultdict(list)
    missing_cits_warned = False

    for r in records:
        raw_auth = r.get("authors") or r.get("Authors") or r.get("AU") or ""
        authors = [a.strip() for a in str(raw_auth).split(";") if a.strip()]
        cit_raw = r.get("citations", r.get("Cited by", r.get("TC", None)))
        if cit_raw is None and not missing_cits_warned:
            sys.stderr.write("Warning: One or more documents lack citation count. Assuming 0.\n")
            missing_cits_warned = True

        try:
            cit_val = int(float(cit_raw)) if cit_raw is not None else 0
        except (ValueError, TypeError):
            cit_val = 0

        yr_raw = r.get("year", r.get("Year", r.get("PY", None)))
        try:
            yr_val = int(str(yr_raw)[:4]) if yr_raw else None
        except (ValueError, TypeError):
            yr_val = None

        for a in authors:
            auth_cits[a].append(cit_val)
            if yr_val:
                auth_years[a].append(yr_val)

    rankings = []
    current_year = args.current_year or 2026

    for a, c_list in auth_cits.items():
        h = calculate_h_index(c_list)
        g = calculate_g_index(c_list)
        first_yr = min(auth_years[a]) if auth_years[a] else current_year
        m = calculate_m_index(h, first_yr, current_year)

        rankings.append({
            "author": a,
            "total_documents": len(c_list),
            "total_citations": sum(c_list),
            "h_index": h,
            "g_index": g,
            "m_index": m,
            "first_publication_year": first_yr,
            "years_active": max(1, current_year - first_yr)
        })

    rankings.sort(key=lambda x: (x["h_index"], x["total_citations"]), reverse=True)
    limit = args.top_n or 100
    top_rankings = rankings[:limit]

    output_data = {
        "total_authors_analyzed": len(rankings),
        "top_n_reported": len(top_rankings),
        "authors": top_rankings
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"Calculated metrics for {len(rankings)} authors. Top {len(top_rankings)} saved to {args.output}")
    sys.exit(0)


def cmd_term_growth(args):
    """Tracks annual word/keyword growth and survival."""
    input_path = args.input
    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: Input file does not exist: {input_path}\n")
        sys.exit(1)

    records = load_records(input_path)
    from collections import defaultdict

    term_annual = defaultdict(lambda: defaultdict(int))
    all_years = set()

    for r in records:
        yr_raw = r.get("year", r.get("Year", r.get("PY", None)))
        try:
            yr = int(str(yr_raw)[:4]) if yr_raw else None
        except (ValueError, TypeError):
            yr = None

        if not yr or yr < 1900:
            continue

        all_years.add(yr)
        kw_raw = r.get("keywords_author", r.get("keywords", r.get("DE", "")))
        keywords = [k.strip().lower() for k in str(kw_raw).split(";") if k.strip()]
        for kw in keywords:
            if len(kw) > 2:
                term_annual[kw][yr] += 1

    years_sorted = sorted(list(all_years))
    results = []

    for term, yr_map in term_annual.items():
        total_freq = sum(yr_map.values())
        if total_freq < (args.min_freq or 3):
            continue

        first_seen = min(yr_map.keys())
        last_seen = max(yr_map.keys())
        trajectory = {str(y): yr_map.get(y, 0) for y in years_sorted}

        results.append({
            "term": term,
            "total_occurrences": total_freq,
            "first_year": first_seen,
            "last_year": last_seen,
            "lifespan_years": last_seen - first_seen + 1,
            "annual_trajectory": trajectory
        })

    results.sort(key=lambda x: x["total_occurrences"], reverse=True)
    output_data = {
        "time_span": [years_sorted[0], years_sorted[-1]] if years_sorted else [],
        "total_terms": len(results),
        "terms": results[:args.top_n or 200]
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"Tracked growth for {len(results)} terms across {len(years_sorted)} years. Saved to {args.output}")
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="CLI for Bibliometric EDA Profiler")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: eda-report
    p_rep = subparsers.add_parser("eda-report", help="Generate full descriptive cienciometric report")
    p_rep.add_argument("--input", required=True, help="Path to corpus file (.parquet, .csv, .json)")
    p_rep.add_argument("--output", required=True, help="Path to output report JSON")
    p_rep.set_defaults(func=cmd_report)

    # Subcommand: author-metrics
    p_auth = subparsers.add_parser("author-metrics", help="Calculate author H, G, M indices")
    p_auth.add_argument("--input", required=True, help="Path to corpus file")
    p_auth.add_argument("--output", required=True, help="Path to output rankings JSON")
    p_auth.add_argument("--top-n", type=int, default=100, help="Number of top authors to report")
    p_auth.add_argument("--current-year", type=int, default=2026, help="Current year for M-index calculation")
    p_auth.set_defaults(func=cmd_author_metrics)

    # Subcommand: term-growth
    p_term = subparsers.add_parser("term-growth", help="Analyze annual keyword growth and survival")
    p_term.add_argument("--input", required=True, help="Path to corpus file")
    p_term.add_argument("--output", required=True, help="Path to output trajectory JSON")
    p_term.add_argument("--min-freq", type=int, default=3, help="Minimum total occurrences for term inclusion")
    p_term.add_argument("--top-n", type=int, default=200, help="Maximum terms to output")
    p_term.set_defaults(func=cmd_term_growth)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
