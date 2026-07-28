import { useEffect, useState } from 'react';
import { showDemoRows, subscribeDemoVisibility, setShowDemoRows } from '../config/demoData';

/**
 * React view of the per-user "Show demo data" setting (config/demoData.ts).
 * Used by the Settings toggle and the GlobalHeader badge so both always agree
 * with what the query layer is actually doing — one store, no second source.
 */
export const useDemoVisibility = (): { showDemo: boolean; setShowDemo: (on: boolean) => void } => {
  const [showDemo, setLocal] = useState<boolean>(showDemoRows);

  useEffect(() => subscribeDemoVisibility(() => setLocal(showDemoRows())), []);

  return { showDemo, setShowDemo: setShowDemoRows };
};
