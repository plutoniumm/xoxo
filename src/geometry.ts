import * as THREE from 'three';
import CONF from './conf';
const { COLORS } = CONF;

const material = (color: number) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.35,
  metalness: 0.05
});

function buildSphere (size: number, scale = 1): THREE.Mesh {
  const geo = new THREE.SphereGeometry(size * 0.35 * scale, 32, 32);
  const mat = material(COLORS.salmon);

  return new THREE.Mesh(geo, mat);
}

function buildCross (size: number, scale = 1): THREE.Group {
  const SZ = size * scale;
  const [L, B, H] = [SZ * 0.8, SZ * 0.12, SZ * 0.2];
  const geo = new THREE.BoxGeometry(L, B, H);
  const mat = material(COLORS.cream);

  const b1 = new THREE.Mesh(geo, mat);
  const b2 = new THREE.Mesh(geo.clone(), mat.clone());
  b1.rotateZ(Math.PI / 4);
  b2.rotateZ(-Math.PI / 4);

  return new THREE.Group().add(b1, b2);
}

const Shapes = {
  sphere (size: number) {
    return buildSphere(size, 1);
  },
  cross (size: number) {
    return buildCross(size, 1);
  },
  half_sphere (size: number) {
    return buildSphere(size, 0.5);
  },
  half_cross (size: number) {
    return buildCross(size, 0.5);
  },
  both (size: number) {
    const s = buildSphere(size, 0.5);
    const c = buildCross(size, 0.5);

    s.position.x = -size * 0.25;
    c.position.x = size * 0.25;

    return new THREE.Group().add(s, c);
  },
  blank (size: number) {
    const sz = size * 0.25;
    const geo = new THREE.BoxGeometry(sz, sz, sz);
    const mat = material(COLORS.lime);

    return new THREE.Mesh(geo, mat);
  }
};

export default Shapes;
