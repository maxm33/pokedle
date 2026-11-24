const rankingTabs = [...document.querySelectorAll("[data-ranking-mode]")];
const periodTabs = [...document.querySelectorAll("[data-ranking-period]")];
const rankingPanels = [...document.querySelectorAll(".ranking-panel")];
const rankingLogo = document.querySelector("#logo a");

function selectRankingTab(tab, focus = false) {
  const mode = tab.dataset.rankingMode;
  const period =
    periodTabs.find(
      (periodTab) => periodTab.getAttribute("aria-selected") === "true",
    )?.dataset.rankingPeriod || "monthly";
  selectRankingView(mode, period, tab, null);
  if (focus) tab.focus();
}

function selectRankingView(mode, period, modeTab, periodTab) {
  const returnPath = mode === "sentry" ? "/sentry" : "/classic";
  rankingTabs.forEach((rankingTab) => {
    const isSelected = modeTab
      ? rankingTab === modeTab
      : rankingTab.dataset.rankingMode === mode;
    rankingTab.setAttribute("aria-selected", String(isSelected));
    rankingTab.tabIndex = isSelected ? 0 : -1;
    rankingTab.setAttribute(
      "aria-controls",
      `${rankingTab.dataset.rankingMode}-${period}-ranking-panel`,
    );
  });
  periodTabs.forEach((rankingTab) => {
    const isSelected =
      rankingTab === periodTab ||
      (!periodTab && rankingTab.dataset.rankingPeriod === period);
    rankingTab.setAttribute("aria-selected", String(isSelected));
    rankingTab.tabIndex = isSelected ? 0 : -1;
  });
  rankingPanels.forEach((panel) => {
    panel.hidden = panel.id !== `${mode}-${period}-ranking-panel`;
  });
  periodTabs.forEach((periodTab) => {
    periodTab.setAttribute(
      "aria-controls",
      `${mode}-${periodTab.dataset.rankingPeriod}-ranking-panel`,
    );
  });
  rankingLogo.href = returnPath;
  rankingLogo.setAttribute(
    "aria-label",
    mode === "sentry" ? "Return to Sentry Duty" : "Return to Classic",
  );

  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function getNextTabIndex(event, index, length) {
  if (event.key === "ArrowRight" || event.key === "ArrowDown")
    return (index + 1) % length;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp")
    return (index - 1 + length) % length;
  if (event.key === "Home") return 0;
  if (event.key === "End") return length - 1;
  return null;
}

rankingTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectRankingTab(tab));
  tab.addEventListener("keydown", (event) => {
    const nextIndex = getNextTabIndex(event, index, rankingTabs.length);
    if (nextIndex === null) return;

    event.preventDefault();
    selectRankingTab(rankingTabs[nextIndex], true);
  });
});
periodTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    const mode = rankingTabs.find(
      (rankingTab) => rankingTab.getAttribute("aria-selected") === "true",
    ).dataset.rankingMode;
    selectRankingView(mode, tab.dataset.rankingPeriod, null, tab);
  });
  tab.addEventListener("keydown", (event) => {
    const nextIndex = getNextTabIndex(event, index, periodTabs.length);
    if (nextIndex === null) return;

    event.preventDefault();
    periodTabs[nextIndex].click();
    periodTabs[nextIndex].focus();
  });
});
