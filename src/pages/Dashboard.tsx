import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  PackageCheck,
  Plus,
  ScanLine,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDeferredValue, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMockSnapshot } from "../data/repositoryContext";
import { Badge, Button, Card } from "../components/ui";
import { useApp } from "../context/AppContext";
export default function Dashboard() {
  const { user, language } = useApp(),
    nl = language === "nl",
    navigate = useNavigate(),
    snapshot = useMockSnapshot();
  const [selectedLocationId, setSelectedLocationId] = useState("all");
  const deferredLocationId = useDeferredValue(selectedLocationId);
  const isFiltering = deferredLocationId !== selectedLocationId;
  const activeLocations = snapshot.references
    .filter((item) => item.kind === "location" && item.status === "Active")
    .sort((a, b) => a.name.localeCompare(b.name));
  const filtered = useMemo(() => {
    const currentLocation = snapshot.references.find(
      (item) => item.id === deferredLocationId,
    );
    const all = deferredLocationId === "all",
      name = currentLocation?.name;
    const assetMatches = (asset: {
      currentLocationId?: string;
      location: string;
    }) =>
      all ||
      asset.currentLocationId === deferredLocationId ||
      asset.location === name;
    const assets = snapshot.assets.filter(assetMatches),
      assetCodes = new Set(assets.map((x) => x.code));
    const movements = snapshot.movements.filter(
      (item) =>
        all ||
        item.locationId === deferredLocationId ||
        item.sourceLocationId === deferredLocationId ||
        item.destinationLocationId === deferredLocationId ||
        item.from === name ||
        item.to === name ||
        assetCodes.has(item.assetCode),
    );
    const borrows = snapshot.borrows.filter(
      (item) =>
        all ||
        item.locationId === deferredLocationId ||
        assetCodes.has(item.assetCode),
    );
    const maintenance = snapshot.maintenance.filter(
      (item) =>
        all ||
        item.locationId === deferredLocationId ||
        item.location === name ||
        assetCodes.has(item.assetCode),
    );
    const repairs = snapshot.repairs.filter(
      (item) => all || assetCodes.has(item.assetCode),
    );
    const inventory = snapshot.inventory.filter(
      (item) => all || item.location === name,
    );
    const audits = snapshot.audits.filter(
      (item) =>
        all || item.sampleItems?.some((sample) => sample.location === name),
    );
    const movementChart = Object.values(
      movements.reduce<
        Record<string, { d: string; issues: number; returns: number }>
      >((groups, item) => {
        const d = item.date.slice(0, 10),
          row = groups[d] || (groups[d] = { d, issues: 0, returns: 0 });
        if (/return/i.test(item.type)) row.returns += item.quantity;
        else row.issues += item.quantity;
        return groups;
      }, {}),
    ).sort((a, b) => a.d.localeCompare(b.d));
    return {
      assets,
      movements,
      borrows,
      maintenance,
      repairs,
      inventory,
      audits,
      movementChart,
    };
  }, [deferredLocationId, snapshot]);
  const metrics = [
    [
      nl ? "Totaal middelen" : "Total assets",
      filtered.assets.length,
      nl ? "Geserialiseerde records" : "Serialized records",
      Boxes,
      "success",
    ],
    [
      nl ? "In gebruik / uitgegeven" : "In use / issued",
      filtered.assets.filter((asset) =>
        ["Assigned", "Borrowed"].includes(asset.status),
      ).length,
      nl ? "Actieve verantwoordelijkheid" : "Active responsibility",
      PackageCheck,
      "info",
    ],
    [
      nl ? "Beschikbaar" : "Available",
      filtered.assets.filter((asset) => asset.status === "Available").length,
      nl ? "Direct inzetbaar" : "Ready to issue",
      ClipboardCheck,
      "success",
    ],
    [
      nl ? "In onderhoud" : "Under maintenance",
      filtered.assets.filter((asset) => asset.status.includes("Maintenance"))
        .length,
      nl ? "Geplande service" : "Scheduled service",
      Wrench,
      "warning",
    ],
    [
      nl ? "Achterstallige retouren" : "Overdue returns",
      filtered.borrows.filter((borrow) => borrow.status === "Overdue").length,
      nl ? "Aandacht vereist" : "Requires attention",
      CalendarClock,
      "danger",
    ],
  ] as const;
  const attention = [
    [
      nl ? "Achterstallige retouren" : "Overdue returns",
      nl ? "Middelen na vervaldatum" : "Assets past due date",
      filtered.borrows.filter((item) => item.status === "Overdue").length,
      "danger",
    ],
    [
      nl ? "Wacht op reparatie" : "Awaiting repair",
      nl ? "Gemelde storingen" : "Reported faults",
      filtered.repairs.filter((item) => item.status !== "Completed").length,
      "warning",
    ],
    [
      nl ? "Lage voorraad" : "Low stock items",
      nl ? "Onder bestelniveau" : "Below reorder level",
      filtered.inventory.filter(
        (item) => item.onHand - item.reserved < item.minimum,
      ).length,
      "warning",
    ],
    [
      nl ? "Onderhoud gepland" : "Maintenance due",
      nl ? "Open onderhoudstaken" : "Open maintenance tasks",
      filtered.maintenance.filter((item) => item.status !== "Completed").length,
      "info",
    ],
    [
      nl ? "Controle actief" : "Audit in progress",
      nl ? "Actieve controlesessies" : "Active audit sessions",
      filtered.audits.filter((item) => item.status !== "Completed").length,
      "success",
    ],
  ] as const;
  return (
    <div className="page dashboard-page">
      <header className="page-title">
        <div>
          <h1>
            {nl ? "Goedemorgen" : "Good morning"}, {user?.name.split(" ")[0]}
          </h1>
          <p>
            {nl
              ? "Dit gebeurt vandaag in uw inventaris."
              : "Here is what is happening with your inventory today."}
          </p>
        </div>
        <select
          aria-label={nl ? "Locatie" : "Location"}
          value={selectedLocationId}
          onChange={(event) => setSelectedLocationId(event.target.value)}
        >
          <option value="all">{nl ? "Alle locaties" : "All locations"}</option>
          {activeLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </header>
      {isFiltering && (
        <div className="dashboard-filter-loading" role="status">
          <span className="spinner" />
          {nl ? "Locatiegegevens bijwerken…" : "Updating location data…"}
        </div>
      )}
      <Card
        title={nl ? "Inventarisoverzicht" : "Inventory overview"}
        className="metrics-card"
      >
        <div className="metrics">
          {metrics.map(([label, value, detail, Icon, tone]) => (
            <button
              className="metric"
              key={label}
              onClick={() => navigate("/assets")}
            >
              <span className={`metric-icon ${tone}`}>
                <Icon />
              </span>
              <small>{label}</small>
              <strong>{value}</strong>
              <em>{detail}</em>
            </button>
          ))}
        </div>
      </Card>
      <div className="dashboard-grid">
        <Card
          title={
            nl ? "Voorraadmutaties (30 dagen)" : "Inventory movement (30 days)"
          }
          className="chart-card"
        >
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={filtered.movementChart}>
              <defs>
                <linearGradient id="issueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--color-border-subtle)"
                vertical={false}
              />
              <XAxis dataKey="d" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="issues"
                stroke="var(--color-primary)"
                fill="url(#issueFill)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="returns"
                stroke="var(--color-info)"
                fill="transparent"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card
          title={nl ? "Aandacht vereist" : "Attention required"}
          className="attention"
        >
          {attention.map(([title, detail, count, tone]) => (
            <button key={title}>
              <span className={`attention-icon ${tone}`}>
                <AlertTriangle />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
              <b>{count}</b>
            </button>
          ))}
        </Card>
        <Card
          title={nl ? "Snelle acties" : "Quick actions"}
          className="quick-actions"
        >
          <Button onClick={() => navigate("/assets/new")}>
            <Plus />
            {nl ? "Middel toevoegen" : "Add asset"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate("/assets?scan=1")}
          >
            <ScanLine />
            {nl ? "Code scannen" : "Scan code"}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/audits/new")}>
            <ClipboardCheck />
            {nl ? "Controle starten" : "Start audit"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate("/movements/new")}
          >
            <ArrowUpRight />
            {nl ? "Mutatie registreren" : "Record movement"}
          </Button>
        </Card>
      </div>
      <div className="dashboard-bottom">
        <Card
          title={nl ? "Recente mutaties" : "Recent movements"}
          action={
            <Button variant="ghost" onClick={() => navigate("/movements")}>
              {nl ? "Alles bekijken" : "View all"}
            </Button>
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{nl ? "Datum en tijd" : "Date & time"}</th>
                  <th>Type</th>
                  <th>{nl ? "Middel / artikel" : "Asset / item"}</th>
                  <th>KCS code</th>
                  <th>{nl ? "Van" : "From"}</th>
                  <th>{nl ? "Naar" : "To"}</th>
                  <th>{nl ? "Door" : "By"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.date}</td>
                    <td>
                      <span
                        className={`movement-icon ${movement.type.toLowerCase()}`}
                      >
                        {movement.type === "Return" ? (
                          <ArrowDownLeft />
                        ) : (
                          <ArrowUpRight />
                        )}
                      </span>
                      {movement.type}
                    </td>
                    <td>
                      <b>{movement.asset}</b>
                    </td>
                    <td>{movement.assetCode}</td>
                    <td>{movement.from}</td>
                    <td>{movement.to}</td>
                    <td>{movement.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card
          title={
            nl
              ? "Aankomende retouren en onderhoud"
              : "Upcoming returns & maintenance"
          }
        >
          <div className="upcoming">
            {filtered.borrows.map((item) => (
              <button key={item.id}>
                <span>
                  <b>{item.dueDate}</b>
                  <small>{item.asset}</small>
                </span>
                <span>
                  {item.borrower}
                  <Badge tone={item.status === "Overdue" ? "danger" : "info"}>
                    {item.status}
                  </Badge>
                </span>
              </button>
            ))}
            {filtered.maintenance.map((item) => (
              <button key={item.id}>
                <span>
                  <b>{item.nextDate}</b>
                  <small>{item.asset}</small>
                </span>
                <span>
                  {item.type}
                  <Badge tone="warning">{item.status}</Badge>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
