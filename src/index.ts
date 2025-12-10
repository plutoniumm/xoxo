import * as THREE from "three";
import {
  OrbitControls
} from "three/examples/jsm/controls/OrbitControls.js";
import Shapes from "./geometry";
import { Board, Rulz } from "./game";
import CONFIG from "./conf";

const turnEl = document.getElementById("turn-indicator")!;
const statusEl = document.getElementById("status")!;

class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  clock: THREE.Clock;
  raycaster: THREE.Raycaster;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2D0A52);

    let [iw, ih] = [window.innerWidth, window.innerHeight];
    this.camera = new THREE.PerspectiveCamera(
      75, iw / ih, 0.1, 100
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
}

class Game {
  director: SceneManager;
  board: Board;
  rules: Rulz;
  currentPlayer: Player = "x";
  movesThisTurn = 0;
  active = true;
  mouse = new THREE.Vector2();
  hoveredCell: THREE.Mesh | null = null;

  constructor() {
    this.director = new SceneManager();
    this.board = new Board(this.director.scene);
    this.rules = new Rulz(this.board, this.director.scene);

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

    this.director.raycaster.setFromCamera(
      this.mouse,
      this.director.camera
    );

    const intersects = this.director.raycaster.intersectObjects(
      this.board.cells
    );

    if (this.hoveredCell) {
      this.board.highlight(null);
      this.hoveredCell = null;
    }

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      if (this.rules.valid(cell, this.currentPlayer)) {
        this.hoveredCell = cell;
        this.board.highlight(cell);
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
    const { gx, gy, gz } = cell.userData;
    const currentState = this.board.Cell(gx, gy, gz);

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
    } else return;

    this.board.updateCells(cell, newState, markerMesh);

    const win = this.rules.checkWin();
    if (win) return this.handleWin(win);

    this.movesThisTurn++;
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

    statusEl.innerText = `Player ${win.winner.toUpperCase()} Wins!`;
    statusEl.style.color = "#00ff00";

    const getPos = (idx: number[]) => {
      let space = CONFIG.CELL_SIZE + CONFIG.GAP;
      let gap = ((CONFIG.GRID_SIZE - 1) * (space)) / 2;

      return new THREE.Vector3(
        idx[0] * (space) - gap,
        idx[1] * (space) - gap,
        idx[2] * (space) - gap
      );
    };

    const start = getPos(win.start);
    const end = getPos(win.end);

    const lineGeo = new THREE.CylinderGeometry(
      0.1, 0.1, start.distanceTo(end), 8
    );
    lineGeo.translate(0, start.distanceTo(end) / 2, 0);
    lineGeo.rotateX(Math.PI / 2);

    const lineMesh = new THREE.Mesh(
      lineGeo,
      new THREE.MeshBasicMaterial({
        color: CONFIG.COLORS.coral,
        depthTest: false,
      })
    );

    lineMesh.position.copy(start);
    lineMesh.lookAt(end);

    this.director.scene.add(lineMesh);
  }

  updateUI () {
    turnEl.innerText = `${this.currentPlayer === "x" ? "X (Cross)" : "O (Sphere)"} — Move ${this.movesThisTurn + 1}/2`;
  }

  animate () {
    requestAnimationFrame(() => this.animate());
    const delta = this.director.clock.getDelta();

    for (const m of this.board.markers) {
      m.rotation.y += delta * CONFIG.MOTION_SPEED;
    }

    this.director.controls.update();
    this.director.renderer.render(
      this.director.scene,
      this.director.camera
    );
  }
};

new Game();