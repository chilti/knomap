import json
import math
from collections import defaultdict, Counter

def calculate_h_index(citations_list):
    citations = sorted([int(c) for c in citations_list if str(c).isdigit()], reverse=True)
    h_index = 0
    for i, c in enumerate(citations):
        if c >= i + 1:
            h_index = i + 1
        else:
            break
    return h_index

def calculate_g_index(citations_list):
    citations = sorted([int(c) for c in citations_list if str(c).isdigit()], reverse=True)
    g_index = 0
    sum_citations = 0
    for i, c in enumerate(citations):
        sum_citations += c
        if sum_citations >= (i + 1) ** 2:
            g_index = i + 1
        else:
            break
    return g_index

def calculate_m_index(h_index, first_year, current_year=2026):
    try:
        years_active = current_year - int(first_year)
        if years_active <= 0:
            years_active = 1
        return round(h_index / years_active, 3)
    except Exception:
        return 0.0

def generate_eda_report(records):
    """
    Computes Descriptive EDA and Author metrics without pybibx.
    records: list of dictionaries representing parsed bibliographic records.
    """
    total_docs = len(records)
    if total_docs == 0:
        return {"success": False, "error": "No records to analyze."}

    authors_docs = defaultdict(list)
    authors_cits = defaultdict(list)
    authors_years = defaultdict(list)
    
    sources_count = Counter()
    countries_count = Counter()
    languages_count = Counter()
    keywords_count = Counter()
    
    total_citations = 0
    multi_authored = 0
    single_authored = 0
    
    for r in records:
        # Resolve fields flexibly (Scopus CSV vs RIS vs Web of Science vs PubMed)
        authors_raw = r.get('Authors') or r.get('authors') or r.get('AU') or r.get('A1') or []
        if isinstance(authors_raw, list):
            authors = [str(a).strip() for a in authors_raw if str(a).strip()]
        else:
            authors = [a.strip() for a in str(authors_raw).split(';') if a.strip()]
            
        raw_year = r.get('Year') or r.get('year') or r.get('PY') or r.get('DP') or ''
        # Clean 4-digit year if string contains date like '2024 Sep'
        year_str = str(raw_year).strip()
        year_digits = ''.join([c for c in year_str[:4] if c.isdigit()])
        year = int(year_digits) if len(year_digits) == 4 else None

        source = r.get('Source title') or r.get('journal') or r.get('SO') or r.get('JT') or ''
        cits = r.get('Cited by', r.get('TC', r.get('tc', r.get('cited_by', 0))))
        affils = r.get('Affiliations') or r.get('affiliations') or r.get('C1') or r.get('AD') or ''
        language = r.get('Language') or r.get('language') or r.get('LA') or 'English'
        
        kw_raw = r.get('Author Keywords') or r.get('keywords') or r.get('DE') or r.get('ID') or r.get('MH') or []
        if isinstance(kw_raw, list):
            keywords = [str(k).strip() for k in kw_raw if str(k).strip()]
        else:
            keywords = [k.strip() for k in str(kw_raw).split(';') if k.strip()]
            
        cits_val = 0
        if isinstance(cits, (int, float)):
            cits_val = int(cits)
        elif str(cits).strip().isdigit():
            cits_val = int(str(cits).strip())
        total_citations += cits_val
        
        n_authors = len(authors)
        if n_authors > 1:
            multi_authored += 1
        elif n_authors == 1:
            single_authored += 1
            
        for a in authors:
            authors_docs[a].append(1)
            authors_cits[a].append(cits_val)
            if year:
                authors_years[a].append(year)
                
        if source:
            sources_count[str(source).strip()] += 1
        if language:
            languages_count[str(language).strip()] += 1
            
        for kw in keywords:
            if len(kw) > 1:
                keywords_count[kw.lower()] += 1
            
        # Extract countries from affiliations if possible
        if affils:
            if isinstance(affils, list):
                affils_list = affils
            else:
                affils_list = str(affils).split(';')
            for aff in affils_list:
                parts = str(aff).split(',')
                if parts:
                    country = parts[-1].strip().lower()
                    if len(country) > 2 and not country.isdigit():
                        countries_count[country] += 1

    unique_authors = len(authors_docs)
    
    # Calculate Author Metrics
    author_metrics = []
    for a in authors_docs.keys():
        docs_count = len(authors_docs[a])
        cits_list = authors_cits[a]
        total_cits_a = sum(cits_list)
        h_idx = calculate_h_index(cits_list)
        g_idx = calculate_g_index(cits_list)
        
        first_yr = min(authors_years[a]) if authors_years[a] else 2026
        m_idx = calculate_m_index(h_idx, first_yr)
        
        author_metrics.append({
            "author": a,
            "documents": docs_count,
            "citations": total_cits_a,
            "h_index": h_idx,
            "g_index": g_idx,
            "m_index": m_idx,
            "first_year": first_yr
        })
        
    author_metrics = sorted(author_metrics, key=lambda x: x['h_index'], reverse=True)[:100]
    
    timespan = "N/A"
    all_years = [y for yl in authors_years.values() for y in yl]
    if all_years:
        timespan = f"{min(all_years)} - {max(all_years)}"

    bradford_res = compute_bradford_law(records)
    lotka_res = compute_lotka_law(records)
    country_collab_res = compute_country_collaboration(records)
    annual_prod_res = compute_annual_production_cagr(records)
    thematic_map_res = compute_thematic_map(records)

    report = {
        "success": True,
        "health": {
            "timespan": timespan,
            "total_documents": total_docs,
            "total_authors": unique_authors,
            "total_sources": len(sources_count),
            "total_countries": len(countries_count),
            "single_authored_docs": single_authored,
            "multi_authored_docs": multi_authored,
            "total_citations": total_citations
        },
        "averages": {
            "docs_per_author": round(total_docs / unique_authors, 2) if unique_authors > 0 else 0,
            "cits_per_doc": round(total_citations / total_docs, 2) if total_docs > 0 else 0,
            "collab_index": round(sum([len(authors_docs[a]) for a in authors_docs]) / total_docs, 2) if total_docs > 0 else 0
        },
        "author_metrics": author_metrics,
        "top_keywords": [{"text": k, "value": v} for k, v in keywords_count.most_common(300)],
        "languages": [{"name": k, "count": v} for k, v in languages_count.most_common(10)],
        "bradford_law": bradford_res,
        "lotka_law": lotka_res,
        "country_collab": country_collab_res,
        "annual_production": annual_prod_res,
        "thematic_map": thematic_map_res
    }
    return report

def generate_sankey_data(records, top_n=10):
    """
    Generates data for a Sankey diagram: Country -> Institution -> Journal
    """
    links = defaultdict(int)
    nodes_set = set()
    
    for r in records:
        affils = r.get('Affiliations') or r.get('affiliations') or r.get('C1') or r.get('AD') or ''
        source = r.get('Source title') or r.get('journal') or r.get('SO') or r.get('JT') or ''
        if not source or not affils:
            continue
            
        source = str(source).title().strip()
        if isinstance(affils, list):
            affils_list = affils
        else:
            affils_list = str(affils).split(';')

        for aff in affils_list:
            parts = str(aff).split(',')
            if len(parts) >= 2:
                institution = parts[0].strip().title()
                country = parts[-1].strip().title()
                
                if len(country) > 2 and len(institution) > 2 and not country.isdigit():
                    nodes_set.add(country)
                    nodes_set.add(institution)
                    nodes_set.add(source)
                    
                    links[(country, institution)] += 1
                    links[(institution, source)] += 1
                    
    # Convert to D3/Recharts format
    sorted_links = sorted(links.items(), key=lambda x: x[1], reverse=True)[:top_n * 3]
    
    filtered_nodes = set()
    sankey_links = []
    for (src, dst), weight in sorted_links:
        filtered_nodes.add(src)
        filtered_nodes.add(dst)
        
    node_list = list(filtered_nodes)
    node_idx = {n: i for i, n in enumerate(node_list)}
    
    for (src, dst), weight in sorted_links:
        sankey_links.append({
            "source": node_idx[src],
            "target": node_idx[dst],
            "value": weight,
            "sourceName": src,
            "targetName": dst
        })
        
    return {
        "nodes": [{"name": n} for n in node_list],
        "links": sankey_links
    }

def generate_term_growth(records, top_n=5):
    """
    Generates temporal growth of top keywords.
    """
    year_term_count = defaultdict(lambda: defaultdict(int))
    term_total = Counter()
    
    for r in records:
        raw_year = r.get('Year') or r.get('year') or r.get('PY') or r.get('DP') or ''
        year_str = str(raw_year).strip()
        year_digits = ''.join([c for c in year_str[:4] if c.isdigit()])
        if len(year_digits) != 4:
            continue
        y = int(year_digits)

        kw_raw = r.get('Author Keywords') or r.get('keywords') or r.get('DE') or r.get('ID') or r.get('MH') or []
        if not kw_raw:
            continue
            
        if isinstance(kw_raw, list):
            keywords = [str(k).strip().lower() for k in kw_raw if str(k).strip()]
        else:
            keywords = [k.strip().lower() for k in str(kw_raw).split(';') if k.strip()]
            
        for kw in keywords:
            if len(kw) > 2:
                year_term_count[y][kw] += 1
                term_total[kw] += 1
                
    top_terms = [k for k, v in term_total.most_common(top_n)]
    
    growth_data = []
    if year_term_count:
        min_y = min(year_term_count.keys())
        max_y = max(year_term_count.keys())
        
        for y in range(min_y, max_y + 1):
            row = {"year": str(y)}
            for t in top_terms:
                row[t] = year_term_count[y].get(t, 0)
            growth_data.append(row)
            
    return {
        "data": growth_data,
        "lines": top_terms
    }

def compute_bradford_law(records):
    source_counts = Counter()
    for r in records:
        s = r.get('Source title') or r.get('journal') or r.get('SO') or r.get('JT') or ''
        s = str(s).strip().title()
        if len(s) > 2:
            source_counts[s] += 1
            
    if not source_counts:
        return None
        
    sorted_sources = source_counts.most_common()
    total_articles = sum(source_counts.values())
    target_zone = total_articles / 3.0
    
    zone1_sources = []
    zone2_sources = []
    zone3_sources = []
    
    cum = 0
    curve = []
    for rank, (src, count) in enumerate(sorted_sources, 1):
        cum += count
        cum_pct = round((cum / total_articles) * 100, 1)
        
        if cum <= target_zone or (not zone1_sources and cum >= target_zone):
            zone = 1
            zone1_sources.append({"rank": rank, "source": src, "articles": count, "cum_articles": cum, "cum_percent": cum_pct})
        elif cum <= 2 * target_zone or (not zone2_sources and cum >= 2 * target_zone):
            zone = 2
            zone2_sources.append({"rank": rank, "source": src, "articles": count, "cum_articles": cum, "cum_percent": cum_pct})
        else:
            zone = 3
            zone3_sources.append({"rank": rank, "source": src, "articles": count, "cum_articles": cum, "cum_percent": cum_pct})
            
        if rank <= 50 or rank % 5 == 0 or rank == len(sorted_sources):
            curve.append({
                "rank": rank,
                "log_rank": round(math.log(rank), 2),
                "cum_articles": cum,
                "cum_percent": cum_pct,
                "zone": zone
            })
            
    k_mult = round(len(zone2_sources) / len(zone1_sources), 2) if zone1_sources else 1.0
    
    return {
        "core_sources": zone1_sources[:20],
        "summary": {
            "total_sources": len(sorted_sources),
            "total_articles": total_articles,
            "zone1_journals": len(zone1_sources),
            "zone1_articles": sum(s['articles'] for s in zone1_sources),
            "zone2_journals": len(zone2_sources),
            "zone2_articles": sum(s['articles'] for s in zone2_sources),
            "zone3_journals": len(zone3_sources),
            "zone3_articles": sum(s['articles'] for s in zone3_sources),
            "multiplier_k": k_mult
        },
        "curve": curve
    }

def compute_lotka_law(records):
    authors_count = Counter()
    for r in records:
        raw_authors = r.get('Authors') or r.get('authors') or r.get('AU') or ''
        if isinstance(raw_authors, list):
            auths = raw_authors
        else:
            auths = str(raw_authors).split(';')
        for a in auths:
            a_clean = str(a).strip().title()
            if len(a_clean) > 2:
                authors_count[a_clean] += 1
                
    if not authors_count:
        return None
        
    doc_freq = Counter(authors_count.values())
    total_authors = len(authors_count)
    
    points = []
    log_x = []
    log_y = []
    for x in sorted(doc_freq.keys()):
        count = doc_freq[x]
        p_emp = count / total_authors
        points.append((x, count, p_emp))
        if x <= 15:
            log_x.append(math.log(x))
            log_y.append(math.log(p_emp))
            
    beta = 2.0
    if len(log_x) >= 2:
        mean_x = sum(log_x) / len(log_x)
        mean_y = sum(log_y) / len(log_y)
        denom = sum((xi - mean_x) ** 2 for xi in log_x)
        if denom > 1e-6:
            numer = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(log_x, log_y))
            beta = -numer / denom
            
    beta = max(1.1, min(3.5, round(beta, 2)))
    c_norm = 1.0 / sum(1.0 / (k ** beta) for k in range(1, 101))
    
    plot_data = []
    for x in range(1, min(16, max(doc_freq.keys()) + 1)):
        actual_count = doc_freq.get(x, 0)
        empirical_pct = round((actual_count / total_authors) * 100, 2)
        theo_pct = round((c_norm / (x ** beta)) * 100, 2)
        plot_data.append({
            "documents": x,
            "authors_count": actual_count,
            "empirical_percent": empirical_pct,
            "theoretical_percent": theo_pct
        })
        
    return {
        "beta": beta,
        "constant_c": round(c_norm, 4),
        "total_authors": total_authors,
        "single_paper_authors": doc_freq.get(1, 0),
        "single_paper_ratio": round((doc_freq.get(1, 0) / total_authors) * 100, 1),
        "data": plot_data
    }

def compute_country_collaboration(records):
    country_scp = Counter()
    country_mcp = Counter()
    
    for r in records:
        affils = r.get('Affiliations') or r.get('affiliations') or r.get('C1') or r.get('AD') or ''
        if isinstance(affils, list):
            affils_list = affils
        else:
            affils_list = str(affils).split(';')
            
        paper_countries = set()
        for aff in affils_list:
            parts = str(aff).split(',')
            if len(parts) >= 2:
                c = parts[-1].strip().title()
                if len(c) > 2 and not c.isdigit():
                    paper_countries.add(c)
                    
        if len(paper_countries) == 1:
            country_scp[list(paper_countries)[0]] += 1
        elif len(paper_countries) > 1:
            for c in paper_countries:
                country_mcp[c] += 1
                
    all_countries = set(country_scp.keys()) | set(country_mcp.keys())
    if not all_countries:
        return None
        
    data = []
    for c in all_countries:
        scp = country_scp[c]
        mcp = country_mcp[c]
        total = scp + mcp
        ratio = round(mcp / total, 3) if total > 0 else 0
        data.append({
            "country": c,
            "scp": scp,
            "mcp": mcp,
            "total": total,
            "mcp_ratio": ratio
        })
        
    data.sort(key=lambda x: x['total'], reverse=True)
    return {
        "top_countries": data[:15],
        "total_analyzed_countries": len(data)
    }

def compute_annual_production_cagr(records):
    year_docs = Counter()
    year_cits = defaultdict(int)
    
    for r in records:
        raw_year = r.get('Year') or r.get('year') or r.get('PY') or r.get('DP') or ''
        year_str = str(raw_year).strip()
        year_digits = ''.join([c for c in year_str[:4] if c.isdigit()])
        if len(year_digits) != 4:
            continue
        y = int(year_digits)
        if 1950 <= y <= 2030:
            year_docs[y] += 1
            cit_str = r.get('Cited by') or r.get('citations') or r.get('TC') or 0
            try:
                year_cits[y] += int(cit_str)
            except:
                pass
                
    if not year_docs:
        return None
        
    sorted_years = sorted(year_docs.keys())
    min_y, max_y = sorted_years[0], sorted_years[-1]
    
    cagr = 0.0
    if len(sorted_years) > 1 and max_y > min_y:
        start_val = year_docs[min_y]
        end_val = year_docs[max_y]
        if start_val > 0 and end_val > 0:
            cagr = round(((end_val / start_val) ** (1.0 / (max_y - min_y)) - 1.0) * 100, 2)
            
    series = []
    for y in range(min_y, max_y + 1):
        docs = year_docs.get(y, 0)
        cits = year_cits.get(y, 0)
        avg_c = round(cits / docs, 2) if docs > 0 else 0
        series.append({
            "year": str(y),
            "articles": docs,
            "avg_citations": avg_c
        })
        
    return {
        "cagr_percent": cagr,
        "timespan": f"{min_y} - {max_y}",
        "series": series
    }

def compute_thematic_map(records, max_terms=35):
    """
    Callon's Centrality vs Callon's Density strategic diagram.
    """
    kw_cooc = defaultdict(int)
    kw_freq = Counter()
    
    for r in records:
        kw_raw = r.get('Author Keywords') or r.get('keywords') or r.get('DE') or r.get('ID') or []
        if isinstance(kw_raw, list):
            kws = [str(k).strip().lower() for k in kw_raw if len(str(k).strip()) > 2]
        else:
            kws = [k.strip().lower() for k in str(kw_raw).split(';') if len(k.strip()) > 2]
            
        kws = list(set(kws))
        for k in kws:
            kw_freq[k] += 1
            
        for i in range(len(kws)):
            for j in range(i + 1, len(kws)):
                pair = tuple(sorted([kws[i], kws[j]]))
                kw_cooc[pair] += 1
                
    top_terms = [k for k, _ in kw_freq.most_common(max_terms)]
    if len(top_terms) < 4:
        return None
        
    term_set = set(top_terms)
    adj = defaultdict(dict)
    for (t1, t2), w in kw_cooc.items():
        if t1 in term_set and t2 in term_set:
            adj[t1][t2] = w
            adj[t2][t1] = w
            
    clusters = []
    visited = set()
    for t in top_terms:
        if t not in visited:
            cluster = [t]
            visited.add(t)
            neighbors = sorted(adj[t].items(), key=lambda x: x[1], reverse=True)
            for n_term, _ in neighbors:
                if n_term not in visited and len(cluster) < 6:
                    visited.add(n_term)
                    cluster.append(n_term)
            clusters.append(cluster)
            
    if not clusters:
        return None
        
    cluster_stats = []
    all_densities = []
    all_centralities = []
    
    for idx, c_nodes in enumerate(clusters):
        c_set = set(c_nodes)
        internal_weight = 0
        external_weight = 0
        
        for n in c_nodes:
            for neighbor, w in adj[n].items():
                if neighbor in c_set:
                    internal_weight += w
                else:
                    external_weight += w
                    
        internal_weight /= 2.0
        n_size = len(c_nodes)
        density = (internal_weight / (n_size * (n_size - 1) / 2)) if n_size > 1 else 1.0
        centrality = external_weight / n_size if n_size > 0 else 0.0
        
        all_densities.append(density)
        all_centralities.append(centrality)
        
        cluster_stats.append({
            "id": idx + 1,
            "name": c_nodes[0].title(),
            "keywords": [k.title() for k in c_nodes],
            "size": sum(kw_freq[k] for k in c_nodes),
            "raw_density": density,
            "raw_centrality": centrality
        })
        
    med_density = sorted(all_densities)[len(all_densities) // 2] if all_densities else 1.0
    med_centrality = sorted(all_centralities)[len(all_centralities) // 2] if all_centralities else 1.0
    
    min_d, max_d = min(all_densities), max(all_densities)
    min_c, max_c = min(all_centralities), max(all_centralities)
    
    norm_clusters = []
    for cs in cluster_stats:
        norm_d = round(1 + 8 * ((cs["raw_density"] - min_d) / (max_d - min_d or 1)), 2)
        norm_c = round(1 + 8 * ((cs["raw_centrality"] - min_c) / (max_c - min_c or 1)), 2)
        
        if cs["raw_centrality"] >= med_centrality and cs["raw_density"] >= med_density:
            quadrant = "Motor Themes"
        elif cs["raw_centrality"] < med_centrality and cs["raw_density"] >= med_density:
            quadrant = "Niche Themes"
        elif cs["raw_centrality"] < med_centrality and cs["raw_density"] < med_density:
            quadrant = "Emerging or Declining"
        else:
            quadrant = "Basic Themes"
            
        norm_clusters.append({
            "id": cs["id"],
            "name": cs["name"],
            "keywords": cs["keywords"],
            "size": cs["size"],
            "centrality": norm_c,
            "density": norm_d,
            "quadrant": quadrant
        })
        
    return {
        "clusters": norm_clusters,
        "median_centrality": 5.0,
        "median_density": 5.0
    }

