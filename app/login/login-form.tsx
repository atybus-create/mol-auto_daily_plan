"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type LoginFormProps = {
  returnTo: string;
};

export function LoginForm({ returnTo }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, returnTo }),
      });
      const result = await response.json() as { error?: string; returnTo?: string };

      if (!response.ok) {
        setError(result.error ?? "Logowanie nie powiodło się. Spróbuj ponownie.");
        return;
      }

      router.replace(result.returnTo ?? "/");
      router.refresh();
    } catch {
      setError("Brak połączenia z aplikacją. Spróbuj ponownie.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="password">Hasło dostępu</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "login-error" : "login-help"}
      />
      <p id="login-help" className="login-help">Dostęp wyłącznie dla uprawnionych pracowników ESTYL.</p>
      {error ? <p id="login-error" className="login-error" role="alert">{error}</p> : null}
      <button className="button button-primary login-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Logowanie…" : "Zaloguj"}
      </button>
    </form>
  );
}
