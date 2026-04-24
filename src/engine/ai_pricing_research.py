"""
AI pricing research helpers for AI Ops.

This service fetches official pricing pages and normalizes a small, UI-friendly
pricing suggestion payload for the AI Ops frontend.
"""

from __future__ import annotations

import re
from collections import OrderedDict
from html import unescape
from typing import Callable, Dict, List, Optional, Tuple
from urllib import error as urllib_error
from urllib import request as urllib_request


SUPPORTED_PROVIDERS = ("openai", "anthropic", "google")

ANTHROPIC_PRICING_URL = "https://docs.anthropic.com/en/docs/about-claude/pricing"
GOOGLE_PRICING_URL = "https://ai.google.dev/gemini-api/docs/pricing"
OPENAI_BATCH_GUIDE_URL = "https://developers.openai.com/api/docs/guides/batch"

OPENAI_MODEL_PAGES = {
    "gpt-4.1-nano": "https://developers.openai.com/api/docs/models/gpt-4.1-nano",
    "gpt-5": "https://developers.openai.com/api/docs/models/gpt-5",
    "gpt-5-mini": "https://developers.openai.com/api/docs/models/gpt-5-mini",
    "gpt-5-nano": "https://developers.openai.com/api/docs/models/gpt-5-nano",
    "gpt-5-pro": "https://developers.openai.com/api/docs/models/gpt-5-pro",
    "gpt-5.4": "https://developers.openai.com/api/docs/models/gpt-5.4/",
    "gpt-5.4-mini": "https://developers.openai.com/api/docs/models/gpt-5.4-mini/",
    "gpt-5.4-nano": "https://developers.openai.com/api/docs/models/gpt-5.4-nano/",
    "gpt-5.4-pro": "https://developers.openai.com/api/docs/models/gpt-5.4-pro/",
    "o4-mini": "https://developers.openai.com/api/docs/models/o4-mini/",
}

OPENAI_CANONICAL_KEYS = tuple(
    sorted(OPENAI_MODEL_PAGES.keys(), key=len, reverse=True)
)


def _normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _strip_html(value: str) -> str:
    if not value:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    text = re.sub(r"</(div|p|li|tr|section|h\d)>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = unescape(text)
    text = text.replace("\xa0", " ")
    lines = [_normalize_space(part) for part in text.splitlines()]
    return "\n".join(part for part in lines if part)


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9.+-]+", "-", (value or "").lower())
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    return normalized


def _strip_model_snapshot(value: str) -> str:
    cleaned = _slugify(value)
    cleaned = re.sub(r"-20\d{2}-\d{2}-\d{2}$", "", cleaned)
    cleaned = re.sub(r"-\d{8}$", "", cleaned)
    cleaned = re.sub(r"-\d{4}-\d{2}-\d{2}$", "", cleaned)
    return cleaned


def _first_money_value(text: str) -> Optional[float]:
    match = re.search(r"\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)", text or "")
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def _row_cells(row_html: str) -> List[str]:
    return [
        _strip_html(cell)
        for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_html, flags=re.IGNORECASE | re.DOTALL)
    ]


def _table_rows(table_html: str) -> List[List[str]]:
    rows: List[List[str]] = []
    for row_html in re.findall(r"<tr[^>]*>(.*?)</tr>", table_html, flags=re.IGNORECASE | re.DOTALL):
        cells = _row_cells(row_html)
        if cells:
            rows.append(cells)
    return rows


def _dedupe_sources(items: List[Dict[str, str]]) -> List[Dict[str, str]]:
    unique: "OrderedDict[Tuple[str, str], Dict[str, str]]" = OrderedDict()
    for item in items:
        key = (item.get("label", ""), item.get("url", ""))
        if key not in unique:
            unique[key] = item
    return list(unique.values())


class AiPricingResearchService:
    def __init__(self, fetcher: Optional[Callable[[str], str]] = None):
        self._fetcher = fetcher or self._fetch_html

    def _fetch_html(self, url: str) -> str:
        req = urllib_request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                )
            },
        )
        try:
            with urllib_request.urlopen(req, timeout=30) as response:
                return response.read().decode("utf-8", errors="ignore")
        except urllib_error.HTTPError as exc:
            raise RuntimeError(f"Pricing source HTTP {exc.code}: {url}") from exc
        except urllib_error.URLError as exc:
            raise RuntimeError(f"Pricing source connection error: {url} ({exc.reason})") from exc

    def research(
        self,
        *,
        provider: str,
        model: str,
        mode: Optional[str] = None,
    ) -> Dict[str, List[Dict[str, object]]]:
        normalized_provider = (provider or "").strip().lower()
        requested_model = (model or "").strip()
        requested_mode = (mode or "").strip()

        if normalized_provider not in SUPPORTED_PROVIDERS:
            raise ValueError(
                "Pricing research currently supports OpenAI, Anthropic, and Google providers only."
            )
        if not requested_model:
            raise ValueError("Pricing research requires a non-empty model.")

        if normalized_provider == "anthropic":
            payload = self._research_anthropic(requested_model, requested_mode)
        elif normalized_provider == "google":
            payload = self._research_google(requested_model, requested_mode)
        else:
            payload = self._research_openai(requested_model, requested_mode)

        payload["sources"] = _dedupe_sources(payload["sources"])
        return payload

    def _anthropic_aliases(self, label: str) -> List[str]:
        token = _strip_model_snapshot(label)
        aliases = {
            token,
            token.replace(".", "-"),
        }
        if token.startswith("claude-"):
            aliases.add(token[len("claude-") :])
        return sorted(alias for alias in aliases if alias)

    def _match_model_alias(
        self,
        requested_model: str,
        options: Dict[str, Dict[str, object]],
        alias_builder: Callable[[str], List[str]],
    ) -> Tuple[str, Dict[str, object]]:
        normalized = _strip_model_snapshot(requested_model)
        if not normalized:
            raise ValueError("Pricing research requires a non-empty model.")

        if normalized in options:
            return normalized, options[normalized]

        for key, entry in options.items():
            aliases = alias_builder(str(entry.get("source_model") or key))
            for alias in aliases:
                if normalized == alias or normalized.startswith(f"{alias}-"):
                    return key, entry
        raise ValueError("No official pricing match found for the requested model.")

    def _research_anthropic(
        self,
        requested_model: str,
        requested_mode: str,
    ) -> Dict[str, List[Dict[str, object]]]:
        entries = self._parse_anthropic_pricing(self._fetcher(ANTHROPIC_PRICING_URL))
        key, matched = self._match_model_alias(
            requested_model,
            entries,
            self._anthropic_aliases,
        )

        suggestions = []
        for item in matched["modes"].values():
            if requested_mode and item["mode"] != requested_mode:
                continue
            suggestions.append(
                {
                    **item,
                    "provider": "anthropic",
                    "model": requested_model,
                    "matched_model": key,
                    "source_model": matched["source_model"],
                    "source_label": "Anthropic pricing table",
                    "source_url": ANTHROPIC_PRICING_URL,
                    "source_note": "",
                    "source_note_code": "",
                }
            )

        if requested_mode and not suggestions:
            raise ValueError("No official pricing match found for the requested provider/mode.")

        return {
            "suggestions": suggestions,
            "warnings": [],
            "sources": [
                {"label": "Anthropic pricing table", "url": ANTHROPIC_PRICING_URL},
            ],
        }

    def _parse_anthropic_pricing(self, html: str) -> Dict[str, Dict[str, object]]:
        tables = re.findall(r"<table[^>]*>(.*?)</table>", html, flags=re.IGNORECASE | re.DOTALL)
        standard_rows: Dict[str, Dict[str, object]] = {}
        batch_rows: Dict[str, Dict[str, object]] = {}

        for table_html in tables:
            rows = _table_rows(table_html)
            if not rows:
                continue
            header = rows[0]
            if header[:3] == ["Model", "Base Input Tokens", "5m Cache Writes"]:
                for cells in rows[1:]:
                    if len(cells) < 6:
                        continue
                    label = cells[0]
                    standard_rows[_slugify(label)] = {
                        "source_model": label,
                        "mode": "realtime",
                        "input_cost_per_million": _first_money_value(cells[1]) or 0.0,
                        "output_cost_per_million": _first_money_value(cells[5]) or 0.0,
                        "cached_input_cost_per_million": _first_money_value(cells[4]) or 0.0,
                        "currency": "USD",
                        "is_active": True,
                    }
            elif header[:3] == ["Model", "Batch input", "Batch output"]:
                for cells in rows[1:]:
                    if len(cells) < 3:
                        continue
                    label = cells[0]
                    batch_rows[_slugify(label)] = {
                        "source_model": label,
                        "mode": "openai_batch",
                        "input_cost_per_million": _first_money_value(cells[1]) or 0.0,
                        "output_cost_per_million": _first_money_value(cells[2]) or 0.0,
                        "cached_input_cost_per_million": 0.0,
                        "currency": "USD",
                        "is_active": True,
                    }

        merged: Dict[str, Dict[str, object]] = {}
        for key, item in standard_rows.items():
            merged.setdefault(key, {"source_model": item["source_model"], "modes": {}})
            merged[key]["modes"]["realtime"] = item
        for key, item in batch_rows.items():
            merged.setdefault(key, {"source_model": item["source_model"], "modes": {}})
            merged[key]["modes"]["openai_batch"] = item
        return merged

    def _research_google(
        self,
        requested_model: str,
        requested_mode: str,
    ) -> Dict[str, List[Dict[str, object]]]:
        entries = self._parse_google_pricing(self._fetcher(GOOGLE_PRICING_URL))
        key, matched = self._match_model_alias(
            requested_model,
            entries,
            lambda label: [_strip_model_snapshot(label)],
        )

        suggestions = []
        warnings = list(matched.get("warnings") or [])
        for item in matched["modes"].values():
            if requested_mode and item["mode"] != requested_mode:
                continue
            suggestions.append(
                {
                    **item,
                    "provider": "google",
                    "model": requested_model,
                    "matched_model": key,
                    "source_model": matched["source_model"],
                    "source_label": "Gemini API pricing",
                    "source_url": GOOGLE_PRICING_URL,
                    "source_note": item.get("source_note") or "",
                    "source_note_code": item.get("source_note_code") or "",
                }
            )

        if requested_mode and not suggestions:
            raise ValueError("No official pricing match found for the requested provider/mode.")

        return {
            "suggestions": suggestions,
            "warnings": warnings,
            "sources": [
                {"label": "Gemini API pricing", "url": GOOGLE_PRICING_URL},
            ],
        }

    def _parse_google_pricing(self, html: str) -> Dict[str, Dict[str, object]]:
        entries: Dict[str, Dict[str, object]] = {}
        for match in re.finditer(
            r'<h2 id="(?P<id>gemini-[^"]+)"[^>]*>(?P<label>.*?)</h2>(?P<section>.*?)(?=<h2 id="|$)',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        ):
            model_id = _strip_model_snapshot(match.group("id"))
            section_html = match.group("section")
            modes: Dict[str, Dict[str, object]] = {}
            warnings: List[str] = []

            for block in re.finditer(
                r'<section><h3[^>]*data-text="(?P<title>Standard|Batch)"[^>]*>.*?</h3><table class="pricing-table">(?P<table>.*?)</table></section>',
                section_html,
                flags=re.IGNORECASE | re.DOTALL,
            ):
                title = block.group("title").lower()
                table_rows = _table_rows(block.group("table"))
                mode_key = "realtime" if title == "standard" else "openai_batch"
                input_price = 0.0
                output_price = 0.0
                cached_price = 0.0
                note_code = ""

                for cells in table_rows:
                    if len(cells) < 3:
                        continue
                    label = cells[0].lower()
                    paid_tier = cells[-1]
                    money_values = re.findall(
                        r"\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)",
                        paid_tier,
                    )
                    if not money_values:
                        continue
                    value = float(money_values[0].replace(",", ""))
                    if len(money_values) > 1:
                        note_code = "tiered_prompt_rate_first_tier"
                    if "input price" in label:
                        input_price = value
                    elif "output price" in label:
                        output_price = value
                    elif "context caching price" in label:
                        cached_price = value
                        if "Batch pricing not yet implemented" in paid_tier:
                            note_code = "batch_same_as_standard"

                if input_price or output_price or cached_price:
                    modes[mode_key] = {
                        "mode": mode_key,
                        "input_cost_per_million": input_price,
                        "output_cost_per_million": output_price,
                        "cached_input_cost_per_million": cached_price,
                        "currency": "USD",
                        "is_active": True,
                        "source_note": "",
                        "source_note_code": note_code,
                    }

            if modes:
                entries[model_id] = {
                    "source_model": model_id,
                    "modes": modes,
                    "warnings": warnings,
                }

        return entries

    def _match_openai_model(self, requested_model: str) -> str:
        normalized = _strip_model_snapshot(requested_model)
        if normalized in OPENAI_MODEL_PAGES:
            return normalized
        for key in OPENAI_CANONICAL_KEYS:
            if normalized == key or normalized.startswith(f"{key}-"):
                return key
        raise ValueError("No official pricing match found for the requested model.")

    def _research_openai(
        self,
        requested_model: str,
        requested_mode: str,
    ) -> Dict[str, List[Dict[str, object]]]:
        canonical_model = self._match_openai_model(requested_model)
        pricing = self._parse_openai_model_pricing(
            self._fetcher(OPENAI_MODEL_PAGES[canonical_model])
        )

        sources = [
            {
                "label": "OpenAI model page",
                "url": OPENAI_MODEL_PAGES[canonical_model],
            }
        ]
        suggestions = []

        realtime = {
            "provider": "openai",
            "mode": "realtime",
            "model": requested_model,
            "matched_model": canonical_model,
            "source_model": canonical_model,
            "input_cost_per_million": pricing["input_cost_per_million"],
            "output_cost_per_million": pricing["output_cost_per_million"],
            "cached_input_cost_per_million": pricing["cached_input_cost_per_million"],
            "currency": "USD",
            "is_active": True,
            "source_label": "OpenAI model page",
            "source_url": OPENAI_MODEL_PAGES[canonical_model],
            "source_note": "",
            "source_note_code": "",
        }
        if not requested_mode or requested_mode == "realtime":
            suggestions.append(realtime)

        if not requested_mode or requested_mode == "openai_batch":
            sources.append(
                {
                    "label": "OpenAI Batch API guide",
                    "url": OPENAI_BATCH_GUIDE_URL,
                }
            )
            suggestions.append(
                {
                    **realtime,
                    "mode": "openai_batch",
                    "input_cost_per_million": round(
                        realtime["input_cost_per_million"] * 0.5, 8
                    ),
                    "output_cost_per_million": round(
                        realtime["output_cost_per_million"] * 0.5, 8
                    ),
                    "cached_input_cost_per_million": round(
                        realtime["cached_input_cost_per_million"] * 0.5, 8
                    ),
                    "source_note": "Derived from the official Batch API 50% discount guidance.",
                    "source_note_code": "openai_batch_discount",
                }
            )

        if requested_mode and not suggestions:
            raise ValueError("No official pricing match found for the requested provider/mode.")

        return {
            "suggestions": suggestions,
            "warnings": [],
            "sources": sources,
        }

    def _parse_openai_model_pricing(self, html: str) -> Dict[str, float]:
        anchor = html.find("Text tokens")
        segment = html[anchor : anchor + 5000] if anchor >= 0 else html
        match = re.search(
            r"<div>Input</div><div class=\"text-2xl font-semibold\">\$(?P<input>[0-9.]+)</div>"
            r".*?<div>Cached input</div><div class=\"text-2xl font-semibold\">\$(?P<cached>[0-9.]+)</div>"
            r".*?<div>Output</div><div class=\"text-2xl font-semibold\">\$(?P<output>[0-9.]+)</div>",
            segment,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not match:
            raise RuntimeError("Unable to parse OpenAI pricing card from the official model page.")
        return {
            "input_cost_per_million": float(match.group("input")),
            "cached_input_cost_per_million": float(match.group("cached")),
            "output_cost_per_million": float(match.group("output")),
        }


ai_pricing_research = AiPricingResearchService()
