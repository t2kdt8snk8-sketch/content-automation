#!/usr/bin/env python3
"""Validate pixel-office layout integrity.

Checks:
- Catalog width/height consistency with footprint * TILE_SIZE
- Layout furniture type references (supports :left virtual entries)
- Furniture footprint bounds and tile overlaps
- Wall-mounted placement heuristic
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

TILE_SIZE = 16


@dataclass
class Finding:
    level: str
    message: str


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def resolve_catalog_entry(type_id: str, catalog_map: Dict[str, dict]) -> dict | None:
    if type_id in catalog_map:
        return catalog_map[type_id]
    if type_id.endswith(":left"):
        return catalog_map.get(type_id[:-5])
    return None


def validate_catalog(catalog: List[dict]) -> List[Finding]:
    findings: List[Finding] = []
    for e in catalog:
        expected_w = int(e["footprintW"]) * TILE_SIZE
        expected_h = int(e["footprintH"]) * TILE_SIZE
        if int(e["width"]) != expected_w:
            findings.append(Finding("error", f"{e['id']}: width {e['width']} != {expected_w}"))
        if int(e["height"]) != expected_h:
            findings.append(Finding("error", f"{e['id']}: height {e['height']} != {expected_h}"))
    return findings


def validate_layout(layout: dict, catalog_map: Dict[str, dict], strict_wall: bool) -> List[Finding]:
    findings: List[Finding] = []
    cols = int(layout["cols"])
    rows = int(layout["rows"])
    tiles = layout["tiles"]
    furniture = layout.get("furniture", [])

    occupied: Dict[Tuple[int, int], str] = {}

    for item in furniture:
        type_id = item["type"]
        entry = resolve_catalog_entry(type_id, catalog_map)
        if not entry:
            findings.append(Finding("error", f"unknown furniture type: {type_id}"))
            continue

        x = int(item["col"])
        y = int(item["row"])
        w = int(entry["footprintW"])
        h = int(entry["footprintH"])

        if x < 0 or y < 0 or x + w > cols or y + h > rows:
            findings.append(
                Finding("error", f"out-of-bounds: {type_id} at ({x},{y}) size {w}x{h} in {cols}x{rows}")
            )
            continue

        for yy in range(y, y + h):
            for xx in range(x, x + w):
                key = (xx, yy)
                if key in occupied:
                    findings.append(
                        Finding(
                            "error",
                            f"overlap tile {key}: {occupied[key]} vs {type_id}",
                        )
                    )
                else:
                    occupied[key] = type_id

        if entry.get("canPlaceOnWalls"):
            near_top_band = y <= 10
            has_wall_above = False
            for xx in range(x, x + w):
                above_y = y - 1
                if above_y >= 0 and tiles[above_y * cols + xx] == 0:
                    has_wall_above = True
                    break

            if strict_wall and not (near_top_band or has_wall_above):
                findings.append(
                    Finding(
                        "error",
                        f"wall item not aligned to wall band: {type_id} at ({x},{y})",
                    )
                )
            elif not (near_top_band or has_wall_above):
                findings.append(
                    Finding(
                        "warn",
                        f"wall item may be visually misaligned: {type_id} at ({x},{y})",
                    )
                )

    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--catalog",
        default="web/frontend/public/assets/furniture-catalog.json",
        help="Path to furniture catalog JSON",
    )
    parser.add_argument(
        "--layout",
        default="web/frontend/public/assets/default-layout-1.json",
        help="Path to layout JSON",
    )
    parser.add_argument("--strict-wall", action="store_true", help="Fail when wall items are not wall-aligned")
    args = parser.parse_args()

    catalog = load_json(Path(args.catalog))
    layout = load_json(Path(args.layout))
    catalog_map = {e["id"]: e for e in catalog}

    findings = []
    findings.extend(validate_catalog(catalog))
    findings.extend(validate_layout(layout, catalog_map, strict_wall=args.strict_wall))

    errors = [f for f in findings if f.level == "error"]
    warns = [f for f in findings if f.level == "warn"]

    for f in errors:
        print(f"[ERROR] {f.message}")
    for f in warns:
        print(f"[WARN]  {f.message}")

    print(f"summary: {len(errors)} error(s), {len(warns)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
