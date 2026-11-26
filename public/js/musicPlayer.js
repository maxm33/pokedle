import { STORAGE_KEYS } from "./storageKeys.js";

const player = document.getElementById("music-player");

if (player) {
  const primaryAudio = document.getElementById("music-audio");
  primaryAudio.preload = "metadata";
  const preloadAudio = new Audio();
  preloadAudio.preload = "metadata";
  const audioElements = [primaryAudio, preloadAudio];
  let audio = primaryAudio;
  const panel = document.getElementById("music-player-panel");
  const oakDance = document.getElementById("music-player-oak-dance");
  let oakDanceImage = oakDance.querySelector("img");
  const mascotButton = document.getElementById("music-mascot-button");
  const mascotImage = document.getElementById("music-player-mascot-image");
  const volumeToggle = document.getElementById("music-volume-toggle");
  const volumePanel = document.getElementById("music-volume-panel");
  const volumeSlider = document.getElementById("music-volume");
  const title = document.getElementById("music-track-title");
  const album = document.getElementById("music-track-album");
  const titleCopy = document.getElementById("music-track-title-copy");
  const albumCopy = document.getElementById("music-track-album-copy");
  const playButton = document.getElementById("music-play");
  const loopButton = document.getElementById("music-loop");
  const sentryAudio = document.getElementById("sentry-audio");
  const titleLine = title.closest(".music-player-track-line");
  const albumLine = album.closest(".music-player-track-line");
  let tracks = [];
  let shuffledTracks = [];
  let currentTrackIndex = -1;
  let shouldPlay = !sentryAudio || sentryAudio.muted;
  let repeatCurrentTrack = false;
  let playbackRequestedByUser = false;
  let isAudioPlaying = false;
  let isMuted = false;
  let stateSaveErrorReported = false;
  let lastStateSaveAt = 0;
  let trackLoadId = 0;
  let pendingTrackMetadataHandler = null;
  let pendingTrackMetadataAudio = null;
  let oakDanceSpawnAt = null;
  let oakDanceTriggered = false;
  let oakDancePermanent = false;
  let oakDanceHideTimeout = null;
  let oakDanceDisplayId = 0;
  let animatedMascotSource = mascotImage.src;
  let frozenMascotSource = "";
  let mascotIsAnimating = false;
  const animatedOakDanceSource = new URL(
    oakDanceImage.dataset.src,
    document.baseURI,
  ).href;
  let frozenOakDanceSource = "";
  const oakDanceCycleDurationMs = 5000;
  const oakDanceCycleCount = 3;
  const playbackStorageKey = STORAGE_KEYS.musicPlayback;
  const volumeStorageKey = STORAGE_KEYS.musicVolume;
  const playlistStorageKey = STORAGE_KEYS.musicPlaylist;
  const oakDanceVictoryGameIdStorageKey = STORAGE_KEYS.oakDanceVictoryGameId;
  const savedPlaybackState = readPlaybackState();

  function updatePlayButton() {
    const isPlaying = !audio.paused && !audio.ended;
    playButton.dataset.playing = String(isPlaying);
    playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    playButton.title = isPlaying ? "Pause" : "Play";
  }

  function readPlaybackState() {
    try {
      const savedState = sessionStorage.getItem(playbackStorageKey);
      if (!savedState) {
        return null;
      }

      const state = JSON.parse(savedState);
      if (
        state.version !== 1 ||
        !Array.isArray(state.playlist) ||
        !state.playlist.every((filename) => typeof filename === "string") ||
        (state.filename !== null && typeof state.filename !== "string") ||
        !Number.isFinite(state.currentTime) ||
        state.currentTime < 0 ||
        !Number.isFinite(state.volume) ||
        state.volume < 0 ||
        state.volume > 1 ||
        typeof state.shouldPlay !== "boolean" ||
        typeof state.panelOpen !== "boolean"
      ) {
        sessionStorage.removeItem(playbackStorageKey);
        return null;
      }

      return state;
    } catch (error) {
      console.error("Could not restore the music player state.", error);
      return null;
    }
  }

  function savePlaybackState(force = false, currentTime = audio.currentTime) {
    const track = shuffledTracks[currentTrackIndex];
    if (!track) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastStateSaveAt < 1000) {
      return;
    }

    const state = {
      version: 1,
      playlist: shuffledTracks.map(({ filename }) => filename),
      filename: track.filename,
      currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
      volume: Number(volumeSlider.value),
      shouldPlay,
      panelOpen: !panel.hidden,
    };

    try {
      sessionStorage.setItem(playbackStorageKey, JSON.stringify(state));
      lastStateSaveAt = now;
    } catch (error) {
      if (!stateSaveErrorReported) {
        console.error("Could not save the music player state.", error);
        stateSaveErrorReported = true;
      }
    }
  }

  function readSavedVolume() {
    try {
      const savedVolume = localStorage.getItem(volumeStorageKey);
      if (savedVolume === null) {
        return null;
      }

      const volume = Number(savedVolume);
      return Number.isFinite(volume) && volume >= 0 && volume <= 1
        ? volume
        : null;
    } catch (error) {
      console.error("Could not restore the music player volume.", error);
      return null;
    }
  }

  function saveVolumePreference() {
    try {
      localStorage.setItem(volumeStorageKey, volumeSlider.value);
    } catch (error) {
      console.error("Could not save the music player volume.", error);
    }
  }

  function readCachedPlaylist() {
    try {
      const savedPlaylist = localStorage.getItem(playlistStorageKey);
      if (!savedPlaylist) {
        return null;
      }

      const playlist = JSON.parse(savedPlaylist);
      return Array.isArray(playlist) &&
        playlist.every(
          (track) =>
            track &&
            typeof track.filename === "string" &&
            typeof track.title === "string" &&
            typeof track.album === "string",
        )
        ? playlist
        : null;
    } catch (error) {
      console.error("Could not restore the music playlist metadata.", error);
      return null;
    }
  }

  function saveCachedPlaylist(playlist) {
    try {
      localStorage.setItem(playlistStorageKey, JSON.stringify(playlist));
    } catch (error) {
      console.error("Could not save the music playlist metadata.", error);
    }
  }

  function restorePlaylist(sourceTracks, state) {
    const tracksByFilename = new Map(
      sourceTracks.map((track) => [track.filename, track]),
    );
    const restoredTracks = [];
    const restoredFilenames = new Set();

    state.playlist.forEach((filename) => {
      const track = tracksByFilename.get(filename);
      if (track && !restoredFilenames.has(filename)) {
        restoredTracks.push(track);
        restoredFilenames.add(filename);
      }
    });

    const newTracks = sourceTracks.filter(
      (track) => !restoredFilenames.has(track.filename),
    );
    return [...restoredTracks, ...shuffleTracks(newTracks)];
  }

  function playAudio() {
    const targetAudio = audio;
    const loadId = trackLoadId;
    targetAudio.play().catch((error) => {
      if (audio !== targetAudio || loadId !== trackLoadId) {
        return;
      }

      console.error("Music playback could not start.", error);
      isAudioPlaying = false;
      updatePlayButton();
      updateMascotPlaybackState();
      savePlaybackState(true);
    });
  }

  function startMusicIfSentryIsMuted() {
    if (!sentryAudio?.muted || isMuted || playbackRequestedByUser) {
      return;
    }

    shouldPlay = true;
    if (audio.src && audio.paused) {
      playAudio();
    }
  }

  function setMascotAnimation(animate) {
    if (animate) {
      if (!mascotIsAnimating) {
        mascotIsAnimating = true;
        mascotImage.src = animatedMascotSource;
      }
      return;
    }

    mascotIsAnimating = false;
    if (!mascotImage.complete || !mascotImage.naturalWidth) {
      return;
    }

    if (!frozenMascotSource) {
      const canvas = document.createElement("canvas");
      canvas.width = mascotImage.naturalWidth;
      canvas.height = mascotImage.naturalHeight;

      try {
        canvas.getContext("2d").drawImage(mascotImage, 0, 0);
        frozenMascotSource = canvas.toDataURL("image/png");
      } catch (error) {
        console.error("Could not freeze the DJ Pikachu animation.", error);
        return;
      }
    }

    mascotImage.src = frozenMascotSource;
  }

  function updateMascotPlaybackState() {
    const shouldAnimate = !isMuted && isAudioPlaying;
    setMascotAnimation(shouldAnimate);
    setOakDanceAnimation(shouldAnimate);
  }

  function setOakDanceAnimation(animate) {
    if (animate) {
      if (
        oakDance.classList.contains("is-visible") &&
        oakDanceImage.src !== animatedOakDanceSource
      ) {
        oakDanceImage.src = animatedOakDanceSource;
      }
      return;
    }

    if (!oakDanceImage.complete || !oakDanceImage.naturalWidth) {
      return;
    }

    if (!frozenOakDanceSource) {
      const canvas = document.createElement("canvas");
      canvas.width = oakDanceImage.naturalWidth;
      canvas.height = oakDanceImage.naturalHeight;

      try {
        canvas.getContext("2d").drawImage(oakDanceImage, 0, 0);
        frozenOakDanceSource = canvas.toDataURL("image/png");
      } catch (error) {
        console.error("Could not freeze Professor Oak's dance.", error);
        return;
      }
    }

    oakDanceImage.src = frozenOakDanceSource;
  }

  function hideOakDance() {
    if (oakDancePermanent) {
      return;
    }

    if (oakDanceHideTimeout !== null) {
      window.clearTimeout(oakDanceHideTimeout);
      oakDanceHideTimeout = null;
    }

    oakDance.classList.remove("is-visible");
    oakDance.setAttribute("aria-hidden", "true");
    oakDanceImage.removeAttribute("src");
    frozenOakDanceSource = "";
  }

  function resetOakDance() {
    if (oakDancePermanent) {
      return;
    }

    oakDanceDisplayId += 1;
    oakDanceSpawnAt = null;
    oakDanceTriggered = false;
    hideOakDance();
  }

  function scheduleOakDance(duration, resumeTime) {
    if (oakDancePermanent) {
      return;
    }

    oakDanceSpawnAt = null;
    oakDanceTriggered = false;

    if (Math.random() >= 0.3 || !Number.isFinite(duration)) {
      return;
    }

    const spawnWindowEnd = duration * 0.6;
    if (resumeTime >= spawnWindowEnd) {
      return;
    }

    oakDanceSpawnAt =
      resumeTime + Math.random() * (spawnWindowEnd - resumeTime);
  }

  function showOakDance() {
    if (oakDanceTriggered) {
      return;
    }

    oakDanceTriggered = true;
    oakDanceSpawnAt = null;
    oakDance.classList.add("is-visible");
    oakDance.setAttribute("aria-hidden", "false");
    const displayId = ++oakDanceDisplayId;
    const startHideTimer = () => {
      if (displayId !== oakDanceDisplayId || oakDancePermanent) {
        return;
      }

      oakDanceHideTimeout = window.setTimeout(() => {
        if (displayId === oakDanceDisplayId) {
          hideOakDance();
        }
      }, oakDanceCycleDurationMs * oakDanceCycleCount);
    };
    const replayedImage = oakDanceImage.cloneNode(false);
    replayedImage.src = animatedOakDanceSource;
    replayedImage.addEventListener(
      "load",
      () => {
        if (oakDance.contains(replayedImage)) {
          oakDanceImage = replayedImage;
          updateMascotPlaybackState();
        }
        startHideTimer();
      },
      { once: true },
    );
    oakDanceImage.replaceWith(replayedImage);
    oakDanceImage = replayedImage;
    updateMascotPlaybackState();
  }

  function keepOakDanceVisible() {
    oakDancePermanent = true;
    oakDanceSpawnAt = null;
    if (oakDanceHideTimeout !== null) {
      window.clearTimeout(oakDanceHideTimeout);
      oakDanceHideTimeout = null;
    }

    oakDanceTriggered = false;
    showOakDance();
  }

  function restoreOakDanceVictory(event) {
    if (window.location.pathname.replace(/\/+$/, "") !== "/classic") {
      return;
    }

    const gameId = event.detail?.gameId;
    if (gameId == null) {
      console.error("Could not restore Oak's dance: Classic game ID is missing.");
      return;
    }

    let winningGameId;
    try {
      winningGameId = window.localStorage.getItem(
        oakDanceVictoryGameIdStorageKey,
      );
    } catch (error) {
      console.error("Could not read the Classic victory state.", error);
      return;
    }

    if (winningGameId === String(gameId)) {
      keepOakDanceVisible();
    }
  }

  function persistOakDanceVictory(event) {
    if (window.location.pathname.replace(/\/+$/, "") !== "/classic") {
      return;
    }

    keepOakDanceVisible();
    const gameId = event.detail?.gameId;
    if (gameId == null) {
      console.error("Could not save Oak's dance: Classic game ID is missing.");
      return;
    }

    try {
      window.localStorage.setItem(
        oakDanceVictoryGameIdStorageKey,
        String(gameId),
      );
    } catch (error) {
      console.error("Could not save the Classic victory state.", error);
    }
  }

  function updateTrackMarquees() {
    [titleLine, albumLine].forEach((line) => {
      const text = line.querySelector(".music-player-track-marquee > span");
      const textWidth =
        text.scrollWidth - parseFloat(getComputedStyle(text).paddingRight);
      line.classList.toggle(
        "is-overflowing",
        textWidth > line.clientWidth * 0.85,
      );
    });
  }

  function updateMuteState() {
    isMuted = Number(volumeSlider.value) === 0;
    audioElements.forEach((audioElement) => {
      audioElement.volume = Number(volumeSlider.value);
      audioElement.muted = isMuted;
    });
    saveVolumePreference();
    volumeToggle.dataset.muted = String(isMuted);
    volumeToggle.title = isMuted ? "Muted — Volume" : "Volume";

    if (isMuted) {
      audio.pause();
    } else if (shouldPlay && audio.src) {
      playAudio();
    }

    updateMascotPlaybackState();
    updatePlayButton();
    savePlaybackState();
  }

  function setTrack(index, resumeTime = 0) {
    if (!shuffledTracks.length) {
      return;
    }

    resetOakDance();
    currentTrackIndex = (index + shuffledTracks.length) % shuffledTracks.length;
    const track = shuffledTracks[currentTrackIndex];
    const loadId = ++trackLoadId;
    const source = `/public/audio/${encodeURIComponent(track.filename)}`;
    title.textContent = track.title;
    album.textContent = track.album;
    titleCopy.textContent = track.title;
    albumCopy.textContent = track.album;
    requestAnimationFrame(updateTrackMarquees);
    const previousAudio = audio;
    const targetAudio =
      previousAudio === primaryAudio ? preloadAudio : primaryAudio;
    audio = targetAudio;
    isAudioPlaying = false;
    updateMascotPlaybackState();
    if (!previousAudio.ended && !previousAudio.paused) {
      previousAudio.pause();
    }
    if (pendingTrackMetadataHandler && pendingTrackMetadataAudio) {
      pendingTrackMetadataAudio.removeEventListener(
        "loadedmetadata",
        pendingTrackMetadataHandler,
      );
    }
    const metadataHandler = () => {
      targetAudio.removeEventListener("loadedmetadata", metadataHandler);
      if (pendingTrackMetadataHandler === metadataHandler) {
        pendingTrackMetadataHandler = null;
        pendingTrackMetadataAudio = null;
      }

      if (
        loadId !== trackLoadId ||
        audio !== targetAudio ||
        targetAudio.currentSrc !== new URL(source, document.baseURI).href
      ) {
        return;
      }

      const duration = targetAudio.duration;
      const seekTime =
        resumeTime > 0 && Number.isFinite(duration)
          ? Math.min(resumeTime, Math.max(0, duration - 0.1))
          : resumeTime;
      scheduleOakDance(duration, seekTime);
      targetAudio.currentTime = seekTime;
      savePlaybackState(true, seekTime);

      if (shouldPlay && !isMuted) {
        playAudio();
      }
      preloadNextTrack();
    };
    pendingTrackMetadataHandler = metadataHandler;
    pendingTrackMetadataAudio = targetAudio;
    targetAudio.addEventListener("loadedmetadata", metadataHandler);
    targetAudio.volume = Number(volumeSlider.value);
    targetAudio.muted = isMuted;
    const absoluteSource = new URL(source, document.baseURI).href;
    if (targetAudio.src !== absoluteSource || targetAudio.error) {
      targetAudio.pause();
      targetAudio.src = source;
      targetAudio.load();
    } else if (targetAudio.readyState >= 1) {
      metadataHandler();
    }
    savePlaybackState(true, resumeTime);
  }

  function preloadNextTrack() {
    if (!shuffledTracks.length || currentTrackIndex < 0) {
      return;
    }

    const nextTrackIndex =
      (currentTrackIndex + (repeatCurrentTrack ? 0 : 1)) %
      shuffledTracks.length;
    const nextTrack = shuffledTracks[nextTrackIndex];
    const source = `/public/audio/${encodeURIComponent(nextTrack.filename)}`;
    const sourceUrl = new URL(source, document.baseURI).href;
    const targetAudio =
      audio === primaryAudio ? preloadAudio : primaryAudio;

    targetAudio.volume = Number(volumeSlider.value);
    targetAudio.muted = isMuted;
    if (targetAudio.src === sourceUrl && !targetAudio.error) {
      return;
    }

    targetAudio.src = source;
    targetAudio.load();
  }

  function shuffleTracks(sourceTracks) {
    const result = [...sourceTracks];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  async function loadTracks() {
    tracks = readCachedPlaylist();
    if (!tracks) {
      const response = await fetch("/audio/playlist");
      if (!response.ok) {
        throw new Error(`Playlist request failed with status ${response.status}`);
      }

      tracks = await response.json();
      if (
        !Array.isArray(tracks) ||
        !tracks.every(
          (track) =>
            track &&
            typeof track.filename === "string" &&
            typeof track.title === "string" &&
            typeof track.album === "string",
        )
      ) {
        throw new Error("Playlist response has an invalid format");
      }
      saveCachedPlaylist(tracks);
    }
    shuffledTracks = savedPlaybackState
      ? restorePlaylist(tracks, savedPlaybackState)
      : shuffleTracks(tracks);
    if (!shuffledTracks.length) {
      console.error("No numbered MP3 tracks found.");
      return;
    }

    if (sentryAudio && !playbackRequestedByUser) {
      shouldPlay = sentryAudio.muted;
    }

    if (savedPlaybackState) {
      panel.hidden = !savedPlaybackState.panelOpen;
      updateMascotPlaybackState();
    }

    const restoredTrackIndex = savedPlaybackState?.filename
      ? shuffledTracks.findIndex(
          (track) => track.filename === savedPlaybackState.filename,
        )
      : -1;
    const trackIndex = restoredTrackIndex >= 0 ? restoredTrackIndex : 0;
    const resumeTime =
      restoredTrackIndex >= 0 ? savedPlaybackState.currentTime : 0;
    setTrack(trackIndex, resumeTime);
  }

  mascotButton.addEventListener("click", () => {
    panel.hidden = false;
    savePlaybackState(true);
  });

  volumeToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    volumePanel.hidden = !volumePanel.hidden;
    volumeToggle.setAttribute("aria-expanded", String(!volumePanel.hidden));
    if (isMuted) {
      volumeSlider.focus();
    }
  });

  volumeSlider.addEventListener("input", updateMuteState);
  playButton.addEventListener("click", () => {
    playbackRequestedByUser = true;
    if (!audio.src && shuffledTracks.length) {
      shouldPlay = true;
      setTrack(Math.max(currentTrackIndex, 0));
    } else if (audio.paused || audio.ended) {
      shouldPlay = true;
      if (isMuted) {
        volumeSlider.value = "0.65";
        updateMuteState();
      } else {
        playAudio();
      }
    } else {
      shouldPlay = false;
      audio.pause();
    }
    updatePlayButton();
    savePlaybackState(true);
  });
  document.getElementById("music-previous").addEventListener("click", () => {
    setTrack(currentTrackIndex - 1);
  });
  document.getElementById("music-next").addEventListener("click", () => {
    setTrack(currentTrackIndex + 1);
  });
  loopButton.addEventListener("click", () => {
    repeatCurrentTrack = !repeatCurrentTrack;
    loopButton.setAttribute("aria-pressed", String(repeatCurrentTrack));
    preloadNextTrack();
  });

  audioElements.forEach((audioElement) => {
    audioElement.addEventListener("ended", () => {
      if (audioElement !== audio || !audioElement.ended) {
        return;
      }

      isAudioPlaying = false;
      updateMascotPlaybackState();
      if (shouldPlay) {
        setTrack(currentTrackIndex + (repeatCurrentTrack ? 0 : 1));
      } else {
        updatePlayButton();
      }
    });
    audioElement.addEventListener("play", () => {
      if (
        audioElement !== audio ||
        audioElement.paused ||
        audioElement.ended
      ) {
        return;
      }

      document.dispatchEvent(
        new CustomEvent("pokedle:exclusive-audio-play", {
          detail: audioElement,
        }),
      );
      updatePlayButton();
      savePlaybackState(true);
    });
    audioElement.addEventListener("playing", () => {
      if (
        audioElement !== audio ||
        audioElement.paused ||
        audioElement.ended
      ) {
        return;
      }

      isAudioPlaying = true;
      updatePlayButton();
      updateMascotPlaybackState();
    });
    audioElement.addEventListener("pause", () => {
      if (audioElement !== audio || !audioElement.paused || audioElement.ended) {
        return;
      }

      isAudioPlaying = false;
      updateMascotPlaybackState();
      updatePlayButton();
    });
    audioElement.addEventListener("waiting", () => {
      if (audioElement !== audio || audioElement.paused || audioElement.ended) {
        return;
      }

      isAudioPlaying = false;
      updateMascotPlaybackState();
    });
    audioElement.addEventListener("timeupdate", () => {
      if (audioElement !== audio) {
        return;
      }

      if (
        !audioElement.paused &&
        !audioElement.ended &&
        !oakDanceTriggered &&
        Number.isFinite(oakDanceSpawnAt) &&
        audioElement.currentTime >= oakDanceSpawnAt
      ) {
        showOakDance();
      }
      savePlaybackState();
    });
    audioElement.addEventListener("error", () => {
      if (audioElement === audio) {
        isAudioPlaying = false;
        updateMascotPlaybackState();
        console.error(
          "The selected music track could not be played.",
          audioElement.error,
        );
        savePlaybackState(true);
      } else {
        console.error(
          "The next music track could not be preloaded.",
          audioElement.error,
        );
      }
    });
  });
  document.addEventListener("pokedle:exclusive-audio-play", (event) => {
    if (event.detail === audio) {
      return;
    }

    shouldPlay = false;
    playbackRequestedByUser = false;
    audio.pause();
    savePlaybackState(true);
  });
  document.addEventListener(
    "pokedle:sentry-audio-disabled",
    startMusicIfSentryIsMuted,
  );
  document.addEventListener(
    "pokedle:classic-game-ready",
    restoreOakDanceVictory,
  );
  document.addEventListener("pokedle:classic-victory", persistOakDanceVictory);
  window.addEventListener("pagehide", () => savePlaybackState(true));
  mascotImage.addEventListener("load", () => {
    if (!isMuted && isAudioPlaying) {
      frozenMascotSource = "";
    } else if (mascotImage.src !== frozenMascotSource) {
      frozenMascotSource = "";
      setMascotAnimation(false);
    }
  });
  oakDanceImage.addEventListener("load", updateMascotPlaybackState);

  document.addEventListener("click", (event) => {
    if (!player.contains(event.target)) {
      panel.hidden = true;
      volumePanel.hidden = true;
      volumeToggle.setAttribute("aria-expanded", "false");
      savePlaybackState(true);
    }
  });
  const startPlaybackFromInteraction = (event) => {
    if (player.contains(event.target)) {
      return;
    }
    if (sentryAudio && !sentryAudio.paused && !sentryAudio.muted) {
      return;
    }

    playbackRequestedByUser = true;
    shouldPlay = true;
    if (audio.src && !isMuted && audio.paused) {
      playAudio();
    }
    updatePlayButton();
    savePlaybackState(true);
  };
  const stopInteractionPlaybackRetry = () => {
    document.removeEventListener("pointerdown", startPlaybackFromInteraction);
  };
  document.addEventListener("pointerdown", startPlaybackFromInteraction);
  audioElements.forEach((audioElement) => {
    audioElement.addEventListener("play", stopInteractionPlaybackRetry, {
      once: true,
    });
  });

  const trackResizeObserver = new ResizeObserver(updateTrackMarquees);
  trackResizeObserver.observe(titleLine);
  trackResizeObserver.observe(albumLine);

  const restoredVolume =
    readSavedVolume() ?? savedPlaybackState?.volume ?? Number(volumeSlider.value);
  volumeSlider.value = String(restoredVolume);
  isMuted = restoredVolume === 0;
  audioElements.forEach((audioElement) => {
    audioElement.volume = restoredVolume;
    audioElement.muted = isMuted;
  });
  volumeToggle.dataset.muted = String(isMuted);
  volumeToggle.title = isMuted ? "Muted — Volume" : "Volume";
  updatePlayButton();
  updateMascotPlaybackState();
  startMusicIfSentryIsMuted();
  loadTracks().catch((error) => {
    console.error("Could not load the music playlist.", error);
  });
}
