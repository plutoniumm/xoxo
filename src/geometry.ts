import * as THREE from 'three';

function buildSphere (size: number, scale = 1): THREE.Mesh {
  const geo = new THREE.SphereGeometry(size * 0.35 * scale, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3399ff, roughness: 0.2, metalness: 0.5 });

  return new THREE.Mesh(geo, mat);
}

function buildCross (size: number, scale = 1): THREE.Group {
  const SZ = size * scale;
  const [L, B, H] = [SZ * 0.8, SZ * 0.12, SZ * 0.2];
  const geo = new THREE.BoxGeometry(L, B, H);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.2, metalness: 0.6 });

  const bar1 = new THREE.Mesh(geo, mat);
  const bar2 = new THREE.Mesh(geo.clone(), mat.clone());

  bar1.rotateZ(Math.PI / 4);
  bar2.rotateZ(-Math.PI / 4);

  const group = new THREE.Group();
  group.add(bar1);
  group.add(bar2);

  return group;
}

const Shapes = {
  sphere (size: number): THREE.Object3D {
    return buildSphere(size, 1);
  },
  cross (size: number): THREE.Object3D {
    return buildCross(size, 1);
  },
  half_sphere (size: number): THREE.Object3D {
    return buildSphere(size, 0.5);
  },
  half_cross (size: number): THREE.Object3D {
    return buildCross(size, 0.5);
  },
  both (size: number): THREE.Group {
    const group = new THREE.Group();
    const s = buildSphere(size, 0.5);
    const c = buildCross(size, 0.5);
    s.position.x = -size * 0.25;
    c.position.x = size * 0.25;
    group.add(s);
    group.add(c);
    return group;
  }
};

export default Shapes;
