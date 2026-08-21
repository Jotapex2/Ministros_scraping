import { describe, expect, it } from "vitest";
import { addXDateRange, isXTimelineResponse } from "./local-x";

describe("X scraper routing", () => {
  it("recognizes current and legacy timeline operations", () => {
    expect(
      isXTimelineResponse(
        "https://x.com/i/api/graphql/hash/UserOriginalsTimeline?variables=x",
      ),
    ).toBe(true);
    expect(
      isXTimelineResponse(
        "https://x.com/i/api/graphql/hash/UserTweets?variables=x",
      ),
    ).toBe(true);
    expect(
      isXTimelineResponse(
        "https://x.com/i/api/graphql/hash/ExploreSidebar?variables=x",
      ),
    ).toBe(false);
  });

  it("adds date operators once", () => {
    const since = Date.parse("2026-08-19T00:00:00Z") / 1000;
    const until = Date.parse("2026-08-19T23:59:59Z") / 1000;
    expect(addXDateRange("Gobierno de Chile", since, until)).toBe(
      "Gobierno de Chile since:2026-08-19 until:2026-08-20",
    );
    expect(
      addXDateRange(
        "from:cuenta since:2026-08-01 until:2026-08-10",
        since,
        until,
      ),
    ).toBe("from:cuenta since:2026-08-01 until:2026-08-10");
  });
});
