/* One card per leave type (balance comes from the API, a ledger SUM — never
 * computed client-side, see discussion.md #7), clamped to 0 so a used-up type
 * never shows negative, plus one combined "Loss of Pay" card totaling any
 * overrun across every section (client-computed: this file has no server-side
 * concept linking an exhausted CL/PL day to an LOP ledger entry). */

function renderLeaveBalanceCards(container, balances) {
  if (!balances.length) {
    container.innerHTML = '<div class="text-body-secondary small">No leave balances configured.</div>';
    return;
  }

  let lopDays = 0;
  const cards = [];
  balances.forEach((b) => {
    const n = Number(b.balance);
    if (b.leaveTypeCode === "LOP") {
      // Folded into the combined LOP card below instead of shown on its own.
      if (Number.isFinite(n) && n < 0) lopDays += -n;
      return;
    }
    if (Number.isFinite(n) && n < 0) {
      lopDays += -n;
      cards.push(renderCard(b.leaveTypeName, 0));
    } else {
      cards.push(renderCard(b.leaveTypeName, b.balance));
    }
  });
  cards.push(renderCard("Loss of Pay (LOP)", lopDays));
  container.innerHTML = cards.join("");
}

function renderCard(name, balance) {
  return (
    '<div class="card p-3 me-2 mb-2" style="min-width: 160px;">' +
    '<div class="text-secondary small">' + esc(name) + "</div>" +
    '<div class="fs-3 fw-semibold">' + esc(formatBalance(balance)) + "</div>" +
    "</div>"
  );
}

/* Round to one decimal, drop the decimal when it's a whole number — balances
 * can be fractional (0.8/month accrual). */
function formatBalance(balance) {
  const n = Number(balance);
  if (!Number.isFinite(n)) return balance;
  return Math.round(n * 10) / 10;
}
