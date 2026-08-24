/* Picks real vs mock client based on config/ui-config.*.json's api.mode.
 * Fail-fast: no silent default if the flag is missing/invalid. */

const apiClient = (function () {
  if (typeof window.__uiConfig === "undefined" || !window.__uiConfig.api || !window.__uiConfig.api.mode) {
    throw new Error("ui-config.json missing api.mode — load config before this script");
  }
  const mode = window.__uiConfig.api.mode;
  if (mode === "mock") return mockApiClient;
  if (mode === "real") return realApiClient;
  throw new Error('Invalid api.mode "' + mode + '" — expected "mock" or "real"');
})();
