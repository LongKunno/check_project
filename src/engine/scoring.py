"""
Scoring Engine (V1)
Implementation of the normalized scoring formula and rating system for the V3 Framework.
"""

import math

class ScoringEngine:
    """
    Static methods for calculating audit scores based on the V3 framework formula.
    """
    @staticmethod
    def calculate_pillar_score(punishment, total_loc):
        """
        Calculates a score from 0 to 10 for a specific pillar.
        Formula: Điểm = 10 / (1 + (|Trọng số| / 2))
        """
        if total_loc == 0:
            return 10.0
        
        # Normalize punishment based on project size (per 1000 lines)
        k_factor = 2.0
        normalized_punishment = abs(punishment) / (total_loc / 1000)
        
        score = 10 / (1 + (normalized_punishment / k_factor))
        return round(score, 2)

    @staticmethod
    def calculate_final_score(pillar_scores):
        """
        Calculates the final weighted score (0-10) for a single feature/project.
        """
        from src.config import WEIGHTS
        final = 0
        for pillar, score in pillar_scores.items():
            final += score * WEIGHTS.get(pillar, 0.25)
        return round(final * 10, 2)

    @staticmethod
    def calculate_final_score_from_features(feature_results):
        """
        Calculates the average score (0-100) from multiple features.
        """
        if not feature_results:
            return 100.0
        
        total = sum(f['final'] for f in feature_results.values())
        return round(total / len(feature_results), 2)

    @staticmethod
    def get_rating(score):
        """
        Returns a letter rating and emoji based on the score.
        """
        if score >= 90: return "🏆 A+"
        if score >= 85: return "🥇 A"
        if score >= 75: return "🥈 B"
        if score >= 60: return "🚨 C"
        if score >= 40: return "⚠️ D"
        return "❌ E"
