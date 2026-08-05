import os
import re
import json
import zipfile
import shutil
import tempfile
import pandas as pd
import numpy as np
import io
import warnings

# Suppress warnings that pollute stdout and break JSON parsing in C#
warnings.filterwarnings("ignore")

def identify_file_type(filename):
    """
    Returns (unit_type, period) by inspecting the filename.
    Handles the upload prefix added by C# backend (e.g. 'up_abc123_Incites Researchers.xlsx').
    """
    base = os.path.basename(filename)

    # Strip upload prefix like 'up_abc123_' before matching
    base_clean = re.sub(r'^up_[0-9a-fA-F]+_', '', base)

    period = "Whole"
    if re.search(r'Trend', base_clean, re.IGNORECASE):
        period = "Trend"
    elif re.search(r'\d{4}-\d{4}', base_clean):
        period = "5Years"

    unit = None
    b = base_clean  # shorthand

    # Order matters: more specific patterns first
    if   re.search(r'Micro\s+Topics', b, re.IGNORECASE):            unit = "Micro Topics"
    elif re.search(r'Meso\s+Topics', b, re.IGNORECASE):             unit = "Meso Topics"
    elif re.search(r'Macro\s+Topics', b, re.IGNORECASE):            unit = "Macro Topics"
    elif re.search(r'Research Areas.*ESI|ESI', b, re.IGNORECASE):   unit = "ESI"
    elif re.search(r'Research Areas.*SDG|SDG', b, re.IGNORECASE):   unit = "SDG"
    elif re.search(r'Research Areas|WoS Categories', b, re.IGNORECASE): unit = "WoS Categories"
    elif re.search(r'Publication Sources|Journals', b, re.IGNORECASE):  unit = "Publication Sources"
    elif re.search(r'Funding Agencies|Funding', b, re.IGNORECASE):  unit = "Funding Agencies"
    elif re.search(r'Organizations|Institutions', b, re.IGNORECASE): unit = "Organizations"
    elif re.search(r'Locations|Countries', b, re.IGNORECASE):       unit = "Locations"
    elif re.search(r'Researchers|Authors', b, re.IGNORECASE):       unit = "Researchers"
    elif re.search(r'Patentometrics|Patents', b, re.IGNORECASE):    unit = "Patentometrics"

    return unit, period


def clean_and_read_file(filepath):
    try:
        if filepath.endswith('.csv'):
            df = pd.read_csv(filepath, on_bad_lines='skip')
        elif filepath.endswith('.xlsx'):
            df = pd.read_excel(filepath)
        else:
            return None

        df = df.dropna(how='all', axis=1)
        df = df.dropna(how='all', axis=0)
        return df
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
    return None


def calculate_ecma(series, window=3):
    return series.ewm(span=window, adjust=False).mean()


# ── Indicators that CANNOT be averaged across topics (must be summed) ───────
# Ratios / normalised indicators should be averaged; absolute counts summed.
SUMMABLE_INDICATORS = {
    'Web of Science Documents', 'Times Cited', 'Citations From Patents',
    'Documents in Top 1%', 'Documents in Top 10%',
    'Documents in Q1 Journals', 'Documents in Q2 Journals',
    'Documents in Q3 Journals', 'Documents in Q4 Journals',
    'Highly Cited Papers', 'Hot Papers',
    'All Open Access Documents', 'Gold Documents',
}


def _decode_topic_code(full_name: str):
    """
    Decode the InCites topic code embedded in the row label.
    Format: "MacroID.MesoID.MicroID Rest of name"
    e.g.  "1.23.456 Quantum Chemistry"
    Returns (macro_id, meso_id, micro_id, short_name) or None on failure.
    """
    try:
        parts = str(full_name).split(' ', 1)
        codes = parts[0].split('.')
        if len(codes) < 3:
            return None
        short = parts[1].strip() if len(parts) > 1 else parts[0]
        return codes[0], codes[1], codes[2], short
    except Exception:
        return None


def build_sunburst_from_micro_topics(df_micro, df_meso=None, df_macro=None, min_docs=0):
    """
    Build a Sunburst-ready node list from an InCites Micro Topics dataframe.

    The hierarchy Macro→Meso→Micro is inferred directly from the topic codes
    embedded in each row's index/name (e.g. "1.23.456 Topic name").
    No external Topics.txt is needed.

    For each numeric indicator the function produces TWO aggregation strategies:
      - 'sum'  : total absolute value (appropriate for counts like WoS Documents)
      - 'mean' : weighted average (appropriate for ratios like CNCI, % Top 10%)

    Returns a dict:
    {
      "nodes": [ { "id", "parent", "value", "level",
                   "indicators_sum": {...}, "indicators_mean": {...} }, ... ],
      "indicators": [ list of numeric indicator names ],
      "summable_indicators": [ indicators suitable for SUM aggregation ],
      "meanable_indicators":  [ indicators suitable for MEAN aggregation ]
    }
    """
    if df_micro is None or df_micro.empty:
        return None

    entity_col = df_micro.columns[0]
    # If the df has a proper index (entity name is the index), use it;
    # otherwise use the first column as entity name.
    if df_micro.index.dtype == object and df_micro.index[0] != 0:
        names = df_micro.index.tolist()
        df_work = df_micro.copy()
    else:
        names = df_micro[entity_col].tolist()
        df_work = df_micro.set_index(entity_col)

    numeric_cols = df_work.select_dtypes(include=[np.number]).columns.tolist()
    # Remove baseline rows
    baseline_mask = df_work.index.astype(str).str.contains(r'Baseline', case=False, na=False)
    df_work = df_work[~baseline_mask].copy()
    df_work[numeric_cols] = df_work[numeric_cols].fillna(0)

    # Apply min_docs filter
    if 'Web of Science Documents' in numeric_cols and min_docs > 0:
        df_work = df_work[df_work['Web of Science Documents'] > min_docs]

    # ── Build flat rows with decoded hierarchy ─────────────────────────
    macro_nodes = {}   # macro_name -> { sum_cols, count, weight_col }
    meso_nodes  = {}   # (macro_name, meso_name) -> { ... }
    micro_rows  = []

    for full_name, row in df_work.iterrows():
        decoded = _decode_topic_code(str(full_name))
        if decoded is None:
            continue
        macro_id, meso_id, micro_id, micro_name = decoded

        # Resolve macro / meso names from df_macro / df_meso if available,
        # otherwise use the code as the name
        macro_name = macro_id
        meso_name  = meso_id

        if df_macro is not None:
            for idx_m in df_macro.index:
                d = _decode_topic_code(str(idx_m))
                if d and d[0] == macro_id:
                    macro_name = d[3]
                    break

        if df_meso is not None:
            for idx_m in df_meso.index:
                d = _decode_topic_code(str(idx_m))
                if d and d[1] == meso_id:
                    meso_name = d[3]
                    break

        w = float(row.get('Web of Science Documents', 1) or 1)

        ind_vals = {c: float(row[c]) for c in numeric_cols}

        # Accumulate for meso
        meso_key = (macro_name, meso_name)
        if meso_key not in meso_nodes:
            meso_nodes[meso_key] = {'sum': {c: 0.0 for c in numeric_cols},
                                     'wsum': {c: 0.0 for c in numeric_cols},
                                     'weight': 0.0}
        meso_nodes[meso_key]['weight'] += w
        for c in numeric_cols:
            meso_nodes[meso_key]['sum'][c]  += ind_vals[c]
            meso_nodes[meso_key]['wsum'][c] += ind_vals[c] * w

        # Accumulate for macro
        if macro_name not in macro_nodes:
            macro_nodes[macro_name] = {'sum': {c: 0.0 for c in numeric_cols},
                                        'wsum': {c: 0.0 for c in numeric_cols},
                                        'weight': 0.0}
        macro_nodes[macro_name]['weight'] += w
        for c in numeric_cols:
            macro_nodes[macro_name]['sum'][c]  += ind_vals[c]
            macro_nodes[macro_name]['wsum'][c] += ind_vals[c] * w

        micro_rows.append({
            'id':     micro_name,
            'parent': meso_name,
            'level':  'Micro Topics',
            'value':  w,
            'indicators_sum':  ind_vals,
            'indicators_mean': ind_vals,   # leaf: both are the same
        })

    # ── Build meso nodes ──────────────────────────────────────────────
    meso_rows = []
    for (macro_name, meso_name), acc in meso_nodes.items():
        w = acc['weight'] if acc['weight'] > 0 else 1.0
        meso_rows.append({
            'id':     meso_name,
            'parent': macro_name,
            'level':  'Meso Topics',
            'value':  acc['sum'].get('Web of Science Documents', 0),
            'indicators_sum':  {c: acc['sum'][c]  for c in numeric_cols},
            'indicators_mean': {c: acc['wsum'][c] / w for c in numeric_cols},
        })

    # ── Build macro nodes ─────────────────────────────────────────────
    macro_rows = []
    for macro_name, acc in macro_nodes.items():
        w = acc['weight'] if acc['weight'] > 0 else 1.0
        macro_rows.append({
            'id':     macro_name,
            'parent': '',
            'level':  'Macro Topics',
            'value':  acc['sum'].get('Web of Science Documents', 0),
            'indicators_sum':  {c: acc['sum'][c]  for c in numeric_cols},
            'indicators_mean': {c: acc['wsum'][c] / w for c in numeric_cols},
        })

    all_nodes = macro_rows + meso_rows + micro_rows

    summable  = [c for c in numeric_cols if c in SUMMABLE_INDICATORS]
    meanable  = [c for c in numeric_cols if c not in SUMMABLE_INDICATORS]

    return {
        'nodes': all_nodes,
        'indicators': numeric_cols,
        'summable_indicators': summable,
        'meanable_indicators': meanable,
    }



def process_unit(unit_name, df_whole, df_5years, df_trend, all_units_dfs=None):
    """
    all_units_dfs: optional dict {unit_name: df} so Micro Topics can look up
                   Meso and Macro dfs for resolving human-readable names.
    """
    result = {
        "unit": unit_name,
        "indicators": [],
        "profile": [],
        "quartiles": [],
        "time_series": {},
        "sunburst": None
    }

    df_entities = None  # keep reference for trend filtering later

    # ── Profile and Quartiles (from the "Whole period" file) ───────────────
    if df_whole is not None and not df_whole.empty:
        entity_col = df_whole.columns[0]

        baseline_mask = df_whole[entity_col].astype(str).str.contains(r'Baseline', case=False, na=False)
        baseline_df   = df_whole[baseline_mask]
        df_entities   = df_whole[~baseline_mask].copy()

        numeric_cols = df_entities.select_dtypes(include=[np.number]).columns.tolist()

        # ── Derived indicators ─────────────────────────────────────────
        if 'Web of Science Documents' in numeric_cols:
            if not baseline_df.empty:
                wos_baseline = baseline_df['Web of Science Documents'].sum()
                if wos_baseline > 0:
                    df_entities['Share'] = (df_entities['Web of Science Documents'] / wos_baseline) * 100
                    if 'Share' not in numeric_cols:
                        numeric_cols.append('Share')

            if 'Times Cited' in numeric_cols and 'Impact Factor' not in numeric_cols:
                df_entities['Impact Factor'] = (
                    df_entities['Times Cited'] / df_entities['Web of Science Documents'].replace(0, np.nan)
                ).fillna(0)
                numeric_cols.append('Impact Factor')

            if 'Citations From Patents' in numeric_cols and 'Citations From Patents/Paper' not in numeric_cols:
                df_entities['Citations From Patents/Paper'] = (
                    df_entities['Citations From Patents'] / df_entities['Web of Science Documents'].replace(0, np.nan)
                ).fillna(0)
                numeric_cols.append('Citations From Patents/Paper')

        df_entities[numeric_cols] = df_entities[numeric_cols].fillna(0)

        # Limit to top 1500 entities to prevent OOM
        sort_col = next(
            (c for c in numeric_cols if 'web of science documents' in c.lower()),
            numeric_cols[0] if numeric_cols else None
        )
        if sort_col:
            df_entities = df_entities.sort_values(by=sort_col, ascending=False).head(1500)

        result["indicators"] = numeric_cols

        # ── Flexible Quartile Column Detection ─────────────────────────
        q1_col = next((c for c in df_entities.columns if re.search(r'\bQ1\b|Top\s*25%', str(c), re.IGNORECASE)), None)
        q2_col = next((c for c in df_entities.columns if re.search(r'\bQ2\b', str(c), re.IGNORECASE)), None)
        q3_col = next((c for c in df_entities.columns if re.search(r'\bQ3\b', str(c), re.IGNORECASE)), None)
        q4_col = next((c for c in df_entities.columns if re.search(r'\bQ4\b', str(c), re.IGNORECASE)), None)

        # ── Single pass: build profile rows AND quartile rows ──────────
        for _, row in df_entities.iterrows():
            entity_name = str(row[entity_col])
            if pd.isna(row[entity_col]) or entity_name.strip() == "":
                continue

            profile_row = {"entity": entity_name}
            for col in numeric_cols:
                profile_row[col] = float(row[col]) if pd.notna(row[col]) else 0.0
            result["profile"].append(profile_row)

            q1 = float(row[q1_col]) if q1_col and pd.notna(row[q1_col]) else 0.0
            q2 = float(row[q2_col]) if q2_col and pd.notna(row[q2_col]) else 0.0
            q3 = float(row[q3_col]) if q3_col and pd.notna(row[q3_col]) else 0.0
            q4 = float(row[q4_col]) if q4_col and pd.notna(row[q4_col]) else 0.0

            if q1 > 0 or q2 > 0 or q3 > 0 or q4 > 0:
                result["quartiles"].append({
                    "entity": entity_name,
                    "Q1": q1, "Q2": q2, "Q3": q3, "Q4": q4,
                })

    # ── Time Series Processing ─────────────────────────────────────────────
    # Prefer the dedicated Trend file; fall back to df_whole if it has time columns
    target_trend = df_trend
    if (target_trend is None or target_trend.empty) and df_whole is not None and not df_whole.empty:
        has_time  = any(re.search(r'time\s*period|year|periodo|año', str(c), re.IGNORECASE) for c in df_whole.columns)
        year_cols = [c for c in df_whole.columns if re.match(r'^(19|20)\d{2}$', str(c))]
        if has_time or len(year_cols) >= 2:
            target_trend = df_whole

    if target_trend is not None and not target_trend.empty:
        entity_col = target_trend.columns[0]

        # 1. Long format: single "Time Period" / "Year" column
        time_col = None
        for col in target_trend.columns:
            if re.search(r'time\s*period|year|periodo|año|year\s*published', str(col), re.IGNORECASE):
                time_col = col
                break

        if time_col:
            baseline_mask = target_trend[entity_col].astype(str).str.contains(r'Baseline', case=False, na=False)
            trend_data    = target_trend[~baseline_mask]

            numeric_ts = trend_data.select_dtypes(include=[np.number]).columns.tolist()
            if time_col in numeric_ts:
                numeric_ts.remove(time_col)

            for indicator in numeric_ts:
                series_data = []
                for name, group in trend_data.groupby(entity_col):
                    group      = group.sort_values(by=time_col)
                    raw_values = group[indicator].fillna(0).tolist()
                    times      = group[time_col].astype(str).tolist()
                    if not raw_values:
                        continue
                    s = pd.Series(raw_values)
                    series_data.append({
                        "entity":     str(name),
                        "times":      times,
                        "raw":        raw_values,
                        "ecma3":      calculate_ecma(s, 3).tolist(),
                        "ecma5":      calculate_ecma(s, 5).tolist(),
                        "latest_val": float(raw_values[-1]),
                    })

                series_data.sort(key=lambda x: x["latest_val"], reverse=True)
                series_data = series_data[:20]
                for sd in series_data:
                    del sd["latest_val"]
                result["time_series"][indicator] = series_data

        else:
            # 2. Wide format: year numbers as column headers (2015, 2016, …)
            year_cols = sorted(
                [c for c in target_trend.columns if re.match(r'^(19|20)\d{2}$', str(c))],
                key=lambda x: int(x)
            )
            if len(year_cols) >= 2:
                baseline_mask = target_trend[entity_col].astype(str).str.contains(r'Baseline', case=False, na=False)
                trend_data    = target_trend[~baseline_mask]
                series_data   = []

                for _, row in trend_data.iterrows():
                    entity_name = str(row[entity_col])
                    if pd.isna(row[entity_col]) or entity_name.strip() == "":
                        continue
                    raw_values = [float(row[y]) if pd.notna(row[y]) else 0.0 for y in year_cols]
                    s = pd.Series(raw_values)
                    series_data.append({
                        "entity":     entity_name,
                        "times":      [str(y) for y in year_cols],
                        "raw":        raw_values,
                        "ecma3":      calculate_ecma(s, 3).tolist(),
                        "ecma5":      calculate_ecma(s, 5).tolist(),
                        "latest_val": raw_values[-1],
                    })

                series_data.sort(key=lambda x: x["latest_val"], reverse=True)
                series_data = series_data[:20]
                for sd in series_data:
                    del sd["latest_val"]
                result["time_series"]["Documents (Time Series)"] = series_data

    # ── Sunburst (only for Micro Topics) ──────────────────────────────
    if unit_name in ('Micro Topics', 'Meso Topics'):
        df_meso  = (all_units_dfs or {}).get('Meso Topics')
        df_macro = (all_units_dfs or {}).get('Macro Topics')
        if unit_name == 'Micro Topics':
            result['sunburst'] = build_sunburst_from_micro_topics(
                df_micro=df_whole,
                df_meso=df_meso,
                df_macro=df_macro,
                min_docs=0
            )

    return result



def extract_and_parse_incites(payload_path):
    with open(payload_path, 'r', encoding='utf-8') as f:
        payload = json.load(f)

    file_paths = payload.get("files", [])
    temp_dir = tempfile.mkdtemp()

    extracted_files = []

    try:
        for fp in file_paths:
            if fp.endswith('.zip'):
                with zipfile.ZipFile(fp, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                    for root, _, files in os.walk(temp_dir):
                        for file in files:
                            extracted_files.append(os.path.join(root, file))
            else:
                target = os.path.join(temp_dir, os.path.basename(fp))
                shutil.copy2(fp, target)
                extracted_files.append(target)

        units = {}
        for ef in extracted_files:
            unit, period = identify_file_type(ef)
            if unit:
                if unit not in units:
                    units[unit] = {"Whole": None, "5Years": None, "Trend": None}
                units[unit][period] = ef

        # First pass: load all whole-period dfs so Micro Topics can look up names
        all_whole_dfs = {}
        for unit_name, files in units.items():
            df_whole = clean_and_read_file(files["Whole"]) if files["Whole"] else None
            all_whole_dfs[unit_name] = df_whole

        final_results = {}
        for unit_name, files in units.items():
            df_whole  = all_whole_dfs[unit_name]
            df_5years = clean_and_read_file(files["5Years"]) if files["5Years"] else None
            df_trend  = clean_and_read_file(files["Trend"])  if files["Trend"]  else None

            parsed_unit = process_unit(unit_name, df_whole, df_5years, df_trend,
                                       all_units_dfs=all_whole_dfs)
            final_results[unit_name] = parsed_unit

        return {
            "success": True,
            "units": final_results
        }

    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
