"""
Scoring Engine (V1)
Implementation of the normalized scoring formula and rating system for the V1.0.0 Framework.
"""



class ScoringEngine:
    """
    Static methods for calculating audit scores based on the V1.0.0 framework formula.
    """
    @staticmethod
    def calculate_pillar_score(punishment, total_loc, pillar='Maintainability'):
        """
        Calculates a score from 0 to 10 for a specific pillar using Dynamic K-Factors.
        """
        # Áp dụng Laplace Smoothing (Base Threshold) cho các file hoặc feature quá nhỏ
        # để ngăn chặn việc lỗi bị khuếch đại vô lý. Tối thiểu là 500 dòng code.
        effective_loc = max(total_loc, 500)
        
        # Dynamic K-Factor mapping based on pillar sensitivity
        k_factors = {
            'Maintainability': 4.0,
            'Security': 0.5,
            'Reliability': 2.0,
            'Performance': 2.0
        }
        k_factor = k_factors.get(pillar, 2.0)
        
        # Normalize punishment based on project size (per 1000 lines)
        normalized_punishment = abs(punishment) / (effective_loc / 1000)
        
        score = 10 / (1 + (normalized_punishment / k_factor))
        return round(score, 2)

    @staticmethod
    def calculate_final_score(pillar_scores):
        """
        Calculates the final weighted score (0-10) for a single feature/project.
        """
        from src.config import WEIGHTS
        final = 0
        total_config_weight = sum(WEIGHTS.values())
        if total_config_weight == 0:
            total_config_weight = 1.0 # Fallback an toàn
            
        for pillar, score in pillar_scores.items():
            # Chuẩn hóa về thang 100% để chống việc user config tổng WEIGHTS != 1.0
            actual_weight = WEIGHTS.get(pillar, 0.25) / total_config_weight
            final += score * actual_weight
        return round(final * 10, 2)

    @staticmethod
    def calculate_final_score_from_features(feature_results):
        """
        Calculates the average score (0-100) from multiple features.
        """
        if not feature_results:
            return 100.0
        
        total_weight = sum(res.get('loc', 0) for res in feature_results.values())
        if total_weight > 0:
            total_weighted_score = sum(res['final'] * res.get('loc', 0) for res in feature_results.values())
            return round(total_weighted_score / total_weight, 2)
            
        total = sum(f['final'] for f in feature_results.values())
        return round(total / len(feature_results), 2)

    @staticmethod
    def get_rating(score):
        """
        Returns a descriptive rating and emoji based on the 0-100 score.
        """
        if score >= 90: return "🏆 Xuất sắc"
        if score >= 80: return "🥈 Tốt"
        if score >= 65: return "🥉 Khá"
        if score >= 45: return "⚠️ Trung bình"
        return "🚨 Cần cải thiện ngay"
