(() => {
  function getItemSelector(list) {
    if (list.dataset.itemSelector) {
      return list.dataset.itemSelector;
    }

    if (list.classList.contains("recent-post-scroll")) {
      return ":scope > .aside-list-item";
    }

    if (list.classList.contains("industry-focus-card__list")) {
      return ":scope > .industry-focus-card__item";
    }

    if (list.classList.contains("industry-source-card__list")) {
      return ":scope > .industry-source-card__item";
    }

    return ":scope > .gov-news__item";
  }

  function applyScrollableViewport(list) {
    if (!list) return;

    const visibleCount = Math.max(1, Number(list.dataset.visibleCount || 3));
    const items = [...list.querySelectorAll(getItemSelector(list))];

    list.classList.remove("is-scrollable");
    list.style.maxHeight = "";

    if (items.length <= visibleCount) {
      return;
    }

    const viewportHeight = items
      .slice(0, visibleCount)
      .reduce((total, item) => total + item.offsetHeight, 0);

    if (!viewportHeight) {
      requestAnimationFrame(() => applyScrollableViewport(list));
      return;
    }

    list.classList.add("is-scrollable");
    list.style.maxHeight = `${viewportHeight}px`;
  }

  function refreshScrollableCards(scope = document) {
    scope
      .querySelectorAll(".recent-post-scroll, .gov-news__list[data-visible-count], .industry-focus-card__list[data-visible-count], .industry-source-card__list[data-visible-count]")
      .forEach((list) => {
        applyScrollableViewport(list);
      });
  }

  function scheduleRefresh(scope = document) {
    requestAnimationFrame(() => refreshScrollableCards(scope));
  }

  window.refreshAsideScrollViewports = scheduleRefresh;

  document.addEventListener("DOMContentLoaded", () => scheduleRefresh());
  document.addEventListener("pjax:complete", () => scheduleRefresh());
  window.addEventListener("resize", () => scheduleRefresh());

  document.addEventListener("gov-news:refresh-scroll", (event) => {
    if (event?.detail?.scope) {
      scheduleRefresh(event.detail.scope);
      return;
    }

    scheduleRefresh();
  });

  document.addEventListener("industry-focus:refresh-scroll", (event) => {
    if (event?.detail?.scope) {
      scheduleRefresh(event.detail.scope);
      return;
    }

    scheduleRefresh();
  });

  document.addEventListener("industry-source:refresh-scroll", (event) => {
    if (event?.detail?.scope) {
      scheduleRefresh(event.detail.scope);
      return;
    }

    scheduleRefresh();
  });
})();
