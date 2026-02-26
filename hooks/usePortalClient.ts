import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function usePortalClient() {
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('portal_client');
    if (!saved) {
      navigate('/portal/login');
      return;
    }
    try {
      setClient(JSON.parse(saved));
    } catch {
      navigate('/portal/login');
    }
  }, [navigate]);

  return client;
}
