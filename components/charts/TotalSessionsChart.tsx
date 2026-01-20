import React from 'react';

const TotalSessionsChart: React.FC = () => {
    const data = [
        { label: 'Jan', value: 30 }, { label: 'Feb', value: 50 }, { label: 'Mar', value: 70 },
        { label: 'Apr', value: 45 }, { label: 'May', value: 60 }, { label: 'Jun', value: 80 }
    ];
    const maxValue = 100;

    return (
        <div>
            <p className="text-sm font-medium text-surface-secondary dark:text-dark-surface-secondary mb-2">Total Sessions per Client (Avg)</p>
            <div className="flex items-end h-40 gap-3">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="relative w-full h-full flex items-end">
                            <div className="w-full bg-primary/10 dark:bg-dark-primary/20 rounded-t-md group-hover:bg-primary/20 transition-colors" style={{ height: `${(item.value / maxValue) * 100}%` }}></div>
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold bg-surface dark:bg-dark-surface px-1.5 py-0.5 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">{item.value}</div>
                        </div>
                        <span className="text-xs font-bold text-surface-secondary dark:text-dark-surface-secondary">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default TotalSessionsChart;