import { expect, test } from 'bun:test';
import { parseInstant, timerValue } from '../src/timers';

const start = '2026-09-19T12:00:00Z';
const now = Date.parse('2026-09-19T12:00:10Z');
test('timer instants require real calendar dates and an explicit zone', () => {
  for (const value of [
    '2026-02-29T12:00:00Z',
    '2026-09-31T12:00:00Z',
    '2026-09-19T24:00:00Z',
    '2026-09-19T12:00:60Z',
    '2026-09-19T12:00:00',
    '2026-09-19',
    '2026-09-19T12:00:00+25:00',
  ])
    expect(Number.isNaN(parseInstant(value))).toBe(true);
  expect(Number.isFinite(parseInstant('2024-02-29T12:00:00.125+03:30'))).toBe(true);
});
test('all timer formats and lifecycle states have deterministic values', () => {
  for (const state of [
    undefined,
    'pending',
    'running',
    'waiting',
    'paused',
    'completed',
    'failed',
    'cancelled',
    'unknown',
  ]) {
    for (const live of [true, false]) {
      const value = timerValue('active', start, undefined, '12.5', state, live, now);
      const fixed = ['pending', 'waiting', 'paused', 'completed', 'failed', 'cancelled'].includes(
        state ?? '',
      );
      expect(value.seconds).toBe(fixed ? 12.5 : state === 'unknown' || !live ? NaN : 22.5);
      expect(value.ticking).toBe(!fixed && live && state !== 'unknown');
    }
  }
  expect(
    timerValue('elapsed', start, '2026-09-19T12:00:04Z', undefined, 'completed', false, now)
      .seconds,
  ).toBe(4);
  expect(timerValue('countdown', start, undefined, undefined, 'running', true, now)).toMatchObject({
    seconds: 0,
    ticking: false,
  });
  expect(
    timerValue('duration', 'P1DT2H3M4.5S', undefined, undefined, undefined, false, now).seconds,
  ).toBe(93784.5);
});
test('invalid numeric and duration metadata never creates a live counter', () => {
  for (const value of ['', ' ', '-1', 'Infinity', 'NaN', '0x10', '1e999'])
    expect(timerValue('active', start, undefined, value, 'paused', true, now).seconds).toBe(NaN);
  for (const value of ['P', 'PT', 'P1DT', 'P1M', 'P1Y', 'PT-1S'])
    expect(timerValue('duration', value, undefined, undefined, undefined, true, now).seconds).toBe(
      NaN,
    );
  expect(timerValue('active', start, undefined, '1e2', 'paused', true, now).seconds).toBe(100);
});
