const dexButton = document.getElementById("onprofile-dex-button");
dexButton?.addEventListener("click", () => {
  const sidebar = document.getElementById("profile-presets");
  const profileId = sidebar?.dataset.profileId;
  if (!profileId) return;
  window.location.href = `/user/${encodeURIComponent(profileId)}/pokedex`;
});

const backgroundToggle = document.getElementById(
  "profile-background-toggle",
);
backgroundToggle?.addEventListener("click", () => {
  const isActive = document.body.classList.toggle(
    "profile-background-focus",
  );
  const label = isActive
    ? "Show the full profile"
    : "Show only the profile background";
  backgroundToggle.setAttribute("aria-pressed", String(isActive));
  backgroundToggle.setAttribute("aria-label", label);
  backgroundToggle.title = label;
});
