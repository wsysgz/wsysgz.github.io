(() => {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let cleanupCurrent = null;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function mountHomeHero(hero) {
    if (!hero) {
      return () => {};
    }

    const defaults = { x: 44, y: 24 };
    let rafId = 0;
    let pendingX = defaults.x;
    let pendingY = defaults.y;

    hero.dataset.pointerMode = window.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine";
    hero.dataset.motionMode = reducedMotionQuery.matches ? "reduced" : "full";

    function applyPosition(x, y) {
      hero.style.setProperty("--home-hero-reveal-x", `${x}%`);
      hero.style.setProperty("--home-hero-reveal-y", `${y}%`);
    }

    function flushFrame() {
      rafId = 0;
      applyPosition(pendingX, pendingY);
    }

    function schedulePosition(x, y) {
      pendingX = x;
      pendingY = y;

      if (!rafId) {
        rafId = window.requestAnimationFrame(flushFrame);
      }
    }

    function setTargetFromEvent(event) {
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
      const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
      schedulePosition(x, y);
    }

    function resetPosition() {
      schedulePosition(defaults.x, defaults.y);
    }

    applyPosition(defaults.x, defaults.y);

    if (!reducedMotionQuery.matches) {
      hero.addEventListener("pointermove", setTargetFromEvent, { passive: true });
      hero.addEventListener("pointerdown", setTargetFromEvent, { passive: true });
      hero.addEventListener("pointerleave", resetPosition, { passive: true });
      hero.addEventListener("pointercancel", resetPosition, { passive: true });
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      hero.removeEventListener("pointermove", setTargetFromEvent);
      hero.removeEventListener("pointerdown", setTargetFromEvent);
      hero.removeEventListener("pointerleave", resetPosition);
      hero.removeEventListener("pointercancel", resetPosition);
    };
  }

  function initHomeHero() {
    cleanupCurrent?.();
    cleanupCurrent = mountHomeHero(document.querySelector(".home-entry-hero"));
  }

  document.addEventListener("DOMContentLoaded", initHomeHero);
  document.addEventListener("pjax:complete", initHomeHero);
})();
