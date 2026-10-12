/* Shared helpers — see discussion.md #8. apiFetch is the one canonical fetch
 * wrapper (api-response-handling.md); everything else here is DOM/formatting
 * helpers, no feature-specific logic. */

/** Escape a string before interpolating it into innerHTML. Server-derived
 * text (reason, hr_notes, employee names, ...) must always go through this;
 * plain-text-only cases should use textContent instead. */
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  // Date-only strings ("YYYY-MM-DD") parse as UTC midnight in JS; building
  // the Date from local y/m/d instead avoids the day shifting backwards for
  // users west of UTC.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(isoDateTime) {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (isNaN(d.getTime())) return isoDateTime;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Local-time "YYYY-MM-DD", matching the date-only strings leave requests
// store — not toISOString(), which is UTC and can land on the wrong day.
function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return (value || "").trim();
}

/* ISO 3166-1 alpha-2 from Intl — stdlib, no dependency, no hardcoded country
 * list to go stale. Shared by the directory's nationality/address-country
 * selects and the signup country select. */
function countryList() {
  if (typeof Intl.DisplayNames !== "function") return [];
  const names = new Intl.DisplayNames(undefined, { type: "region" });
  // Intl.supportedValuesOf has no "region", so walk AA..ZZ and keep the
  // codes DisplayNames can actually name — anything unassigned comes back as
  // the code itself.
  const out = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a) + String.fromCharCode(b);
      let label;
      try {
        label = names.of(code);
      } catch (e) {
        continue;
      }
      if (label && label !== code) out.push({ code: code, label: label });
    }
  }
  return out.sort((x, y) => x.label.localeCompare(y.label));
}

let _countries = null;
function countries() {
  if (!_countries) _countries = countryList();
  return _countries;
}

function countryName(code) {
  if (!code) return null;
  const hit = countries().find((c) => c.code === code);
  return hit ? hit.label : code;
}

/* Force every email field to lowercase as the user types. Server-side we
 * also normalizeEmail(); this just keeps the visible value honest. */
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.matches || !el.matches('input[type="email"]')) return;
  const lower = el.value.toLowerCase();
  if (lower === el.value) return;
  const pos = el.selectionStart;
  el.value = lower;
  if (pos !== null) el.setSelectionRange(pos, pos);
});

/* ------------------------------------------------------------------
 * Loading overlay — reference counted, 1s delay before showing so a
 * fast call never flashes it. See loading-overlay.md.
 * ------------------------------------------------------------------ */
let _loadingCount = 0;
let _loadingTimer = null;

function showLoading() {
  _loadingCount++;
  if (_loadingCount === 1) {
    _loadingTimer = setTimeout(() => {
      const el = document.getElementById("loading-overlay");
      if (el) el.classList.add("visible");
    }, 1000);
  }
}

function hideLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0) {
    clearTimeout(_loadingTimer);
    const el = document.getElementById("loading-overlay");
    if (el) el.classList.remove("visible");
  }
}

/* ------------------------------------------------------------------
 * Notifications — see api-response-handling.md.
 * ------------------------------------------------------------------ */
function _pushNotification(kind, message) {
  let stack = document.getElementById("notification-stack");
  if (!stack) {
    // Not every page ships the container; create it so alerts (e.g. RBAC
    // "You are not HR") are never silently dropped.
    stack = document.createElement("div");
    stack.id = "notification-stack";
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = "app-notification app-notification--" + kind;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  const msg = document.createElement("div");
  msg.className = "app-notification-message";
  msg.textContent = message;
  el.appendChild(msg);

  const autoDismiss = kind !== "error";
  if (!autoDismiss) {
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "app-notification-close";
    closeBtn.setAttribute("aria-label", "Dismiss");
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => el.remove());
    el.appendChild(closeBtn);
  } else {
    setTimeout(() => el.remove(), 4000);
  }
  stack.appendChild(el);
}

/** For API call results, keyed to the HTTP status. See
 * api-response-handling.md's Notification Types / Error Messages. */
function showApiNotification(status, message) {
  if (status >= 200 && status < 300) {
    _pushNotification("success", message || "Done.");
    return;
  }
  if (status === 401 || status === 403) {
    _pushNotification("error", message || "You do not have permission to do that.");
    return;
  }
  if (status >= 400 && status < 500) {
    _pushNotification("error", message || "That request could not be completed.");
    return;
  }
  if (status >= 500) {
    _pushNotification("error", message || "Something went wrong on our end. Please try again.");
    return;
  }
  _pushNotification("error", message || "Could not reach the server. Check your connection.");
}

/** For non-API feedback only — client-side validation, demo-mode notices,
 * local state changes. Always auto-dismisses. */
function showToast(message, type) {
  _pushNotification(type === "error" ? "error" : type === "success" ? "success" : "info", message);
  if (type === "error") {
    // Toasts always auto-dismiss, even error ones — only apiFetch results
    // get the manual-close treatment.
    const stack = document.getElementById("notification-stack");
    const last = stack && stack.lastElementChild;
    if (last) {
      setTimeout(() => last.remove(), 4000);
      const closeBtn = last.querySelector(".app-notification-close");
      if (closeBtn) closeBtn.remove();
    }
  }
}

/** Show a rejected apiClient call as an error notification, keyed to its
 * HTTP status. Use as `.catch(reportApiError)` on any mutation whose failure
 * would otherwise leave the button silently doing nothing. */
function reportApiError(err) {
  showApiNotification(err && err.status, err && err.body && err.body.summary);
}

/** Disable a form's submit button until `promise` settles, so a double-click
 * can't fire the request twice. See form-validation.md "Disabling the Submit
 * Button". Returns the same promise. */
function withSubmitDisabled(form, promise) {
  const btn = form && form.querySelector('[type="submit"]');
  if (btn) btn.disabled = true;
  return Promise.resolve(promise).finally(() => {
    if (btn) btn.disabled = false;
  });
}

/** Danger confirmation. Resolves true only if the user confirms. Builds its
 * own one-off Bootstrap modal so no per-page markup is needed. The message
 * must name the resource being acted on — see page-patterns.md Cross-Pattern
 * Rules. */
function confirmDanger(message, confirmLabel) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal fade";
    wrap.innerHTML =
      '<div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
      '<div class="modal-body"><p class="mb-0"></p></div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Keep</button>' +
      '<button type="button" class="btn btn-danger" data-confirm></button>' +
      "</div></div></div>";
    wrap.querySelector(".modal-body p").textContent = message;
    wrap.querySelector("[data-confirm]").textContent = confirmLabel || "Confirm";
    document.body.appendChild(wrap);
    const modal = new bootstrap.Modal(wrap);
    let confirmed = false;
    wrap.querySelector("[data-confirm]").addEventListener("click", () => {
      confirmed = true;
      modal.hide();
    });
    wrap.addEventListener("hidden.bs.modal", () => {
      wrap.remove();
      resolve(confirmed);
    });
    modal.show();
  });
}

/* ------------------------------------------------------------------
 * reCAPTCHA v3 — invisible, score-based. The site key lives in config.json
 * (public by design, unlike the secret key the backend verifies with); the
 * script tag is injected here rather than hardcoded per-page since the key
 * isn't known until config.json loads. Backend actions: signup, login,
 * forgot_password.
 * ------------------------------------------------------------------ */
let _recaptchaReady = null;
function _loadRecaptcha() {
  if (!_recaptchaReady) {
    _recaptchaReady = window.AppConfigReady.then(() => {
      const siteKey = window.AppConfig.recaptchaSiteKey;
      if (!siteKey) return null;
      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://www.google.com/recaptcha/api.js?render=" + encodeURIComponent(siteKey);
        script.onload = () => {
          // The badge always mounts fixed to the viewport corner; relocating
          // the same DOM node into a page-provided slot (rather than
          // re-rendering a second widget) keeps it inline in the form's flow
          // wherever a page opts in. Pages without a slot get the default
          // fixed corner badge, unchanged.
          grecaptcha.ready(() => {
            const slot = document.getElementById("recaptcha-badge-slot");
            const badge = document.querySelector(".grecaptcha-badge");
            if (slot && badge) slot.appendChild(badge);
          });
          resolve(siteKey);
        };
        document.head.appendChild(script);
      });
    });
  }
  return _recaptchaReady;
}

/** Resolves to a fresh token for the given backend action ("signup",
 * "login", "forgot_password"), or null when no site key is configured — a
 * missing key shouldn't block every auth form, only the backend enforces
 * verification. Call right before submit: v3 tokens are short-lived. */
function getCaptchaToken(action) {
  return _loadRecaptcha().then((siteKey) => {
    if (!siteKey) return null;
    return new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(siteKey, { action: action }).then(resolve, reject);
      });
    });
  });
}

/* ------------------------------------------------------------------
 * apiFetch — the one shared wrapper. Resolves to {ok, status, body} for
 * any HTTP response; throws only on network failure. Routes to the mock
 * layer (js/mock-data.js) or a real fetch() based on AppConfig.mockMode —
 * the only place that flag is read. See api-response-handling.md,
 * config-loading.md and mock-data.md.
 * ------------------------------------------------------------------ */
async function apiFetch(path, method, body, opts) {
  method = method || "GET";
  opts = opts || {};
  await window.AppConfigReady;

  const mutating = method !== "GET";
  if (mutating) showLoading();
  try {
    let result;
    if (window.AppConfig && window.AppConfig.mockMode) {
      result = await window.mockFetch(path, method, body);
    } else {
      // FormData (photo upload) must go through as-is with no Content-Type -
      // the browser sets the multipart boundary itself; everything else is
      // JSON like every other endpoint.
      const isFormData = body instanceof FormData;
      const res = await fetch(window.AppConfig.apiBaseUrl + path, {
        method: method,
        headers: body && !isFormData ? { "Content-Type": "application/json" } : {},
        credentials: "include",
        body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      });
      const contentType = res.headers.get("content-type") || "";
      let parsed = null;
      if (contentType.includes("application/json")) {
        try {
          parsed = await res.json();
        } catch (e) {
          parsed = null;
        }
      }
      result = { ok: res.ok, status: res.status, body: parsed };
    }

    if (result.status === 401 && path !== "/auth/me" && path !== "/auth/login") {
      const returnTo = location.pathname + location.search;
      window.location.href = "login.html?redirect=" + encodeURIComponent(returnTo);
    }
    return result;
  } finally {
    if (mutating) hideLoading();
  }
}
