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
});
