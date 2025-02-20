import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "./ui/table";
import { SearchResponse } from "./SearchInterface";
import { Button } from "./ui/button";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  createColumnHelper,
  Column,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

const columnHelper = createColumnHelper<any>();

// Reusable header component for sortable columns
const SortableHeader = ({
  column,
  title,
}: {
  column: Column<any, unknown>;
  title: string;
}) => {
  if (!column.getCanSort()) {
    return title;
  }

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className={`hover:bg-transparent ${
        column.getIsSorted() ? "bg-slate-100 dark:bg-slate-800" : ""
      }`}
    >
      {title}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
};

const ResultsTable = ({
  data,
  onExport,
}: {
  data: SearchResponse;
  onExport: () => void;
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = [
    columnHelper.accessor("title", {
      header: ({ column }) => <SortableHeader column={column} title="Title" />,
      cell: (info) => <div className="font-medium">{info.getValue()}</div>,
    }),
    columnHelper.accessor("year", {
      header: ({ column }) => <SortableHeader column={column} title="Year" />,
    }),
    columnHelper.accessor("authors", {
      header: ({ column }) => (
        <SortableHeader column={column} title="Authors" />
      ),
      cell: (info) => info.getValue().join(", "),
    }),
    columnHelper.accessor("citation_count", {
      header: ({ column }) => (
        <SortableHeader column={column} title="Citations" />
      ),
    }),
    columnHelper.accessor((row) => ({ url: row.url, pdf_url: row.pdf_url }), {
      id: "links",
      header: "Links",
      enableSorting: false,
      cell: (info) => {
        const { url, pdf_url } = info.getValue();
        return (
          <div className="flex items-center gap-3">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-light-blue-vivid-600 hover:text-light-blue-vivid-400"
              >
                View
              </a>
            )}
            {pdf_url && (
              <a
                href={pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-red-vivid-400 hover:text-red-vivid-300 "
              >
                PDF
              </a>
            )}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: data.papers,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Results</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={onExport} className="mb-4">
          Export to Excel
        </Button>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultsTable;
