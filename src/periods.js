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

function timeZoneOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const values = Object.fromEntries(
    formatter.formatToParts(date).filter(p => p.type !== "literal").map(p => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUTC - date.getTime();
}

function localDateTimeToUTC(date, time, timeZone) {
  const guess = new Date(`${date}T${time}Z`);
  let utc = new Date(guess.getTime() - timeZoneOffsetMs(guess, timeZone));

  // Recalculate once because the first guess can cross a DST boundary.
  utc = new Date(guess.getTime() - timeZoneOffsetMs(utc, timeZone));
  return utc;
}

function keycrmTimestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function periodDates(period, timeZone = "Europe/Kyiv") {
  const now = new Date();
  const today = parts(now, timeZone);
  const yesterday = parts(addDays(now, -1), timeZone);

  let range;

  if (period === "today") range = { from: today, to: today, label: "сьогодні" };
  else if (period === "yesterday") range = { from: yesterday, to: yesterday, label: "вчора" };
  else {
    const local = new Date(`${today}T12:00:00Z`);
    const weekday = local.getUTCDay() || 7;

    if (period === "this_week") {
      range = { from: parts(addDays(now, -(weekday - 1)), timeZone), to: today, label: "цей тиждень" };
    } else if (period === "last_week") {
      range = {
        from: parts(addDays(now, -(weekday + 6)), timeZone),
        to: parts(addDays(now, -weekday), timeZone),
        label: "минулий тиждень"
      };
    } else {
      const [year, month] = today.split("-").map(Number);
      if (period === "this_month") {
        range = { from: `${year}-${String(month).padStart(2, "0")}-01`, to: today, label: "цей місяць" };
      } else if (period === "last_month") {
        const first = new Date(Date.UTC(year, month - 2, 1));
        const last = new Date(Date.UTC(year, month - 1, 0));
        range = { from: parts(first, "UTC"), to: parts(last, "UTC"), label: "минулий місяць" };
      } else {
        throw new Error(`Unsupported period: ${period}`);
      }
    }
  }

  return {
    ...range,
    utcFrom: keycrmTimestamp(localDateTimeToUTC(range.from, "00:00:00", timeZone)),
    utcTo: keycrmTimestamp(localDateTimeToUTC(range.to, "23:59:59", timeZone))
  };
}
