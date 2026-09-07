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
import json
import argparse
from typing import Dict, List, Any, Optional

# Ensure knomap engine is in sys.path for direct local execution
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
KNOMAP_ENGINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", ".."))
if not os.path.exists(os.path.join(KNOMAP_ENGINE_DIR, "main_engine.py")):
    KNOMAP_ENGINE_DIR = "/home/labsom/knomap/engine"

if KNOMAP_ENGINE_DIR not in sys.path and os.path.exists(KNOMAP_ENGINE_DIR):
    sys.path.insert(0, KNOMAP_ENGINE_DIR)


def cmd_prepare(args):
    """
    Ingests tabular CSV or JSON sequence and formats it into the standard
    longitudinal periods structure for KnoMap.
    """
    input_path = args.input
    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: Input file does not exist: {input_path}\n")
        sys.exit(1)

    periods_data: Dict[str, Dict[str, Any]] = {}
    indicators: List[str] = []

    if input_path.endswith(".json"):
        with open(input_path, "r", encoding="utf-8") as f:
            raw_json = json.load(f)

        if "periods_data" in raw_json:
            periods_data = raw_json["periods_data"]
            indicators = raw_json.get("indicators", [])
        else:
            # Assume dictionary of period -> { data: [...], labels: [...] }
            periods_data = raw_json

    elif input_path.endswith(".csv"):
        import csv
        with open(input_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            
            # Detect entity and period columns
            entity_col = args.entity_col or next((c for c in fieldnames if c.lower() in ["entity", "university", "institution", "name", "id", "universidad"]), None)
            period_col = args.period_col or next((c for c in fieldnames if c.lower() in ["year", "period", "anio", "periodo", "fecha", "time"]), None)
            
            if not entity_col or not period_col:
                sys.stderr.write(f"Error: Could not identify entity column ({entity_col}) or period column ({period_col}). Specify via --entity-col and --period-col.\n")
                sys.exit(1)

            if args.indicator_cols:
                indicators = [c.strip() for c in args.indicator_cols.split(",") if c.strip() in fieldnames]
            else:
                indicators = [c for c in fieldnames if c not in [entity_col, period_col]]

            # Filter indicators that can be converted to float
            valid_indicators = []
            rows = list(reader)
            for ind in indicators:
                can_float = any(r.get(ind, "").strip() != "" for r in rows)
                if can_float:
                    valid_indicators.append(ind)
            indicators = valid_indicators

            # Group rows by period
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
                    ent_name = str(item[entity_col]).strip()
                    row_vec = []
                    for ind in indicators:
                        try:
                            val = float(item.get(ind, 0.0))
                        except (ValueError, TypeError):
                            val = 0.0
                        row_vec.append(val)
                    labels.append(ent_name)
                    data_matrix.append(row_vec)

                periods_data[p_key] = {
                    "data": data_matrix,
                    "labels": labels,
                    "doc_count": len(labels)
                }
    else:
        sys.stderr.write(f"Error: Unsupported file extension for input: {input_path}\n")
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
    
    # Calculate canonical academic sigmas
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

    # Option A: Call via HTTP API if api_url is provided
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

    # Option B: Direct Python Engine execution (default or fallback)
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

    # Attach metadata
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

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"Success! Trained {len(results.get('maps', {}))} longitudinal SOM maps.")
    print(f"Output saved to: {args.output}")


def cmd_analyze(args):
    """
    Performs Macro, Meso, and Micro level evolutionary analysis on the trained maps.
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

    # 1. Macro Analysis: Indicator boundaries and shifts across periods
    macro_analysis = {}
    for p_key in sorted_periods:
        m = maps[p_key]
        weights = m.get("weights", [])
        if weights and indicators:
            n_dims = len(indicators)
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

    # 2. Meso Analysis: Cluster dynamics (splits / differentiations, merges / homogenizations)
    meso_analysis = []
    # 3. Micro Analysis: Entity displacements and singular profiles
    micro_analysis = {"displacements": {}, "singular_profiles": {}}

    for i in range(len(sorted_periods) - 1):
        p_prev = sorted_periods[i]
        p_curr = sorted_periods[i + 1]
        m_prev = maps[p_prev]
        m_curr = maps[p_curr]

        prev_labels = m_prev.get("mappedLabels", [])
        curr_labels = m_curr.get("mappedLabels", [])
        prev_hex = m_prev.get("hexGrid", [])
        curr_hex = m_curr.get("hexGrid", [])
        prev_clustering = m_prev.get("clustering", [])
        curr_clustering = m_curr.get("clustering", [])

        # Map entity -> neuron index -> cluster
        entity_pos_prev = {}
        for n_idx, (labs, hex_pt) in enumerate(zip(prev_labels, prev_hex)):
            c_id = prev_clustering[n_idx] if n_idx < len(prev_clustering) else 0
            for lab in labs:
                entity_pos_prev[lab] = {"neuron": n_idx, "cluster": c_id, "x": hex_pt["x"], "y": hex_pt["y"]}

        entity_pos_curr = {}
        for n_idx, (labs, hex_pt) in enumerate(zip(curr_labels, curr_hex)):
            c_id = curr_clustering[n_idx] if n_idx < len(curr_clustering) else 0
            for lab in labs:
                entity_pos_curr[lab] = {"neuron": n_idx, "cluster": c_id, "x": hex_pt["x"], "y": hex_pt["y"]}

        # Micro: Euclidean movement of entities
        common_entities = set(entity_pos_prev.keys()).intersection(set(entity_pos_curr.keys()))
        transition_key = f"{p_prev} -> {p_curr}"
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

        # Meso: Cluster transitions
        # Map cluster in prev to distribution of clusters in curr
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

        # Check merges (multiple c0 going to same c1)
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

    # Detect Singular Profiles per period
    for p_key in sorted_periods:
        m = maps[p_key]
        labs = m.get("mappedLabels", [])
        clustering = m.get("clustering", [])
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
        "meso": meso_analysis,
        "micro": micro_analysis,
        "synaptic_drift": drift_metrics
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(analysis_result, f, indent=2, ensure_ascii=False)

    print(f"Success! Evolutionary analysis computed across Macro, Meso, and Micro levels.")
    print(f"Analysis saved to: {args.output}")


def cmd_report(args):
    """
    Generates a publication-grade Markdown report summarizing the longitudinal dynamics.
    """
    if not os.path.exists(args.analysis):
        sys.stderr.write(f"Error: Analysis file not found: {args.analysis}\n")
        sys.exit(1)

    with open(args.analysis, "r", encoding="utf-8") as f:
        analysis = json.load(f)

    periods = analysis.get("periods", [])
    macro = analysis.get("macro", {})
    meso = analysis.get("meso", [])
    micro = analysis.get("micro", {})
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
    
    # Collect sample indicators from first period
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

    # Meso Section
    lines.append("## 2. Nivel Meso: Dinámica de Clusters (Vesanto)")
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
    lines.append("## 3. Nivel Micro: Trayectorias y Perfiles Singulares")
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
    lines.append("## 4. Deriva Sináptica Intertemporal (Tensión Adaptativa ΔW)")
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
    p_prep = subparsers.add_parser("prepare", help="Prepare longitudinal dataset from CSV or JSON")
    p_prep.add_argument("--input", required=True, help="Path to input CSV or JSON")
    p_prep.add_argument("--entity-col", help="Column name for entity/university identifier")
    p_prep.add_argument("--period-col", help="Column name for year/period identifier")
    p_prep.add_argument("--indicator-cols", help="Comma-separated list of indicator column names")
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
    p_ana = subparsers.add_parser("analyze", help="Compute Macro, Meso, and Micro dynamics")
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
