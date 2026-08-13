import { Suspense } from "react";
import GoogleSetupForm from "./_components/GoogleSetupForm";

export const metadata = {
  title: "Set Up Your Workspace — CloudBox",
  description: "Choose how you want to use CloudBox with your Google account.",
};

export default function GoogleSetupPage() {
  return (
    <Suspense fallback={<div style={{ color: "var(--cb-text-muted)", textAlign: "center", padding: "2rem" }}>Loading…</div>}>
      <GoogleSetupForm />
    </Suspense>
  );
}
