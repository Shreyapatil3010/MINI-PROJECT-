"""
Chart generation service using Matplotlib and Plotly.
Saves charts to disk and returns metadata.
"""
import uuid
import logging
from pathlib import Path
from typing import List, Dict, Optional, Any

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

from models.schemas import FinancialMetric, ChartData

logger = logging.getLogger(__name__)

CHART_COLORS = [
    "#2563EB",  # blue
    "#16A34A",  # green
    "#DC2626",  # red
    "#D97706",  # amber
    "#7C3AED",  # violet
    "#0891B2",  # cyan
]


def _apply_style(ax: plt.Axes, title: str, xlabel: str, ylabel: str) -> None:
    ax.set_title(title, fontsize=14, fontweight="bold", pad=15)
    ax.set_xlabel(xlabel, fontsize=11)
    ax.set_ylabel(ylabel, fontsize=11)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:,.0f}"))
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    plt.tight_layout()


def _save_chart(fig: plt.Figure, charts_dir: Path) -> str:
    """Save the figure to disk and return the chart_id."""
    chart_id = str(uuid.uuid4())
    path = charts_dir / f"{chart_id}.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    logger.info("Chart saved: %s", path)
    return chart_id


class ChartGenerator:
    def __init__(self, charts_dir: str = "./charts"):
        self.charts_dir = Path(charts_dir)
        self.charts_dir.mkdir(parents=True, exist_ok=True)

    def _chart_url(self, chart_id: str) -> str:
        return f"/charts/{chart_id}.png"

    # ── Public chart methods ──────────────────────────────────────────────────

    def line_chart(
        self,
        metric: FinancialMetric,
        title: Optional[str] = None,
    ) -> ChartData:
        """Line chart for a single metric over multiple years."""
        sorted_years = sorted(metric.values.keys())
        values = [metric.values[y] for y in sorted_years]

        fig, ax = plt.subplots(figsize=(9, 5))
        ax.plot(sorted_years, values, marker="o", linewidth=2.5, color=CHART_COLORS[0])
        ax.fill_between(sorted_years, values, alpha=0.1, color=CHART_COLORS[0])

        # Annotate each point
        for yr, val in zip(sorted_years, values):
            ax.annotate(
                f"{val:,.1f}",
                (yr, val),
                textcoords="offset points",
                xytext=(0, 8),
                ha="center",
                fontsize=9,
            )

        chart_title = title or f"{metric.name} Over Time"
        unit_label = f" ({metric.unit})" if metric.unit else ""
        _apply_style(ax, chart_title, "Year", f"{metric.name}{unit_label}")

        chart_id = _save_chart(fig, self.charts_dir)
        return ChartData(
            chart_id=chart_id,
            chart_type="line",
            title=chart_title,
            url=self._chart_url(chart_id),
        )

    def bar_chart(
        self,
        metric: FinancialMetric,
        title: Optional[str] = None,
        compare_metric: Optional[FinancialMetric] = None,
    ) -> ChartData:
        """Bar chart, optionally with a second metric side-by-side."""
        sorted_years = sorted(metric.values.keys())
        values = [metric.values[y] for y in sorted_years]

        fig, ax = plt.subplots(figsize=(9, 5))
        x = np.arange(len(sorted_years))
        width = 0.35 if compare_metric else 0.55

        bars = ax.bar(x - (width / 2 if compare_metric else 0), values, width, label=metric.name, color=CHART_COLORS[0])

        if compare_metric:
            sorted_years2 = sorted(compare_metric.values.keys())
            values2 = [compare_metric.values.get(y, 0) for y in sorted_years]
            ax.bar(x + width / 2, values2, width, label=compare_metric.name, color=CHART_COLORS[1])
            ax.legend()

        ax.set_xticks(x)
        ax.set_xticklabels(sorted_years, rotation=45 if len(sorted_years) > 5 else 0)

        chart_title = title or f"{metric.name} by Year"
        unit_label = f" ({metric.unit})" if metric.unit else ""
        _apply_style(ax, chart_title, "Year", f"Value{unit_label}")

        chart_id = _save_chart(fig, self.charts_dir)
        return ChartData(
            chart_id=chart_id,
            chart_type="bar",
            title=chart_title,
            url=self._chart_url(chart_id),
        )

    def growth_rate_chart(self, metric: FinancialMetric) -> Optional[ChartData]:
        """Bar chart showing year-over-year growth rates."""
        if not metric.change_pct:
            return None

        years = sorted(metric.change_pct.keys())
        changes = [metric.change_pct[y] for y in years]
        colors = [CHART_COLORS[1] if c >= 0 else CHART_COLORS[2] for c in changes]

        fig, ax = plt.subplots(figsize=(9, 5))
        ax.bar(years, changes, color=colors, width=0.5)
        ax.axhline(0, color="black", linewidth=0.8, linestyle="--")

        for yr, chg in zip(years, changes):
            ax.annotate(
                f"{chg:.1f}%",
                (yr, chg),
                textcoords="offset points",
                xytext=(0, 5 if chg >= 0 else -12),
                ha="center",
                fontsize=9,
            )

        title = f"{metric.name} — Year-over-Year Growth (%)"
        _apply_style(ax, title, "Year", "Growth (%)")
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.0f}%"))

        chart_id = _save_chart(fig, self.charts_dir)
        return ChartData(
            chart_id=chart_id,
            chart_type="bar",
            title=title,
            url=self._chart_url(chart_id),
        )

    def multi_metric_chart(
        self,
        metrics: List[FinancialMetric],
        title: str = "Financial Metrics Overview",
    ) -> ChartData:
        """Normalized line chart comparing multiple metrics on the same axes."""
        fig, ax = plt.subplots(figsize=(11, 6))

        for i, metric in enumerate(metrics[:6]):  # max 6 metrics
            sorted_years = sorted(metric.values.keys())
            values = [metric.values[y] for y in sorted_years]
            # Normalize to first year = 100 for comparison
            if values[0] and values[0] != 0:
                norm_values = [v / values[0] * 100 for v in values]
            else:
                norm_values = values
            color = CHART_COLORS[i % len(CHART_COLORS)]
            ax.plot(sorted_years, norm_values, marker="o", linewidth=2, label=metric.name, color=color)

        ax.axhline(100, color="gray", linestyle="--", linewidth=0.8, alpha=0.6)
        ax.legend(loc="best", fontsize=9)
        _apply_style(ax, title, "Year", "Indexed Value (Base = 100)")
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.0f}"))

        chart_id = _save_chart(fig, self.charts_dir)
        return ChartData(
            chart_id=chart_id,
            chart_type="line",
            title=title,
            url=self._chart_url(chart_id),
        )

    def comparison_bar_chart(
        self,
        diffs: List[Dict[str, Any]],
        doc_a_name: str,
        doc_b_name: str,
    ) -> ChartData:
        """Side-by-side bar chart for document comparison."""
        # Pick up to 6 metrics with numeric data
        selected = []
        for d in diffs:
            key_a = f"{doc_a_name}_values"
            key_b = f"{doc_b_name}_values"
            if key_a in d and key_b in d:
                selected.append(d)
            if len(selected) >= 6:
                break

        if not selected:
            selected = diffs[:6]

        metric_names = [d["metric"] for d in selected]
        key_a = f"{doc_a_name}_values"
        key_b = f"{doc_b_name}_values"

        # Use the last (most recent) year value from each
        def last_val(d: Dict, key: str) -> float:
            vals = d.get(key, {})
            if not vals:
                return 0.0
            return list(vals.values())[-1]

        vals_a = [last_val(d, key_a) for d in selected]
        vals_b = [last_val(d, key_b) for d in selected]

        x = np.arange(len(metric_names))
        width = 0.35
        fig, ax = plt.subplots(figsize=(11, 6))
        ax.bar(x - width / 2, vals_a, width, label=doc_a_name, color=CHART_COLORS[0])
        ax.bar(x + width / 2, vals_b, width, label=doc_b_name, color=CHART_COLORS[1])
        ax.set_xticks(x)
        ax.set_xticklabels(metric_names, rotation=30, ha="right")
        ax.legend()

        title = f"Document Comparison: {doc_a_name} vs {doc_b_name}"
        _apply_style(ax, title, "Metric", "Value")

        chart_id = _save_chart(fig, self.charts_dir)
        return ChartData(
            chart_id=chart_id,
            chart_type="bar",
            title=title,
            url=self._chart_url(chart_id),
        )
