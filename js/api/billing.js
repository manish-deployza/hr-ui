/* Billing screen. GET /billing/subscription fills the current-plan card;
 * GET /billing/plans fills the catalog table. Subscribe/change-plan and
 * cancel each go through confirmDanger first — see
 * prompts/features/billing.md.
 *
 * POST /billing/subscribe returns the SubscriptionData row plus, when a
 * charge is needed, {razorpaySubscriptionId, razorpayKeyId} — used to open
 * the Razorpay Checkout popup (checkout.js, loaded in billing.html) via
 * `subscription_id` + `key`. checkoutUrl is still sent as a fallback (e.g.
 * if a browser blocks the popup) and used only when razorpaySubscriptionId
 * is absent. Status stays PENDING until Razorpay's webhook/reconcile job
 * confirms the payment server-side — the popup's handler just re-fetches
 * the subscription rather than assuming ACTIVE. Neither field is set when
 * no payment is needed (e.g. FREE plan) or the gateway is disabled. */

let billingPlans = [];
let currentPlanCode = null;

document.addEventListener("session-ready", function (e) {
  if (e.detail.role !== "ORG_ADMIN") {
    window.location.replace("dashboard.html");
    return;
  }
  loadBilling();
});

function loadBilling() {
  // Independent fetches, not Promise.all — /billing/subscription isn't
  // deployed on the backend yet (404) while /billing/plans already works;
  // one failing must not blank out the other. Each render call uses
  // whatever's loaded so far and self-corrects once the other resolves,
  // regardless of arrival order.
  apiClient
    .billingPlans()
    .then((plans) => {
      billingPlans = plans;
      renderPlans(plans, currentPlanCode);
    })
    .catch((err) => showBillingError(err.message || "Could not load plans."));

  apiClient
    .billingSubscription()
    .then((subscription) => {
      renderSubscription(subscription);
      renderPlans(billingPlans, currentPlanCode);
    })
    .catch((err) => showBillingError(err.message || "Could not load current subscription."));
}

const SEAT_UNLIMITED = 2147483647;

function formatPrice(plan) {
  if (plan.customPricing) return "Custom";
  if (!plan.priceMinor) return "Free";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: plan.currency, maximumFractionDigits: 0 }).format(plan.priceMinor / 100);
}

function formatPeriod(plan) {
  if (plan.customPricing) return "Contact sales";
  if (!plan.priceMinor) return "Free forever";
  return plan.billingPeriod === "MONTHLY" ? "per month" : plan.billingPeriod === "YEARLY" ? "per year" : "";
}

function planFeatures(plan) {
  const features = [plan.seatLimit >= SEAT_UNLIMITED ? "Unlimited employees" : "Up to " + plan.seatLimit + " employees"];
  if (plan.customPricing) features.push("Custom pricing — contact sales");
  else if (plan.priceMinor) features.push("Billed " + plan.billingPeriod.toLowerCase());
  return features;
}

function renderSubscription(subscription) {
  currentPlanCode = subscription.planCode;
  document.getElementById("billing-current-plan").textContent = subscription.planName || subscription.planCode;
  document.getElementById("billing-current-status").textContent =
    subscription.status + (subscription.currentPeriodEnd ? " · renews " + formatDate(subscription.currentPeriodEnd) : "") +
    (subscription.pendingPlanCode ? " · " + subscription.pendingPlanCode + " awaiting payment" : "");
  document.getElementById("billing-cancel-btn").hidden = subscription.planCode === "FREE";
}

function renderPlans(plans, activePlanCode) {
  document.getElementById("billing-plans-body").innerHTML = plans
    .map((p) => {
      const isActive = p.code === activePlanCode;
      const features = planFeatures(p)
        .map((f) => '<li><i class="bi bi-check-circle-fill"></i>' + esc(f) + "</li>")
        .join("");
      return (
        '<div class="col-12 col-md-6 col-xl-3">' +
        '<div class="plan-card' + (isActive ? " is-current" : "") + '">' +
        '<div class="d-flex justify-content-between align-items-center mb-3">' +
        '<h3 class="plan-name">' + esc(p.name) + "</h3>" +
        (isActive ? '<span class="plan-badge">Current plan</span>' : "") +
        "</div>" +
        '<div class="plan-price">' + esc(formatPrice(p)) + "</div>" +
        '<div class="plan-period">' + esc(formatPeriod(p)) + "</div>" +
        '<div class="plan-divider"></div>' +
        '<ul class="plan-features">' + features + "</ul>" +
        (isActive
          ? '<button type="button" class="plan-btn" disabled>Current plan</button>'
          : '<button type="button" class="plan-btn" data-subscribe="' + esc(p.code) + '">Get started</button>') +
        "</div></div>"
      );
    })
    .join("");
}

document.getElementById("billing-plans-body").addEventListener("click", function (ev) {
  const btn = ev.target.closest("[data-subscribe]");
  if (!btn) return;
  const planCode = btn.getAttribute("data-subscribe");
  const plan = billingPlans.find((p) => p.code === planCode);
  if (!plan) return;

  confirmDanger("Switch to the " + plan.name + " plan?", "Subscribe").then((confirmed) => {
    if (!confirmed) return;
    apiClient
      .subscribe(planCode)
      .then((result) => {
        if (result && result.razorpaySubscriptionId) {
          openRazorpayCheckout(result);
        } else if (result && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          loadBilling();
        }
      })
      .catch(reportApiError);
  });
});

document.getElementById("billing-cancel-btn").addEventListener("click", function () {
  confirmDanger("Cancel your subscription? This downgrades the organization to the Free plan immediately.", "Cancel subscription").then((confirmed) => {
    if (!confirmed) return;
    apiClient
      .cancelSubscription()
      .then(() => loadBilling())
      .catch(reportApiError);
  });
});

function openRazorpayCheckout(result) {
  new Razorpay({
    key: result.razorpayKeyId,
    subscription_id: result.razorpaySubscriptionId,
    name: (window.AppConfig && window.AppConfig.appName) || "Billing",
    handler: function () {
      // Payment done client-side; status flips to ACTIVE via the webhook/
      // reconcile job, not here — re-fetch rather than assume it happened.
      loadBilling();
    },
    modal: {
      ondismiss: function () {
        loadBilling();
      },
    },
  }).open();
}

function showBillingError(message) {
  const errorEl = document.getElementById("billing-error");
  errorEl.textContent = message;
  errorEl.hidden = false;
}
