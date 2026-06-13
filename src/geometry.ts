import * as THREE from "three";
import CONF from "./conf";

const { COLORS } = CONF;

export const PLAYER_COLOR: Record<Player, number> = {
  x: COLORS.cream,
  o: COLORS.salmon,
};

function material (color: number, ghost: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.05,
    transparent: ghost,
    opacity: ghost ? 0.45 : 1,
    emissive: ghost ? color : 0x000000,
    emissiveIntensity: ghost ? 0.25 : 0,
  });
}

function sphere (size: number, color: number, ghost: boolean): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(size * 0.34, 24, 24), material(color, ghost));
}

function cross (size: number, color: number, ghost: boolean): THREE.Group {
  const [L, B, H] = [size * 0.78, size * 0.16, size * 0.2];
  const geo = new THREE.BoxGeometry(L, B, H);
  const mat = material(color, ghost);
  const b1 = new THREE.Mesh(geo, mat);
  const b2 = new THREE.Mesh(geo, mat);
  b1.rotateZ(Math.PI / 4);
  b2.rotateZ(-Math.PI / 4);

  return new THREE.Group().add(b1, b2);
}

const Shapes = {
  // X → cross, O → sphere; ghost = translucent (a superposed/spooky mark).
  mark (player: Player, size: number, ghost: boolean): THREE.Object3D {
    const color = PLAYER_COLOR[player];

    return player === "x" ? cross(size, color, ghost) : sphere(size, color, ghost);
  },

  blank (size: number): THREE.Mesh {
    const s = size * 0.2;

    return new THREE.Mesh(
      new THREE.BoxGeometry(s, s, s),
      new THREE.MeshStandardMaterial({
        color: COLORS.lime,
        transparent: true,
        opacity: 0.65,
      }),
    );
  },

  link (a: THREE.Vector3, b: THREE.Vector3, color: number): THREE.Mesh {
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(0.03, 0.03, len, 6);
    geo.translate(0, len / 2, 0);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
    }));
    mesh.position.copy(a);
    mesh.lookAt(b);

    return mesh;
  },

  label (text: string, color: number): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
    ctx.font = "bold 42px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 32, 34);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthTest: false,
      }),
    );
    sprite.scale.set(0.5, 0.5, 0.5);

    return sprite;
  },
};

export default Shapes;
