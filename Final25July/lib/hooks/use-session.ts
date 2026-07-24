"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, logout as logoutRequest, ApiClientError } from "@/lib/api-client";
import type { UserRecord } from "@/types/user";

export function useSession() {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getCurrentUser();
      setUser(data);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await logoutRequest().catch(() => void 0);
    setUser(null);
    window.location.href = "/login";
  }, []);

  return { user, loading, refresh, signOut };
}
