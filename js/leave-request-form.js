/* Leave type selector drives which fields render — mirrors the actual
 * policy engine in Reasoning/03-leave-policy-engine.md so the employee sees
 * a problem before submitting, not just after a 400. Every check here is a
 * client-side UX mirror only; the server (LeaveRequestService) is the real
 * source of truth and re-validates all of it.
 *
 * Deliberately NOT modeled here (out of scope for a first application):
 * - LOP's 15-working-days/year cap — needs "LOP already taken this year",
 *   which isn't in the balances payload this form has; only the CL/PL
 *   exhaustion gate is checked here.
 * The maternity situation-type sub-classification (situationType /
 * requiresSituationType / SituationType) has been dropped server-side
 * entirely — no column backs it, so it is not modeled here at all. */

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
    '<div class="col-12">' +
    '<label class="form-label" for="lrf-reason">Reason</label>' +
    '<textarea id="lrf-reason" class="form-control" rows="3"></textarea>' +
    "</div>" +
    '<div class="col-12">' +
    '<div id="lrf-notice-warning" class="alert alert-warning" hidden></div>' +
    '<div id="lrf-overflow-warning" class="alert alert-warning" hidden></div>' +
    '<div id="lrf-lop-warning" class="alert alert-danger" hidden></div>' +
    "</div>" +
    "</div>" +
    '<hr class="my-4">' +
    '<button class="w-100 btn btn-primary btn-lg" type="submit">Submit request</button>';

  const typeSelect = container.querySelector("#lrf-type");
  const startInput = container.querySelector("#lrf-start");
  const endInput = container.querySelector("#lrf-end");
  const noticeWarning = container.querySelector("#lrf-notice-warning");
  const overflowWarning = container.querySelector("#lrf-overflow-warning");
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
    typeInfo.textContent = (type && type.infoNote) || "";
    checkNoticePeriod(type);
    checkLopEligibility(type);
    checkBalanceOverflow(type);
  }

  /* UX preview only — an approximate calendar-day count (server computes the
   * real numDays, e.g. excluding weekends/holidays). Any requested days beyond
   * the selected type's balance can't be granted as that type, so they'd be
   * recorded as LOP (unpaid) for the calendar year instead of blocking submit. */
  function checkBalanceOverflow(type) {
    if (!type || type.code === "LOP" || !startInput.value || !endInput.value) {
      overflowWarning.hidden = true;
      return;
    }
    const requested = Math.floor((new Date(endInput.value) - new Date(startInput.value)) / 86400000) + 1;
    const balance = balanceFor(type.code);
    const overflow = requested - balance;
    if (requested > 0 && overflow > 0) {
      overflowWarning.hidden = false;
      overflowWarning.textContent =
        Math.max(balance, 0) + " of " + requested + " requested day(s) are covered by your " + esc(type.name) +
        " balance. The remaining " + overflow + " day(s) will be recorded as Loss of Pay (unpaid leave) for this calendar year.";
    } else {
      overflowWarning.hidden = true;
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
  endInput.addEventListener("change", updateConditionalFields);
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
      reason: normalizeText(container.querySelector("#lrf-reason").value),
    });
  });
}
