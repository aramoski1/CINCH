const IANA = /^[A-Za-z_]+(?:\/[A-Za-z0-9_\-+]+)+$/;

export function isIanaTimezone(value: string): boolean {
  if (!IANA.test(value) && value !== "UTC") return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function serverNow(): Date {
  return new Date();
}

export function isDstTransitionWindow(at: Date, timeZone: string): boolean {
  const before = new Date(at.getTime() - 60 * 60 * 1000);
  const after = new Date(at.getTime() + 60 * 60 * 1000);
  const offset = (d: Date) => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    return fmt.format(d);
  };
  return offset(before) !== offset(after);
}
