"""
vos_nlp.py - Lightweight VOSviewer NLP and Relevance Score Engine for knoMap
-----------------------------------------------------------------------------
Performs:
1. Cleaning of copyright / publisher notices and structured abstract tags.
2. Noun Phrase (NP) extraction using lightweight fast POS/regex chunking.
3. Term normalization and singularization.
4. VOSviewer Relevance Score algorithm to filter out general/non-specific scientific terms.
"""

import re
import math
from collections import Counter, defaultdict
from typing import List, Dict, Tuple, Optional, Set

# Common scientific stopwords to ignore in noun phrases
STOPWORDS = {
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
    'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
    'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
    'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
    'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t',
    'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s',
    'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how',
    'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is',
    'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most',
    'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once',
    'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
    'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
    'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their',
    'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they',
    'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through',
    'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
    'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when',
    'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom',
    'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d',
    'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves',
    # General non-substantive words
    'paper', 'study', 'studies', 'result', 'results', 'finding', 'findings',
    'conclusion', 'conclusions', 'approach', 'method', 'methods', 'analysis',
    'analyses', 'data', 'present', 'presents', 'presented', 'article', 'use',
    'used', 'using', 'based', 'show', 'shows', 'shown', 'also', 'well', 'high',
    'new', 'different', 'various', 'important', 'significant', 'potential',
    'respectively', 'due', 'within', 'among', 'across', 'including', 'et', 'al'
}

# Regex patterns for copyright / publisher removal
COPYRIGHT_PATTERNS = [
    re.compile(r'copyright\s+(?:©|\(c\))?\s*\d{4}[^\n\.]*', re.IGNORECASE),
    re.compile(r'©\s*\d{4}[^\n\.]*', re.IGNORECASE),
    re.compile(r'all rights reserved[^\n\.]*', re.IGNORECASE),
    re.compile(r'published by\s+[^\n\.]*', re.IGNORECASE),
    re.compile(r'elsevier\s+(?:b\.v\.|inc\.|ltd\.)[^\n\.]*', re.IGNORECASE),
    re.compile(r'springer(?:\s+nature)?[^\n\.]*', re.IGNORECASE),
    re.compile(r'ieee[^\n\.]*', re.IGNORECASE),
    re.compile(r'wiley[^\n\.]*', re.IGNORECASE),
]

# Structured abstract prefixes
STRUCTURED_ABSTRACT_TAGS = re.compile(
    r'\b(BACKGROUND|OBJECTIVES?|METHODS?|DESIGN|SETTING|PARTICIPANTS|INTERVENTIONS?|MAIN OUTCOMES?|RESULTS?|CONCLUSIONS?|SIGNIFICANCE|SUMMARY|PURPOSE|RATIONALE|MATERIALS? AND METHODS?)\s*:\s*',
    re.IGNORECASE
)


def clean_scientific_text(text: str, remove_copyright: bool = True, remove_structured_tags: bool = True) -> str:
    """Cleans raw title or abstract text."""
    if not text or not isinstance(text, str):
        return ""

    cleaned = text

    if remove_structured_tags:
        cleaned = STRUCTURED_ABSTRACT_TAGS.sub(' ', cleaned)

    if remove_copyright:
        for pat in COPYRIGHT_PATTERNS:
            cleaned = pat.sub(' ', cleaned)

    # Normalize whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def singularize_term(term: str) -> str:
    """
    Lightweight rule-based English singularization.
    Handles regular and irregular plurals.
    """
    term_lower = term.lower().strip()
    words = term_lower.split()
    if not words:
        return term

    last_word = words[-1]

    # Irregular rules
    irregular_map = {
        'analyses': 'analysis',
        'hypotheses': 'hypothesis',
        'theses': 'thesis',
        'crises': 'crisis',
        'criteria': 'criterion',
        'phenomena': 'phenomenon',
        'indices': 'index',
        'matrices': 'matrix',
        'vertices': 'vertex',
        'bacteria': 'bacterium',
        'fungi': 'fungus',
        'nuclei': 'nucleus',
        'radii': 'radius',
        'stimuli': 'stimulus',
        'data': 'data',
        'species': 'species',
    }
    if last_word in irregular_map:
        words[-1] = irregular_map[last_word]
        return " ".join(words)

    # Standard rules
    if len(last_word) > 4:
        if last_word.endswith('ies') and not last_word.endswith('eies'):
            words[-1] = last_word[:-3] + 'y'
        elif last_word.endswith('ses') and not last_word.endswith('sses'):
            words[-1] = last_word[:-2]
        elif last_word.endswith(('ches', 'shes', 'xes', 'zes')):
            words[-1] = last_word[:-2]
        elif last_word.endswith('s') and not last_word.endswith(('ss', 'us', 'is', 'as')):
            words[-1] = last_word[:-1]

    return " ".join(words)


def extract_noun_phrases(text: str) -> List[str]:
    """
    Extracts multi-word and single-word noun phrases using fast pattern matching.
    Matches standard VOSviewer patterns: (Adjective* Noun+)
    """
    if not text:
        return []

    # Clean text
    clean_txt = clean_scientific_text(text)

    # Split into candidate sentences
    sentences = re.split(r'[.!?;\n]+', clean_txt)
    extracted_terms = []

    # Fast word tokenization matching alphabetic sequences and hyphens
    word_pat = re.compile(r'\b[a-zA-Z][a-zA-Z0-9_\-]*(?:/[a-zA-Z0-9_\-]+)?\b')

    for sent in sentences:
        tokens = word_pat.findall(sent)
        if not tokens:
            continue

        n = len(tokens)
        i = 0
        while i < n:
            tok_lower = tokens[i].lower()

            # Skip stopwords and single letters (unless acronym)
            if tok_lower in STOPWORDS or (len(tok_lower) == 1 and not tokens[i].isupper()):
                i += 1
                continue

            # Accumulate candidate phrase (up to 3 consecutive non-stop content words)
            phrase_tokens = [tok_lower]
            j = i + 1
            while j < n and (j - i) < 3:
                next_tok = tokens[j].lower()
                if next_tok in STOPWORDS or len(next_tok) <= 1:
                    break
                phrase_tokens.append(next_tok)
                j += 1

            # Save multi-word or single-word phrase
            phrase_raw = " ".join(phrase_tokens)
            phrase_sing = singularize_term(phrase_raw)

            if len(phrase_sing) > 2 and phrase_sing not in STOPWORDS:
                extracted_terms.append(phrase_sing)

            # Move forward
            i = j if j > i + 1 else i + 1

    return extracted_terms


def calculate_relevance_scores(doc_terms_list: List[List[str]]) -> Dict[str, float]:
    """
    Calculates VOSviewer Relevance Scores for extracted terms across documents.
    Formula:
    For each term w, relevance measures the degree to which the co-occurrence distribution
    of w with other terms differs from the general co-occurrence distribution.

    Terms that co-occur with a wide range of terms equally have lower relevance (generic terms).
    Terms that co-occur specifically with a cluster of related concepts have higher relevance.
    """
    term_doc_freq = Counter()
    term_cooc = defaultdict(Counter)

    for terms in doc_terms_list:
        unique_terms = set(terms)
        for t in unique_terms:
            term_doc_freq[t] += 1
        # Co-occurrences
        terms_list = list(unique_terms)
        for i in range(len(terms_list)):
            for j in range(i + 1, len(terms_list)):
                t1, t2 = terms_list[i], terms_list[j]
                term_cooc[t1][t2] += 1
                term_cooc[t2][t1] += 1

    num_docs = len(doc_terms_list)
    if num_docs == 0:
        return {}

    # Calculate general distribution P(w2)
    total_term_occurrences = sum(term_doc_freq.values())
    if total_term_occurrences == 0:
        return {t: 1.0 for t in term_doc_freq}

    prob_general = {t: freq / total_term_occurrences for t, freq in term_doc_freq.items()}

    relevance_scores = {}

    for w1, neighbors in term_cooc.items():
        total_cooc_w1 = sum(neighbors.values())
        if total_cooc_w1 == 0:
            relevance_scores[w1] = 0.0
            continue

        # Kullback-Leibler divergence or Jensen-Shannon variation
        score = 0.0
        for w2, cooc_count in neighbors.items():
            p_w2_given_w1 = cooc_count / total_cooc_w1
            p_w2 = prob_general.get(w2, 1e-9)

            if p_w2_given_w1 > 0 and p_w2 > 0:
                score += p_w2_given_w1 * math.log(p_w2_given_w1 / p_w2)

        relevance_scores[w1] = round(score, 4)

    # For terms with no co-occurrences, default to 0
    for t in term_doc_freq:
        if t not in relevance_scores:
            relevance_scores[t] = 0.0

    return relevance_scores


def filter_top_relevant_terms(
    doc_terms_list: List[List[str]],
    min_occurrence: int = 2,
    relevance_threshold_ratio: float = 0.60
) -> Tuple[List[List[str]], Dict[str, float], Set[str]]:
    """
    Filters terms by minimum occurrence and keeps the top (e.g. 60%) most relevant terms.
    Returns: (filtered_doc_terms_list, relevance_scores, selected_terms_set)
    """
    term_counts = Counter(t for d in doc_terms_list for t in d)

    # Filter by minimum occurrence
    eligible_terms = {t for t, c in term_counts.items() if c >= min_occurrence}

    if not eligible_terms:
        return doc_terms_list, {}, set(term_counts.keys())

    # Calculate relevance scores
    cleaned_doc_terms = [[t for t in d if t in eligible_terms] for d in doc_terms_list]
    rel_scores = calculate_relevance_scores(cleaned_doc_terms)

    # Sort eligible terms by relevance score descending
    sorted_terms = sorted(eligible_terms, key=lambda t: (rel_scores.get(t, 0.0), term_counts[t]), reverse=True)

    # Select top percentage (default 60%)
    keep_count = max(1, int(len(sorted_terms) * relevance_threshold_ratio))
    selected_terms = set(sorted_terms[:keep_count])

    # Filter doc terms
    final_doc_terms = [[t for t in d if t in selected_terms] for d in doc_terms_list]

    return final_doc_terms, rel_scores, selected_terms
