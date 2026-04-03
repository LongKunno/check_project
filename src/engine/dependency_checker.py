"""
Phát hiện Circular Dependencies cấp project bằng phân tích AST.
Tách ra từ verification.py để tái sử dụng và test độc lập.
"""
import ast
import os

from src.engine.scanners import _build_flat_meta


def detect_circular_dependencies(file_list, rules):
    """Phát hiện phụ thuộc vòng (Circular Import) ở cấp project."""
    disabled_ids = rules.get('disabled_ids', [])
    flat_meta = _build_flat_meta(rules.get('rules', []))
    circ_rule = flat_meta.get('CIRCULAR_DEPENDENCY')

    if not circ_rule or 'CIRCULAR_DEPENDENCY' in disabled_ids:
        return []

    def _build_mappings(f_list):
        f_to_mod = {}
        mod_to_f = {}
        for f in f_list:
            if not f.endswith('.py'): continue
            base = os.path.splitext(f)[0]
            mod_name = base.replace(os.sep, '.').replace('/', '.')
            short_name = os.path.splitext(os.path.basename(f))[0]
            f_to_mod[f] = short_name
            mod_to_f[short_name] = f
            mod_to_f[mod_name] = f
        return f_to_mod, mod_to_f

    def _extract_dependencies(f_list, f_to_mod, mod_to_f):
        imp_map = {}
        for f in f_list:
            if not f.endswith('.py'): continue
            try:
                with open(f, 'r', encoding='utf-8') as file:
                    tree = ast.parse(file.read())
                
                class TopLevelImportVisitor(ast.NodeVisitor):
                    def __init__(self):
                        self.deps = set()
                    def visit_Import(self, node):
                        for n in node.names: self.deps.add(n.name.split('.')[0])
                        self.generic_visit(node)
                    def visit_ImportFrom(self, node):
                        if node.module: self.deps.add(node.module.split('.')[0])
                        self.generic_visit(node)
                    def visit_FunctionDef(self, node):
                        pass
                    def visit_AsyncFunctionDef(self, node):
                        pass

                visitor = TopLevelImportVisitor()
                visitor.visit(tree)
                deps = visitor.deps
                imp_map[f_to_mod[f]] = list(deps.intersection(set(mod_to_f.keys())))
            except Exception as e:
                pass # Safe to ignore parsing errors for non-standard Python files in Dependency Checker
        return imp_map

    file_to_mod, mod_to_file = _build_mappings(file_list)
    imports_map = _extract_dependencies(file_list, file_to_mod, mod_to_file)

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
