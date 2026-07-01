"use client";

import { useState, useId } from "react";

interface FormState {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginForm() {
  const emailId = useId();
  const passwordId = useId();
  const rememberMeId = useId();

  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!form.email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Enter a valid email address";
    }
    if (!form.password) {
      errs.password = "Password is required";
    } else if (form.password.length < 8) {
      errs.password = "Password must be at least 8 characters";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setIsLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: form.email, password: form.password }),
        }
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrors({ general: data.error ?? "Invalid credentials" });
        return;
      }

      // Redirect to dashboard on success
      window.location.href = "/dashboard";
    } catch {
      setErrors({ general: "Network error — check your connection and try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate id="login-form" className="lf">
      {errors.general && (
        <div className="lf__error-banner" role="alert">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
          {errors.general}
        </div>
      )}

      {/* Email */}
      <div className="lf__group">
        <label htmlFor={emailId} className="lf__label">
          Email address
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => {
            setForm((f) => ({ ...f, email: e.target.value }));
            if (errors.email) setErrors((errs) => ({ ...errs, email: undefined }));
          }}
          className={`lf__input ${errors.email ? "lf__input--error" : ""}`}
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
          disabled={isLoading}
        />
        {errors.email && (
          <p id={`${emailId}-error`} className="lf__field-error" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="lf__group">
        <div className="lf__label-row">
          <label htmlFor={passwordId} className="lf__label">
            Password
          </label>
          <a href="/forgot-password" className="lf__forgot" id="forgot-password-link">
            Forgot password?
          </a>
        </div>
        <div className="lf__password-wrap">
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => {
              setForm((f) => ({ ...f, password: e.target.value }));
              if (errors.password) setErrors((errs) => ({ ...errs, password: undefined }));
            }}
            className={`lf__input lf__input--padded-right ${errors.password ? "lf__input--error" : ""}`}
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? `${passwordId}-error` : undefined}
            disabled={isLoading}
          />
          <button
            type="button"
            className="lf__eye"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            id="toggle-password-visibility"
          >
            {showPassword ? (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 6.862 19.5 11 19.5c4.138 0 7.774-3.162 9.066-7.5a10.477 10.477 0 00-2.046-3.777M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path d="M3 3l14 14" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path d="M10 3C6.5 3 3.5 5.5 2 10c1.5 4.5 4.5 7 8 7s6.5-2.5 8-7c-1.5-4.5-4.5-7-8-7z" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && (
          <p id={`${passwordId}-error`} className="lf__field-error" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      {/* Remember me */}
      <div className="lf__remember">
        <input
          type="checkbox"
          id={rememberMeId}
          checked={form.rememberMe}
          onChange={(e) => setForm((f) => ({ ...f, rememberMe: e.target.checked }))}
          className="lf__checkbox"
          disabled={isLoading}
        />
        <label htmlFor={rememberMeId} className="lf__remember-label">
          Remember me for 30 days
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="lf__submit"
        disabled={isLoading}
        id="login-submit-button"
      >
        {isLoading ? (
          <>
            <span className="lf__spinner" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>

      <style>{`
        .lf {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Error banner */
        .lf__error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(244, 63, 94, 0.12);
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 10px;
          color: #fb7185;
          font-size: 0.875rem;
          animation: fadeIn 0.2s ease;
        }
        .lf__error-banner svg {
          width: 1rem;
          height: 1rem;
          flex-shrink: 0;
        }

        /* Field group */
        .lf__group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .lf__label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lf__label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--cb-text-muted);
        }
        .lf__forgot {
          font-size: 0.8125rem;
          color: var(--cb-primary-light);
          text-decoration: none;
          transition: color 0.15s;
        }
        .lf__forgot:hover {
          color: var(--cb-text);
        }

        /* Inputs */
        .lf__input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--cb-surface-2);
          border: 1px solid var(--cb-border);
          border-radius: 10px;
          color: var(--cb-text);
          font-size: 0.9375rem;
          font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .lf__input::placeholder {
          color: var(--cb-text-subtle);
        }
        .lf__input:focus {
          border-color: var(--cb-primary);
          box-shadow: 0 0 0 3px var(--cb-primary-glow);
        }
        .lf__input--error {
          border-color: #f43f5e;
          box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.15);
        }
        .lf__input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .lf__input--padded-right {
          padding-right: 3rem;
        }

        /* Password wrapper */
        .lf__password-wrap {
          position: relative;
        }
        .lf__eye {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--cb-text-subtle);
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s;
          border-radius: 4px;
        }
        .lf__eye:hover {
          color: var(--cb-text-muted);
        }
        .lf__eye svg {
          width: 1.125rem;
          height: 1.125rem;
        }

        /* Field error */
        .lf__field-error {
          font-size: 0.8125rem;
          color: #fb7185;
          animation: fadeIn 0.15s ease;
        }

        /* Remember me */
        .lf__remember {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }
        .lf__checkbox {
          width: 1rem;
          height: 1rem;
          accent-color: var(--cb-primary);
          cursor: pointer;
        }
        .lf__remember-label {
          font-size: 0.875rem;
          color: var(--cb-text-muted);
          cursor: pointer;
          user-select: none;
        }

        /* Submit button */
        .lf__submit {
          width: 100%;
          padding: 0.8125rem 1rem;
          background: linear-gradient(135deg, var(--cb-primary) 0%, #4f46e5 100%);
          color: white;
          font-size: 0.9375rem;
          font-weight: 600;
          font-family: inherit;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 4px 20px var(--cb-primary-glow);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }
        .lf__submit:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 8px 30px var(--cb-primary-glow);
        }
        .lf__submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .lf__submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Spinner */
        .lf__spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </form>
  );
}
