// The stand-in statue — a draped philosopher built from lathes, capsules and
// primitive geometry. Shared by the museum-stage scene and the agora world.
// ~3.9 units tall, feet at y≈0.5 on its plinth cap.
import * as THREE from 'three';

export function buildStatue(material: THREE.Material): THREE.Group {
  const statue = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, pos?: number[], rot?: number[], scl?: number[]) => {
    const m = new THREE.Mesh(geo, material);
    if (pos) m.position.set(pos[0]!, pos[1]!, pos[2]!);
    if (rot) m.rotation.set(rot[0]!, rot[1]!, rot[2]!);
    if (scl) m.scale.set(scl[0]!, scl[1]!, scl[2]!);
    m.castShadow = true;
    m.receiveShadow = true;
    statue.add(m);
    return m;
  };
  const limb = (a: number[], b: number[], r: number) => {
    const va = new THREE.Vector3(a[0]!, a[1]!, a[2]!);
    const vb = new THREE.Vector3(b[0]!, b[1]!, b[2]!);
    const m = add(new THREE.CapsuleGeometry(r, va.distanceTo(vb), 8, 20));
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return m;
  };
  // robe with folds
  const robeGeo = new THREE.LatheGeometry(
    [[0.56, 0.5], [0.55, 0.62], [0.5, 1.2], [0.44, 1.8], [0.38, 2.25], [0.4, 2.55]].map(([x, y]) => new THREE.Vector2(x!, y!)),
    96,
  );
  const rp = robeGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i);
    const y = rp.getY(i);
    const z = rp.getZ(i);
    const ang = Math.atan2(z, x);
    const rad = Math.hypot(x, z);
    const fold = 0.035 * Math.sin(ang * 13 + y * 1.4) * (1.2 - y / 2.6) + 0.015 * Math.sin(ang * 29);
    const nr = rad + fold;
    rp.setXYZ(i, Math.cos(ang) * nr, y, Math.sin(ang) * nr * 0.82);
  }
  robeGeo.computeVertexNormals();
  add(robeGeo);
  // chest and shoulders
  const chestGeo = new THREE.LatheGeometry(
    [[0.4, 2.5], [0.44, 2.72], [0.42, 2.9], [0.3, 3.02], [0.12, 3.08]].map(([x, y]) => new THREE.Vector2(x!, y!)),
    48,
  );
  add(chestGeo, undefined, undefined, [1, 1, 0.72]);
  limb([-0.44, 2.94, 0], [0.44, 2.94, 0], 0.13);
  limb([-0.5, 2.9, 0], [-0.56, 2.25, 0.02], 0.1);
  limb([-0.56, 2.25, 0.02], [-0.5, 1.72, 0.12], 0.085);
  limb([0.5, 2.9, 0], [0.52, 2.32, 0.08], 0.1);
  limb([0.52, 2.32, 0.08], [0.14, 2.52, 0.36], 0.085);
  add(new THREE.SphereGeometry(0.075, 16, 12), [0.12, 2.53, 0.4]);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 20), [0.05, 2.56, 0.42], [0, 0, Math.PI / 2 - 0.25]);
  const sash = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.5, 3.0, -0.05), new THREE.Vector3(-0.2, 2.72, 0.32), new THREE.Vector3(0.2, 2.35, 0.36),
    new THREE.Vector3(0.44, 2.0, 0.24), new THREE.Vector3(0.5, 1.4, 0.18), new THREE.Vector3(0.48, 0.8, 0.2),
  ]);
  add(new THREE.TubeGeometry(sash, 64, 0.09, 12, false), undefined, undefined, [1, 1, 0.9]);
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 20), [0, 3.17, 0.01]);
  add(new THREE.SphereGeometry(0.2, 32, 24), [0, 3.45, 0.02], undefined, [0.9, 1.08, 0.98]);
  const hairGeo = new THREE.IcosahedronGeometry(0.215, 3);
  const hp = hairGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    const v = new THREE.Vector3(hp.getX(i), hp.getY(i), hp.getZ(i));
    v.multiplyScalar(1 + 0.06 * Math.sin(v.x * 70) * Math.sin(v.y * 70) * Math.sin(v.z * 70));
    hp.setXYZ(i, v.x, v.y, v.z);
  }
  hairGeo.computeVertexNormals();
  add(hairGeo, [0, 3.52, -0.04], undefined, [0.95, 0.9, 1.0]);
  add(new THREE.SphereGeometry(0.12, 24, 16), [0, 3.3, 0.1], undefined, [1.1, 1.15, 0.85]);
  add(new THREE.ConeGeometry(0.03, 0.08, 12), [0, 3.43, 0.2], [Math.PI / 2 + 0.3, 0, 0]);
  limb([-0.14, 0.52, 0.42], [-0.16, 0.52, 0.56], 0.055);
  limb([0.15, 0.52, 0.42], [0.18, 0.52, 0.55], 0.055);
  return statue;
}
