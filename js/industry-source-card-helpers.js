(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.IndustrySourceCardHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const DEFAULT_PAGE_SIZE = 18;

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function normalizeItem(item, section) {
    const url = normalizeText(item?.url) || "#";
    const pageUrl = normalizeText(item?.pageUrl) || url;

    return {
      name: normalizeText(item?.name) || "未命名来源",
      url,
      pageUrl,
      focus: normalizeText(item?.focus) || "暂无说明",
      pageType: normalizeText(item?.pageType) || "首页",
      healthMode: normalizeText(item?.healthMode) || "需人工验证",
      fetchMode: normalizeText(item?.fetchMode) || "html",
      feedUrl: normalizeText(item?.feedUrl),
      apiUrl: normalizeText(item?.apiUrl),
      checkUrl: normalizeText(item?.checkUrl) || pageUrl,
      keywords: Array.isArray(item?.keywords)
        ? item.keywords.map((entry) => normalizeText(entry)).filter(Boolean)
        : [],
      notes: normalizeText(item?.notes),
      sectionKey: section.key,
      sectionLabel: section.label,
      sectionBadge: normalizeText(section.badge),
    };
  }

  function normalizeSection(section, index) {
    const items = Array.isArray(section?.items) ? section.items : [];
    const key = normalizeText(section?.key) || `section-${index + 1}`;
    const label = normalizeText(section?.label) || `分组 ${index + 1}`;

    return {
      key,
      label,
      badge: normalizeText(section?.badge),
      description: normalizeText(section?.description),
      items: items.map((item) => normalizeItem(item, { key, label, badge: section?.badge })),
    };
  }

  function normalizeCategory(category, index) {
    const sections = (Array.isArray(category?.sections) ? category.sections : [])
      .map((section, sectionIndex) => normalizeSection(section, sectionIndex));

    return {
      key: normalizeText(category?.key) || `category-${index + 1}`,
      label: normalizeText(category?.label) || `分类 ${index + 1}`,
      description: normalizeText(category?.description),
      sections,
      defaultSectionKey: sections[0]?.key || "",
      items: sections.flatMap((section) => section.items),
    };
  }

  function normalizeSourceCardData(raw) {
    const categories = (Array.isArray(raw?.categories) ? raw.categories : [])
      .map((category, index) => normalizeCategory(category, index));

    return {
      updatedAt: normalizeText(raw?.updatedAt),
      inspection: {
        scheduleLabel: normalizeText(raw?.inspection?.scheduleLabel),
        timezone: normalizeText(raw?.inspection?.timezone),
        rule: normalizeText(raw?.inspection?.rule),
        note: normalizeText(raw?.inspection?.note),
      },
      categories,
    };
  }

  function paginateSourceItems(items, pageIndex, pageSize = DEFAULT_PAGE_SIZE) {
    if (!Array.isArray(items) || items.length === 0) {
      return { items: [], pageCount: 0, pageIndex: 0, startIndex: 0 };
    }

    const safePageSize = Math.max(1, Number(pageSize || DEFAULT_PAGE_SIZE));
    const pageCount = Math.ceil(items.length / safePageSize);
    const safePageIndex = Math.min(Math.max(0, Number(pageIndex || 0)), pageCount - 1);
    const startIndex = safePageIndex * safePageSize;

    return {
      items: items.slice(startIndex, startIndex + safePageSize),
      pageCount,
      pageIndex: safePageIndex,
      startIndex,
    };
  }

  return {
    DEFAULT_PAGE_SIZE,
    normalizeSourceCardData,
    paginateSourceItems,
  };
});
