(function (root) {
  function getNotificationRetryDelay(attempt) {
    return Math.min(3000 * 2 ** Math.max(0, attempt), 30000);
  }

  const helpers = { getNotificationRetryDelay };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
  } else {
    root.NotificationRetryPolicy = helpers;
  }
})(globalThis);
