#!/usr/bin/env python3
"""
CLI Helper: Neural Longitudinal Mapping (SOM Warm-Start Chaining)
Based on:
  Jimenez-Andrade, J. L., Marti-Lahera, Y., & Carrillo-Calvet, H. (2024).
  Neural longitudinal mapping of multidimensional performance profiles of Latin American universities.
  Iberoamerican Journal of Science Measurement and Communication, 4(1), 1-16.
"""

import sys
import os
import re
import json
import csv
import math
import argparse
from collections import defaultdict, Counter
from typing import Dict, List, Any, Optional, Tuple, Set

# Ensure knomap engine is in sys.path for direct local execution
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
KNOMAP_ENGINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", ".."))
if not os.path.exists(os.path.join(KNOMAP_ENGINE_DIR, "main_engine.py")):
    KNOMAP_ENGINE_DIR = "/home/labsom/knomap/engine"

if KNOMAP_ENGINE_DIR not in sys.path and os.path.exists(KNOMAP_ENGINE_DIR):
    sys.path.insert(0, KNOMAP_ENGINE_DIR)


def extract_year(val: Any) -> Optional[int]:
    """Extracts a valid 4-digit calendar year (1800-2100) from diverse formats."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        try:
            if not math.isnan(val) and 1800 <= int(val) <= 2100:
                return int(val)
        except (ValueError, TypeError):
            pass
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    m = re.search(r'\b(1[89]\d\d|20\d\d)\b', val_str)
    if m:
        return int(m.group(1))
    return None


def parse_period_string(period_str: str) -> Tuple[int, int, str]:
    """Parses 'YYYY-YYYY', 'YYYY:YYYY', or 'YYYY' into (start_year, end_year, label)."""
    p = str(period_str).strip()
    if "-" in p:
        parts = p.split("-")
        s, e = int(parts[0].strip()), int(parts[1].strip())
        return min(s, e), max(s, e), f"{min(s, e)}-{max(s, e)}"
    elif ":" in p:
        parts = p.split(":")
        s, e = int(parts[0].strip()), int(parts[1].strip())
        return min(s, e), max(s, e), f"{min(s, e)}-{max(s, e)}"
    else:
        y = int(p)
        return y, y, str(y)


def generate_period_windows(
    years_list: List[int],
    window_size: int = 5,
    step_size: Optional[int] = None
) -> List[Tuple[str, int, int]]:
    """
    Generates sequence of windows [(label, start_year, end_year), ...].
    If step_size is None or equal to window_size, windows are consecutive/disjoint.
    If step_size < window_size, windows are sliding/overlapping.
    """
    clean_years = sorted(list({y for y in years_list if y and 1800 <= y <= 2100}))
    if not clean_years:
        return []

    w = max(1, int(window_size))
    s = max(1, int(step_size)) if step_size is not None else w

    if w == 1 and s == 1:
        return [(str(y), y, y) for y in clean_years]

    min_y = clean_years[0]
    max_y = clean_years[-1]

    windows = []
    cur_start = min_y
    while cur_start <= max_y:
        cur_end = min(cur_start + w - 1, max_y)
        label = f"{cur_start}-{cur_end}" if cur_start != cur_end else str(cur_start)
        if any(cur_start <= y <= cur_end for y in clean_years):
            windows.append((label, cur_start, cur_end))
        if cur_start + s > max_y:
            break
        cur_start += s

    return windows


def cmd_prepare(args):
    """
    Ingests tabular CSV, Parquet, or JSON dataset and formats it into the standard
    longitudinal periods structure for KnoMap.
    Supports temporal windowing (--window, --step, --periods) and indicator aggregation.
    """
    input_path = args.input
    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: Input file does not exist: {input_path}\n")
        sys.exit(1)

    periods_data: Dict[str, Dict[str, Any]] = {}
    indicators: List[str] = []
    lower_path = input_path.lower()

    if lower_path.endswith(".json"):
        with open(input_path, "r", encoding="utf-8") as f:
            raw_json = json.load(f)

        if isinstance(raw_json, dict) and "periods_data" in raw_json:
            periods_data = raw_json["periods_data"]
            indicators = raw_json.get("indicators", [])
        elif isinstance(raw_json, dict) and any(isinstance(v, dict) and "data" in v for v in raw_json.values()):
            periods_data = raw_json
        else:
            records = raw_json.get("results") or raw_json.get("records") or raw_json.get("data") if isinstance(raw_json, dict) else raw_json
            if isinstance(records, list) and records and isinstance(records[0], dict):
                rows = records
                fieldnames = list(records[0].keys())
            else:
                sys.stderr.write("Error: Unrecognized JSON structure for longitudinal data.\n")
                sys.exit(1)
            return _process_tabular_rows(rows, fieldnames, args)

    elif lower_path.endswith(".parquet"):
        import pandas as pd
        df = pd.read_parquet(input_path)
        fieldnames = list(df.columns)
        rows = df.to_dict(orient="records")
        return _process_tabular_rows(rows, fieldnames, args)

    elif lower_path.endswith(".csv"):
        with open(input_path, "r", encoding="utf-8-sig", errors="replace") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            rows = list(reader)
        return _process_tabular_rows(rows, fieldnames, args)

    else:
        sys.stderr.write(f"Error: Unsupported file extension for input: {input_path} (Use .parquet, .csv, or .json)\n")
        sys.exit(1)

    sorted_periods = sorted(list(periods_data.keys()))
    if len(sorted_periods) < 2:
        sys.stderr.write(f"Error: Longitudinal analysis requires at least 2 distinct periods. Found: {sorted_periods}\n")
        sys.exit(1)

    prepared_payload = {
        "periods": sorted_periods,
        "indicators": indicators,
        "periods_data": periods_data
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(prepared_payload, f, indent=2, ensure_ascii=False)

    print(f"Success! Prepared longitudinal series with {len(sorted_periods)} periods ({sorted_periods[0]} to {sorted_periods[-1]}).")
    print(f"File written to: {args.output}")


def _process_tabular_rows(rows: List[Dict[str, Any]], fieldnames: List[str], args):
    """Processes tabular rows into longitudinal periods_data."""
    entity_col = args.entity_col or next(
        (c for c in fieldnames if c.lower() in ["entity", "university", "institution", "name", "id", "universidad", "researcher", "author"]),
        None
    )
    period_col = args.period_col or next(
        (c for c in fieldnames if c.lower() in ["year", "period", "anio", "periodo", "fecha", "time", "publication_year"]),
        None
    )

    if not entity_col or not period_col:
        sys.stderr.write(f"Error: Could not identify entity column ({entity_col}) or period column ({period_col}). Specify via --entity-col and --period-col.\n")
        sys.exit(1)

    if args.indicator_cols:
        indicators = [c.strip() for c in args.indicator_cols.split(",") if c.strip() in fieldnames]
    else:
        indicators = [c for c in fieldnames if c not in [entity_col, period_col]]

    valid_indicators = []
    sample_rows = rows[:200]
    for ind in indicators:
        can_float = any(r.get(ind) is not None and str(r.get(ind)).strip() != "" for r in sample_rows)
        if can_float:
            valid_indicators.append(ind)
    indicators = valid_indicators

    if not indicators:
        sys.stderr.write("Error: No numeric indicator columns found for longitudinal analysis.\n")
        sys.exit(1)

    periods_data: Dict[str, Dict[str, Any]] = {}
    use_windowing = bool(args.window or args.periods or args.last_years)
    agg_method = args.agg or "mean"

    if use_windowing:
        all_years = [extract_year(r.get(period_col)) for r in rows if extract_year(r.get(period_col)) is not None]
        if not all_years:
            sys.stderr.write(f"Error: Could not extract integer publication years from column '{period_col}' for windowing.\n")
            sys.exit(1)

        if args.periods:
            windows = [parse_period_string(p) for p in args.periods.split(",") if p.strip()]
        else:
            if args.last_years and args.last_years > 0:
                max_y = max(all_years)
                all_years = [y for y in all_years if y >= max_y - args.last_years + 1]
            windows = generate_period_windows(all_years, window_size=args.window or 5, step_size=args.step)

        for label, start_yr, end_yr in windows:
            period_rows = [
                r for r in rows
                if extract_year(r.get(period_col)) is not None and start_yr <= extract_year(r.get(period_col)) <= end_yr
            ]
            if not period_rows:
                continue

            entity_rows = defaultdict(list)
            for r in period_rows:
                ent_name = str(r.get(entity_col, "")).strip()
                if ent_name:
                    entity_rows[ent_name].append(r)

            sorted_entities = sorted(list(entity_rows.keys()))
            data_matrix = []
            for ent in sorted_entities:
                e_items = entity_rows[ent]
                row_vec = []
                for ind in indicators:
                    vals = []
                    for it in e_items:
                        try:
                            v = float(it.get(ind, 0.0))
                            if not math.isnan(v):
                                vals.append(v)
                        except (ValueError, TypeError):
                            pass

                    if not vals:
                        val = 0.0
                    elif agg_method == "sum":
                        val = sum(vals)
                    elif agg_method == "last":
                        val = vals[-1]
                    else:
                        val = sum(vals) / len(vals)
                    row_vec.append(round(val, 4))
                data_matrix.append(row_vec)

            periods_data[label] = {
                "data": data_matrix,
                "labels": sorted_entities,
                "doc_count": len(sorted_entities),
                "start_year": start_yr,
                "end_year": end_yr
            }

    else:
        period_groups: Dict[str, List[Dict[str, Any]]] = {}
        for r in rows:
            p_val = str(r[period_col]).strip()
            if not p_val:
                continue
            period_groups.setdefault(p_val, []).append(r)

        for p_key in sorted(period_groups.keys()):
            group = period_groups[p_key]
            labels = []
            data_matrix = []
            for item in group:
                ent_name = str(item.get(entity_col, "")).strip()
                row_vec = []
                for ind in indicators:
                    try:
                        val = float(item.get(ind, 0.0))
                        if math.isnan(val):
                            val = 0.0
                    except (ValueError, TypeError):
                        val = 0.0
                    row_vec.append(round(val, 4))
                labels.append(ent_name)
                data_matrix.append(row_vec)

            periods_data[p_key] = {
                "data": data_matrix,
                "labels": labels,
                "doc_count": len(labels)
            }

    sorted_periods = sorted(list(periods_data.keys()))
    if len(sorted_periods) < 2:
        sys.stderr.write(f"Error: Longitudinal analysis requires at least 2 distinct periods. Found: {sorted_periods}\n")
        sys.exit(1)

    # Panel Balance Audit
    all_entity_sets = [set(periods_data[p]["labels"]) for p in sorted_periods]
    total_unique_entities = len(set.union(*all_entity_sets))
    core_entities = len(set.intersection(*all_entity_sets))
    is_balanced = (core_entities == total_unique_entities)

    prepared_payload = {
        "periods": sorted_periods,
        "indicators": indicators,
        "periods_data": periods_data,
        "metadata": {
            "entity_column": entity_col,
            "period_column": period_col,
            "total_unique_entities": total_unique_entities,
            "core_persistent_entities": core_entities,
            "balanced_panel": is_balanced,
            "aggregation": agg_method if use_windowing else "direct"
        }
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(prepared_payload, f, indent=2, ensure_ascii=False)

    balance_str = "Balanced" if is_balanced else f"Unbalanced ({core_entities}/{total_unique_entities} persistent)"
    print(f"Success! Prepared longitudinal series with {len(sorted_periods)} periods ({sorted_periods[0]} to {sorted_periods[-1]}).")
    print(f"Entities: {total_unique_entities} unique [{balance_str}]. Indicators: {len(indicators)} dimensions.")
    print(f"File written to: {args.output}")


def cmd_train(args):
    """
    Trains Longitudinal SOM using Warm-Start Chaining protocol.
    Supports direct GPU/PyTorch execution or HTTP call to KnoMap backend.
    """
    if not os.path.exists(args.input):
        sys.stderr.write(f"Error: Input file does not exist: {args.input}\n")
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        prep_data = json.load(f)

    periods_data = prep_data.get("periods_data", prep_data)
    rows = int(args.rows)
    cols = int(args.cols)
    base_epochs = int(args.base_epochs)
    refine_epochs = int(args.refine_epochs)
    base_lr = float(args.base_lr)
    refine_lr = float(args.refine_lr)

    grid_avg = (rows + cols) / 2.0
    base_sigma = args.base_sigma if args.base_sigma is not None else round(0.5 * grid_avg, 2)
    refine_sigma = args.refine_sigma if args.refine_sigma is not None else round(0.125 * grid_avg, 3)

    payload = {
        "periods_data": periods_data,
        "rows": rows,
        "cols": cols,
        "iterations": base_epochs,
        "refine_iterations": refine_epochs,
        "method": "basic",
        "learning_rate": base_lr,
        "refine_learning_rate": refine_lr,
        "sigma": base_sigma,
        "refine_sigma": refine_sigma,
        "clustering_algorithm": args.clustering or "dbscan",
        "n_clusters": args.n_clusters or 4,
        "eps": args.eps or 0.5,
        "min_samples": args.min_samples or 3,
        "run_umap": False
    }

    results = None

    if args.api_url:
        import urllib.request
        import urllib.error
        url = args.api_url.rstrip("/")
        if not url.endswith("/api/som/train-longitudinal"):
            url = f"{url}/api/som/train-longitudinal"

        req_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                results = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to train via HTTP API ({url}): {e}\nFalling back to local Python engine.\n")

    if results is None:
        try:
            from main_engine import handle_train_longitudinal
            results = handle_train_longitudinal(payload)
        except ImportError as e:
            sys.stderr.write(f"Error: Could not import handle_train_longitudinal from KnoMap engine: {e}\n")
            sys.exit(1)

    if not results or not results.get("success"):
        err_msg = results.get("error", "Unknown engine error") if results else "Empty response"
        sys.stderr.write(f"Error during longitudinal training: {err_msg}\n")
        sys.exit(1)

    results["hyperparameters"] = {
        "rows": rows,
        "cols": cols,
        "base_epochs": base_epochs,
        "refine_epochs": refine_epochs,
        "base_lr": base_lr,
        "refine_lr": refine_lr,
        "base_sigma": base_sigma,
        "refine_sigma": refine_sigma,
        "grid_avg": grid_avg
    }
    if "indicators" in prep_data:
        results["indicators"] = prep_data["indicators"]
    if "metadata" in prep_data:
        results["metadata"] = prep_data["metadata"]

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"Success! Trained {len(results.get('maps', {}))} longitudinal SOM maps.")
    print(f"Output saved to: {args.output}")


def cmd_analyze(args):
    """
    Performs Macro, Meso, and Micro level evolutionary analysis on the trained maps,
    including intertemporal growth rates (Delta %) and cohort turnover / persistence dynamics.
    """
    if not os.path.exists(args.input):
        sys.stderr.write(f"Error: Results file does not exist: {args.input}\n")
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        res = json.load(f)

    maps = res.get("maps", {})
    drift_metrics = res.get("drift_metrics", {})
    indicators = res.get("indicators", [])
    sorted_periods = sorted(list(maps.keys()))

    if len(sorted_periods) < 2:
        sys.stderr.write("Error: Need at least 2 period maps to analyze longitudinal dynamics.\n")
        sys.exit(1)

    # 1. Macro Analysis: Indicator boundaries and inter-period Delta %
    macro_analysis = {}
    for p_key in sorted_periods:
        m = maps[p_key]
        weights = m.get("weights", [])
        if weights and indicators:
            dim_stats = {}
            for d_idx, ind_name in enumerate(indicators):
                col_vals = [w[d_idx] for w in weights if len(w) > d_idx]
                if col_vals:
                    dim_stats[ind_name] = {
                        "min": round(min(col_vals), 2),
                        "mean": round(sum(col_vals) / len(col_vals), 2),
                        "max": round(max(col_vals), 2)
                    }
            macro_analysis[p_key] = dim_stats

    # Macro Transitions (Growth Rates Delta %)
    macro_transitions = {}
    for i in range(len(sorted_periods) - 1):
        p_prev = sorted_periods[i]
        p_curr = sorted_periods[i + 1]
        t_key = f"{p_prev} -> {p_curr}"
        t_stats = {}
        for ind in indicators:
            prev_m = macro_analysis.get(p_prev, {}).get(ind, {}).get("mean")
            curr_m = macro_analysis.get(p_curr, {}).get(ind, {}).get("mean")
            if prev_m is not None and curr_m is not None:
                growth = round(((curr_m - prev_m) / prev_m) * 100.0, 2) if prev_m != 0 else 0.0
                t_stats[ind] = {
                    "prev_mean": prev_m,
                    "curr_mean": curr_m,
                    "growth_pct": growth,
                    "delta": round(curr_m - prev_m, 3)
                }
        macro_transitions[t_key] = t_stats

    # 2. Meso Analysis: Cluster dynamics (Vesanto splits & merges)
    meso_analysis = []
    # 3. Micro Analysis: Entity displacements and singular profiles
    micro_analysis = {"displacements": {}, "singular_profiles": {}}
    # 4. Population Dynamics: Cohort turnover, persistence, entrants, and departures
    population_dynamics = {}
    all_period_entity_sets = []

    for i in range(len(sorted_periods) - 1):
        p_prev = sorted_periods[i]
        p_curr = sorted_periods[i + 1]
        m_prev = maps[p_prev]
        m_curr = maps[p_curr]

        # Support both camelCase (C# API) and snake_case (local Python engine)
        prev_labels = m_prev.get("mappedLabels") or m_prev.get("mapped_labels") or []
        curr_labels = m_curr.get("mappedLabels") or m_curr.get("mapped_labels") or []
        prev_hex = m_prev.get("hexGrid") or m_prev.get("hex_grid") or []
        curr_hex = m_curr.get("hexGrid") or m_curr.get("hex_grid") or []
        prev_clustering = m_prev.get("clustering") or []
        curr_clustering = m_curr.get("clustering") or []

        # Map entity -> neuron index -> cluster
        entity_pos_prev = {}
        for n_idx, labs in enumerate(prev_labels):
            hex_pt = prev_hex[n_idx] if n_idx < len(prev_hex) else {"x": 0.0, "y": 0.0}
            c_id = prev_clustering[n_idx] if n_idx < len(prev_clustering) else 0
            for lab in labs:
                entity_pos_prev[lab] = {"neuron": n_idx, "cluster": c_id, "x": hex_pt.get("x", 0.0), "y": hex_pt.get("y", 0.0)}

        entity_pos_curr = {}
        for n_idx, labs in enumerate(curr_labels):
            hex_pt = curr_hex[n_idx] if n_idx < len(curr_hex) else {"x": 0.0, "y": 0.0}
            c_id = curr_clustering[n_idx] if n_idx < len(curr_clustering) else 0
            for lab in labs:
                entity_pos_curr[lab] = {"neuron": n_idx, "cluster": c_id, "x": hex_pt.get("x", 0.0), "y": hex_pt.get("y", 0.0)}

        if i == 0:
            all_period_entity_sets.append(set(entity_pos_prev.keys()))
        all_period_entity_sets.append(set(entity_pos_curr.keys()))

        prev_entities = set(entity_pos_prev.keys())
        curr_entities = set(entity_pos_curr.keys())
        common_entities = prev_entities.intersection(curr_entities)
        entrants = sorted(list(curr_entities - prev_entities))
        departures = sorted(list(prev_entities - curr_entities))

        transition_key = f"{p_prev} -> {p_curr}"

        retention_rate = round(len(common_entities) / max(1, len(prev_entities)), 3)
        turnover_rate = round((len(entrants) + len(departures)) / max(1, len(prev_entities) + len(curr_entities)), 3)

        population_dynamics[transition_key] = {
            "prev_count": len(prev_entities),
            "curr_count": len(curr_entities),
            "retained_count": len(common_entities),
            "entrants_count": len(entrants),
            "departures_count": len(departures),
            "retention_rate": retention_rate,
            "turnover_rate": turnover_rate,
            "entrants_sample": entrants[:10],
            "departures_sample": departures[:10]
        }

        # Micro: Euclidean movement of entities
        moves = []
        for ent in common_entities:
            p0 = entity_pos_prev[ent]
            p1 = entity_pos_curr[ent]
            dx = p1["x"] - p0["x"]
            dy = p1["y"] - p0["y"]
            dist = (dx**2 + dy**2) ** 0.5
            c_change = (p0["cluster"] != p1["cluster"])
            moves.append({
                "entity": ent,
                "prev_cluster": p0["cluster"],
                "curr_cluster": p1["cluster"],
                "displacement": round(dist, 3),
                "cluster_changed": c_change
            })
        moves.sort(key=lambda x: x["displacement"], reverse=True)
        micro_analysis["displacements"][transition_key] = moves

        # Meso: Cluster transitions (splits & merges)
        cluster_transitions: Dict[int, Dict[int, List[str]]] = {}
        for ent in common_entities:
            c0 = entity_pos_prev[ent]["cluster"]
            c1 = entity_pos_curr[ent]["cluster"]
            cluster_transitions.setdefault(c0, {}).setdefault(c1, []).append(ent)

        splits = []
        for c0, dests in cluster_transitions.items():
            if len(dests) > 1:
                splits.append({
                    "from_cluster": c0,
                    "split_into": {c_dest: len(ents) for c_dest, ents in dests.items()},
                    "entities": dests
                })

        reverse_transitions: Dict[int, Dict[int, List[str]]] = {}
        for ent in common_entities:
            c0 = entity_pos_prev[ent]["cluster"]
            c1 = entity_pos_curr[ent]["cluster"]
            reverse_transitions.setdefault(c1, {}).setdefault(c0, []).append(ent)

        merges = []
        for c1, sources in reverse_transitions.items():
            if len(sources) > 1:
                merges.append({
                    "to_cluster": c1,
                    "merged_from": {c_src: len(ents) for c_src, ents in sources.items()},
                    "entities": sources
                })

        meso_analysis.append({
            "transition": transition_key,
            "splits_differentiation": splits,
            "merges_homogenization": merges
        })

    if all_period_entity_sets:
        persistent_core = sorted(list(set.intersection(*all_period_entity_sets)))
        entity_freq = Counter()
        for s in all_period_entity_sets:
            for e in s:
                entity_freq[e] += 1
        transient_entities = sorted([e for e, c in entity_freq.items() if c == 1])
    else:
        persistent_core = []
        transient_entities = []

    # Detect Singular Profiles per period
    for p_key in sorted_periods:
        m = maps[p_key]
        labs = m.get("mappedLabels") or m.get("mapped_labels") or []
        clustering = m.get("clustering") or []
        cluster_members: Dict[int, List[str]] = {}
        for n_idx, l_list in enumerate(labs):
            c_id = clustering[n_idx] if n_idx < len(clustering) else 0
            cluster_members.setdefault(c_id, []).extend(l_list)

        singulars = [ents[0] for c_id, ents in cluster_members.items() if len(ents) == 1]
        micro_analysis["singular_profiles"][p_key] = singulars

    analysis_result = {
        "periods": sorted_periods,
        "indicators": indicators,
        "macro": macro_analysis,
        "macro_transitions": macro_transitions,
        "meso": meso_analysis,
        "micro": micro_analysis,
        "population_dynamics": population_dynamics,
        "global_cohorts": {
            "persistent_core": persistent_core,
            "persistent_core_count": len(persistent_core),
            "transient_entities_count": len(transient_entities),
            "transient_entities_sample": transient_entities[:15]
        },
        "synaptic_drift": drift_metrics
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(analysis_result, f, indent=2, ensure_ascii=False)

    print(f"Success! Evolutionary analysis computed across Macro (Delta %), Meso, Micro, and Population Dynamics.")
    print(f"Persistent Core Entities: {len(persistent_core)} | Transient Entities: {len(transient_entities)}")
    print(f"Analysis saved to: {args.output}")


def cmd_report(args):
    """
    Generates a publication-grade Markdown report summarizing the longitudinal dynamics,
    including Macro indicators, cluster transitions, population retention, and synaptic drift.
    """
    if not os.path.exists(args.analysis):
        sys.stderr.write(f"Error: Analysis file not found: {args.analysis}\n")
        sys.exit(1)

    with open(args.analysis, "r", encoding="utf-8") as f:
        analysis = json.load(f)

    periods = analysis.get("periods", [])
    macro = analysis.get("macro", {})
    macro_trans = analysis.get("macro_transitions", {})
    meso = analysis.get("meso", [])
    micro = analysis.get("micro", {})
    pop = analysis.get("population_dynamics", {})
    cohorts = analysis.get("global_cohorts", {})
    drifts = analysis.get("synaptic_drift", {})

    lines = []
    lines.append("# Reporte de Dinámica Neurocomputacional Longitudinal (SOM)")
    lines.append("")
    lines.append(f"**Cortes Temporales Analizados:** {', '.join(periods)} ({len(periods)} periodos)")
    lines.append("**Protocolo Metodológico:** Jiménez-Andrade, Martí-Lahera & Carrillo-Calvet (2024), *IJSMC*.")
    lines.append("")

    if args.mode == "knomap_internal":
        lines.append("> [!TIP]")
        lines.append("> **Acción Directa KnoMap:** Puedes explorar interactivamente esta secuencia temporal en el **Reproductor Temporal** y la vista **Side-by-Side**.")
        lines.append("> `NavigateToTab: longitudinal`")
        lines.append("")

    # Macro Section
    lines.append("## 1. Nivel Macro: Evolución Sistémica y Componentes")
    lines.append("Evolución de los rangos de desempeño en las dimensiones clave:")
    lines.append("")

    first_p = periods[0] if periods else ""
    if first_p in macro:
        inds = list(macro[first_p].keys())
        lines.append("| Indicador / Dimensión | " + " | ".join([f"Media {p}" for p in periods]) + " |")
        lines.append("| :--- | " + " | ".join([":---:" for _ in periods]) + " |")
        for ind in inds:
            row = [f"**{ind}**"]
            for p in periods:
                mean_val = macro.get(p, {}).get(ind, {}).get("mean", "-")
                row.append(str(mean_val))
            lines.append("| " + " | ".join(row) + " |")
    lines.append("")

    # Macro Transitions (Growth Rates)
    if macro_trans:
        lines.append("### Tasas de Crecimiento Intertemporal (Δ% de la media):")
        trans_keys = list(macro_trans.keys())
        lines.append("| Dimensión | " + " | ".join([f"Δ% `{t}`" for t in trans_keys]) + " |")
        lines.append("| :--- | " + " | ".join([":---:" for _ in trans_keys]) + " |")
        for ind in inds:
            row = [f"**{ind}**"]
            for t in trans_keys:
                g_val = macro_trans.get(t, {}).get(ind, {}).get("growth_pct", "-")
                prefix = "+" if isinstance(g_val, (int, float)) and g_val > 0 else ""
                row.append(f"{prefix}{g_val}%" if g_val != "-" else "-")
            lines.append("| " + " | ".join(row) + " |")
        lines.append("")

    # Population Dynamics Section
    if pop or cohorts:
        lines.append("## 2. Dinámica de Cohortes y Retención de Entidades")
        if pop:
            lines.append("| Transición | Base Anterior | Retenidas | Nuevos Ingresos | Salidas | Tasa Retención |")
            lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")
            for t_name, p_data in pop.items():
                lines.append(
                    f"| `{t_name}` | {p_data['prev_count']} | {p_data['retained_count']} | "
                    f"+{p_data['entrants_count']} | -{p_data['departures_count']} | {round(p_data['retention_rate']*100, 1)}% |"
                )
            lines.append("")

        if cohorts:
            p_core = cohorts.get("persistent_core", [])
            lines.append(f"- **Núcleo Persistente (Presentes en el 100% de los periodos):** {len(p_core)} entidad(es).")
            if p_core:
                lines.append(f"  *{', '.join(p_core[:15])}{'...' if len(p_core) > 15 else ''}*")
            lines.append(f"- **Entidades Transitorias (1 solo periodo):** {cohorts.get('transient_entities_count', 0)} entidad(es).")
            lines.append("")

    # Meso Section
    lines.append("## 3. Nivel Meso: Dinámica de Clusters (Vesanto)")
    lines.append("Transiciones estructurales de perfiles cualitativos entre periodos consecutivos:")
    lines.append("")
    for trans in meso:
        t_name = trans.get("transition", "")
        splits = trans.get("splits_differentiation", [])
        merges = trans.get("merges_homogenization", [])

        lines.append(f"### Transición: `{t_name}`")
        if splits:
            lines.append(f"- **Diferenciación de Perfiles (Escisión de clusters):** {len(splits)} evento(s).")
            for sp in splits[:3]:
                ents_flat = [e for group in sp.get("entities", {}).values() for e in group]
                lines.append(f"  - Cluster origen #{sp['from_cluster']} se divide entre: {', '.join(ents_flat[:4])}...")
        else:
            lines.append("- *No se registraron escisiones mayores de clusters.*")

        if merges:
            lines.append(f"- **Homogeneización de Perfiles (Fusión de clusters):** {len(merges)} evento(s).")
            for mg in merges[:3]:
                lines.append(f"  - Convergencia hacia cluster destino #{mg['to_cluster']}.")
        lines.append("")

    # Micro Section
    lines.append("## 4. Nivel Micro: Trayectorias y Perfiles Singulares")
    lines.append("")
    lines.append("### Perfiles Singulares por Periodo (Entidades con perfil cualitativo único):")
    singulars = micro.get("singular_profiles", {})
    for p, sing_list in singulars.items():
        if sing_list:
            lines.append(f"- **{p}:** {', '.join(sing_list)}")
        else:
            lines.append(f"- **{p}:** *(Sin perfiles singulares aislados)*")
    lines.append("")

    # Top displacements
    displacements = micro.get("displacements", {})
    if displacements:
        lines.append("### Mayores Desplazamientos en la Cuadrícula Hexagonal (Δx, Δy):")
        for t_name, moves in displacements.items():
            lines.append(f"**{t_name}:**")
            top_moves = moves[:5]
            for m in top_moves:
                c_alert = " ⚡ *(cambió de cluster)*" if m.get("cluster_changed") else ""
                lines.append(f"- **{m['entity']}**: Desplazamiento = {m['displacement']} hex{c_alert}")
        lines.append("")

    # Synaptic Drift Section
    lines.append("## 5. Deriva Sináptica Intertemporal (Tensión Adaptativa ΔW)")
    lines.append("| Transición | Deriva Máxima (ΔW max) | Deriva Promedio |")
    lines.append("| :--- | :---: | :---: |")
    for t_name, d_obj in drifts.items():
        max_d = d_obj.get("max_drift", "-")
        mean_d = round(sum(d_obj.get("raw_drift", [0])) / max(1, len(d_obj.get("raw_drift", [1]))), 3) if "raw_drift" in d_obj else "-"
        lines.append(f"| `{t_name}` | {max_d} | {mean_d} |")
    lines.append("")

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Success! Generated publication-grade longitudinal report.")
    print(f"Report written to: {args.output}")


def main():
    parser = argparse.ArgumentParser(description="Neural Longitudinal Mapping CLI (SOM Warm-Start Chaining)")
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # Subcommand: prepare
    p_prep = subparsers.add_parser("prepare", help="Prepare longitudinal dataset from Parquet, CSV, or JSON")
    p_prep.add_argument("--input", required=True, help="Path to input Parquet, CSV, or JSON")
    p_prep.add_argument("--entity-col", help="Column name for entity/university identifier")
    p_prep.add_argument("--period-col", help="Column name for year/period identifier")
    p_prep.add_argument("--indicator-cols", help="Comma-separated list of indicator column names")
    p_prep.add_argument("--window", type=int, default=None, help="Window size in years (e.g. 5 or 10)")
    p_prep.add_argument("--step", type=int, default=None, help="Step size in years (default: same as window)")
    p_prep.add_argument("--periods", type=str, default=None, help="Explicit periods list (e.g. '2010-2014,2015-2019')")
    p_prep.add_argument("--last-years", type=int, default=None, help="Filter last N years relative to max year")
    p_prep.add_argument("--agg", choices=["mean", "sum", "last"], default="mean", help="Indicator aggregation method per entity window (default: mean)")
    p_prep.add_argument("--output", required=True, help="Path to write prepared_series.json")
    p_prep.set_defaults(func=cmd_prepare)

    # Subcommand: train
    p_train = subparsers.add_parser("train", help="Train longitudinal SOMs using Warm-Start Chaining")
    p_train.add_argument("--input", required=True, help="Path to prepared_series.json")
    p_train.add_argument("--rows", default=10, type=int, help="Grid rows (default: 10)")
    p_train.add_argument("--cols", default=20, type=int, help="Grid cols (default: 20)")
    p_train.add_argument("--base-epochs", default=1000, type=int, help="Epochs for Period 1 (default: 1000)")
    p_train.add_argument("--refine-epochs", default=200, type=int, help="Epochs for refinement (default: 200)")
    p_train.add_argument("--base-lr", default=0.9, type=float, help="Base learning rate alpha_0 (default: 0.9)")
    p_train.add_argument("--refine-lr", default=0.1, type=float, help="Refine learning rate alpha (default: 0.1)")
    p_train.add_argument("--base-sigma", type=float, help="Base sigma (default: auto 0.5 * grid_avg)")
    p_train.add_argument("--refine-sigma", type=float, help="Refine sigma (default: auto 0.125 * grid_avg)")
    p_train.add_argument("--clustering", default="dbscan", help="Clustering algorithm (default: dbscan)")
    p_train.add_argument("--n-clusters", default=4, type=int, help="Target clusters if kmeans (default: 4)")
    p_train.add_argument("--eps", default=0.5, type=float, help="DBSCAN eps")
    p_train.add_argument("--min-samples", default=3, type=int, help="DBSCAN min_samples")
    p_train.add_argument("--api-url", help="Optional KnoMap HTTP backend URL (e.g. http://localhost:5015)")
    p_train.add_argument("--output", required=True, help="Path to write longitudinal_results.json")
    p_train.set_defaults(func=cmd_train)

    # Subcommand: analyze
    p_ana = subparsers.add_parser("analyze", help="Compute Macro, Meso, Micro, and Population dynamics")
    p_ana.add_argument("--input", required=True, help="Path to longitudinal_results.json")
    p_ana.add_argument("--output", required=True, help="Path to write dynamics_analysis.json")
    p_ana.set_defaults(func=cmd_analyze)

    # Subcommand: report
    p_rep = subparsers.add_parser("report", help="Generate publication-ready markdown report")
    p_rep.add_argument("--analysis", required=True, help="Path to dynamics_analysis.json")
    p_rep.add_argument("--mode", choices=["knomap_internal", "external_mcp"], default="external_mcp", help="Report mode")
    p_rep.add_argument("--output", required=True, help="Path to write report.md")
    p_rep.set_defaults(func=cmd_report)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
