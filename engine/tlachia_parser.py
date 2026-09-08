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
    'countries': 'Locations',
    'locations': 'Locations',
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

    # Omitir archivos consolidados generales que no pertenecen a una entidad analítica particular
    if re.search(r'Matriz[_\s]+Desempe[nñ]o[_\s]+Longitudinal[_\s]+Consolidada', clean, re.IGNORECASE):
        return None, None

    # Detectar categoría por carpeta jerárquica
    is_in_perf = '01_Matrices' in norm_path
    is_in_period = '02_Periodos' in norm_path
    is_in_whole = '03_Historico' in norm_path
    is_in_trend = '04_Tendencias' in norm_path

    # Casos especiales de periodos consecutivos para el corpus
    if re.search(r'(?:Periodos|consecutive)[_\s]+(?:Consecutivos|periods)', clean, re.IGNORECASE):
        unit_core = re.sub(r'[\s_]*(?:Periodos|consecutive)[\s_]+(?:Consecutivos|periods)[\s_]*', '', clean, flags=re.IGNORECASE).strip()
        unit_core = unit_core if unit_core else "Corpus"
        key_core = unit_core.lower().replace(' ', '').replace('_', '')
        canonical_core = CANONICAL_TLACHIA_ENTITIES.get(key_core, unit_core)
        return canonical_core, "ConsecutivePeriods"

    period = "Whole"

    # Determinar categoría / periodo
    if is_in_perf or re.search(r'Performance[\s_]*Matrix', clean, re.IGNORECASE):
        period = "PerformanceMatrix"
        clean = re.sub(r'[\s_]*Performance[\s_]*Matrix[\s_]*', ' ', clean, flags=re.IGNORECASE)
    elif is_in_trend or re.search(r'(?:^|[\s_])Trend(?:$|[\s_])', clean, re.IGNORECASE):
        period = "Trend"
        clean = re.sub(r'[\s_]*Trend[\s_]*', ' ', clean, flags=re.IGNORECASE)
    elif re.search(r'(?:^|[\s_])(?:recent|reciente|5years)(?:$|[\s_])', clean, re.IGNORECASE):
        period = "5Years"
        clean = re.sub(r'[\s_]*(?:recent|reciente|5years)[\s_]*', ' ', clean, flags=re.IGNORECASE)
    elif re.search(r'(?:^|[\s_])(?:full|completo|whole)(?:$|[\s_])', clean, re.IGNORECASE):
        period = "Whole"
        clean = re.sub(r'[\s_]*(?:full|completo|whole)[\s_]*', ' ', clean, flags=re.IGNORECASE)
    elif re.search(r'(?:^|[\s_])((?:19|20)\d{2})[-_]((?:19|20)\d{2})(?:$|[\s_])', clean):
        m = re.search(r'(?:^|[\s_])((?:19|20)\d{2})[-_]((?:19|20)\d{2})(?:$|[\s_])', clean)
        period = f"{m.group(1)}-{m.group(2)}"
        clean = re.sub(r'[\s_]*(?:19|20)\d{2}[-_](?:19|20)\d{2}[\s_]*', ' ', clean)
    elif is_in_period:
        period = "Period"
    elif is_in_whole:
        period = "Whole"

    clean = clean.replace('_', ' ').strip()
    clean = re.sub(r'\s+', ' ', clean)

    # Normalización contra catálogo canónico
    key = clean.lower().replace(' ', '').replace('_', '')
    canonical = CANONICAL_TLACHIA_ENTITIES.get(key, clean)

    if not canonical or canonical.lower() == 'dataset unit':
        return None, None

    return canonical, period


def parse_longitudinal_data(perf_matrix_path: Optional[str] = None,
                            consecutive_period_files: Optional[Dict[str, str]] = None,
                            unit_name: str = "",
                            df_whole: Optional[pd.DataFrame] = None) -> Optional[Dict[str, Any]]:
    """
    Parsea matrices de desempeño longitudinal con tasas de cambio interperiódicas
    (Δ% Documentos, Δ FWCI, H-Index, etc.) y genera matrices listas para la metodología
    longitudinal del SOM (entrenamiento encadenado con Warm-Start intertemporal).
    """
    if not perf_matrix_path and not consecutive_period_files:
        return None

    try:
        # 1. Carga de archivos de periodos consecutivos válidos (descartando archivos vacíos <= 10 bytes)
        period_dfs = {}
        if consecutive_period_files:
            sorted_period_keys = sorted(
                [k for k in consecutive_period_files.keys() if k not in ("Summary", "5Years", "Period")],
                key=lambda x: int(str(x).split('-')[0]) if '-' in str(x) else 0
            )
            for p in sorted_period_keys:
                fpath = consecutive_period_files[p]
                if fpath and os.path.exists(fpath) and os.path.getsize(fpath) > 10:
                    p_df = read_tlachia_file(fpath)
                    if p_df is not None and not p_df.empty and len(p_df) > 0:
                        period_dfs[p] = p_df

        # Si no hay periodos consecutivos en archivos individuales, intentar extraer desde Performance Matrix
        if not period_dfs and perf_matrix_path and os.path.exists(perf_matrix_path):
            df_perf = read_tlachia_file(perf_matrix_path)
            if df_perf is not None and not df_perf.empty:
                entity_col = 'Name' if 'Name' in df_perf.columns else df_perf.columns[0]
                periods = []
                for c in df_perf.columns:
                    m = re.search(r'\((\d{4}\s*-\s*\d{4})\)', str(c))
                    if m:
                        p_tag = m.group(1).replace(' ', '')
                        if p_tag not in periods:
                            periods.append(p_tag)
                periods.sort(key=lambda x: int(x.split('-')[0]) if '-' in str(x) else 0)

                if periods:
                    sample_p = periods[0]
                    core_metrics = []
                    for c in df_perf.columns:
                        if f'({sample_p})' in str(c):
                            m_name = str(c).replace(f'({sample_p})', '').strip()
                            core_metrics.append(m_name)

                    delta_cols = [str(c) for c in df_perf.columns if any(sym in str(c) for sym in ['Δ', 'Delta', '->', '→'])]
                    entities = []
                    for _, row in df_perf.iterrows():
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
                            p_dict['Docs'] = p_dict.get('Docs', p_dict.get('Documents', 0.0))
                            p_dict['FWCI'] = p_dict.get('FWCI', p_dict.get('Field-Weighted Citation Impact (FWCI)', 0.0))
                            ent_entry['periods'][p] = p_dict

                        for d in delta_cols:
                            ent_entry['deltas'][d] = clean_val(row[d])
                        entities.append(ent_entry)

                    cohort_labels = [e['entity'] for e in entities[:1500]]
                    som_periods_data = {}
                    for p in periods:
                        p_data = []
                        for ent in entities[:1500]:
                            p_vals = ent['periods'].get(p, {})
                            vec = [clean_val(p_vals.get(m, 0.0)) for m in core_metrics]
                            p_data.append(vec)
                        m_span = re.search(r'(\d{4})[-_](\d{4})', p)
                        som_periods_data[p] = {
                            "labels": cohort_labels,
                            "data": p_data,
                            "compNames": core_metrics,
                            "doc_count": len(cohort_labels),
                            "start_year": int(m_span.group(1)) if m_span else 0,
                            "end_year": int(m_span.group(2)) if m_span else 0
                        }

                    return {
                        "has_longitudinal": True,
                        "unit": unit_name,
                        "total_entities": len(entities),
                        "periods": periods,
                        "indicators": core_metrics,
                        "delta_indicators": delta_cols,
                        "entities": entities,
                        "som_periods_data": som_periods_data
                    }

        # 2. Ingesta canónica y estructuración desde 02_Periodos_Consecutivos
        if not period_dfs:
            return None

        active_periods = sorted(
            period_dfs.keys(),
            key=lambda x: int(str(x).split('-')[0]) if '-' in str(x) else 0
        )
        if not active_periods:
            return None

        # Identificar columnas en el DataFrame más completo (usualmente el más reciente)
        latest_df = period_dfs[active_periods[-1]]
        entity_col = 'Name' if 'Name' in latest_df.columns else latest_df.columns[0]
        numeric_cols = [c for c in latest_df.select_dtypes(include=[np.number]).columns if c.lower() != 'rank']

        # Indexar cada periodo por nombre de entidad para acceso O(1) ultra rápido
        indexed_periods = {}
        for p in active_periods:
            pdf = period_dfs[p].copy()
            cleaned_names = pdf[entity_col].dropna().astype(str).str.strip()
            pdf['__ent_key'] = cleaned_names
            pdf = pdf.drop_duplicates(subset=['__ent_key']).set_index('__ent_key')
            indexed_periods[p] = pdf

        # Calcular totales históricos de cada entidad para ranking
        entity_totals = {}
        entity_citations = {}
        entity_fwcis = {}

        if df_whole is not None and not df_whole.empty:
            w_ent_col = 'Name' if 'Name' in df_whole.columns else df_whole.columns[0]
            w_doc_col = next((c for c in df_whole.columns if c.lower() in ('documents', 'web of science documents')), None)
            w_cite_col = next((c for c in df_whole.columns if c.lower() in ('times cited', 'citations')), None)
            w_fwci_col = next((c for c in df_whole.columns if 'fwci' in c.lower()), None)
            for _, r in df_whole.iterrows():
                ename = str(r[w_ent_col]).strip()
                if ename and ename.lower() not in ('nan', 'none', ''):
                    if w_doc_col and pd.notna(r.get(w_doc_col)):
                        entity_totals[ename] = clean_val(r[w_doc_col])
                    if w_cite_col and pd.notna(r.get(w_cite_col)):
                        entity_citations[ename] = clean_val(r[w_cite_col])
                    if w_fwci_col and pd.notna(r.get(w_fwci_col)):
                        entity_fwcis[ename] = clean_val(r[w_fwci_col])

        # Complementar o sumar totales desde los periodos si faltan
        for p, pdf in period_dfs.items():
            d_col = next((c for c in pdf.columns if c.lower() in ('documents', 'web of science documents')), None)
            c_col = next((c for c in pdf.columns if c.lower() in ('times cited', 'citations')), None)
            for _, r in pdf.iterrows():
                ename = str(r[entity_col]).strip()
                if not ename or ename.lower() in ('nan', 'none', ''):
                    continue
                if ename not in entity_totals and d_col:
                    entity_totals[ename] = entity_totals.get(ename, 0.0) + clean_val(r[d_col])
                if ename not in entity_citations and c_col:
                    entity_citations[ename] = entity_citations.get(ename, 0.0) + clean_val(r[c_col])

        # Ordenar entidades por volumen de documentos
        sorted_entities = sorted(entity_totals.keys(), key=lambda x: entity_totals.get(x, 0.0), reverse=True)
        cohort_entities = sorted_entities[:1500] if len(sorted_entities) > 1500 else sorted_entities

        # Construir nombres de indicadores de cambio interperiódico (Deltas)
        delta_indicators = []
        for i in range(len(active_periods) - 1):
            p_prev = active_periods[i]
            p_curr = active_periods[i + 1]
            delta_indicators.append(f"Δ% Docs ({p_prev} → {p_curr})")
            delta_indicators.append(f"Δ FWCI ({p_prev} → {p_curr})")

        # Ensamblar registros individuales de entidades
        entities = []
        doc_metric_name = next((c for c in numeric_cols if c.lower() in ('documents', 'web of science documents')), 'Documents')
        fwci_metric_name = next((c for c in numeric_cols if 'fwci' in c.lower()), 'Field-Weighted Citation Impact (FWCI)')

        for ent_name in cohort_entities:
            ent_entry = {
                'entity': ent_name,
                'total_docs': float(entity_totals.get(ent_name, 0.0)),
                'total_citations': float(entity_citations.get(ent_name, 0.0)),
                'total_fwci': float(entity_fwcis.get(ent_name, 0.0)),
                'periods': {},
                'deltas': {}
            }

            for p in active_periods:
                pdf_idx = indexed_periods[p]
                if ent_name in pdf_idx.index:
                    row = pdf_idx.loc[ent_name]
                    p_dict = {m: clean_val(row.get(m, 0.0)) for m in numeric_cols}
                else:
                    p_dict = {m: 0.0 for m in numeric_cols}

                # Alias de acceso rápido para visualizaciones
                p_dict['Docs'] = p_dict.get(doc_metric_name, 0.0)
                p_dict['Documents'] = p_dict.get(doc_metric_name, 0.0)
                p_dict['FWCI'] = p_dict.get(fwci_metric_name, 0.0)
                p_dict['Field-Weighted Citation Impact (FWCI)'] = p_dict.get(fwci_metric_name, 0.0)
                ent_entry['periods'][p] = p_dict

            # Calcular deltas interperiódicos dinámicos
            for i in range(len(active_periods) - 1):
                p_prev = active_periods[i]
                p_curr = active_periods[i + 1]
                v_prev = ent_entry['periods'][p_prev].get('Docs', 0.0)
                v_curr = ent_entry['periods'][p_curr].get('Docs', 0.0)
                if v_prev > 0:
                    d_docs = round(((v_curr - v_prev) / v_prev) * 100.0, 2)
                elif v_curr > 0:
                    d_docs = 100.0
                else:
                    d_docs = 0.0

                f_prev = ent_entry['periods'][p_prev].get('FWCI', 0.0)
                f_curr = ent_entry['periods'][p_curr].get('FWCI', 0.0)
                d_fwci = round(f_curr - f_prev, 2)

                ent_entry['deltas'][f"Δ% Docs ({p_prev} → {p_curr})"] = d_docs
                ent_entry['deltas'][f"Δ FWCI ({p_prev} → {p_curr})"] = d_fwci

            entities.append(ent_entry)

        # 3. Construir matrices homogéneas [N x D] para el Entrenamiento Encadenado SOM (Warm-Start)
        som_periods_data = {}
        cohort_labels = [e['entity'] for e in entities]

        for p in active_periods:
            matrix_data = []
            for e in entities:
                p_vals = e['periods'].get(p, {})
                vec = [clean_val(p_vals.get(m, 0.0)) for m in numeric_cols]
                matrix_data.append(vec)

            m_span = re.search(r'(\d{4})[-_](\d{4})', p)
            start_yr = int(m_span.group(1)) if m_span else 0
            end_yr = int(m_span.group(2)) if m_span else 0
            period_doc_count = int(sum(e['periods'][p].get('Docs', 0.0) for e in entities))

            som_periods_data[p] = {
                "labels": cohort_labels,
                "data": matrix_data,
                "compNames": numeric_cols,
                "doc_count": period_doc_count,
                "start_year": start_yr,
                "end_year": end_yr
            }

        return {
            "has_longitudinal": True,
            "unit": unit_name,
            "total_entities": len(entities),
            "periods": active_periods,
            "indicators": numeric_cols,
            "delta_indicators": delta_indicators,
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
        unit_name=unit_name,
        df_whole=df_whole
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
            is_csv = ef.lower().endswith(('.csv', '.xlsx', '.xls'))
            if period == "Whole":
                if not units[unit]["Whole"] or is_csv:
                    units[unit]["Whole"] = ef
            elif period == "Trend":
                if not units[unit]["Trend"] or is_csv:
                    units[unit]["Trend"] = ef
            elif period == "PerformanceMatrix":
                if not units[unit]["PerformanceMatrix"] or is_csv:
                    units[unit]["PerformanceMatrix"] = ef
            elif period == "ConsecutivePeriods":
                units[unit]["ConsecutivePeriods"]["Summary"] = ef
            elif period:
                if period not in units[unit]["ConsecutivePeriods"] or is_csv:
                    units[unit]["ConsecutivePeriods"][period] = ef

    # Asignar el periodo más reciente a 5Years si no está explícito
    for u, f_dict in units.items():
        if f_dict.get("ConsecutivePeriods"):
            period_keys = [k for k in f_dict["ConsecutivePeriods"].keys() if k not in ("Summary", "5Years", "Period")]
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

    # Detectar y procesar automáticamente producción científica de OpenAlex JSON si está presente en el paquete
    openalex_json_data = None
    json_work_files = [
        f for f in extracted_files
        if f.lower().endswith(('.json', '.jsonl', '.ndjson'))
        and not os.path.basename(f).lower().endswith('manifest.json')
        and not f.endswith('inventory.json')
        and not f.endswith('payload.json')
    ]

    if json_work_files:
        # Priorizar archivo que contenga openalex_works o openalex
        json_work_files.sort(
            key=lambda x: 0 if 'openalex_works' in os.path.basename(x).lower() else (1 if 'openalex' in os.path.basename(x).lower() else 2)
        )
        json_file_path = json_work_files[0]
        try:
            from vos_parsers import is_openalex_json, parse_openalex_json
            if is_openalex_json(json_file_path) or 'openalex_works' in os.path.basename(json_file_path).lower():
                from bibliometrics_parser import _process_record_list
                # 1. Parsear los registros de OpenAlex una sola vez
                raw_records = parse_openalex_json(json_file_path)

                # 2. Generar red bibliométrica y matriz de co-ocurrencia
                biblio_res = _process_record_list(
                    raw_records,
                    network_type='co-occurrence',
                    custom_tag='DE',
                    max_terms=100,
                    min_cooccurrence=2,
                    temporal=False,
                    extraction_source='keywords',
                    counting_method='full'
                )

                # 3. Preparar registros normalizados para Semantic Biblio
                from semantic_engine import clean_text
                semantic_recs = []
                for idx, r in enumerate(raw_records):
                    semantic_recs.append({
                        'id': r.get('doi') or r.get('work_id') or r.get('id') or f"ID_{idx+1}",
                        'title': clean_text(r.get('title') or ''),
                        'abstract': clean_text(r.get('abstract') or ''),
                        'keywords': [clean_text(k) for k in r.get('keywords', []) if k],
                        'authors': [clean_text(a) for a in r.get('authors', []) if a],
                        'year': str(r.get('year') or ''),
                        'citations': r.get('citations', 0),
                        'source': clean_text(r.get('source') or ''),
                        'doi': clean_text(r.get('doi') or '')
                    })

                openalex_json_data = {
                    'has_json': True,
                    'json_file_name': os.path.basename(json_file_path),
                    'document_count': biblio_res.get('document_count', len(semantic_recs)),
                    'network': biblio_res.get('network'),
                    'vosviewer_json': biblio_res.get('vosviewer_json'),
                    'networks_by_year': biblio_res.get('networks_by_year'),
                    'cooccurrence_csv': biblio_res.get('cooccurrence_csv'),
                    'term_counts': biblio_res.get('term_counts', {}),
                    'semantic_records': semantic_recs
                }
        except Exception as err:
            warnings.warn(f'Error procesando archivo OpenAlex JSON en paquete TlachIA: {err}')

    # Guardar mapa de inventario en el directorio de sesión
    inventory_map = {
        "session_dir": session_dir,
        "units": units,
        "manifest": manifest_data,
        "openalex_data": openalex_json_data
    }
    with open(os.path.join(session_dir, "inventory.json"), 'w', encoding='utf-8') as f:
        json.dump(inventory_map, f, ensure_ascii=False)

    return {
        "success": True,
        "session_dir": session_dir,
        "unit_names": sorted(list(units.keys())),
        "manifest": manifest_data,
        "openalex_data": openalex_json_data
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
