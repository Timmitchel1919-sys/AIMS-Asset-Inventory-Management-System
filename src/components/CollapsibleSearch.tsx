import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Module search shown as a single search key. Clicking it expands the field
 * in place and focuses it; it collapses again on Escape, on the close
 * button, or when focus leaves an empty field. A field that holds a query
 * stays open so the active search is always visible.
 */
export function CollapsibleSearch({
  value,
  onChange,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(Boolean(value));
  const input = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const expanded = open || Boolean(value);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // An empty field also collapses when the user clicks anywhere outside it.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || value) return;
    const outside = (event: MouseEvent | TouchEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
    };
  }, [open, value]);

  const close = (refocus: boolean) => {
    onChange("");
    setOpen(false);
    if (refocus) requestAnimationFrame(() => toggle.current?.focus());
  };

  return (
    <div
      ref={root}
      className={`search-collapsible${expanded ? " is-open" : ""} ${className}`.trim()}
      onBlur={(event) => {
        if (!value && !event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      {expanded ? (
        <label className="search search-collapsible__field" htmlFor={id}>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">{label}</span>
          <input
            id={id}
            ref={input}
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close(true);
              }
            }}
            placeholder={label}
          />
          <button
            type="button"
            className="search-collapsible__close"
            aria-label={label.toLowerCase().startsWith("zoek") ? "Zoeken sluiten" : "Close search"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => close(true)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </label>
      ) : (
        <button
          ref={toggle}
          type="button"
          className="btn btn-secondary search-collapsible__toggle"
          aria-label={label}
          aria-expanded={false}
          title={label}
          onClick={() => setOpen(true)}
        >
          <Search aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
