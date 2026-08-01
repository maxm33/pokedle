import { auth } from "./auth.js";

let timer = document.getElementById("sentry-timer");
let feedback = document.getElementById("sentry-feedback");
let optionsContainer = document.getElementById("sentry-options");
let audio = document.getElementById("sentry-audio");
let feedbackAudio = document.getElementById("sentry-feedback-audio");
let muteButton = document.getElementById("sentry-mute");

let totalScore = 0;
let sessionFailed = 0;
let sessionRounds = 0;
let currentChallenge = null;
let countdownInterval = null;

if (muteButton && audio) {
  // restore state from localStorage
  const stored = localStorage.getItem("sentry-muted");
  const shouldMute = stored === "true";
  setAudioMuted(shouldMute);
  if (shouldMute) {
    muteButton.textContent = "🔇";
    muteButton.setAttribute("aria-pressed", "true");
  } else {
    muteButton.textContent = "🔊";
    muteButton.setAttribute("aria-pressed", "false");
  }

  if (audio) {
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }
  muteButton.addEventListener("click", () => {
    const muted = !audio.muted;
    setAudioMuted(muted);
    muteButton.textContent = muted ? "🔇" : "🔊";
    muteButton.setAttribute("aria-pressed", muted ? "true" : "false");
    localStorage.setItem("sentry-muted", muted ? "true" : "false");
  });
}

async function loadChallenge(resetSession = false) {
  try {
    const res = await axios.get("/sentry/state");
    currentChallenge = res.data;
    if (resetSession) {
      totalScore = 0;
      sessionFailed = 0;
      sessionRounds = 0;
    }
    renderChallenge();
    startCountdown(currentChallenge.durationMs);
  } catch (err) {
    console.error(err);
  }
}

function renderChallenge() {
  if (totalScore !== 0) feedback.innerHTML = `Total score: ${totalScore}`;
  const footprintElement = document.getElementById("sentry-footprint");
  const overlay = document.getElementById("sentry-overlay");
  if (overlay) {
    overlay.style.display = "none";
    overlay.textContent = "";
  }
  if (currentChallenge.footprintUrl) {
    footprintElement.src = currentChallenge.footprintUrl;
  }
  const failuresEl = document.getElementById("sentry-failures");
  if (failuresEl) failuresEl.textContent = `Failures: ${sessionFailed}/3`;
  optionsContainer.innerHTML = "";
  currentChallenge.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "sentry-option";
    button.dataset.option = option;
    button.disabled = false;
    button.classList.remove("sentry-correct", "sentry-wrong");
    const imgSrc = `/public/images/sprites/${option}.webp`;
    button.innerHTML = `
      <div class="sentry-option-left">
        <div class="sentry-name">${option}</div>
      </div>
      <img class="sentry-mini" src="${imgSrc}" alt="${option}" />
    `;
    button.addEventListener("click", () => submitGuess(option));
    optionsContainer.appendChild(button);
  });
}

function startCountdown(duration) {
  clearInterval(countdownInterval);
  let remaining = duration;
  timer.textContent = `Time left: ${Math.ceil(remaining / 1000)}s`;
  countdownInterval = setInterval(() => {
    remaining -= 100;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      timer.textContent = "Time left: 0s";
      handleFailure();
    } else {
      timer.textContent = `Time left: ${Math.ceil(remaining / 1000)}s`;
    }
  }, 100);
}

async function submitGuess(option) {
  if (!currentChallenge || currentChallenge.submitted) return;
  currentChallenge.submitted = true;
  clearInterval(countdownInterval);
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  try {
    sessionRounds++;
    const res = await axios.post("/sentry", {
      token: token,
      challengeID: currentChallenge.challengeID,
      selected: option,
      sessionTotalScore: totalScore,
      sessionRounds: sessionRounds,
      gameOver: sessionFailed + 1 >= 3 && !currentChallenge.timeout,
    });
    const result = res.data;

    const buttons = optionsContainer.querySelectorAll(".sentry-option");
    let selectedBtn = null;
    let correctBtn = null;
    buttons.forEach((b) => {
      if (b.dataset && b.dataset.option === option) selectedBtn = b;
      if (b.dataset && b.dataset.option === result.answer) correctBtn = b;
    });
    if (result.correct) {
      if (selectedBtn) selectedBtn.classList.add("sentry-correct");
      totalScore += result.score;
      playFeedbackSound("correct");
      feedback.innerHTML = `Correct! +${result.score} points. Total: ${totalScore}`;
      disableOptions();
      setTimeout(() => loadChallenge(false), 1500);
    } else {
      if (selectedBtn) selectedBtn.classList.add("sentry-wrong");
      if (correctBtn) correctBtn.classList.add("sentry-correct");
      playFeedbackSound("wrong");
      handleFailure();
    }
  } catch (err) {
    console.error(err);
  }
}

function handleFailure() {
  sessionFailed++;
  const failuresEl = document.getElementById("sentry-failures");
  if (failuresEl) failuresEl.textContent = `Failures: ${sessionFailed}/3`;
  disableOptions();
  if (sessionFailed >= 3) {
    // show overlay centered on the footprint
    const overlay = document.getElementById("sentry-overlay");
    if (overlay) {
      overlay.textContent = "GAME OVER";
      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");
    }
  } else {
    setTimeout(() => loadChallenge(false), 1500);
  }
}

function disableOptions() {
  const buttons = optionsContainer.querySelectorAll("button");
  buttons.forEach((button) => {
    button.disabled = true;
  });
}

function playFeedbackSound(type) {
  if (!feedbackAudio) return;

  feedbackAudio.pause();
  feedbackAudio.currentTime = 0;
  feedbackAudio.src =
    type === "correct"
      ? "/public/audio/correct_footprint_SE.mp3"
      : "/public/audio/wrong_footprint_SE.mp3";
  feedbackAudio.load();
  feedbackAudio.play().catch(() => {});
}

function setAudioMuted(muted) {
  if (audio) audio.muted = muted;
  if (feedbackAudio) feedbackAudio.muted = muted;
}

loadChallenge(true);
