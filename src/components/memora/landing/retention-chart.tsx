import { createStoredSchedule, formatInterval, getRetrievability, scheduleReview } from "@/lib/memora/scheduler";
import type { StoredSchedule } from "@/lib/memora/types";

/**
 * Server-only chart: the real FSRS-6 scheduler (the one practice uses) run on
 * a word recalled correctly every time. Rendered at build time — no client JS.
 */
const DAY = 86_400_000;
const start = new Date("2026-01-05T09:00:00Z");
const horizonDays = 200;

type Segment = { from: number; schedule: StoredSchedule };

function simulate() {
  const segments: Segment[] = [];
  let schedule = createStoredSchedule(start);
  let now = start;
  while ((now.getTime() - start.getTime()) / DAY < horizonDays) {
    schedule = scheduleReview("landing-sample", schedule, "good", now).schedule;
    segments.push({ from: (now.getTime() - start.getTime()) / DAY, schedule });
    now = new Date(schedule.due);
  }
  return segments;
}

/** Days between reviews of the sample word after the first day: grows each time. */
export function reviewGaps(count = 5) {
  let schedule = createStoredSchedule(start);
  let now = start;
  const gaps: number[] = [];
  while (gaps.length < count) {
    schedule = scheduleReview("landing-sample", schedule, "good", now).schedule;
    if (schedule.state === "Review") gaps.push(schedule.scheduled_days);
    now = new Date(schedule.due);
  }
  return gaps;
}

const W = 400;
const H = 210;
const pad = { left: 34, right: 10, top: 12, bottom: 34 };
const minR = 0.4;
const x = (days: number) => pad.left + Math.sqrt(Math.min(days, horizonDays) / horizonDays) * (W - pad.left - pad.right);
const y = (r: number) => pad.top + ((1 - r) / (1 - minR)) * (H - pad.top - pad.bottom);

function curve(schedule: StoredSchedule, fromDays: number, toDays: number) {
  const points: string[] = [];
  const steps = 28;
  for (let i = 0; i <= steps; i += 1) {
    const days = fromDays + ((toDays - fromDays) * i) / steps;
    const r = getRetrievability(schedule, new Date(start.getTime() + days * DAY));
    points.push(`${x(days).toFixed(1)},${y(r).toFixed(1)}`);
  }
  return points.join(" ");
}

export function RetentionChart() {
  const segments = simulate();
  const reviews = segments.map((segment) => segment.from);
  // Reviews after the same-day learning step, labelled by the gap from day one.
  const labelled = segments.filter((segment, index) => index === 0 || segment.from >= 1);
  const withReviews = segments.map((segment, index) =>
    curve(segment.schedule, segment.from, segments[index + 1]?.from ?? horizonDays),
  );
  // Without reviews: the memory after the first day only.
  const firstDay = segments[1] ?? segments[0];
  const noReviews = curve(firstDay.schedule, firstDay.from, horizonDays);

  return (
    <figure className="m-0">
      <svg
        aria-labelledby="retention-title retention-desc"
        className="h-auto w-full"
        role="img"
        viewBox={`0 0 ${W} ${H}`}
      >
        <title id="retention-title">Як повтори тримають слово в пам’яті</title>
        <desc id="retention-desc">
          {`Без повторів імовірність згадати слово падає приблизно до ${Math.round(
            getRetrievability(firstDay.schedule, new Date(start.getTime() + horizonDays * DAY)) * 100,
          )} % за пів року. З повторами FSRS вона не опускається нижче 90 %, а паузи між повторами ростуть: ${reviewGaps()
            .map((days) => formatInterval(start, new Date(start.getTime() + days * DAY)))
            .join(", ")}.`}
        </desc>

        {[1, 0.9, 0.7, 0.5].map((r) => (
          <g key={r}>
            <line
              stroke={r === 0.9 ? "var(--accent)" : "var(--line)"}
              strokeDasharray={r === 0.9 ? "3 4" : undefined}
              strokeOpacity={r === 0.9 ? 0.5 : 1}
              x1={pad.left}
              x2={W - pad.right}
              y1={y(r)}
              y2={y(r)}
            />
            <text fill="var(--faint)" fontSize="10" textAnchor="end" x={pad.left - 6} y={y(r) + 3.5}>
              {Math.round(r * 100)}%
            </text>
          </g>
        ))}

        <polyline fill="none" points={noReviews} stroke="var(--danger)" strokeDasharray="4 4" strokeOpacity="0.8" strokeWidth="1.8" />
        {withReviews.map((points, index) => (
          <polyline key={index} fill="none" points={points} stroke="var(--accent)" strokeLinejoin="round" strokeWidth="2.4" />
        ))}
        {reviews.map((days, index) => (
          <line key={index} stroke="var(--accent)" strokeOpacity="0.35" x1={x(days)} x2={x(days)} y1={y(0.9)} y2={y(1)} />
        ))}
        {labelled.map((segment, index) => (
          <g key={segment.from}>
            <circle cx={x(segment.from)} cy={y(1)} fill="var(--ink)" r="3.6" stroke="var(--accent-strong)" strokeWidth="2" />
            <text
              fill="var(--text-2)"
              fontSize="10.5"
              textAnchor={index === 0 ? "start" : "middle"}
              x={x(segment.from) - (index === 0 ? 3 : 0)}
              y={H - pad.bottom + 15}
            >
              {index === 0 ? "старт" : formatInterval(start, new Date(start.getTime() + segment.from * DAY))}
            </text>
          </g>
        ))}
        <text fill="var(--faint)" fontSize="10" textAnchor="end" x={W - pad.right} y={H - 4}>
          час від першого знайомства зі словом →
        </text>
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded bg-accent" />
          шанс згадати з повторами
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0 w-4 border-t-2 border-dashed border-danger/80" />
          без повторів
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full border-2 border-accent-strong" />
          повтор
        </span>
      </figcaption>
    </figure>
  );
}
