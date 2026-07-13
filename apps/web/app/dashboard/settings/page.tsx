"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Loader2, Key } from "lucide-react";
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
      return data.data.user as { email: string; totpEnabled?: boolean };
    },
  });

  // Start TOTP Setup
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
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  // Verify and Enable TOTP
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
      alert("Two-Factor Authentication has been successfully enabled.");
    },
    onError: (err: Error) => {
      alert(`Verification failed: ${err.message}`);
    },
  });

  // Disable TOTP
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
    onError: (err: Error) => {
      alert(`Failed to disable: ${err.message}`);
    },
  });

  const isTotpEnabled = userData?.totpEnabled ?? false;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0c10] h-full overflow-y-auto p-8">
      <div className="max-w-3xl w-full mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

        {/* Security Section */}
        <section className="bg-[#12141a] border border-[#1f2229] rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-[#1f2229] flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Security</h2>
          </div>
          
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-md font-medium text-gray-200">Two-Factor Authentication (2FA)</h3>
                <p className="text-sm text-gray-400 mt-1 max-w-lg">
                  Protect your account by requiring a 6-digit code from your authenticator app (like Google Authenticator or Authy) when signing in.
                </p>
              </div>
              
              {!isLoadingUser && (
                <div>
                  {isTotpEnabled ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-500/10 text-gray-400 text-xs font-medium rounded-full border border-gray-500/20">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Disabled
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-[#1f2229]">
              {isLoadingUser ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading status...
                </div>
              ) : isTotpEnabled ? (
                <div className="space-y-4 max-w-sm">
                  <p className="text-sm text-gray-300">To disable 2FA, please enter your current password.</p>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="password"
                        placeholder="Current password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[#0b0c10] border border-[#1f2229] rounded-lg text-sm text-white focus:border-rose-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => disableMutation.mutate(password)}
                      disabled={disableMutation.isPending || !password}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-medium rounded-lg transition-colors border border-rose-500/20 disabled:opacity-50 whitespace-nowrap"
                    >
                      {disableMutation.isPending ? "Disabling..." : "Disable 2FA"}
                    </button>
                  </div>
                </div>
              ) : setupData ? (
                <div className="bg-[#0b0c10] p-6 rounded-xl border border-[#1f2229]">
                  <h4 className="text-sm font-medium text-white mb-4">Set up Authenticator App</h4>
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="bg-white p-2 rounded-lg inline-block w-40 h-40 shrink-0">
                      <img src={setupData.qrDataUrl} alt="QR Code" className="w-full h-full" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Step 1</div>
                        <p className="text-sm text-gray-300">Scan this QR code with your authenticator app, or enter this setup key manually:</p>
                        <code className="block mt-2 px-3 py-2 bg-[#12141a] text-indigo-300 text-sm font-mono rounded border border-[#1f2229] break-all">
                          {setupData.secret}
                        </code>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Step 2</div>
                        <p className="text-sm text-gray-300 mb-2">Enter the 6-digit code generated by the app:</p>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="000000"
                            value={totpCode}
                            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                            className="w-32 px-4 py-2 bg-[#12141a] border border-[#1f2229] rounded-lg text-lg tracking-widest text-white text-center focus:border-indigo-500 focus:outline-none transition-colors"
                          />
                          <button
                            onClick={() => verifyMutation.mutate(totpCode)}
                            disabled={verifyMutation.isPending || totpCode.length !== 6}
                            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {verifyMutation.isPending ? "Verifying..." : "Verify & Enable"}
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => setSetupData(null)}
                        className="text-sm text-gray-500 hover:text-gray-300 transition-colors mt-4"
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
                  className="px-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-sm font-medium rounded-lg transition-colors border border-indigo-500/20 disabled:opacity-50"
                >
                  {setupMutation.isPending ? "Starting setup..." : "Enable 2FA"}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
