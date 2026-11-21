import {
  getClosestNotificationIndex,
  renderNotificationIndicators,
} from "./notificationCarousel.js";

export function initializeClassicEventNotifications() {
  const eventNotification = document.getElementById("event-notification");
  const eventNotificationDouble = document.getElementById(
    "event-notification-double",
  );
  const eventNotificationShiny = document.getElementById(
    "event-notification-shiny",
  );
  const eventNotifications = document.getElementById("event-notifications");
  const eventNotificationSwiper = document.getElementById(
    "event-notification-swiper",
  );
  const eventNotificationIndicators = document.getElementById(
    "event-notification-indicators",
  );
  const eventNotificationPrevious = document.getElementById(
    "event-notification-previous",
  );
  const eventNotificationNext = document.getElementById(
    "event-notification-next",
  );
  let eventNotificationIndicatorButtons = [];
  let visibleEventNotifications = [];
  let activeEventNotificationIndex = 0;
  let eventNotificationAutoAdvance;
  let eventNotificationPointerInteraction = false;
  const rankingEventNotifications = [];
  const eventNotificationDismissalStorageKey = "eventNotificationDismissals";

  function getEventNotificationDate() {
    const dateParts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Rome",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(new Date())
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  }

  function getDismissedEventNotificationIds(date) {
    const storedDismissals = JSON.parse(
      window.localStorage.getItem(eventNotificationDismissalStorageKey) || "null",
    );
    if (
      storedDismissals?.date !== date ||
      !Array.isArray(storedDismissals.ids)
    ) {
      return new Set();
    }
    return new Set(
      storedDismissals.ids.filter((id) => typeof id === "string"),
    );
  }

  let eventNotificationDismissalDate = getEventNotificationDate();
  let dismissedEventNotificationIds = getDismissedEventNotificationIds(
    eventNotificationDismissalDate,
  );

  function updateEventNotificationIndicators() {
    if (!visibleEventNotifications.length) return;

    const swiperLeft = eventNotificationSwiper.getBoundingClientRect().left;
    activeEventNotificationIndex = getClosestNotificationIndex(
      visibleEventNotifications,
      swiperLeft,
    );
    eventNotificationIndicatorButtons.forEach((button, index) => {
      if (index === activeEventNotificationIndex)
        button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
  }

  function showEventNotification(index) {
    const notification = visibleEventNotifications[index];
    if (!notification) return;

    activeEventNotificationIndex = index;
    updateEventNotificationIndicators();
    eventNotificationSwiper.scrollTo({
      left: notification.offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  function resetEventNotificationAutoAdvance() {
    window.clearInterval(eventNotificationAutoAdvance);
    if (visibleEventNotifications.length > 1) {
      eventNotificationAutoAdvance = window.setInterval(() => {
        showEventNotification(
          (activeEventNotificationIndex + 1) % visibleEventNotifications.length,
        );
      }, 10000);
    }
  }

  function pauseEventNotificationAutoAdvance() {
    window.clearInterval(eventNotificationAutoAdvance);
  }

  function startEventNotificationPointerInteraction() {
    eventNotificationPointerInteraction = true;
    pauseEventNotificationAutoAdvance();
  }

  function finishEventNotificationPointerInteraction() {
    if (!eventNotificationPointerInteraction) return;
    eventNotificationPointerInteraction = false;
    resetEventNotificationAutoAdvance();
  }

  function renderEventNotifications() {
    visibleEventNotifications = [
      eventNotification,
      eventNotificationDouble,
      eventNotificationShiny,
      ...rankingEventNotifications,
    ].filter((notification) => notification && !notification.hidden);

    eventNotifications.hidden = visibleEventNotifications.length === 0;
    eventNotificationIndicators.hidden = visibleEventNotifications.length < 2;
    eventNotificationPrevious.hidden = visibleEventNotifications.length < 2;
    eventNotificationNext.hidden = visibleEventNotifications.length < 2;
    eventNotificationIndicatorButtons = renderNotificationIndicators(
      eventNotificationIndicators,
      visibleEventNotifications,
      activeEventNotificationIndex,
      (index) => {
          showEventNotification(index);
          resetEventNotificationAutoAdvance();
      },
      (index, count) => `Show notification ${index + 1} of ${count}`,
    );

    activeEventNotificationIndex = 0;
    eventNotificationSwiper.scrollTo({ left: 0, behavior: "auto" });
    updateEventNotificationIndicators();

    resetEventNotificationAutoAdvance();
  }

  window.addEventListener("ranking-notification", (event) => {
    const notification = event.detail?.card;
    if (!notification || rankingEventNotifications.includes(notification)) return;
    rankingEventNotifications.push(notification);
    eventNotificationSwiper.appendChild(notification);
    renderEventNotifications();
    showEventNotification(visibleEventNotifications.length - 1);
  });
  window.addEventListener(
    "ranking-notification-dismissed",
    renderEventNotifications,
  );

  eventNotificationSwiper.addEventListener(
    "scroll",
    updateEventNotificationIndicators,
  );
  eventNotificationSwiper.addEventListener(
    "pointerdown",
    startEventNotificationPointerInteraction,
  );
  eventNotificationSwiper.addEventListener(
    "wheel",
    resetEventNotificationAutoAdvance,
    { passive: true },
  );
  eventNotificationSwiper.addEventListener("keydown", (event) => {
    if (
      ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(
        event.key,
      )
    )
      resetEventNotificationAutoAdvance();
  });
  window.addEventListener("pointerup", finishEventNotificationPointerInteraction);
  window.addEventListener(
    "pointercancel",
    finishEventNotificationPointerInteraction,
  );
  eventNotificationPrevious.addEventListener("click", () => {
    showEventNotification(
      (activeEventNotificationIndex - 1 + visibleEventNotifications.length) %
        visibleEventNotifications.length,
    );
    resetEventNotificationAutoAdvance();
  });
  eventNotificationNext.addEventListener("click", () => {
    showEventNotification(
      (activeEventNotificationIndex + 1) % visibleEventNotifications.length,
    );
    resetEventNotificationAutoAdvance();
  });
  [eventNotification, eventNotificationDouble, eventNotificationShiny].forEach(
    (notification) => {
      notification
        ?.querySelector(".event-notification-dismiss")
        .addEventListener("click", () => {
          const currentDate = getEventNotificationDate();
          if (currentDate !== eventNotificationDismissalDate) {
            eventNotificationDismissalDate = currentDate;
            dismissedEventNotificationIds =
              getDismissedEventNotificationIds(currentDate);
          }
          dismissedEventNotificationIds.add(notification.id);
          window.localStorage.setItem(
            eventNotificationDismissalStorageKey,
            JSON.stringify({
              date: eventNotificationDismissalDate,
              ids: [...dismissedEventNotificationIds],
            }),
          );
          notification.hidden = true;
          renderEventNotifications();
        });
    },
  );


  return (eventActive, doubleEarningsActive, shinyActive) => {
    eventNotification.hidden =
      !eventActive || dismissedEventNotificationIds.has(eventNotification.id);
    if (eventNotificationDouble)
      eventNotificationDouble.hidden =
        !doubleEarningsActive ||
        dismissedEventNotificationIds.has(eventNotificationDouble.id);
    if (eventNotificationShiny)
      eventNotificationShiny.hidden =
        !shinyActive ||
        dismissedEventNotificationIds.has(eventNotificationShiny.id);
    renderEventNotifications();
  };
}
