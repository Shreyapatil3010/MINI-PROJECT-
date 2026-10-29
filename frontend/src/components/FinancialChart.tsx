import React from "react";
import { ChartData, getChartUrl } from "../services/api";
import { BarChart2, TrendingUp, PieChart } from "lucide-react";

interface Props {
  charts: ChartData[];
}

const ChartTypeIcon = ({ type }: { type: string }) => {
  if (type === "line") return <TrendingUp className="h-4 w-4" />;
  if (type === "pie") return <PieChart className="h-4 w-4" />;
  return <BarChart2 className="h-4 w-4" />;
};

export const FinancialChart: React.FC<Props> = ({ charts }) => {
  if (!charts || charts.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Generated Charts
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((chart, i) => (
          <div
            key={chart.chart_id}
            className="chart-enter card overflow-hidden p-0"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <ChartTypeIcon type={chart.chart_type} />
              <span className="text-sm font-medium text-gray-700 truncate">{chart.title}</span>
            </div>
            <div className="p-3">
              <img
                src={getChartUrl(chart.url)}
                alt={chart.title}
                className="w-full rounded-lg object-contain"
                style={{ maxHeight: 280 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
