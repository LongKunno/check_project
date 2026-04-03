"""
Phát hiện Circular Dependencies cấp project bằng phân tích AST.
Tách ra từ verification.py để tái sử dụng và test độc lập.
"""
import ast
import os
import logging

from src.engine.scanners import _build_flat_meta


def detect_circular_dependencies(file_list, rules):
    """Phát hiện phụ thuộc vòng (Circular Import) ở cấp project."""
    disabled_ids = rules.get('disabled_ids', [])
    flat_meta = _build_flat_meta(rules.get('rules', []))
    circ_rule = flat_meta.get('CIRCULAR_DEPENDENCY')

    if not circ_rule or 'CIRCULAR_DEPENDENCY' in disabled_ids:
        return []

    imports_map = {}
    file_to_mod = {}
    mod_to_file = {}

    for f in file_list:
        if not f.endswith('.py'): continue
        mod_name = os.path.splitext(os.path.basename(f))[0]
        file_to_mod[f] = mod_name
        mod_to_file[mod_name] = f

    for f in file_list:
        if not f.endswith('.py'): continue
        try:
            with open(f, 'r', encoding='utf-8') as file:
                tree = ast.parse(file.read())
            deps = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for n in node.names: deps.add(n.name.split('.')[0])
                elif isinstance(node, ast.ImportFrom):
                    if node.module: deps.add(node.module.split('.')[0])
            imports_map[file_to_mod[f]] = list(deps.intersection(set(mod_to_file.keys())))
        except Exception as e:
            logging.getLogger(__name__).warning(f"Error parsing {f} for dependencies: {e}")

    violations = []
    visited_fully = set()

    def dfs(node, path):
        if node in path:
            cycle = path[path.index(node):]
            if len(cycle) > 1:
                cycle_str = " -> ".join(cycle + [node])
                v = {
                    "file": mod_to_file[node],
                    "type": circ_rule.get('pillar', 'Maintainability'),
                    "reason": f"{circ_rule.get('reason')} ({cycle_str})",
                    "weight": circ_rule.get('weight', -10),
                    "rule_id": 'CIRCULAR_DEPENDENCY',
                    "line": 1,
                    "snippet": cycle_str,
                    "severity": circ_rule.get('severity', 'Blocker'),
                    "debt": circ_rule.get('debt', 60),
                    "ai_prompt": circ_rule.get('ai', {}).get('prompt') if circ_rule.get('ai') else None
                }
                if not any(existing["snippet"] == cycle_str for existing in violations):
                    violations.append(v)
            return

        for neighbor in imports_map.get(node, []):
            if neighbor not in visited_fully:
                dfs(neighbor, path + [node])

        visited_fully.add(node)

    for mod in imports_map:
        if mod not in visited_fully:
            dfs(mod, [])

    return violations
