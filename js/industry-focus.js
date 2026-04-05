(() => {
  const dataRoot = "/industry-focus-data";
  const cache = new Map();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function decodeHtmlEntities(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value ?? "");
    return textarea.value;
  }

  function normalizeText(value) {
    return decodeHtmlEntities(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function sectorLabel(value) {
    switch (value) {
      case "ai":
        return "AI";
      case "electronics":
        return "电子信息";
      case "it":
        return "IT";
      case "security":
        return "安全";
      case "data":
        return "数据";
      default:
        return value || "综合";
    }
  }

  async function fetchJson(url) {
    if (cache.has(url)) {
      return cache.get(url);
    }

    const request = fetch(url, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status}`);
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
      hour12: false
    }).format(date);
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "-";
    return Number(value).toLocaleString("zh-CN");
  }

  function formatSignedNumber(value) {
    const numericValue = Number(value ?? 0);
    return numericValue > 0 ? `+${numericValue}` : `${numericValue}`;
  }

  function isExternalUrl(value) {
    return /^https?:\/\//i.test(String(value ?? ""));
  }

  function buildLinkAttributes(url) {
    return isExternalUrl(url)
      ? ' target="_blank" rel="noopener noreferrer external nofollow"'
      : "";
  }

  function applyLinkBehavior(link, url) {
    if (!link) return;
    link.href = url;
    if (isExternalUrl(url)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer external nofollow";
      return;
    }

    link.removeAttribute("target");
    link.removeAttribute("rel");
  }

  function resolveSignalUrl(item) {
    return item?.repoUrl || item?.canonicalUrl || item?.deepwikiUrl || item?.url || "#";
  }

  function signalLabel(value) {
    switch (value) {
      case "breakout":
        return "爆发";
      case "rising":
        return "升温";
      case "stable":
        return "稳定";
      case "cooling":
        return "回落";
      default:
        return "";
    }
  }

  function summarizeSignal(item) {
    const summary = normalizeText(
      item?.summary
      || item?.observations?.find((entry) => entry?.summary)?.summary
      || item?.description
      || ""
    );
    const forecast = normalizeText(item?.forecast || "");
    const insight = Array.isArray(item?.insights)
      ? item.insights
        .map((entry) => normalizeText(entry))
        .find((entry) => entry && !/(排名|上一轮|较上一轮|赛道中排名|热度|单站榜单)/.test(entry))
      : "";

    const parts = [];
    [summary, forecast, insight].forEach((entry) => {
      if (!entry) return;
      if (parts.some((part) => part.includes(entry) || entry.includes(part))) return;
      parts.push(entry);
    });

    return parts.join(" ") || "暂无分析摘要";
  }

  function buildHotspotMeta(item) {
    const parts = [];
    if (item?.rank) parts.push(`热度 #${item.rank}`);
    if (item?.primarySector) parts.push(sectorLabel(item.primarySector));
    if (item?.score !== null && item?.score !== undefined) parts.push(`${item.score} 分`);
    if (item?.latestStars !== null && item?.latestStars !== undefined) {
      parts.push(`Stars ${formatNumber(item.latestStars)}`);
    }

    return parts.join(" · ");
  }

  function truncateText(value, maxLength = 140) {
    const text = normalizeText(value);
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
  }

  const sidebarRangeOptions = {
    day: { label: "日" },
    week: { label: "周" },
    month: { label: "月" },
  };
  const sidebarPageSize = 18;

  function resolveDeepWikiUrl(item) {
    if (item?.deepwikiUrl) return item.deepwikiUrl;
    const repoFullName = item?.repoFullName || item?.displayName || "";
    return repoFullName.includes("/") ? `https://deepwiki.com/${repoFullName}` : "#";
  }

  function triggerIndustryScrollRefresh(scope) {
    if (typeof window.refreshAsideScrollViewports === "function") {
      window.refreshAsideScrollViewports(scope);
      return;
    }

    document.dispatchEvent(new CustomEvent("industry-focus:refresh-scroll", {
      detail: { scope },
    }));
  }

  function ensureIndustryCardState(card) {
    if (!card.__industryFocusCardState) {
      card.__industryFocusCardState = { pages: {} };
    }

    return card.__industryFocusCardState;
  }

  function getIndustryPageIndex(card, rangeKey) {
    const state = ensureIndustryCardState(card);
    return Math.max(0, Number(state.pages[rangeKey] || 0));
  }

  function setIndustryPageIndex(card, rangeKey, pageIndex) {
    const state = ensureIndustryCardState(card);
    state.pages[rangeKey] = Math.max(0, Number(pageIndex || 0));
  }

  function paginateIndustryItems(items, pageIndex) {
    if (!items.length) {
      return { items: [], pageCount: 0, pageIndex: 0, startIndex: 0 };
    }

    const pageCount = Math.ceil(items.length / sidebarPageSize);
    const safePageIndex = Math.min(Math.max(0, pageIndex), pageCount - 1);
    const startIndex = safePageIndex * sidebarPageSize;

    return {
      items: items.slice(startIndex, startIndex + sidebarPageSize),
      pageCount,
      pageIndex: safePageIndex,
      startIndex,
    };
  }

  function getSidebarHotspotGroup(data, rangeKey) {
    return data?.hotspots?.[rangeKey] || data?.hotspots?.day || null;
  }

  function renderSidebarHotspotList(target, items, rankOffset = 0) {
    if (!target) return;
    target.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
      target.innerHTML = '<li class="industry-focus-card__status">当前周期暂无热点项目</li>';
      return;
    }

    items.forEach((item, index) => {
      const element = document.createElement("li");
      const rank = Number(item?.rank || rankOffset + index + 1);
      const repoUrl = item?.repoUrl || item?.canonicalUrl || "#";
      const deepwikiUrl = item?.deepwikiUrl || resolveDeepWikiUrl(item);
      const gitcnUrl = item?.gitcnUrl || "";
      const summary = truncateText(item?.summary || summarizeSignal(item), 120) || "暂无项目摘要";
      const metaParts = [`热榜 #${rank}`];
      if (item?.language) metaParts.push(item.language);
      if (item?.starsText) metaParts.push(item.starsText);

      element.className = "industry-focus-card__item";
      element.innerHTML = `
        <article class="industry-focus-card__shell">
          <div class="industry-focus-card__item-head">
            <span class="industry-focus-card__rank">${escapeHtml(rank)}</span>
            <div class="industry-focus-card__content">
              <a class="industry-focus-card__title" href="${escapeHtml(repoUrl)}"${buildLinkAttributes(repoUrl)}>
                ${escapeHtml(item.repoFullName || item.displayName || item.title || "未命名热点")}
              </a>
              <span class="industry-focus-card__item-meta">${escapeHtml(metaParts.join(" · "))}</span>
            </div>
          </div>
          <p class="industry-focus-card__summary">${escapeHtml(summary)}</p>
          <div class="industry-focus-card__links">
            <a class="industry-focus-card__link-chip" href="${escapeHtml(repoUrl)}"${buildLinkAttributes(repoUrl)}>GitHub</a>
            <a class="industry-focus-card__link-chip industry-focus-card__link-chip--secondary" href="${escapeHtml(deepwikiUrl)}"${buildLinkAttributes(deepwikiUrl)}>DeepWiki</a>
            ${gitcnUrl
              ? `<a class="industry-focus-card__link-chip industry-focus-card__link-chip--tertiary" href="${escapeHtml(gitcnUrl)}"${buildLinkAttributes(gitcnUrl)}>GitHub中文社区</a>`
              : ""}
          </div>
        </article>
      `;
      target.appendChild(element);
    });
  }

  function setIndustryPagerState(card, pageIndex = 0, pageCount = 0) {
    if (!card) return;

    const prevButton = card.querySelector("#industry-focus-card-page-prev");
    const nextButton = card.querySelector("#industry-focus-card-page-next");
    if (!prevButton || !nextButton) return;

    const hasPrev = pageCount > 1 && pageIndex > 0;
    const hasNext = pageCount > 1 && pageIndex < pageCount - 1;
    prevButton.hidden = !hasPrev;
    nextButton.hidden = !hasNext;
    prevButton.disabled = !hasPrev;
    nextButton.disabled = !hasNext;
  }

  function refreshIndustryCard(card) {
    if (!card) return;

    const payload = card.__industryFocusPayload || {};
    const data = payload.data;
    const rangeKey = card.dataset.activeRange || "day";
    const live = card.querySelector("#industry-focus-card-live");
    const updated = card.querySelector("#industry-focus-card-updated");
    const list = card.querySelector("#industry-focus-card-list");
    const rangeOption = sidebarRangeOptions[rangeKey] || sidebarRangeOptions.day;
    const group = getSidebarHotspotGroup(data, rangeKey);
    const items = Array.isArray(group?.items) ? group.items : [];
    const pagination = paginateIndustryItems(items, getIndustryPageIndex(card, rangeKey));
    const sourceText = Array.isArray(data?.sources) && data.sources.length
      ? data.sources.map((item) => item.label).join(" / ")
      : "GitHub / GitHub 中文社区 / DeepWiki";

    setIndustryPageIndex(card, rangeKey, pagination.pageIndex);
    if (live) {
      live.textContent = sourceText;
    }

    if (updated) {
      const latestText = group?.updatedAt || data?.updatedAt;
      updated.textContent = `${rangeOption.label}榜 · 最近同步 ${formatTime(latestText)}`;
    }

    renderSidebarHotspotList(list, pagination.items, pagination.startIndex);
    if (list) {
      triggerIndustryScrollRefresh(list.closest(".industry-focus-card__panel") || list);
    }

    setIndustryPagerState(card, pagination.pageIndex, pagination.pageCount);
  }

  function activateIndustryRange(card, rangeKey) {
    if (!card) return;

    card.dataset.activeRange = rangeKey;
    card.querySelectorAll(".industry-focus-card__range").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.range === rangeKey);
    });
    refreshIndustryCard(card);
  }

  function bindIndustryCardControls(card) {
    if (!card || card.dataset.bound === "true") return;

    card.querySelectorAll(".industry-focus-card__range").forEach((button) => {
      button.addEventListener("click", () => {
        const nextRange = button.dataset.range || "day";
        if (card.dataset.activeRange === nextRange) return;
        activateIndustryRange(card, nextRange);
      });
    });

    const prevButton = card.querySelector("#industry-focus-card-page-prev");
    const nextButton = card.querySelector("#industry-focus-card-page-next");

    if (prevButton) {
      prevButton.addEventListener("click", () => {
        const rangeKey = card.dataset.activeRange || "day";
        setIndustryPageIndex(card, rangeKey, getIndustryPageIndex(card, rangeKey) - 1);
        refreshIndustryCard(card);
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        const rangeKey = card.dataset.activeRange || "day";
        setIndustryPageIndex(card, rangeKey, getIndustryPageIndex(card, rangeKey) + 1);
        refreshIndustryCard(card);
      });
    }

    card.dataset.bound = "true";
  }

  async function initSidebarCard() {
    const card = document.getElementById("industry-focus-card");
    if (!card) return;

    const data = await fetchJson(`${dataRoot}/sidebar.json`);
    const weeklyLink = card.querySelector("#industry-focus-card-weekly-link");
    const monthlyLink = card.querySelector("#industry-focus-card-monthly-link");
    const list = card.querySelector("#industry-focus-card-list");

    card.__industryFocusPayload = { data };

    applyLinkBehavior(weeklyLink, data?.reports?.weekly?.url || "/industry-focus/weekly/");
    applyLinkBehavior(monthlyLink, data?.reports?.monthly?.url || "/industry-focus/monthly/");
    if (weeklyLink && data?.reports?.weekly?.description) {
      weeklyLink.title = data.reports.weekly.description;
    }
    if (monthlyLink && data?.reports?.monthly?.description) {
      monthlyLink.title = data.reports.monthly.description;
    }

    bindIndustryCardControls(card);

    if (!data) {
      const updated = card.querySelector("#industry-focus-card-updated");
      if (updated) {
        updated.textContent = "热点数据读取失败，请稍后刷新。";
      }
      if (list) {
        list.innerHTML = '<li class="industry-focus-card__status">热点项目暂时不可用</li>';
      }
      setIndustryPagerState(card, 0, 0);
      return;
    }

    activateIndustryRange(card, card.dataset.activeRange || "day");
  }

  function renderSignalMiniList(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="industry-focus-empty">暂无数据</div>';
    }

    return items.map((item) => `
      <article class="industry-focus-signal">
        <a class="industry-focus-signal__link" href="${escapeHtml(resolveSignalUrl(item))}"${buildLinkAttributes(resolveSignalUrl(item))}>
          <span class="industry-focus-signal__rank">${escapeHtml(item.rank ?? "-")}</span>
          <div class="industry-focus-signal__body">
            <div class="industry-focus-signal__head">
              <strong>${escapeHtml(item.repoFullName || item.displayName || "未命名热点")}</strong>
              <span class="industry-focus-signal__score">${escapeHtml(item.score ?? "-")} 分</span>
            </div>
            <p>${escapeHtml(truncateText(summarizeSignal(item), 168))}</p>
            <div class="industry-focus-tags">
              <span>${escapeHtml(sectorLabel(item.primarySector))}</span>
              ${item?.language ? `<span>${escapeHtml(item.language)}</span>` : ""}
              ${item?.label ? `<span>${escapeHtml(signalLabel(item.label))}</span>` : ""}
              ${item?.latestStars !== null && item?.latestStars !== undefined ? `<span>Stars ${escapeHtml(formatNumber(item.latestStars))}</span>` : ""}
            </div>
          </div>
          <span class="industry-focus-signal__cta">查看</span>
        </a>
      </article>
    `).join("");
  }

  function renderSectorCards(groups, fallbackUrl) {
    if (!Array.isArray(groups) || groups.length === 0) {
      return '<div class="industry-focus-empty">暂无赛道数据</div>';
    }

    return `
      <div class="industry-focus-sector-grid">
        ${groups.map((group) => {
      const leaders = Array.isArray(group.leaders) ? group.leaders.slice(0, 3) : [];
      const leaderMarkup = leaders.length
        ? leaders.map((leader) => {
          const leaderHref = resolveSignalUrl(leader) || fallbackUrl || "#";
          return `
                <a class="industry-focus-sector-card__leader" href="${escapeHtml(leaderHref)}"${buildLinkAttributes(leaderHref)}>
                  ${escapeHtml(leader.repoFullName || leader.displayName || "未命名项目")}
                </a>
              `;
        }).join("")
        : '<span class="industry-focus-sector-card__leader industry-focus-sector-card__leader--empty">暂无热点项目</span>';

      return `
            <article class="industry-focus-sector-card">
              <div class="industry-focus-sector-card__head">
                <div>
                  <p class="industry-focus-sector-card__eyebrow">${escapeHtml(sectorLabel(group.sector))}</p>
                  <h4>${escapeHtml(group.title)}</h4>
                </div>
                <span class="industry-focus-sector-card__count">${escapeHtml(group.leaders?.length ?? 0)} 条</span>
              </div>
              <p class="industry-focus-sector-card__summary">${escapeHtml(group.summary || "暂无赛道摘要")}</p>
              <div class="industry-focus-sector-card__leaders">${leaderMarkup}</div>
            </article>
          `;
    }).join("")}
      </div>
    `;
  }

  function renderIndexCards(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="industry-focus-empty">暂无归档</div>';
    }

    return items.map((item) => `
      <article class="industry-focus-index-card">
        <a href="${escapeHtml(item.url)}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.rangeLabel || item.month || item.date || "")}</span>
          <p>${escapeHtml(item.summary || item.description || "")}</p>
        </a>
      </article>
    `).join("");
  }

  function renderBulletList(items, pickText) {
    if (!Array.isArray(items) || items.length === 0) {
      return "<li>暂无</li>";
    }

    return items.map((item) => `<li>${escapeHtml(pickText(item))}</li>`).join("");
  }

  function bindHubTabs(root) {
    if (!root || root.dataset.boundTabs === "true") return;

    const activate = (tab) => {
      root.querySelectorAll(".industry-focus-hub__tab").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.tab === tab);
      });
      root.querySelectorAll(".industry-focus-hub__panel").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.panel === tab);
      });
      if (window.location.hash !== `#${tab}`) {
        history.replaceState(null, "", `#${tab}`);
      }
    };

    root.querySelectorAll(".industry-focus-hub__tab").forEach((button) => {
      button.addEventListener("click", () => activate(button.dataset.tab));
    });

    const initialTab = ["daily", "weekly", "monthly"].includes(window.location.hash.slice(1))
      ? window.location.hash.slice(1)
      : "daily";
    activate(initialTab);
    root.dataset.boundTabs = "true";
  }

  async function renderHubPage(container) {
    const data = await fetchJson(`${dataRoot}/focus.json`);
    if (!data) {
      container.innerHTML = '<div class="industry-focus-empty">未找到专题数据，请先同步博客导出。</div>';
      return;
    }

    const latestDaily = data.latestDaily;
    const latestWeekly = data.latestWeekly;
    const latestMonthly = data.latestMonthly;

    container.innerHTML = `
      <section class="industry-focus-hub">
        <div class="industry-focus-hero">
          <div>
            <p class="industry-focus-hero__eyebrow">Industry Focus</p>
            <h2>产业情报专题</h2>
            <p class="industry-focus-hero__copy">围绕电子信息、人工智能和 IT 行业，集中呈现每日热点、周报归档、月报文章与趋势判断。</p>
          </div>
          <div class="industry-focus-hero__meta">
            <span>最近更新时间：${escapeHtml(formatTime(data.updatedAt))}</span>
            <a class="industry-focus-button" href="${escapeHtml(data.workbenchUrl || "/industry-focus/workbench/")}">进入看板</a>
            <a class="industry-focus-button industry-focus-button--secondary" href="${escapeHtml(data.realtimeUrl || "http://localhost:3210/focus")}" target="_blank" rel="noopener noreferrer">本地地址</a>
          </div>
        </div>
        <div class="industry-focus-hub__tabs">
          <button class="industry-focus-hub__tab is-active" type="button" data-tab="daily">每日</button>
          <button class="industry-focus-hub__tab" type="button" data-tab="weekly">每周</button>
          <button class="industry-focus-hub__tab" type="button" data-tab="monthly">每月</button>
        </div>
        <section class="industry-focus-hub__panel is-active" data-panel="daily">
          <div class="industry-focus-section">
            <h3>最新热点榜</h3>
            <div class="industry-focus-signal-list">${renderSignalMiniList(latestDaily?.hotspots?.slice(0, 8))}</div>
          </div>
          <div class="industry-focus-section">
            <h3>赛道分类</h3>
            ${renderSectorCards(latestDaily?.sectorGroups || [], latestDaily?.url || "/industry-focus/")}
          </div>
          <div class="industry-focus-section">
            <h3>趋势预测</h3>
            <ul class="industry-focus-bullets">${renderBulletList(latestDaily?.predictions, (item) => item)}</ul>
          </div>
          <div class="industry-focus-section">
            <h3>热点详情入口</h3>
            <div class="industry-focus-grid">${renderIndexCards(data.dailyIndex || [])}</div>
          </div>
        </section>
        <section class="industry-focus-hub__panel" data-panel="weekly">
          <div class="industry-focus-section">
            <h3>最近周报列表</h3>
            <div class="industry-focus-grid">${renderIndexCards(data.weeklyIndex || [])}</div>
          </div>
          <div class="industry-focus-section">
            <h3>上升 / 回落项目</h3>
            <div class="industry-focus-two-col">
              <div>
                <strong>升温</strong>
                <ul class="industry-focus-bullets">${renderBulletList(latestWeekly?.highlights?.risers, (item) => `${item.repoFullName}: ${item.forecast}`)}</ul>
              </div>
              <div>
                <strong>回落</strong>
                <ul class="industry-focus-bullets">${renderBulletList(latestWeekly?.highlights?.fallers, (item) => `${item.repoFullName}: ${item.trendSummary}`)}</ul>
              </div>
            </div>
          </div>
          <div class="industry-focus-section">
            <h3>赛道总结</h3>
            ${renderSectorCards(latestWeekly?.sectorGroups || [], latestWeekly?.url || "/industry-focus/weekly/")}
          </div>
        </section>
        <section class="industry-focus-hub__panel" data-panel="monthly">
          <div class="industry-focus-section">
            <h3>最近月报索引</h3>
            <div class="industry-focus-grid">${renderIndexCards(data.monthlyIndex || [])}</div>
          </div>
          <div class="industry-focus-section">
            <h3>月度主题分类</h3>
            ${renderSectorCards(latestMonthly?.sectorGroups || [], latestMonthly?.url || "/industry-focus/")}
          </div>
          <div class="industry-focus-section">
            <h3>最近月报滚动卡片</h3>
            <div class="monthly-report-stream monthly-report-stream--inline" data-monthly-index="/industry-focus-data/monthly-index.json" data-visible-count="3"></div>
          </div>
        </section>
      </section>
    `;

    bindHubTabs(container.querySelector(".industry-focus-hub"));
    await initMonthlyStreams(container);
  }

  async function renderWeeklyArchive(container) {
    const data = await fetchJson(`${dataRoot}/weekly-index.json`);
    if (!data) {
      container.innerHTML = '<div class="industry-focus-empty">暂无周报归档。</div>';
      return;
    }

    container.innerHTML = `
      <section class="industry-focus-archive">
        <div class="industry-focus-hero">
          <div>
            <p class="industry-focus-hero__eyebrow">Weekly Archive</p>
            <h2>产业情报周报归档</h2>
            <p class="industry-focus-hero__copy">按周查看历史周报详情、升温项目和赛道总结。</p>
          </div>
        </div>
        <div class="industry-focus-grid">${renderIndexCards(data)}</div>
      </section>
    `;
  }

  function resolveWorkbenchHealthUrl(workbenchUrl) {
    try {
      const url = new URL(workbenchUrl);
      url.pathname = "/api/health";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return "";
    }
  }

  async function probeWorkbench(workbenchUrl) {
    const healthUrl = resolveWorkbenchHealthUrl(workbenchUrl);
    if (!healthUrl) {
      return false;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(healthUrl, {
        cache: "no-store",
        mode: "cors",
        signal: controller.signal
      });
      if (!response.ok) {
        return false;
      }

      const payload = await response.json();
      return Boolean(payload?.ok);
    } catch {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function hydrateWorkbenchLauncher(container, localWorkbenchUrl) {
    const status = container.querySelector(".industry-focus-workbench-status");
    if (!status) return;

    const title = status.querySelector(".industry-focus-workbench-status__title");
    const description = status.querySelector(".industry-focus-workbench-status__desc");
    const isOnline = await probeWorkbench(localWorkbenchUrl);

    if (isOnline) {
      status.dataset.state = "ready";
      if (title) title.textContent = "已检测到本地看板服务";
      if (description) {
        description.textContent = "服务已经就绪，正在跳转到本地看板。若浏览器没有自动跳转，可点击下方按钮手动进入。";
      }
      window.setTimeout(() => {
        window.location.href = localWorkbenchUrl;
      }, 900);
      return;
    }

    status.dataset.state = "offline";
    if (title) title.textContent = "本地看板当前未启动";
    if (description) {
      description.textContent = "先运行 npm run focus 或双击 start-focus-workbench.cmd，服务起来后再回来打开。";
    }
  }

  function renderWorkbenchLauncher(container) {
    const localWorkbenchUrl = container.dataset.workbenchUrl || "http://localhost:3210/focus";

    container.innerHTML = `
      <section class="industry-focus-detail">
        <div class="industry-focus-hero">
          <div>
            <p class="industry-focus-hero__eyebrow">Local Workbench</p>
            <h2>本地产业情报看板</h2>
            <p class="industry-focus-hero__copy">站内入口会先帮你检测本地 3210 服务，检测到服务已启动时自动跳转；未启动时显示本地启动说明。</p>
          </div>
          <div class="industry-focus-hero__meta">
            <div class="industry-focus-workbench-status" data-state="checking">
              <strong class="industry-focus-workbench-status__title">正在检测本地看板服务</strong>
              <p class="industry-focus-workbench-status__desc">如果本机的 3210 端口已经启动，页面会自动跳转到本地工作台。</p>
            </div>
            <a class="industry-focus-button" href="${escapeHtml(localWorkbenchUrl)}" target="_blank" rel="noopener noreferrer">打开本地地址</a>
            <a class="industry-focus-button industry-focus-button--secondary" href="/industry-focus/">返回专题</a>
          </div>
        </div>
        <div class="industry-focus-section">
          <h3>启动方法</h3>
          <ul class="industry-focus-bullets">
            <li>推荐在仓库根目录执行 <code>npm run focus</code></li>
            <li>双击 <code>AI_analyze\\start-focus-workbench.cmd</code></li>
            <li>或在 <code>D:\\blog\\butterfly\\AI_analyze</code> 执行 <code>npm run open-workbench</code></li>
            <li>启动成功后，本地看板地址是 <code>${escapeHtml(localWorkbenchUrl)}</code></li>
          </ul>
        </div>
      </section>
    `;

    hydrateWorkbenchLauncher(container, localWorkbenchUrl);
  }

  async function renderDailyDetail(container, date) {
    const data = await fetchJson(`${dataRoot}/daily/${date}.json`);
    if (!data) {
      container.innerHTML = '<div class="industry-focus-empty">未找到当天热点详情。</div>';
      return;
    }

    container.innerHTML = `
      <section class="industry-focus-detail">
        <div class="industry-focus-hero">
          <div>
            <p class="industry-focus-hero__eyebrow">Daily Detail</p>
            <h2>${escapeHtml(data.title)}</h2>
            <p class="industry-focus-hero__copy">${escapeHtml(data.summary)}</p>
          </div>
          <div class="industry-focus-hero__meta">
            <span>更新时间：${escapeHtml(formatTime(data.generatedAt))}</span>
            <a class="industry-focus-button" href="/industry-focus/#daily">返回专题</a>
          </div>
        </div>
        <div class="industry-focus-section">
          <h3>热点榜</h3>
          <div class="industry-focus-signal-list">${renderSignalMiniList(data.hotspots)}</div>
        </div>
        <div class="industry-focus-section">
          <h3>赛道分类</h3>
          ${renderSectorCards(data.sectorGroups || [], data.url)}
        </div>
        <div class="industry-focus-section">
          <h3>趋势预测</h3>
          <ul class="industry-focus-bullets">${renderBulletList(data.predictions, (item) => item)}</ul>
        </div>
      </section>
    `;
  }

  async function renderWeeklyDetail(container, weekId) {
    const data = await fetchJson(`${dataRoot}/weekly/${weekId}.json`);
    if (!data) {
      container.innerHTML = '<div class="industry-focus-empty">未找到该周周报。</div>';
      return;
    }

    container.innerHTML = `
      <section class="industry-focus-detail">
        <div class="industry-focus-hero">
          <div>
            <p class="industry-focus-hero__eyebrow">Weekly Detail</p>
            <h2>${escapeHtml(data.title)}</h2>
            <p class="industry-focus-hero__copy">${escapeHtml(data.summary)}</p>
          </div>
          <div class="industry-focus-hero__meta">
            <span>${escapeHtml(data.range.label)}</span>
            <a class="industry-focus-button" href="/industry-focus/weekly/">返回周报归档</a>
          </div>
        </div>
        <div class="industry-focus-section">
          <h3>榜单</h3>
          <div class="industry-focus-signal-list">${renderSignalMiniList(data.leaderboard)}</div>
        </div>
        <div class="industry-focus-section">
          <h3>升温与回落</h3>
          <div class="industry-focus-two-col">
            <div>
              <strong>升温</strong>
              <ul class="industry-focus-bullets">${renderBulletList(data.highlights?.risers, (item) => `${item.repoFullName}: ${item.forecast}`)}</ul>
            </div>
            <div>
              <strong>回落</strong>
              <ul class="industry-focus-bullets">${renderBulletList(data.highlights?.fallers, (item) => `${item.repoFullName}: ${item.trendSummary}`)}</ul>
            </div>
          </div>
        </div>
        <div class="industry-focus-section">
          <h3>覆盖说明</h3>
          <p>${escapeHtml(data.coverage?.note || "暂无")}</p>
        </div>
        <div class="industry-focus-section">
          <h3>赛道分类</h3>
          ${renderSectorCards(data.sectorGroups || [], data.url)}
        </div>
        <div class="industry-focus-section">
          <h3>编辑备注</h3>
          <ul class="industry-focus-bullets">${renderBulletList(data.notes, (item) => item)}</ul>
        </div>
      </section>
    `;
  }

  async function renderMonthlyArchive(container) {
    const data = await fetchJson(`${dataRoot}/monthly-index.json`);
    if (!data) {
      container.innerHTML = '<div class="industry-focus-empty">暂无月报归档。</div>';
      return;
    }

    container.innerHTML = `
      <section class="industry-focus-archive">
        <div class="industry-focus-hero">
          <div>
            <p class="industry-focus-hero__eyebrow">Monthly Archive</p>
            <h2>产业情报月报归档</h2>
            <p class="industry-focus-hero__copy">按月查看历史月报详情、赛道总结和趋势预测。</p>
          </div>
        </div>
        <div class="industry-focus-grid">${renderIndexCards(data)}</div>
      </section>
    `;
  }

  async function renderMonthlyDetail(container, month) {
    const data = await fetchJson(`${dataRoot}/monthly/${month}.json`);
    if (!data) {
      container.innerHTML = '<div class="industry-focus-empty">未找到该月月报。</div>';
      return;
    }

    container.innerHTML = `
      <section class="industry-focus-detail">
        <div class="industry-focus-hero">
          <div>
            <p class="industry-focus-hero__eyebrow">Monthly Detail</p>
            <h2>${escapeHtml(data.title)}</h2>
            <p class="industry-focus-hero__copy">${escapeHtml(data.summary)}</p>
          </div>
          <div class="industry-focus-hero__meta">
            <span>${escapeHtml(data.range?.label || data.month)}</span>
            <a class="industry-focus-button" href="/industry-focus/monthly/">返回月报归档</a>
          </div>
        </div>
        <div class="industry-focus-section">
          <h3>榜单</h3>
          <div class="industry-focus-signal-list">${renderSignalMiniList(data.leaderboard)}</div>
        </div>
        <div class="industry-focus-section">
          <h3>升温与回落</h3>
          <div class="industry-focus-two-col">
            <div>
              <strong>升温</strong>
              <ul class="industry-focus-bullets">${renderBulletList(data.highlights?.risers, (item) => `${item.repoFullName}: ${item.forecast}`)}</ul>
            </div>
            <div>
              <strong>回落</strong>
              <ul class="industry-focus-bullets">${renderBulletList(data.highlights?.fallers, (item) => `${item.repoFullName}: ${item.trendSummary}`)}</ul>
            </div>
          </div>
        </div>
        <div class="industry-focus-section">
          <h3>覆盖说明</h3>
          <p>${escapeHtml(data.coverage?.note || "暂无")}</p>
          <p>已采样日期：${escapeHtml((data.sourceDates || []).join("、") || "暂无")}</p>
        </div>
        <div class="industry-focus-section">
          <h3>月度主题分类</h3>
          ${renderSectorCards(data.sectorGroups || [], data.url)}
        </div>
        <div class="industry-focus-section">
          <h3>编辑备注</h3>
          <ul class="industry-focus-bullets">${renderBulletList(data.notes, (item) => item)}</ul>
        </div>
      </section>
    `;
  }

  async function initFocusPages(scope = document) {
    const pages = scope.querySelectorAll(".industry-focus-page");
    if (!pages.length) return;

    for (const page of pages) {
      const view = page.dataset.view;
      if (view === "hub") {
        await renderHubPage(page);
      } else if (view === "weekly-archive") {
        await renderWeeklyArchive(page);
      } else if (view === "monthly-archive") {
        await renderMonthlyArchive(page);
      } else if (view === "daily-detail") {
        await renderDailyDetail(page, page.dataset.date);
      } else if (view === "workbench-launcher") {
        renderWorkbenchLauncher(page);
      }
    }
  }

  function applyMonthlyViewportLimit(stream) {
    const viewport = stream.querySelector(".monthly-report-stream__viewport");
    if (!viewport) return;

    const visibleCount = Math.max(1, Number(stream.dataset.visibleCount || 3));
    const cards = [...viewport.querySelectorAll(".monthly-report-stream__card")];
    if (!cards.length) return;

    const sampleCards = cards.slice(0, visibleCount);
    const styles = getComputedStyle(viewport);
    const gapValue = Number.parseFloat(styles.rowGap || styles.gap || "0") || 0;
    const viewportHeight = sampleCards.reduce((sum, card) => sum + card.offsetHeight, 0)
      + gapValue * Math.max(0, sampleCards.length - 1);

    viewport.style.maxHeight = `${viewportHeight}px`;
  }

  async function initMonthlyStreams(scope = document) {
    const streams = scope.querySelectorAll(".monthly-report-stream");
    if (!streams.length) return;

    for (const stream of streams) {
      const monthlyIndexUrl = stream.dataset.monthlyIndex || `${dataRoot}/monthly-index.json`;
      const data = await fetchJson(monthlyIndexUrl);

      if (!data || !Array.isArray(data) || data.length === 0) {
        stream.innerHTML = '<div class="industry-focus-empty">暂无月报</div>';
        continue;
      }

      stream.innerHTML = `
        <div class="monthly-report-stream__hint">默认只显示最近 3 篇，向下滚动可继续查看更早月报。</div>
        <div class="monthly-report-stream__viewport">
          ${data.map((item) => `
            <article class="monthly-report-stream__card">
              <a href="${escapeHtml(item.url)}">
                <div class="monthly-report-stream__cover"${item.cover ? ` style="background-image:url('${escapeHtml(item.cover)}')"` : ""}></div>
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.month)}</span>
                <p>${escapeHtml(item.description || item.summary || "")}</p>
                <div class="industry-focus-tags">
                  ${(item.categories || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
                </div>
                <div class="industry-focus-tags industry-focus-tags--muted">
                  ${(item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
                </div>
                <span class="monthly-report-stream__cta">进入正文</span>
              </a>
            </article>
          `).join("")}
        </div>
      `;

      requestAnimationFrame(() => applyMonthlyViewportLimit(stream));
    }
  }

  function refreshMonthlyViewportLimits() {
    document.querySelectorAll(".monthly-report-stream").forEach((stream) => {
      applyMonthlyViewportLimit(stream);
    });
  }

  async function initAll() {
    await initSidebarCard();
    await initFocusPages();
    await initMonthlyStreams();
    refreshMonthlyViewportLimits();
  }

  document.addEventListener("DOMContentLoaded", initAll);
  document.addEventListener("pjax:complete", initAll);
  window.addEventListener("resize", refreshMonthlyViewportLimits);
})();
