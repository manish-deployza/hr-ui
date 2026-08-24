/* Single dev-time switch: "mock" while backend endpoints don't exist yet,
 * "real" once they do. No build step, so this is edited by hand — see
 * discussion.md #8. */
window.__uiConfig = {
  api: {
    mode: "mock",
  },
};
