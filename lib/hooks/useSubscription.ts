"use client";

import { useState, useEffect, useCallback } from "react";

interface SubscriptionStatus {
  has_access: boolean;
  is_trial_active: boolean;
  is_subscription_active: boolean;
  days_left: number;
  trial_ends_at: number;
  subscription?: {
    status: string;
    plan: string;
    amount: number;
  };
}

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      // El token se guarda en cookie "authToken"
      const cookies = document.cookie.split(';');
      const authCookie = cookies.find(c => c.trim().startsWith('authToken='));
      const token = authCookie ? authCookie.split('=')[1]?.trim() : null;

      if (!token) { setLoading(false); return; }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
      const res = await fetch(`${apiUrl}/payments/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Error fetching subscription status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, refetch: fetchStatus };
}
