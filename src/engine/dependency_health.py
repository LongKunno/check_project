"""
Dependency Health Guard

Audit-time dependency issue and lifecycle checks for:
- Python runtime requirements
- Node direct runtime dependencies from lockfiles
- Docker base images
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

logger = logging.getLogger(__name__)

IGNORED_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "dist",
    "build",
    "site",
}

MUTABLE_DOCKER_TAGS = {
    "",
    "latest",
    "stable",
    "main",
    "master",
    "edge",
    "rolling",
}

RUNTIME_REQUIREMENTS_EXCLUDE_TOKENS = {
    "bench",
    "benchmark",
    "ci",
    "dev",
    "doc",
    "docs",
    "example",
    "examples",
    "lint",
    "local",
    "qa",
    "test",
    "tests",
}

WARNING_ISSUE_TYPES = {
    "critical_advisory",
    "high_advisory",
    "deprecated",
    "near_eol",
    "eol",
    "mutable_base_image",
    "dynamic_base_image",
}

PYTHON_REQUIREMENT_PATTERN = re.compile(
    r"^(?P<name>[A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*(?P<spec>.*)$"
)
DOCKER_FROM_PATTERN = re.compile(
    r"^\s*FROM\s+(?:--platform=\S+\s+)?(?P<image>\S+)",
    re.IGNORECASE,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _canonical_python_name(name: str) -> str:
    return re.sub(r"[-_.]+", "-", str(name or "").strip()).lower()


def _canonical_node_name(name: str) -> str:
    return str(name or "").strip().lower()


def _is_python_exact_pin(spec: str) -> Tuple[bool, Optional[str]]:
    cleaned = (spec or "").strip()
    if not cleaned:
        return False, None
    if cleaned.startswith("==="):
        version = cleaned[3:].strip()
        if version and "*" not in version and "," not in version:
            return True, version
    if cleaned.startswith("=="):
        version = cleaned[2:].strip()
        if version and "*" not in version and "," not in version:
            return True, version
    return False, None


def _is_exact_semver_spec(spec: str) -> bool:
    cleaned = str(spec or "").strip()
    if not cleaned:
        return False
    if cleaned.startswith(("workspace:", "file:", "link:", "git+", "http://", "https://")):
        return False
    return bool(re.fullmatch(r"[vV]?\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?", cleaned))


def _summary_keys() -> Dict[str, object]:
    return {
        "manifests_scanned": [],
        "dependencies_total": 0,
        "major_lag_count": 0,
        "minor_patch_lag_count": 0,
        "critical_advisories": 0,
        "high_advisories": 0,
        "deprecated_count": 0,
        "near_eol_count": 0,
        "eol_count": 0,
        "unknown_eol_count": 0,
        "release_age_warning_count": 0,
        "mutable_base_image_count": 0,
        "hygiene_warning_count": 0,
        "triggered_signals": [],
    }


def _base_payload(enabled: bool = True, note: str = "") -> Dict[str, object]:
    return {
        "enabled": enabled,
        "status": "unavailable",
        "summary": _summary_keys(),
        "manifests": [],
        "items": [],
        "lookup_stats": {
            "attempted": 0,
            "successful": 0,
            "failed": 0,
        },
        "generated_at": _utc_now().isoformat(),
        "note": note,
    }


class DependencyHealthService:
    def __init__(
        self,
        *,
        eol_warning_days: Optional[int] = None,
        release_age_warning_days: Optional[int] = None,
        major_lag_threshold: Optional[int] = None,
        user_agent: Optional[str] = None,
    ):
        threshold = (
            eol_warning_days
            if eol_warning_days is not None
            else release_age_warning_days
        )
        self.eol_warning_days = max(int(threshold or 180), 1)
        self.user_agent = user_agent or (
            "CheckProjectDependencyHealth/1.0 "
            "(https://github.com/LongKunno/check_project)"
        )
        self._pypi_cache: Dict[str, Optional[dict]] = {}
        self._npm_cache: Dict[str, Optional[dict]] = {}
        self._osv_cache: Dict[Tuple[str, str, str], dict] = {}

    def assess(self, target_dir: str) -> Dict[str, object]:
        payload = _base_payload(enabled=True)
        root = Path(target_dir).resolve()
        manifests = self._discover_manifests(root)
        if not manifests:
            payload["note"] = "Không tìm thấy manifest dependency hoặc Dockerfile hỗ trợ."
            return payload

        skipped_package_dirs = {
            manifest["path"].parent.resolve()
            for manifest in manifests
            if manifest["kind"] == "node_lock"
        }

        items: List[Dict[str, object]] = []
        processed_manifests: List[Dict[str, object]] = []

        for manifest in manifests:
            path = manifest["path"]
            kind = manifest["kind"]
            if kind == "node_package" and path.parent.resolve() in skipped_package_dirs:
                continue

            if kind == "python_requirements":
                manifest_items = self._scan_python_requirements(root, path, payload)
            elif kind == "node_lock":
                manifest_items = self._scan_node_lock(root, path, payload)
            elif kind == "node_package":
                manifest_items = self._scan_package_json_hygiene(root, path, payload)
            elif kind == "dockerfile":
                manifest_items = self._scan_dockerfile(root, path)
            else:
                manifest_items = []

            processed_manifests.append(
                {
                    "path": path.relative_to(root).as_posix(),
                    "kind": kind,
                    "dependency_count": len(manifest_items),
                }
            )
            items.extend(manifest_items)

        payload["manifests"] = processed_manifests
        payload["items"] = items
        payload["summary"] = self._build_summary(processed_manifests, items)
        payload["status"] = self._resolve_status(items)
        if payload["status"] == "warning":
            payload["note"] = "Phát hiện dependency issue hoặc lifecycle risk cần xử lý."
        elif payload["status"] == "pass":
            payload["note"] = (
                "Không phát hiện advisory severity cao, deprecation/EOL rõ ràng "
                "hoặc Docker base image biến động."
            )
        else:
            payload["note"] = (
                "Chỉ có tín hiệu hygiene hoặc chưa đủ metadata lifecycle để kết luận."
            )
        return payload

    def _discover_manifests(self, root: Path) -> List[Dict[str, object]]:
        manifests: List[Dict[str, object]] = []
        for current_root, dirnames, filenames in os.walk(root):
            dirnames[:] = [
                dirname for dirname in dirnames if dirname not in IGNORED_DIRS
            ]
            current_path = Path(current_root)
            for filename in filenames:
                lower_name = filename.lower()
                path = current_path / filename
                if lower_name.startswith("requirements") and lower_name.endswith(".txt"):
                    if self._is_runtime_python_manifest(path):
                        manifests.append({"kind": "python_requirements", "path": path})
                elif lower_name == "package-lock.json":
                    manifests.append({"kind": "node_lock", "path": path})
                elif lower_name == "package.json":
                    manifests.append({"kind": "node_package", "path": path})
                elif filename.startswith("Dockerfile"):
                    manifests.append({"kind": "dockerfile", "path": path})
        manifests.sort(key=lambda item: str(item["path"]))
        return manifests

    def _is_runtime_python_manifest(self, path: Path) -> bool:
        tokens = [
            token
            for token in re.split(r"[^a-z0-9]+", path.stem.lower())
            if token and token != "requirements"
        ]
        return not any(token in RUNTIME_REQUIREMENTS_EXCLUDE_TOKENS for token in tokens)

    def _http_json(
        self,
        url: str,
        *,
        method: str = "GET",
        body: Optional[dict] = None,
        timeout: int = 20,
    ) -> dict:
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
        }
        payload = None
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib_request.Request(
            url,
            data=payload,
            headers=headers,
            method=method,
        )
        with urllib_request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8", errors="ignore"))

    def _record_lookup_attempt(self, payload: Dict[str, object]):
        stats = payload["lookup_stats"]
        stats["attempted"] += 1

    def _record_lookup_success(self, payload: Dict[str, object]):
        stats = payload["lookup_stats"]
        stats["successful"] += 1

    def _record_lookup_failure(self, payload: Dict[str, object], source: str, exc: Exception):
        stats = payload["lookup_stats"]
        stats["failed"] += 1
        logger.info("Dependency health lookup failed for %s: %s", source, exc)

    def _fetch_pypi_package(self, package_name: str, payload: Dict[str, object]) -> Optional[dict]:
        key = _canonical_python_name(package_name)
        if key in self._pypi_cache:
            return self._pypi_cache[key]

        self._record_lookup_attempt(payload)
        url = f"https://pypi.org/pypi/{urllib_parse.quote(package_name)}/json"
        try:
            raw = self._http_json(url)
            info = raw.get("info") or {}
            releases = raw.get("releases") or {}
            latest_version = str(info.get("version") or "").strip()
            result = {
                "latest_version": latest_version or None,
                "latest_published_at": self._pick_release_timestamp(
                    releases.get(latest_version) or raw.get("urls") or []
                ),
                "releases": releases,
                "lifecycle": self._resolve_lifecycle(
                    source="pypi",
                    explicit=info.get("lifecycle"),
                    deprecated_message=info.get("deprecated")
                    or info.get("deprecated_message"),
                    eol_date=info.get("eol_date") or info.get("eol"),
                ),
            }
            self._record_lookup_success(payload)
            self._pypi_cache[key] = result
            return result
        except (urllib_error.HTTPError, urllib_error.URLError, ValueError, json.JSONDecodeError) as exc:
            self._record_lookup_failure(payload, f"PyPI:{package_name}", exc)
            self._pypi_cache[key] = None
            return None

    def _fetch_npm_package(self, package_name: str, payload: Dict[str, object]) -> Optional[dict]:
        key = _canonical_node_name(package_name)
        if key in self._npm_cache:
            return self._npm_cache[key]

        self._record_lookup_attempt(payload)
        url = f"https://registry.npmjs.org/{urllib_parse.quote(package_name, safe='@')}"
        try:
            raw = self._http_json(url)
            dist_tags = raw.get("dist-tags") or {}
            latest_version = str(dist_tags.get("latest") or "").strip()
            time_map = raw.get("time") or {}
            result = {
                "latest_version": latest_version or None,
                "time": time_map,
                "versions": raw.get("versions") or {},
                "lifecycle": self._resolve_lifecycle(
                    source="npm",
                    explicit=raw.get("lifecycle"),
                    eol_date=raw.get("eol_date") or raw.get("eol"),
                ),
            }
            self._record_lookup_success(payload)
            self._npm_cache[key] = result
            return result
        except (urllib_error.HTTPError, urllib_error.URLError, ValueError, json.JSONDecodeError) as exc:
            self._record_lookup_failure(payload, f"npm:{package_name}", exc)
            self._npm_cache[key] = None
            return None

    def _fetch_osv_counts(
        self,
        *,
        package_name: str,
        ecosystem: str,
        version: str,
        payload: Dict[str, object],
    ) -> Dict[str, int]:
        cache_key = (ecosystem, package_name, version)
        if cache_key in self._osv_cache:
            return self._osv_cache[cache_key]

        self._record_lookup_attempt(payload)
        try:
            raw = self._http_json(
                "https://api.osv.dev/v1/query",
                method="POST",
                body={
                    "version": version,
                    "package": {
                        "name": package_name,
                        "ecosystem": ecosystem,
                    },
                },
            )
            counts = {"critical": 0, "high": 0}
            for vuln in raw.get("vulns") or []:
                severity = self._extract_osv_severity(vuln)
                if severity == "critical":
                    counts["critical"] += 1
                elif severity == "high":
                    counts["high"] += 1
            self._record_lookup_success(payload)
            self._osv_cache[cache_key] = counts
            return counts
        except (urllib_error.HTTPError, urllib_error.URLError, ValueError, json.JSONDecodeError) as exc:
            self._record_lookup_failure(payload, f"OSV:{ecosystem}:{package_name}", exc)
            counts = {"critical": 0, "high": 0}
            self._osv_cache[cache_key] = counts
            return counts

    def _extract_osv_severity(self, vuln: dict) -> Optional[str]:
        database_specific = vuln.get("database_specific") or {}
        direct = str(database_specific.get("severity") or "").strip().lower()
        if direct in {"critical", "high", "moderate", "low"}:
            if direct in {"critical", "high"}:
                return direct
            return None
        ecosystem_specific = vuln.get("ecosystem_specific") or {}
        direct = str(ecosystem_specific.get("severity") or "").strip().lower()
        if direct in {"critical", "high"}:
            return direct
        return None

    def _pick_release_timestamp(self, files: Iterable[dict]) -> Optional[str]:
        timestamps = []
        for file_item in files or []:
            ts = (
                file_item.get("upload_time_iso_8601")
                or file_item.get("upload_time")
                or file_item.get("last_pushed")
            )
            if ts:
                parsed = _parse_iso_datetime(ts)
                if parsed:
                    timestamps.append(parsed)
        if not timestamps:
            return None
        return min(timestamps).isoformat()

    def _fetch_docker_hub_tag(self, **_kwargs) -> Optional[dict]:
        return None

    def _relative(self, root: Path, path: Path) -> str:
        return path.relative_to(root).as_posix()

    def _empty_lifecycle(self, *, status: str = "unknown", source: Optional[str] = None):
        return {
            "lifecycle_status": status,
            "eol_date": None,
            "eol_source": source,
            "lifecycle_detail": None,
        }

    def _days_until(self, value: str) -> Optional[int]:
        parsed = _parse_iso_datetime(value)
        if parsed is None:
            return None
        delta = parsed - _utc_now()
        return int(delta.total_seconds() // 86400)

    def _resolve_lifecycle_status(
        self,
        *,
        explicit_status: Optional[str] = None,
        eol_date: Optional[str] = None,
        deprecated_message: Optional[str] = None,
    ) -> Tuple[str, Optional[str]]:
        status = str(explicit_status or "").strip().lower()
        normalized_date = None
        parsed_eol = _parse_iso_datetime(eol_date)
        if parsed_eol is not None:
            normalized_date = parsed_eol.isoformat()
            days_until = self._days_until(normalized_date)
            if days_until is not None and days_until <= 0:
                return "eol", normalized_date
            if days_until is not None and days_until <= self.eol_warning_days:
                return "near_eol", normalized_date
            if status not in {"deprecated", "eol", "near_eol"}:
                return "active", normalized_date
        if status in {"active", "deprecated", "near_eol", "eol", "unknown", "not_applicable"}:
            return status, normalized_date
        if deprecated_message:
            return "deprecated", normalized_date
        return "unknown", normalized_date

    def _resolve_lifecycle(
        self,
        *,
        source: str,
        explicit: Any = None,
        deprecated_message: Optional[str] = None,
        eol_date: Optional[str] = None,
    ) -> Dict[str, Optional[str]]:
        explicit_status = None
        detail = None
        lifecycle_source = source
        candidate_eol = eol_date

        if isinstance(explicit, dict):
            explicit_status = explicit.get("status")
            detail = explicit.get("detail") or explicit.get("message")
            lifecycle_source = explicit.get("source") or source
            candidate_eol = (
                explicit.get("eol_date")
                or explicit.get("eol")
                or explicit.get("date")
                or candidate_eol
            )
        elif isinstance(explicit, str):
            explicit_status = explicit

        if deprecated_message and not detail:
            detail = str(deprecated_message)

        lifecycle_status, normalized_eol = self._resolve_lifecycle_status(
            explicit_status=explicit_status,
            eol_date=candidate_eol,
            deprecated_message=deprecated_message,
        )
        return {
            "lifecycle_status": lifecycle_status,
            "eol_date": normalized_eol,
            "eol_source": lifecycle_source if lifecycle_status != "unknown" else lifecycle_source,
            "lifecycle_detail": detail,
        }

    def _resolve_python_lifecycle(
        self,
        package_name: str,
        package_payload: Optional[dict],
    ) -> Dict[str, Optional[str]]:
        if not package_payload:
            return self._empty_lifecycle(source=f"pypi:{package_name}")
        lifecycle = package_payload.get("lifecycle")
        if isinstance(lifecycle, dict):
            return lifecycle
        return self._empty_lifecycle(source=f"pypi:{package_name}")

    def _resolve_npm_lifecycle(
        self,
        package_name: str,
        resolved_version: str,
        package_payload: Optional[dict],
    ) -> Dict[str, Optional[str]]:
        if not package_payload:
            return self._empty_lifecycle(source=f"npm:{package_name}")
        current_meta = ((package_payload.get("versions") or {}).get(resolved_version) or {})
        lifecycle = self._resolve_lifecycle(
            source=f"npm:{package_name}",
            explicit=current_meta.get("lifecycle") or package_payload.get("lifecycle"),
            deprecated_message=current_meta.get("deprecated"),
            eol_date=current_meta.get("eol_date")
            or current_meta.get("eol")
            or package_payload.get("eol_date")
            or package_payload.get("eol"),
        )
        if lifecycle["lifecycle_status"] == "unknown":
            return self._empty_lifecycle(source=f"npm:{package_name}")
        return lifecycle

    def _base_item(
        self,
        *,
        ecosystem: str,
        artifact_path: str,
        name: str,
        current_spec: Optional[str],
        resolved_version: Optional[str],
        latest_version: Optional[str],
        pinning_status: str,
        is_runtime_dependency: bool,
        lifecycle: Optional[Dict[str, Optional[str]]] = None,
        recommendation: str,
        status: str = "pass",
        signals: Optional[List[str]] = None,
    ) -> Dict[str, object]:
        lifecycle_payload = lifecycle or self._empty_lifecycle(
            status="not_applicable" if ecosystem == "docker" else "unknown",
            source=f"{ecosystem}:unknown",
        )
        return {
            "ecosystem": ecosystem,
            "artifact_path": artifact_path,
            "name": name,
            "current_spec": current_spec,
            "resolved_version": resolved_version,
            "latest_version": latest_version,
            "lag_type": None,
            "release_age_days": None,
            "pinning_status": pinning_status,
            "advisory_counts": {"critical": 0, "high": 0},
            "status": status,
            "signals": list(signals or []),
            "issue_types": [],
            "recommendation": recommendation,
            "lifecycle_status": lifecycle_payload.get("lifecycle_status"),
            "eol_date": lifecycle_payload.get("eol_date"),
            "eol_source": lifecycle_payload.get("eol_source"),
            "lifecycle_detail": lifecycle_payload.get("lifecycle_detail"),
            "is_runtime_dependency": is_runtime_dependency,
        }

    def _scan_python_requirements(
        self,
        root: Path,
        path: Path,
        payload: Dict[str, object],
    ) -> List[Dict[str, object]]:
        items: List[Dict[str, object]] = []
        relative_path = self._relative(root, path)
        for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            parsed = self._parse_python_requirement_line(raw_line)
            if not parsed:
                continue
            name = parsed["name"]
            current_spec = parsed["current_spec"]
            exact_pin, resolved_version = _is_python_exact_pin(current_spec)
            if not exact_pin:
                items.append(
                    self._base_item(
                        ecosystem="python",
                        artifact_path=relative_path,
                        name=name,
                        current_spec=current_spec,
                        resolved_version=None,
                        latest_version=None,
                        pinning_status=parsed["pinning_status"],
                        is_runtime_dependency=True,
                        recommendation=(
                            "Pin exact version trong requirements runtime để audit advisory "
                            "và lifecycle ổn định hơn."
                        ),
                        status="hygiene",
                        signals=["range_spec"] if current_spec else ["unpinned_dependency"],
                    )
                )
                continue

            pypi_payload = self._fetch_pypi_package(name, payload)
            osv_counts = self._fetch_osv_counts(
                package_name=name,
                ecosystem="PyPI",
                version=resolved_version,
                payload=payload,
            )
            item = self._base_item(
                ecosystem="python",
                artifact_path=relative_path,
                name=name,
                current_spec=current_spec,
                resolved_version=resolved_version,
                latest_version=(pypi_payload or {}).get("latest_version"),
                pinning_status="exact_pin",
                is_runtime_dependency=True,
                lifecycle=self._resolve_python_lifecycle(name, pypi_payload),
                recommendation=(
                    "Ưu tiên vá advisories severity cao; nếu package có deprecation/EOL "
                    "thì lên kế hoạch thay thế hoặc nâng cấp."
                ),
            )
            item["advisory_counts"] = osv_counts
            self._finalize_item_status(item)
            items.append(item)
        return items

    def _scan_node_lock(
        self,
        root: Path,
        path: Path,
        payload: Dict[str, object],
    ) -> List[Dict[str, object]]:
        try:
            lock_data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError) as exc:
            logger.info("Dependency health skipped invalid package-lock %s: %s", path, exc)
            return []

        items: List[Dict[str, object]] = []
        relative_path = self._relative(root, path)
        packages = lock_data.get("packages") or {}
        root_package = packages.get("") or {}
        direct_specs: Dict[str, str] = {}
        for section in ("dependencies", "optionalDependencies"):
            for name, spec in (root_package.get(section) or {}).items():
                direct_specs[str(name)] = str(spec)

        if not direct_specs:
            direct_specs = {
                str(name): str(((entry or {}).get("version") or ""))
                for name, entry in (lock_data.get("dependencies") or {}).items()
            }

        for name in sorted(direct_specs):
            current_spec = direct_specs.get(name) or ""
            resolved_version = None
            package_key = f"node_modules/{name}"
            lock_entry = packages.get(package_key) or {}
            if lock_entry.get("version"):
                resolved_version = str(lock_entry.get("version"))
            else:
                dep_entry = (lock_data.get("dependencies") or {}).get(name) or {}
                if dep_entry.get("version"):
                    resolved_version = str(dep_entry.get("version"))

            if not resolved_version:
                items.append(
                    self._base_item(
                        ecosystem="node",
                        artifact_path=relative_path,
                        name=name,
                        current_spec=current_spec,
                        resolved_version=None,
                        latest_version=None,
                        pinning_status="missing_resolution",
                        is_runtime_dependency=True,
                        recommendation=(
                            "Regenerate package-lock.json để dependency runtime có "
                            "resolved version ổn định."
                        ),
                        status="hygiene",
                        signals=["missing_lock_resolution"],
                    )
                )
                continue

            npm_payload = self._fetch_npm_package(name, payload)
            osv_counts = self._fetch_osv_counts(
                package_name=name,
                ecosystem="npm",
                version=resolved_version,
                payload=payload,
            )
            item = self._base_item(
                ecosystem="node",
                artifact_path=relative_path,
                name=name,
                current_spec=current_spec,
                resolved_version=resolved_version,
                latest_version=(npm_payload or {}).get("latest_version"),
                pinning_status="lockfile",
                is_runtime_dependency=True,
                lifecycle=self._resolve_npm_lifecycle(name, resolved_version, npm_payload),
                recommendation=(
                    "Ưu tiên vá advisories severity cao và thay package nếu đã "
                    "deprecated hoặc gần EOL."
                ),
            )
            item["advisory_counts"] = osv_counts
            self._finalize_item_status(item)
            items.append(item)

        return items

    def _scan_package_json_hygiene(
        self,
        root: Path,
        path: Path,
        _payload: Dict[str, object],
    ) -> List[Dict[str, object]]:
        try:
            package_data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError) as exc:
            logger.info("Dependency health skipped invalid package.json %s: %s", path, exc)
            return []

        relative_path = self._relative(root, path)
        items: List[Dict[str, object]] = []
        for section in ("dependencies", "optionalDependencies"):
            dependencies = package_data.get(section) or {}
            for name in sorted(dependencies):
                current_spec = str(dependencies.get(name) or "")
                pinning_status = "exact_pin" if _is_exact_semver_spec(current_spec) else (
                    "range" if current_spec else "unpinned"
                )
                signals = ["missing_lockfile"]
                if pinning_status == "range":
                    signals.append("range_spec")
                elif pinning_status == "unpinned":
                    signals.append("unpinned_dependency")
                items.append(
                    self._base_item(
                        ecosystem="node",
                        artifact_path=relative_path,
                        name=name,
                        current_spec=current_spec,
                        resolved_version=None,
                        latest_version=None,
                        pinning_status=pinning_status,
                        is_runtime_dependency=True,
                        recommendation=(
                            "Commit package-lock.json để audit đọc đúng resolved version "
                            "và advisory của dependency runtime."
                        ),
                        status="hygiene",
                        signals=signals,
                    )
                )
        return items

    def _scan_dockerfile(self, root: Path, path: Path) -> List[Dict[str, object]]:
        relative_path = self._relative(root, path)
        items: List[Dict[str, object]] = []
        for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            match = DOCKER_FROM_PATTERN.match(raw_line)
            if not match:
                continue
            image_ref = match.group("image")
            image_parts = self._parse_docker_image(image_ref)
            item = self._base_item(
                ecosystem="docker",
                artifact_path=relative_path,
                name=image_parts["display_name"],
                current_spec=image_ref,
                resolved_version=image_parts["tag"] or image_parts["digest"] or None,
                latest_version=None,
                pinning_status=image_parts["pinning_status"],
                is_runtime_dependency=True,
                lifecycle=self._empty_lifecycle(status="not_applicable", source="docker"),
                recommendation="Pin base image bằng digest để tránh drift trên prod.",
            )

            if image_parts["dynamic"]:
                item["signals"] = ["dynamic_base_image"]
                item["recommendation"] = (
                    "Tránh dùng biến môi trường hoặc ref động trong FROM nếu muốn audit "
                    "dependency ổn định."
                )
            elif not image_parts["has_digest"]:
                item["signals"] = ["mutable_base_image"]

            self._finalize_item_status(item)
            items.append(item)
        return items

    def _parse_python_requirement_line(self, raw_line: str) -> Optional[Dict[str, str]]:
        line = str(raw_line or "").strip()
        if not line or line.startswith("#"):
            return None
        if line.startswith(("-r", "--", "-e", "git+", "http://", "https://", ".")):
            return None
        if " #" in line:
            line = line.split(" #", 1)[0].strip()
        if ";" in line:
            line = line.split(";", 1)[0].strip()
        match = PYTHON_REQUIREMENT_PATTERN.match(line)
        if not match:
            return None
        name = match.group("name")
        spec = (match.group("spec") or "").strip()
        pinning_status = "range" if spec else "unpinned"
        exact_pin, _ = _is_python_exact_pin(spec)
        if exact_pin:
            pinning_status = "exact_pin"
        return {
            "name": _canonical_python_name(name),
            "current_spec": spec,
            "pinning_status": pinning_status,
        }

    def _parse_docker_image(self, image_ref: str) -> Dict[str, object]:
        raw = str(image_ref or "").strip()
        dynamic = "$" in raw
        tag = ""
        digest = ""
        repository_ref = raw
        if "@" in repository_ref:
            repository_ref, digest = repository_ref.split("@", 1)
        last_slash = repository_ref.rfind("/")
        last_colon = repository_ref.rfind(":")
        if last_colon > last_slash:
            repository_ref, tag = repository_ref[:last_colon], repository_ref[last_colon + 1 :]

        registry = ""
        remainder = repository_ref
        first_segment = repository_ref.split("/", 1)[0]
        if "/" in repository_ref and (
            "." in first_segment or ":" in first_segment or first_segment == "localhost"
        ):
            registry, remainder = repository_ref.split("/", 1)

        namespace = "library"
        repository = remainder
        if "/" in remainder:
            namespace, repository = remainder.split("/", 1)

        if not tag and not digest:
            pinning_status = "unpinned"
        elif digest:
            pinning_status = "digest_pinned"
        else:
            pinning_status = "tag_only"

        return {
            "registry": registry or "docker.io",
            "namespace": namespace,
            "repository": repository,
            "tag": tag,
            "digest": digest,
            "has_digest": bool(digest),
            "dynamic": dynamic,
            "pinning_status": pinning_status,
            "display_name": repository_ref if repository_ref else raw,
        }

    def _finalize_item_status(self, item: Dict[str, object]):
        advisory_counts = item.get("advisory_counts") or {}
        status = item.get("status") or "pass"
        signals = list(item.get("signals") or [])
        issue_types = list(item.get("issue_types") or [])
        issue_types.extend(signal for signal in signals if signal in WARNING_ISSUE_TYPES)
        lifecycle_status = str(item.get("lifecycle_status") or "").strip().lower()

        if advisory_counts.get("critical", 0) > 0:
            issue_types.append("critical_advisory")
        if advisory_counts.get("high", 0) > 0:
            issue_types.append("high_advisory")
        if lifecycle_status == "deprecated":
            issue_types.append("deprecated")
        elif lifecycle_status == "near_eol":
            issue_types.append("near_eol")
        elif lifecycle_status == "eol":
            issue_types.append("eol")

        normalized_issue_types = sorted(set(issue for issue in issue_types if issue in WARNING_ISSUE_TYPES))
        normalized_signals = sorted(set(signals + normalized_issue_types))

        if normalized_issue_types:
            status = "warning"
        elif status not in {"hygiene", "pass"}:
            status = "pass"

        item["issue_types"] = normalized_issue_types
        item["signals"] = normalized_signals
        item["status"] = status

    def _build_summary(
        self,
        manifests: List[Dict[str, object]],
        items: List[Dict[str, object]],
    ) -> Dict[str, object]:
        summary = _summary_keys()
        summary["manifests_scanned"] = [manifest["path"] for manifest in manifests]
        summary["dependencies_total"] = len(items)
        triggered_signals = set()

        for item in items:
            advisory_counts = item.get("advisory_counts") or {}
            summary["critical_advisories"] += int(advisory_counts.get("critical", 0) or 0)
            summary["high_advisories"] += int(advisory_counts.get("high", 0) or 0)

            lifecycle_status = item.get("lifecycle_status")
            if lifecycle_status == "deprecated":
                summary["deprecated_count"] += 1
            elif lifecycle_status == "near_eol":
                summary["near_eol_count"] += 1
            elif lifecycle_status == "eol":
                summary["eol_count"] += 1
            elif lifecycle_status == "unknown" and item.get("ecosystem") in {"python", "node"}:
                summary["unknown_eol_count"] += 1

            issue_types = item.get("issue_types") or []
            if any(signal in {"mutable_base_image", "dynamic_base_image"} for signal in issue_types):
                summary["mutable_base_image_count"] += 1
            if item.get("status") == "hygiene":
                summary["hygiene_warning_count"] += 1
            if item.get("status") == "warning":
                triggered_signals.update(issue_types)

        summary["triggered_signals"] = sorted(triggered_signals)
        return summary

    def _resolve_status(self, items: List[Dict[str, object]]) -> str:
        if any(item.get("status") == "warning" for item in items):
            return "warning"
        if any(item.get("status") == "pass" for item in items):
            return "pass"
        return "unavailable"


def evaluate_dependency_health(
    target_dir: str,
    *,
    enabled: bool = True,
    eol_warning_days: Optional[int] = None,
    release_age_warning_days: Optional[int] = None,
    major_lag_threshold: Optional[int] = None,
) -> Dict[str, object]:
    if not enabled:
        return _base_payload(
            enabled=False,
            note="Dependency Health Guard đang bị tắt trong runtime settings.",
        )
    service = DependencyHealthService(
        eol_warning_days=eol_warning_days,
        release_age_warning_days=release_age_warning_days,
        major_lag_threshold=major_lag_threshold,
    )
    return service.assess(target_dir)
