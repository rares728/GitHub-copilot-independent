import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';

export function useUserOptions() {
  const [userOptions, setUserOptions] = useState([]);

  useEffect(() => {
    apiClient.functions.invoke('getUsers', {}).then(res => {
      const users = (res.data?.users || [])
        .filter(u => u.value != null && u.value !== '')
        .sort((a, b) => (a.label || a.value || '').localeCompare(b.label || b.value || ''));
      setUserOptions(users);
    }).catch(() => {});
  }, []);

  return userOptions;
}