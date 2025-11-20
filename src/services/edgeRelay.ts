import { supabase } from "@/integrations/supabase/client";

/**
 * Generic relay service to send any payload to the edge function
 * which then stores it in Neon via Supabase
 */
export async function relayToEdge(payload: any) {
  try {
    const { data, error } = await supabase.functions.invoke('genericRelay', {
      body: payload,
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Edge relay error:', error);
    throw error;
  }
}
