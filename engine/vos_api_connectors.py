"""
vos_api_connectors.py - Live API Query Connectors for OpenAlex, Crossref, and DOIs for knoMap
---------------------------------------------------------------------------------------------
Allows users to retrieve live bibliographic datasets directly inside knoMap.
"""

import json
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Optional


def search_openalex_works(query: str, max_results: int = 100, mailto: str = "knomap@user.org") -> List[Dict[str, Any]]:
    """
    Queries OpenAlex API for scholarly works matching the search query.
    Returns normalized records for bibliometric analysis.
    """
    records = []
    encoded_query = urllib.parse.quote(query)
    url = f"https://api.openalex.org/works?search={encoded_query}&per-page={min(200, max_results)}&mailto={mailto}"

    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': f'knoMap-Bibliometrics/1.0 (mailto:{mailto})'}
        )
        with urllib.request.urlopen(req, timeout=20) as response:
            data = json.loads(response.read().decode('utf-8'))
            results = data.get('results', [])

            for item in results:
                title = item.get('title') or ''
                if not title:
                    continue

                # Reconstruct abstract from abstract_inverted_index if present
                abstract = ""
                inv_idx = item.get('abstract_inverted_index')
                if inv_idx and isinstance(inv_idx, dict):
                    word_positions = []
                    for word, positions in inv_idx.items():
                        for pos in positions:
                            word_positions.append((pos, word))
                    word_positions.sort(key=lambda x: x[0])
                    abstract = " ".join(w for _, w in word_positions)

                year = str(item.get('publication_year') or '')
                citations = item.get('cited_by_count') or 0

                # Authors
                authors = []
                for auth in item.get('authorships', []):
                    author_name = auth.get('author', {}).get('display_name')
                    if author_name:
                        authors.append(author_name)

                # Concepts / Keywords
                keywords = []
                for concept in item.get('concepts', []):
                    c_name = concept.get('display_name')
                    if c_name and concept.get('score', 0) > 0.3:
                        keywords.append(c_name)

                for kw in item.get('keywords', []):
                    k_name = kw.get('keyword') if isinstance(kw, dict) else str(kw)
                    if k_name and k_name not in keywords:
                        keywords.append(k_name)

                source = item.get('primary_location', {}).get('source', {}).get('display_name', '') if item.get('primary_location') else ''
                doi = item.get('doi') or ''

                records.append({
                    'title': title,
                    'abstract': abstract,
                    'year': year,
                    'citations': citations,
                    'authors': authors,
                    'keywords': keywords,
                    'source': source,
                    'doi': doi
                })
    except Exception as e:
        print(f"[OpenAlex API Warning] Query failed: {e}")

    return records


def search_crossref_works(query: str, max_results: int = 50, mailto: str = "knomap@user.org") -> List[Dict[str, Any]]:
    """
    Queries Crossref API for works matching the bibliographic search query.
    """
    records = []
    encoded_query = urllib.parse.quote(query)
    url = f"https://api.crossref.org/works?query={encoded_query}&rows={min(100, max_results)}&mailto={mailto}"

    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': f'knoMap-Bibliometrics/1.0 (mailto:{mailto})'}
        )
        with urllib.request.urlopen(req, timeout=20) as response:
            data = json.loads(response.read().decode('utf-8'))
            items = data.get('message', {}).get('items', [])

            for item in items:
                title_list = item.get('title', [])
                title = title_list[0] if title_list else ''
                if not title:
                    continue

                abstract = item.get('abstract', '')
                # Clean XML/JATS tags if present in Crossref abstract
                if abstract and '<jats:' in abstract:
                    import re
                    abstract = re.sub(r'<[^>]+>', ' ', abstract)

                year = ""
                pub_date = item.get('published-print') or item.get('published-online') or item.get('created')
                if pub_date and 'date-parts' in pub_date and pub_date['date-parts']:
                    year = str(pub_date['date-parts'][0][0])

                citations = item.get('is-referenced-by-count') or 0

                # Authors
                authors = []
                for auth in item.get('author', []):
                    given = auth.get('given', '')
                    family = auth.get('family', '')
                    name = f"{family}, {given}".strip(', ')
                    if name:
                        authors.append(name)

                # Subjects
                keywords = item.get('subject', [])

                source_list = item.get('container-title', [])
                source = source_list[0] if source_list else ''
                doi = item.get('DOI', '')

                records.append({
                    'title': title,
                    'abstract': abstract,
                    'year': year,
                    'citations': citations,
                    'authors': authors,
                    'keywords': keywords,
                    'source': source,
                    'doi': doi
                })
    except Exception as e:
        print(f"[Crossref API Warning] Query failed: {e}")

    return records
