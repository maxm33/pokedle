import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import "./retryPolicy.js";
import { auth } from "./auth.js";
import {
  getClosestNotificationIndex,
  renderNotificationIndicators,
} from "./notificationCarousel.js";

const seenStorageKey = "rankingNotificationSeenIds";
let seenNotificationIds = new Set();
try {
  const storedIds = JSON.parse(localStorage.getItem(seenStorageKey) || "[]");
  if (Array.isArray(storedIds))
    seenNotificationIds = new Set(
      storedIds.filter((id) => typeof id === "string"),
    );
} catch (error) {
  console.error("Failed to restore ranking notifications:", error);
}

function createNotificationCard(notification) {
  const card = document.createElement("div");
  card.id = `ranking-notification-${notification.id}`;
  card.className = "event-notification";
  card.setAttribute("role", "status");
  card.setAttribute("aria-live", "polite");

  const icon = document.createElement("span");
  icon.className = "event-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent =
    notification.type === "monthly-award" ? "🏆" : "🔔";

  const message = document.createElement("span");
  message.textContent = notification.message;

  const dismiss = document.createElement("button");
  dismiss.className = "event-notification-dismiss";
  dismiss.type = "button";
  dismiss.setAttribute("aria-label", "Hide this notification");
  dismiss.title = "Hide notification";
  dismiss.textContent = "🗑";
  dismiss.addEventListener("click", () => {
    card.hidden = true;
    window.dispatchEvent(
      new CustomEvent("ranking-notification-dismissed", {
        detail: { card },
      }),
    );
  });

  card.append(icon, message, dismiss);
  return card;
}

const isClassicPage = Boolean(document.querySelector("#event-notification"));
const notificationSwiper = document.getElementById(
  "event-notification-swiper",
);
const sentryNotifications = [];
let currentNotificationIndex = 0;

function renderSentryNotifications() {
  const carousel = document.getElementById("event-notifications");
  const indicators = document.getElementById("event-notification-indicators");
  const previous = document.getElementById("event-notification-previous");
  const next = document.getElementById("event-notification-next");
  if (!carousel || !indicators || !previous || !next) return;

  const visible = sentryNotifications.filter((card) => !card.hidden);
  carousel.hidden = visible.length === 0;
  indicators.hidden = visible.length < 2;
  previous.hidden = visible.length < 2;
  next.hidden = visible.length < 2;
  if (currentNotificationIndex >= visible.length)
    currentNotificationIndex = Math.max(0, visible.length - 1);
  renderNotificationIndicators(
    indicators,
    visible,
    currentNotificationIndex,
    (index) => {
      currentNotificationIndex = index;
      notificationSwiper.scrollTo({
        left: visible[index].offsetLeft,
        behavior: "smooth",
      });
      renderSentryNotifications();
    },
    (index) => `Show notification ${index + 1}`,
  );
}

if (!isClassicPage && notificationSwiper) {
  document
    .getElementById("event-notification-previous")
    ?.addEventListener("click", () => {
      const visible = sentryNotifications.filter((card) => !card.hidden);
      if (!visible.length) return;
      currentNotificationIndex =
        (currentNotificationIndex - 1 + visible.length) % visible.length;
      notificationSwiper.scrollTo({
        left: visible[currentNotificationIndex].offsetLeft,
        behavior: "smooth",
      });
      renderSentryNotifications();
    });
  document
    .getElementById("event-notification-next")
    ?.addEventListener("click", () => {
      const visible = sentryNotifications.filter((card) => !card.hidden);
      if (!visible.length) return;
      currentNotificationIndex =
        (currentNotificationIndex + 1) % visible.length;
      notificationSwiper.scrollTo({
        left: visible[currentNotificationIndex].offsetLeft,
        behavior: "smooth",
      });
      renderSentryNotifications();
    });
  notificationSwiper.addEventListener("scroll", () => {
    const visible = sentryNotifications.filter((card) => !card.hidden);
    if (!visible.length) return;
    const swiperLeft = notificationSwiper.getBoundingClientRect().left;
    currentNotificationIndex = getClosestNotificationIndex(
      visible,
      swiperLeft,
    );
    document
      .querySelectorAll(".event-notification-indicator")
      .forEach((indicator, index) => {
        if (index === currentNotificationIndex)
          indicator.setAttribute("aria-current", "true");
        else indicator.removeAttribute("aria-current");
      });
  });
  window.addEventListener("ranking-notification", (event) => {
    sentryNotifications.push(event.detail.card);
    notificationSwiper.appendChild(event.detail.card);
    currentNotificationIndex = sentryNotifications.length - 1;
    renderSentryNotifications();
    notificationSwiper.scrollTo({
      left: event.detail.card.offsetLeft,
      behavior: "smooth",
    });
  });
  window.addEventListener(
    "ranking-notification-dismissed",
    renderSentryNotifications,
  );
}

function rememberNotification(id) {
  seenNotificationIds.add(id);
  const ids = [...seenNotificationIds].slice(-200);
  seenNotificationIds = new Set(ids);
  try {
    localStorage.setItem(seenStorageKey, JSON.stringify(ids));
  } catch (error) {
    console.error("Failed to save ranking notification state:", error);
  }
}

function showNotification(notification) {
  if (
    typeof notification.id !== "string" ||
    typeof notification.message !== "string" ||
    seenNotificationIds.has(notification.id)
  )
    return;

  rememberNotification(notification.id);
  const card = createNotificationCard(notification);
  window.dispatchEvent(
    new CustomEvent("ranking-notification", {
      detail: { card },
    }),
  );
}

async function consumeNotificationStream(user, signal) {
  const token = await user.getIdToken();
  const seen = encodeURIComponent([...seenNotificationIds].join(","));
  const response = await fetch(`/notifications/stream?seen=${seen}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok)
    throw new Error(`Notification stream returned HTTP ${response.status}`);
  if (!response.body) throw new Error("Notification stream has no response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      events.forEach((event) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (data) showNotification(JSON.parse(data));
      });
    }
  } finally {
    reader.releaseLock();
  }
}

let activeStreamController;
let retryAttempt = 0;
onAuthStateChanged(
  auth,
  (user) => {
    activeStreamController?.abort();
    retryAttempt = 0;
    if (!user) return;

    const controller = new AbortController();
    activeStreamController = controller;
    (async () => {
      while (auth.currentUser?.uid === user.uid && !controller.signal.aborted) {
        try {
          await consumeNotificationStream(user, controller.signal);
          retryAttempt = 0;
        } catch (error) {
          if (controller.signal.aborted) return;
          console.error("Ranking notification stream disconnected:", error);
          retryAttempt++;
        }
        if (controller.signal.aborted) return;
        const retryDelay =
          globalThis.NotificationRetryPolicy.getNotificationRetryDelay(
            retryAttempt,
          );
        if (document.visibilityState === "hidden") {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          continue;
        }
        await new Promise((resolve) =>
          window.setTimeout(resolve, retryDelay),
        );
      }
    })();
  },
  (error) => console.error("Ranking notification auth listener failed:", error),
);
