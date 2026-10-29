import React from "react";
import { FinancialMetric } from "../services/api";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  metrics: FinancialMetric[];
}

function formatValue(val: number, unit: string): string {
  const abs = Math.abs(val);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `${(val / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) formatted = `${(val / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) formatted = `${(val / 1_000).toFixed(1)}K`;
  else formatted = val.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

const TrendIcon = ({ change }: { change?: number }) => {
  if (change === undefined) return <Minus className="h-3.5 w-3.5 text-gray-400" />;
  if (change > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
  if (change < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
};

export const MetricsPanel: React.FC<Props> = ({ metrics }) => {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Financial Metrics
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {metrics.map((metric, idx) => {
          const sortedYears = Object.keys(metric.values).sort();
          const latestYear = sortedYears[sortedYears.length - 1];
          const latestValue = metric.values[latestYear];
          const latestChange = metric.change_pct?.[latestYear];

          return (
            <div
              key={metric.name}
              className="card py-3 fade-slide-up"
              style={{ animationDelay: `${idx * 0.07}s` }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{metric.name}</span>
                <div className="flex items-center gap-1">
                  <TrendIcon change={latestChange} />
                  {latestChange !== undefined && (
                    <span
                      className={`text-xs font-semibold ${
                        latestChange > 0
                          ? "text-green-600"
                          : latestChange < 0
                          ? "text-red-500"
                          : "text-gray-500"
                      }`}
                    >
                      {latestChange > 0 ? "+" : ""}{latestChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Mini sparkline using CSS */}
              <div className="flex items-end gap-1 h-10 mb-2">
                {sortedYears.map((year, barIdx) => {
                  const val = metric.values[year];
                  const allVals = Object.values(metric.values);
                  const minVal = Math.min(...allVals);
                  const maxVal = Math.max(...allVals);
                  const range = maxVal - minVal || 1;
                  const heightPct = ((val - minVal) / range) * 80 + 10; // 10-90%
                  const isLatest = year === latestYear;
                  return (
                    <div
                      key={year}
                      className="flex-1 flex flex-col items-center justify-end group relative"
                    >
                      <div
                        className={`metric-bar w-full rounded-t ${
                          isLatest ? "bg-blue-500" : "bg-blue-200 group-hover:bg-blue-300"
                        }`}
                        style={{
                          height: `${heightPct}%`,
                          animationDelay: `${barIdx * 0.07 + 0.2}s`,
                        }}
                        title={`${year}: ${formatValue(val, metric.unit)}`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Year labels + values */}
              <div className="flex gap-1">
                {sortedYears.map((year) => (
                  <div key={year} className="flex-1 text-center">
                    <p className="text-xs text-gray-400 truncate">{year}</p>
                    <p className="text-xs font-semibold text-gray-700 truncate">
                      {formatValue(metric.values[year], "")}
                    </p>
                  </div>
                ))}
              </div>

              {metric.unit && (
                <p className="text-xs text-gray-400 text-right mt-1">in {metric.unit}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
