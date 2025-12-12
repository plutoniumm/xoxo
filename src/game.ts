import * as THREE from "three";
import Shapes from "./geometry";
import CONFIG from "./conf";
import R from "./rand";

export class Cell {
  mesh: THREE.Mesh;
  scene: THREE.Scene;
  x: number;
  y: number;
  z: number;
  state: CellState | null = null;
  marker: THREE.Object3D | null = null;
  blank: THREE.Object3D | null = null;
  private base: THREE.MeshBasicMaterial;
  private active: THREE.MeshBasicMaterial;

  constructor(
    scene: THREE.Scene,
    geo: THREE.BoxGeometry,
    mat: THREE.MeshBasicMaterial,
    hov: THREE.MeshBasicMaterial,
    x: number,
    y: number,
    z: number,
    offset: number
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.z = z;
    this.base = mat;
    this.active = hov;

    this.mesh = new THREE.Mesh(geo, mat.clone());
    this.mesh.position.set(
      x * (CONFIG.CELL_SIZE + CONFIG.GAP) - offset,
      y * (CONFIG.CELL_SIZE + CONFIG.GAP) - offset,
      z * (CONFIG.CELL_SIZE + CONFIG.GAP) - offset
    );

    this.mesh.userData = {
      gx: x,
      gy: y,
      gz: z,
      state: "empty",
      marker: null,
      blank: null
    };

    this.addBlank();
    this.scene.add(this.mesh);
  }

  hover (flag: boolean) {
    this.mesh.material = flag ? this.active : this.base;
  }

  set (state: CellState, obj: THREE.Object3D) {
    this.removeMarker();
    this.removeBlank();

    this.state = state;
    this.mesh.userData.state = state;

    this.marker = obj;
    this.mesh.userData.marker = obj;

    obj.position.copy(this.mesh.position);
    obj.userData.parentCell = this.mesh;

    this.scene.add(obj);
    this.grow(obj);
  }

  reset () {
    this.removeMarker();
    this.state = null;
    this.mesh.userData.state = "empty";
    this.addBlank();
  }

  private addBlank () {
    if (this.blank) return;
    const b = Shapes.blank(CONFIG.CELL_SIZE);
    b.position.copy(this.mesh.position);
    this.scene.add(b);
    this.blank = b;
    this.mesh.userData.blank = b;
  }

  private removeBlank () {
    if (this.blank) {
      this.scene.remove(this.blank);
      this.blank = null;
      this.mesh.userData.blank = null;
    }
  }

  private removeMarker () {
    if (this.marker) {
      this.scene.remove(this.marker);
      this.marker = null;
      this.mesh.userData.marker = null;
    }
  }

  private grow (obj: THREE.Object3D) {
    obj.scale.set(0, 0, 0);
    let s = 0;
    const run = () => {
      if (s < 1) {
        s += 0.1;
        obj.scale.set(s, s, s);
        requestAnimationFrame(run);
      }
    };
    run();
  }
}

export class Board {
  scene: THREE.Scene;
  cells: THREE.Mesh[] = [];
  grid: Cell[][][];
  markers: THREE.Object3D[] = [];
  private offset: number;
  private geometry: THREE.BoxGeometry;
  private material: THREE.MeshBasicMaterial;
  private hoverMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.background = new THREE.Color(0x2D0A52);

    this.offset = ((CONFIG.GRID_SIZE - 1) * (CONFIG.CELL_SIZE + CONFIG.GAP)) / 2;

    this.geometry = new THREE.BoxGeometry(
      CONFIG.CELL_SIZE,
      CONFIG.CELL_SIZE,
      CONFIG.CELL_SIZE
    );

    this.material = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.cream,
      transparent: true,
      opacity: CONFIG.OPACITY.CELL,
    });

    this.hoverMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.salmon,
      transparent: true,
      opacity: CONFIG.OPACITY.HOVER,
    });

    this.grid = [];
    for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
      this.grid[x] = [];
      for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        this.grid[x][y] = [];
        for (let z = 0; z < CONFIG.GRID_SIZE; z++) {
          const c = new Cell(
            this.scene,
            this.geometry,
            this.material,
            this.hoverMat,
            x, y, z,
            this.offset
          );
          this.grid[x][y][z] = c;
          this.cells.push(c.mesh);
        }
      }
    }
  }

  Cell (x: number, y: number, z: number): CellState | null {
    return this.grid[x][y][z].state;
  }

  updateCells (
    mesh: THREE.Mesh,
    state: CellState | null,
    obj: THREE.Object3D | null
  ) {
    const { gx, gy, gz } = mesh.userData;
    const cell = this.grid[gx][gy][gz];

    if (state && obj) {
      cell.set(state, obj);
      this.markers.push(obj);
    } else {
      const old = cell.marker;
      cell.reset();
      if (old) this.unmark(old);
    }
  }

  unmark (obj: THREE.Object3D) {
    const i = this.markers.indexOf(obj);
    if (i >= 0) this.markers.splice(i, 1);
  }

  highlight (mesh: THREE.Mesh | null) {
    this.cells.forEach(m => {
      const { gx, gy, gz } = m.userData;
      this.grid[gx][gy][gz].hover(false);
    });

    if (mesh) {
      const { gx, gy, gz } = mesh.userData;
      this.grid[gx][gy][gz].hover(true);
    }
  }
}

export class Rulz {
  board: Board;
  scene: THREE.Scene;

  constructor(board: Board, scene: THREE.Scene) {
    this.board = board;
    this.scene = scene;
  }

  valid (mesh: THREE.Mesh, player: Player): boolean {
    const s = mesh.userData.state as CellState;
    if (s === "both") return false;
    if (s === "empty") return true;
    return (s === "x" && player === "o") || (s === "o" && player === "x");
  }

  private collect (markers: THREE.Object3D[]) {
    const xs: number[] = [];
    const os: number[] = [];
    const bs: number[] = [];

    for (let i = 0; i < markers.length; i++) {
      const d = markers[i].userData;
      if (
        !d.collapsed
        && ["_x", "_o", "_both"].includes(d.name)
      ) {
        if (d.name === "_x") xs.push(i);
        else if (d.name === "_o") os.push(i);
        else bs.push(i);
      }
    }
    return { xs, os, bs, hasBoth: bs.length > 0 };
  }

  private collapse (
    markers: THREE.Object3D[],
    pend: number[],
    kill: Set<number>,
    swap?: Map<number, "x" | "o">
  ) {
    for (const i of pend) {
      const m = markers[i];
      const mesh = m.userData.parentCell as THREE.Mesh;
      if (!mesh) continue;

      const { gx, gy, gz } = mesh.userData;
      const cell = this.board.grid[gx][gy][gz];

      if (kill.has(i)) {
        m.userData.collapsed = true;
        cell.reset();
      } else {
        let type: "x" | "o";
        if (swap && swap.has(i)) {
          type = swap.get(i)!;
        } else {
          type = m.userData.name === "_x" ? "x" : "o";
        }

        const Shape = type === "x" ? Shapes.cross : Shapes.sphere;
        const full = Shape(CONFIG.CELL_SIZE);

        full.rotation.copy(m.rotation);
        full.userData = {
          name: type === "x" ? "_x" : "_o",
          collapsed: true,
          parentCell: mesh
        };

        m.userData.isReplaced = true;
        m.userData.replacement = full;

        cell.set(type, full);
      }
    }
  }

  private clean (markers: THREE.Object3D[], kill: Set<number>) {
    const next: THREE.Object3D[] = [];
    for (let i = 0; i < markers.length; i++) {
      if (kill.has(i)) continue;

      const m = markers[i];
      if (m.userData.isReplaced) next.push(m.userData.replacement);
      else next.push(m);
    }

    this.board.markers = next;
  }

  performCollapse () {
    const list = this.board.markers;
    const { xs, os, bs, hasBoth } = this.collect(list);

    if (!xs.length || !os.length) return;

    let rx = R.select(xs);
    let ro = R.select(os);
    let rb = R.select(bs);

    const allCandidates = [...xs, ...os, ...bs];

    const kill = new Set<number>(allCandidates);
    const swap = new Map<number, "x" | "o">();

    const rescue = (idx: number) => kill.delete(idx);

    if (!hasBoth) {
      // Simple Case: Keep the selected X and O.
      // Everyone else remains in 'kill' and will be wiped.
      rescue(rx);
      rescue(ro);
    } else {
      const roll = R.rand();

      if (roll < 0.25) {
        // Case 1: Independent Collapse
        // The "Both" marker is destroyed. We keep the distinct X and O.
        rescue(rx);
        rescue(ro);
      } else if (roll < 0.5) {
        // Case 2: "Both" collapses into O
        // We keep the distinct X. We swap "Both" to O. The distinct O dies.
        rescue(rx);
        rescue(rb);
        swap.set(rb, "o");
      } else {
        // Case 3: "Both" collapses into X
        // We keep the distinct O. We swap "Both" to X. The distinct X dies.
        rescue(ro);
        rescue(rb);
        swap.set(rb, "x");
      }
    }

    this.collapse(list, allCandidates, kill, swap);
    this.clean(list, kill);
  }

  checkWin (): WinResult | null {
    const grid = this.board.grid;
    const lines: number[][][] = [];

    const check = (c: Cell, p: Player) => {
      const stateMatch = (p === "x")
        ? (c.state === "x")
        : (c.state === "o");

      const isCollapsed = c.marker?.userData?.collapsed;

      return stateMatch && isCollapsed;
    };

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        lines.push([[0, i, j], [1, i, j], [2, i, j]]);
        lines.push([[i, 0, j], [i, 1, j], [i, 2, j]]);
        lines.push([[i, j, 0], [i, j, 1], [i, j, 2]]);
      }
    }

    for (let i = 0; i < 3; i++) {
      lines.push([[i, 0, 0], [i, 1, 1], [i, 2, 2]]);
      lines.push([[i, 0, 2], [i, 1, 1], [i, 2, 0]]);
      lines.push([[0, i, 0], [1, i, 1], [2, i, 2]]);
      lines.push([[2, i, 0], [1, i, 1], [0, i, 2]]);
      lines.push([[0, 0, i], [1, 1, i], [2, 2, i]]);
      lines.push([[2, 0, i], [1, 1, i], [0, 2, i]]);
    }

    lines.push([[0, 0, 0], [1, 1, 1], [2, 2, 2]]);
    lines.push([[2, 0, 0], [1, 1, 1], [0, 2, 2]]);
    lines.push([[0, 2, 0], [1, 1, 1], [2, 0, 2]]);
    lines.push([[0, 0, 2], [1, 1, 1], [2, 2, 0]]);

    for (const line of lines) {
      const [a, b, c] = line;
      const cA = grid[a[0]][a[1]][a[2]];
      const cB = grid[b[0]][b[1]][b[2]];
      const cC = grid[c[0]][c[1]][c[2]];

      if (check(cA, "x") && check(cB, "x") && check(cC, "x")) {
        return { start: a, end: c, winner: "x" };
      }
      if (check(cA, "o") && check(cB, "o") && check(cC, "o")) {
        return { start: a, end: c, winner: "o" };
      }
    }
    return null;
  }
}