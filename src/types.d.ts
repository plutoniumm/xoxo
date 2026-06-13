type N<T> = T | null;

type Player = "x" | "o";

// flat cell index: x*9 + y*3 + z, range 0..26
type Cell = number;

// id is the move number, which doubles as the subscript
interface SpookyMark {
  id: number;
  player: Player;
  cells: [Cell, Cell];
}

interface ClassicalMark {
  id: number;
  player: Player;
  cell: Cell;
}

interface Collapse {
  trigger: number;          // move id that closed the cycle
  marks: ClassicalMark[];
}

interface PlaceResult {
  ok: boolean;
  mark?: SpookyMark;
  collapse?: Collapse;
}

interface WinResult {
  winner: Player;
  line: [Cell, Cell, Cell];
  shared?: Player; // opponent also completed a line in the same measurement
}
