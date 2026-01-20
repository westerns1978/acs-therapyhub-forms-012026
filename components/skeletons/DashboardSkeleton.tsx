import React from 'react';

const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`bg-gray-200 dark:bg-gray-700 rounded-xl ${className}`}></div>
);

const DashboardSkeleton: React.FC = () => {
    return (
        <div className="animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <SkeletonCard className="h-48" />
                    <SkeletonCard className="h-64" />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <SkeletonCard className="h-64" />
                    <SkeletonCard className="h-48" />
                </div>
            </div>
        </div>
    );
};

export default DashboardSkeleton;
