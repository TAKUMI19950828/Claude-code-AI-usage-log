import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcTotal,
  calcSummary,
  calcForecast,
  pct,
  budgetStatus,
  savingsRate,
  normalizeAmount,
  donutSegments,
  type AppState,
} from '../src/lib/calc.ts';

function makeState(over: Partial<AppState> = {}): AppState {
  return {
    expenses: { food: 50000, housing: 80000 },
    budget: 200000,
    income: 300000,
    months: 12,
    ...over,
  };
}

test('normalizeAmount: 空文字・負値・カンマを正規化', () => {
  assert.equal(normalizeAmount(''), 0);
  assert.equal(normalizeAmount(-100), 0);
  assert.equal(normalizeAmount('1,234'), 1234);
  assert.equal(normalizeAmount(1234.6), 1235);
});

test('pct: 分母0でNaNにならず0を返す', () => {
  assert.equal(pct(100, 0), 0);
  assert.equal(pct(50, 200), 25);
});

test('budgetStatus: under / near / over の境界', () => {
  assert.equal(budgetStatus(100, 200), 'under'); // 50%
  assert.equal(budgetStatus(185, 200), 'near'); // 92.5%
  assert.equal(budgetStatus(201, 200), 'over'); // 100.5%
  assert.equal(budgetStatus(100, 0), 'under'); // 予算未設定
});

test('calcTotal / calcSummary: 合計と予算残', () => {
  const s = makeState();
  assert.equal(calcTotal(s.expenses), 130000);
  const sum = calcSummary(s);
  assert.equal(sum.total, 130000);
  assert.equal(sum.remaining, 70000);
  assert.equal(sum.status, 'under');
});

test('calcSummary: 全カテゴリ0でも割合は0でNaNなし', () => {
  const sum = calcSummary(makeState({ expenses: {} }));
  assert.equal(sum.total, 0);
  assert.ok(sum.breakdown.every((b) => b.ratio === 0));
});

test('donutSegments: 合計0なら空配列', () => {
  const sum = calcSummary(makeState({ expenses: {} }));
  assert.deepEqual(donutSegments(sum.breakdown), []);
});

test('savingsRate: 収入0ならnull、通常は%を返す', () => {
  assert.equal(savingsRate(0, 100000), null);
  assert.equal(savingsRate(300000, 150000), 50);
});

test('calcForecast: 月数違いで累計が変わる', () => {
  const f6 = calcForecast(makeState({ months: 6 }));
  const f12 = calcForecast(makeState({ months: 12 }));
  assert.equal(f6.totalCumulative, 130000 * 6);
  assert.equal(f12.totalCumulative, 130000 * 12);
  assert.equal(f12.cumulative.length, 12);
  // 予算200000 > 支出130000 なので予算比はマイナス（予算内）
  assert.ok(f12.budgetDiff < 0);
});
