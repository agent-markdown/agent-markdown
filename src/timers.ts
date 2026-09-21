import type { RendererOptions, RenderState } from './types';

const states = new Set([
  'pending',
  'running',
  'waiting',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);
const terminalStates = new Set(['completed', 'failed', 'cancelled']);
const pausedStates = new Set(['pending', 'waiting', 'paused']);

/** Validate calendar fields before Date.parse can normalize invalid dates. */
export function parseInstant(value: string): number {
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/i.exec(
      value,
    );
  if (!parts) return NaN;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = parts;
  const y = Number(year),
    m = Number(month),
    d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > days[m - 1] ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    Number(offsetHour ?? 0) > 23 ||
    Number(offsetMinute ?? 0) > 59
  )
    return NaN;
  return Date.parse(value);
}

function parseDuration(value: string): number {
  const match =
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      value,
    );
  if (!match || !match.slice(1).some(Boolean) || value.endsWith('T')) return NaN;
  return (
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  );
}

export interface TimerValue {
  seconds: number;
  ticking: boolean;
  paused: boolean;
}
export function timerValue(
  format: string,
  datetime: string,
  endValue: string | undefined,
  elapsed: string | undefined,
  state: string | undefined,
  live: boolean,
  now: number,
): TimerValue {
  const terminal = terminalStates.has(state ?? ''),
    paused = pausedStates.has(state ?? '');
  const result = (seconds: number, ticking = false) => ({ seconds, ticking, paused });
  if (state && !states.has(state)) return result(NaN);
  if (format === 'duration') return result(parseDuration(datetime));
  const start = parseInstant(datetime);
  if (format === 'countdown')
    return live && !terminal && Number.isFinite(start)
      ? result(Math.max(0, (start - now) / 1000), start > now)
      : result(NaN);
  if (format === 'active') {
    const base =
      elapsed === undefined
        ? 0
        : /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(elapsed)
          ? Number(elapsed)
          : NaN;
    if (!Number.isFinite(base) || base < 0) return result(NaN);
    if (paused || terminal) return result(base);
    return live && Number.isFinite(start)
      ? result(start <= now ? base + (now - start) / 1000 : NaN, true)
      : result(NaN);
  }
  if (format === 'elapsed' && Number.isFinite(start)) {
    if (endValue !== undefined) {
      const end = parseInstant(endValue);
      return result(end >= start ? (end - start) / 1000 : NaN);
    }
    if (live && state !== 'pending' && !terminal)
      return result(start <= now ? (now - start) / 1000 : NaN, true);
  }
  return result(NaN);
}

function duration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return value >= 60 ? `${Math.floor(value / 60)}m ${value % 60}s` : `${value}s`;
}

const subscribers = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | undefined;
function subscribe(callback: () => void) {
  subscribers.add(callback);
  interval ??= setInterval(() => subscribers.forEach((tick) => tick()), 1000);
  return () => {
    subscribers.delete(callback);
    if (!subscribers.size) {
      clearInterval(interval);
      interval = undefined;
    }
  };
}

export function bindTimers(
  root: HTMLElement,
  options: RendererOptions,
  renderState: RenderState,
): () => void {
  const times = Array.from(root.querySelectorAll<HTMLTimeElement>('time[data-afm-format]'));
  const live = options.live !== false && !renderState.interrupted;
  const tick = () => {
    let ticking = false;
    const now = Date.now();
    for (const time of times) {
      const format = time.dataset.afmFormat!;
      const state = time.closest('[data-afm-state]')?.getAttribute('data-afm-state') ?? undefined;
      const value = timerValue(
        format,
        time.dateTime,
        time.dataset.afmEnd,
        time.dataset.afmElapsed,
        state,
        live,
        now,
      );
      ticking ||= value.ticking;
      time.setAttribute('role', 'timer');
      time.setAttribute('aria-live', 'off');
      if (!Number.isFinite(value.seconds)) {
        time.textContent = '';
        continue;
      }
      const seconds = Math.max(0, value.seconds);
      const phrase =
        format === 'active' && (value.paused || terminalStates.has(state ?? ''))
          ? ` · ${duration(seconds)} active`
          : format === 'countdown'
            ? ` ${duration(seconds)} remaining`
            : format === 'duration'
              ? ` · ${duration(seconds)}`
              : ` for ${duration(seconds)}`;
      time.textContent = options.formatTime?.(seconds, format, { state }) ?? phrase;
    }
    return ticking;
  };
  if (!tick()) return () => {};
  let unsubscribe = () => {};
  unsubscribe = subscribe(() => {
    if (!root.ownerDocument.hidden && !tick()) unsubscribe();
  });
  return unsubscribe;
}
