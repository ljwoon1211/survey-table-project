"use server";

export async function throwServerError() {
  throw new Error("Sentry Server-side Test Error");
}
