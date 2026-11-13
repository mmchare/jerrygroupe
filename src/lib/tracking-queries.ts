import { queryOptions } from "@tanstack/react-query";

import { getSupplierPortal } from "./tracking.functions";

/** Private supplier data: fetched in the browser only, never cached between visitors. */
export const supplierPortalQuery = (token: string) =>
  queryOptions({
    queryKey: ["supplier-portal", token],
    queryFn: () => getSupplierPortal({ data: { token } }),
    staleTime: 30_000,
  });

export const privateHead = (title: string, description: string) => ({
  meta: [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "noindex, nofollow, noarchive" },
    { name: "referrer", content: "no-referrer" },
  ],
});
