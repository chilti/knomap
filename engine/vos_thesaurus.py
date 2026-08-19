"""
vos_thesaurus.py - VOSviewer Thesaurus Data Cleaning Engine for knoMap
----------------------------------------------------------------------
Supports reading VOSviewer thesaurus files (.txt, .csv, .tsv) to:
1. Replace synonyms/variants with a canonical label (e.g. "som" -> "self-organizing map").
2. Exclude/filter unwanted noisy terms (when 'replace by' is empty or '<ignore>').
"""

import os
import csv
from typing import Dict, Optional, Set, List


class VosThesaurus:
    def __init__(self, filepath: Optional[str] = None):
        self.replacements: Dict[str, str] = {}
        self.ignored_terms: Set[str] = {}
        if filepath and os.path.exists(filepath):
            self.load(filepath)

    def load(self, filepath: str):
        """
        Loads a thesaurus file.
        Accepted formats:
        - Tab-delimited (.txt/.tsv): Label \t Replace by
        - Comma-delimited (.csv): "label","replace by" or label,replace_by
        """
        self.replacements = {}
        self.ignored_terms = set()

        if not os.path.exists(filepath):
            return

        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            sample = f.read(2048)
            f.seek(0)

            # Auto-detect delimiter
            delimiter = '\t' if '\t' in sample else ','
            reader = csv.reader(f, delimiter=delimiter)

            header_checked = False
            for row in reader:
                if not row or len(row) == 0:
                    continue

                label = row[0].strip().lower()
                if not label:
                    continue

                # Skip header if present
                if not header_checked and label in ('label', 'term', 'source label', 'source', 'original'):
                    header_checked = True
                    continue
                header_checked = True

                replace_by = row[1].strip() if len(row) > 1 else ''
                replace_by_lower = replace_by.lower()

                if not replace_by or replace_by_lower in ('<ignore>', '<delete>', '<remove>', 'null', 'none', '-'):
                    self.ignored_terms.add(label)
                else:
                    self.replacements[label] = replace_by

    def apply_to_term(self, term: str) -> Optional[str]:
        """
        Applies thesaurus rule to a single term string.
        Returns None if term is to be ignored/filtered out.
        Returns replacement term or original term title-cased / cleaned.
        """
        if not term:
            return None
        cleaned = term.strip()
        term_lower = cleaned.lower()

        if term_lower in self.ignored_terms:
            return None

        if term_lower in self.replacements:
            return self.replacements[term_lower]

        return cleaned

    def apply_to_list(self, terms: List[str]) -> List[str]:
        """
        Applies thesaurus rules to a list of terms, filtering ignored ones and deduplicating.
        """
        res = []
        seen = set()
        for t in terms:
            mapped = self.apply_to_term(t)
            if mapped:
                mapped_lower = mapped.lower()
                if mapped_lower not in seen:
                    seen.add(mapped_lower)
                    res.append(mapped)
        return res
