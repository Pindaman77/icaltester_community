export type IsoDate = string; // YYYY-MM-DD

export type IcsEvent = {
  uid: string;
  start: IsoDate; // exclusive end model expected by app
  end: IsoDate; // exclusive
  summary: string;
  status: "CONFIRMED" | "CANCELLED";
};

export type ApiError = { error: string };

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
