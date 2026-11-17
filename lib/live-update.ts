const WARSAW_TIME_FORMATTER = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatWarsawSourceTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : WARSAW_TIME_FORMATTER.format(parsed);
}

