(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const api = factory();
  globalScope.SiteMediaShell = api;
  api.attachSiteMediaShellListeners(globalScope.document, globalScope);
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const HOME_HEADER_SELECTOR = "#page-header.home-entry-header";
  const VIDEO_SELECTOR = "[data-site-media-video]";

  function computeMediaState({ isHome, reducedMotion, scrollY, threshold }) {
    if (reducedMotion) {
      return "poster";
    }

    if (!isHome) {
      return "video";
    }

    return scrollY >= threshold ? "video" : "poster";
  }

  function applyMediaState(root, video, nextState) {
    if (!root) {
      return Promise.resolve(false);
    }

    root.dataset.mediaState = nextState;

    if (!video) {
      return Promise.resolve(false);
    }

    if (nextState === "video") {
      return Promise.resolve(video.play?.()).catch(() => {
        root.dataset.mediaState = "poster";
        video.pause?.();
        return false;
      });
    }

    video.pause?.();
    return Promise.resolve(true);
  }

  function getHeroThreshold(documentRef) {
    const header = documentRef?.querySelector?.(HOME_HEADER_SELECTOR);
    if (!header) {
      return 0;
    }

    return Math.ceil(header.offsetHeight || header.getBoundingClientRect?.().height || 0);
  }

  function mountSiteMediaShell(documentRef, windowRef) {
    const root = documentRef?.getElementById?.("site-media-shell");
    const video = root?.querySelector?.(VIDEO_SELECTOR);

    if (!root || !video) {
      return function noop() {};
    }

    const motionQuery = windowRef?.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    let rafId = 0;
    let scheduled = false;
    let currentState = "";

    function syncState() {
      root.dataset.motionMode = motionQuery?.matches ? "reduced" : "full";

      const nextState = computeMediaState({
        isHome: Boolean(documentRef?.querySelector?.(HOME_HEADER_SELECTOR)),
        reducedMotion: Boolean(motionQuery?.matches),
        scrollY: windowRef?.scrollY || windowRef?.pageYOffset || 0,
        threshold: getHeroThreshold(documentRef),
      });

      if (nextState === currentState) {
        return;
      }

      currentState = nextState;
      void applyMediaState(root, video, nextState);
    }

    function requestSync() {
      if (scheduled) {
        return;
      }

      scheduled = true;

      if (typeof windowRef?.requestAnimationFrame === "function") {
        rafId = windowRef.requestAnimationFrame(function flushSync() {
          scheduled = false;
          rafId = 0;
          syncState();
        });
        return;
      }

      scheduled = false;
      syncState();
    }

    requestSync();
    windowRef?.addEventListener?.("scroll", requestSync, { passive: true });
    windowRef?.addEventListener?.("resize", requestSync);
    motionQuery?.addEventListener?.("change", requestSync);

    return function cleanup() {
      windowRef?.cancelAnimationFrame?.(rafId);
      windowRef?.removeEventListener?.("scroll", requestSync);
      windowRef?.removeEventListener?.("resize", requestSync);
      motionQuery?.removeEventListener?.("change", requestSync);
      video.pause?.();
    };
  }

  function attachSiteMediaShellListeners(documentRef, windowRef) {
    if (!documentRef?.addEventListener) {
      return function noop() {};
    }

    let cleanupCurrent = function noop() {};

    function init() {
      cleanupCurrent();
      cleanupCurrent = mountSiteMediaShell(documentRef, windowRef);
      return cleanupCurrent;
    }

    documentRef.addEventListener("DOMContentLoaded", init);
    documentRef.addEventListener("pjax:complete", init);

    if (documentRef.readyState && documentRef.readyState !== "loading") {
      init();
    }

    return init;
  }

  return {
    computeMediaState,
    applyMediaState,
    getHeroThreshold,
    mountSiteMediaShell,
    attachSiteMediaShellListeners,
  };
});
