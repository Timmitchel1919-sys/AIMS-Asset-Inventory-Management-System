import { useMemo, useState } from "react";

export interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
}

/** Searchable checkbox list used to choose devices for enrolment/commands. */
export function DevicePicker({
  items,
  selected,
  onChange,
  nl,
  max,
}: {
  items: PickerItem[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  nl: boolean;
  max: number;
}) {
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? items.filter((item) =>
          `${item.label} ${item.sublabel ?? ""}`.toLowerCase().includes(needle),
        )
      : items;
  }, [items, search]);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < max) next.add(id);
    onChange(next);
  };
  const selectVisible = () => {
    const next = new Set(selected);
    for (const item of visible) {
      if (next.size >= max) break;
      next.add(item.id);
    }
    onChange(next);
  };
  return (
    <div className="dm-picker">
      <div className="dm-picker__bar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={nl ? "Zoeken…" : "Search…"}
          aria-label={nl ? "Apparaten zoeken" : "Search devices"}
        />
        <button type="button" className="btn btn-ghost" onClick={selectVisible}>
          {nl ? "Zichtbare selecteren" : "Select visible"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onChange(new Set())}
        >
          {nl ? "Wissen" : "Clear"}
        </button>
      </div>
      <p className="dm-picker__count" role="status">
        {selected.size} / {max} {nl ? "geselecteerd" : "selected"}
      </p>
      <ul>
        {visible.slice(0, 300).map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span>
                <strong>{item.label}</strong>
                {item.sublabel && <small>{item.sublabel}</small>}
              </span>
            </label>
          </li>
        ))}
        {!visible.length && (
          <li className="dm-picker__empty">
            {nl ? "Geen resultaten" : "No results"}
          </li>
        )}
      </ul>
    </div>
  );
}
