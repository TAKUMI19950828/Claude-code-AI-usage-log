/**
 * 支出チェック — クライアント側の状態管理と描画
 *
 * 設計: state を唯一のソースとし「input → state 更新 → scheduleRender → render」の
 * 一方向フロー。スライダーと数値入力は state から value を書き戻すだけにして
 * 相互参照ループ／ちらつきを防ぐ。描画は requestAnimationFrame で合体する。
 */
import {
  CATEGORIES,
  calcSummary,
  calcForecast,
  donutSegments,
  savingsRate,
  normalizeAmount,
  formatYen,
  formatPct,
  type AppState,
} from '../lib/calc';

const STORAGE_KEY = 'expense-check:v1';
const STORAGE_VERSION = 1;

const $ = <T extends Element>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

function defaultState(): AppState {
  return {
    expenses: Object.fromEntries(CATEGORIES.map((c) => [c.key, c.initial])),
    budget: 240000,
    income: 350000,
    months: 12,
  };
}

/** localStorage から復元（バージョン不一致・破損・例外はデフォルトにフォールバック） */
function loadState(): AppState {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as { v?: number; data?: Partial<AppState> };
    if (parsed.v !== STORAGE_VERSION || !parsed.data) return base;
    const d = parsed.data;
    return {
      expenses: { ...base.expenses, ...(d.expenses ?? {}) },
      budget: normalizeAmount(d.budget ?? base.budget),
      income: normalizeAmount(d.income ?? base.income),
      months: typeof d.months === 'number' ? d.months : base.months,
    };
  } catch {
    return base;
  }
}

function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, data: state }));
  } catch {
    /* プライベートブラウズ等で setItem が失敗しても致命的でないため無視 */
  }
}

const state = loadState();

// --- 描画の合体（rAF + pending フラグ） ---
let pending = false;
function scheduleRender(): void {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    render();
    saveState(state);
  });
}

const STATUS_LABEL = { under: '予算内', near: '予算に接近', over: '予算オーバー' } as const;
const STATUS_ICON = { under: '✓', near: '△', over: '!' } as const;

function render(): void {
  const summary = calcSummary(state);
  const forecast = calcForecast(state);

  // サマリー
  setText('[data-summary-value="total"]', formatYen(summary.total));
  const remainEl = $('[data-summary-card="remaining"]');
  if (remainEl) remainEl.setAttribute('data-tone', summary.remaining < 0 ? 'bad' : 'good');
  setText('[data-summary-value="remaining"]', formatYen(summary.remaining));

  // ゲージ
  const gauge = $('[data-gauge]');
  if (gauge) gauge.setAttribute('data-status', summary.status);
  const fill = $<HTMLElement>('[data-gauge-fill]');
  if (fill) fill.style.width = `${Math.min(summary.usageRate, 100)}%`;
  setText('[data-gauge-rate]', formatPct(summary.usageRate));
  setText('[data-gauge-label]', STATUS_LABEL[summary.status]);
  setText('[data-gauge-icon]', STATUS_ICON[summary.status]);
  const gaugeImg = $('.gauge[role="img"]');
  if (gaugeImg) gaugeImg.setAttribute('aria-label', `予算使用率 ${formatPct(summary.usageRate)}`);

  // ドーナツ
  const segs = donutSegments(summary.breakdown);
  const donut = $('[data-donut]');
  if (donut) {
    donut.innerHTML = segs
      .map(
        (s) =>
          `<circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--color-chart-${s.colorIndex})" stroke-width="6" pathLength="100" stroke-dasharray="${s.dash}" stroke-dashoffset="${s.offset}"></circle>`,
      )
      .join('');
  }
  setText('[data-donut-total]', formatYen(summary.total));

  // 凡例
  const legend = $('[data-legend]');
  if (legend) {
    legend.innerHTML = summary.breakdown
      .filter((b) => b.amount > 0)
      .map(
        (b) =>
          `<li class="legend__item"><span class="legend__swatch" style="background:var(--color-chart-${b.colorIndex})"></span><span class="legend__name">${b.label}</span><span class="num legend__amount">${formatYen(b.amount)}</span><span class="num legend__pct caption">${formatPct(b.ratio)}</span></li>`,
      )
      .join('');
  }
  const empty = $<HTMLElement>('[data-donut-empty]');
  if (empty) empty.hidden = summary.total > 0;

  // SRテーブル
  const srBody = $('[data-sr-table] tbody');
  if (srBody) {
    srBody.innerHTML = summary.breakdown
      .map(
        (b) =>
          `<tr><td>${b.label}</td><td>${formatYen(b.amount)}</td><td>${formatPct(b.ratio)}</td></tr>`,
      )
      .join('');
  }

  // 貯蓄率
  const rate = savingsRate(state.income, summary.total);
  setText('[data-summary-value="savings"]', rate === null ? '—' : formatPct(rate));
  const savingsCard = $('[data-summary-card="savings"]');
  if (savingsCard) savingsCard.setAttribute('data-tone', rate !== null && rate >= 0 ? 'good' : 'bad');

  // 将来予測
  setText('[data-months-label]', `${forecast.months}ヶ月`);
  setText('[data-forecast-total]', formatYen(forecast.totalCumulative));
  const diffEl = $<HTMLElement>('[data-forecast-diff]');
  if (diffEl) {
    diffEl.textContent = `予算比 ${forecast.budgetDiff > 0 ? '+' : ''}${formatYen(forecast.budgetDiff)}`;
    diffEl.setAttribute('data-over', forecast.budgetDiff > 0 ? 'true' : 'false');
  }

  // トレンド棒グラフ
  const trend = $('[data-trend]');
  if (trend) {
    const max = Math.max(...forecast.cumulative, 1);
    trend.innerHTML = forecast.cumulative
      .map((v, i) => {
        const over =
          forecast.budgetCumulative > 0 &&
          v > forecast.budgetCumulative * ((i + 1) / forecast.months);
        const labelEvery = forecast.months > 12 ? (i + 1) % 2 === 0 : true;
        return `<div class="trend__col"><div class="trend__bar" style="height:${(v / max) * 100}%" data-over="${over}"></div><span class="trend__label caption">${labelEvery ? i + 1 : ''}</span></div>`;
      })
      .join('');
  }

  syncInputs();
}

/** state から各入力の value を書き戻す（一方向同期） */
function syncInputs(): void {
  for (const c of CATEGORIES) {
    const amount = normalizeAmount(state.expenses[c.key] ?? 0);
    const input = $<HTMLInputElement>(`[data-amount-input="${c.key}"]`);
    const slider = $<HTMLInputElement>(`[data-amount-slider="${c.key}"]`);
    if (input && document.activeElement !== input) input.value = amount.toLocaleString('ja-JP');
    if (slider) {
      // 入力がスライダー上限を超えたら動的に拡張
      if (amount > Number(slider.max)) slider.max = String(Math.ceil(amount / c.step) * c.step);
      slider.value = String(amount);
    }
  }
  const budgetInput = $<HTMLInputElement>('[data-budget-input]');
  const budgetSlider = $<HTMLInputElement>('[data-budget-slider]');
  if (budgetInput && document.activeElement !== budgetInput)
    budgetInput.value = normalizeAmount(state.budget).toLocaleString('ja-JP');
  if (budgetSlider) {
    if (state.budget > Number(budgetSlider.max)) budgetSlider.max = String(state.budget);
    budgetSlider.value = String(normalizeAmount(state.budget));
  }
  const incomeInput = $<HTMLInputElement>('[data-income-input]');
  if (incomeInput && document.activeElement !== incomeInput)
    incomeInput.value = normalizeAmount(state.income).toLocaleString('ja-JP');
  const monthsSlider = $<HTMLInputElement>('[data-months-slider]');
  if (monthsSlider) monthsSlider.value = String(state.months);
}

function setText(sel: string, text: string): void {
  const el = $(sel);
  if (el) el.textContent = text;
}

// --- イベント結線 ---
function bind(): void {
  // カテゴリ（数値入力 + スライダー）
  for (const c of CATEGORIES) {
    $<HTMLInputElement>(`[data-amount-input="${c.key}"]`)?.addEventListener('input', (e) => {
      state.expenses[c.key] = normalizeAmount((e.target as HTMLInputElement).value);
      scheduleRender();
    });
    $<HTMLInputElement>(`[data-amount-slider="${c.key}"]`)?.addEventListener('input', (e) => {
      state.expenses[c.key] = normalizeAmount((e.target as HTMLInputElement).value);
      scheduleRender();
    });
  }
  // 予算
  $<HTMLInputElement>('[data-budget-input]')?.addEventListener('input', (e) => {
    state.budget = normalizeAmount((e.target as HTMLInputElement).value);
    scheduleRender();
  });
  $<HTMLInputElement>('[data-budget-slider]')?.addEventListener('input', (e) => {
    state.budget = normalizeAmount((e.target as HTMLInputElement).value);
    scheduleRender();
  });
  // 月収
  $<HTMLInputElement>('[data-income-input]')?.addEventListener('input', (e) => {
    state.income = normalizeAmount((e.target as HTMLInputElement).value);
    scheduleRender();
  });
  // 予測期間
  $<HTMLInputElement>('[data-months-slider]')?.addEventListener('input', (e) => {
    state.months = Number((e.target as HTMLInputElement).value) || 1;
    scheduleRender();
  });
}

bind();
render();
