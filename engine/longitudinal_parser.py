"""
Module: longitudinal_parser.py
Extracts and parses multi-period tabular datasets from compressed archives (.7z, .zip, .tar.gz)
for longitudinal Self-Organizing Map (SOM) training and evolutionary analysis.
"""

import os
import re
import csv
import json
import shutil
import tempfile
import subprocess
from typing import Dict, Any, List, Optional, Tuple


def _extract_archive(archive_path: str, target_dir: str) -> List[str]:
    """
    Extracts an archive (.7z, .zip, .tar.gz, .tar) into target_dir
    and returns a list of extracted file paths.
    """
    ext = os.path.splitext(archive_path)[1].lower()
    
    # Try 7z CLI first if available (supports .7z, .zip, .tar, .gz, etc.)
    p7z_binary = shutil.which("7z") or shutil.which("7za")
    if p7z_binary:
        proc = subprocess.run([p7z_binary, "x", "-y", archive_path, f"-o{target_dir}"], capture_output=True, text=True)
        if proc.returncode == 0:
            return _collect_extracted_files(target_dir)

    # Fallback to Python standard library for zip and tar
    if ext == ".zip":
        import zipfile
        with zipfile.ZipFile(archive_path, 'r') as zf:
            zf.extractall(target_dir)
        return _collect_extracted_files(target_dir)

    if ext in [".tar", ".gz", ".tgz", ".bz2"]:
        import tarfile
        with tarfile.open(archive_path, 'r:*') as tf:
            tf.extractall(target_dir)
        return _collect_extracted_files(target_dir)

    # Optional py7zr fallback
    if ext == ".7z":
        try:
            import py7zr
            with py7zr.SevenZipFile(archive_path, mode='r') as z:
                z.extractall(path=target_dir)
            return _collect_extracted_files(target_dir)
        except ImportError:
            pass

    raise RuntimeError(f"Cannot extract archive '{archive_path}'. Ensure 7z or appropriate archive utility is installed.")


def _collect_extracted_files(directory: str) -> List[str]:
    extracted = []
    for root, _, files in os.walk(directory):
        for f in files:
            # Ignore hidden files, system files, and macOS artifacts
            if f.startswith(".") or f.startswith("__MACOSX"):
                continue
            extracted.append(os.path.join(root, f))
    return extracted


def _detect_period(filename: str) -> str:
    """
    Detects period/year from filename using regex or fallback to file stem.
    e.g. '2024_QS.txt' -> '2024'
         'ranking_2016-2020.csv' -> '2016-2020'
         'period_1.tsv' -> 'Period 1'
    """
    base = os.path.basename(filename)
    stem, _ = os.path.splitext(base)

    # Check for range: e.g. 2016-2020 or 2016_2020
    range_match = re.search(r"((?:19|20)\d{2}[-_](?:19|20)\d{2})", stem)
    if range_match:
        return range_match.group(1).replace("_", "-")

    # Check for 4-digit year: e.g. 2024
    year_match = re.search(r"((?:19|20)\d{2})", stem)
    if year_match:
        return year_match.group(1)

    # Fallback to sanitized stem
    clean_stem = re.sub(r"[_-]", " ", stem).strip()
    return clean_stem if clean_stem else stem


def _parse_tabular_file(file_path: str) -> Tuple[List[str], List[str], List[List[float]]]:
    """
    Parses a CSV/TSV/TXT tabular file.
    Returns: (indicators_header, labels_list, data_matrix)
    """
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        first_line = f.readline()
        if not first_line:
            return [], [], []

        # Detect delimiter
        if ";" in first_line:
            delimiter = ";"
        elif "\t" in first_line:
            delimiter = "\t"
        elif "," in first_line:
            delimiter = ","
        else:
            delimiter = None

        f.seek(0)
        if delimiter:
            reader = csv.reader(f, delimiter=delimiter)
        else:
            reader = csv.reader(f)

        raw_rows = [r for r in reader if r and any(cell.strip() for cell in r)]
        if not raw_rows:
            return [], [], []

        header = [c.strip() for c in raw_rows[0]]
        data_rows = raw_rows[1:]

        # Identify which column contains entity/row label
        label_col_idx = 0
        found_explicit = False
        for idx, col_name in enumerate(header):
            c_low = col_name.lower().strip()
            if any(k in c_low for k in ["university", "universidad", "entity", "institution", "institucion", "name", "nombre", "label"]):
                label_col_idx = idx
                found_explicit = True
                break
        if not found_explicit:
            for idx, col_name in enumerate(header):
                c_low = col_name.lower().strip()
                if "rank" in c_low or "id" in c_low:
                    label_col_idx = idx
                    break

        # Determine numeric feature columns
        feature_indices = []
        feature_names = []
        for idx, col_name in enumerate(header):
            if idx == label_col_idx:
                continue
            if col_name.strip().lower() in ("rank", "id", "identifier", "#"):
                continue
            # Test if at least some rows have numeric values in this column
            numeric_count = 0
            for r in data_rows[:20]:
                if idx < len(r):
                    val_str = r[idx].strip().replace(",", ".")
                    try:
                        float(val_str)
                        numeric_count += 1
                    except ValueError:
                        pass
            if numeric_count > 0:
                feature_indices.append(idx)
                feature_names.append(col_name)

        labels = []
        matrix = []
        for r in data_rows:
            raw_label = r[label_col_idx].strip() if label_col_idx < len(r) else f"Row {len(labels)+1}"
            # Clean label if starts with '=' (like '=17' in rankings)
            clean_label = raw_label.lstrip("=").strip()
            labels.append(clean_label if clean_label else f"Row {len(labels)+1}")

            vec = []
            for f_idx in feature_indices:
                val = 0.0
                if f_idx < len(r):
                    val_str = r[f_idx].strip().replace(",", ".")
                    try:
                        val = float(val_str)
                    except ValueError:
                        val = 0.0
                vec.append(val)
            matrix.append(vec)

        return feature_names, labels, matrix


def parse_archive(archive_path: str) -> Dict[str, Any]:
    """
    Main entrypoint: extracts and processes an archive of longitudinal files.
    """
    if not os.path.exists(archive_path):
        return {"success": False, "error": f"Archive path does not exist: {archive_path}"}

    temp_extract_dir = tempfile.mkdtemp(prefix="knomap_longitudinal_")
    try:
        extracted_files = _extract_archive(archive_path, temp_extract_dir)
        # Filter supported data extensions
        valid_exts = {".csv", ".txt", ".tsv", ".dat"}
        data_files = [f for f in extracted_files if os.path.splitext(f)[1].lower() in valid_exts]

        if not data_files:
            return {
                "success": False,
                "error": f"No valid CSV/TXT tabular data files found inside archive '{os.path.basename(archive_path)}'."
            }

        # Parse each file and associate with period
        periods_map = {}
        all_feature_sets = []

        for f_path in data_files:
            period_key = _detect_period(f_path)
            feat_names, labels, matrix = _parse_tabular_file(f_path)
            if matrix and feat_names:
                periods_map[period_key] = {
                    "file": os.path.basename(f_path),
                    "features": feat_names,
                    "labels": labels,
                    "data": matrix,
                    "doc_count": len(matrix)
                }
                all_feature_sets.append(feat_names)

        if len(periods_map) < 2:
            return {
                "success": False,
                "error": f"Found only {len(periods_map)} valid period(s). Longitudinal analysis requires at least 2 distinct periods."
            }

        sorted_periods = sorted(list(periods_map.keys()))

        # Determine reference indicators (intersect or take common header from Period 1)
        ref_features = periods_map[sorted_periods[0]]["features"]
        
        # Build normalized subperiod matrices
        periods_data = {}
        for p_key in sorted_periods:
            p_obj = periods_map[p_key]
            # Harmonize column ordering to match ref_features
            orig_feats = p_obj["features"]
            if orig_feats == ref_features:
                aligned_data = p_obj["data"]
            else:
                feat_to_idx = {name: i for i, name in enumerate(orig_feats)}
                aligned_data = []
                for row in p_obj["data"]:
                    aligned_row = [row[feat_to_idx[feat]] if feat in feat_to_idx else 0.0 for feat in ref_features]
                    aligned_data.append(aligned_row)

            # Try to infer start and end year integers
            year_matches = re.findall(r"\d{4}", p_key)
            start_yr = int(year_matches[0]) if year_matches else 0
            end_yr = int(year_matches[-1]) if year_matches else start_yr

            periods_data[p_key] = {
                "data": aligned_data,
                "labels": p_obj["labels"],
                "doc_count": p_obj["doc_count"],
                "start_year": start_yr,
                "end_year": end_yr
            }

        return {
            "success": True,
            "archive_name": os.path.basename(archive_path),
            "periods": sorted_periods,
            "indicators": ref_features,
            "periods_data": periods_data
        }

    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": f"Exception while parsing longitudinal archive: {str(e)}",
            "traceback": traceback.format_exc()
        }
    finally:
        shutil.rmtree(temp_extract_dir, ignore_errors=True)
