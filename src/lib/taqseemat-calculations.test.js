import { describe, expect, test } from "bun:test";
import { calculateTaqseematRemaining } from "./taqseemat-calculations";

describe("calculateTaqseematRemaining", () => {
  test("adds manually entered خرج amounts to the remaining balance", () => {
    expect(calculateTaqseematRemaining({
      daysTotal: 1000,
      profitTotal: 200,
      cigarettesExpenses: 100,
      salesExpenses: 50,
      outgoingTotal: 75,
      carryover: 0,
    })).toBe(725);
  });
});