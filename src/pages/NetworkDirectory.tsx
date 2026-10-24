import { useMemo, useState } from "react";
import { PageHeader } from "../components/WorkflowUi";
import { Loader, State } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useNetworkDirectory } from "../data/networkDirectoryStore";

export default function NetworkDirectory() {
  const { language } = useApp(),
    nl = language === "nl",
    { devices, loading, error } = useNetworkDirectory(),
    [search, setSearch] = useState(""),
    [type, setType] = useState("all"),
    [sort, setSort] = useState<"lastSeen" | "hostname" | "ipAddress">(
      "lastSeen",
    );
  const types = useMemo(
    () =>
      [
        ...new Set(
          devices.map((item) => item.deviceType).filter(Boolean) as string[],
        ),
      ].sort(),
    [devices],
  );
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return devices
      .filter(
        (item) =>
          (type === "all" || item.deviceType === type) &&
          (!query ||
            [
              item.hostname,
              item.ipAddress,
              item.macAddress,
              item.vendor,
              item.deviceType,
              item.assetCode,
              item.location,
            ].some((value) => value?.toLowerCase().includes(query))),
      )
      .sort((a, b) =>
        sort === "lastSeen"
          ? (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0)
          : String(a[sort] || "").localeCompare(String(b[sort] || "")),
      );
  }, [devices, search, type, sort]);
  const format = (value: Date | null) =>
    value
      ? new Intl.DateTimeFormat(nl ? "nl-SR" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(value)
      : "—";
  return (
    <div className="page data-page network-directory-page">
      <PageHeader
        title={nl ? "Netwerkdirectory" : "Network Directory"}
        description=""
      />
      <section className="card data-card">
        <div className="data-toolbar">
          <label className="search">
            <span className="sr-only">{nl ? "Zoeken" : "Search"}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                nl
                  ? "Zoek hostname, IP, MAC of asset…"
                  : "Search hostname, IP, MAC, or asset…"
              }
            />
          </label>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label={nl ? "Apparaattype" : "Device type"}
          >
            <option value="all">{nl ? "Alle typen" : "All types"}</option>
            {types.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            aria-label={nl ? "Sorteren" : "Sort"}
          >
            <option value="lastSeen">
              {nl ? "Laatst gezien" : "Last seen"}
            </option>
            <option value="hostname">Hostname</option>
            <option value="ipAddress">IP</option>
          </select>
          <span className="data-toolbar__count">
            <b>{rows.length}</b>
            {nl ? "apparaten" : "devices"}
          </span>
        </div>
        {loading ? (
          <Loader />
        ) : error ? (
          <State
            type="error"
            title={nl ? "Directory niet beschikbaar" : "Directory unavailable"}
            description={error}
          />
        ) : !rows.length ? (
          <State
            type="empty"
            title={nl ? "Geen apparaten gevonden" : "No devices found"}
            description={
              nl
                ? "Gepubliceerde netwerkapparaten verschijnen hier na een geautoriseerde discovery-scan."
                : "Published network devices appear here after an authorized discovery scan."
            }
          />
        ) : (
          <div className="table-scroll desktop-table">
            <table>
              <thead>
                <tr>
                  <th>{nl ? "Apparaat" : "Device"}</th>
                  <th>Hostname</th>
                  <th>IP</th>
                  <th>MAC</th>
                  <th>{nl ? "Fabrikant" : "Vendor"}</th>
                  <th>{nl ? "Type" : "Type"}</th>
                  <th>{nl ? "AIMS asset" : "AIMS asset"}</th>
                  <th>{nl ? "Locatie" : "Location"}</th>
                  <th>Status</th>
                  <th>{nl ? "Eerst gezien" : "First seen"}</th>
                  <th>{nl ? "Laatst gezien" : "Last seen"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.hostname || item.ipAddress}</td>
                    <td>{item.hostname || "—"}</td>
                    <td>{item.ipAddress}</td>
                    <td>{item.macAddress || "—"}</td>
                    <td>{item.vendor || "—"}</td>
                    <td>{item.deviceType || "—"}</td>
                    <td>{item.assetCode || "—"}</td>
                    <td>{item.location || "—"}</td>
                    <td>{item.status}</td>
                    <td>{format(item.firstSeen)}</td>
                    <td>{format(item.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
