"use client";

import React, { useEffect, useState } from "react";
import {
  User,
  AlertCircle,
  Shield,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/hooks/use-session";
import { updateProfile, changePassword, ApiClientError } from "@/lib/api-client";
import { isPasswordValid, passwordRequirements } from "@/lib/validators";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserProfile() {
  const { user, loading, refresh } = useSession();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone ?? "");
    setOrganization(user.organization ?? "");
  }, [user]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        organization: organization.trim() || null,
      });
      await refresh();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      setProfileError(err instanceof ApiClientError ? err.message : "Failed to save changes.");
    } finally {
      setSavingProfile(false);
    }
  };

  const newPasswordRequirements = passwordRequirements(newPassword);

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSaved(false);

    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }
    if (!isPasswordValid(newPassword)) {
      setPasswordError("New password doesn't meet the requirements below.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err) {
      setPasswordError(err instanceof ApiClientError ? err.message : "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const initials = initialsFromName(user.name);

  return (
    <div className="stagger-children space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Profile & Account</h2>
        <p className="text-muted-foreground mt-1">
          Manage your personal information and security credentials
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT CARD: User Overview Quick Card */}
        <div className="lg:col-span-4">
          <Card className="border-border/80 shadow-sm text-center">
            <CardContent className="p-6 space-y-4">
              <div className="mx-auto w-24 h-24 rounded-full bg-brand/10 border-4 border-brand/20 flex items-center justify-center text-brand text-xl font-bold">
                {initials}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{user.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                <div className="flex justify-center gap-1.5 mt-3">
                  <Badge variant="secondary" className="bg-brand/10 text-brand border-0 text-[10px] font-bold px-2 py-0.5 capitalize">
                    {user.role}
                  </Badge>
                </div>
              </div>

              <div className="h-px bg-border/40 my-2" />

              <div className="space-y-2 text-left text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department:</span>
                  <span className="font-medium text-foreground">{user.department || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Organization:</span>
                  <span className="font-medium text-foreground">{user.organization || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Joined:</span>
                  <span className="font-medium text-foreground">
                    {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT TABS: Detailed Account Panels */}
        <div className="lg:col-span-8">
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-0">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-secondary/20 p-0 h-12">
                  <TabsTrigger value="details" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent px-6 font-semibold text-xs">
                    <User className="w-3.5 h-3.5 mr-2" /> Personal Information
                  </TabsTrigger>
                  <TabsTrigger value="security" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent px-6 font-semibold text-xs">
                    <Shield className="w-3.5 h-3.5 mr-2" /> Security
                  </TabsTrigger>
                </TabsList>

                {/* Personal Information Tab */}
                <TabsContent value="details" className="p-6 space-y-4 focus:outline-none">
                  <h3 className="text-sm font-bold text-foreground">Account Information</h3>
                  {profileError && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{profileError}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/40 h-9" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                      <Input value={user.email} disabled className="bg-secondary/20 h-9 text-muted-foreground cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="bg-secondary/40 h-9" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">Organization</label>
                      <Input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Your company" className="bg-secondary/40 h-9" />
                    </div>
                  </div>
                  <div className="pt-2 flex items-center justify-end gap-3">
                    {profileSaved && (
                      <span className="text-xs text-success font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                    <Button
                      onClick={handleSaveProfile}
                      disabled={savingProfile || !name.trim()}
                      className="bg-brand hover:bg-brand/90 text-brand-foreground text-xs font-semibold px-4 h-9 gap-1.5"
                    >
                      {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save Profile Changes
                    </Button>
                  </div>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="p-6 space-y-4 focus:outline-none">
                  <h3 className="text-sm font-bold text-foreground">Password Update</h3>
                  {passwordError && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{passwordError}</span>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Current Password</label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="bg-secondary/40 h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">New Password</label>
                        <Input
                          type="password"
                          placeholder="At least 8 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-secondary/40 h-9"
                        />
                        {newPassword.length > 0 && (
                          <ul className="space-y-0.5 pt-0.5">
                            {newPasswordRequirements.map((req) => (
                              <li key={req.key} className="flex items-center gap-1.5 text-[11px]">
                                {req.met ? (
                                  <Check className="w-3 h-3 text-success shrink-0" />
                                ) : (
                                  <X className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                )}
                                <span className={req.met ? "text-muted-foreground" : "text-muted-foreground/60"}>
                                  {req.label}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Confirm Password</label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-secondary/40 h-9"
                        />
                      </div>
                    </div>
                    <div className="pt-2 flex items-center justify-end gap-3">
                      {passwordSaved && (
                        <span className="text-xs text-success font-medium flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Updated
                        </span>
                      )}
                      <Button
                        onClick={handleChangePassword}
                        disabled={
                          savingPassword ||
                          !currentPassword ||
                          !isPasswordValid(newPassword) ||
                          newPassword !== confirmPassword
                        }
                        className="bg-brand hover:bg-brand/90 text-brand-foreground text-xs font-semibold px-4 h-9 gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Update Password
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
