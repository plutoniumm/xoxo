type N<T> = T | null;

type Single = 'x' | 'o';
type Entangled = 'x' | 'o' | 'both';

type Player = "x" | "o";
type CellState = "empty" | "x" | "o" | "both";
type WinResult = {
  start: number[]; end: number[]; winner: Player
};