/* Leave type selector drives which fields render — mirrors the actual
 * policy engine in Reasoning/03-leave-policy-engine.md so the employee sees
 * a problem before submitting, not just after a 400. Every check here is a
 * client-side UX mirror only; the server (LeaveRequestService) is the real
 * source of truth and re-validates all of it.
 *
 * Deliberately NOT modeled here (out of scope for a first application):
 * - PREGNANCY_ILLNESS_EXTENSION — applied on top of an existing approved
 *   maternity request (parent_request_id), not a fresh application.
 * - The miscarriage-during-active-maternity force-transition — a server/HR
 *   action on an existing request, not something this form initiates.
 * - LOP's 15-working-days/year cap — needs "LOP already taken this year",
 *   which isn't in the balances payload this form has; only the CL/PL
 *   exhaustion gate is checked here. */

const MATERNITY_SITUATIONS = [
  { value: "UP_TO_2_CHILDREN", label: "Up to 2 children — 26 weeks", weeks: 26 },
  { value: "2_OR_MORE_CHILDREN", label: "2 or more children — 12 weeks", weeks: 12 },
  { value: "ADOPTION_UNDER_3MO", label: "Adoption, under 3 months — 12 weeks", weeks: 12 },
  { value: "COMMISSIONING_MOTHER", label: "Commissioning mother — 12 weeks", weeks: 12 },
  { value: "MISCARRIAGE", label: "Miscarriage — 6 weeks", weeks: 6 },
];

function initLeaveRequestForm(container, leaveTypes, balances, onSubmit) {
  container.innerHTML =
    '<h4 class="mb-3">Leave details</h4>' +
    '<div class="row g-3">' +
    '<div class="col-12">' +
    '<label class="form-label" for="lrf-type">Leave type</label>' +
    '<select id="lrf-type" class="form-select" required>' +
    leaveTypes.map((t) => '<option value="' + t.id + '">' + esc(t.name) + "</option>").join("") +
    "</select>" +
    '<div class="invalid-feedback">Please select a leave type.</div>' +
    '<div id="lrf-type-info" class="form-text"></div>' +
    "</div>" +
    '<div class="col-sm-6">' +
    '<label class="form-label" for="lrf-start">Start date</label>' +
    '<input type="date" id="lrf-start" class="form-control" required>' +
    '<div class="invalid-feedback">Please choose a start date.</div>' +
    "</div>" +
    '<div class="col-sm-6">' +
    '<label class="form-label" for="lrf-end">End date</label>' +
    '<input type="date" id="lrf-end" class="form-control" required>' +
    '<div class="invalid-feedback">Please choose an end date.</div>' +
    "</div>" +
    '<div class="col-sm-6" id="lrf-situation-wrap" hidden>' +
    '<label class="form-label" for="lrf-situation">Situation type</label>' +
    '<select id="lrf-situation" class="form-select" required>' +
    MATERNITY_SITUATIONS.map((s) => '<option value="' + s.value + '">' + esc(s.label) + "</option>").join("") +
    "</select>" +
    "</div>" +
    '<div class="col-sm-6" id="lrf-delivery-wrap" hidden>' +
    '<label class="form-label" for="lrf-delivery-date">Expected delivery date</label>' +
    '<input type="date" id="lrf-delivery-date" class="form-control" required>' +
    "</div>" +
    '<div class="col-12">' +
    '<div id="lrf-delivery-warning" class="alert alert-warning" hidden></div>' +
    "</div>" +
    '<div class="col-12">' +
    '<label class="form-label" for="lrf-reason">Reason</label>' +
    '<textarea id="lrf-reason" class="form-control" rows="3"></textarea>' +
    "</div>" +
    '<div class="col-12">' +
    '<div id="lrf-notice-warning" class="alert alert-warning" hidden></div>' +
    '<div id="lrf-lop-warning" class="alert alert-danger" hidden></div>' +
    "</div>" +
    "</div>" +
    '<hr class="my-4">' +
    '<button class="w-100 btn btn-primary btn-lg" type="submit">Submit request</button>';

  const typeSelect = container.querySelector("#lrf-type");
  const situationWrap = container.querySelector("#lrf-situation-wrap");
  const deliveryWrap = container.querySelector("#lrf-delivery-wrap");
  const deliveryWarning = container.querySelector("#lrf-delivery-warning");
  const startInput = container.querySelector("#lrf-start");
  const deliveryInput = container.querySelector("#lrf-delivery-date");
  const noticeWarning = container.querySelector("#lrf-notice-warning");
  const lopWarning = container.querySelector("#lrf-lop-warning");
  const typeInfo = container.querySelector("#lrf-type-info");
  const submitBtn = container.querySelector('button[type="submit"]');

  function selectedType() {
    return leaveTypes.find((t) => String(t.id) === typeSelect.value);
  }

  function balanceFor(code) {
    const entry = balances.find((b) => b.leaveTypeCode === code);
    return entry ? entry.balance : 0;
  }

  function updateConditionalFields() {
    const type = selectedType();
    situationWrap.hidden = !(type && type.requiresSituationType);
    deliveryWrap.hidden = !(type && type.requiresSituationType);
    typeInfo.textContent = (type && type.infoNote) || "";
    checkNoticePeriod(type);
    checkDeliveryWindow();
    checkLopEligibility(type);
  }

  // "Max 8 weeks of the 26-week entitlement may fall before the expected
  // delivery date" (03-leave-policy-engine.md) — mirrored as a general
  // start-date-vs-delivery-date check for any maternity request.
  function checkDeliveryWindow() {
    if (deliveryWrap.hidden || !startInput.value || !deliveryInput.value) {
      deliveryWarning.hidden = true;
      return;
    }
    const daysBeforeDelivery = Math.floor((new Date(deliveryInput.value) - new Date(startInput.value)) / 86400000);
    if (daysBeforeDelivery > 56) {
      deliveryWarning.hidden = false;
      deliveryWarning.textContent = "At most 8 weeks of maternity leave may start before the expected delivery date.";
    } else {
      deliveryWarning.hidden = true;
    }
  }

  function checkNoticePeriod(type) {
    if (!type || !type.requiresAdvanceNoticeDays || !startInput.value) {
      noticeWarning.hidden = true;
      return;
    }
    const daysUntilStart = Math.floor((new Date(startInput.value) - new Date()) / 86400000);
    if (daysUntilStart < type.requiresAdvanceNoticeDays) {
      noticeWarning.hidden = false;
      noticeWarning.textContent =
        esc(type.name) + " requires at least " + type.requiresAdvanceNoticeDays + " days' advance notice.";
    } else {
      noticeWarning.hidden = true;
    }
  }

  // LOP is "only permitted when CL and PL balances are both exhausted"
  // (03-leave-policy-engine.md) — blocks submission client-side rather than
  // just hiding the option, since seeing *why* it's blocked is more useful.
  function checkLopEligibility(type) {
    const isLop = type && type.code === "LOP";
    const eligible = balanceFor("CL") <= 0 && balanceFor("PL") <= 0;
    lopWarning.hidden = !(isLop && !eligible);
    if (isLop && !eligible) {
      lopWarning.textContent = "Loss of Pay is only available once your Casual Leave and Privilege Leave balances are both exhausted.";
    }
    submitBtn.disabled = !!(isLop && !eligible);
  }

  typeSelect.addEventListener("change", updateConditionalFields);
  startInput.addEventListener("change", updateConditionalFields);
  deliveryInput.addEventListener("change", checkDeliveryWindow);
  updateConditionalFields();

  container.closest("form").addEventListener("submit", function (e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      e.stopPropagation();
      form.classList.add("was-validated");
      return;
    }
    const type = selectedType();
    onSubmit({
      leaveTypeId: type.id,
      startDate: startInput.value,
      endDate: container.querySelector("#lrf-end").value,
      situationType: type.requiresSituationType ? container.querySelector("#lrf-situation").value : undefined,
      expectedDeliveryDate: type.requiresSituationType ? deliveryInput.value : undefined,
      reason: normalizeText(container.querySelector("#lrf-reason").value),
    });
  });
}
