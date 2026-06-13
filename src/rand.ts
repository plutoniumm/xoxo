import data from "./qrng.json";

// Quantum random bytes pre-generated from the ANU QRNG and bundled at build
// time; one bit is drawn per collapse. Refill with `pnpm qrng`.
const bytes: number[] = (data as { bytes?: number[] }).bytes ?? [];

let cursor = 0;
let warned = false;

function classicalBit (): number {
  if (!warned) {
    console.warn(
      "[qrng] quantum buffer exhausted — falling back to Math.random(). " +
      "Run `pnpm qrng` to refill src/qrng.json."
    );
    warned = true;
  }

  return Math.random() < 0.5 ? 1 : 0;
}

export default {
  source: (data as { source?: string }).source ?? "Math.random (fallback)",

  remaining: () => Math.max(0, bytes.length * 8 - cursor),

  bit (): number {
    if (bytes.length === 0 || cursor >= bytes.length * 8) return classicalBit();
    const bit = (bytes[cursor >> 3] >> (cursor & 7)) & 1;
    cursor++;

    return bit;
  },
};
