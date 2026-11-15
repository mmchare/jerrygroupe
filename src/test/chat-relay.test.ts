import { afterEach, describe, expect, it, vi } from "vitest";

import { relayChat } from "@/lib/chat/chat.server";

const body = JSON.stringify({ lang: "en", messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] }] });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("site assistant on deployments without the Lovable AI key", () => {
  it("forwards the question to the Lovable-hosted site and streams its answer back", async () => {
    vi.stubEnv("ASSISTANT_RELAY_SECRET", "shared-secret");
    const fetchMock = vi.fn(async () =>
      new Response("data: hello\n\n", { status: 200, headers: { "content-type": "text/event-stream" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://jerry.vercel.app/api/chat", {
      method: "POST",
      body,
      headers: { "x-real-ip": "198.51.100.7" },
    });

    const res = await relayChat(request, body, "en");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("data: hello\n\n");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://jerry-six-division-portal.lovable.app/api/chat");
    const sent = new Headers(init.headers);
    expect(sent.get("x-jg-relay-secret")).toBe("shared-secret");
    expect(sent.get("x-jg-visitor-ip")).toBe("198.51.100.7");
    expect(init.body).toBe(body);
  });

  it("refuses to relay a request that was already relayed (no loops)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://other.example/api/chat", { method: "POST", body, headers: { "x-jg-relayed": "1" } });
    const res = await relayChat(request, body, "en");
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
