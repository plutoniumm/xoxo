import * as THREE from "three";
import Shapes, { PLAYER_COLOR } from "./geometry";
import CONF from "./conf";
import type { QEngine } from "./engine";

const { CELL_SIZE, GAP, GRID_SIZE, COLORS } = CONF;
const SPAN = CELL_SIZE + GAP;
const OFFSET = ((GRID_SIZE - 1) * SPAN) / 2;

export function vecOf (index: number): THREE.Vector3 {
  const x = Math.floor(index / 9);
  const y = Math.floor((index % 9) / 3);
  const z = index % 3;

  return new THREE.Vector3(x * SPAN - OFFSET, y * SPAN - OFFSET, z * SPAN - OFFSET);
}

// 27 persistent raycast cubes; everything else is rebuilt from engine state.
export class BoardView {
  cells: THREE.Mesh[] = [];
  spinners: THREE.Object3D[] = [];
  private group = new THREE.Group();
  private base: THREE.MeshBasicMaterial;
  private hover: THREE.MeshBasicMaterial;
  private pick: THREE.MeshBasicMaterial;
  private hovered: number | null = null;
  private pending: number | null = null;

  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(0x2d0a52);
    scene.add(this.group);

    const geo = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE);
    // depthWrite:false — these invisible cubes must not occlude the marks inside them.

    const cube = (color: number, opacity: number) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      });

    this.base = cube(COLORS.cream, 0);
    this.hover = cube(COLORS.softBlue, 0.18);
    this.pick = cube(COLORS.lime, 0.3);

    for (let i = 0; i < 27; i++) {
      const mesh = new THREE.Mesh(geo, this.base);
      mesh.position.copy(vecOf(i));
      mesh.userData.index = i;
      this.cells.push(mesh);
      scene.add(mesh);
    }
  }

  setHover (index: number | null) {
    this.hovered = index;
    this.paintCells();
  }

  setPending (index: number | null) {
    this.pending = index;
    this.paintCells();
  }

  private paintCells () {
    for (const m of this.cells) {
      const i = m.userData.index as number;
      m.material =
        i === this.pending
          ? this.pick
          : i === this.hovered
            ? this.hover
            : this.base;
    }
  }

  render (engine: QEngine) {
    this.clearGroup();
    this.spinners = [];

    const byId = new Map<number, SpookyMark>();
    const occupants = new Map<Cell, number[]>(); // cell -> spooky mark ids

    for (const m of engine.spooky) {
      byId.set(m.id, m);

      for (const c of m.cells) {
        const list = occupants.get(c);

        if (list) {
          list.push(m.id);
        } else {
          occupants.set(c, [m.id]);
        }
      }
    }

    const slot = new Map<string, THREE.Vector3>(); // rendered position per spooky half, keyed `${markId}:${cell}`

    for (let c = 0; c < 27; c++) {
      const center = vecOf(c);

      if (engine.isClassical(c)) {
        const cm = engine.classical.get(c)!;
        const shape = Shapes.mark(cm.player, CELL_SIZE, false);
        shape.position.copy(center);
        this.group.add(shape);
        this.spinners.push(shape);
        this.addLabel(String(cm.id), 0xffffff, center, CELL_SIZE * 0.52, 0.5);
        continue;
      }

      const ids = (occupants.get(c) ?? []).slice().sort((a, b) => a - b);

      if (ids.length === 0) {
        const blank = Shapes.blank(CELL_SIZE);
        blank.position.copy(center);
        this.group.add(blank);
        continue;
      }

      ids.forEach((id, k) => {
        const angle = ids.length === 1 ? 0 : (k / ids.length) * Math.PI * 2;
        const r = ids.length === 1 ? 0 : CELL_SIZE * 0.24;
        const pos = center.clone().add(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0));
        const mk = byId.get(id)!;
        const shape = Shapes.mark(mk.player, CELL_SIZE * 0.5, true);
        shape.position.copy(pos);
        this.group.add(shape);
        this.spinners.push(shape);
        slot.set(`${id}:${c}`, pos);
        this.addLabel(String(id), PLAYER_COLOR[mk.player], pos, CELL_SIZE * 0.3, 0.32);
      });
    }

    for (const m of engine.spooky) {
      const a = slot.get(`${m.id}:${m.cells[0]}`);
      const b = slot.get(`${m.id}:${m.cells[1]}`);
      if (a && b) this.group.add(Shapes.link(a, b, PLAYER_COLOR[m.player]));
    }

    this.paintCells();
  }

  private addLabel (text: string, color: number, at: THREE.Vector3, dy: number, scale: number) {
    const sprite = Shapes.label(text, color);
    sprite.scale.set(scale, scale, scale);
    sprite.position.copy(at).add(new THREE.Vector3(0, dy, 0));
    this.group.add(sprite);
  }

  private clearGroup () {
    for (const obj of this.group.children.slice()) {
      this.group.remove(obj);
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
      });
    }
  }

  spin (delta: number) {
    for (const o of this.spinners) o.rotation.y += delta * CONF.MOTION_SPEED;
  }
}
