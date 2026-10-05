import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export interface Column {
  label: string;
  /** Extra classes for the column's cells, such as alignment or wrapping. */
  className?: string;
}

/**
 * A table that turns into stacked cards below the `sm` breakpoint: each row becomes a block and
 * every cell shows its column label from `data-label`, so nothing scrolls sideways at 360 px.
 * The explicit ARIA roles keep the table semantics that some browsers drop once table elements
 * stop being displayed as a table.
 */
export function DataTable({
  columns,
  rows,
  labelledBy,
}: {
  columns: Column[];
  rows: { key: string; cells: ReactNode[] }[];
  labelledBy?: string;
}) {
  return (
    <Table role="table" aria-labelledby={labelledBy} className="max-sm:block">
      <TableHeader role="rowgroup" className="max-sm:sr-only">
        <TableRow role="row">
          {columns.map((column) => (
            <TableHead key={column.label} role="columnheader" className={column.className}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody role="rowgroup" className="max-sm:block">
        {rows.map((row) => (
          <TableRow
            key={row.key}
            role="row"
            className="hover:bg-transparent max-sm:block max-sm:py-2 sm:hover:bg-muted/50"
          >
            {row.cells.map((cell, i) => (
              <TableCell
                key={columns[i]?.label ?? i}
                role="cell"
                data-label={columns[i]?.label}
                className={cn(
                  'align-top max-sm:grid max-sm:grid-cols-[7rem_minmax(0,1fr)] max-sm:gap-3 max-sm:px-0 max-sm:py-1 max-sm:text-left max-sm:whitespace-normal max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]',
                  columns[i]?.className,
                )}
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
