"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (pin: string) => void;
};

export function SettingsPinDialog({ busy, error, onClose, onSubmit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pin, setPin] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(pin) || busy) return;
    onSubmit(pin);
  }

  return (
    <dialog ref={ref} className="settings-pin-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <form onSubmit={submit}>
        <button className="dialog-close" type="button" aria-label="Zamknij" onClick={onClose}>×</button>
        <p className="eyebrow">DOSTĘP CHRONIONY</p>
        <h2>Ustawienia</h2>
        <p className="settings-pin-hint">Wpisz PIN, aby otworzyć konfigurację planowania.</p>

        <label className="settings-pin-field">
          <span>PIN</span>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]*"
            minLength={4}
            maxLength={8}
            value={pin}
            onChange={event => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
            aria-invalid={Boolean(error)}
          />
        </label>

        {error && <div className="settings-pin-error" role="alert">{error}</div>}

        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Anuluj</button>
          <button className="button button-primary" type="submit" disabled={busy || !/^\d{4,8}$/.test(pin)}>
            {busy ? "Sprawdzanie…" : "Odblokuj ustawienia"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
