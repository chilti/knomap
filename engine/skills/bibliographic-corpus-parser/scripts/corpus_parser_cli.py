#!/usr/bin/env python3
"""
CLI Helper: Bibliographic Corpus Parser
Ingests heterogenous bibliographic export formats (WoS plain/tab, Scopus CSV, RIS, PubMed XML, OpenAlex JSON)
and normalizes them into a standardized tabular structure (Parquet, CSV, or JSON).
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
if not os.path.exists(os.path.join(KNOMAP_ENGINE_DIR, "bibliometrics_parser.py")):
    KNOMAP_ENGINE_DIR = "/home/labsom/knomap/engine"

if KNOMAP_ENGINE_DIR not in sys.path and os.path.exists(KNOMAP_ENGINE_DIR):
    sys.path.insert(0, KNOMAP_ENGINE_DIR)


def detect_format(filepath: str) -> str:
    """Heuristically detects the bibliographic file format."""
    lower = filepath.lower()
    if lower.endswith(".json") or lower.endswith(".jsonl"):
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                chunk = f.read(2048)
                if "openalex" in chunk.lower() or "authorships" in chunk.lower():
                    return "openalex-json"
                return "json"
        except Exception:
            return "json"

    if lower.endswith(".ris"):
        return "ris"

    if lower.endswith(".xml"):
        return "pubmed-xml"

    if lower.endswith(".csv"):
        try:
            with open(filepath, "r", encoding="utf-8-sig", errors="ignore") as f:
                header = f.readline().lower()
                if "scopus" in header or ("authors" in header and "source title" in header):
                    return "scopus-csv"
                if "dimensions" in header or "publication title" in header:
                    return "dimensions-csv"
                return "scopus-csv"
        except Exception:
            return "scopus-csv"

    # Check for Web of Science plaintext or tab-delimited
    try:
        with open(filepath, "r", encoding="utf-8-sig", errors="ignore") as f:
            first_line = f.readline()
            if first_line.startswith("FN ") or first_line.startswith("VR ") or "\tPT\t" in first_line or first_line.startswith("PT\t"):
                return "wos"
    except Exception:
        pass

    return "unknown"


def parse_scopus_csv(filepath: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Parses a Scopus CSV export into normalized records."""
    records = []
    with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit and i >= limit:
                break
            
            # Map citations
            cit_str = row.get("Cited by") or row.get("Times Cited") or "0"
            try:
                citations = int(float(cit_str.strip() or 0))
            except (ValueError, TypeError):
                citations = 0

            # Map year
            yr_str = row.get("Year") or row.get("Publication Year") or "0"
            try:
                year = int(float(yr_str.strip() or 0))
            except (ValueError, TypeError):
                year = 0

            rec = {
                "id": row.get("EID") or row.get("DOI") or f"scopus_{i}",
                "title": (row.get("Title") or "").strip(),
                "abstract": (row.get("Abstract") or "").strip(),
                "authors": (row.get("Authors") or "").strip(),
                "year": year,
                "source_title": (row.get("Source title") or "").strip(),
                "citations": citations,
                "doi": (row.get("DOI") or "").strip(),
                "keywords_author": (row.get("Author Keywords") or "").strip(),
                "keywords_plus": (row.get("Index Keywords") or "").strip(),
                "affiliations": (row.get("Affiliations") or "").strip(),
                "oa_status": (row.get("Open Access") or "").strip(),
                "references": (row.get("References") or "").strip()
            }
            records.append(rec)
    return records


def parse_wos_plaintext(filepath: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Parses a Web of Science plaintext export file."""
    records = []
    current_rec: Dict[str, Any] = {}
    current_tag = ""
    val_lines = []

    def flush_tag():
        if current_tag:
            current_rec[current_tag] = " ".join(val_lines).strip()

    with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
        for line in f:
            line_str = line.rstrip("\r\n")
            if not line_str:
                continue
            
            if line_str == "ER":
                flush_tag()
                if current_rec:
                    # Normalize WoS record
                    try:
                        cit = int(current_rec.get("TC", "0").strip() or 0)
                    except ValueError:
                        cit = 0
                    try:
                        yr = int(current_rec.get("PY", "0").strip() or 0)
                    except ValueError:
                        yr = 0
                    
                    norm_rec = {
                        "id": current_rec.get("UT") or current_rec.get("DI") or f"wos_{len(records)}",
                        "title": current_rec.get("TI", ""),
                        "abstract": current_rec.get("AB", ""),
                        "authors": current_rec.get("AU", ""),
                        "year": yr,
                        "source_title": current_rec.get("SO", ""),
                        "citations": cit,
                        "doi": current_rec.get("DI", ""),
                        "keywords_author": current_rec.get("DE", ""),
                        "keywords_plus": current_rec.get("ID", ""),
                        "affiliations": current_rec.get("C1", ""),
                        "oa_status": current_rec.get("OA", ""),
                        "references": current_rec.get("CR", "")
                    }
                    records.append(norm_rec)
                    if limit and len(records) >= limit:
                        break
                current_rec = {}
                current_tag = ""
                val_lines = []
                continue

            tag_candidate = line_str[:2]
            rest = line_str[3:] if len(line_str) > 2 else ""

            if tag_candidate.isupper() and (line_str[2:3] == " " or len(line_str) == 2):
                flush_tag()
                current_tag = tag_candidate
                val_lines = [rest.strip()] if rest.strip() else []
            else:
                val_lines.append(line_str.strip())
        
        flush_tag()
    return records


def parse_ris(filepath: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Parses a RIS formatted file."""
    records = []
    current_rec: Dict[str, Any] = {"authors": [], "keywords": []}
    
    with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue
            if line_str.startswith("ER  -"):
                if current_rec.get("title") or current_rec.get("authors"):
                    try:
                        yr = int(str(current_rec.get("year", "0"))[:4])
                    except (ValueError, TypeError):
                        yr = 0
                    
                    norm = {
                        "id": current_rec.get("doi") or current_rec.get("id") or f"ris_{len(records)}",
                        "title": current_rec.get("title", ""),
                        "abstract": current_rec.get("abstract", ""),
                        "authors": "; ".join(current_rec["authors"]),
                        "year": yr,
                        "source_title": current_rec.get("source_title", ""),
                        "citations": 0,
                        "doi": current_rec.get("doi", ""),
                        "keywords_author": "; ".join(current_rec["keywords"]),
                        "keywords_plus": "",
                        "affiliations": current_rec.get("affiliations", ""),
                        "oa_status": "",
                        "references": ""
                    }
                    records.append(norm)
                    if limit and len(records) >= limit:
                        break
                current_rec = {"authors": [], "keywords": []}
                continue

            if len(line_str) >= 6 and line_str[2:6] == "  - ":
                tag = line_str[:2]
                val = line_str[6:].strip()
                if tag in ["TI", "T1"]:
                    current_rec["title"] = val
                elif tag in ["AU", "A1"]:
                    current_rec["authors"].append(val)
                elif tag in ["AB", "N2"]:
                    current_rec["abstract"] = val
                elif tag in ["PY", "Y1", "DA"]:
                    current_rec["year"] = val[:4]
                elif tag in ["JF", "JO", "T2", "SO"]:
                    current_rec["source_title"] = val
                elif tag in ["KW"]:
                    current_rec["keywords"].append(val)
                elif tag in ["DO"]:
                    current_rec["doi"] = val
                elif tag in ["AD"]:
                    current_rec["affiliations"] = val

    return records


def parse_openalex_json(filepath: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Parses OpenAlex JSON or JSONL exports."""
    records = []
    
    def process_item(item: Dict[str, Any]):
        authors = []
        affiliations = []
        for auth in item.get("authorships", []):
            author_obj = auth.get("author", {})
            name = author_obj.get("display_name") or ""
            if name:
                authors.append(name)
            for inst in auth.get("institutions", []):
                inst_name = inst.get("display_name")
                if inst_name and inst_name not in affiliations:
                    affiliations.append(inst_name)
        
        keywords = [k.get("display_name", "") for k in item.get("keywords", []) if k.get("display_name")]
        
        primary_loc = item.get("primary_location") or {}
        source = primary_loc.get("source") or {}
        
        oa_info = item.get("open_access") or {}

        rec = {
            "id": item.get("id", "").replace("https://openalex.org/", ""),
            "title": item.get("title") or item.get("display_name") or "",
            "abstract": item.get("abstract") or "",
            "authors": "; ".join(authors),
            "year": item.get("publication_year") or 0,
            "source_title": source.get("display_name") or "",
            "citations": item.get("cited_by_count") or 0,
            "doi": item.get("doi") or "",
            "keywords_author": "; ".join(keywords),
            "keywords_plus": "",
            "affiliations": "; ".join(affiliations),
            "oa_status": oa_info.get("oa_status") or ("gold" if oa_info.get("is_oa") else "closed"),
            "references": "; ".join(item.get("referenced_works", []))
        }
        return rec

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read(1024).strip()
        f.seek(0)
        if content.startswith("["):
            data = json.load(f)
            for item in data:
                if limit and len(records) >= limit:
                    break
                records.append(process_item(item))
        else:
            # Assume JSONL
            for line in f:
                line_s = line.strip()
                if not line_s:
                    continue
                try:
                    item = json.loads(line_s)
                    records.append(process_item(item))
                    if limit and len(records) >= limit:
                        break
                except json.JSONDecodeError:
                    continue

    return records


def save_records(records: List[Dict[str, Any]], output_path: str):
    """Saves normalized records to Parquet, CSV, or JSON."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    lower = output_path.lower()
    
    if lower.endswith(".parquet"):
        try:
            import pandas as pd
            df = pd.DataFrame(records)
            df.to_parquet(output_path, index=False)
            return
        except ImportError:
            sys.stderr.write("Warning: pandas/pyarrow not found for parquet, falling back to JSON.\n")
            output_path = output_path.replace(".parquet", ".json")

    if lower.endswith(".csv"):
        if not records:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write("")
            return
        keys = list(records[0].keys())
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(records)
        return

    # Default to JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"total_records": len(records), "records": records}, f, indent=2, ensure_ascii=False)


def cmd_parse(args):
    """Executes file parsing and normalization."""
    input_path = args.input
    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: Input file does not exist: {input_path}\n")
        sys.exit(1)

    fmt = args.format or "auto"
    if fmt == "auto":
        fmt = detect_format(input_path)
    
    limit = args.limit if args.limit and args.limit > 0 else None

    if fmt == "scopus-csv" or fmt == "dimensions-csv":
        records = parse_scopus_csv(input_path, limit)
    elif fmt == "wos" or fmt == "wos-plain":
        records = parse_wos_plaintext(input_path, limit)
    elif fmt == "ris":
        records = parse_ris(input_path, limit)
    elif fmt == "openalex-json":
        records = parse_openalex_json(input_path, limit)
    else:
        records = parse_scopus_csv(input_path, limit) if input_path.lower().endswith(".csv") else parse_wos_plaintext(input_path, limit)

    save_records(records, args.output)
    print(f"Successfully parsed {len(records)} records from {fmt} to {args.output}")
    sys.exit(0)


def cmd_inspect(args):
    """Inspects a bibliographic file and prints schema summary."""
    input_path = args.input
    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: Input file does not exist: {input_path}\n")
        sys.exit(1)

    fmt = detect_format(input_path)
    sample_records = []
    if "csv" in fmt:
        sample_records = parse_scopus_csv(input_path, limit=3)
    elif "wos" in fmt:
        sample_records = parse_wos_plaintext(input_path, limit=3)
    elif "ris" in fmt:
        sample_records = parse_ris(input_path, limit=3)
    elif "openalex" in fmt:
        sample_records = parse_openalex_json(input_path, limit=3)

    summary = {
        "filepath": input_path,
        "detected_format": fmt,
        "sample_count": len(sample_records),
        "fields": list(sample_records[0].keys()) if sample_records else [],
        "first_record_preview": sample_records[0] if sample_records else {}
    }

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        print(f"Inspection summary written to {args.output}")
    else:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="CLI for Bibliographic Corpus Parser")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: parse
    p_parse = subparsers.add_parser("parse", help="Parse and normalize raw bibliographic file")
    p_parse.add_argument("--input", required=True, help="Path to raw bibliographic file")
    p_parse.add_argument("--output", required=True, help="Path to output file (.parquet, .csv, or .json)")
    p_parse.add_argument("--format", choices=["auto", "scopus-csv", "wos-plain", "ris", "openalex-json"], default="auto", help="Input format (default: auto)")
    p_parse.add_argument("--limit", type=int, default=None, help="Maximum number of records to parse")
    p_parse.set_defaults(func=cmd_parse)

    # Subcommand: inspect
    p_inspect = subparsers.add_parser("inspect", help="Inspect raw bibliographic file format and schema")
    p_inspect.add_argument("--input", required=True, help="Path to raw bibliographic file")
    p_inspect.add_argument("--output", help="Optional path to output inspection summary JSON")
    p_inspect.set_defaults(func=cmd_inspect)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
