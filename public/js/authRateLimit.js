export const ACCOUNT_RATE_LIMIT_STORAGE_KEY = "pokedleAccountRateLimitUntil";
const accountRateLimitWindowMs = 60 * 60 * 1000;

export function initializeAuthRateLimit(loginButton) {
  let rateLimitToast;
  let rateLimitToastTimeout;
  let rateLimitToastRemovalTimeout;
  let accountRateLimitTimeout;

  function showRateLimitToast(message) {
    if (!rateLimitToast) {
      rateLimitToast = document.createElement("div");
      rateLimitToast.className = "rate-limit-toast";
      rateLimitToast.setAttribute("role", "alert");
      rateLimitToast.setAttribute("aria-live", "assertive");
      document.body.appendChild(rateLimitToast);
    }

    clearTimeout(rateLimitToastTimeout);
    clearTimeout(rateLimitToastRemovalTimeout);
    rateLimitToast.textContent = message;
    rateLimitToast.hidden = false;
    requestAnimationFrame(() => rateLimitToast.classList.add("is-visible"));
    rateLimitToastTimeout = window.setTimeout(() => {
      rateLimitToast.classList.remove("is-visible");
      rateLimitToastRemovalTimeout = window.setTimeout(() => {
        rateLimitToast.hidden = true;
      }, 250);
    }, 3000);
  }

  function applyAccountRateLimit(until) {
    const remainingMs = until - Date.now();
    if (accountRateLimitTimeout) window.clearTimeout(accountRateLimitTimeout);

    if (remainingMs <= 0) {
      if (loginButton) loginButton.disabled = false;
      document.documentElement.removeAttribute("data-account-rate-limited");
      try {
        localStorage.removeItem(ACCOUNT_RATE_LIMIT_STORAGE_KEY);
      } catch (error) {
        console.error("Failed to clear account rate limit state:", error);
      }
      return;
    }

    if (loginButton) loginButton.disabled = true;
    document.documentElement.dataset.accountRateLimited = "true";
    accountRateLimitTimeout = window.setTimeout(() => {
      if (loginButton) loginButton.disabled = false;
      document.documentElement.removeAttribute("data-account-rate-limited");
      try {
        localStorage.removeItem(ACCOUNT_RATE_LIMIT_STORAGE_KEY);
      } catch (error) {
        console.error("Failed to clear account rate limit state:", error);
      }
    }, remainingMs);
  }

  try {
    const until = Number(localStorage.getItem(ACCOUNT_RATE_LIMIT_STORAGE_KEY));
    applyAccountRateLimit(until);
  } catch (error) {
    console.error("Failed to restore account rate limit state:", error);
  }

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 429) {
        showRateLimitToast(
          error.response.data?.error ||
            "Too many requests. Please try again later.",
        );
      }
      return Promise.reject(error);
    },
  );

  const pageUrl = new URL(window.location.href);
  const rateLimitMessage = pageUrl.searchParams.get("rateLimitToast");
  if (rateLimitMessage) {
    showRateLimitToast(rateLimitMessage);
    pageUrl.searchParams.delete("rateLimitToast");
    window.history.replaceState(
      null,
      "",
      `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`,
    );
  }
  const renderedMessage = document.body.dataset.rateLimitToast;
  if (renderedMessage) showRateLimitToast(renderedMessage);

  return {
    applyAccountRateLimit,
    isAccountModificationRateLimit(error) {
      return (
        error.response?.status === 429 &&
        error.response.data?.error ===
          "Too many account modification requests."
      );
    },
    get fallbackWindowMs() {
      return accountRateLimitWindowMs;
    },
  };
}
