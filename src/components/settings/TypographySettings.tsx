import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { Button, Card, SelectField } from "../ui";
import { useApp } from "../../context/AppContext";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  FONT_SIZES,
  resolveFontFamily,
  resolveFontSize,
  type FontFamily,
  type FontSize,
} from "../../domain/typographyPreferences";

const sizeNames = {
  en: ["Small", "Compact", "Default", "Comfortable", "Large"],
  nl: ["Klein", "Compact", "Standaard", "Comfortabel", "Groot"],
} as const;

export function TypographySettings() {
  const app = useApp();
  const nl = app.language === "nl";
  const savedFamily = resolveFontFamily(app.preferences.fontFamily);
  const savedSize = resolveFontSize(app.preferences.fontSize);
  const [fontFamily, setFontFamily] = useState<FontFamily>(savedFamily);
  const [fontSize, setFontSize] = useState<FontSize>(savedSize);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFontFamily(savedFamily);
    setFontSize(savedSize);
  }, [savedFamily, savedSize]);

  async function persist(nextFamily: FontFamily, nextSize: FontSize) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await app.updatePreferences({
        fontFamily: nextFamily,
        fontSize: nextSize,
      });
      setMessage(nl ? "Typografie opgeslagen." : "Typography saved.");
    } catch {
      setError(
        nl
          ? "Typografie kon niet worden opgeslagen. Uw vorige instelling is hersteld."
          : "Typography could not be saved. Your previous setting was restored.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="typography-settings-card">
      <Type />
      <h2>{nl ? "Typografie" : "Typography"}</h2>
      <div className="typography-controls">
        <SelectField
          label={nl ? "Lettertype" : "Font"}
          value={fontFamily}
          onChange={(event) => {
            setMessage("");
            setError("");
            setFontFamily(resolveFontFamily(event.target.value));
          }}
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={nl ? "Tekstgrootte" : "Text size"}
          value={fontSize}
          onChange={(event) => {
            setMessage("");
            setError("");
            setFontSize(resolveFontSize(Number(event.target.value)));
          }}
        >
          {FONT_SIZES.map((size, index) => (
            <option key={size} value={size}>
              {sizeNames[nl ? "nl" : "en"][index]} — {size}px
            </option>
          ))}
        </SelectField>
      </div>
      {message ? <p className="notice success" role="status">{message}</p> : null}
      {error ? <p className="notice error" role="alert">{error}</p> : null}
      <div className="typography-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setFontFamily(DEFAULT_FONT_FAMILY);
            setFontSize(DEFAULT_FONT_SIZE);
            void persist(DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE);
          }}
        >
          {nl ? "Standaard herstellen" : "Reset to default"}
        </Button>
        <Button
          type="button"
          disabled={busy || (fontFamily === savedFamily && fontSize === savedSize)}
          onClick={() => void persist(fontFamily, fontSize)}
        >
          {busy ? (nl ? "Opslaan…" : "Saving…") : (nl ? "Wijzigingen opslaan" : "Save changes")}
        </Button>
      </div>
    </Card>
  );
}
