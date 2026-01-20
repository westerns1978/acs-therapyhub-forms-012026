import React from 'react';

const LoadingSpinner: React.FC = () => {
    return (
        <div className="flex justify-center items-center p-8">
            <div className="relative inline-flex">
                <div className="w-8 h-8 bg-primary rounded-full"></div>
                <div className="w-8 h-8 bg-primary rounded-full absolute top-0 left-0 animate-ping"></div>
                <div className="w-8 h-8 bg-primary rounded-full absolute top-0 left-0 animate-pulse"></div>
            </div>
        </div>
    );
};

export default LoadingSpinner;
