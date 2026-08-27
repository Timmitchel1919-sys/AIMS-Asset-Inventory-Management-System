import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { Card, SelectField } from "../ui";
import { useApp } from "../../context/AppContext";
import {
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
      await app.updatePreferences({ fontFamily: nextFamily, fontSize: nextSize });
      setMessage(nl ? "Typografie automatisch opgeslagen." : "Typography saved automatically.");
    } catch {
      setFontFamily(savedFamily);
      setFontSize(savedSize);
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
          disabled={busy}
          onChange={(event) => {
            const nextFamily = resolveFontFamily(event.target.value);
            setFontFamily(nextFamily);
            void persist(nextFamily, fontSize);
          }}
        >
          {FONT_FAMILIES.map((font) => <option key={font} value={font}>{font}</option>)}
        </SelectField>
        <SelectField
          label={nl ? "Tekstgrootte" : "Text size"}
          value={fontSize}
          disabled={busy}
          onChange={(event) => {
            const nextSize = resolveFontSize(Number(event.target.value));
            setFontSize(nextSize);
            void persist(fontFamily, nextSize);
          }}
        >
          {FONT_SIZES.map((size, index) => (
            <option key={size} value={size}>{sizeNames[nl ? "nl" : "en"][index]} — {size}px</option>
          ))}
        </SelectField>
      </div>
      {message ? <p className="notice success" role="status">{message}</p> : null}
      {error ? <p className="notice error" role="alert">{error}</p> : null}
    </Card>
  );
}
