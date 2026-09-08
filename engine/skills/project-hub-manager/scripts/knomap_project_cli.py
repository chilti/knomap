#!/usr/bin/env python3
"""
CLI Helper: KnoMap Project Hub Manager
Manages persistence in SQLite (knomap_hub.db), project inspection,
portable .knomap file export/import, and tag/date filtering.
"""

import sys
import os
import json
import uuid
import sqlite3
import argparse
from typing import Dict, Any, Optional, List

# Ensure knomap engine is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
KNOMAP_ENGINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", ".."))
if not os.path.exists(os.path.join(KNOMAP_ENGINE_DIR, "storage.py")):
    KNOMAP_ENGINE_DIR = "/home/labsom/knomap/engine"

if KNOMAP_ENGINE_DIR not in sys.path and os.path.exists(KNOMAP_ENGINE_DIR):
    sys.path.insert(0, KNOMAP_ENGINE_DIR)

try:
    from storage import (
        DEFAULT_DB_PATH,
        get_db_connection,
        init_db,
        save_project_to_db,
        get_project_from_db,
        list_projects_from_db,
        export_knomap_file,
        import_knomap_file
    )
except ImportError:
    DEFAULT_DB_PATH = os.path.join(KNOMAP_ENGINE_DIR, "knomap_hub.db")


def cmd_list(args):
    """Lists projects with optional tag and date filtering."""
    db_path = args.db_path or DEFAULT_DB_PATH
    limit = args.limit or 50
    since_date = args.since
    tag_filter = args.tag.lower() if args.tag else None

    if not os.path.exists(db_path):
        sys.stderr.write(f"Warning: Database {db_path} does not exist yet. Initializing...\n")
        init_db(db_path)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = "SELECT id, name, created_at, updated_at, source_file, source_format, is_public, metadata_json FROM projects WHERE 1=1"
    params = []

    if since_date:
        query += " AND (created_at >= ? OR updated_at >= ?)"
        params.extend([since_date, since_date])

    query += " ORDER BY updated_at DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        meta_str = r["metadata_json"] or "{}"
        try:
            meta = json.loads(meta_str)
        except Exception:
            meta = {}

        # If tag filter is specified, check tags in metadata or name
        if tag_filter:
            tags = [t.lower() for t in meta.get("tags", [])]
            if tag_filter not in tags and tag_filter not in r["name"].lower():
                continue

        results.append({
            "id": r["id"],
            "name": r["name"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "source_file": r["source_file"],
            "source_format": r["source_format"],
            "is_public": bool(r["is_public"]),
            "tags": meta.get("tags", []),
            "description": meta.get("description", "")
        })

    output_data = {
        "db_path": db_path,
        "total_returned": len(results),
        "projects": results
    }

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"Listed {len(results)} projects to {args.output}")
    else:
        print(json.dumps(output_data, indent=2, ensure_ascii=False))
    sys.exit(0)


def cmd_inspect(args):
    """Dumps full project manifest, metadata, and state summary."""
    db_path = args.db_path or DEFAULT_DB_PATH
    project_id = args.project_id

    project = get_project_from_db(project_id, db_path)
    if not project:
        sys.stderr.write(f"Error: Project with ID '{project_id}' not found in {db_path}\n")
        sys.exit(1)

    som_state = project.get("som_state", {})
    summary = {
        "id": project["id"],
        "name": project["name"],
        "created_at": project["created_at"],
        "updated_at": project["updated_at"],
        "source_file": project["source_file"],
        "source_format": project["source_format"],
        "metadata": project.get("metadata", {}),
        "som_trained": bool(som_state.get("codebook") or som_state.get("weights")),
        "som_dimensions": {
            "rows": som_state.get("rows"),
            "cols": som_state.get("cols"),
            "epochs": som_state.get("epochs")
        },
        "clusters_count": len(project.get("clusters", {}).get("clusters", [])),
        "has_report": bool(project.get("report_markdown"))
    }

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        print(f"Project '{project_id}' inspected. Output: {args.output}")
    else:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    sys.exit(0)


def cmd_export(args):
    """Exports a project record from SQLite to a portable .knomap file."""
    db_path = args.db_path or DEFAULT_DB_PATH
    project_id = args.project_id
    output_path = args.output

    project = get_project_from_db(project_id, db_path)
    if not project:
        sys.stderr.write(f"Error: Project with ID '{project_id}' not found in {db_path}\n")
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(project, f, indent=2, ensure_ascii=False)

    print(f"Project '{project_id}' successfully exported to {output_path}")
    sys.exit(0)


def cmd_import(args):
    """Imports a .knomap file into SQLite, generating a new UUID if collision occurs."""
    db_path = args.db_path or DEFAULT_DB_PATH
    input_file = args.input

    if not os.path.exists(input_file):
        sys.stderr.write(f"Error: .knomap file does not exist: {input_file}\n")
        sys.exit(1)

    with open(input_file, "r", encoding="utf-8") as f:
        project_data = json.load(f)

    orig_id = project_data.get("id")
    # Check if UUID already exists in SQLite
    existing = get_project_from_db(orig_id, db_path) if orig_id else None
    if existing:
        new_id = f"knomap-{uuid.uuid4().hex[:8]}"
        sys.stderr.write(f"Note: Collision detected for ID '{orig_id}'. Auto-generating new UUID: '{new_id}'.\n")
        project_data["id"] = new_id
        project_data["name"] = f"{project_data.get('name', 'Project')} (Imported)"

    final_id = save_project_to_db(project_data, db_path)
    result = {
        "status": "imported",
        "project_id": final_id,
        "name": project_data.get("name"),
        "db_path": db_path
    }

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"Project imported with ID '{final_id}' to {db_path}. Output: {args.output}")
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(0)


def cmd_backup(args):
    """Performs an online backup of the SQLite hub database."""
    db_path = args.db_path or DEFAULT_DB_PATH
    output_backup = args.output

    if not os.path.exists(db_path):
        sys.stderr.write(f"Error: Database file does not exist: {db_path}\n")
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(output_backup)), exist_ok=True)
    source_conn = sqlite3.connect(db_path)
    backup_conn = sqlite3.connect(output_backup)

    with backup_conn:
        source_conn.backup(backup_conn)

    backup_conn.close()
    source_conn.close()

    print(f"Database backup completed: {output_backup}")
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="CLI for KnoMap Project Hub Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: list
    p_list = subparsers.add_parser("list", help="List projects in SQLite repository")
    p_list.add_argument("--db-path", default=None, help="Path to knomap_hub.db (default: engine/knomap_hub.db)")
    p_list.add_argument("--limit", type=int, default=50, help="Maximum projects to list")
    p_list.add_argument("--since", help="Filter projects modified/created since ISO date (e.g. 2025-01-01)")
    p_list.add_argument("--tag", help="Filter projects by tag")
    p_list.add_argument("--output", help="Path to output JSON")
    p_list.set_defaults(func=cmd_list)

    # Subcommand: inspect
    p_ins = subparsers.add_parser("inspect", help="Inspect project manifest and training status")
    p_ins.add_argument("--project-id", required=True, help="UUID of project to inspect")
    p_ins.add_argument("--db-path", default=None, help="Path to knomap_hub.db")
    p_ins.add_argument("--output", help="Path to output inspection JSON")
    p_ins.set_defaults(func=cmd_inspect)

    # Subcommand: export
    p_exp = subparsers.add_parser("export", help="Export project to portable .knomap file")
    p_exp.add_argument("--project-id", required=True, help="UUID of project to export")
    p_exp.add_argument("--output", required=True, help="Path to destination .knomap file")
    p_exp.add_argument("--db-path", default=None, help="Path to knomap_hub.db")
    p_exp.set_defaults(func=cmd_export)

    # Subcommand: import
    p_imp = subparsers.add_parser("import", help="Import portable .knomap file into SQLite")
    p_imp.add_argument("--input", required=True, help="Path to .knomap file to import")
    p_imp.add_argument("--db-path", default=None, help="Path to knomap_hub.db")
    p_imp.add_argument("--output", help="Path to output JSON result")
    p_imp.set_defaults(func=cmd_import)

    # Subcommand: backup
    p_bac = subparsers.add_parser("backup", help="Perform online backup of SQLite database")
    p_bac.add_argument("--db-path", default=None, help="Path to source knomap_hub.db")
    p_bac.add_argument("--output", required=True, help="Path to destination backup .db")
    p_bac.set_defaults(func=cmd_backup)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
