interface Props {
  title: string;
  detail: string;
  previewLabel?: string;
  span?: 1 | 2 | 4;
}

export function PlaceholderTile({ title, detail, previewLabel = "Preview", span = 1 }: Props) {
  const spanClass =
    span === 4
      ? " bento-tile--span-4"
      : span === 2
        ? " bento-tile--span-2"
        : "";
  return (
    <section className={"bento-placeholder" + spanClass} aria-label={title}>
      <header className="bento-tile__header">
        <h3 className="bento-placeholder__title">{title}</h3>
        <span className="bento-tile__chip bento-tile__chip--preview">
          {previewLabel}
        </span>
      </header>
      <p className="bento-placeholder__detail">{detail}</p>
    </section>
  );
}

export default PlaceholderTile;
