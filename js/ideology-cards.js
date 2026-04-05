(() => {
  const datasetElementId = 'ideology-dataset'
  const rotateInterval = 120000
  const govUpdateHour = 20
  const govHome = 'https://www.gov.cn/'
  const govDefaultTab = 'yaowen'
  const govDefaultRange = 'week'
  const govCacheVersion = 'v4'
  const govPageSize = 18
  const govRanges = {
    week: { label: '周', days: 7 },
    month: { label: '月', days: 30 },
    year: { label: '年', days: 365 }
  }
  const govSources = {
    yaowen: {
      label: '要闻',
      sourceUrl: 'https://www.gov.cn/yaowen/liebiao/',
      dataUrl: 'https://www.gov.cn/yaowen/liebiao/YAOWENLIEBIAO.json',
      moreText: '查看要闻栏目',
      loadingText: '正在加载要闻...',
      allowPaths: [/^\/yaowen\/liebiao\//]
    },
    policy: {
      label: '最新政策',
      sourceUrl: 'https://www.gov.cn/zhengce/zuixin/',
      dataUrl: 'https://www.gov.cn/zhengce/zuixin/ZUIXINZHENGCE.json',
      moreText: '查看最新政策',
      loadingText: '正在加载最新政策...',
      allowPaths: [/^\/zhengce\//],
      disallowPaths: [/^\/zhengce\/jiedu\//]
    },
    interpretation: {
      label: '政策解读',
      sourceUrl: 'https://www.gov.cn/zhengce/jiedu/index.htm',
      dataUrl: 'https://www.gov.cn/zhengce/jiedu/ZCJD_QZ.json',
      moreText: '查看政策解读',
      loadingText: '正在加载政策解读...',
      allowPaths: [/^\/zhengce\//, /^\/zhuanti\//]
    },
    progress: {
      label: '工作进行时',
      sourceUrl: 'https://www.gov.cn/gzjxs/liebiao/',
      dataUrl: 'https://www.gov.cn/gzjxs/liebiao/TONGYONGLIEBIAODRQ.json',
      moreText: '查看工作进行时',
      loadingText: '正在加载工作进行时...'
    }
  }

  const timerStore = window.__ideologyCardTimers || (window.__ideologyCardTimers = {})
  const indexStore = window.__ideologyCardIndexes || (window.__ideologyCardIndexes = {})

  const clearTimers = () => {
    Object.keys(timerStore).forEach(key => {
      window.clearInterval(timerStore[key])
      delete timerStore[key]
    })
  }

  const readDataset = () => {
    const element = document.getElementById(datasetElementId)
    if (!element) return {}

    try {
      return JSON.parse(element.textContent || '{}')
    } catch (error) {
      console.warn('无法解析本地思想数据', error)
      return {}
    }
  }

  const pickRandomEntry = (list, key) => {
    if (!Array.isArray(list) || list.length === 0) return null
    if (list.length === 1) {
      indexStore[key] = 0
      return list[0]
    }

    let nextIndex = Math.floor(Math.random() * list.length)
    while (nextIndex === indexStore[key]) {
      nextIndex = Math.floor(Math.random() * list.length)
    }

    indexStore[key] = nextIndex
    return list[nextIndex]
  }

  const switchContent = (element, updater) => {
    if (!element) return

    element.classList.add('is-switching')
    window.setTimeout(() => {
      updater()
      element.classList.remove('is-switching')
    }, 180)
  }

  const setText = (element, value, fallback = '') => {
    if (!element) return
    element.textContent = value || fallback
  }

  const setLink = (element, text, url, fallbackText) => {
    if (!element) return

    element.textContent = text || fallbackText

    if (url) {
      element.href = url
      element.target = '_blank'
      element.rel = 'external nofollow noopener noreferrer'
    } else {
      element.removeAttribute('href')
      element.removeAttribute('target')
      element.removeAttribute('rel')
    }
  }

  const updateQuoteCard = (card, entry, recommendLabel, animate = false) => {
    if (!card || !entry) return

    const body = card.querySelector('.ideology-card__body')
    const textElement = card.querySelector('.ideology-card__text')
    const sourceElement = card.querySelector('.ideology-card__source')
    const recommendLabelElement = card.querySelector('.ideology-card__label')
    const recommendLinkElement = card.querySelector('.ideology-card__link')

    const updater = () => {
      setText(textElement, entry.text, '暂无内容')
      setText(sourceElement, `出处：${entry.source || '待补充'}`)
      setText(recommendLabelElement, `${recommendLabel}：`)
      setLink(recommendLinkElement, entry.recommend_title, entry.recommend_url, '待补充')
    }

    if (animate && body) {
      switchContent(body, updater)
      return
    }

    updater()
  }

  const updatePoemCard = (card, entry, animate = false) => {
    if (!card || !entry) return

    const body = card.querySelector('.announcement-poem')
    const titleElement = card.querySelector('.announcement-poem__title')
    const lineElement = card.querySelector('.announcement-poem__line')

    const updater = () => {
      setLink(titleElement, entry.title, entry.title_url, '毛泽东诗词')
      setText(lineElement, entry.text, '请稍候')
    }

    if (animate && body) {
      switchContent(body, updater)
      return
    }

    updater()
  }

  const startQuoteRotation = () => {
    const dataset = readDataset()
    const marxList = Array.isArray(dataset.marx_lenin) ? dataset.marx_lenin : []
    const maoList = Array.isArray(dataset.mao_quotes) ? dataset.mao_quotes : []
    const poemList = Array.isArray(dataset.mao_poems) ? dataset.mao_poems : []

    const marxCard = document.getElementById('left-marx-card')
    const maoCard = document.getElementById('left-mao-card')
    const poemCard = document.getElementById('announcement-poem-card')

    if (marxCard && marxList.length) {
      updateQuoteCard(marxCard, pickRandomEntry(marxList, 'marx'), '推荐原著')
      timerStore.marx = window.setInterval(() => {
        updateQuoteCard(marxCard, pickRandomEntry(marxList, 'marx'), '推荐原著', true)
      }, rotateInterval)
    }

    if (maoCard && maoList.length) {
      updateQuoteCard(maoCard, pickRandomEntry(maoList, 'mao'), '推荐阅读')
      timerStore.mao = window.setInterval(() => {
        updateQuoteCard(maoCard, pickRandomEntry(maoList, 'mao'), '推荐阅读', true)
      }, rotateInterval)
    }

    if (poemCard && poemList.length) {
      updatePoemCard(poemCard, pickRandomEntry(poemList, 'poem'))
    }
  }

  const cacheKey = sourceKey => `butterfly:gov-news:${govCacheVersion}:${sourceKey}`

  const ensureGovCardState = card => {
    if (!card.__govCardState) {
      card.__govCardState = {
        pages: {},
        sources: {}
      }
    }

    return card.__govCardState
  }

  const getGovPageStateKey = (sourceKey, rangeKey) => `${sourceKey}:${rangeKey}`

  const getGovPageIndex = (card, sourceKey, rangeKey) => {
    const state = ensureGovCardState(card)
    return Math.max(0, Number(state.pages[getGovPageStateKey(sourceKey, rangeKey)] || 0))
  }

  const setGovPageIndex = (card, sourceKey, rangeKey, pageIndex) => {
    const state = ensureGovCardState(card)
    state.pages[getGovPageStateKey(sourceKey, rangeKey)] = Math.max(0, Number(pageIndex || 0))
  }

  const getGovSourceState = (card, sourceKey) => {
    const state = ensureGovCardState(card)
    return state.sources[sourceKey] || null
  }

  const setGovSourceState = (card, sourceKey, payload) => {
    const state = ensureGovCardState(card)
    state.sources[sourceKey] = payload
  }

  const getLatestGovUpdateTimestamp = now => {
    const date = new Date(now)
    date.setHours(govUpdateHour, 0, 0, 0)

    if (now < date.getTime()) {
      date.setDate(date.getDate() - 1)
    }

    return date.getTime()
  }

  const getNextGovUpdateTimestamp = now => {
    const date = new Date(now)
    date.setHours(govUpdateHour, 0, 0, 0)

    if (now >= date.getTime()) {
      date.setDate(date.getDate() + 1)
    }

    return date.getTime()
  }

  const readCache = sourceKey => {
    try {
      const raw = window.localStorage.getItem(cacheKey(sourceKey))
      if (!raw) return null

      const parsed = JSON.parse(raw)
      if (!parsed || !Array.isArray(parsed.items)) return null

      return parsed
    } catch (error) {
      return null
    }
  }

  const writeCache = (sourceKey, items, timestamp = Date.now()) => {
    try {
      window.localStorage.setItem(cacheKey(sourceKey), JSON.stringify({
        timestamp,
        items
      }))
    } catch (error) {
      console.warn('政府新闻缓存写入失败', error)
    }
  }

  const formatTime = timestamp => {
    if (!timestamp) return ''

    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(timestamp))
  }

  const setGovMeta = (card, message) => {
    if (!card) return
    const updatedElement = card.querySelector('.gov-news__updated')
    if (updatedElement) updatedElement.textContent = message
  }

  const triggerGovScrollRefresh = scope => {
    if (typeof window.refreshAsideScrollViewports === 'function') {
      window.refreshAsideScrollViewports(scope)
      return
    }

    document.dispatchEvent(new CustomEvent('gov-news:refresh-scroll', {
      detail: { scope }
    }))
  }

  const getGovFallbackDate = value => {
    const text = String(value || '')
    const fullDateMatch = text.match(/(20\d{2})-(\d{2})-(\d{2})/)
    if (fullDateMatch) {
      return `${fullDateMatch[1]}-${fullDateMatch[2]}-${fullDateMatch[3]}`
    }

    const compactDateMatch = text.match(/\/(20\d{2})(\d{2})(\d{2})\//)
    if (compactDateMatch) {
      return `${compactDateMatch[1]}-${compactDateMatch[2]}-${compactDateMatch[3]}`
    }

    const yearMonthMatch = text.match(/\/(20\d{2})(\d{2})\//)
    if (yearMonthMatch) {
      return `${yearMonthMatch[1]}-${yearMonthMatch[2]}-01`
    }

    return ''
  }

  const normalizeGovDateText = value => {
    const text = String(value || '').trim()
    const matched = text.match(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/)

    return matched ? matched[0] : getGovFallbackDate(text)
  }

  const toGovTimestamp = dateText => {
    if (!dateText) return 0

    const normalized = dateText.includes(' ')
      ? dateText.replace(/\s+/, 'T')
      : `${dateText}T00:00:00`
    const timestamp = Date.parse(normalized)

    return Number.isFinite(timestamp) ? timestamp : 0
  }

  const getGovDisplayDate = dateText => dateText ? dateText.slice(0, 10) : ''

  const isGovHost = hostname => /(^|\.)gov\.cn$/i.test(String(hostname || ''))

  const matchGovSourceRules = (sourceKey, urlObject) => {
    const source = govSources[sourceKey]
    if (!source || !urlObject || !isGovHost(urlObject.hostname)) return false

    const pathname = urlObject.pathname || '/'
    const allowPaths = Array.isArray(source.allowPaths) ? source.allowPaths : []
    const disallowPaths = Array.isArray(source.disallowPaths) ? source.disallowPaths : []

    if (disallowPaths.some(pattern => pattern.test(pathname))) {
      return false
    }

    if (!allowPaths.length) {
      return true
    }

    return allowPaths.some(pattern => pattern.test(pathname))
  }

  function filterGovItemsByRange(items, rangeKey) {
    const range = govRanges[rangeKey] || govRanges[govDefaultRange]
    const cutoffDate = new Date()
    cutoffDate.setHours(0, 0, 0, 0)
    cutoffDate.setDate(cutoffDate.getDate() - (range.days - 1))
    const cutoffTimestamp = cutoffDate.getTime()

    return items.filter(item => item.timestamp >= cutoffTimestamp)
  }

  const paginateGovItems = (items, pageIndex) => {
    if (!items.length) {
      return {
        pageCount: 0,
        pageIndex: 0,
        items: []
      }
    }

    const pageCount = Math.ceil(items.length / govPageSize)
    const safePageIndex = Math.min(Math.max(0, pageIndex), pageCount - 1)
    const startIndex = safePageIndex * govPageSize

    return {
      pageCount,
      pageIndex: safePageIndex,
      items: items.slice(startIndex, startIndex + govPageSize)
    }
  }

  const normalizeItems = (sourceKey, items) => {
    const source = govSources[sourceKey]
    const seen = new Set()

    return (Array.isArray(items) ? items : [])
      .map((item, index) => {
        const title = String(item?.TITLE || item?.title || '').trim()
        const rawUrl = String(item?.URL || item?.url || '').trim()
        const dateText = normalizeGovDateText(item?.DOCRELPUBTIME || item?.date || rawUrl)

        if (!title || !rawUrl) return null

        let urlObject = null
        try {
          urlObject = new URL(rawUrl, source.sourceUrl || govHome)
        } catch (error) {
          return null
        }

        if (!matchGovSourceRules(sourceKey, urlObject)) {
          return null
        }

        return {
          title,
          url: urlObject.href,
          date: getGovDisplayDate(dateText),
          sourceKey,
          sourceUrl: source.sourceUrl,
          timestamp: toGovTimestamp(dateText),
          order: index
        }
      })
      .filter(item => item && item.timestamp)
      .filter(item => {
        if (seen.has(item.url)) return false
        seen.add(item.url)
        return true
      })
      .sort((left, right) => (right.timestamp - left.timestamp) || (left.order - right.order))
  }

  const setGovMoreLink = (card, sourceKey) => {
    if (!card) return

    const source = govSources[sourceKey]
    const link = card.querySelector('#gov-news-more')
    if (!source || !link) return

    link.href = source.sourceUrl
    link.textContent = source.moreText
  }

  const setGovPagerState = (card, pageIndex = 0, pageCount = 0) => {
    if (!card) return

    const prevButton = card.querySelector('#gov-news-page-prev')
    const nextButton = card.querySelector('#gov-news-page-next')

    if (!prevButton || !nextButton) return

    const hasPrev = pageCount > 1 && pageIndex > 0
    const hasNext = pageCount > 1 && pageIndex < (pageCount - 1)

    prevButton.hidden = !hasPrev
    nextButton.hidden = !hasNext
    prevButton.disabled = !hasPrev
    nextButton.disabled = !hasNext
  }

  const syncGovFooter = (card, sourceKey, pageIndex = 0, pageCount = 0) => {
    setGovMoreLink(card, sourceKey)
    setGovPagerState(card, pageIndex, pageCount)
  }

  const renderGovStatus = (panel, message, sourceKey, withLink = false) => {
    if (!panel) return

    const list = panel.querySelector('.gov-news__list')
    if (!list) return

    list.innerHTML = ''

    const item = document.createElement('li')
    item.className = 'gov-news__status'

    if (withLink && govSources[sourceKey]) {
      item.append(document.createTextNode(`${message}，`))
      const link = document.createElement('a')
      link.href = govSources[sourceKey].sourceUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer nofollow'
      link.textContent = '点击直达官方栏目'
      item.append(link)
    } else {
      item.textContent = message
    }

    list.append(item)

    if (panel.classList.contains('is-active')) {
      triggerGovScrollRefresh(panel)
    }
  }

  const renderGovList = (panel, items, sourceKey) => {
    if (!panel) return

    const list = panel.querySelector('.gov-news__list')
    if (!list) return

    list.innerHTML = ''

    if (!items.length) {
      renderGovStatus(panel, '当前时间范围暂无内容', sourceKey, true)
      return
    }

    items.forEach(item => {
      const listItem = document.createElement('li')
      listItem.className = 'gov-news__item'

      const link = document.createElement('a')
      link.className = 'gov-news__link'
      link.href = item.url
      link.target = '_blank'
      link.rel = 'noopener noreferrer nofollow'
      link.textContent = item.title

      listItem.append(link)

      if (item.date) {
        const time = document.createElement('time')
        time.className = 'gov-news__date'
        time.textContent = item.date
        listItem.append(time)
      }

      list.append(listItem)
    })

    if (panel.classList.contains('is-active')) {
      triggerGovScrollRefresh(panel)
    }
  }

  const fetchGovSourceItems = async sourceKey => {
    const source = govSources[sourceKey]
    const response = await fetch(source.dataUrl, { mode: 'cors', cache: 'no-store' })
    if (!response.ok) throw new Error(`${source.label}获取失败：${response.status}`)

    const data = await response.json()
    const items = normalizeItems(sourceKey, data)

    if (!items.length) throw new Error(`${source.label}列表为空`)
    return items
  }

  const renderGovPanel = (card, sourceKey) => {
    if (!card) return

    const panel = card.querySelector(`.gov-news__panel[data-panel="${sourceKey}"]`)
    const sourceState = getGovSourceState(card, sourceKey)
    const rangeKey = card.dataset.activeRange || govDefaultRange

    if (!panel || !sourceState) {
      if ((card.dataset.activeTab || govDefaultTab) === sourceKey) {
        syncGovFooter(card, sourceKey, 0, 0)
      }
      return
    }

    if (sourceState.state === 'failed') {
      renderGovStatus(panel, '暂时无法获取', sourceKey, true)
      if ((card.dataset.activeTab || govDefaultTab) === sourceKey) {
        syncGovFooter(card, sourceKey, 0, 0)
      }
      return
    }

    const rangeItems = filterGovItemsByRange(sourceState.items, rangeKey)
    const currentPageIndex = getGovPageIndex(card, sourceKey, rangeKey)
    const pagination = paginateGovItems(rangeItems, currentPageIndex)

    setGovPageIndex(card, sourceKey, rangeKey, pagination.pageIndex)

    if (!rangeItems.length) {
      renderGovStatus(panel, '当前时间范围暂无内容', sourceKey, true)
      if ((card.dataset.activeTab || govDefaultTab) === sourceKey) {
        syncGovFooter(card, sourceKey, 0, 0)
      }
      return
    }

    renderGovList(panel, pagination.items, sourceKey)

    if ((card.dataset.activeTab || govDefaultTab) === sourceKey) {
      syncGovFooter(card, sourceKey, pagination.pageIndex, pagination.pageCount)
    }
  }

  const activateGovTab = (card, tabName) => {
    if (!card) return

    card.dataset.activeTab = tabName

    card.querySelectorAll('.gov-news__tab').forEach(tab => {
      tab.classList.toggle('is-active', tab.dataset.tab === tabName)
    })

    card.querySelectorAll('.gov-news__panel').forEach(panel => {
      panel.classList.toggle('is-active', panel.dataset.panel === tabName)
    })

    renderGovPanel(card, tabName)
    triggerGovScrollRefresh(card.querySelector(`.gov-news__panel[data-panel="${tabName}"]`) || card)
  }

  const activateGovRange = (card, rangeKey) => {
    if (!card) return

    card.dataset.activeRange = rangeKey

    card.querySelectorAll('.gov-news__range').forEach(rangeButton => {
      rangeButton.classList.toggle('is-active', rangeButton.dataset.range === rangeKey)
    })
  }

  const bindGovControls = card => {
    if (!card || card.dataset.bound === 'true') return

    card.querySelectorAll('.gov-news__tab').forEach(tab => {
      tab.addEventListener('click', () => activateGovTab(card, tab.dataset.tab))
    })

    card.querySelectorAll('.gov-news__range').forEach(rangeButton => {
      rangeButton.addEventListener('click', () => {
        const nextRange = rangeButton.dataset.range
        if (card.dataset.activeRange === nextRange) return

        activateGovRange(card, nextRange)
        refreshGovCard(card)
      })
    })

    const prevButton = card.querySelector('#gov-news-page-prev')
    const nextButton = card.querySelector('#gov-news-page-next')

    if (prevButton) {
      prevButton.addEventListener('click', () => {
        const sourceKey = card.dataset.activeTab || govDefaultTab
        const rangeKey = card.dataset.activeRange || govDefaultRange
        const nextPageIndex = getGovPageIndex(card, sourceKey, rangeKey) - 1

        setGovPageIndex(card, sourceKey, rangeKey, nextPageIndex)
        renderGovPanel(card, sourceKey)
      })
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        const sourceKey = card.dataset.activeTab || govDefaultTab
        const rangeKey = card.dataset.activeRange || govDefaultRange
        const nextPageIndex = getGovPageIndex(card, sourceKey, rangeKey) + 1

        setGovPageIndex(card, sourceKey, rangeKey, nextPageIndex)
        renderGovPanel(card, sourceKey)
      })
    }

    card.dataset.bound = 'true'
  }

  const loadGovPanel = async (sourceKey, forceRefresh = false) => {
    const cache = readCache(sourceKey)
    const latestRequiredTimestamp = getLatestGovUpdateTimestamp(Date.now())

    if (!forceRefresh && cache && cache.timestamp >= latestRequiredTimestamp) {
      return { sourceKey, items: cache.items, timestamp: cache.timestamp, state: 'cache' }
    }

    try {
      const items = await fetchGovSourceItems(sourceKey)
      const timestamp = Date.now()
      writeCache(sourceKey, items, timestamp)
      return {
        sourceKey,
        items,
        timestamp,
        state: 'network'
      }
    } catch (error) {
      console.warn(`国家要闻卡片加载失败：${sourceKey}`, error)

      if (cache) {
        return { sourceKey, items: cache.items, timestamp: cache.timestamp, state: 'stale-cache' }
      }

      return { sourceKey, items: [], timestamp: 0, state: 'failed' }
    }
  }

  const refreshGovCard = async (card, forceRefresh = false) => {
    if (!card) return

    const requestToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    card.dataset.govRequestToken = requestToken

    setGovMeta(card, forceRefresh ? '正在执行今晚 20:00 的同步更新...' : '正在检查今日 20:00 更新状态...')

    const results = await Promise.all(
      Object.keys(govSources).map(sourceKey => loadGovPanel(sourceKey, forceRefresh))
    )

    if (card.dataset.govRequestToken !== requestToken) return

    results.forEach(result => {
      setGovSourceState(card, result.sourceKey, result)
      renderGovPanel(card, result.sourceKey)
    })

    const latestTimestamp = results.reduce((max, item) => Math.max(max, item.timestamp || 0), 0)

    if (latestTimestamp) {
      setGovMeta(card, `每日 20:00 更新，最近同步于 ${formatTime(latestTimestamp)}`)
      renderGovPanel(card, card.dataset.activeTab || govDefaultTab)
      return
    }

    setGovMeta(card, '暂时无法获取官方数据')
    syncGovFooter(card, card.dataset.activeTab || govDefaultTab, 0, 0)
  }

  const scheduleNextGovRefresh = card => {
    const delay = Math.max(1000, getNextGovUpdateTimestamp(Date.now()) - Date.now())
    timerStore.gov = window.setTimeout(async () => {
      if (!document.hidden) {
        await refreshGovCard(card, true)
      }
      scheduleNextGovRefresh(card)
    }, delay)
  }

  const initGovNewsCard = () => {
    const card = document.getElementById('gov-news-card')
    if (!card) return

    bindGovControls(card)
    activateGovRange(card, card.dataset.activeRange || govDefaultRange)
    activateGovTab(card, card.dataset.activeTab || govDefaultTab)
    refreshGovCard(card)
    scheduleNextGovRefresh(card)
  }

  const initIdeologyWidgets = () => {
    clearTimers()
    startQuoteRotation()
    initGovNewsCard()
  }

  document.addEventListener('DOMContentLoaded', initIdeologyWidgets)
  document.addEventListener('pjax:complete', initIdeologyWidgets)
  document.addEventListener('pjax:send', clearTimers)
})()
