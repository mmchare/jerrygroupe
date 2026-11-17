import { queryOptions } from "@tanstack/react-query";

import type { ProposalStatus } from "./tracking-rules";
import {
  getAdminProposal,
  getAdminProposals,
  getAdminSession,
} from "./admin.functions";

export const adminSessionQuery = queryOptions({
  queryKey: ["admin", "session"],
  queryFn: () => getAdminSession(),
  staleTime: 30_000,
});

export function adminProposalsQuery(search: string, status?: ProposalStatus) {
  return queryOptions({
    queryKey: ["admin", "proposals", search, status ?? "all"],
    queryFn: () => getAdminProposals({ data: { search, status } }),
    staleTime: 15_000,
  });
}

export function adminProposalQuery(proposalId: string) {
  return queryOptions({
    queryKey: ["admin", "proposal", proposalId],
    queryFn: () => getAdminProposal({ data: { proposalId } }),
    staleTime: 10_000,
  });
}
