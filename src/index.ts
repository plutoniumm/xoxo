import * as THREE from 'three';
import {
  OrbitControls
} from 'three/examples/jsm/controls/OrbitControls.js';
import Shapes from './geometry';

const MOTION = 0.2;
const CELL_SIZE = 2;
const GAP = 1;
const GRID_SIZE = 3;

const OFFSET = ((GRID_SIZE - 1) * (CELL_SIZE + GAP)) / 2;

let currentPlayer: 'x' | 'o' = 'x';
let gameActive = true;
const board: (string | null)[][][] = Array(GRID_SIZE).fill(null).map(() =>
  Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
);

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202025);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(8, 8, 10);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 30;

// clock and marker registry for slow rotation
const clock = new THREE.Clock();
const markers: THREE.Object3D[] = [];

// 1. The Cell (Hitbox + Visual Guide)
const cellGeometry = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE);
const cellMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.1,
  wireframe: true
});
const hoverMaterial = new THREE.MeshBasicMaterial({
  color: 0x44aa88,
  transparent: true,
  opacity: 0.4,
  wireframe: false
});

const cells: THREE.Mesh[] = [];

for (let x = 0; x < GRID_SIZE; x++) {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const cell = new THREE.Mesh(cellGeometry, cellMaterial.clone());

      // Position calculation centered around (0,0,0)
      cell.position.set(
        x * (CELL_SIZE + GAP) - OFFSET,
        y * (CELL_SIZE + GAP) - OFFSET,
        z * (CELL_SIZE + GAP) - OFFSET
      );

      // Store grid coordinates in userData for easy access
      cell.userData = {
        gx: x,
        gy: y,
        gz: z,
        occupied: false
      };

      scene.add(cell);
      cells.push(cell);
    }
  }
}

// --- Interaction Logic ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function placeMarker (cell: THREE.Mesh) {
  const {
    gx,
    gy,
    gz
  } = cell.userData;

  if (board[gx][gy][gz] !== null || !gameActive) return;

  board[gx][gy][gz] = currentPlayer;
  cell.userData.occupied = true;
  cell.material = new THREE.MeshBasicMaterial({
    color: 0x222222,
    transparent: true,
    opacity: 0.05,
    wireframe: true
  }); // Dim the box

  let markerMesh: THREE.Object3D;
  if (currentPlayer === 'x') {
    markerMesh = Shapes.half_cross(CELL_SIZE);
  } else {
    markerMesh = Shapes.half_sphere(CELL_SIZE);
  }

  markerMesh.position.copy(cell.position);
  scene.add(markerMesh);
  markers.push(markerMesh); // track for slow rotation

  markerMesh.scale.set(0, 0, 0);
  let scale = 0;
  const animateIn = () => {
    if (scale < 1) {
      scale += 0.1;
      markerMesh.scale.set(scale, scale, scale);
      requestAnimationFrame(animateIn);
    }
  };
  animateIn();

  const winLine = checkWin();
  if (winLine) {
    endGame(winLine);
  } else {
    currentPlayer = currentPlayer === 'x' ? 'o' : 'x';
    updateUI();
  }
}

// --- Win Detection Algorithm ---
// 3x3x3 has 49 winning lines:
// 27 straight (rows/cols/pillars)
// 18 diagonal on planes (2D diagonals on x, y, z slices)
// 4 cross-diagonal through the center
function checkWin (): {
  start: number[],
  end: number[]
} | null {
  const lines: number[][][] = [];

  // Helper to collect coordinates
  const getVal = (x: number, y: number, z: number) => board[x][y][z];

  // 1. Orthogonal Lines (x, y, z axes)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      // Rows along X (vary i, fixed j, k) -> Nope, vary x, fixed y(i), z(j)
      lines.push([
        [0, i, j],
        [1, i, j],
        [2, i, j]
      ]); // Along X
      lines.push([
        [i, 0, j],
        [i, 1, j],
        [i, 2, j]
      ]); // Along Y
      lines.push([
        [i, j, 0],
        [i, j, 1],
        [i, j, 2]
      ]); // Along Z
    }
  }

  // 2. 2D Diagonals on Planes
  for (let i = 0; i < 3; i++) {
    // X-Plane
    lines.push([
      [i, 0, 0],
      [i, 1, 1],
      [i, 2, 2]
    ]);
    lines.push([
      [i, 0, 2],
      [i, 1, 1],
      [i, 2, 0]
    ]);
    // Y-Plane
    lines.push([
      [0, i, 0],
      [1, i, 1],
      [2, i, 2]
    ]);
    lines.push([
      [2, i, 0],
      [1, i, 1],
      [0, i, 2]
    ]);
    // Z-Plane
    lines.push([
      [0, 0, i],
      [1, 1, i],
      [2, 2, i]
    ]);
    lines.push([
      [2, 0, i],
      [1, 1, i],
      [0, 2, i]
    ]);
  }

  // 3. 3D Cross Diagonals (Corners through center)
  lines.push([
    [0, 0, 0],
    [1, 1, 1],
    [2, 2, 2]
  ]);
  lines.push([
    [2, 0, 0],
    [1, 1, 1],
    [0, 2, 2]
  ]);
  lines.push([
    [0, 2, 0],
    [1, 1, 1],
    [2, 0, 2]
  ]);
  lines.push([
    [0, 0, 2],
    [1, 1, 1],
    [2, 2, 0]
  ]);

  // Check all lines
  for (const line of lines) {
    const [a, b, c] = line;
    const valA = getVal(a[0], a[1], a[2]);
    const valB = getVal(b[0], b[1], b[2]);
    const valC = getVal(c[0], c[1], c[2]);

    if (valA && valA === valB && valB === valC) {
      return {
        start: a,
        end: c
      };
    }
  }

  return null;
}

function endGame (winLine: {
  start: number[],
  end: number[]
}) {
  gameActive = false;
  const statusEl = document.getElementById('status')!;
  statusEl.innerText = `Player ${currentPlayer.toUpperCase()} Wins!`;
  statusEl.style.color = '#00ff00';
  statusEl.style.fontWeight = 'bold';

  // Draw Winning Line
  const startPos = new THREE.Vector3(
    winLine.start[0] * (CELL_SIZE + GAP) - OFFSET,
    winLine.start[1] * (CELL_SIZE + GAP) - OFFSET,
    winLine.start[2] * (CELL_SIZE + GAP) - OFFSET
  );
  const endPos = new THREE.Vector3(
    winLine.end[0] * (CELL_SIZE + GAP) - OFFSET,
    winLine.end[1] * (CELL_SIZE + GAP) - OFFSET,
    winLine.end[2] * (CELL_SIZE + GAP) - OFFSET
  );

  const lineGeo = new THREE.CylinderGeometry(0.1, 0.1, startPos.distanceTo(endPos), 8);
  // Orient cylinder
  lineGeo.translate(0, startPos.distanceTo(endPos) / 2, 0);
  lineGeo.rotateX(Math.PI / 2);
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    depthTest: false
  });
  const lineMesh = new THREE.Mesh(lineGeo, lineMat);

  lineMesh.position.copy(startPos);
  lineMesh.lookAt(endPos);

  scene.add(lineMesh);
}

function updateUI () {
  const turnEl = document.getElementById('turn-indicator')!;
  turnEl.innerText = currentPlayer === 'x' ? 'X (Cross)' : 'O (Sphere)';
  turnEl.style.color = currentPlayer === 'x' ? '#ffaa00' : '#3399ff';
}

// --- Event Listeners ---

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let hoveredCell: THREE.Mesh | null = null;

window.addEventListener('mousemove', (event) => {
  if (!gameActive) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(cells);

  if (hoveredCell) {
    // Reset previous hover only if it's not occupied
    if (!hoveredCell.userData.occupied) {
      hoveredCell.material = cellMaterial.clone();
    }
    hoveredCell = null;
  }

  if (intersects.length > 0) {
    const object = intersects[0].object as THREE.Mesh;
    if (!object.userData.occupied) {
      hoveredCell = object;
      hoveredCell.material = hoverMaterial;
    }
  }
});

window.addEventListener('click', () => {
  if (hoveredCell && gameActive) {
    placeMarker(hoveredCell);
    hoveredCell = null;
  }
});

function animate () {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  for (const m of markers) {
    m.rotation.x += delta * MOTION;
  }
  controls.update();
  renderer.render(scene, camera);
}

animate();