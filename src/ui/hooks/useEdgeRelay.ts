import { useState } from 'react';
import { relayToEdge } from '@/services/edgeRelay';

/**
 * Generic hook for sending data to the edge function relay
 * Returns a send function and loading/error states
 */
export function useEdgeRelay() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function send(data: any) {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await relayToEdge(data);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return { send, isLoading, error };
}
