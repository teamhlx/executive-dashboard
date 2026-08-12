export const API_ORIGIN =
  "https://5j0ivfhs38.execute-api.us-west-2.amazonaws.com/prod";

// In `next dev`, calls go same-origin and are proxied (see next.config.ts).
const baseUrl = process.env.NODE_ENV === "development" ? "" : API_ORIGIN;

export const projects = [
  {
    id: "skematic",
    name: "Skematic",
    jiraProject: "SM",
    description: "AI-powered partner management platform",
    apiUrl: `${baseUrl}/api/jira`,
    baseUrl,
  },
  {
    id: "outset",
    name: "Outset",
    jiraProject: "OUT",
    description: "Sales capacity and resource management",
    apiUrl: `${baseUrl}/api/jira`,
    baseUrl,
  },
];
