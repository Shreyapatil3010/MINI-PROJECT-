"""
PDF export service — generates a formatted analysis report PDF.
"""
import io
import os
from datetime import datetime
from typing import List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, Image
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

PRIMARY   = HexColor("#2563EB")
SECONDARY = HexColor("#1E40AF")
SUCCESS   = HexColor("#16A34A")
LIGHT_BG  = HexColor("#EFF6FF")
GRAY      = HexColor("#6B7280")
DARK      = HexColor("#111827")


def generate_analysis_pdf(
    query: str,
    answer: str,
    document_names: List[str],
    citations: List[dict],
    metrics: List[dict],
    charts_dir: str,
    chart_files: Optional[List[str]] = None,
) -> bytes:
    """Generate a PDF report and return it as bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
        title="Financial Analysis Report",
        author="Financial Document Analyst AI",
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Header banner ──────────────────────────────────────────────────────
    header_data = [[
        Paragraph(
            '<font color="white" size="16"><b>Financial Document Analyst</b></font><br/>'
            '<font color="#93C5FD" size="9">AI-Powered Analysis Report</font>',
            ParagraphStyle("h", fontName="Helvetica-Bold")
        ),
        Paragraph(
            f'<font color="white" size="8">Generated<br/>{datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")}</font>',
            ParagraphStyle("hr", alignment=TA_RIGHT, fontName="Helvetica")
        ),
    ]]
    header_table = Table(header_data, colWidths=["70%", "30%"])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("TOPPADDING",    (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING",   (0, 0), (-1, -1), 16),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 16),
        ("ROUNDEDCORNERS", [6]),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.4*cm))

    # ── Document source chips ──────────────────────────────────────────────
    if document_names:
        chips = "  ".join(f"📄 {n}" for n in document_names)
        story.append(Paragraph(
            f'<font color="#2563EB" size="8"><b>Sources:</b> {chips}</font>',
            ParagraphStyle("src", fontName="Helvetica", backColor=LIGHT_BG,
                           borderPad=6, leading=14)
        ))
        story.append(Spacer(1, 0.3*cm))

    # ── Question ──────────────────────────────────────────────────────────
    story.append(Paragraph(
        f'<font color="#1E40AF" size="10"><b>Question</b></font>',
        styles["Normal"]
    ))
    story.append(Spacer(1, 0.1*cm))
    story.append(Paragraph(
        f'<font size="11" color="#111827">{query}</font>',
        ParagraphStyle("q", fontName="Helvetica-Bold", leading=16,
                       backColor=LIGHT_BG, borderPad=8)
    ))
    story.append(Spacer(1, 0.3*cm))

    # ── Answer ────────────────────────────────────────────────────────────
    story.append(Paragraph(
        '<font color="#1E40AF" size="10"><b>AI Analysis</b></font>',
        styles["Normal"]
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#DBEAFE")))
    story.append(Spacer(1, 0.15*cm))

    for line in answer.split("\n"):
        if line.strip():
            story.append(Paragraph(
                line.replace("•", "&#8226;"),
                ParagraphStyle("ans", fontName="Helvetica", fontSize=10,
                               leading=16, textColor=DARK)
            ))
            story.append(Spacer(1, 0.1*cm))

    story.append(Spacer(1, 0.3*cm))

    # ── Metrics table ─────────────────────────────────────────────────────
    if metrics:
        story.append(Paragraph(
            '<font color="#1E40AF" size="10"><b>Key Financial Metrics</b></font>',
            styles["Normal"]
        ))
        story.append(Spacer(1, 0.15*cm))

        # Build table rows
        all_years = sorted(set(
            yr for m in metrics for yr in m.get("values", {}).keys()
        ))
        header_row = ["Metric"] + all_years + ["Unit"]
        rows = [header_row]
        for m in metrics[:10]:
            row = [m.get("name", "")]
            for yr in all_years:
                val = m.get("values", {}).get(yr)
                row.append(f"{val:,.1f}" if val is not None else "-")
            row.append(m.get("unit", ""))
            rows.append(row)

        col_w = [4*cm] + [2*cm] * len(all_years) + [2*cm]
        t = Table(rows, colWidths=col_w)
        t.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR",    (0, 0), (-1, 0), white),
            ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, 0), 9),
            ("FONTSIZE",     (0, 1), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#F9FAFB"), white]),
            ("GRID",         (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
            ("ALIGN",        (1, 0), (-1, -1), "RIGHT"),
            ("TOPPADDING",   (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
            ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.3*cm))

    # ── Charts ────────────────────────────────────────────────────────────
    if chart_files:
        story.append(Paragraph(
            '<font color="#1E40AF" size="10"><b>Generated Charts</b></font>',
            styles["Normal"]
        ))
        story.append(Spacer(1, 0.15*cm))
        for chart_file in chart_files[:4]:
            chart_path = os.path.join(charts_dir, chart_file)
            if os.path.exists(chart_path):
                try:
                    img = Image(chart_path, width=14*cm, height=7*cm)
                    story.append(img)
                    story.append(Spacer(1, 0.2*cm))
                except Exception:
                    pass

    # ── Citations ─────────────────────────────────────────────────────────
    if citations:
        story.append(Spacer(1, 0.2*cm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB")))
        story.append(Spacer(1, 0.15*cm))
        story.append(Paragraph(
            '<font color="#6B7280" size="9"><b>Sources & Citations</b></font>',
            styles["Normal"]
        ))
        for c in citations[:10]:
            fname = c.get("filename", "")
            page  = c.get("page", 0)
            excerpt = c.get("excerpt", "")
            text = f'<font size="8" color="#6B7280">&#8226; {fname}'
            if page: text += f', page {page}'
            if excerpt: text += f' — <i>"{excerpt[:80]}..."</i>'
            text += '</font>'
            story.append(Paragraph(text, styles["Normal"]))

    # ── Footer ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB")))
    story.append(Paragraph(
        '<font size="7" color="#9CA3AF">Powered by Financial Document Analyst AI &nbsp;|&nbsp; '
        'This report is for informational purposes only.</font>',
        ParagraphStyle("ft", alignment=TA_CENTER, fontName="Helvetica")
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()
