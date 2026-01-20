import React, { useMemo, useState } from 'react';
import { Client } from '../../types';

interface CaseloadChartProps {
    clients: Client[];
}

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
};

const TrendIndicator: React.FC<{ value: number }> = ({ value }) => {
    const isPositive = value >= 0;
    return (
        <span className={`text-xs font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{value}%
        </span>
    );
};

const CaseloadChart: React.FC<CaseloadChartProps> = ({ clients }) => {
    const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
    
    const data = useMemo(() => {
        const counts = clients.reduce((acc, client) => {
            if (client.status === 'Compliant' || client.status === 'Non-Compliant') {
                acc['Active'] = (acc['Active'] || 0) + 1;
            } else if (client.status === 'Warrant Issued') {
                acc['On Hold'] = (acc['On Hold'] || 0) + 1;
            } else if (client.status === 'Completed' || client.status === 'Archived') {
                acc['Inactive'] = (acc['Inactive'] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        
        return [
            { name: 'Active', value: counts['Active'] || 0, color: 'text-primary dark:text-dark-primary', trend: 0 },
            { name: 'On Hold', value: counts['On Hold'] || 0, color: 'text-yellow-500 dark:text-yellow-400', trend: 0 },
            { name: 'Inactive', value: counts['Inactive'] || 0, color: 'text-surface-secondary dark:text-dark-surface-secondary', trend: -2 },
        ];
    }, [clients]);

    const total = data.reduce((sum, item) => sum + item.value, 0);

    let cumulativeAngle = 0;
    const segments = data.map(item => {
        const angle = total > 0 ? (item.value / total) * 360 : 0;
        const segmentData = {
            ...item,
            path: describeArc(70, 70, 60, cumulativeAngle, cumulativeAngle + angle - 2), // -2 for spacing
            startAngle: cumulativeAngle,
            endAngle: cumulativeAngle + angle,
        };
        cumulativeAngle += angle;
        return segmentData;
    });

    return (
        <div className="flex flex-col sm:flex-row items-center justify-around p-6 gap-6">
            <div className="relative w-40 h-40">
                <svg className="w-full h-full" viewBox="0 0 140 140">
                   <g>
                        {segments.map((segment, index) => (
                            <path
                                key={segment.name}
                                d={segment.path}
                                className={`${segment.color} transition-all duration-300 ease-in-out`}
                                stroke="currentColor"
                                strokeWidth={hoveredSegment === segment.name ? "10" : "8"}
                                strokeLinecap="round"
                                fill="transparent"
                                onMouseEnter={() => setHoveredSegment(segment.name)}
                                onMouseLeave={() => setHoveredSegment(null)}
                            >
                                <title>{`${segment.name}: ${segment.value} (${total > 0 ? ((segment.value/total)*100).toFixed(0) : 0}%)`}</title>
                            </path>
                        ))}
                   </g>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-surface-content dark:text-dark-surface-content">{total}</span>
                    <span className="text-sm text-surface-secondary dark:text-dark-surface-secondary">Clients</span>
                </div>
            </div>
            <div className="space-y-3 text-sm w-full sm:w-auto">
                {data.map(item => (
                    <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center">
                            <span className={`w-3 h-3 rounded-full mr-2 ${item.color.replace('text-', 'bg-')}`}></span>
                            <span className="font-semibold text-surface-secondary dark:text-dark-surface-secondary">{item.name} ({total > 0 ? ((item.value/total)*100).toFixed(0) : 0}%)</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <TrendIndicator value={item.trend} />
                           <span className="font-bold text-surface-content dark:text-dark-surface-content w-4 text-right">
                                {item.value}
                           </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CaseloadChart;