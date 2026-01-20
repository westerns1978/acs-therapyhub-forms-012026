
import React from 'react';
import { ComplianceDataPoint } from '../../types';

interface ComplianceTrendChartProps {
  data: ComplianceDataPoint[];
}

const ComplianceTrendChart: React.FC<ComplianceTrendChartProps> = ({ data }) => {
  const chartHeight = 350;
  const chartWidth = 500;
  const padding = 40;

  const minScore = 80;
  const maxScore = 100;

  const getX = (index: number) => padding + (index / (data.length - 1)) * (chartWidth - 2 * padding);
  const getY = (score: number) => chartHeight - padding - ((score - minScore) / (maxScore - minScore)) * (chartHeight - 2 * padding);

  const linePath = data.map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point.score)}`).join(' ');

  return (
    <div className="w-full h-full p-4">
      <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Y-axis labels */}
        {[80, 85, 90, 95, 100].map(score => (
          <g key={score}>
            <text x={padding - 10} y={getY(score) + 4} textAnchor="end" fontSize="12" fill="currentColor">{score}%</text>
            <line x1={padding} x2={chartWidth - padding} y1={getY(score)} y2={getY(score)} stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
          </g>
        ))}
        {/* X-axis labels */}
        {data.map((point, index) => (
          <text key={point.month} x={getX(index)} y={chartHeight - padding + 20} textAnchor="middle" fontSize="12" fill="currentColor">{point.month}</text>
        ))}
        
        {/* Gradient */}
        <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.8}/>
            </linearGradient>
        </defs>

        {/* Line */}
        <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" />
        
        {/* Points */}
        {data.map((point, index) => (
           <circle key={index} cx={getX(index)} cy={getY(point.score)} r="4" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
};

export default ComplianceTrendChart;
