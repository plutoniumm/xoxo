import * as THREE from "three";
import Shapes from "./geometry";
import CONFIG from "./conf";

export class Board {
  private scene: THREE.Scene;
  cells: THREE.Mesh[] = [];
  grid: (CellState | null)[][][];
  markers: THREE.Object3D[] = [];
  private offset: number;
  private cellGeometry: THREE.BoxGeometry;
  private cellMaterial: THREE.MeshBasicMaterial;
  private hoverMaterial: THREE.MeshBasicMaterial;
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.background = new THREE.Color(0x2D0A52);
    this.offset =
      ((CONFIG.GRID_SIZE - 1) * (CONFIG.CELL_SIZE + CONFIG.GAP)) / 2;
    this.grid = Array(CONFIG.GRID_SIZE)
      .fill(null)
      .map(() =>
        Array(CONFIG.GRID_SIZE)
          .fill(null)
          .map(() => Array(CONFIG.GRID_SIZE).fill(null))
      );

    this.cellGeometry = new THREE.BoxGeometry(
      CONFIG.CELL_SIZE,
      CONFIG.CELL_SIZE,
      CONFIG.CELL_SIZE
    );
    this.cellMaterial = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.cream,
      transparent: true,
      opacity: CONFIG.OPACITY.CELL,
    });
    this.hoverMaterial = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.salmon,
      transparent: true,
      opacity: CONFIG.OPACITY.HOVER,
    });

    // INIT GRID
    for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
      for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        for (let z = 0; z < CONFIG.GRID_SIZE; z++) {
          this.createCell(x, y, z);
        }
      }
    }
  }

  private createCell (x: number, y: number, z: number) {
    const cell = new THREE.Mesh(this.cellGeometry, this.cellMaterial.clone());
    cell.position.set(
      x * (CONFIG.CELL_SIZE + CONFIG.GAP) - this.offset,
      y * (CONFIG.CELL_SIZE + CONFIG.GAP) - this.offset,
      z * (CONFIG.CELL_SIZE + CONFIG.GAP) - this.offset
    );

    const blankMarker = Shapes.blank(CONFIG.CELL_SIZE);
    blankMarker.position.copy(cell.position);
    this.scene.add(blankMarker);

    cell.userData = {
      gx: x,
      gy: y,
      gz: z,
      state: "empty",
      marker: null,
      blank: blankMarker,
    };
    this.scene.add(cell);
    this.cells.push(cell);
  }

  Cell (x: number, y: number, z: number): CellState | null {
    return this.grid[x][y][z];
  }

  updateCells (
    cell: THREE.Mesh,
    newState: CellState | null,
    markerMesh: THREE.Object3D | null
  ) {
    const { gx, gy, gz } = cell.userData;
    this.grid[gx][gy][gz] = newState;
    cell.userData.state = newState || "empty";

    if (cell.userData.blank) {
      this.scene.remove(cell.userData.blank);
      this.unmark(cell.userData.blank);
      cell.userData.blank = null;
    }

    if (cell.userData.marker) {
      this.scene.remove(cell.userData.marker);
      this.unmark(cell.userData.marker);
      cell.userData.marker = null;
    }

    if (markerMesh) {
      markerMesh.position.copy(cell.position);
      markerMesh.userData.parentCell = cell;
      this.scene.add(markerMesh);
      this.markers.push(markerMesh);
      cell.userData.marker = markerMesh;

      markerMesh.scale.set(0, 0, 0);
      let scale = 0;
      const animate = () => {
        if (scale < 1) {
          scale += 0.1;
          markerMesh.scale.set(scale, scale, scale);
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }

  private unmark (obj: THREE.Object3D) {
    const idx = this.markers.indexOf(obj);
    if (idx >= 0) this.markers.splice(idx, 1);
  }

  highlight (cell: THREE.Mesh | null) {
    this.cells.forEach((c) => (c.material = this.cellMaterial));
    if (cell)
      cell.material = this.hoverMaterial;
  }
}


export class Rulz {
  board: Board;
  scene: THREE.Scene;
  constructor(board: Board, scene: THREE.Scene) {
    this.board = board;
    this.scene = scene;
  }

  valid (cell: THREE.Mesh, player: Player): boolean {
    const s = cell.userData.state as CellState;
    if (s === "both")
      return false;
    if (s === "empty")
      return true;

    return (
      (s === "x" && player === "o")
      || (s === "o" && player === "x")
    );
  }

  private accumulate (markers: THREE.Object3D[]) {
    const toCollapse: number[] = [];
    const xIdx: number[] = [];
    const oIdx: number[] = [];
    const bothIdx: number[] = [];

    for (let i = 0; i < markers.length; i++) {
      const data = markers[i].userData;
      if (!data.collapsed && ["_x", "_o", "_both"].includes(data.name)) {
        toCollapse.push(i);
        if (data.name === "_x") xIdx.push(i);
        else if (data.name === "_o") oIdx.push(i);
        else bothIdx.push(i);
      }
    }

    return {
      toCollapse,
      xIdx, oIdx, bothIdx,
      hasBoth: bothIdx.length > 0
    };
  }

  private processCollapse (
    markers: THREE.Object3D[],
    toCollapse: number[],
    toDel: Set<number>
  ) {
    for (const i of toCollapse) {
      const marker = markers[i];
      const cell = marker.userData.parentCell as THREE.Mesh;

      if (!cell) continue;
      if (toDel.has(i)) {
        this.scene.remove(marker);
        marker.userData.collapsed = true;

        let D = cell.userData;
        this.board.grid[D.gx][D.gy][D.gz] = null;

        cell.userData.state = "empty";
        cell.userData.marker = null;

        if (!cell.userData.blank) {
          const blank = Shapes.blank(CONFIG.CELL_SIZE);
          blank.position.copy(cell.position);
          this.scene.add(blank);
          this.board.markers.push(blank);
          cell.userData.blank = blank;
        }
      } else {
        const isX = marker.userData.name === "_x";
        const FullShape = isX ? Shapes.cross : Shapes.sphere;

        const full = FullShape(CONFIG.CELL_SIZE);
        full.position.copy(marker.position);
        full.rotation.copy(marker.rotation);
        full.userData = {
          name: isX ? "_x" : "_o",
          collapsed: true,
          parentCell: cell
        };
        this.scene.add(full);
        this.scene.remove(marker);

        marker.userData.isReplaced = true;
        marker.userData.replacement = full;
        cell.userData.marker = full;
        cell.userData.state = isX ? "x" : "o";

        let D = cell.userData;
        this.board.grid[D.gx][D.gy][D.gz] = isX ? "x" : "o";
      }
    }
  }
  private reMark (markers: THREE.Object3D[], toDel: Set<number>) {
    const newMarkers: THREE.Object3D[] = [];

    for (let i = 0; i < markers.length; i++) {
      if (toDel.has(i)) continue;
      const m = markers[i];
      if (m.userData.isReplaced)
        newMarkers.push(m.userData.replacement);
      else
        newMarkers.push(m);
    }

    this.board.markers = newMarkers;
  }

  performCollapse () {
    const markers = this.board.markers;
    const { toCollapse, xIdx, oIdx, bothIdx, hasBoth } = this.accumulate(markers);

    if (!hasBoth) {
      if (xIdx.length === 0 || oIdx.length === 0)
        return;

      const randX = xIdx[Math.floor(Math.random() * xIdx.length)];
      const randO = oIdx[Math.floor(Math.random() * oIdx.length)];

      const toDel = new Set<number>([randX, randO]);
      this.processCollapse(markers, toCollapse, toDel);
      this.reMark(markers, toDel);

      return;
    }

    const randBoth = bothIdx[Math.floor(Math.random() * bothIdx.length)];
    const isXInBoth = Math.random() < 0.5;
    let selectedXIdx: number | null = null;
    let selectedOIdx: number | null = null;

    if (isXInBoth) {
      selectedXIdx = randBoth;
      const otherBothIdx = bothIdx.find((i) => i !== randBoth)!;
      selectedOIdx = otherBothIdx;
    } else {
      selectedXIdx = xIdx[Math.floor(Math.random() * xIdx.length)];
      selectedOIdx = oIdx[Math.floor(Math.random() * oIdx.length)];
    }

    const toDel = new Set<number>([selectedXIdx!, selectedOIdx!]);
    this.processCollapse(markers, toCollapse, toDel);
    this.reMark(markers, toDel);
  }

  checkWin (): WinResult | null {
    const grid = this.board.grid;
    const lines: number[][][] = [];

    const satisfies = (val: CellState | null, player: Player) => {
      if (player === "x")
        return val === "x" || val === "both";

      return val === "o" || val === "both";
    };

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        lines.push([
          [0, i, j], [1, i, j], [2, i, j]
        ]);
        lines.push([
          [i, 0, j], [i, 1, j], [i, 2, j]
        ]);
        lines.push([
          [i, j, 0], [i, j, 1], [i, j, 2]
        ]);
      }
    }

    for (let i = 0; i < 3; i++) {
      lines.push([
        [i, 0, 0], [i, 1, 1], [i, 2, 2]
      ]);
      lines.push([
        [i, 0, 2], [i, 1, 1], [i, 2, 0]
      ]);
      lines.push([
        [0, i, 0], [1, i, 1], [2, i, 2]
      ]);
      lines.push([
        [2, i, 0], [1, i, 1], [0, i, 2]
      ]);
      lines.push([
        [0, 0, i], [1, 1, i], [2, 2, i]
      ]);
      lines.push([
        [2, 0, i], [1, 1, i], [0, 2, i]
      ]);
    }

    lines.push([
      [0, 0, 0], [1, 1, 1], [2, 2, 2]
    ]);
    lines.push([
      [2, 0, 0], [1, 1, 1], [0, 2, 2]
    ]);
    lines.push([
      [0, 2, 0], [1, 1, 1], [2, 0, 2]
    ]);
    lines.push([
      [0, 0, 2], [1, 1, 1], [2, 2, 0]
    ]);

    for (const line of lines) {
      const [a, b, c] = line;
      const vA = grid[a[0]][a[1]][a[2]];
      const vB = grid[b[0]][b[1]][b[2]];
      const vC = grid[c[0]][c[1]][c[2]];

      if (satisfies(vA, "x") && satisfies(vB, "x") && satisfies(vC, "x"))
        return {
          start: a,
          end: c,
          winner: "x"
        };

      if (satisfies(vA, "o") && satisfies(vB, "o") && satisfies(vC, "o"))
        return {
          start: a,
          end: c,
          winner: "o"
        };
    }

    return null;
  }
}