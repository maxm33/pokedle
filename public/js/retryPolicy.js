export function getNotificationRetryDelay(attempt) {
  return Math.min(3000 * 2 ** Math.max(0, attempt), 30000);
}
