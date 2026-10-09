"use client";

import { useActionState, useState, useRef } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn, type SignInState } from "@/app/actions/auth";

const initialState: SignInState = {};

function PasswordIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a16.8 16.8 0 01-2.1 2.5M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5c1 0 2-.2 2.8-.5" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const ambiguous = useRef(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [remember, setRemember] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: SignInState, form: FormData) => {
      try {
        if (ambiguous.current) {
          const response = await fetch("/api/auth/session-status", {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!response.ok) throw new Error("SESSION_CONFIRMATION_UNAVAILABLE");
          const status = await response.json();
          if (
            status.authenticated &&
            typeof status.redirectTo === "string" &&
            status.redirectTo.startsWith("/") &&
            !status.redirectTo.startsWith("//")
          ) {
            window.location.assign(status.redirectTo);
            return {};
          }
          ambiguous.current = false;
        }
        return await signIn(previous, form);
      } catch (error) {
        if (isRedirectError(error)) throw error;
        ambiguous.current = true;
        return {
          error:
            "Connection interrupted. Your inputs were kept. Reconnect and select Sign In to confirm your session or retry.",
        };
      }
    },
    initialState,
  );
  return (
    <form
      action={formAction}
      className="sign-in-form"
      onReset={(event) => event.preventDefault()}
    >
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={254}
        type="email"
        autoComplete="email"
        required
        placeholder="Email"
      />
      <label htmlFor="password">Password</label>
      <div className="password-field">
        <input
          id="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={200}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="Password"
        />
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          aria-controls="password"
          onClick={() => setShowPassword((v) => !v)}
        >
          <PasswordIcon visible={showPassword} />
        </button>
      </div>
      <label className="remember-me">
        <input
          name="remember"
          type="checkbox"
          value="true"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />{" "}
        <span>Remember me</span>
      </label>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
