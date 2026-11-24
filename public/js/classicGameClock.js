export function manageGameState(
  id,
  remainingTime,
  { classicState, timer, titles, animateFadeIn, sendNotification },
) {
  const gameID = classicState.getGameID();
  if (gameID == null || gameID !== id) {
    classicState.setGameID(id);
    classicState.removeState();
  }

  if (classicState.notRendered() && classicState.getTries() > 0)
    animateFadeIn(titles, "1.5s");
  classicState.renderState();

  window.setInterval(() => {
    if (classicState.notRendered() && classicState.getTries() > 0)
      animateFadeIn(titles, "1.5s");
    classicState.renderStateDiff();
  }, 60000);

  window.setTimeout(() => {
    sendNotification("A new Pokémon is waiting for you!");
    classicState.removeState();
    window.location.reload();
  }, remainingTime);

  const totalSeconds = Math.floor(remainingTime / 1000);
  const remainingSecondsAfterHours = totalSeconds % 3600;
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor(remainingSecondsAfterHours / 60);
  let seconds = remainingSecondsAfterHours % 60;

  window.setInterval(() => {
    if (hours <= 0 && minutes <= 0 && seconds <= 0) return;
    if (hours >= 1 && minutes === 0 && seconds === 0) {
      hours--;
      minutes = 59;
      seconds = 59;
    } else if (minutes >= 1 && seconds === 0) {
      minutes--;
      seconds = 59;
    } else seconds--;
    const formattedTime =
      (hours < 10 ? "0" + hours : hours) +
      ":" +
      (minutes < 10 ? "0" + minutes : minutes) +
      ":" +
      (seconds < 10 ? "0" + seconds : seconds);
    const timerValue = timer.querySelector("#timer-value");
    if (timerValue) {
      timerValue.textContent = formattedTime;
      timerValue.dateTime = `PT${hours}H${minutes}M${seconds}S`;
    } else {
      timer.textContent = formattedTime;
    }
  }, 1000);
}
