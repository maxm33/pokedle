export function initializeProfileNameEditor(auth) {
  const profileName = document.getElementById("profile-name");
  const editButton = document.getElementById("edit-profile-name-button");
  const form = document.getElementById("profile-name-form");
  const input = document.getElementById("profile-name-input");
  const saveButton = document.getElementById("save-profile-name-button");
  const cancelButton = document.getElementById("cancel-profile-name-button");
  const saveLoader = document.getElementById("save-profile-name-loader");
  const errorMessage = document.getElementById("profile-name-error");

  if (
    !profileName ||
    !editButton ||
    !form ||
    !input ||
    !saveButton ||
    !cancelButton ||
    !errorMessage
  )
    return;

  editButton.addEventListener("click", () => {
    input.value = profileName.textContent.trim();
    errorMessage.textContent = "";
    profileName.hidden = true;
    editButton.hidden = true;
    form.hidden = false;
    input.focus();
  });

  cancelButton.addEventListener("click", () => {
    form.hidden = true;
    profileName.hidden = false;
    editButton.hidden =
      auth.currentUser?.uid !== profileName.dataset.profileUid;
    errorMessage.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentUser = auth.currentUser;
    const username = input.value.trim();
    if (!currentUser || currentUser.uid !== profileName.dataset.profileUid) {
      errorMessage.textContent = "Sign in to edit this profile name.";
      return;
    }
    if (username.length < 1 || username.length > 16) {
      errorMessage.textContent = "Username must be 1-16 characters.";
      return;
    }

    saveButton.disabled = true;
    cancelButton.disabled = true;
    form.setAttribute("aria-busy", "true");
    if (saveLoader) saveLoader.hidden = false;
    errorMessage.textContent = "";
    try {
      const token = await currentUser.getIdToken();
      await axios.patch(
        `/user/${currentUser.uid}/username`,
        { username },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      profileName.textContent = username;
      form.hidden = true;
      profileName.hidden = false;
      editButton.hidden =
        auth.currentUser?.uid !== profileName.dataset.profileUid;
    } catch (error) {
      console.error(error);
      errorMessage.textContent =
        error.response?.data?.error ||
        "Unable to update your name. Please try again.";
    } finally {
      saveButton.disabled = false;
      cancelButton.disabled = false;
      form.removeAttribute("aria-busy");
      if (saveLoader) saveLoader.hidden = true;
    }
  });
}
