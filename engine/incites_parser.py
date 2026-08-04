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
    if re.search(r'Micro\s+Topics', b, re.IGNORECASE):           unit = "Micro Topics"
    elif re.search(r'Meso\s+Topics', b, re.IGNORECASE):          unit = "Meso Topics"
    elif re.search(r'Macro\s+Topics', b, re.IGNORECASE):         unit = "Macro Topics"
    elif re.search(r'Research Areas.*ESI|ESI', b, re.IGNORECASE): unit = "ESI"
    elif re.search(r'Research Areas.*SDG|SDG', b, re.IGNORECASE): unit = "SDG"
    elif re.search(r'Research Areas|WoS Categories', b, re.IGNORECASE): unit = "WoS Categories"
    elif re.search(r'Publication Sources|Journals', b, re.IGNORECASE): unit = "Publication Sources"
    elif re.search(r'Funding Agencies|Funding', b, re.IGNORECASE): unit = "Funding Agencies"
    elif re.search(r'Organizations|Institutions', b, re.IGNORECASE): unit = "Organizations"
    elif re.search(r'Locations|Countries', b, re.IGNORECASE):    unit = "Locations"
    elif re.search(r'Researchers|Authors', b, re.IGNORECASE):    unit = "Researchers"
    elif re.search(r'Patentometrics|Patents', b, re.IGNORECASE): unit = "Patentometrics"

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
    
    if df_whole is not None and not df_whole.empty:
        entity_col = df_whole.columns[0]
        
        baseline_mask = df_whole[entity_col].astype(str).str.contains(r'Baseline', case=False, na=False)
        baseline_df = df_whole[baseline_mask]
        df_entities = df_whole[~baseline_mask].copy()
        
        numeric_cols = df_entities.select_dtypes(include=[np.number]).columns.tolist()
        
        if 'Web of Science Documents' in numeric_cols:
            if not baseline_df.empty:
                wos_baseline = baseline_df['Web of Science Documents'].sum()
                if wos_baseline > 0:
                    df_entities['Share'] = (df_entities['Web of Science Documents'] / wos_baseline) * 100
                    if 'Share' not in numeric_cols: numeric_cols.append('Share')
            
            if 'Times Cited' in numeric_cols and 'Impact Factor' not in numeric_cols:
                df_entities['Impact Factor'] = df_entities['Times Cited'] / df_entities['Web of Science Documents']
                numeric_cols.append('Impact Factor')
                
            if 'Citations From Patents' in numeric_cols and 'Citations From Patents/Paper' not in numeric_cols:
                df_entities['Citations From Patents/Paper'] = df_entities['Citations From Patents'] / df_entities['Web of Science Documents']
                numeric_cols.append('Citations From Patents/Paper')

        df_entities[numeric_cols] = df_entities[numeric_cols].fillna(0)
        
        # Limit to top 1500 entities by major indicator to prevent OOM
        sort_col = next((c for c in numeric_cols if 'web of science documents' in c.lower()), numeric_cols[0] if numeric_cols else None)
        if sort_col:
            df_entities = df_entities.sort_values(by=sort_col, ascending=False).head(1500)
        
        result["indicators"] = numeric_cols
        
        for _, row in df_entities.iterrows():
            entity_name = str(row[entity_col])
            if pd.isna(row[entity_col]) or entity_name.strip() == "":
                continue
                
            profile_row = {"entity": entity_name}
            for col in numeric_cols:
                profile_row[col] = float(row[col]) if pd.notna(row[col]) else 0.0
            
            q1 = row.get('% Documents in Q1 Journals', 0)
            q2 = row.get('% Documents in Q2 Journals', 0)
            q3 = row.get('% Documents in Q3 Journals', 0)
            q4 = row.get('% Documents in Q4 Journals', 0)
            
            if any([q1, q2, q3, q4]):
                result["quartiles"].append({
                    "entity": entity_name,
                    "Q1": float(q1) if pd.notna(q1) else 0.0,
                    "Q2": float(q2) if pd.notna(q2) else 0.0,
                    "Q3": float(q3) if pd.notna(q3) else 0.0,
                    "Q4": float(q4) if pd.notna(q4) else 0.0,
                })
                
            result["profile"].append(profile_row)

    if df_trend is not None and not df_trend.empty:
        entity_col = df_trend.columns[0]
        
        time_col = None
        for col in df_trend.columns:
            if 'time period' in col.lower() or 'year' in col.lower():
                time_col = col
                break
                
        if time_col:
            baseline_mask = df_trend[entity_col].astype(str).str.contains(r'Baseline', case=False, na=False)
            df_trend = df_trend[~baseline_mask]
            
            # Filter trend data to only include entities that made the top 1500 in profile (if available)
            if df_entities is not None and not df_entities.empty:
                valid_entities = set(df_entities[df_entities.columns[0]].astype(str))
                df_trend = df_trend[df_trend[entity_col].astype(str).isin(valid_entities)]
            
            numeric_cols = df_trend.select_dtypes(include=[np.number]).columns.tolist()
            if time_col in numeric_cols:
                numeric_cols.remove(time_col)
                
            for indicator in numeric_cols:
                series_data = []
                grouped = df_trend.groupby(entity_col)
                for name, group in grouped:
                    group = group.sort_values(by=time_col)
                    raw_values = group[indicator].fillna(0).tolist()
                    times = group[time_col].astype(str).tolist()
                    
                    if len(raw_values) > 0:
                        s = pd.Series(raw_values)
                        ecma3 = calculate_ecma(s, 3).tolist()
                        ecma5 = calculate_ecma(s, 5).tolist()
                        
                        series_data.append({
                            "entity": str(name),
                            "times": times,
                            "raw": raw_values,
                            "ecma3": ecma3,
                            "ecma5": ecma5,
                            "latest_val": float(raw_values[-1]) if len(raw_values) > 0 else 0.0
                        })
                
                # Sort by latest value and keep only top 20 for preview to prevent massive JSON payloads
                series_data.sort(key=lambda x: x["latest_val"], reverse=True)
                series_data = series_data[:20]
                for sd in series_data:
                    del sd["latest_val"]
                    
                result["time_series"][indicator] = series_data

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
            df_whole = clean_and_read_file(files["Whole"]) if files["Whole"] else None
            df_5years = clean_and_read_file(files["5Years"]) if files["5Years"] else None
            df_trend = clean_and_read_file(files["Trend"]) if files["Trend"] else None
            
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
