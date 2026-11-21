export function getClosestNotificationIndex(notifications, left) {
  return notifications.reduce(
    (closestIndex, notification, index) =>
      Math.abs(notification.getBoundingClientRect().left - left) <
      Math.abs(notifications[closestIndex].getBoundingClientRect().left - left)
        ? index
        : closestIndex,
    0,
  );
}

export function renderNotificationIndicators(
  container,
  notifications,
  activeIndex,
  onSelect,
  getLabel,
) {
  container.replaceChildren();
  return notifications.map((notification, index) => {
    notification.setAttribute(
      "aria-label",
      `Event notification ${index + 1} of ${notifications.length}`,
    );

    const button = document.createElement("button");
    button.className = "event-notification-indicator";
    button.type = "button";
    button.setAttribute("aria-label", getLabel(index, notifications.length));
    if (index === activeIndex) button.setAttribute("aria-current", "true");
    button.addEventListener("click", () => onSelect(index));
    container.appendChild(button);
    return button;
  });
}
