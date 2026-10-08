"""
vos_parsers.py - Extended parsers for Dimensions, Lens, and native VOSviewer files for knoMap
---------------------------------------------------------------------------------------------
"""

import os
import json
import csv
from typing import List, Dict, Any, Optional, Tuple


def is_dimensions_csv(filepath: str) -> bool:
    """Checks if a CSV file is an export from Dimensions."""
    if not filepath.lower().endswith('.csv'):
        return False
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            for _ in range(5):
                line = f.readline().lower()
                if 'exported from dimensions' in line or 'dimensions.ai' in line or 'dimensions url' in line:
                    return True
                if ('publication title' in line and ('times cited' in line or 'dimensions id' in line)) or 'fields of research (anzsrc' in line:
                    return True
    except Exception:
        pass
    return False


def is_openalex_csv(filepath: str) -> bool:
    """Checks if a CSV file is an export from OpenAlex or TlachIA Metrics."""
    lower = filepath.lower()
    if not (lower.endswith('.csv') or lower.endswith('.txt') or lower.endswith('.tsv')):
        return False
    try:
        with open(filepath, 'r', encoding='utf-8-sig', errors='replace') as f:
            first_line = f.readline().lower()
            if first_line.startswith('fn isi') or first_line.startswith('pt '):
                return False
            # Exclude Scopus CSV so it gets routed to the dedicated Scopus parser
            if 'scopus' in first_line or ('authors' in first_line and 'source title' in first_line):
                return False
            if 'work id' in first_line or 'concept ids' in first_line or 'keyword ids' in first_line or 'openalex id' in first_line:
                return True
            if 'open access' in first_line and 'concept' in first_line and 'author' in first_line:
                return True
            if 'fwci' in first_line and ('topic' in first_line or 'tópico' in first_line or 'topico' in first_line):
                return True
            if ('título' in first_line or 'titulo' in first_line) and ('autores' in first_line or 'citas' in first_line or 'países' in first_line or 'paises' in first_line):
                return True
            if 'citas totales' in first_line or 'vía de acceso abierto' in first_line or 'via de acceso abierto' in first_line:
                return True
            if any(k in first_line for k in ['title', 'título', 'titulo', 'display_name']) and any(k in first_line for k in ['author', 'autores', 'doi', 'year', 'año', 'ano', 'journal', 'revista']):
                return True
    except Exception:
        pass
    return False


def is_openalex_json(filepath: str) -> bool:
    """Checks if a JSON or JSONL file is an OpenAlex works export."""
    lower = filepath.lower()
    if not (lower.endswith('.json') or lower.endswith('.jsonl') or lower.endswith('.ndjson')):
        return False
    # Exclude native VOSviewer JSON files (which contain 'network' or 'items')
    if is_vos_native_file(filepath):
        return False
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            chunk = f.read(4096).strip()
            if not chunk:
                return False
            # Check OpenAlex characteristic fields
            if 'authorships' in chunk and ('publication_year' in chunk or 'primary_location' in chunk or 'openalex' in chunk or 'referenced_works' in chunk):
                return True
            if 'openalex.org/W' in chunk or 'openalex.org/S' in chunk:
                return True
    except Exception:
        pass
    return False


def is_lens_csv(filepath: str) -> bool:
    """Checks if a CSV file is an export from Lens.org."""
    if not filepath.lower().endswith('.csv'):
        return False
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            first_line = f.readline().lower()
            if 'lens id' in first_line or ('citing works count' in first_line and 'publication year' in first_line):
                return True
    except Exception:
        pass
    return False


def is_vos_native_file(filepath: str) -> bool:
    """Checks if a file is a native VOSviewer JSON or MAP/NETWORK text file."""
    lower = filepath.lower()
    if lower.endswith('.json'):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                d = json.load(f)
                return isinstance(d, dict) and ('network' in d or 'items' in d)
        except Exception:
            return False
    if lower.endswith('.map') or lower.endswith('.net') or 'map.txt' in lower or 'network.txt' in lower:
        return True
    return False


def parse_dimensions_csv(filepath: str) -> List[Dict[str, Any]]:
    """Parses a Dimensions CSV export into standardized records."""
    records = []
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        # Skip potential preface lines until actual CSV header
        pos = f.tell()
        line = f.readline()
        while line and not ('title' in line.lower() and ('doi' in line.lower() or 'authors' in line.lower())):
            pos = f.tell()
            line = f.readline()
        f.seek(pos)

        reader = csv.DictReader(f)
        for row in reader:
            title = row.get('Title') or row.get('Publication Title') or ''
            if not title:
                continue

            abstract = row.get('Abstract') or ''
            year = row.get('Publication Year') or row.get('Year') or ''
            if year:
                year = str(year).strip()[:4]

            citations = 0
            cit_raw = row.get('Times cited') or row.get('Citations') or '0'
            try:
                citations = float(cit_raw.replace(',', ''))
            except Exception:
                citations = 0

            # Authors
            authors_raw = row.get('Authors') or ''
            authors = [a.strip() for a in authors_raw.split(';') if a.strip()]

            # Keywords / MeSH
            mesh = row.get('MeSH terms') or ''
            mesh_list = [m.strip() for m in mesh.split(';') if m.strip()]
            for_terms = row.get('Fields of Research (ANZSRC 2020)') or ''
            for_list = [t.strip() for t in for_terms.split(';') if t.strip()]

            keywords = mesh_list + for_list

            rec = {
                'title': title,
                'abstract': abstract,
                'year': year,
                'citations': citations,
                'authors': authors,
                'keywords': keywords,
                'source': row.get('Source title') or row.get('Journal') or '',
                'doi': row.get('DOI') or ''
            }
            records.append(rec)
    return records


def parse_lens_csv(filepath: str) -> List[Dict[str, Any]]:
    """Parses a Lens.org CSV export into standardized records."""
    records = []
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = row.get('Title') or ''
            if not title:
                continue

            abstract = row.get('Abstract') or ''
            year = row.get('Publication Year') or row.get('Year') or ''
            if year:
                year = str(year).strip()[:4]

            citations = 0
            cit_raw = row.get('Citing Works Count') or row.get('Citations') or '0'
            try:
                citations = float(cit_raw.replace(',', ''))
            except Exception:
                citations = 0

            # Authors
            authors_raw = row.get('Authors') or ''
            authors = [a.strip() for a in authors_raw.split(';') if a.strip()]

            # Keywords & Mesh
            kw_raw = row.get('Keywords') or ''
            mesh_raw = row.get('Mesh Terms') or ''
            keywords = [k.strip() for k in (kw_raw + ';' + mesh_raw).split(';') if k.strip()]

            rec = {
                'title': title,
                'abstract': abstract,
                'year': year,
                'citations': citations,
                'authors': authors,
                'keywords': keywords,
                'source': row.get('Source Title') or row.get('Journal') or '',
                'doi': row.get('DOI') or ''
            }
            records.append(rec)
    return records


def parse_openalex_csv(filepath: str) -> List[Dict[str, Any]]:
    """Parses an OpenAlex or TlachIA Metrics CSV export into standardized records with all available fields."""
    import ast
    records = []
    with open(filepath, 'r', encoding='utf-8-sig', errors='replace') as f:
        first_line = f.readline()
        delimiter = ','
        if ';' in first_line and first_line.count(';') > first_line.count(','):
            delimiter = ';'
        elif '\t' in first_line and first_line.count('\t') > first_line.count(','):
            delimiter = '\t'
        f.seek(0)
        reader = csv.DictReader(f, delimiter=delimiter)
        for raw_row in reader:
            if not raw_row:
                continue
            row = {str(k).strip().strip('"\'').lstrip('\ufeff'): v for k, v in raw_row.items() if k}
            lower_row = {k.lower().strip(): v for k, v in row.items()}
            
            def get_val(*keys):
                for k in keys:
                    if k in row and row[k] is not None:
                        val = str(row[k]).strip()
                        if val and val.lower() != 'nan':
                            return val
                    lk = k.lower()
                    if lk in lower_row and lower_row[lk] is not None:
                        val = str(lower_row[lk]).strip()
                        if val and val.lower() != 'nan':
                            return val
                return ''

            title = get_val(
                'Title', 'display_name', 'title', 'Título del Artículo', 'Título del artículo',
                'Título', 'Titulo', 'Article Title', 'Document Title', 'Work Title',
                'TI', 'T1', 'Obra', 'obra', 'Artículo', 'Articulo', 'Nombre'
            )
            if not title:
                ident = get_val('Work ID', 'id', 'work_id', 'OpenAlex ID', 'DOI', 'doi', 'pmid')
                if ident:
                    title = f"Document {ident}"
                elif get_val('Author', 'authors', 'Autores', 'AU'):
                    title = f"Document_{len(records)+1}"
                else:
                    continue

            abstract = get_val('Abstract', 'abstract', 'Resumen', 'AB')
            if abstract == '.':
                abstract = ''

            year = get_val('Year', 'publication_year', 'Year of publication', 'Año', 'Ano', 'PY')
            if not year:
                date_val = get_val('Date', 'publication_date', 'Fecha de Publicación', 'Fecha')
                if len(date_val) >= 4:
                    year = date_val[:4]

            citations = 0.0
            cit_raw = get_val('Citation count', 'Cited by', 'cited_by_count', 'Citations', 'Citas Totales (OpenAlex)', 'Citas Totales', 'Citas', 'TC')
            if cit_raw:
                try:
                    citations = float(cit_raw.replace(',', ''))
                except Exception:
                    citations = 0.0

            def parse_list(raw_str):
                if not raw_str or raw_str.lower() in ('', 'nan', 'none', '[]'):
                    return []
                s = raw_str.strip()
                if s.startswith('[') and s.endswith(']'):
                    try:
                        parsed = ast.literal_eval(s)
                        if isinstance(parsed, list):
                            return [str(x).strip() for x in parsed if str(x).strip()]
                    except Exception:
                        pass
                delim = '|' if '|' in s else (';' if ';' in s else ',')
                return [p.strip() for p in s.split(delim) if p.strip() and p.strip().lower() != 'nan']

            authors = parse_list(get_val('Author', 'author_names', 'authors', 'Authors', 'Autores', 'AU'))
            author_keywords = parse_list(get_val('Keyword', 'keywords', 'Keywords', 'author_keywords', 'Palabras clave', 'Palabras Clave', 'DE'))
            concepts = parse_list(get_val('Concept', 'concepts', 'Concepts', 'Conceptos', 'ID'))
            keywords = list(dict.fromkeys(author_keywords + concepts))

            subfields = parse_list(get_val('Subfield', 'subfields', 'subfield_name', 'subfield', 'Subcampo (Área de Investigación)', 'Subcampo'))
            fields = parse_list(get_val('Field', 'fields', 'field_name', 'field', 'Campo'))
            domains = parse_list(get_val('Domain', 'domains', 'domain_name', 'domain', 'Dominio Temático', 'Dominio'))
            topics = parse_list(get_val('Topic', 'topics', 'all_topics', 'primary_topic_id', 'Tópico Principal', 'Tópico', 'Topico'))
            if not topics:
                topics = list(dict.fromkeys(subfields + fields + domains))
            if not keywords and topics:
                keywords = list(topics)

            sdgs = parse_list(get_val('SDG', 'sdgs', 'Sustainable Development Goals', 'Sustainable Development Goal', 'ODS / Agenda 2030 (SDGs)', 'ODS'))
            organizations = parse_list(get_val('Institution', 'institution_names', 'organizations', 'Affiliations', 'Instituciones', 'Afiliaciones', 'C1'))
            countries = parse_list(get_val('Country', 'country_codes', 'all_country_codes', 'countries', 'Países Colaboradores', 'País', 'Países', 'Pais', 'Paises', 'CU'))
            continents = parse_list(get_val('Continent', 'continents'))
            funders = parse_list(get_val('Funder', 'funder_names', 'funders', 'Agencias de Financiamiento', 'FU'))

            source = get_val('Source', 'source_name', 'Any location source', 'Journal', 'Publication Title', 'Revista / Fuente', 'Revista', 'Fuente', 'SO')
            doi = get_val('DOI', 'doi', 'DI')
            work_id = get_val('Work ID', 'id', 'work_id', 'OpenAlex ID')
            if work_id:
                work_id = work_id.split('/')[-1]

            doc_type = get_val('Type', 'type', 'Document Type', 'Publication Type', 'Tipo de Documento', 'DT')
            language = get_val('Language', 'language', 'Idioma', 'LA')
            publisher = get_val('Publisher', 'publisher', 'Host Organization', 'Editorial', 'PU')
            oa_status = get_val('Open access', 'oa_status', 'OA Status', 'Open Access Status', 'Vía de Acceso Abierto', 'Es Acceso Abierto', 'OA')
            fwci = get_val('FWCI', 'fwci')

            # Referenced works (citations)
            raw_refs = get_val('referenced_works', 'Referenced works', 'References', 'CR', 'references')
            referenced_works = []
            if raw_refs:
                raw_list = parse_list(raw_refs)
                for r_item in raw_list:
                    norm_id = r_item.split('/')[-1].strip().strip('\'"')
                    if norm_id:
                        referenced_works.append(norm_id)

            rec = {
                'title': title,
                'abstract': abstract,
                'year': year,
                'citations': citations,
                'authors': authors,
                'keywords': keywords,
                'author_keywords': author_keywords,
                'concepts': concepts,
                'topics': topics,
                'subfields': subfields,
                'fields': fields,
                'domains': domains,
                'sdgs': sdgs,
                'organizations': organizations,
                'countries': countries,
                'continents': continents,
                'funders': funders,
                'source': source,
                'doi': doi,
                'doc_type': doc_type,
                'language': language,
                'publisher': publisher,
                'work_id': work_id,
                'referenced_works': referenced_works,
                'references': referenced_works,
                'open_access': oa_status,
                'fwci': fwci,
                # Metaknowledge / WOS tags compatibility
                'TI': title,
                'AU': authors,
                'PY': year,
                'TC': citations,
                'DE': author_keywords,
                'ID': concepts,
                'SO': source,
                'C1': organizations,
                'CU': countries,
                'FU': funders,
                'AB': abstract,
                'DI': doi,
                'CR': referenced_works,
                'Topic': topics,
                'Subfield': subfields,
                'Field': fields,
                'Domain': domains,
                'Concept': concepts,
                'SDG': sdgs,
                'OA': [oa_status] if oa_status else [],
                'DT': [doc_type] if doc_type else [],
                'LA': [language] if language else [],
                'PU': [publisher] if publisher else [],
                'WC': subfields if subfields else fields,
                'SC': fields if fields else domains,
                'Continent': continents
            }
            records.append(rec)
    return records


def parse_vos_native_json(filepath: str) -> Dict[str, Any]:
    """Reads a native VOSviewer JSON file and prepares it for knoMap."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    items = data.get('network', {}).get('items', []) or data.get('items', [])
    links = data.get('network', {}).get('links', []) or data.get('links', [])

    # Format nodes & edges
    nodes = [
        {
            "data": {
                "id": str(it.get('id', idx + 1)),
                "label": it.get('label', f"Item {idx + 1}"),
                "frequency": it.get('weights', {}).get('Occurrences', 1),
                "cluster": it.get('cluster', 1),
                "avg_year": it.get('scores', {}).get('Avg. pub. year'),
                "avg_citations": it.get('scores', {}).get('Avg. citations')
            }
        }
        for idx, it in enumerate(items)
    ]

    edges = [
        {
            "data": {
                "source": str(l.get('source_id')),
                "target": str(l.get('target_id')),
                "weight": l.get('strength', 1)
            }
        }
        for l in links
    ]

    return {
        "success": True,
        "document_count": len(items),
        "network": {"nodes": nodes, "edges": edges},
        "vosviewer_json": data if 'network' in data else {"network": {"items": items, "links": links}},
        "term_counts": {n["data"]["id"]: n["data"]["frequency"] for n in nodes},
        "frequency_csv": "",
        "cooccurrence_csv": ""
    }


def parse_openalex_json(filepath: str) -> List[Dict[str, Any]]:
    """Parses an OpenAlex JSON / JSONL export into standardized records with all fields."""
    raw_items = []
    lower = filepath.lower()

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        if lower.endswith('.jsonl') or lower.endswith('.ndjson'):
            for line in f:
                line = line.strip()
                if line:
                    try:
                        raw_items.append(json.loads(line))
                    except Exception:
                        pass
        else:
            try:
                data = json.load(f)
                if isinstance(data, list):
                    raw_items = data
                elif isinstance(data, dict):
                    if 'results' in data and isinstance(data['results'], list):
                        raw_items = data['results']
                    elif 'id' in data:
                        raw_items = [data]
            except Exception:
                f.seek(0)
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            raw_items.append(json.loads(line))
                        except Exception:
                            pass

    records = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        title = (item.get('title') or item.get('display_name') or '').strip()
        if not title:
            continue

        # Reconstruct abstract
        abstract = item.get('abstract') or ''
        if not abstract:
            inv_idx = item.get('abstract_inverted_index')
            if inv_idx and isinstance(inv_idx, dict):
                word_positions = []
                for word, positions in inv_idx.items():
                    for pos in positions:
                        word_positions.append((pos, word))
                word_positions.sort(key=lambda x: x[0])
                abstract = " ".join(w for _, w in word_positions)

        year = str(item.get('publication_year') or '').strip()
        if not year and item.get('publication_date'):
            date_val = str(item.get('publication_date')).strip()
            if len(date_val) >= 4:
                year = date_val[:4]

        citations = item.get('cited_by_count') or 0
        try:
            citations = float(citations)
        except Exception:
            citations = 0.0

        # Authors, affiliations, countries
        authors = []
        author_orcids = []
        organizations = []
        countries = []

        # Soporte para listas planas directas (TlachIA Metrics / ClickHouse)
        for a_name in item.get('author_names', []) or []:
            if isinstance(a_name, str) and a_name.strip():
                authors.append(a_name.strip())

        for inst_name in item.get('institution_names', []) or []:
            if isinstance(inst_name, str) and inst_name.strip() and inst_name.strip() not in organizations:
                organizations.append(inst_name.strip())

        for c_code in (item.get('country_codes') or item.get('all_country_codes') or []):
            if isinstance(c_code, str) and c_code.strip() and c_code.strip() not in countries:
                countries.append(c_code.strip())

        # Soporte para estructura anidada OpenAlex REST API
        for auth in item.get('authorships', []) or []:
            if isinstance(auth, dict):
                a_obj = auth.get('author', {}) or {}
                a_name = a_obj.get('display_name')
                if a_name and a_name.strip() not in authors:
                    authors.append(a_name.strip())
                if a_obj.get('orcid'):
                    author_orcids.append(a_obj['orcid'].strip())

                for inst in auth.get('institutions', []) or []:
                    if isinstance(inst, dict):
                        i_name = inst.get('display_name')
                        if i_name and i_name not in organizations:
                            organizations.append(i_name.strip())
                        c_code = inst.get('country_code')
                        if c_code and c_code not in countries:
                            countries.append(c_code.strip())

                for c_val in auth.get('countries', []) or []:
                    if c_val and c_val not in countries:
                        countries.append(c_val.strip())
            elif isinstance(auth, str) and auth.strip() and auth.strip() not in authors:
                authors.append(auth.strip())

        # Keywords
        author_keywords = []
        for kw in item.get('keywords', []) or []:
            if isinstance(kw, dict):
                k_name = kw.get('display_name') or kw.get('keyword') or ''
            else:
                k_name = str(kw)
            if k_name and k_name.strip():
                author_keywords.append(k_name.strip())

        # Concepts
        concepts = []
        for concept in item.get('concepts', []) or []:
            if isinstance(concept, dict):
                c_name = concept.get('display_name')
                if c_name and concept.get('score', 0) > 0.25:
                    concepts.append(c_name.strip())
            elif isinstance(concept, str) and concept.strip():
                concepts.append(concept.strip())

        keywords = list(dict.fromkeys(author_keywords + concepts))

        # Topics / Subfields / Fields / Domains
        topics = []
        subfields = []
        fields = []
        domains = []

        # Soporte para campos planos directos (TlachIA Metrics / ClickHouse)
        if item.get('topic') and isinstance(item.get('topic'), str) and item['topic'].strip():
            topics.append(item['topic'].strip())
        if item.get('subfield') and isinstance(item.get('subfield'), str) and item['subfield'].strip():
            subfields.append(item['subfield'].strip())
        if item.get('field') and isinstance(item.get('field'), str) and item['field'].strip():
            fields.append(item['field'].strip())
        if item.get('domain') and isinstance(item.get('domain'), str) and item['domain'].strip():
            domains.append(item['domain'].strip())

        # Soporte para estructura anidada OpenAlex REST API
        for top in item.get('topics', []) or []:
            if isinstance(top, dict):
                t_name = top.get('display_name')
                if t_name and t_name not in topics:
                    topics.append(t_name.strip())
                sub = top.get('subfield', {}).get('display_name') if isinstance(top.get('subfield'), dict) else None
                if sub and sub not in subfields:
                    subfields.append(sub.strip())
                fld = top.get('field', {}).get('display_name') if isinstance(top.get('field'), dict) else None
                if fld and fld not in fields:
                    fields.append(fld.strip())
                dom = top.get('domain', {}).get('display_name') if isinstance(top.get('domain'), dict) else None
                if dom and dom not in domains:
                    domains.append(dom.strip())
            elif isinstance(top, str) and top.strip() and top.strip() not in topics:
                topics.append(top.strip())

        # Source / Journal & Publisher
        source = ''
        publisher = ''
        if item.get('source_name'):
            source = str(item['source_name']).strip()
        elif item.get('source_id'):
            source = str(item['source_id']).strip()
        prim_loc = item.get('primary_location') or {}
        if isinstance(prim_loc, dict):
            src_obj = prim_loc.get('source', {}) or {}
            if isinstance(src_obj, dict):
                source = src_obj.get('display_name', '') or source
                publisher = src_obj.get('host_organization_name', '') or ''

        # Sustainable Development Goals (SDG)
        sdgs = []
        for sdg in item.get('sustainable_development_goals', []) or []:
            if isinstance(sdg, dict):
                s_name = sdg.get('display_name')
                if s_name and s_name.strip() and s_name.strip() not in sdgs:
                    sdgs.append(s_name.strip())
            elif isinstance(sdg, str) and sdg.strip() and sdg.strip() not in sdgs:
                sdgs.append(sdg.strip())

        # Document Type & Language
        doc_type = str(item.get('type') or '').strip()
        language = str(item.get('language') or '').strip()

        # Funders
        funders = []
        for fld in item.get('funders', []) or []:
            f_name = fld.get('display_name') if isinstance(fld, dict) else str(fld)
            if f_name: funders.append(f_name.strip())

        # Referenced works (cited references)
        referenced_works = []
        for ref in item.get('referenced_works', []) or []:
            referenced_works.append(str(ref).split('/')[-1])

        # DOI & Work ID
        doi = item.get('doi') or ''
        work_id = item.get('id') or ''
        fwci = str(item.get('fwci') or '')
        oa_status = item.get('open_access', {}).get('oa_status', '') if isinstance(item.get('open_access'), dict) else ''

        rec = {
            'title': title,
            'abstract': abstract,
            'year': year,
            'citations': citations,
            'authors': authors,
            'author_orcids': author_orcids,
            'keywords': keywords,
            'author_keywords': author_keywords,
            'concepts': concepts,
            'topics': topics,
            'subfields': subfields,
            'fields': fields,
            'domains': domains,
            'sdgs': sdgs,
            'doc_type': doc_type,
            'language': language,
            'publisher': publisher,
            'organizations': organizations,
            'countries': countries,
            'continents': [],
            'funders': funders,
            'source': source,
            'doi': doi,
            'work_id': work_id,
            'referenced_works': referenced_works,
            'references': referenced_works,
            'open_access': oa_status,
            'fwci': fwci,
            # Metaknowledge / WOS tags compatibility
            'TI': title,
            'AU': authors,
            'PY': year,
            'TC': citations,
            'DE': author_keywords,
            'ID': concepts,
            'SO': source,
            'C1': organizations,
            'CU': countries,
            'FU': funders,
            'AB': abstract,
            'DI': doi,
            'CR': referenced_works,
            'Topic': topics,
            'Subfield': subfields,
            'Field': fields,
            'Domain': domains,
            'Concept': concepts,
            'SDG': sdgs,
            'OA': [oa_status] if oa_status else [],
            'DT': [doc_type] if doc_type else [],
            'LA': [language] if language else [],
            'PU': [publisher] if publisher else [],
            'WC': subfields if subfields else fields,
            'SC': fields if fields else domains
        }
        records.append(rec)
    return records

