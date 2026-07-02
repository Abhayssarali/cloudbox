import type { Metadata } from "next";
import SignupForm from "./_components/SignupForm";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your CloudBox account to get started with personal cloud storage.",
};

export default function SignupPage() {
  return (
    <main className="login-root">
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg__orb login-bg__orb--1" />
        <div className="login-bg__orb login-bg__orb--2" />
        <div className="login-bg__orb login-bg__orb--3" />
        <div className="login-bg__grid" />
      </div>

      <div className="login-container">
        {/* Brand panel */}
        <div className="login-brand" aria-hidden="true">
          <div className="login-brand__logo">
            <svg viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="url(#sg1)" />
              <path d="M14 28c0-3.314 2.686-6 6-6a5.978 5.978 0 013.6 1.2A6 6 0 0130 20c3.314 0 6 2.686 6 6v2H14v-2z" fill="white" fillOpacity=".9" />
              <circle cx="24" cy="17" r="4" fill="white" fillOpacity=".6" />
              <defs><linearGradient id="sg1" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs>
            </svg>
          </div>
          <h1 className="login-brand__name">CloudBox</h1>
          <p className="login-brand__tagline">Your personal cloud, on your own hardware.</p>
          <div className="login-features">
            {[
              { icon: "🔐", label: "End-to-end encrypted" },
              { icon: "💾", label: "Files stay on your disk" },
              { icon: "🌐", label: "Access from anywhere" },
              { icon: "⚡", label: "No monthly storage fees" },
            ].map((f) => (
              <div key={f.label} className="login-feature">
                <span className="login-feature__icon">{f.icon}</span>
                <span className="login-feature__label">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="login-card">
          <div className="login-card__header">
            <div className="login-card__logo">
              <svg viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="14" fill="url(#sg2)" />
                <path d="M14 28c0-3.314 2.686-6 6-6a5.978 5.978 0 013.6 1.2A6 6 0 0130 20c3.314 0 6 2.686 6 6v2H14v-2z" fill="white" fillOpacity=".9" />
                <circle cx="24" cy="17" r="4" fill="white" fillOpacity=".6" />
                <defs><linearGradient id="sg2" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs>
              </svg>
            </div>
            <h2 className="login-card__title">Create your account</h2>
            <p className="login-card__subtitle">Start with Google or set up with email</p>
          </div>

          <SignupForm />

          <p className="login-card__footer">
            Already have an account?{" "}
            <a href="/login" className="login-card__link" id="signin-link">Sign in</a>
          </p>
        </div>
      </div>

      <style>{`
        .login-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; position: relative; overflow: hidden; background: var(--cb-bg); }
        .login-bg { position: absolute; inset: 0; pointer-events: none; }
        .login-bg__orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .35; animation: orbFloat 8s ease-in-out infinite; }
        .login-bg__orb--1 { width: 500px; height: 500px; background: radial-gradient(circle, #6366f1, transparent 70%); top: -150px; left: -100px; }
        .login-bg__orb--2 { width: 400px; height: 400px; background: radial-gradient(circle, #06b6d4, transparent 70%); bottom: -100px; right: -50px; animation-delay: -3s; }
        .login-bg__orb--3 { width: 300px; height: 300px; background: radial-gradient(circle, #8b5cf6, transparent 70%); top: 50%; left: 50%; transform: translate(-50%,-50%); animation-delay: -6s; }
        .login-bg__grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px); background-size: 48px 48px; }
        @keyframes orbFloat { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(20px,-30px) scale(1.05); } 66% { transform: translate(-15px,20px) scale(.95); } }
        .login-container { display: flex; align-items: center; gap: 4rem; width: 100%; max-width: 1000px; position: relative; z-index: 1; }
        .login-brand { flex: 1; display: none; }
        @media (min-width: 900px) { .login-brand { display: flex; flex-direction: column; gap: 1.5rem; } }
        .login-brand__logo { width: 64px; height: 64px; }
        .login-brand__logo svg { width: 100%; height: 100%; border-radius: 18px; box-shadow: 0 0 40px var(--cb-primary-glow); }
        .login-brand__name { font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .login-brand__tagline { font-size: 1.125rem; color: var(--cb-text-muted); line-height: 1.6; }
        .login-features { display: flex; flex-direction: column; gap: .875rem; margin-top: .5rem; }
        .login-feature { display: flex; align-items: center; gap: .75rem; }
        .login-feature__icon { font-size: 1.25rem; width: 2rem; text-align: center; }
        .login-feature__label { font-size: .9375rem; color: var(--cb-text-muted); }
        .login-card { width: 100%; max-width: 440px; background: var(--cb-surface); border: 1px solid var(--cb-border); border-radius: 20px; padding: 2.5rem; box-shadow: 0 0 0 1px rgba(255,255,255,.04) inset, 0 20px 60px rgba(0,0,0,.5), 0 0 80px rgba(99,102,241,.08); backdrop-filter: blur(20px); }
        .login-card__header { margin-bottom: 2rem; }
        .login-card__logo { width: 48px; height: 48px; margin-bottom: 1.25rem; display: none; }
        @media (max-width: 899px) { .login-card__logo { display: block; } }
        .login-card__logo svg { width: 100%; height: 100%; }
        .login-card__title { font-size: 1.625rem; font-weight: 700; color: var(--cb-text); margin-bottom: .375rem; }
        .login-card__subtitle { font-size: .9375rem; color: var(--cb-text-muted); }
        .login-card__footer { margin-top: 1.5rem; text-align: center; font-size: .875rem; color: var(--cb-text-subtle); }
        .login-card__link { color: var(--cb-primary-light); text-decoration: none; font-weight: 500; transition: color .15s; }
        .login-card__link:hover { color: var(--cb-text); }
      `}</style>
    </main>
  );
}
