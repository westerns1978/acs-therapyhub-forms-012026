
import React from 'react';
import { RevenueDataPoint } from '../../types';

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.revenue));
  const chartHeight = 350;
  const barWidth = 40;
  const barMargin = 20;
  const totalWidth = data.length * (barWidth + barMargin);

  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#6366F1'];

  return (
    <div className="w-full h-full p-4">
      <svg width="100%" height="100%" viewBox={`0 0 ${totalWidth} ${chartHeight}`}>
        {data.map((item, index) => {
          const barHeight = (item.revenue / maxValue) * (chartHeight - 40);
          const x = index * (barWidth + barMargin);
          const y = chartHeight - barHeight - 20;
          return (
            <g key={item.name}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={colors[index % colors.length]}
                rx="4"
              />
              <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="12" fill="currentColor">
                ${(item.revenue / 1000).toFixed(1)}k
              </text>
              <text x={x + barWidth / 2} y={chartHeight} textAnchor="middle" fontSize="12" fill="currentColor">
                {item.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default RevenueChart;
