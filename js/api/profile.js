/* Loads the read-only fields plus the two contact fields the employee is
 * actually allowed to change (see profile.html's comment). PATCH only sends
 * phone/address — the server would reject the rest anyway, but not sending
 * them keeps the intent obvious in the request itself. */

document.addEventListener("session-ready", function (e) {
  // Same "only act on an explicit boolean" rule as the dashboard banner —
  // a backend not sending the flag yet gets neither tick nor nag.
  if (e.detail && e.detail.emailVerified === true) {
    document.getElementById("profile-email-verified").hidden = false;
  } else if (e.detail && e.detail.emailVerified === false) {
    document.getElementById("profile-email-unverified").hidden = false;
  }

  apiClient.myProfile().then((profile) => {
    document.getElementById("profile-employee-code").value = profile.employeeCode || "";
    document.getElementById("profile-name").value = profile.name;
    document.getElementById("profile-email").value = profile.email;
    document.getElementById("profile-role").value = profile.role;
    document.getElementById("profile-phone").value = profile.phone || "";
    document.getElementById("profile-address").value = profile.address || "";
    showProfilePhoto(profile.hasPhoto === true);

    // HR-entered structured address (employee_sensitive), read-only here —
    // null until HR fills in the directory's Address step for this person.
    const hrAddress = [
      [profile.address1, profile.address2, profile.landmark].filter(Boolean).join(", "),
      [profile.city, profile.state, profile.postalCode].filter(Boolean).join(" "),
      countryDisplayName(profile.country),
    ].filter(Boolean);
    if (hrAddress.length) {
      document.getElementById("profile-hr-address").value = hrAddress.join("\n");
      document.getElementById("profile-hr-address-wrap").hidden = false;
    }
  });
});

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const photoImg = document.getElementById("profile-photo");
const photoPlaceholder = document.getElementById("profile-photo-placeholder");
const photoInput = document.getElementById("profile-photo-input");
const photoRemoveBtn = document.getElementById("profile-photo-remove");
const photoError = document.getElementById("profile-photo-error");

function showProfilePhoto(hasPhoto) {
  photoImg.hidden = !hasPhoto;
  photoPlaceholder.hidden = hasPhoto;
  photoRemoveBtn.hidden = !hasPhoto;
  // Cache-bust so a fresh upload replaces whatever the browser cached for this URL.
  const src = hasPhoto ? window.AppConfig.apiBaseUrl + "/employees/me/photo?t=" + Date.now() : "";
  photoImg.src = src;

  // Keep the header avatar (js/loader.js's setUserAvatar) in sync without a reload.
  const headerImg = document.getElementById("header-user-photo");
  const headerIcon = document.getElementById("header-user-icon");
  if (headerImg && headerIcon) {
    headerImg.hidden = !hasPhoto;
    headerIcon.hidden = hasPhoto;
    headerImg.src = src;
  }
}

// Crop/zoom modal (Cropper.js, CDN) — shown after picking a file, before it's
// actually uploaded, so the employee can adjust framing first.
const cropModalEl = document.getElementById("photo-crop-modal");
const cropModal = new bootstrap.Modal(cropModalEl);
const cropImage = document.getElementById("photo-crop-image");
const cropError = document.getElementById("photo-crop-error");
const cropUploadBtn = document.getElementById("photo-crop-upload");
let cropper = null;
let cropObjectUrl = null;

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  photoInput.value = "";
  if (!file) return;
  photoError.hidden = true;
  if (file.size > MAX_PHOTO_BYTES) {
    photoError.textContent = "Photo must be 2 MB or smaller.";
    photoError.hidden = false;
    return;
  }
  cropError.hidden = true;
  cropObjectUrl = URL.createObjectURL(file);
  cropImage.src = cropObjectUrl;
  cropModal.show();
});

cropModalEl.addEventListener("shown.bs.modal", () => {
  cropper = new Cropper(cropImage, { aspectRatio: 1, viewMode: 1, dragMode: "move", background: false, autoCropArea: 1, guides: false, center: false, highlight: false });
});

cropModalEl.addEventListener("hidden.bs.modal", () => {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  if (cropObjectUrl) {
    URL.revokeObjectURL(cropObjectUrl);
    cropObjectUrl = null;
  }
  cropImage.src = "";
  cropError.hidden = true;
  cropUploadBtn.disabled = false;
});

cropUploadBtn.addEventListener("click", () => {
  if (!cropper) return;
  cropError.hidden = true;
  cropUploadBtn.disabled = true;
  cropper.getCroppedCanvas({ width: 480, height: 480 }).toBlob((blob) => {
    if (!blob) {
      cropError.textContent = "Could not process that image.";
      cropError.hidden = false;
      cropUploadBtn.disabled = false;
      return;
    }
    const formData = new FormData();
    formData.append("photo", blob, "photo.jpg");
    apiClient
      .uploadMyPhoto(formData)
      .then(() => {
        showProfilePhoto(true);
        cropModal.hide();
      })
      .catch((err) => {
        cropError.textContent = err.message || "Could not upload photo.";
        cropError.hidden = false;
        cropUploadBtn.disabled = false;
      });
  }, "image/jpeg", 0.92);
});

photoRemoveBtn.addEventListener("click", () => {
  confirmDanger("Remove your profile photo?", "Remove").then((confirmed) => {
    if (!confirmed) return;
    photoError.hidden = true;
    apiClient
      .deleteMyPhoto()
      .then(() => showProfilePhoto(false))
      .catch((err) => {
        photoError.textContent = err.message || "Could not remove photo.";
        photoError.hidden = false;
      });
  });
});

function countryDisplayName(code) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) || code;
  } catch (e) {
    return code;
  }
}

document.getElementById("profile-resend-verification").addEventListener("click", function (e) {
  e.preventDefault();
  apiClient
    .resendVerificationEmail()
    .then(() => showToast("Verification email sent — check your inbox.", "success"))
    .catch((err) => showToast(err.message || "Could not send verification email.", "danger"));
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
