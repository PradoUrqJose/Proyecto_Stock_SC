"use client";

import { useSearchParams } from "next/navigation";
import type { PaginationState, Updater } from "@tanstack/react-table";

type ParamValue = string | string[] | number | boolean | undefined | null;

/**
 * Sync table state (search, filters, pagination) with URL search params.
 *
 * Uses window.history.replaceState — does NOT trigger a Next.js navigation,
 * so the Server Component never re-fetches and client state is never reset.
 *
 * Usage:
 *   const { get, getAll, getPage, sync, makePaginationHandler } = useTableUrlState();
 *   const [q, setQ] = useState(() => get("q"));
 *   const [pagination, setPagination] = useState(() => ({ pageIndex: getPage(), pageSize: 15 }));
 *
 *   sync({ q: "ADIDAS", cat: ["Calzado"], page: 1 });  // 1-based page
 *
 *   // In useReactTable:
 *   onPaginationChange: makePaginationHandler(pagination, setPagination, () => ({ q })),
 */
export function useTableUrlState() {
  const searchParams = useSearchParams();

  /** Read a single string param from URL. */
  const get = (key: string, fallback = "") => searchParams.get(key) ?? fallback;

  /** Read a multi-value param from URL (e.g. ?cat=A&cat=B → ["A","B"]). */
  const getAll = (key: string): string[] => searchParams.getAll(key);

  /** Read the page param and convert to 0-based pageIndex for TanStack Table. */
  const getPage = (key = "page"): number =>
    Math.max(0, Number(searchParams.get(key) ?? "1") - 1);

  /** Read a boolean flag param from URL ("1" → true, anything else → false). */
  const getBool = (key: string): boolean => searchParams.get(key) === "1";

  /**
   * Write all params to the URL at once.
   * - Omits empty strings, empty arrays, false booleans, and page=1 (default).
   * - Does not trigger any navigation or Server Component re-fetch.
   */
  const sync = (params: Record<string, ParamValue>) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === "" || value === false) continue;
      if (Array.isArray(value)) {
        value.forEach(v => sp.append(key, v));
      } else if (typeof value === "boolean") {
        sp.set(key, "1");
      } else if (typeof value === "number") {
        if (value > 1) sp.set(key, String(value));
      } else {
        sp.set(key, value);
      }
    }
    const qs = sp.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`
    );
  };

  /**
   * Returns a ready-to-use onPaginationChange handler for useReactTable.
   * Eliminates the boilerplate of computing `next` and calling sync in every table.
   *
   * @param pagination  Current pagination state (the useState value).
   * @param setPagination  The useState setter.
   * @param getCurrentParams  Fn that returns the rest of the URL params at call time.
   *
   * Usage:
   *   onPaginationChange: makePaginationHandler(pagination, setPagination, () => ({
   *     q: globalFilter, cat: filterCategoria,
   *   })),
   */
  const makePaginationHandler = (
    pagination: PaginationState,
    setPagination: (p: PaginationState) => void,
    getCurrentParams: () => Record<string, ParamValue>
  ) => (updater: Updater<PaginationState>) => {
    const next = typeof updater === "function" ? updater(pagination) : updater;
    setPagination(next);
    sync({ ...getCurrentParams(), page: next.pageIndex + 1 });
  };

  return { get, getAll, getPage, getBool, sync, makePaginationHandler };
}
