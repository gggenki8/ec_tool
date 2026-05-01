const DAILY_LIMIT = 50
const STORAGE_KEY = 'ec_usage'
const HISTORY_KEY = 'ec_history'

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getUsage() {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  if (data.date !== getToday()) return { date: getToday(), count: 0 }
  return data
}

function saveUsage(usage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage))
}

function updateUsageDisplay() {
  const usage = getUsage()
  const remaining = DAILY_LIMIT - usage.count
  document.getElementById('usageCount').textContent = Math.max(0, remaining)
}

function getHistory() {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
}

function saveHistory(item) {
  const history = getHistory()
  history.unshift(item)
  if (history.length > 20) history.pop()
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

function clearHistory() {
  if (!confirm('履歴をすべて削除しますか？')) return
  localStorage.removeItem(HISTORY_KEY)
  renderHistory()
}

function renderHistory() {
  const list = document.getElementById('historyList')
  const history = getHistory()

  if (history.length === 0) {
    list.innerHTML = '<p style="font-size:13px;color:var(--text-tertiary);text-align:center;padding:2rem 0">まだ履歴がありません</p>'
    return
  }

  list.innerHTML = history.map((item, i) => `
    <div class="history-item" onclick="loadHistory(${i})">
      <div class="history-item-name">${item.productName}</div>
      <div class="history-item-meta">
        <span>${item.platforms.join('・')}</span>
        <span>${item.date}</span>
      </div>
    </div>
  `).join('')
}

function loadHistory(index) {
  const item = getHistory()[index]
  if (!item) return

  document.getElementById('productName').value = item.productName || ''
  document.getElementById('category').value = item.category || ''
  document.getElementById('features').value = item.features || ''
  document.getElementById('price').value = item.price || ''
  document.getElementById('target').value = item.target || ''
  document.getElementById('uniqueness').value = item.uniqueness || ''
  document.getElementById('note').value = item.note || ''

  const resultArea = document.getElementById('resultArea')
  resultArea.innerHTML = renderResults(item.results)
  bindCopyButtons()

  toggleSidebar()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('overlay')
  sidebar.classList.toggle('open')
  overlay.classList.toggle('show')
  if (sidebar.classList.contains('open')) renderHistory()
}

function togglePlatform(el) {
  el.classList.toggle('active')
}

function platformLabel(platform) {
  const labels = {
    amazon: 'Amazon 用説明文',
    rakuten: '楽天市場 用説明文',
    shopify: 'Shopify 用説明文',
    sns: 'SNS 投稿文'
  }
  return labels[platform] || platform
}

function renderResults(results) {
    return Object.entries(results).map(([platform, text]) => `
      <div class="result-card">
        <div class="result-header">
          <span class="platform-label">${platformLabel(platform)}</span>
          <button class="copy-btn" data-text="${encodeURIComponent(text)}">コピー</button>
        </div>
        <div class="result-text markdown-body">${marked.parse(text)}</div>
      </div>
    `).join('')
  }

function bindCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = decodeURIComponent(btn.dataset.text)
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'コピー完了'
        btn.classList.add('copied')
        setTimeout(() => {
          btn.textContent = 'コピー'
          btn.classList.remove('copied')
        }, 2000)
      })
    })
  })
}

async function generate() {
  const productName = document.getElementById('productName').value.trim()
  const category = document.getElementById('category').value
  const features = document.getElementById('features').value.trim()
  const price = document.getElementById('price').value.trim()
  const target = document.getElementById('target').value.trim()
  const uniqueness = document.getElementById('uniqueness').value.trim()
  const note = document.getElementById('note').value.trim()

  if (!productName || !category || !features || !price || !target || !uniqueness) {
    alert('必須項目をすべて入力してください')
    return
  }

  const platforms = Array.from(
    document.querySelectorAll('.platform-chip.active')
  ).map(el => el.dataset.value)

  if (platforms.length === 0) {
    alert('出力媒体を1つ以上選択してください')
    return
  }

  const usage = getUsage()
  if (usage.count >= DAILY_LIMIT) {
    alert('本日の無料生成回数（50回）を超えました。\n無制限プランへのアップグレードをご検討ください。')
    return
  }

  const btn = document.getElementById('generateBtn')
  const resultArea = document.getElementById('resultArea')

  btn.disabled = true
  resultArea.innerHTML = `
    <div class="loading-state">
      説明文を生成しています...
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `

  try {
    const response = await fetch('http://localhost:8000/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, category, features, price, target, uniqueness, note, platforms })
    })

    if (!response.ok) throw new Error('API error')
    const data = await response.json()

    usage.count += 1
    saveUsage(usage)
    updateUsageDisplay()

    const historyItem = {
      productName,
      category,
      features,
      price,
      target,
      uniqueness,
      note,
      platforms,
      results: data.results,
      date: new Date().toLocaleDateString('ja-JP')
    }
    saveHistory(historyItem)

    resultArea.innerHTML = renderResults(data.results)
    bindCopyButtons()
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' })

  } catch (e) {
    resultArea.innerHTML = '<div class="error-msg">エラーが発生しました。バックエンドが起動しているか確認してください。</div>'
  }

  btn.disabled = false
}

document.addEventListener('DOMContentLoaded', () => {
  updateUsageDisplay()
})