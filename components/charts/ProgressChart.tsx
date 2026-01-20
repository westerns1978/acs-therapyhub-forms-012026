import React, { useState, useEffect } from 'react';
// Fix: Correctly import getProgressData from the services API.
import { getProgressData } from '../../services/api';
import { ProgressData } from '../../types';

const ProgressChart: React.FC = () => {
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const data = await getProgressData();
      setProgressData(data);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  if (isLoading) {
    return <div>Loading progress...</div>;
  }

  return (
    <div className="overflow-x-auto max-h-96">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-surface sticky top-0">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Month</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Score</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase tracking-wider">Notes</th>
          </tr>
        </thead>
        <tbody className="bg-background divide-y divide-border">
          {progressData.slice().reverse().map(data => (
            <tr key={data.month}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface">{data.month}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-secondary">{data.score}/10</td>
              <td className="px-6 py-4 text-sm text-on-surface-secondary">{data.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProgressChart;