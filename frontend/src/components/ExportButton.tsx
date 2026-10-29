import React, { useState, useRef } from "react";
import { Download, Loader } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useTranslation } from "react-i18next";

interface Props {
  contentRef: React.RefObject<HTMLDivElement | null>;
  filename?: string;
}

export const ExportButton: React.FC<Props> = ({ contentRef, filename = "financial-analysis" }) => {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width / 2, canvas.height / 2],
      });

      // Header
      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), 30, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Financial Document Analyst — Analysis Report", 12, 20);

      // Date
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pdf.internal.pageSize.getWidth() - 12, 20, { align: "right" });

      // Content image
      pdf.addImage(imgData, "PNG", 0, 35, canvas.width / 2, canvas.height / 2 - 35);

      // Footer
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.setDrawColor(200, 200, 200);
      pdf.line(0, pageH - 18, pdf.internal.pageSize.getWidth(), pageH - 18);
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(8);
      pdf.text("Powered by Financial Document Analyst AI", 12, pageH - 6);

      pdf.save(`${filename}-${Date.now()}.pdf`);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-md"
      title="Export analysis as PDF"
    >
      {exporting ? (
        <Loader className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {exporting ? t("exporting") : t("exportPDF")}
    </button>
  );
};
