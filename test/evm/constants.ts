export const BUILTIN_ERRORS_ABI = [
  {
    type: "error",
    name: "Error",
    inputs: [{ name: "message", type: "string" }],
  },
] as const;
