import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import CONF from "./conf";
import { QEngine } from "./engine";
import { BoardView, vecOf } from "./board";
import R from "./rand";

const turnEl = document.getElementById("turn")!;
const statusEl = document.getElementById("status")!;
const meterEl = document.getElementById("meter")!;

class SceneManager {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  controls: OrbitControls;
  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();

  constructor() {
    const { innerWidth: w, innerHeight: h } = window;
    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100);
    this.camera.position.set(8, 8, 10);

    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(10, 20, 10);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6), dir);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 30;

    window.addEventListener("resize", () => this.onResize());
  }

  private onResize () {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

class Game {
  director = new SceneManager();
  board: BoardView;
  engine = new QEngine(() => R.bit());
  active = true;
  pending: number | null = null;
  private mouse = new THREE.Vector2();
  private downAt = new THREE.Vector2();

  constructor() {
    this.board = new BoardView(this.director.scene);
    this.board.render(this.engine);

    const el = this.director.renderer.domElement;
    el.addEventListener("pointerdown", (e) => this.downAt.set(e.clientX, e.clientY));
    el.addEventListener("pointermove", (e) => this.onMove(e));
    el.addEventListener("click", (e) => this.onClick(e));

    this.updateUI();
    this.animate();
  }

  private pick (event: PointerEvent | MouseEvent): number | null {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.director.raycaster.setFromCamera(this.mouse, this.director.camera);
    const hits = this.director.raycaster.intersectObjects(this.board.cells);

    return hits.length ? (hits[0].object.userData.index as number) : null;
  }

  private onMove (event: PointerEvent) {
    if (!this.active) return;
    const i = this.pick(event);
    const ok = i !== null
      && !this.engine.isClassical(i)
      && i !== this.pending;
    this.board.setHover(ok ? i : null);
  }

  private onClick (event: MouseEvent) {
    if (!this.active) return;
    if (this.downAt.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 6) return; // ignore orbit-drags

    const i = this.pick(event);
    if (i === null || this.engine.isClassical(i)) return;

    if (this.pending === null) {
      this.pending = i;
      this.board.setPending(i);
      this.board.setHover(null);
      statusEl.textContent = "Now pick the second cell to superpose this mark across.";

      return;
    }

    if (i === this.pending) { // click the pending cell again to cancel
      this.pending = null;
      this.board.setPending(null);
      this.updateUI();

      return;
    }

    const result = this.engine.place(this.pending, i);
    this.pending = null;
    this.board.setPending(null);
    this.board.setHover(null);
    if (!result.ok) return;

    this.board.render(this.engine);

    const win = this.engine.checkWin();
    if (win) return this.handleWin(win, result.collapse);
    if (this.engine.isDraw()) return this.handleDraw();

    this.updateUI(result.collapse);
  }

  private updateUI (collapse?: Collapse) {
    const p = this.engine.current;
    turnEl.textContent = `${p === "x" ? "X (Cross)" : "O (Sphere)"} — move ${this.engine.moveId + 1}`;
    statusEl.textContent = collapse
      ? `⚡ Measurement! A cycle collapsed ${collapse.marks.length} cells.`
      : "Click two cells to place a superposed mark.";
    meterEl.textContent =
      `quantum bits left: ${R.remaining()} · superpositions: ${this.engine.spooky.length}`;
  }

  private handleWin (win: WinResult, collapse?: Collapse) {
    this.active = false;
    this.board.setHover(null);

    const note = collapse ? "⚡ measurement → " : "";
    const tie = win.shared ? ` (${win.shared.toUpperCase()} also lined up — ½ point)` : "";
    statusEl.textContent = `${note}Player ${win.winner.toUpperCase()} wins!${tie}`;
    statusEl.style.color = win.winner === "x" ? "#EFDEA2" : "#FC635A";

    const a = vecOf(win.line[0]);
    const b = vecOf(win.line[2]);
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(0.12, 0.12, len, 8);
    geo.translate(0, len / 2, 0);
    geo.rotateX(Math.PI / 2);
    const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: CONF.COLORS.coral, depthTest: false }));
    beam.position.copy(a);
    beam.lookAt(b);
    this.director.scene.add(beam);
  }

  private handleDraw () {
    this.active = false;
    this.board.setHover(null);
    statusEl.textContent = "Draw — the board resolved with no three-in-a-row.";
    statusEl.style.color = "#9ABAEC";
  }

  private animate () {
    requestAnimationFrame(() => this.animate());
    this.board.spin(this.director.clock.getDelta());
    this.director.controls.update();
    this.director.renderer.render(this.director.scene, this.director.camera);
  }
}

const game = new Game();
// Debug handle for manual inspection and browser-driven testing (Puppeteer).
(globalThis as typeof globalThis & { xoxo?: Game }).xoxo = game;
