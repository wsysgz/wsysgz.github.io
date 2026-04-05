(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const api = factory();
  globalScope.SiteMusicPlayer = api;
  api.attachSiteMusicPlayerListeners(globalScope.document, globalScope);
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const EMPTY_LABEL = "暂无音乐";
  const IDLE_META = "点击播放";
  const PLAYER_STORAGE_KEY = "site-music-player-state";

  function normalizePlaylist(rawPlaylist) {
    if (!Array.isArray(rawPlaylist)) {
      return [];
    }

    return rawPlaylist.reduce((tracks, entry, index) => {
      const title = String(entry?.title ?? "").trim();
      const src = String(entry?.src ?? "").trim();
      if (!title || !src) {
        return tracks;
      }

      tracks.push({
        id: String(entry?.id ?? `track-${index + 1}`),
        title,
        src,
        artist: String(entry?.artist ?? "").trim(),
      });
      return tracks;
    }, []);
  }

  function readPlaylistDataset(documentRef) {
    if (!documentRef?.getElementById) {
      return [];
    }

    const datasetNode = documentRef.getElementById("site-music-dataset");
    if (!datasetNode?.textContent) {
      return [];
    }

    try {
      return normalizePlaylist(JSON.parse(datasetNode.textContent));
    } catch {
      return [];
    }
  }

  function createFallbackAudio() {
    return {
      src: "",
      currentTime: 0,
      paused: true,
      preload: "metadata",
      addEventListener() {},
      removeEventListener() {},
      load() {},
      play() {
        this.paused = false;
        return Promise.resolve();
      },
      pause() {
        this.paused = true;
      },
    };
  }

  function createAudioFromWindow(windowRef) {
    if (windowRef && typeof windowRef.Audio === "function") {
      try {
        return new windowRef.Audio();
      } catch {
        return windowRef.Audio();
      }
    }

    if (typeof Audio === "function") {
      return new Audio();
    }

    return createFallbackAudio();
  }

  function getPlayerStorage(windowRef) {
    try {
      return windowRef?.sessionStorage || null;
    } catch {
      return null;
    }
  }

  function persistPlayerState(windowRef, state) {
    const storage = getPlayerStorage(windowRef);
    if (!storage) {
      return false;
    }

    if (!state?.currentTrack || !state?.playlist?.length) {
      storage.removeItem?.(PLAYER_STORAGE_KEY);
      return false;
    }

    try {
      storage.setItem(
        PLAYER_STORAGE_KEY,
        JSON.stringify({
          currentIndex: state.currentIndex,
          currentTime: Math.max(0, Number(state.audio?.currentTime) || 0),
          currentTrackSrc: state.currentTrack.src,
          isPlaying: Boolean(state.isPlaying),
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  function restorePlayerState(windowRef, state) {
    const storage = getPlayerStorage(windowRef);
    if (!storage || !state?.playlist?.length) {
      return false;
    }

    let persisted = null;
    try {
      persisted = JSON.parse(storage.getItem?.(PLAYER_STORAGE_KEY) || "null");
    } catch {
      persisted = null;
    }

    if (!persisted || typeof persisted !== "object") {
      return false;
    }

    const matchedIndex = state.playlist.findIndex((track) => track.src === persisted.currentTrackSrc);
    const fallbackIndex = Number.isInteger(persisted.currentIndex) ? persisted.currentIndex : 0;
    const nextIndex = matchedIndex >= 0 ? matchedIndex : fallbackIndex;

    state.select(nextIndex, { autoplay: false });

    if (persisted.currentTime > 0) {
      state.audio.currentTime = Number(persisted.currentTime) || 0;
    }

    if (persisted.isPlaying) {
      state.play();
    } else {
      state.notify();
    }

    return true;
  }

  function bindPlayerStatePersistence(windowRef, state) {
    if (!windowRef?.addEventListener || !state || state.__persistenceBound) {
      return function noop() {};
    }

    const persist = function persistCurrentState() {
      persistPlayerState(windowRef, state);
    };

    const unsubscribe = state.subscribe(persist);
    state.audio.addEventListener?.("timeupdate", persist);
    state.audio.addEventListener?.("ended", persist);
    windowRef.addEventListener?.("pagehide", persist);
    windowRef.addEventListener?.("beforeunload", persist);
    state.__persistenceBound = true;

    return function cleanup() {
      unsubscribe();
      state.audio.removeEventListener?.("timeupdate", persist);
      state.audio.removeEventListener?.("ended", persist);
      windowRef.removeEventListener?.("pagehide", persist);
      windowRef.removeEventListener?.("beforeunload", persist);
      state.__persistenceBound = false;
    };
  }

  function createPlayerState(playlist, options = {}) {
    const tracks = normalizePlaylist(playlist);
    const audio = options.audio || createAudioFromWindow(options.windowRef);
    const subscribers = new Set();
    const state = {
      playlist: tracks,
      audio,
      currentIndex: 0,
      currentTrack: tracks[0] || null,
      isPlaying: false,
      notify() {
        subscribers.forEach((listener) => listener(state));
      },
      subscribe(listener) {
        if (typeof listener !== "function") {
          return function noop() {};
        }

        subscribers.add(listener);
        listener(state);

        return function unsubscribe() {
          subscribers.delete(listener);
        };
      },
      async play() {
        if (!state.currentTrack) {
          return false;
        }

        state.isPlaying = true;
        state.notify();

        try {
          await Promise.resolve(state.audio.play?.());
          state.audio.paused = false;
          return true;
        } catch {
          state.isPlaying = false;
          state.audio.paused = true;
          state.notify();
          return false;
        }
      },
      pause() {
        state.audio.pause?.();
        state.audio.paused = true;
        state.isPlaying = false;
        state.notify();
      },
      toggle() {
        return state.isPlaying ? (state.pause(), Promise.resolve(false)) : state.play();
      },
      select(index, behavior = {}) {
        if (!state.playlist.length) {
          state.currentIndex = 0;
          state.currentTrack = null;
          state.pause();
          return null;
        }

        const normalizedIndex =
          ((Number(index) || 0) % state.playlist.length + state.playlist.length) %
          state.playlist.length;
        const nextTrack = state.playlist[normalizedIndex];
        const shouldAutoplay = Object.prototype.hasOwnProperty.call(behavior, "autoplay")
          ? Boolean(behavior.autoplay)
          : state.isPlaying;
        const isSameTrack = state.currentTrack?.src === nextTrack.src;

        state.currentIndex = normalizedIndex;
        state.currentTrack = nextTrack;

        if (!isSameTrack) {
          state.audio.src = nextTrack.src;
          state.audio.currentTime = 0;
          state.audio.preload = state.audio.preload || "metadata";
          state.audio.load?.();
        }

        state.notify();

        if (shouldAutoplay) {
          return state.play();
        }

        return Promise.resolve(nextTrack);
      },
      next(behavior = {}) {
        return state.select(state.currentIndex + 1, behavior);
      },
      previous(behavior = {}) {
        return state.select(state.currentIndex - 1, behavior);
      },
    };

    if (!audio.preload) {
      audio.preload = "metadata";
    }

    audio.addEventListener?.("ended", function handleEnded() {
      state.next({ autoplay: true });
    });

    if (state.currentTrack) {
      state.audio.src = state.currentTrack.src;
      state.audio.load?.();
    }

    return state;
  }

  function getOrCreatePlayerState(windowRef, playlist, options = {}) {
    if (windowRef?.__siteMusicPlayerState) {
      return windowRef.__siteMusicPlayerState;
    }

    const state = createPlayerState(playlist, {
      audio: typeof options.createAudio === "function" ? options.createAudio() : undefined,
      windowRef,
    });

    if (windowRef) {
      windowRef.__siteMusicPlayerState = state;
    }

    return state;
  }

  function mountSiteMusicPlayer(root, state) {
    if (!root?.querySelector || !state) {
      return function noop() {};
    }

    const titleNode = root.querySelector("[data-site-music-title]");
    const prevButton = root.querySelector("[data-site-music-action='prev']");
    const toggleButton = root.querySelector("[data-site-music-action='toggle']");
    const nextButton = root.querySelector("[data-site-music-action='next']");

    const render = function renderPlayer(currentState) {
      const hasTracks = Boolean(currentState.currentTrack);
      const toggleLabel = currentState.isPlaying ? "暂停" : "播放";

      if (titleNode) {
        titleNode.textContent = hasTracks ? currentState.currentTrack.title : EMPTY_LABEL;
      }

      if (prevButton) {
        prevButton.disabled = !hasTracks;
        prevButton.setAttribute?.("aria-label", "上一首");
        prevButton.setAttribute?.("title", "上一首");
      }

      if (nextButton) {
        nextButton.disabled = !hasTracks;
        nextButton.setAttribute?.("aria-label", "下一首");
        nextButton.setAttribute?.("title", "下一首");
      }

      if (toggleButton) {
        toggleButton.disabled = !hasTracks;
        toggleButton.setAttribute?.("aria-label", hasTracks ? toggleLabel : EMPTY_LABEL);
        toggleButton.setAttribute?.("title", hasTracks ? toggleLabel : EMPTY_LABEL);
      }

      if (root.dataset) {
        root.dataset.playerState = currentState.isPlaying ? "playing" : "paused";
      }
    };

    const unsubscribe = state.subscribe(render);
    const handlePrev = function handlePrev(event) {
      event?.preventDefault?.();
      state.previous();
    };
    const handleToggle = function handleToggle(event) {
      event?.preventDefault?.();
      state.toggle();
    };
    const handleNext = function handleNext(event) {
      event?.preventDefault?.();
      state.next();
    };

    prevButton?.addEventListener?.("click", handlePrev);
    toggleButton?.addEventListener?.("click", handleToggle);
    nextButton?.addEventListener?.("click", handleNext);

    return function cleanup() {
      unsubscribe();
      prevButton?.removeEventListener?.("click", handlePrev);
      toggleButton?.removeEventListener?.("click", handleToggle);
      nextButton?.removeEventListener?.("click", handleNext);
    };
  }

  function attachSiteMusicPlayerListeners(documentRef, windowRef, options = {}) {
    if (!documentRef?.addEventListener) {
      return function noop() {};
    }

    let cleanupCurrent = function noop() {};

    const runMount = function mountPlayer() {
      const root = documentRef.getElementById?.("site-music-player");
      if (!root) {
        return null;
      }

      cleanupCurrent();
      const playlist = readPlaylistDataset(documentRef);
      const hadExistingState = Boolean(windowRef?.__siteMusicPlayerState);
      const state = getOrCreatePlayerState(windowRef, playlist, options);
      if (!hadExistingState) {
        restorePlayerState(windowRef, state);
        bindPlayerStatePersistence(windowRef, state);
      }
      cleanupCurrent = mountSiteMusicPlayer(root, state);
      return state;
    };

    documentRef.addEventListener("DOMContentLoaded", runMount);
    documentRef.addEventListener("pjax:complete", runMount);

    return runMount;
  }

  return {
    EMPTY_LABEL,
    IDLE_META,
    normalizePlaylist,
    readPlaylistDataset,
    persistPlayerState,
    restorePlayerState,
    bindPlayerStatePersistence,
    createPlayerState,
    getOrCreatePlayerState,
    mountSiteMusicPlayer,
    attachSiteMusicPlayerListeners,
  };
});
