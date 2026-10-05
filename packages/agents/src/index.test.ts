import { describe, expect, it } from "vitest";
import { permissionsFor } from "./index";

describe("agent permissions", () => {
  it("declares source access only for research workflows", () => {
    expect(permissionsFor("research")).toContain("read-sources");
    expect(permissionsFor("organize")).not.toContain("read-sources");
  });
});
