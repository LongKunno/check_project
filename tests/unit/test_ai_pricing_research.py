import pytest

from src.engine.ai_pricing_research import AiPricingResearchService


ANTHROPIC_HTML = """
<table>
  <thead>
    <tr>
      <th>Model</th>
      <th>Base Input Tokens</th>
      <th>5m Cache Writes</th>
      <th>1h Cache Writes</th>
      <th>Cache Hits &amp; Refreshes</th>
      <th>Output Tokens</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Claude Sonnet 4.5</td>
      <td>$3 / MTok</td>
      <td>$3.75 / MTok</td>
      <td>$6 / MTok</td>
      <td>$0.30 / MTok</td>
      <td>$15 / MTok</td>
    </tr>
  </tbody>
</table>
<table>
  <thead>
    <tr>
      <th>Model</th>
      <th>Batch input</th>
      <th>Batch output</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Claude Sonnet 4.5</td>
      <td>$1.50 / MTok</td>
      <td>$7.50 / MTok</td>
    </tr>
  </tbody>
</table>
"""

GOOGLE_HTML = """
<h2 id="gemini-2.5-pro" data-text="Gemini 2.5 Pro" tabindex="-1">Gemini 2.5 Pro</h2>
<em><code translate="no" dir="ltr">gemini-2.5-pro</code></em>
<section><h3 id="standard_6" data-text="Standard" tabindex="-1">Standard</h3><table class="pricing-table">
  <tbody>
    <tr>
      <td>Input price</td>
      <td>Free of charge</td>
      <td>$1.25, prompts &lt;= 200k tokens<br>$2.50, prompts &gt; 200k tokens</td>
    </tr>
    <tr>
      <td>Output price (including thinking tokens)</td>
      <td>Free of charge</td>
      <td>$10.00, prompts &lt;= 200k tokens<br>$15.00, prompts &gt; 200k</td>
    </tr>
    <tr>
      <td>Context caching price</td>
      <td>Not available</td>
      <td>$0.125, prompts &lt;= 200k tokens<br>$0.25, prompts &gt; 200k</td>
    </tr>
  </tbody>
</table></section>
<section><h3 id="batch_6" data-text="Batch" tabindex="-1">Batch</h3><table class="pricing-table">
  <tbody>
    <tr>
      <td>Input price</td>
      <td>Not available</td>
      <td>$0.625, prompts &lt;= 200k tokens<br>$1.25, prompts &gt; 200k tokens</td>
    </tr>
    <tr>
      <td>Output price (including thinking tokens)</td>
      <td>Not available</td>
      <td>$5.00, prompts &lt;= 200k tokens<br>$7.50, prompts &gt; 200k</td>
    </tr>
    <tr>
      <td>Context caching price</td>
      <td>Not available</td>
      <td>$0.125, prompts &lt;= 200k tokens<br>$0.25, prompts &gt; 200k</td>
    </tr>
  </tbody>
</table></section>
"""

OPENAI_HTML = """
<div>Text tokens</div>
<div class="flex flex-row"><div class="flex flex-1 flex-col gap-1 rounded-lg border border-solid border-default bg-surface-secondary px-3 py-4"><div>Input</div><div class="text-2xl font-semibold">$0.75</div></div><div class="flex flex-1 flex-col gap-1 rounded-lg border border-solid border-default bg-surface-secondary px-3 py-4"><div>Cached input</div><div class="text-2xl font-semibold">$0.075</div></div><div class="flex flex-1 flex-col gap-1 rounded-lg border border-solid border-default bg-surface-secondary px-3 py-4"><div>Output</div><div class="text-2xl font-semibold">$4.50</div></div></div>
"""

OPENAI_41_NANO_HTML = """
<div>Text tokens</div>
<div class="flex flex-row"><div class="flex flex-1 flex-col gap-1 rounded-lg border border-solid border-default bg-surface-secondary px-3 py-4"><div>Input</div><div class="text-2xl font-semibold">$0.10</div></div><div class="flex flex-1 flex-col gap-1 rounded-lg border border-solid border-default bg-surface-secondary px-3 py-4"><div>Cached input</div><div class="text-2xl font-semibold">$0.025</div></div><div class="flex flex-1 flex-col gap-1 rounded-lg border border-solid border-default bg-surface-secondary px-3 py-4"><div>Output</div><div class="text-2xl font-semibold">$0.40</div></div></div>
"""


def test_research_anthropic_matches_snapshot_alias():
    service = AiPricingResearchService(fetcher=lambda _url: ANTHROPIC_HTML)

    payload = service.research(
        provider="anthropic",
        model="claude-sonnet-4-5-20250929",
        mode="realtime",
    )

    suggestion = payload["suggestions"][0]
    assert suggestion["model"] == "claude-sonnet-4-5-20250929"
    assert suggestion["matched_model"] == "claude-sonnet-4.5"
    assert suggestion["input_cost_per_million"] == 3.0
    assert suggestion["cached_input_cost_per_million"] == 0.3
    assert suggestion["output_cost_per_million"] == 15.0


def test_research_google_uses_first_paid_tier_for_catalog_shape():
    service = AiPricingResearchService(fetcher=lambda _url: GOOGLE_HTML)

    payload = service.research(
        provider="google",
        model="gemini-2.5-pro",
        mode="openai_batch",
    )

    suggestion = payload["suggestions"][0]
    assert suggestion["input_cost_per_million"] == 0.625
    assert suggestion["output_cost_per_million"] == 5.0
    assert suggestion["cached_input_cost_per_million"] == 0.125
    assert suggestion["source_note_code"] == "tiered_prompt_rate_first_tier"


def test_research_openai_infers_batch_discount_from_official_guidance():
    service = AiPricingResearchService(fetcher=lambda _url: OPENAI_HTML)

    payload = service.research(
        provider="openai",
        model="gpt-5.4-mini-2026-03-17",
        mode="openai_batch",
    )

    suggestion = payload["suggestions"][0]
    assert suggestion["matched_model"] == "gpt-5.4-mini"
    assert suggestion["source_note_code"] == "openai_batch_discount"
    assert suggestion["input_cost_per_million"] == pytest.approx(0.375)
    assert suggestion["output_cost_per_million"] == pytest.approx(2.25)
    assert suggestion["cached_input_cost_per_million"] == pytest.approx(0.0375)


def test_research_openai_uses_gpt_5_nano_model_page_without_upgrading_to_54():
    service = AiPricingResearchService(fetcher=lambda _url: OPENAI_HTML)

    payload = service.research(
        provider="openai",
        model="gpt-5-nano",
        mode="realtime",
    )

    suggestion = payload["suggestions"][0]
    assert suggestion["model"] == "gpt-5-nano"
    assert suggestion["matched_model"] == "gpt-5-nano"
    assert suggestion["source_url"].endswith("/gpt-5-nano")
    assert suggestion["input_cost_per_million"] == pytest.approx(0.75)
    assert suggestion["output_cost_per_million"] == pytest.approx(4.50)


def test_research_openai_supports_gpt_4_1_nano_model_page():
    service = AiPricingResearchService(fetcher=lambda _url: OPENAI_41_NANO_HTML)

    payload = service.research(
        provider="openai",
        model="gpt-4.1-nano",
        mode="realtime",
    )

    suggestion = payload["suggestions"][0]
    assert suggestion["model"] == "gpt-4.1-nano"
    assert suggestion["matched_model"] == "gpt-4.1-nano"
    assert suggestion["source_url"].endswith("/gpt-4.1-nano")
    assert suggestion["input_cost_per_million"] == pytest.approx(0.10)
    assert suggestion["cached_input_cost_per_million"] == pytest.approx(0.025)
    assert suggestion["output_cost_per_million"] == pytest.approx(0.40)
