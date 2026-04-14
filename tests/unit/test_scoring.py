"""
Unit Tests — ScoringEngine
Test công thức K-Factor, Laplace Smoothing, pillar normalization, weighted average.
"""

import pytest
from src.engine.scoring import ScoringEngine


class TestPillarScore:
    """calculate_pillar_score() — Công thức điểm trụ cột."""

    def test_zero_punishment_gives_perfect_score(self):
        score = ScoringEngine.calculate_pillar_score(0, 5000, "Maintainability")
        assert score == 10.0

    def test_heavy_security_punishment(self):
        """Security có K=10 (nhạy nhất) → điểm giảm nhanh."""
        score = ScoringEngine.calculate_pillar_score(-50, 3000, "Security")
        assert score < 5.0, f"Security score should be < 5 with heavy penalty, got {score}"

    def test_light_maintainability_punishment(self):
        """Maintainability có K=25 (dung sai lớn) → điểm giảm chậm."""
        score = ScoringEngine.calculate_pillar_score(-5, 3000, "Maintainability")
        assert score > 7.0, f"Maintainability should degrade slowly, got {score}"

    def test_laplace_smoothing(self):
        """File nhỏ (5 LOC) vẫn dùng effective_loc = 1000."""
        score_small = ScoringEngine.calculate_pillar_score(-10, 5, "Security")
        score_thousand = ScoringEngine.calculate_pillar_score(-10, 1000, "Security")
        assert score_small == score_thousand, (
            f"Laplace smoothing should cap at 1000 LOC, "
            f"got {score_small} vs {score_thousand}"
        )

    def test_large_project_less_impact(self):
        """Dự án lớn → cùng số lỗi ảnh hưởng ít hơn."""
        score_small = ScoringEngine.calculate_pillar_score(-20, 1000, "Performance")
        score_large = ScoringEngine.calculate_pillar_score(-20, 10000, "Performance")
        assert score_large > score_small, (
            f"Larger project should have higher score with same penalty, "
            f"got large={score_large} vs small={score_small}"
        )

    def test_score_always_positive(self):
        """Score never goes below 0."""
        score = ScoringEngine.calculate_pillar_score(-1000, 100, "Security")
        assert score > 0, f"Score should always be > 0, got {score}"

    def test_score_max_10(self):
        """Score never exceeds 10."""
        score = ScoringEngine.calculate_pillar_score(0, 100000, "Maintainability")
        assert score <= 10.0

    def test_unknown_pillar_uses_default_k(self):
        """Unknown pillar uses default K-factor (15.0)."""
        score = ScoringEngine.calculate_pillar_score(-10, 5000, "CustomPillar")
        assert 0 < score <= 10


class TestFinalScore:
    """calculate_final_score() — Weighted score cho 1 feature."""

    def test_perfect_pillars_gives_100(self):
        pillars = {
            "Maintainability": 10.0,
            "Security": 10.0,
            "Reliability": 10.0,
            "Performance": 10.0,
        }
        score = ScoringEngine.calculate_final_score(pillars)
        assert score == 100.0

    def test_zero_pillars_gives_zero(self):
        pillars = {
            "Maintainability": 0.0,
            "Security": 0.0,
            "Reliability": 0.0,
            "Performance": 0.0,
        }
        score = ScoringEngine.calculate_final_score(pillars)
        assert score == 0.0

    def test_mixed_pillars(self):
        pillars = {
            "Maintainability": 8.0,
            "Security": 5.0,
            "Reliability": 7.0,
            "Performance": 9.0,
        }
        score = ScoringEngine.calculate_final_score(pillars)
        assert 0 < score < 100


class TestFinalScoreFromFeatures:
    """calculate_final_score_from_features() — Weighted avg theo LOC."""

    def test_empty_features_is_perfect(self):
        score = ScoringEngine.calculate_final_score_from_features({})
        assert score == 100.0

    def test_weighted_by_loc(self):
        """Larger feature should dominate final score."""
        features = {
            "big_module": {"final": 50, "loc": 10000, "pillars": {}},
            "small_module": {"final": 100, "loc": 100, "pillars": {}},
        }
        score = ScoringEngine.calculate_final_score_from_features(features)
        # big_module (50 * 10000 + 100 * 100) / 10100 ≈ 50.5
        assert score < 55, f"Large module should dominate, got {score}"

    def test_equal_loc_is_simple_average(self):
        features = {
            "a": {"final": 80, "loc": 1000, "pillars": {}},
            "b": {"final": 60, "loc": 1000, "pillars": {}},
        }
        score = ScoringEngine.calculate_final_score_from_features(features)
        assert score == 70.0


class TestRating:
    """get_rating() — Emoji rating thresholds."""

    def test_excellent_rating(self):
        assert "Excellent" in ScoringEngine.get_rating(95)

    def test_good_rating(self):
        assert "Good" in ScoringEngine.get_rating(85)

    def test_fair_rating(self):
        assert "Fair" in ScoringEngine.get_rating(70)

    def test_average_rating(self):
        assert "Average" in ScoringEngine.get_rating(50)

    def test_needs_improvement_rating(self):
        assert "Needs Improvement" in ScoringEngine.get_rating(30)

    def test_boundary_90(self):
        assert "Excellent" in ScoringEngine.get_rating(90)

    def test_boundary_80(self):
        assert "Good" in ScoringEngine.get_rating(80)
