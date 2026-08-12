import { describe, expect, it } from "vitest";
import { csvString } from "./csv";

describe("CSV export", () => {
  it("uses BOM, semicolon and escaped quotes", () => {
    const output = csvString([
      { texto: 'Chile, "país"\nsegunda línea', valor: 3 },
    ]);
    expect(output.startsWith("\uFEFF")).toBe(true);
    expect(output).toContain(";");
    expect(output).toContain('"Chile, ""país"" segunda línea"');
  });
});
