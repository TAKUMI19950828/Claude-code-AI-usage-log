/**
 * 支出チェック — 純粋計算ロジックとカテゴリ定義
 *
 * ここには DOM に依存しない純粋関数のみを置く（単体テスト対象）。
 * 表示・状態・localStorage は src/scripts/expense.ts が担当する。
 */

export interface Category {
  /** state のキー */
  key: string;
  /** 表示ラベル */
  label: string;
  /** カテゴリ色トークン番号（--color-chart-N） */
  colorIndex: number;
  /** 初期値（円） */
  initial: number;
  /** スライダー初期上限（円）。入力がこれを超えたら動的に拡張する */
  sliderMax: number;
  /** スライダー刻み（円） */
  step: number;
}

/** 支出カテゴリ定義（住居と通信で桁が違うため max/step を個別設定） */
export const CATEGORIES: readonly Category[] = [
  { key: 'food', label: '食費', colorIndex: 1, initial: 60000, sliderMax: 150000, step: 1000 },
  { key: 'housing', label: '住居', colorIndex: 2, initial: 80000, sliderMax: 250000, step: 5000 },
  { key: 'utility', label: '水道光熱', colorIndex: 3, initial: 18000, sliderMax: 60000, step: 1000 },
  { key: 'comm', label: '通信', colorIndex: 4, initial: 10000, sliderMax: 40000, step: 500 },
  { key: 'transport', label: '交通', colorIndex: 5, initial: 12000, sliderMax: 60000, step: 1000 },
  { key: 'leisure', label: '娯楽', colorIndex: 6, initial: 25000, sliderMax: 100000, step: 1000 },
  { key: 'other', label: 'その他', colorIndex: 7, initial: 20000, sliderMax: 100000, step: 1000 },
] as const;

export type ExpenseMap = Record<string, number>;

export interface AppState {
  /** カテゴリキー -> 金額（円） */
  expenses: ExpenseMap;
  /** 月間予算（円） */
  budget: number;
  /** 月収（円、任意。0 のとき未入力扱い） */
  income: number;
  /** 将来予測の月数 */
  months: number;
}

export interface CategoryBreakdown extends Category {
  amount: number;
  /** 合計に対する割合（0-100）。合計0なら0 */
  ratio: number;
}

export interface Summary {
  total: number;
  budget: number;
  /** 予算残（予算 - 合計）。マイナスなら超過 */
  remaining: number;
  /** 予算に対する使用率（0始まり、100超で超過）。予算0なら0 */
  usageRate: number;
  /** 予算ステータス */
  status: 'under' | 'near' | 'over';
  breakdown: CategoryBreakdown[];
}

export interface Forecast {
  months: number;
  /** 累計支出 */
  totalCumulative: number;
  /** 月次の累計推移（長さ = months、各要素は1..months月目の累計） */
  cumulative: number[];
  /** 予算ベースの累計 */
  budgetCumulative: number;
  /** 予算比の差額（累計支出 - 予算累計）。プラスで予算超過 */
  budgetDiff: number;
}

/** 空文字・NaN・負値を 0 以上の整数に正規化する */
export function normalizeAmount(value: number | string): number {
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.-]/g, '')) : value;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

/** 全カテゴリ支出の合計 */
export function calcTotal(expenses: ExpenseMap): number {
  return CATEGORIES.reduce((sum, c) => sum + normalizeAmount(expenses[c.key] ?? 0), 0);
}

/** 割合（％）。分母0なら0を返す（NaN除算ガード） */
export function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

/** 予算ステータス判定：90%未満=under、90-100%=near、100%超=over */
export function budgetStatus(total: number, budget: number): Summary['status'] {
  if (budget <= 0) return 'under';
  const rate = (total / budget) * 100;
  if (rate > 100) return 'over';
  if (rate >= 90) return 'near';
  return 'under';
}

/** 当月サマリー（合計・予算残・使用率・内訳）を算出 */
export function calcSummary(state: AppState): Summary {
  const total = calcTotal(state.expenses);
  const budget = normalizeAmount(state.budget);
  const breakdown: CategoryBreakdown[] = CATEGORIES.map((c) => {
    const amount = normalizeAmount(state.expenses[c.key] ?? 0);
    return { ...c, amount, ratio: pct(amount, total) };
  });
  return {
    total,
    budget,
    remaining: budget - total,
    usageRate: pct(total, budget),
    status: budgetStatus(total, budget),
    breakdown,
  };
}

/** 貯蓄率（％）。(収入 - 支出) / 収入。収入0なら null */
export function savingsRate(income: number, total: number): number | null {
  const inc = normalizeAmount(income);
  if (inc <= 0) return null;
  return ((inc - total) / inc) * 100;
}

/** このペースで続けた場合の将来累計（単純線形外挿） */
export function calcForecast(state: AppState): Forecast {
  const months = Math.max(1, Math.round(state.months));
  const total = calcTotal(state.expenses);
  const budget = normalizeAmount(state.budget);
  const cumulative: number[] = [];
  for (let m = 1; m <= months; m += 1) {
    cumulative.push(total * m);
  }
  return {
    months,
    totalCumulative: total * months,
    cumulative,
    budgetCumulative: budget * months,
    budgetDiff: (total - budget) * months,
  };
}

export interface DonutSegment {
  colorIndex: number;
  label: string;
  amount: number;
  ratio: number;
  /** circle の stroke-dasharray（円周100基準）: "<len> <rest>" */
  dash: string;
  /** circle の stroke-dashoffset（円周100基準） */
  offset: number;
}

/**
 * ドーナツ用セグメントを算出（pathLength=100 基準なので ratio をそのまま長さに使える）。
 * 金額0のカテゴリは除外。合計0なら空配列（呼び出し側でプレースホルダ表示）。
 */
export function donutSegments(breakdown: CategoryBreakdown[]): DonutSegment[] {
  const segments: DonutSegment[] = [];
  let acc = 0;
  for (const b of breakdown) {
    if (b.amount <= 0 || b.ratio <= 0) continue;
    segments.push({
      colorIndex: b.colorIndex,
      label: b.label,
      amount: b.amount,
      ratio: b.ratio,
      dash: `${b.ratio} ${100 - b.ratio}`,
      // 円の起点(3時)から12時方向に並べるため -25 オフセット + 累積
      offset: 25 - acc,
    });
    acc += b.ratio;
  }
  return segments;
}

/** 円表記（¥1,234,567）。内部は数値保持、表示時のみ整形する */
const yenFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
export function formatYen(value: number): string {
  return `¥${yenFormatter.format(Math.round(value))}`;
}

/** パーセント表記（小数1桁、整数なら整数表示） */
export function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}
