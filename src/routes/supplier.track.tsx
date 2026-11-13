import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/supplier/track")({
  beforeLoad: () => {
    throw redirect({ to: "/track-proposal", statusCode: 301 });
  },
});
