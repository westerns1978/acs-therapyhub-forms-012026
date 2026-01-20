
import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const PageLoader: React.FC = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-background dark:bg-dark-background">
    <LoadingSpinner />
  </div>
);

export default PageLoader;
