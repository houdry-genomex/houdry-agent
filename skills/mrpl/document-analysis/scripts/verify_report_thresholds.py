#!/usr/bin/env python3
"""Deterministic threshold checks for the MRPL document-analysis MVP fixture.

Reads the structured twin of the synthetic technical report and prints a
FACT / CALCULATION / INTERPRETATION / ASSUMPTION breakdown.

This script does NOT invent MRPL policy. It only applies rules present in the
JSON twin of the fixture document.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def percent_deviation(measured: float, nominal: float) -> float:
    if nominal == 0:
        raise ValueError("nominal must be non-zero for percent deviation")
    return (measured - nominal) / nominal * 100.0


def evaluate_tag(
    measured: float,
    nominal: float | None,
    rule: dict[str, Any],
) -> dict[str, Any]:
    kind = rule["kind"]
    calc: dict[str, Any] = {}
    requires_attention = False
    interpretation = ""

    if kind == "gt":
        limit = float(rule["limit"])
        requires_attention = measured > limit
        interpretation = (
            f"measured {measured} > limit {limit}"
            if requires_attention
            else f"measured {measured} <= limit {limit}"
        )
    elif kind == "range_inclusive":
        lo = float(rule["min"])
        hi = float(rule["max"])
        requires_attention = not (lo <= measured <= hi)
        interpretation = (
            f"measured {measured} outside [{lo}, {hi}]"
            if requires_attention
            else f"measured {measured} within [{lo}, {hi}]"
        )
    elif kind == "abs_percent_deviation_gt":
        if nominal is None:
            raise ValueError("nominal required for abs_percent_deviation_gt")
        pct = percent_deviation(measured, float(nominal))
        calc["percent_deviation"] = pct
        calc["abs_percent_deviation"] = abs(pct)
        limit = float(rule["limit_percent"])
        requires_attention = abs(pct) > limit
        interpretation = (
            f"|percent_deviation|={abs(pct):.4f} > {limit}"
            if requires_attention
            else f"|percent_deviation|={abs(pct):.4f} <= {limit}"
        )
    else:
        raise ValueError(f"unknown threshold kind: {kind}")

    return {
        "requires_attention": requires_attention,
        "calculation": calc,
        "interpretation": interpretation,
    }


def run_checks(payload: dict[str, Any]) -> dict[str, Any]:
    thresholds = payload["thresholds"]
    rows = []
    attention = []
    ok = []
    for item in payload["measurements"]:
        tag = item["tag"]
        rule = thresholds[tag]
        result = evaluate_tag(
            float(item["measured"]),
            item.get("nominal"),
            rule,
        )
        row = {
            "tag": tag,
            "fact": {
                "description": item.get("description"),
                "measured": item["measured"],
                "unit": item.get("unit"),
                "nominal": item.get("nominal"),
            },
            "calculation": result["calculation"],
            "interpretation": {
                "requires_attention": result["requires_attention"],
                "reason": result["interpretation"],
                "rule": rule,
            },
            "assumption": (
                "Attention rules are taken only from this fixture JSON "
                "(document-local). No external MRPL policy was applied."
            ),
        }
        rows.append(row)
        (attention if result["requires_attention"] else ok).append(tag)
    return {
        "document_id": payload.get("document_id"),
        "fixture_notice": payload.get("fixture_notice"),
        "governance_ceiling": "DRAFT",
        "rows": rows,
        "attention_tags": attention,
        "ok_tags": ok,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "json_path",
        nargs="?",
        default=None,
        help="Path to sample_measurements.json",
    )
    parser.add_argument(
        "--expect-attention",
        nargs="*",
        default=None,
        help="If set, exit 1 when attention tags differ from this list",
    )
    args = parser.parse_args(argv)

    if args.json_path:
        path = Path(args.json_path)
    else:
        # Default: repo fixture relative to this file when run from a checkout.
        path = (
            Path(__file__).resolve().parents[4]
            / "tests"
            / "fixtures"
            / "mrpl"
            / "sample_measurements.json"
        )
        if not path.is_file():
            path = Path("tests/fixtures/mrpl/sample_measurements.json")

    payload = json.loads(path.read_text(encoding="utf-8"))
    report = run_checks(payload)
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")

    if args.expect_attention is not None:
        got = set(report["attention_tags"])
        want = set(args.expect_attention)
        if got != want:
            print(
                f"attention mismatch: got={sorted(got)} want={sorted(want)}",
                file=sys.stderr,
            )
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
