"""
Database Layer (V2.0.0 - PostgreSQL Migration)
Handles persistence of audit sessions using PostgreSQL.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json
from datetime import datetime

# Default to Docker compose service or localhost for local testing
DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgrespassword@localhost:5432/auditor_v2')

class AuditDatabase:
    """
    Manages the PostgreSQL database for audit history.
    """
    @staticmethod
    def get_connection():
        return psycopg2.connect(DB_URL)

    @staticmethod
    def initialize():
        """Creates the necessary tables if they don't exist, retries connection on startup."""
        import time
        max_retries = 10
        conn = None
        for i in range(max_retries):
            try:
                conn = AuditDatabase.get_connection()
                break
            except psycopg2.OperationalError as e:
                print(f"Waiting for Postgres to start (Attempt {i+1}/{max_retries})...")
                time.sleep(2)
        
        if not conn:
            print("Failed to connect to Postgres after multiple retries. Database not initialized.")
            return

        try:
            conn.autocommit = True
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS audit_history (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    target TEXT NOT NULL,
                    score REAL NOT NULL,
                    rating TEXT NOT NULL,
                    total_loc INTEGER NOT NULL,
                    violations_count INTEGER NOT NULL,
                    pillar_scores TEXT NOT NULL,
                    full_json TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS project_rules (
                    id SERIAL PRIMARY KEY,
                    target_id TEXT NOT NULL UNIQUE,
                    natural_text TEXT NOT NULL,
                    compiled_json TEXT,
                    disabled_core_rules TEXT DEFAULT '[]',
                    custom_weights TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Check for existing columns to support older schema updates
            cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_history'")
            columns_history = [row[0] for row in cursor.fetchall()]
            if 'full_json' not in columns_history:
                cursor.execute('ALTER TABLE audit_history ADD COLUMN full_json TEXT')
                
            cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'project_rules'")
            columns_rules = [row[0] for row in cursor.fetchall()]
            if 'disabled_core_rules' not in columns_rules:
                cursor.execute("ALTER TABLE project_rules ADD COLUMN disabled_core_rules TEXT DEFAULT '[]'")
            if 'custom_weights' not in columns_rules:
                cursor.execute("ALTER TABLE project_rules ADD COLUMN custom_weights TEXT DEFAULT '{}'")
                
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Database Initialization Error: {e}")

    @staticmethod
    def save_audit(target, score, rating, loc, violations_count, pillar_scores, full_json=None):
        """Saves a new audit session to the database."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO audit_history (target, score, rating, total_loc, violations_count, pillar_scores, full_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (target, score, rating, loc, violations_count, json.dumps(pillar_scores), json.dumps(full_json) if full_json else None))
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def get_history(target_path=None):
        """Retrieves lightweight history, optionally filtered by target path."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query_cols = "id, timestamp, target, score, rating, total_loc, violations_count, pillar_scores"
        
        if target_path:
            cursor.execute(f'SELECT {query_cols} FROM audit_history WHERE target = %s ORDER BY timestamp DESC', (target_path,))
        else:
            cursor.execute(f'SELECT {query_cols} FROM audit_history ORDER BY timestamp DESC LIMIT 50')
            
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        
        results = []
        for row in rows:
            d = dict(row)
            # Chuyển đổi datetime sang ISO string để tương thích với Frontend
            if 'timestamp' in d and isinstance(d['timestamp'], datetime):
                d['timestamp'] = d['timestamp'].isoformat()
            try:
                d['pillar_scores'] = json.loads(d.get('pillar_scores', '{}'))
            except:
                d['pillar_scores'] = {}
            results.append(d)
        return results

    @staticmethod
    def get_audit_by_id(audit_id):
        """Retrieves details of a single audit including the full JSON payload by ID."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('SELECT * FROM audit_history WHERE id = %s', (audit_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not row:
            return None
            
        d = dict(row)
        if 'timestamp' in d and isinstance(d['timestamp'], datetime):
            d['timestamp'] = d['timestamp'].isoformat()
            
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
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, disabled_core_rules, custom_weights FROM project_rules WHERE target_id = %s', (target_id,))
        row = cursor.fetchone()
        
        compiled_str = json.dumps(compiled_json) if compiled_json is not None else None
        
        if row:
            final_disabled = disabled_core_rules if disabled_core_rules != "[]" else row[1]
            cursor.execute('''
                UPDATE project_rules 
                SET natural_text = %s, compiled_json = %s, disabled_core_rules = %s, updated_at = CURRENT_TIMESTAMP
                WHERE target_id = %s
            ''', (natural_text, compiled_str, final_disabled, target_id))
        else:
            cursor.execute('''
                INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules, custom_weights)
                VALUES (%s, %s, %s, %s, '{}')
            ''', (target_id, natural_text, compiled_str, disabled_core_rules))
            
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def toggle_core_rule(target_id, rule_id, is_disabled):
        """Toggles a specific core rule for a project."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id, disabled_core_rules FROM project_rules WHERE target_id = %s', (target_id,))
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
            cursor.execute('UPDATE project_rules SET disabled_core_rules = %s, updated_at = CURRENT_TIMESTAMP WHERE target_id = %s', (disabled_str, target_id))
        else:
            cursor.execute('INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules) VALUES (%s, %s, %s, %s)', (target_id, "", None, disabled_str))
            
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def save_custom_weights(target_id, custom_weights):
        """Lưu lại trọng số tuỳ chỉnh của các rules cho dự án."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        
        weights_str = json.dumps(custom_weights) if custom_weights is not None else "{}"
        
        cursor.execute('SELECT id FROM project_rules WHERE target_id = %s', (target_id,))
        if cursor.fetchone():
            cursor.execute('''
                UPDATE project_rules 
                SET custom_weights = %s, updated_at = CURRENT_TIMESTAMP
                WHERE target_id = %s
            ''', (weights_str, target_id))
        else:
            cursor.execute('''
                INSERT INTO project_rules (target_id, natural_text, compiled_json, disabled_core_rules, custom_weights)
                VALUES (%s, '', NULL, '[]', %s)
            ''', (target_id, weights_str))
            
        conn.commit()
        cursor.close()
        conn.close()

    @staticmethod
    def get_project_rules(target_id):
        """Retrieves saved rules for a target."""
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute('SELECT natural_text, compiled_json, disabled_core_rules, custom_weights FROM project_rules WHERE target_id = %s', (target_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row:
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
        conn = AuditDatabase.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM project_rules WHERE target_id = %s', (target_id,))
        conn.commit()
        cursor.close()
        conn.close()

# Avoid initializing DB on import immediately if docker is not up
# AuditDatabase.initialize()
