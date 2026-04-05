"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const MAX_PAGE_BUTTONS = 7;

function visiblePageIndices(
  currentPage: number,
  pageCount: number
): number[] {
  if (pageCount <= MAX_PAGE_BUTTONS) {
    return Array.from({ length: pageCount }, (_, i) => i);
  }
  const half = Math.floor(MAX_PAGE_BUTTONS / 2);
  let start = Math.max(0, currentPage - half);
  let end = Math.min(pageCount - 1, start + MAX_PAGE_BUTTONS - 1);
  start = Math.max(0, end - MAX_PAGE_BUTTONS + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

type TablePaginationBarProps = {
  pageIndex: number;
  pageCount: number;
  totalRows: number;
  onPageChange: (index: number) => void;
  className?: string;
};

/** 1-based page display, 0-based index internally */
export function TablePaginationBar({
  pageIndex,
  pageCount,
  totalRows,
  onPageChange,
  className,
}: TablePaginationBarProps) {
  if (pageCount <= 0) pageCount = 1;
  const safeIndex = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const pages = visiblePageIndices(safeIndex, pageCount);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between py-4",
        className
      )}
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {totalRows} row(s) · Page {safeIndex + 1} of {pageCount}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(0)}
          disabled={safeIndex <= 0}
        >
          First
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safeIndex - 1)}
          disabled={safeIndex <= 0}
        >
          Previous
        </Button>
        {pages.map((i) => (
          <Button
            key={i}
            type="button"
            variant={i === safeIndex ? "default" : "outline"}
            size="sm"
            className="min-w-9 px-2"
            onClick={() => onPageChange(i)}
          >
            {i + 1}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safeIndex + 1)}
          disabled={safeIndex >= pageCount - 1}
        >
          Next
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pageCount - 1)}
          disabled={safeIndex >= pageCount - 1}
        >
          Last
        </Button>
      </div>
    </div>
  );
}

export { PAGE_SIZE };
