const RBITS = 1024;

let pregen: boolean[] = Array.from(
  { length: RBITS },
  () => Math.random() < 0.5
);

let idx = 0;

export default {
  select: (array: any[]) => {
    const idx = Math.floor(Math.random() * array.length);

    return array[idx];
  },
  binary: () => {
    const val = pregen[idx % RBITS];
    idx = (idx + 1) % RBITS;
    return val;
  },
  rand: () => {
    return Math.random();
  }
};