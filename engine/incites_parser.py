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


def process_unit(unit_name, df_whole, df_5years, df_trend):
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

        final_results = {}
        for unit_name, files in units.items():
            df_whole  = clean_and_read_file(files["Whole"])  if files["Whole"]  else None
            df_5years = clean_and_read_file(files["5Years"]) if files["5Years"] else None
            df_trend  = clean_and_read_file(files["Trend"])  if files["Trend"]  else None

            parsed_unit = process_unit(unit_name, df_whole, df_5years, df_trend)
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
