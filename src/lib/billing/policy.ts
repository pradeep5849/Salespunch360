import type { TeamStructure } from "@prisma/client";

export function assertManagerSeatsAllowed(teamStructure: TeamStructure, managerSeats: number) {
  if (teamStructure === "SALES_ONLY" && managerSeats !== 0) {
    throw new Error("MANAGERS_DISABLED");
  }
}
