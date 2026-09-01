import { useMemo } from "react";
import { Field, SelectField } from "./ui";
import { useApp } from "../context/AppContext";
import type { ReferenceRecord } from "../data/contracts";
import {
  childLocations,
  locationPath,
  locationPathIds,
  rootLocations,
  type LocationRef,
} from "../domain/locationTree";

type Props = {
  references: ReferenceRecord[];
  /** Deepest selected location id (the leaf). */
  value: string | null;
  onChange: (leafId: string | null, path: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  /** Optional free-text bin / storage position under the leaf location. */
  showBin?: boolean;
  bin?: string;
  onBinChange?: (bin: string) => void;
  /** Further restrict which locations are offered at every level. */
  filter?: (ref: LocationRef) => boolean;
};

/**
 * Phase A — cascading Main → Sub → deeper location picker driven by the AIMS
 * `ReferenceRecord` tree. The caller stores only the leaf id + a denormalised
 * path string; sub-location is just a child location, not a separate field.
 */
export function LocationPathPicker({
  references,
  value,
  onChange,
  label,
  required,
  disabled,
  showBin = true,
  bin = "",
  onBinChange,
  filter,
}: Props) {
  const nl = useApp().language === "nl";
  const base = label ?? (nl ? "Locatie" : "Location");

  const chain = useMemo(
    () => locationPathIds(references, value),
    [references, value],
  );

  const levels = useMemo(() => {
    const apply = (list: LocationRef[]) => (filter ? list.filter(filter) : list);
    const out: LocationRef[][] = [apply(rootLocations(references))];
    for (const id of chain) {
      const kids = apply(childLocations(references, id));
      if (kids.length) out.push(kids);
    }
    return out;
  }, [references, chain, filter]);

  const pick = (levelIdx: number, id: string) => {
    const leaf = id || (levelIdx > 0 ? chain[levelIdx - 1] : null) || null;
    onChange(leaf, leaf ? locationPath(references, leaf, { bin }) : "");
  };

  return (
    <div className="location-path-picker">
      {levels.map((opts, idx) => (
        <SelectField
          key={idx}
          label={
            idx === 0
              ? base
              : `${base} — ${nl ? "niveau" : "level"} ${idx + 1}`
          }
          value={chain[idx] ?? ""}
          required={required && idx === 0}
          disabled={disabled}
          onChange={(e) => pick(idx, e.target.value)}
        >
          <option value="">
            {idx === 0 ? "—" : `(${nl ? "geen" : "none"})`}
          </option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
      ))}
      {showBin && (
        <Field
          label={`${base} — ${nl ? "bin / positie" : "bin / position"}`}
          value={bin}
          disabled={disabled}
          placeholder={nl ? "bijv. Rek A / Plank 03" : "e.g. Rack A / Shelf 03"}
          onChange={(e) => onBinChange?.(e.target.value)}
        />
      )}
    </div>
  );
}
