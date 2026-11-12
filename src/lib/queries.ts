import { queryOptions } from "@tanstack/react-query";

import {
  getLeadership,
  getPresence,
  getProposalCategories,
  getSiteBasics,
} from "./content.functions";

const FIVE_MINUTES = 5 * 60 * 1000;

export const siteBasicsQuery = queryOptions({
  queryKey: ["site-basics"],
  queryFn: () => getSiteBasics(),
  staleTime: FIVE_MINUTES,
});

export const presenceQuery = queryOptions({
  queryKey: ["presence"],
  queryFn: () => getPresence(),
  staleTime: FIVE_MINUTES,
});

export const leadershipQuery = queryOptions({
  queryKey: ["leadership"],
  queryFn: () => getLeadership(),
  staleTime: FIVE_MINUTES,
});

export const proposalCategoriesQuery = queryOptions({
  queryKey: ["proposal-categories"],
  queryFn: () => getProposalCategories(),
  staleTime: FIVE_MINUTES,
});
