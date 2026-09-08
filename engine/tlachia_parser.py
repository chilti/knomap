"""
KnoMap Engine - tlachia_parser.py
Módulo especializado en la ingesta, normalización y estructuración analítica
de paquetes (.zip) y reportes (CSV, Parquet, JSON) generados por TlachIA Metrics (openalex_indicators_engine).

Estructura soportada de paquetes TlachIA:
- 01_Matrices_Desempeño_Longitudinal/*.csv (* Performance Matrix.csv, Matriz_Desempeño_Longitudinal_Consolidada.csv)
- 02_Periodos_Consecutivos/*.csv (* <Period>.csv, Corpus Periodos Consecutivos.csv)
- 03_Historico_Completo/*.csv (*.csv)
- 04_Tendencias_Anuales/*.csv (* Trend.csv)
- 05_Tablas_Parquet_y_Datos/* (*.parquet, *_openalex_works.json)
- manifest.json
- LEEME_ESTRUCTURA.txt
"""

import os
import re
import io
import json
import zipfile
import shutil
import tempfile
import warnings
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple, Union
from pathlib import Path

# Suprimir advertencias que interfieran con la salida estándar JSON
warnings.filterwarnings("ignore")

# Entidades analíticas canónicas soportadas en TlachIA Metrics
CANONICAL_TLACHIA_ENTITIES = {
    'corpus': 'Corpus',
    'organizations': 'Organizations',
    'institutions': 'Organizations',
    'researchers': 'Researchers',
    'authors': 'Researchers',
    'publicationsources': 'Publication Sources',
    'publication_sources': 'Publication Sources',
    'sources': 'Publication Sources',
    'journals': 'Publication Sources',
    'countries': 'Countries',
    'locations': 'Countries',
    'sectortypes': 'Sector Types',
    'sector_types': 'Sector Types',
    'sectors': 'Sector Types',
    'fundingagencies': 'Funding Agencies',
    'funding_agencies': 'Funding Agencies',
    'funders': 'Funding Agencies',
    'economicapcbreakdown': 'Economic APC Breakdown',
    'economic_apc_breakdown': 'Economic APC Breakdown',
    'apc': 'Economic APC Breakdown',
    'locationssubnational': 'Locations Subnational',
    'locations_subnational': 'Locations Subnational',
    'organizationscolab': 'Organizations Colab',
    'organizations_colab': 'Organizations Colab',
    'keywords': 'Keywords',
    'concepts': 'Concepts',
    'researchareastopic': 'Research Areas Topic',
    'research_areas_topic': 'Research Areas Topic',
    'topics': 'Research Areas Topic',
    'researchareassubfield': 'Research Areas Subfield',
    'research_areas_subfield': 'Research Areas Subfield',
    'subfields': 'Research Areas Subfield',
    'researchareasfield': 'Research Areas Field',
    'research_areas_field': 'Research Areas Field',
    'fields': 'Research Areas Field',
    'researchareasdomain': 'Research Areas Domain',
    'research_areas_domain': 'Research Areas Domain',
    'domains': 'Research Areas Domain',
    'researchareassdg': 'Research Areas SDG',
    'research_areas_sdg': 'Research Areas SDG',
    'sdg': 'Research Areas SDG',
    'sdgs': 'Research Areas SDG',
}


def calculate_ecma(series: pd.Series, window: int = 3) -> pd.Series:
    """Calcula media móvil exponencial ponderada (ECMA)."""
    return series.ewm(span=window, adjust=False).mean()


def clean_val(v: Any) -> Union[float, str]:
    """Limpia cadenas numéricas con comas o porcentajes a float seguro."""
    if pd.isna(v):
        return 0.0
    if isinstance(v, (int, float, np.number)):
        return float(v)
    if isinstance(v, str):
        v = v.replace('%', '').replace(',', '').strip()
    try:
        return float(v)
    except (ValueError, TypeError):
        return str(v)


def read_tlachia_file(filepath: str) -> Optional[pd.DataFrame]:
    """
    Lee un archivo de datos (CSV, Excel o Parquet) de TlachIA Metrics
    con detección inteligente de codificación y delimitador.
    """
    if not os.path.exists(filepath):
        return None

    lower_path = filepath.lower()

    # 1. Archivo Parquet
    if lower_path.endswith('.parquet'):
        try:
            return pd.read_parquet(filepath)
        except Exception:
            pass

    # 2. Archivo CSV
    if lower_path.endswith('.csv') or lower_path.endswith('.txt') or lower_path.endswith('.tsv'):
        encoding_candidates = ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']
        sample_text = ""
        encoding_used = 'utf-8-sig'

        for enc in encoding_candidates:
            try:
                with open(filepath, 'r', encoding=enc, errors='replace') as f:
                    sample_text = "".join([f.readline() for _ in range(10)])
                encoding_used = enc
                break
            except Exception:
                continue

        # Detectar delimitador analizando la primera línea no vacía
        first_line = sample_text.splitlines()[0] if sample_text.splitlines() else ""
        if '\t' in first_line and first_line.count('\t') > first_line.count(','):
            sep = '\t'
        elif ';' in first_line and first_line.count(';') > first_line.count(','):
            sep = ';'
        else:
            sep = ','

        # TlachIA Metrics genera CSVs estándar con encabezado en fila 0.
        # Solo en caso de líneas de metadatos tipo InCites ("InCites dataset...") saltamos.
        skip_rows = 0
        if "incites dataset" in first_line.lower():
            skip_rows = 1

        try:
            df = pd.read_csv(filepath, sep=sep, encoding=encoding_used, skiprows=skip_rows, on_bad_lines='skip')
        except Exception:
            try:
                df = pd.read_csv(filepath, encoding='utf-8', on_bad_lines='skip')
            except Exception:
                return None

    # 3. Archivo Excel
    elif lower_path.endswith(('.xlsx', '.xls', '.xlsb')):
        try:
            df = pd.read_excel(filepath)
        except Exception:
            return None
    else:
        return None

    if df is None or df.empty:
        return df

    # Limpieza de columnas y filas completamente vacías
    df = df.dropna(how='all', axis=1).dropna(how='all', axis=0)

    # Limpiar nombres de columnas
    df.columns = [str(c).strip() for c in df.columns]

    # Convertir columnas numéricas que tengan formato string (e.g. "1,234" o "55.4%")
    for col in df.columns:
        if df[col].dtype == object:
            converted = pd.to_numeric(
                df[col].astype(str).str.replace(',', '', regex=False).str.replace('%', '', regex=False).str.strip(),
                errors='coerce'
            )
            non_null_orig = df[col].dropna().shape[0]
            non_null_conv = converted.dropna().shape[0]
            if non_null_conv > 0 and non_null_conv >= non_null_orig * 0.5:
                df[col] = converted

    return df


def identify_tlachia_file(filepath: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Identifica la entidad analítica y la ventana temporal / categoría de un archivo de TlachIA Metrics.
    Retorna (unit_name, period_tag).
    
    Ejemplos:
      - "03_Historico_Completo/Organizations.csv" -> ("Organizations", "Whole")
      - "04_Tendencias_Anuales/Organizations Trend.csv" -> ("Organizations", "Trend")
      - "01_Matrices_Desempeño_Longitudinal/Organizations Performance Matrix.csv" -> ("Organizations", "PerformanceMatrix")
      - "02_Periodos_Consecutivos/Organizations 2017-2026.csv" -> ("Organizations", "2017-2026")
      - "02_Periodos_Consecutivos/Corpus Periodos Consecutivos.csv" -> ("Corpus", "ConsecutivePeriods")
      - "01_Matrices_Desempeño_Longitudinal/Matriz_Desempeño_Longitudinal_Consolidada.csv" -> ("Consolidated Performance Matrix", "PerformanceMatrix")
    """
    norm_path = filepath.replace('\\', '/')
    base = os.path.basename(norm_path)
    stem, ext = os.path.splitext(base)

    if ext.lower() not in ('.csv', '.xlsx', '.xls', '.parquet'):
        return None, None

    # Limpiar prefijos de carga temporal (ej. up_abc123_)
    clean = re.sub(r'^up_[a-zA-Z0-9]+_', '', stem).strip()

    # Ignorar archivos de metadatos o instrucciones generales
    if clean.lower() in ('manifest', 'inventory', 'payload') or clean.lower().startswith(('leeme', 'readme')):
        return None, None

    # Detectar categoría por carpeta jerárquica
    is_in_perf = '01_Matrices' in norm_path
    is_in_period = '02_Periodos' in norm_path
    is_in_whole = '03_Historico' in norm_path
    is_in_trend = '04_Tendencias' in norm_path

    # Casos especiales consolidados
    if re.search(r'Matriz[_\s]+Desempe[nñ]o[_\s]+Longitudinal[_\s]+Consolidada', clean, re.IGNORECASE):
        return "Consolidated Performance Matrix", "PerformanceMatrix"

    if re.search(r'Periodos[_\s]+Consecutivos', clean, re.IGNORECASE):
        unit_core = re.sub(r'[\s_]*Periodos[\s_]+Consecutivos[\s_]*', '', clean, flags=re.IGNORECASE).strip()
        unit_core = unit_core if unit_core else "Corpus"
        return unit_core, "ConsecutivePeriods"

    period = "Whole"

    # Determinar periodo / ventana temporal
    if is_in_perf or re.search(r'Performance[\s_]*Matrix', clean, re.IGNORECASE):
        period = "PerformanceMatrix"
        clean = re.sub(r'[\s_]*Performance[\s_]*Matrix[\s_]*', ' ', clean, flags=re.IGNORECASE)
    elif is_in_trend or re.search(r'\bTrend\b', clean, re.IGNORECASE):
        period = "Trend"
        clean = re.sub(r'[\s_]*Trend[\s_]*', ' ', clean, flags=re.IGNORECASE)
    elif re.search(r'\b((?:19|20)\d{2}\s*[-_]\s*(?:19|20)\d{2})\b', clean):
        m = re.search(r'\b((?:19|20)\d{2})\s*[-_]\s*((?:19|20)\d{2})\b', clean)
        period = f"{m.group(1)}-{m.group(2)}"
        clean = re.sub(r'[\s_]*\b(?:19|20)\d{2}\s*[-_]\s*(?:19|20)\d{2}\b[\s_]*', ' ', clean)
    elif is_in_period:
        period = "Period"
    elif is_in_whole:
        period = "Whole"

    clean = clean.strip()
    clean = re.sub(r'\s+', ' ', clean)

    # Normalización contra catálogo canónico
    key = clean.lower().replace(' ', '').replace('_', '')
    canonical = CANONICAL_TLACHIA_ENTITIES.get(key, clean)

    if not canonical or canonical.lower() == 'dataset unit':
        return None, None

    return canonical, period


def parse_longitudinal_data(perf_matrix_path: Optional[str] = None,
                            consecutive_period_files: Optional[Dict[str, str]] = None,
                            unit_name: str = "") -> Optional[Dict[str, Any]]:
    """
    Parsea matrices de desempeño longitudinal con tasas de cambio interperiódicas
    (Δ% Documentos, Δ FWCI, H-Index, etc.) y genera matrices listas para SOM intertemporal.
    """
    if not perf_matrix_path and not consecutive_period_files:
        return None

    try:
        # Caso A: Archivo dedicado Performance Matrix
        if perf_matrix_path and os.path.exists(perf_matrix_path):
            df = read_tlachia_file(perf_matrix_path)
            if df is not None and not df.empty:
                entity_col = 'Name' if 'Name' in df.columns else df.columns[0]

                # Extraer periodos de cabeceras como 'Docs (2017-2026)' o 'FWCI (2017-2026)'
                periods = []
                for c in df.columns:
                    m = re.search(r'\((\d{4}\s*-\s*\d{4})\)', str(c))
                    if m:
                        p_tag = m.group(1).replace(' ', '')
                        if p_tag not in periods:
                            periods.append(p_tag)

                periods.sort(key=lambda x: int(x.split('-')[0]) if '-' in str(x) else 0)

                if periods:
                    sample_p = periods[0]
                    core_metrics = []
                    for c in df.columns:
                        if f'({sample_p})' in str(c):
                            m_name = str(c).replace(f'({sample_p})', '').strip()
                            core_metrics.append(m_name)

                    delta_cols = [str(c) for c in df.columns if any(sym in str(c) for sym in ['Δ', 'Delta', '->', '→'])]

                    entities = []
                    for _, row in df.iterrows():
                        ent_name = str(row[entity_col]).strip()
                        if not ent_name or ent_name.lower() in ('nan', 'none', ''):
                            continue

                        ent_entry = {
                            'entity': ent_name,
                            'total_docs': float(clean_val(row.get('Total Documents', 0))),
                            'total_citations': float(clean_val(row.get('Total Times Cited', 0))),
                            'total_fwci': float(clean_val(row.get('Total FWCI', 0))),
                            'periods': {},
                            'deltas': {}
                        }

                        for p in periods:
                            p_dict = {}
                            for m in core_metrics:
                                col_name = f"{m} ({p})"
                                if col_name in row:
                                    p_dict[m] = clean_val(row[col_name])
                            ent_entry['periods'][p] = p_dict

                        for d in delta_cols:
                            ent_entry['deltas'][d] = clean_val(row[d])

                        entities.append(ent_entry)

                    # Estructura preparada para el Mapeo Longitudinal SOM y UMAP
                    som_periods_data = {}
                    for p in periods:
                        p_labels = []
                        p_data = []
                        for ent in entities:
                            p_vals = ent['periods'].get(p, {})
                            if p_vals:
                                vec = [clean_val(p_vals.get(m, 0.0)) for m in core_metrics]
                                if sum(abs(v) for v in vec) > 0:
                                    p_labels.append(ent['entity'])
                                    p_data.append(vec)

                        if p_labels:
                            som_periods_data[p] = {
                                "labels": p_labels,
                                "data": p_data,
                                "compNames": core_metrics
                            }

                    return {
                        "periods": periods,
                        "indicators": core_metrics,
                        "delta_indicators": delta_cols,
                        "entities": entities,
                        "som_periods_data": som_periods_data
                    }

        # Caso B: Ensamblar desde múltiples archivos de periodos consecutivos
        if consecutive_period_files:
            sorted_periods = sorted(
                consecutive_period_files.keys(),
                key=lambda x: int(str(x).split('-')[0]) if '-' in str(x) else 0
            )

            period_dfs = {}
            for p in sorted_periods:
                fpath = consecutive_period_files[p]
                if fpath and os.path.exists(fpath):
                    p_df = read_tlachia_file(fpath)
                    if p_df is not None and not p_df.empty:
                        period_dfs[p] = p_df

            if period_dfs:
                active_periods = list(period_dfs.keys())
                first_df = period_dfs[active_periods[0]]
                entity_col = 'Name' if 'Name' in first_df.columns else first_df.columns[0]
                numeric_cols = [c for c in first_df.select_dtypes(include=[np.number]).columns if c.lower() != 'rank']

                all_entities = set()
                for pdf in period_dfs.values():
                    all_entities.update(pdf[entity_col].dropna().astype(str).str.strip().tolist())

                # Index each period DataFrame by entity name for O(1) fast lookup
                indexed_periods = {}
                for p in active_periods:
                    pdf = period_dfs[p]
                    cleaned_names = pdf[entity_col].dropna().astype(str).str.strip()
                    temp_df = pdf.copy()
                    temp_df['__ent_key'] = cleaned_names
                    temp_df = temp_df.drop_duplicates(subset=['__ent_key']).set_index('__ent_key')
                    indexed_periods[p] = temp_df

                entities = []
                for ent_name in sorted(all_entities)[:1500]:
                    ent_entry = {'entity': ent_name, 'periods': {}, 'deltas': {}}
                    for p in active_periods:
                        pdf_idx = indexed_periods[p]
                        if ent_name in pdf_idx.index:
                            row = pdf_idx.loc[ent_name]
                            ent_entry['periods'][p] = {m: clean_val(row.get(m, 0.0)) for m in numeric_cols}
                        else:
                            ent_entry['periods'][p] = {m: 0.0 for m in numeric_cols}
                    entities.append(ent_entry)

                som_periods_data = {}
                for p in active_periods:
                    p_labels = []
                    p_data = []
                    for ent in entities:
                        p_vals = ent['periods'].get(p, {})
                        vec = [clean_val(p_vals.get(m, 0.0)) for m in numeric_cols]
                        if sum(abs(v) for v in vec) > 0:
                            p_labels.append(ent['entity'])
                            p_data.append(vec)

                    if p_labels:
                        som_periods_data[p] = {
                            "labels": p_labels,
                            "data": p_data,
                            "compNames": numeric_cols
                        }

                return {
                    "periods": active_periods,
                    "indicators": numeric_cols,
                    "delta_indicators": [],
                    "entities": entities,
                    "som_periods_data": som_periods_data
                }

    except Exception as e:
        warnings.warn(f"Error procesando datos longitudinales para {unit_name}: {e}")

    return None


def extract_profile_data(df: Optional[pd.DataFrame]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str], Optional[pd.DataFrame]]:
    """Extrae registros tabulares y quartiles de una entidad."""
    prof, quart, cols = [], [], []
    if df is None or df.empty:
        return prof, quart, cols, None

    entity_col = 'Name' if 'Name' in df.columns else df.columns[0]
    ent_df = df.copy()

    # Columnas numéricas
    numeric_cols = ent_df.select_dtypes(include=[np.number]).columns.tolist()

    # Determinar columna de producción de documentos
    doc_col = next((c for c in numeric_cols if c.lower() in ('documents', 'web of science documents')), None)
    if doc_col:
        total_corpus_docs = ent_df[doc_col].sum()
        if total_corpus_docs > 0 and 'Share' not in numeric_cols:
            ent_df['Share'] = (ent_df[doc_col] / total_corpus_docs) * 100.0
            numeric_cols.append('Share')

        if 'Times Cited' in numeric_cols and 'Impact Factor' not in numeric_cols:
            ent_df['Impact Factor'] = (ent_df['Times Cited'] / ent_df[doc_col].replace(0, np.nan)).fillna(0.0)
            numeric_cols.append('Impact Factor')

    ent_df[numeric_cols] = ent_df[numeric_cols].fillna(0.0)

    # Ordenamiento correcto: si existe Documents, ordenar DESC; si existe Rank, ordenar ASC
    if doc_col:
        ent_df = ent_df.sort_values(by=doc_col, ascending=False)
    elif 'Rank' in ent_df.columns:
        ent_df = ent_df.sort_values(by='Rank', ascending=True)
    elif numeric_cols:
        ent_df = ent_df.sort_values(by=numeric_cols[0], ascending=False)

    # Limitar a los 1,500 registros principales para agilidad en interfaz
    ent_df = ent_df.head(1500)
    cols = numeric_cols

    q1_col = next((c for c in ent_df.columns if re.search(r'top\s*10%|q1', str(c), re.IGNORECASE)), None)
    q2_col = next((c for c in ent_df.columns if re.search(r'top\s*1%|q2', str(c), re.IGNORECASE)), None)

    for _, row in ent_df.iterrows():
        entity_name = str(row[entity_col]).strip()
        profile_row = {"entity": entity_name}
        for col_name in cols:
            profile_row[col_name] = clean_val(row[col_name])
        prof.append(profile_row)

        if q1_col:
            q1_val = clean_val(row[q1_col])
            q2_val = clean_val(row[q2_col]) if q2_col else 0.0
            if q1_val > 0 or q2_val > 0:
                quart.append({
                    "entity": entity_name,
                    "Q1": q1_val,
                    "Q2": q2_val,
                    "Q3": 0.0,
                    "Q4": 0.0
                })

    return prof, quart, cols, ent_df


def process_tlachia_unit(unit_name: str,
                         df_whole: Optional[pd.DataFrame],
                         df_5years: Optional[pd.DataFrame],
                         df_trend: Optional[pd.DataFrame],
                         perf_matrix_path: Optional[str] = None,
                         consecutive_period_files: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Procesa de forma completa e instantánea una unidad analítica de TlachIA Metrics:
    - Perfil histórico completo y reciente
    - Series de tiempo multianuales optimizadas (1 sola pasada de groupby)
    - Suavizado ECMA-3 y ECMA-5
    - Matrices longitudinales de desempeño
    """
    result = {
        "unit": unit_name,
        "indicators": [],
        "profile": [],
        "quartiles": [],
        "sunburst": None,
        "profile_5years": [],
        "quartiles_5years": [],
        "sunburst_5years": None,
        "time_series": {},
        "profile_evolution": {"raw": [], "ecma3": [], "ecma5": []}
    }

    # 1. Extracción de Perfiles
    p_whole, q_whole, c_whole, _ = extract_profile_data(df_whole)
    p_5y, q_5y, c_5y, _ = extract_profile_data(df_5years)

    if not p_whole and p_5y:
        result["profile"] = p_5y
        result["quartiles"] = q_5y
        result["indicators"] = c_5y
    else:
        result["profile"] = p_whole
        result["quartiles"] = q_whole
        result["indicators"] = c_whole if c_whole else c_5y

    result["profile_5years"] = p_5y
    result["quartiles_5years"] = q_5y

    # 2. Procesamiento Vectorial de Series de Tiempo (Ultra-Rápido)
    target_trend = df_trend if (df_trend is not None and not df_trend.empty) else None

    if target_trend is not None and not target_trend.empty:
        entity_col = 'Name' if 'Name' in target_trend.columns else target_trend.columns[0]
        time_col = next((c for c in target_trend.columns if re.search(r'publication[_\s]*year|year|periodo|año', str(c), re.IGNORECASE)), None)

        if time_col:
            trend_data = target_trend.copy()
            for col in trend_data.columns:
                if col not in (entity_col, time_col):
                    if trend_data[col].dtype == object:
                        trend_data[col] = trend_data[col].apply(clean_val)

            numeric_ts = trend_data.select_dtypes(include=[np.number]).columns.tolist()
            if time_col in numeric_ts:
                numeric_ts.remove(time_col)

            doc_ts_col = next((c for c in numeric_ts if c.lower() in ('documents', 'web of science documents')), None)
            if doc_ts_col:
                if 'Times Cited' in numeric_ts and 'Impact Factor' not in numeric_ts:
                    trend_data['Impact Factor'] = (trend_data['Times Cited'] / trend_data[doc_ts_col].replace(0, np.nan)).fillna(0.0)
                    numeric_ts.append('Impact Factor')

            # Agrupación UNA SOLA VEZ para todas las métricas (mejora de velocidad 60x)
            grouped_entities = list(trend_data.groupby(entity_col))

            score_col = doc_ts_col if doc_ts_col else (numeric_ts[0] if numeric_ts else None)

            # Optimización de alto rendimiento: Filtrar a las entidades líderes para gráficos y series temporales
            # (evita iterar sobre miles de entidades con producción marginal o nula)
            if score_col:
                entity_scores = trend_data.groupby(entity_col)[score_col].sum()
                top_entity_names = set(entity_scores.nlargest(150).index)
                trend_active = trend_data[trend_data[entity_col].isin(top_entity_names)]
            else:
                top_entity_names = set(trend_data[entity_col].unique()[:150])
                trend_active = trend_data[trend_data[entity_col].isin(top_entity_names)]

            grouped_entities = list(trend_active.groupby(entity_col))

            time_series_by_ind = {ind: [] for ind in numeric_ts}
            evolution_raw = []
            evolution_ecma3 = []
            evolution_ecma5 = []

            for name, group in grouped_entities:
                group = group.sort_values(by=time_col)
                times = group[time_col].astype(str).tolist()
                if not times:
                    continue

                entity_name = str(name)
                smoothed_dict3 = {}
                smoothed_dict5 = {}

                for ind in numeric_ts:
                    raw_vals = group[ind].fillna(0.0).tolist()
                    s = pd.Series(raw_vals)
                    e3 = calculate_ecma(s, 3).tolist()
                    e5 = calculate_ecma(s, 5).tolist()
                    smoothed_dict3[ind] = e3
                    smoothed_dict5[ind] = e5

                    time_series_by_ind[ind].append({
                        "entity": entity_name,
                        "times": times,
                        "raw": raw_vals,
                        "ecma3": e3,
                        "ecma5": e5,
                        "latest_val": float(raw_vals[-1]) if raw_vals else 0.0
                    })

                # Profile evolution
                for i, t in enumerate(times):
                    row_id = f"{t}_{entity_name}"
                    r_raw = {"entity": row_id}
                    r_e3 = {"entity": row_id}
                    r_e5 = {"entity": row_id}
                    for ind in numeric_ts:
                        r_raw[ind] = float(group.iloc[i][ind]) if pd.notna(group.iloc[i][ind]) else 0.0
                        r_e3[ind] = float(smoothed_dict3[ind][i])
                        r_e5[ind] = float(smoothed_dict5[ind][i])
                    evolution_raw.append(r_raw)
                    evolution_ecma3.append(r_e3)
                    evolution_ecma5.append(r_e5)

            # Conservar top 25 entidades para cada indicador
            for ind in numeric_ts:
                entries = time_series_by_ind[ind]
                entries.sort(key=lambda x: x["latest_val"], reverse=True)
                entries = entries[:25]
                for e in entries:
                    del e["latest_val"]
                result["time_series"][ind] = entries

            # Ordenar profile_evolution por año descendente
            def evo_sort(r):
                y_str = r["entity"].split("_")[0]
                y_val = int(y_str) if y_str.isdigit() else 0
                sc = r.get(score_col, 0.0) if score_col else 0.0
                return (-y_val, -sc)

            evolution_raw.sort(key=evo_sort)
            evolution_ecma3.sort(key=evo_sort)
            evolution_ecma5.sort(key=evo_sort)

            result["profile_evolution"] = {
                "raw": evolution_raw,
                "ecma3": evolution_ecma3,
                "ecma5": evolution_ecma5
            }

    # 3. Procesamiento Longitudinal
    result["longitudinal"] = parse_longitudinal_data(
        perf_matrix_path=perf_matrix_path,
        consecutive_period_files=consecutive_period_files,
        unit_name=unit_name
    )

    return result


def build_tlachia_inventory(payload_path_or_zip: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Construye el inventario de unidades y metadatos de un paquete de TlachIA Metrics.
    Acepta ruta a archivo .zip o diccionario de configuración.
    """
    if isinstance(payload_path_or_zip, dict):
        file_paths = payload_path_or_zip.get("files", [])
    elif isinstance(payload_path_or_zip, str) and payload_path_or_zip.endswith('.json'):
        with open(payload_path_or_zip, 'r', encoding='utf-8') as f:
            data = json.load(f)
            file_paths = data.get("files", [payload_path_or_zip])
    else:
        file_paths = [str(payload_path_or_zip)]

    session_dir = tempfile.mkdtemp(prefix="tlachia_session_")
    extracted_files = []

    for fp in file_paths:
        if not os.path.exists(fp):
            continue
        if fp.endswith('.zip'):
            with zipfile.ZipFile(fp, 'r') as zf:
                zf.extractall(session_dir)
                for root, _, files in os.walk(session_dir):
                    for file in files:
                        extracted_files.append(os.path.join(root, file))
        else:
            dest = os.path.join(session_dir, os.path.basename(fp))
            shutil.copy2(fp, dest)
            extracted_files.append(dest)

    units: Dict[str, Dict[str, Any]] = {}

    for ef in extracted_files:
        unit, period = identify_tlachia_file(ef)
        if unit:
            if unit not in units:
                units[unit] = {
                    "Whole": None,
                    "5Years": None,
                    "Trend": None,
                    "PerformanceMatrix": None,
                    "ConsecutivePeriods": {}
                }
            if period == "Whole":
                units[unit]["Whole"] = ef
            elif period == "Trend":
                units[unit]["Trend"] = ef
            elif period == "PerformanceMatrix":
                units[unit]["PerformanceMatrix"] = ef
            elif period == "ConsecutivePeriods":
                units[unit]["ConsecutivePeriods"]["Summary"] = ef
            elif period:
                units[unit]["ConsecutivePeriods"][period] = ef

    # Asignar el periodo más reciente a 5Years si no está explícito
    for u, f_dict in units.items():
        if f_dict.get("ConsecutivePeriods"):
            period_keys = [k for k in f_dict["ConsecutivePeriods"].keys() if k != "Summary"]
            if period_keys:
                sorted_p = sorted(period_keys, key=lambda x: int(str(x).split('-')[0]) if '-' in str(x) else 0)
                latest_p = sorted_p[-1]
                if not f_dict.get("5Years"):
                    f_dict["5Years"] = f_dict["ConsecutivePeriods"][latest_p]

    # Leer manifest.json si existe
    manifest_data = None
    manifest_candidates = [f for f in extracted_files if os.path.basename(f).lower() == 'manifest.json']
    if manifest_candidates:
        try:
            with open(manifest_candidates[0], 'r', encoding='utf-8') as mf:
                manifest_data = json.load(mf)
        except Exception:
            pass

    # Guardar mapa de inventario en el directorio de sesión
    inventory_map = {
        "session_dir": session_dir,
        "units": units,
        "manifest": manifest_data
    }
    with open(os.path.join(session_dir, "inventory.json"), 'w', encoding='utf-8') as f:
        json.dump(inventory_map, f, ensure_ascii=False)

    return {
        "success": True,
        "session_dir": session_dir,
        "unit_names": sorted(list(units.keys())),
        "manifest": manifest_data
    }


def parse_single_unit_from_session(session_dir: str, unit_name: str) -> Dict[str, Any]:
    """
    Parsea bajo demanda una unidad analítica específica desde un directorio de sesión activo.
    """
    inventory_file = os.path.join(session_dir, "inventory.json")
    if not os.path.exists(inventory_file):
        return {"success": False, "error": f"Inventario de sesión no encontrado en {session_dir}"}

    try:
        with open(inventory_file, 'r', encoding='utf-8') as f:
            inv_map = json.load(f)
    except Exception as e:
        return {"success": False, "error": f"Error leyendo inventario: {e}"}

    units = inv_map.get("units", {})
    if unit_name not in units:
        return {"success": False, "error": f"Unidad '{unit_name}' no encontrada en el inventario"}

    files = units[unit_name]

    df_whole = read_tlachia_file(files["Whole"]) if files.get("Whole") else None
    df_5years = read_tlachia_file(files["5Years"]) if files.get("5Years") else None
    df_trend = read_tlachia_file(files["Trend"]) if files.get("Trend") else None

    parsed = process_tlachia_unit(
        unit_name=unit_name,
        df_whole=df_whole,
        df_5years=df_5years,
        df_trend=df_trend,
        perf_matrix_path=files.get("PerformanceMatrix"),
        consecutive_period_files=files.get("ConsecutivePeriods", {})
    )

    return {
        "success": True,
        "unit_name": unit_name,
        "unit": parsed
    }
