/* Loads the read-only fields plus the two contact fields the employee is
 * actually allowed to change (see profile.html's comment). PATCH only sends
 * phone/address — the server would reject the rest anyway, but not sending
 * them keeps the intent obvious in the request itself. */

document.addEventListener("session-ready", function () {
  apiClient.myProfile().then((profile) => {
    document.getElementById("profile-employee-code").value = profile.employeeCode || "";
    document.getElementById("profile-name").value = profile.name;
    document.getElementById("profile-email").value = profile.email;
    document.getElementById("profile-role").value = profile.role;
    document.getElementById("profile-phone").value = profile.phone || "";
    document.getElementById("profile-address").value = profile.address || "";
  });
});

document.getElementById("profile-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const successEl = document.getElementById("profile-success");
  const errorEl = document.getElementById("profile-error");
  successEl.hidden = true;
  errorEl.hidden = true;

  apiClient
    .updateMyProfile({
      phone: normalizeText(document.getElementById("profile-phone").value),
      address: normalizeText(document.getElementById("profile-address").value),
    })
    .then(() => {
      successEl.textContent = "Contact details updated.";
      successEl.hidden = false;
    })
    .catch((err) => {
      errorEl.textContent = err.message || "Could not save changes.";
      errorEl.hidden = false;
    });
});
