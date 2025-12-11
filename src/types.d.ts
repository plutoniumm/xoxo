type N<T> = T | null;

type Player = "x" | "o";
type CellState = "empty" | "x" | "o" | "both";

interface WinResult {
  start: number[];
  end: number[];
  winner: Player
};