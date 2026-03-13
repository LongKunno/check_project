"""
Database Layer (V2)
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
                pillar_scores TEXT NOT NULL -- Store JSON string of pillar scores
            )
        ''')
        conn.commit()
        conn.close()

    @staticmethod
    def save_audit(target, score, rating, loc, violations_count, pillar_scores):
        """Saves a new audit session to the database."""
        import json
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO audit_history (target, score, rating, total_loc, violations_count, pillar_scores)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (target, score, rating, loc, violations_count, json.dumps(pillar_scores)))
        conn.commit()
        conn.close()

    @staticmethod
    def get_history(target_path=None):
        """Retrieves history, optionally filtered by target path."""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if target_path:
            cursor.execute('SELECT * FROM audit_history WHERE target = ? ORDER BY timestamp DESC', (target_path,))
        else:
            cursor.execute('SELECT * FROM audit_history ORDER BY timestamp DESC LIMIT 50')
            
        rows = cursor.fetchall()
        conn.close()
        
        import json
        results = []
        for row in rows:
            d = dict(row)
            d['pillar_scores'] = json.loads(d['pillar_scores'])
            results.append(d)
        return results

# Initialize DB on import
AuditDatabase.initialize()
