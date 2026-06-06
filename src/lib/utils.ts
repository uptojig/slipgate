import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { randomBytes, createHash } from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function newId(prefix = ""): string {
  const bytes = randomBytes(16).toString("hex");
  return prefix ? `${prefix}_${bytes}` : bytes;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function formatBaht(satang: number): string {
  return (satang / 100).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
  });
}

export function bahtToSatang(baht: number): number {
  return Math.round(baht * 100);
}
