// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type DataColumn } from "./DataTable";

vi.mock("../context/AppContext", () => ({
  useApp: () => ({
    language: "en",
    formatDate: (value: string) => value,
    formatDateTime: (value: string) => value,
  }),
}));

type Row = { id: string; name: string };
const columns: DataColumn<Row>[] = [
  { id: "name", label: "Name", sortable: true, text: (row) => row.name, render: (row) => row.name },
];

describe("DataTable", () => {
  it("shows textual records alphabetically until the user selects another order", () => {
    render(
      <DataTable
        id="alphabetical-test"
        rows={[
          { id: "2", name: "Zulu" },
          { id: "1", name: "Alpha" },
        ]}
        columns={columns}
        rowKey={(row) => row.id}
        searchPlaceholder="Search"
        emptyTitle="Empty"
        emptyDescription="No records"
      />,
    );

    expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "",
      "Alpha",
      "",
      "Zulu",
    ]);
  });

  it("keeps explicitly requested actions available in mobile cards", () => {
    const mobileColumns: DataColumn<Row>[] = [
      ...["name", "manager", "assets", "location", "status"].map((id) => ({
        id,
        label: id,
        render: (row: Row) => row.name,
      })),
      {
        id: "overview",
        label: "",
        render: () => <button type="button">Overview</button>,
      },
    ];

    const { container } = render(
      <DataTable
        id="departments"
        rows={[{ id: "1", name: "Finance" }]}
        columns={mobileColumns}
        rowKey={(row) => row.id}
        searchPlaceholder="Search"
        emptyTitle="Empty"
        emptyDescription="No records"
        mobileExtraColumnIds={["overview"]}
      />,
    );

    expect(
      container.querySelector(".mobile-records button"),
    ).toHaveTextContent("Overview");
  });
});
