import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function useToastNotification() {
  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    switch (type) {
      case 'success': toast.success(message); break;
      case 'error': toast.error(message); break;
      case 'info': toast.info(message); break;
      case 'warning': toast.warning(message); break;
    }
  }, []);

  return { notify };
}
