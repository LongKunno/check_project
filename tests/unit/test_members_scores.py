from src.api.routers.members import _aggregate_members
from src.engine.scoring import ScoringEngine


def test_aggregate_members_weights_project_pillar_scores_by_loc():
    entries = [
        {
            "email": "dev@example.com",
            "author_name": "Dev",
            "loc": 1000,
            "debt_mins": 30,
            "punishments": {
                "Maintainability": -999.0,
                "Security": -999.0,
                "Reliability": -999.0,
                "Performance": -999.0,
            },
            "pillars": {
                "Maintainability": 9.0,
                "Security": 9.0,
                "Reliability": 9.0,
                "Performance": 9.0,
            },
            "final": 90.0,
            "project_name": "Project A",
        },
        {
            "email": "dev@example.com",
            "author_name": "Dev",
            "loc": 100,
            "debt_mins": 5,
            "punishments": {
                "Maintainability": 0.0,
                "Security": 0.0,
                "Reliability": 0.0,
                "Performance": 0.0,
            },
            "pillars": {
                "Maintainability": 1.0,
                "Security": 1.0,
                "Reliability": 1.0,
                "Performance": 1.0,
            },
            "final": 10.0,
            "project_name": "Project B",
        },
    ]

    result = _aggregate_members(entries)

    assert len(result) == 1
    member = result[0]
    expected_pillars = {
        "Maintainability": 8.27,
        "Security": 8.27,
        "Reliability": 8.27,
        "Performance": 8.27,
    }

    assert member["total_loc"] == 1100
    assert member["pillar_scores"] == expected_pillars
    assert member["final_score"] == ScoringEngine.calculate_final_score(expected_pillars)
