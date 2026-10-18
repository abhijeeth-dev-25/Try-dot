import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getCurrentTime = tool(
  async () => {
    return new Date().toLocaleString();
  },
  {
    name: "get_current_time",
    description: "Get the current date and real-time clock.",
    schema: z.object({}),
  }
);
