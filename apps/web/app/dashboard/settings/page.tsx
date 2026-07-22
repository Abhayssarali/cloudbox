"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Loader2, Key, Settings, Lock, CheckCircle2, User, HardDrive } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TotpSetupData = {
  otpauthUrl: string;
  qrDataUrl: string;
  secret: string;
};

export default function SettingsPage() {
  const user = useAuthStore((s: any) => s.user);
  const queryClient = useQueryClient();

  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [password, setPassword] = useState("");

  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.user as { email: string; role: string; totpEnabled?: boolean };
    },
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/auth/totp/setup`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as TotpSetupData;
    },
    onSuccess: (data) => {
      setSetupData(data);
      setTotpCode("");
    },
    onError: (err: Error) => { alert(err.message); },
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`${API_URL}/auth/totp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      setSetupData(null);
      alert("Two-Factor Authentication successfully enabled.");
    },
    onError: (err: Error) => { alert(`Verification failed: ${err.message}`); },
  });

  const disableMutation = useMutation({
    mutationFn: async (pass: string) => {
      const res = await fetch(`${API_URL}/auth/totp/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: pass }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      setPassword("");
      alert("Two-Factor Authentication has been disabled.");
    },
    onError: (err: Error) => { alert(`Failed to disable: ${err.message}`); },
  });

  const isTotpEnabled = userData?.totpEnabled ?? false;
  const username = user?.email?.split("@")[0] ?? "User";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header Banner */}
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Account &amp; Security Settings</h2>
            <p className="text-xs text-slate-400">Manage security credentials and account parameters</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">

        {/* Profile Card */}
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            Account Overview
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-1">
              <span className="text-slate-500">Email Address</span>
              <p className="font-semibold text-white truncate">{user?.email}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-1">
              <span className="text-slate-500">Account Role</span>
              <p className="font-semibold text-indigo-400">{user?.role || "USER"}</p>
            </div>
          </div>
        </div>

        {/* 2FA Security Section */}
        <div className="glass-card rounded-3xl p-6 space-y-6 border border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mt-0.5">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Two-Factor Authentication (2FA)</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-lg leading-relaxed">
                  Enhance your account protection by requesting a 6-digit TOTP code from Google Authenticator or Authy upon sign-in.
                </p>
              </div>
            </div>

            {!isLoadingUser && (
              <div>
                {isTotpEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
                    <ShieldCheck className="w-4 h-4" />
                    2FA Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-500/10 text-slate-400 text-xs font-semibold rounded-full border border-slate-500/20">
                    <ShieldAlert className="w-4 h-4" />
                    2FA Disabled
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            {isLoadingUser ? (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-4">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Checking 2FA status...
              </div>
            ) : isTotpEnabled ? (
              <div className="space-y-4 max-w-md">
                <p className="text-xs text-slate-300">Enter your current password to disable Two-Factor Authentication:</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      placeholder="Current account password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => disableMutation.mutate(password)}
                    disabled={disableMutation.isPending || !password}
                    className="px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-xl transition-all border border-rose-500/20 disabled:opacity-50 whitespace-nowrap"
                  >
                    {disableMutation.isPending ? "Disabling..." : "Disable 2FA"}
                  </button>
                </div>
              </div>
            ) : setupData ? (
              <div className="p-6 rounded-2xl bg-black/40 border border-white/[0.08] space-y-6">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Configure Authenticator App</h4>
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="bg-white p-3 rounded-2xl inline-block w-44 h-44 flex-shrink-0 shadow-xl">
                    <img src={setupData.qrDataUrl} alt="2FA QR Code" className="w-full h-full" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 1 — Scan QR Code</p>
                      <p className="text-xs text-slate-300">Scan using Google Authenticator or enter setup secret key:</p>
                      <code className="block mt-2 px-3.5 py-2.5 bg-[#0b0e14] text-indigo-300 text-xs font-mono rounded-xl border border-white/10 break-all select-all">
                        {setupData.secret}
                      </code>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2 — Verify Token Code</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="000000"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                          className="w-32 px-4 py-2.5 bg-[#0b0e14] border border-white/10 rounded-xl text-sm font-mono tracking-widest text-white text-center focus:border-indigo-500 focus:outline-none transition-colors"
                        />
                        <button
                          onClick={() => verifyMutation.mutate(totpCode)}
                          disabled={verifyMutation.isPending || totpCode.length !== 6}
                          className="btn-primary px-5 py-2.5 rounded-xl text-xs"
                        >
                          {verifyMutation.isPending ? "Verifying..." : "Verify & Enable"}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => setSetupData(null)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors pt-2"
                    >
                      Cancel setup
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="btn-primary px-5 py-2.5 rounded-xl text-xs"
              >
                {setupMutation.isPending ? "Starting Setup..." : "Enable Two-Factor Authentication"}
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
