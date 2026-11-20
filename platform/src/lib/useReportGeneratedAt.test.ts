import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useReportGeneratedAt } from "./useReportGeneratedAt";

afterEach(() => vi.useRealTimers());

it("keeps initial report markup identical even when server and hydration times differ", () => {
  function Timestamp() {
    return createElement("time", null, useReportGeneratedAt());
  }
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T10:00:00Z"));
  const server = renderToString(createElement(Timestamp));
  vi.setSystemTime(new Date("2026-11-10T10:01:01Z"));
  const initialClient = renderToString(createElement(Timestamp));
  expect(server).toBe("<time></time>");
  expect(initialClient).toBe(server);
});
