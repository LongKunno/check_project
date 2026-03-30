"""
Database Layer (V1.0.0)
Handles persistence of audit sessions using SQLite.
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'auditor_v2.db')

class AuditDatabase:
    """
    Manages the SQLite database for audit history.
    """
    @staticmethod
    def initialize():
        """Creates the necessary tables if they don't exist."""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                target TEXT NOT NULL,
                score REAL NOT NULL,
                rating TEXT NOT NULL,
                total_loc INTEGER NOT NULL,
                violations_count INTEGER NOT NULL,
                pillar_scores TEXT NOT NULL, -- Store JSON string of pillar scores
                full_json TEXT -- Store the entire result JSON for re-viewing
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS project_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_id TEXT NOT NULL UNIQUE,
                natural_text TEXT NOT NULL,
                compiled_json TEXT,
                disabled_core_rules TEXT DEFAULT "[]",
                custom_weights TEXT DEFAULT "{}",
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Kiểm tra và thêm cột nếu nâng cấp từ bản cũ
        cursor.execute("PRAGMA table_info(audit_history)")
        columns_history = [col[1] for col in cursor.fetchall()]
        if 'full_json' not in columns_history:
            cursor.execute('ALTER TABLE audit_history ADD COLUMN full_json TEXT')
            
        cursor.execute("PRAGMA table_info(project_rules)")
        columns_rules = [col[1] for col in cursor.fetchall()]
        if 'disabled_core_rules' not in columns_rules:
            cursor.execute('ALTER TABLE project_rules ADD COLUMN disabled_core_rules TEXT DEFAULT "[]"')
        if 'custom_weights' not in columns_rules:
            cursor.execute('ALTER TABLE project_rules ADD COLUMN custom_weights TEXT DEFAULT "{}"')
            
        conn.commit()
        conn.close()

    @staticmethod
    def save_audit(target, score, rating, loc, violations_count, pillar_scores, full_json=None):
        """Saves a new audit session to the database."""
        import json
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO audit_history (target, score, rating, total_loc, violations_count, pillar_scores, full_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (target, score, rating, loc, violations_count, json.dumps(pillar_scores), json.dumps(full_json) if full_json else None))
        conn.commit()
        conn.close()

    @staticmethod
    def get_history(target_path=None):
        """Retrieves lightweight history, optionally filtered by target path."""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Chỉ lấy các trường cần thiết dùng hiển thị danh sách để tăng tốc độ load, KHÔNG lấy full_json (chứa hàng MB dữ liệu)
        query_cols = "id, timestamp, target, score, rating, total_loc, violations_count, pillar_scores"
        
        if target_path:
            cursor.execute(f'SELECT {query_cols} FROM audit_history WHERE target = ? ORDER BY timestamp DESC', (target_path,))
        else:
            cursor.execute(f'SELECT {query_cols} FROM audit_history ORDER BY timestamp DESC LIMIT 50')
            
        rows = cursor.fetchall()
        conn.close()
        
        import json
        results = []
        for row in rows:
            d = dict(row)
            try:
                d['pillar_scores'] = json.loads(d.get('pillar_scores', '{}'))
            except:
                d['pillar_scores'] = {}
            results.append(d)
        return results

    @staticmethod
    def get_audit_by_id(audit_id):
        """Retrieves details of a single audit including the full JSON payload by ID."""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM audit_history WHERE id = ?', (audit_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
            
        import json
        d = dict(row)
        try:
            d['pillar_scores'] = json.loads(d.get('pillar_scores', '{}'))
        except:
            d['pillar_scores'] = {}
            
        if d.get('full_json'):
            try:
                d['full_json'] = json.loads(d['full_json'])
            except:
                d['full_json'] = None
        return d

    @staticmethod
    def save_project_rules(target_id, natural_text, compiled_json, disabled_core_rules="[]"):
        """Saves or updates project rules."""
        import json
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if rules already exist for this target
        cursor.execute('SELECT id, disabled_core_rules, custom_weights FROM project_rules WHERE target_id = ?', (target_id,))
        row = cursor.fetchone()
        
        compiled_str = json.dumps(compiled_json) if compiled_json is not None else None
        
        if row:
            final_disabled = disabled_core_rules if disabled_core_rules != "[]" else row[1]
            cursor.execute('''
                UPDATE project_rules 
                SET natural_text = ?, compiled_json = ?, disabled_core_rules = ?, updated_at = CURRENT_TIMESTAMP
                WHERE target_id = ?
            ''', (natural_text, compiled_str, final_disabled, target_id))
        else:
            cursor.execute('''
                INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules, custom_weights)
                VALUES (?, ?, ?, ?, "{}")
            ''', (target_id, natural_text, compiled_str, disabled_core_rules))
            
        conn.commit()
        conn.close()

    @staticmethod
    def toggle_core_rule(target_id, rule_id, is_disabled):
        """Toggles a specific core rule for a project."""
        import json
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT id, disabled_core_rules FROM project_rules WHERE target_id = ?', (target_id,))
        row = cursor.fetchone()
        
        disabled_rules = []
        if row and row[1]:
            try:
                disabled_rules = json.loads(row[1])
            except:
                pass
                
        if is_disabled and rule_id not in disabled_rules:
            disabled_rules.append(rule_id)
        elif not is_disabled and rule_id in disabled_rules:
            disabled_rules.remove(rule_id)
            
        disabled_str = json.dumps(disabled_rules)
        
        if row:
            cursor.execute('UPDATE project_rules SET disabled_core_rules = ?, updated_at = CURRENT_TIMESTAMP WHERE target_id = ?', (disabled_str, target_id))
        else:
            cursor.execute('INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules) VALUES (?, ?, ?, ?)', (target_id, "", None, disabled_str))
            
        conn.commit()
        conn.close()

    @staticmethod
    def save_custom_weights(target_id, custom_weights):
        """Lưu lại trọng số tuỳ chỉnh của các rules cho dự án."""
        import json
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        weights_str = json.dumps(custom_weights) if custom_weights is not None else "{}"
        
        cursor.execute('SELECT id FROM project_rules WHERE target_id = ?', (target_id,))
        if cursor.fetchone():
            cursor.execute('''
                UPDATE project_rules 
                SET custom_weights = ?, updated_at = CURRENT_TIMESTAMP
                WHERE target_id = ?
            ''', (weights_str, target_id))
        else:
            cursor.execute('''
                INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules, custom_weights)
                VALUES (?, "", NULL, "[]", ?)
            ''', (target_id, weights_str))
            
        conn.commit()
        conn.close()

    @staticmethod
    def get_project_rules(target_id):
        """Retrieves saved rules for a target."""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT natural_text, compiled_json, disabled_core_rules, custom_weights FROM project_rules WHERE target_id = ?', (target_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            import json
            compiled = None
            if row['compiled_json']:
                try: compiled = json.loads(row['compiled_json'])
                except: pass
                
            disabled = []
            if row['disabled_core_rules']:
                try: disabled = json.loads(row['disabled_core_rules'])
                except: pass
                
            weights = {}
            if row['custom_weights']:
                try: weights = json.loads(row['custom_weights'])
                except: pass
                
            return {
                "natural_text": row['natural_text'],
                "compiled_json": compiled,
                "disabled_core_rules": disabled,
                "custom_weights": weights
            }
        return None

    @staticmethod
    def delete_project_rules(target_id):
        """Deletes project rules for a specific target."""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM project_rules WHERE target_id = ?', (target_id,))
        conn.commit()
        conn.close()

# Initialize DB on import
AuditDatabase.initialize()
