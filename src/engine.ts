// Goff's Quantum Tic-Tac-Toe on a 3×3×3 board. Pure logic, no DOM —
// deterministic given the injected bit source. Deviation from Goff: the two
// consistent cycle-collapses are chosen by a quantum bit, not by the non-mover.

const GRID = 3;

const idx = (x: number, y: number, z: number): Cell => x * 9 + y * 3 + z;

/** The 49 winning lines of the cube, as flat-index triples. */
function buildLines (): [Cell, Cell, Cell][] {
  const dirs: [number, number, number][] = [];

  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++)
        if (
          dx ||
          dy ||
          dz
        ) dirs.push([dx, dy, dz]);

  const seen = new Set<string>();
  const lines: [Cell, Cell, Cell][] = [];

  for (let x = 0; x < GRID; x++)
    for (let y = 0; y < GRID; y++)
      for (let z = 0; z < GRID; z++)
        for (const [dx, dy, dz] of dirs) {
          const x2 = x + 2 * dx;
          const y2 = y + 2 * dy;
          const z2 = z + 2 * dz;

          if (
            x2 < 0 ||
            x2 >= GRID ||
            y2 < 0 ||
            y2 >= GRID ||
            z2 < 0 ||
            z2 >= GRID
          ) continue;

          const a = idx(x, y, z);
          const b = idx(x + dx, y + dy, z + dz);
          const c = idx(x2, y2, z2);
          const key = [a, b, c].sort((p, q) => p - q).join(",");
          if (seen.has(key)) continue;
          seen.add(key);
          lines.push([a, b, c]);
        }

  return lines;
}

type Edge = { cell: Cell; markId: number };

export class QEngine {
  spooky: SpookyMark[] = [];
  classical = new Map<Cell, ClassicalMark>();
  moveId = 0;
  current: Player = "x";
  readonly lines = buildLines();
  private bit: () => number;

  constructor(bit: () => number) {
    this.bit = bit;
  }

  isClassical (c: Cell): boolean {
    return this.classical.has(c);
  }

  openCells (): number {
    let n = 0;

    for (let c = 0; c < 27; c++)
      if (!this.classical.has(c)) n++;

    return n;
  }

  canPlace (a: Cell, b: Cell): boolean {
    return (
      a !== b &&
      a >= 0 &&
      a < 27 &&
      b >= 0 &&
      b < 27 &&
      !this.classical.has(a) &&
      !this.classical.has(b)
    );
  }

  place (a: Cell, b: Cell): PlaceResult {
    if (!this.canPlace(a, b)) {
      return { ok: false };
    }

    this.moveId++;
    const mark: SpookyMark = {
      id: this.moveId,
      player: this.current,
      cells: [a, b],
    };
    this.spooky.push(mark);

    // closing a cycle ⇔ a and b were already linked by other marks
    const collapse = this.linked(a, b, mark.id) ? this.measure(mark) : undefined;

    this.current = this.current === "x" ? "o" : "x";

    return {
      ok: true,
      mark,
      collapse,
    };
  }

  private adjacency (exceptId = -1): Map<Cell, Edge[]> {
    const adj = new Map<Cell, Edge[]>();

    const push = (from: Cell, to: Cell, markId: number) => {
      const list = adj.get(from);

      if (list) {
        list.push({ cell: to, markId });
      } else {
        adj.set(from, [{ cell: to, markId }]);
      }
    };

    for (const m of this.spooky) {
      if (m.id === exceptId) continue;
      push(m.cells[0], m.cells[1], m.id);
      push(m.cells[1], m.cells[0], m.id);
    }

    return adj;
  }

  private linked (a: Cell, b: Cell, exceptId: number): boolean {
    const adj = this.adjacency(exceptId);
    const seen = new Set<Cell>([a]);
    const stack: Cell[] = [a];

    while (stack.length) {
      const c = stack.pop()!;
      if (c === b) return true;

      for (const e of adj.get(c) ?? [])
        if (!seen.has(e.cell)) { seen.add(e.cell); stack.push(e.cell); }
    }

    return false;
  }

  private component (trigger: SpookyMark): SpookyMark[] {
    const adj = this.adjacency();
    const byId = new Map<number, SpookyMark>();
    for (const m of this.spooky) byId.set(m.id, m);

    const seenCells = new Set<Cell>(trigger.cells);
    const seenMarks = new Set<number>();
    const out: SpookyMark[] = [];
    const stack: Cell[] = [...trigger.cells];

    while (stack.length) {
      const c = stack.pop()!;

      for (const e of adj.get(c) ?? []) {
        if (!seenMarks.has(e.markId)) {
          seenMarks.add(e.markId);
          out.push(byId.get(e.markId)!);
        }

        if (!seenCells.has(e.cell)) { seenCells.add(e.cell); stack.push(e.cell); }
      }
    }

    return out;
  }

  // We collapse on every cycle, so the triggered component is unicyclic:
  // exactly one cycle with trees hanging off it.
  private measure (trigger: SpookyMark): Collapse {
    const comp = this.component(trigger);
    const byId = new Map<number, SpookyMark>();
    for (const m of comp) byId.set(m.id, m);

    const incident = new Map<Cell, Set<number>>(); // cell -> incident mark ids (mutated while peeling)

    const touch = (c: Cell, id: number) => {
      const s = incident.get(c);

      if (s) {
        s.add(id);
      } else {
        incident.set(c, new Set([id]));
      }
    };

    for (const m of comp) { touch(m.cells[0], m.id); touch(m.cells[1], m.id); }

    const assign = new Map<number, Cell>(); // markId -> collapsed cell

    // Peel tree leaves: a cell with a single incident mark must take that mark.
    const drop = (id: number) => {
      const m = byId.get(id)!;
      incident.get(m.cells[0])!.delete(id);
      incident.get(m.cells[1])!.delete(id);
    };

    const queue: Cell[] = [];

    for (const [c, s] of incident)
      if (s.size === 1) queue.push(c);

    while (queue.length) {
      const c = queue.shift()!;
      const s = incident.get(c)!;
      if (s.size !== 1) continue; // degree changed since enqueued
      const id = [...s][0];
      assign.set(id, c);
      const m = byId.get(id)!;
      const other = m.cells[0] === c ? m.cells[1] : m.cells[0];
      drop(id);
      if (incident.get(other)!.size === 1) queue.push(other);
    }

    // What's left is the lone cycle; one quantum bit fixes its orientation.
    const remaining = [...byId.keys()].filter((id) => !assign.has(id));
    if (remaining.length) this.resolveCycle(remaining, byId, incident, assign);

    const marks: ClassicalMark[] = [];

    for (const m of comp) {
      const cell = assign.get(m.id)!;
      const cm: ClassicalMark = {
        id: m.id,
        player: m.player,
        cell,
      };
      this.classical.set(cell, cm);
      marks.push(cm);
    }

    const ids = new Set(comp.map((m) => m.id));
    this.spooky = this.spooky.filter((m) => !ids.has(m.id));

    return { trigger: trigger.id, marks };
  }

  private resolveCycle (
    remaining: number[],
    byId: Map<number, SpookyMark>,
    incident: Map<Cell, Set<number>>,
    assign: Map<number, Cell>,
  ) {
    const rem = new Set(remaining);
    const start = byId.get(remaining[0])!.cells[0];

    const nodes: Cell[] = [start];
    const edges: number[] = [];
    let cur = start;
    let prev = -1;

    for (; ;) {
      let chosen = -1;

      for (const id of incident.get(cur)!) {
        if (rem.has(id) && id !== prev) {
          chosen = id;
          break;
        }
      }

      const m = byId.get(chosen)!;
      edges.push(chosen);
      const next = m.cells[0] === cur ? m.cells[1] : m.cells[0];
      if (next === start) break;
      nodes.push(next);
      cur = next;
      prev = chosen;
    }

    // edges[i] joins nodes[i] and nodes[(i+1)%k]; the two parities each give
    // every node exactly one mark.
    const k = edges.length;
    const parity = this.bit() & 1;

    for (let i = 0; i < k; i++) {
      assign.set(edges[i], parity === 0 ? nodes[i] : nodes[(i + 1) % k]);
    }
  }

  checkWin (): WinResult | null {
    const wins: { player: Player; cells: [Cell, Cell, Cell]; maxId: number }[] = [];

    for (const [a, b, c] of this.lines) {
      const ma = this.classical.get(a);
      const mb = this.classical.get(b);
      const mc = this.classical.get(c);

      if (
        ma &&
        mb &&
        mc &&
        ma.player === mb.player &&
        mb.player === mc.player
      ) {
        wins.push({
          player: ma.player,
          cells: [a, b, c],
          maxId: Math.max(ma.id, mb.id, mc.id),
        });
      }
    }

    if (!wins.length) return null;

    // Goff tie-break: the line with the smaller largest-subscript wins.
    wins.sort((p, q) => p.maxId - q.maxId);
    const best = wins[0];
    const rival = wins.find((w) => w.player !== best.player);

    return {
      winner: best.player,
      line: best.cells,
      shared: rival?.player,
    };
  }

  isDraw (): boolean {
    return this.openCells() < 2 && this.checkWin() === null;
  }
}
