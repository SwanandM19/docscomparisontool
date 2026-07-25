// [ADMIN-APPROVAL] This entire file is part of the admin-approval feature.
// Delete it, its sidebar nav entry, and its case in app/dashboard/page.tsx
// to retire the feature.
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { UserCheck, UserX, Loader2, AlertTriangle, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getPendingUsers,
  approveUser,
  rejectUser,
  ApiClientError,
  type PendingUserDto,
} from "@/lib/api-client";

export default function UserApprovals() {
  const [pending, setPending] = useState<PendingUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPendingUsers();
      setPending(result.pending);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load pending users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    setActingOn(id);
    try {
      await approveUser(id);
      setPending((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to approve user.");
    } finally {
      setActingOn(null);
    }
  };

  const handleReject = async (id: string) => {
    setActingOn(id);
    try {
      await rejectUser(id);
      setPending((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to reject user.");
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="stagger-children space-y-6">
      <div className="flex items-start justify-between mb-2 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Approvals</h2>
          <p className="text-muted-foreground mt-1">
            New accounts must be approved here before they can sign in
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="text-xs gap-1.5">
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 text-brand animate-spin" />
            <p className="text-sm text-muted-foreground">Loading pending users…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ShieldCheck className="w-6 h-6 text-success" />
            <p className="text-sm text-muted-foreground">No accounts waiting for approval.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {pending.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{u.name}</p>
                    <Badge variant="secondary" className="text-[10px] font-bold capitalize">
                      {u.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Requested {new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    disabled={actingOn === u.id}
                    onClick={() => handleApprove(u.id)}
                    className="text-xs gap-1.5 bg-success hover:bg-success/90 text-white"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingOn === u.id}
                    onClick={() => handleReject(u.id)}
                    className="text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <UserX className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
