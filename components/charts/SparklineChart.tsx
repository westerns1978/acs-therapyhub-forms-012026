import React from 'react';

interface SparklineChartProps {
    data: number[];
    className?: string;
}

const SparklineChart: React.FC<SparklineChartProps> = ({ data, className = '' }) => {
    if (!data || data.length < 2) {
        return null; // Cannot draw a line with less than 2 points
    }

    const width = 120;
    const height = 40;
    const padding = 2;

    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

    const points = data
        .map((d, i) => {
            const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((d - minVal) / range) * (height - padding * 2) - padding;
            return `${x},${y}`;
        })
        .join(' ');
    
    const lastPoint = points.split(' ').pop()?.split(',') || ['0', '0'];

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className={`w-full overflow-visible ${className}`}
            aria-label={`A line chart showing a trend from ${data[0]} to ${data[data.length - 1]}`}
            role="img"
        >
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
            <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2" fill="currentColor" />
        </svg>
    );
};

export default SparklineChart;
