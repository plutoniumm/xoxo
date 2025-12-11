export default {
  select: (array: any[]) => {
    const idx = Math.floor(Math.random() * array.length);

    return array[idx];
  },
  binary: () => {
    return Math.random() < 0.5;
  },
  rand: () => {
    return Math.random();
  }
};