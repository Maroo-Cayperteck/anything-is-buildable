import { describe, expect, it } from "vitest";
import { STUDENT_PROFILE } from "@/lib/accounts.functions";

describe("Omar Ahmed's cumulative GPA", () => {
  it("uses 2.7 as the portal's current GPA", () => {
    expect(STUDENT_PROFILE.cgpa).toBe(2.7);
  });
});