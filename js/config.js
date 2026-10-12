/* Fetches config.json and exposes window.AppConfig / window.AppConfigReady.
 * Must be the first script on every page — see config-loading.md. */
window.AppConfigReady = fetch("config.json")
  .then((r) => {
    if (!r.ok) throw new Error("Failed to load config.json");
    return r.json();
  })
  .then((cfg) => {
    // ?mock=true / ?mock=false overrides config.json for this page load only,
    // so the UI can be driven off js/mock-data.js without editing a config
    // file that's pointed at a real backend. Same spirit as the ?role= and
    // ?emailVerified= overrides mock-data.js already honours. The DEV MODE
    // badge in the header follows this flag, so an overridden page still says
    // so on screen.
    const override = new URLSearchParams(location.search).get("mock");
    if (override === "true") cfg.mockMode = true;
    if (override === "false") cfg.mockMode = false;
    window.AppConfig = cfg;
  })
  .catch((err) => {
    console.error("Config load failed:", err);
    window.AppConfig = { apiBaseUrl: "", mockMode: false, features: {} };
  });
