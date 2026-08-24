/* One card per leave type. Balance comes from the API (ledger SUM),
 * never computed client-side — see discussion.md #7. */

function renderLeaveBalanceCards(container, balances) {
  container.innerHTML = balances.length
    ? balances
        .map(
          (b) =>
            '<div class="card p-3 me-2 mb-2" style="min-width: 160px;">' +
            '<div class="text-secondary small">' + esc(b.leaveTypeName) + "</div>" +
            '<div class="fs-3 fw-semibold">' + esc(formatBalance(b.balance)) + "</div>" +
            "</div>"
        )
        .join("")
    : '<div class="text-body-secondary small">No leave balances configured.</div>';
}

/* Balances are ledger sums (see comment above) so they can come back as
 * negative (LOP overrun) or fractional (0.8/month accrual) — round to one
 * decimal, drop the decimal when it's a whole number. */
function formatBalance(balance) {
  const n = Number(balance);
  if (!Number.isFinite(n)) return balance;
  return Math.round(n * 10) / 10;
}
