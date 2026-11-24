const sidebar = document.getElementById("game-mode-nav");
const toggle = document.getElementById("game-mode-nav-toggle");

if (sidebar && toggle) {
  toggle.addEventListener("click", () => {
    const isCollapsed = sidebar.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    toggle.setAttribute(
      "aria-controls",
      "game-mode-nav-panel",
    );
    const label = isCollapsed ? "Expand game modes" : "Collapse game modes";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  });
}
