import * as THREE from "three";
import {
  OrbitControls
} from "three/examples/jsm/controls/OrbitControls.js";
import Shapes from "./geometry";
import { Board, Rulz } from "./game";
import CONFIG from "./conf";

class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  clock: THREE.Clock;
  raycaster: THREE.Raycaster;
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.COLORS.BG);
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(8, 8, 10);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    this.scene.add(ambientLight, dirLight);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 30;
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    window.addEventListener("resize", () => this.onWindowResize());
  }
  private onWindowResize () {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  render () {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

class Game {
  sceneManager: SceneManager;
  board: Board;
  rules: Rulz;
  currentPlayer: Player = "x";
  movesThisTurn = 0;
  active = true;
  mouse = new THREE.Vector2();
  hoveredCell: THREE.Mesh | null = null;
  constructor() {
    this.sceneManager = new SceneManager();
    this.board = new Board(this.sceneManager.scene);
    this.rules = new Rulz(this.board, this.sceneManager.scene);
    this.setupInputs();
    this.animate();
    this.updateUI();
  }
  setupInputs () {
    window.addEventListener("mousemove", (e) => this.onMouseMove(e));
    window.addEventListener("click", () => this.onClick());
  }
  onMouseMove (event: MouseEvent) {
    if (!this.active) return;
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.sceneManager.raycaster.setFromCamera(
      this.mouse,
      this.sceneManager.camera
    );
    const intersects = this.sceneManager.raycaster.intersectObjects(
      this.board.cells
    );
    if (this.hoveredCell) {
      this.board.highlightCell(null);
      this.hoveredCell = null;
    }
    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      if (this.rules.canPlace(cell, this.currentPlayer)) {
        this.hoveredCell = cell;
        this.board.highlightCell(cell);
      }
    }
  }
  onClick () {
    if (this.hoveredCell && this.active) {
      this.executeMove(this.hoveredCell);
      this.hoveredCell = null;
    }
  }
  executeMove (cell: THREE.Mesh) {
    const {
      gx,
      gy,
      gz
    } = cell.userData;
    const currentState = this.board.getCellState(gx, gy, gz);
    let newState: CellState | null = null;
    let markerMesh: THREE.Object3D | null = null;
    if (currentState === null) {
      newState = this.currentPlayer;
      markerMesh =
        this.currentPlayer === "x" ?
          Shapes.half_cross(CONFIG.CELL_SIZE) :
          Shapes.half_sphere(CONFIG.CELL_SIZE);
      markerMesh.userData = {
        name: "_" + this.currentPlayer,
        collapsed: false,
      };
    } else if (
      (currentState === "x" && this.currentPlayer === "o") ||
      (currentState === "o" && this.currentPlayer === "x")
    ) {
      newState = "both";
      markerMesh = Shapes.both(CONFIG.CELL_SIZE);
      markerMesh.userData = {
        name: "_both",
        collapsed: false
      };
    } else {
      return;
    }
    this.board.updateCellVisuals(cell, newState, markerMesh);
    const win = this.rules.checkWin();
    if (win) {
      this.handleWin(win);
      return;
    }
    this.movesThisTurn++;
    console.log(`Move: ${this.movesThisTurn}`);
    if (this.movesThisTurn >= 2) {
      this.movesThisTurn = 0;
      this.currentPlayer = this.currentPlayer === "x" ? "o" : "x";
      if (this.currentPlayer === "x") {
        this.rules.performCollapse();
      }
    }
    this.updateUI();
  }
  handleWin (win: WinResult) {
    this.active = false;
    const statusEl = document.getElementById("status")!;
    statusEl.innerText = `Player ${win.winner.toUpperCase()} Wins!`;
    statusEl.style.color = "#00ff00";
    statusEl.style.fontWeight = "bold";
    this.drawWinLine(win);
  }
  drawWinLine (win: WinResult) {
    const getPos = (idx: number[]) => {
      return new THREE.Vector3(
        idx[0] * (CONFIG.CELL_SIZE + CONFIG.GAP) -
        ((CONFIG.GRID_SIZE - 1) * (CONFIG.CELL_SIZE + CONFIG.GAP)) / 2,
        idx[1] * (CONFIG.CELL_SIZE + CONFIG.GAP) -
        ((CONFIG.GRID_SIZE - 1) * (CONFIG.CELL_SIZE + CONFIG.GAP)) / 2,
        idx[2] * (CONFIG.CELL_SIZE + CONFIG.GAP) -
        ((CONFIG.GRID_SIZE - 1) * (CONFIG.CELL_SIZE + CONFIG.GAP)) / 2
      );
    };
    const start = getPos(win.start);
    const end = getPos(win.end);
    const lineGeo = new THREE.CylinderGeometry(
      0.1,
      0.1,
      start.distanceTo(end),
      8
    );
    lineGeo.translate(0, start.distanceTo(end) / 2, 0);
    lineGeo.rotateX(Math.PI / 2);
    const lineMesh = new THREE.Mesh(
      lineGeo,
      new THREE.MeshBasicMaterial({
        color: CONFIG.COLORS.WIN_LINE,
        depthTest: false,
      })
    );
    lineMesh.position.copy(start);
    lineMesh.lookAt(end);
    this.sceneManager.scene.add(lineMesh);
  }
  updateUI () {
    const turnEl = document.getElementById("turn-indicator")!;
    turnEl.innerText = `${this.currentPlayer === "x" ? "X (Cross)" : "O (Sphere)"} — Move ${this.movesThisTurn + 1}/2`;
    turnEl.style.color =
      this.currentPlayer === "x" ? CONFIG.COLORS.TEXT_X : CONFIG.COLORS.TEXT_O;
  }
  animate () {
    requestAnimationFrame(() => this.animate());
    const delta = this.sceneManager.clock.getDelta();
    this.board.rotateMarkers(delta);
    this.sceneManager.render();
  }
}
new Game();