function parts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const values = Object.fromEntries(
    formatter.formatToParts(date).filter(p => p.type !== "literal").map(p => [p.type, p.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

export function periodDates(period, timeZone = "Europe/Kyiv") {
  const now = new Date();
  const today = parts(now, timeZone);
  const yesterday = parts(addDays(now, -1), timeZone);

  if (period === "today") return { from: today, to: today, label: "сьогодні" };
  if (period === "yesterday") return { from: yesterday, to: yesterday, label: "вчора" };

  // Calendar ranges are derived from local calendar dates. This is sufficient for KeyCRM date filters;
  // UTC conversion can be centralized here later if a client's API settings require timestamp boundaries.
  const local = new Date(`${today}T12:00:00Z`);
  const weekday = local.getUTCDay() || 7;

  if (period === "this_week") {
    return { from: parts(addDays(now, -(weekday - 1)), timeZone), to: today, label: "цей тиждень" };
  }
  if (period === "last_week") {
    return {
      from: parts(addDays(now, -(weekday + 6)), timeZone),
      to: parts(addDays(now, -weekday), timeZone),
      label: "минулий тиждень"
    };
  }

  const [year, month] = today.split("-").map(Number);
  if (period === "this_month") {
    return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: today, label: "цей місяць" };
  }
  if (period === "last_month") {
    const first = new Date(Date.UTC(year, month - 2, 1));
    const last = new Date(Date.UTC(year, month - 1, 0));
    return { from: parts(first, "UTC"), to: parts(last, "UTC"), label: "минулий місяць" };
  }

  throw new Error(`Unsupported period: ${period}`);
}
