import { useMemo } from "react";

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export function scorePassword(password: string): {
  score: PasswordScore;
  checks: {
    length: boolean;
    lower: boolean;
    upper: boolean;
    digit: boolean;
    symbol: boolean;
    longer: boolean;
  };
} {
  const checks = {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: /[^a-zA-Z0-9]/.test(password),
    longer: password.length >= 12,
  };
  let hits = 0;
  if (checks.length) hits += 1;
  if (checks.lower && checks.upper) hits += 1;
  if (checks.digit) hits += 1;
  if (checks.symbol) hits += 1;
  if (checks.longer) hits += 1;
  const score = Math.min(4, Math.max(0, hits - 1)) as PasswordScore;
  return { score, checks };
}

export function PasswordStrengthMeter({
  password,
  language,
}: {
  password: string;
  language: "en" | "nl";
}) {
  const nl = language === "nl";
  const { score, checks } = useMemo(() => scorePassword(password), [password]);
  if (!password) return null;
  const labels = nl
    ? ["Zeer zwak", "Zwak", "Redelijk", "Sterk", "Zeer sterk"]
    : ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const hintLines = [
    { ok: checks.length, text: nl ? "8+ tekens" : "8+ characters" },
    {
      ok: checks.lower && checks.upper,
      text: nl ? "Hoofd- en kleine letters" : "Upper and lower case",
    },
    { ok: checks.digit, text: nl ? "Cijfer" : "A digit" },
    {
      ok: checks.symbol,
      text: nl ? "Speciaal teken" : "A symbol",
    },
    {
      ok: checks.longer,
      text: nl ? "12+ tekens voor extra sterkte" : "12+ chars for extra strength",
    },
  ];
  return (
    <div
      className="password-strength"
      data-score={score}
      aria-live="polite"
    >
      <div className="password-strength__bar" role="presentation">
        {[0, 1, 2, 3].map((segment) => (
          <span key={segment} data-filled={segment < score} />
        ))}
      </div>
      <small className="password-strength__label">{labels[score]}</small>
      <ul className="password-strength__hints">
        {hintLines.map((hint) => (
          <li key={hint.text} data-ok={hint.ok}>
            {hint.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
