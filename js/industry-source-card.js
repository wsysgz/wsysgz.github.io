(() => {
  const dataUrl = "/industry-focus-data/source-card.json";
  const cache = new Map();
  const helpers = window.IndustrySourceCardHelpers;

  if (!helpers) {
    console.warn("IndustrySourceCardHelpers 未加载，信息源卡片初始化已跳过。");
    return;
  }

  const { normalizeSourceCardData, paginateSourceItems } = helpers;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function fetchJson(url) {
    if (cache.has(url)) {
      return cache.get(url);
    }

    const request = fetch(url, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status}`);
        }
        return response.json();
      })
      .catch(() => null);

    cache.set(url, request);
    return request;
  }

  function formatTime(value) {
    if (!value) return "暂无";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function isExternalUrl(value) {
    return /^https?:\/\//i.test(String(value ?? ""));
  }

  function buildLinkAttributes(url) {
    return isExternalUrl(url)
      ? ' target="_blank" rel="noopener noreferrer external nofollow"'
      : "";
  }

  function triggerIndustrySourceScrollRefresh(scope) {
    if (typeof window.refreshAsideScrollViewports === "function") {
      window.refreshAsideScrollViewports(scope);
      return;
    }

    document.dispatchEvent(new CustomEvent("industry-source:refresh-scroll", {
      detail: { scope },
    }));
  }

  function ensureSourceCardState(card) {
    if (!card.__industrySourceCardState) {
      card.__industrySourceCardState = {
        activeCategoryKey: "",
        sectionKeys: {},
        pages: {},
      };
    }

    return card.__industrySourceCardState;
  }

  function getCategory(data, categoryKey) {
    return data?.categories?.find((category) => category.key === categoryKey) || data?.categories?.[0] || null;
  }

  function getSection(category, sectionKey) {
    return category?.sections?.find((section) => section.key === sectionKey) || category?.sections?.[0] || null;
  }

  function getPageStateKey(categoryKey, sectionKey) {
    return `${categoryKey}:${sectionKey}`;
  }

  function getPageIndex(card, categoryKey, sectionKey) {
    const state = ensureSourceCardState(card);
    return Math.max(0, Number(state.pages[getPageStateKey(categoryKey, sectionKey)] || 0));
  }

  function setPageIndex(card, categoryKey, sectionKey, pageIndex) {
    const state = ensureSourceCardState(card);
    state.pages[getPageStateKey(categoryKey, sectionKey)] = Math.max(0, Number(pageIndex || 0));
  }

  function getSectionKey(card, category) {
    const state = ensureSourceCardState(card);
    return state.sectionKeys[category.key] || category.defaultSectionKey;
  }

  function setSectionKey(card, categoryKey, sectionKey) {
    const state = ensureSourceCardState(card);
    state.sectionKeys[categoryKey] = sectionKey;
  }

  function setActiveCategoryKey(card, categoryKey) {
    const state = ensureSourceCardState(card);
    state.activeCategoryKey = categoryKey;
  }

  function renderSectionButtons(target, category, activeSectionKey) {
    if (!target || !category) return;

    target.innerHTML = category.sections.map((section) => `
      <button
        class="industry-source-card__section${section.key === activeSectionKey ? " is-active" : ""}"
        type="button"
        data-section="${escapeHtml(section.key)}"
      >
        <span>${escapeHtml(section.label)}</span>
        ${section.badge ? `<em class="industry-source-card__section-badge">${escapeHtml(section.badge)}</em>` : ""}
      </button>
    `).join("");
  }

  function renderSourceList(target, items) {
    if (!target) return;

    target.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      target.innerHTML = '<li class="industry-source-card__status">当前分类暂无可展示的信息源</li>';
      return;
    }

    items.forEach((item) => {
      const element = document.createElement("li");
      element.className = "industry-source-card__item";
      element.innerHTML = `
        <article
          class="industry-source-card__shell"
          data-fetch-mode="${escapeHtml(item.fetchMode || "")}"
          data-page-url="${escapeHtml(item.pageUrl || item.url || "")}"
          data-feed-url="${escapeHtml(item.feedUrl || "")}"
          data-api-url="${escapeHtml(item.apiUrl || "")}"
          data-keywords="${escapeHtml((item.keywords || []).join(", "))}"
        >
          <div class="industry-source-card__item-head">
            <div class="industry-source-card__content">
              <a class="industry-source-card__title" href="${escapeHtml(item.url)}"${buildLinkAttributes(item.url)}>
                ${escapeHtml(item.name)}
              </a>
              <span class="industry-source-card__item-meta">
                ${escapeHtml([item.sectionLabel, item.pageType, item.healthMode].filter(Boolean).join(" · "))}
              </span>
            </div>
            ${item.sectionBadge ? `<span class="industry-source-card__badge">${escapeHtml(item.sectionBadge)}</span>` : ""}
          </div>
          <p class="industry-source-card__focus">${escapeHtml(item.focus)}</p>
          <div class="industry-source-card__tags">
            <a class="industry-source-card__tag industry-source-card__tag--link" href="${escapeHtml(item.pageUrl || item.url)}"${buildLinkAttributes(item.pageUrl || item.url)}>${escapeHtml(item.pageType)}</a>
            ${item.feedUrl
              ? `<a class="industry-source-card__tag industry-source-card__tag--secondary industry-source-card__tag--link" href="${escapeHtml(item.feedUrl)}"${buildLinkAttributes(item.feedUrl)}>RSS</a>`
              : ""}
            ${item.apiUrl
              ? `<a class="industry-source-card__tag industry-source-card__tag--secondary industry-source-card__tag--link" href="${escapeHtml(item.apiUrl)}"${buildLinkAttributes(item.apiUrl)}>API</a>`
              : ""}
            <span class="industry-source-card__tag industry-source-card__tag--secondary">${escapeHtml(item.healthMode)}</span>
          </div>
          ${item.notes ? `<p class="industry-source-card__note">${escapeHtml(item.notes)}</p>` : ""}
        </article>
      `;
      target.appendChild(element);
    });
  }

  function setPagerState(card, pageIndex = 0, pageCount = 0) {
    const prevButton = card.querySelector("#industry-source-card-page-prev");
    const nextButton = card.querySelector("#industry-source-card-page-next");
    if (!prevButton || !nextButton) return;

    const hasPrev = pageCount > 1 && pageIndex > 0;
    const hasNext = pageCount > 1 && pageIndex < pageCount - 1;
    prevButton.hidden = !hasPrev;
    nextButton.hidden = !hasNext;
    prevButton.disabled = !hasPrev;
    nextButton.disabled = !hasNext;
  }

  function refreshSourceCard(card) {
    if (!card) return;

    const payload = card.__industrySourcePayload?.data;
    if (!payload) return;

    const state = ensureSourceCardState(card);
    const category = getCategory(payload, state.activeCategoryKey);
    if (!category) return;

    setActiveCategoryKey(card, category.key);
    const section = getSection(category, getSectionKey(card, category));
    if (!section) return;

    setSectionKey(card, category.key, section.key);

    const live = card.querySelector("#industry-source-card-live");
    const updated = card.querySelector("#industry-source-card-updated");
    const summary = card.querySelector("#industry-source-card-summary");
    const list = card.querySelector("#industry-source-card-list");
    const sectionRoot = card.querySelector("#industry-source-card-sections");
    const sectionItems = category.items.filter((item) => item.sectionKey === section.key);
    const pagination = paginateSourceItems(sectionItems, getPageIndex(card, category.key, section.key));

    setPageIndex(card, category.key, section.key, pagination.pageIndex);
    card.querySelectorAll(".industry-source-card__tab").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.category === category.key);
    });
    renderSectionButtons(sectionRoot, category, section.key);

    if (live) {
      live.textContent = [payload.inspection.scheduleLabel, payload.inspection.rule, "AI 抓取字段已预留"].filter(Boolean).join(" · ") || "名称直达主入口";
    }
    if (updated) {
      updated.textContent = payload.updatedAt ? `最近整理 ${formatTime(payload.updatedAt)}` : "最近整理时间待补充";
    }
    if (summary) {
      const summaryParts = [
        `${category.label} · ${section.label} · ${sectionItems.length} 个入口`,
        section.description || category.description || payload.inspection.note,
      ].filter(Boolean);
      summary.textContent = `${summaryParts.join("。")}。`;
    }

    renderSourceList(list, pagination.items);
    if (list) {
      triggerIndustrySourceScrollRefresh(list.closest(".industry-source-card__panel") || list);
    }

    setPagerState(card, pagination.pageIndex, pagination.pageCount);
  }

  function bindSourceCardControls(card) {
    if (!card || card.dataset.bound === "true") return;

    card.addEventListener("click", (event) => {
      const categoryButton = event.target.closest(".industry-source-card__tab");
      if (categoryButton && card.contains(categoryButton)) {
        const categoryKey = categoryButton.dataset.category || "";
        if (!categoryKey) return;
        setActiveCategoryKey(card, categoryKey);
        refreshSourceCard(card);
        return;
      }

      const sectionButton = event.target.closest(".industry-source-card__section");
      if (sectionButton && card.contains(sectionButton)) {
        const state = ensureSourceCardState(card);
        const category = getCategory(card.__industrySourcePayload?.data, state.activeCategoryKey);
        const sectionKey = sectionButton.dataset.section || "";
        if (!category || !sectionKey) return;
        setSectionKey(card, category.key, sectionKey);
        setPageIndex(card, category.key, sectionKey, 0);
        refreshSourceCard(card);
        return;
      }

      if (event.target.closest("#industry-source-card-page-prev")) {
        const state = ensureSourceCardState(card);
        const category = getCategory(card.__industrySourcePayload?.data, state.activeCategoryKey);
        const section = category ? getSection(category, getSectionKey(card, category)) : null;
        if (!category || !section) return;
        setPageIndex(card, category.key, section.key, getPageIndex(card, category.key, section.key) - 1);
        refreshSourceCard(card);
        return;
      }

      if (event.target.closest("#industry-source-card-page-next")) {
        const state = ensureSourceCardState(card);
        const category = getCategory(card.__industrySourcePayload?.data, state.activeCategoryKey);
        const section = category ? getSection(category, getSectionKey(card, category)) : null;
        if (!category || !section) return;
        setPageIndex(card, category.key, section.key, getPageIndex(card, category.key, section.key) + 1);
        refreshSourceCard(card);
      }
    });

    card.dataset.bound = "true";
  }

  async function initIndustrySourceCard() {
    const card = document.getElementById("industry-source-card");
    if (!card) return;

    const data = await fetchJson(dataUrl);
    const list = card.querySelector("#industry-source-card-list");
    const updated = card.querySelector("#industry-source-card-updated");
    const summary = card.querySelector("#industry-source-card-summary");
    const payload = normalizeSourceCardData(data);

    bindSourceCardControls(card);

    if (!payload.categories.length) {
      if (updated) {
        updated.textContent = "信息源数据读取失败，请稍后刷新。";
      }
      if (summary) {
        summary.textContent = "暂时无法整理信息源入口，请稍后再试。";
      }
      if (list) {
        list.innerHTML = '<li class="industry-source-card__status">信息源暂时不可用</li>';
      }
      setPagerState(card, 0, 0);
      return;
    }

    card.__industrySourcePayload = { data: payload };
    setActiveCategoryKey(card, card.dataset.activeCategory || payload.categories[0].key);
    refreshSourceCard(card);
  }

  document.addEventListener("DOMContentLoaded", initIndustrySourceCard);
  document.addEventListener("pjax:complete", initIndustrySourceCard);
})();
