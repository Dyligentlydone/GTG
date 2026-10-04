'use client';
// Turntable impostor: a camera-facing billboard that shows the pre-rendered
// view of the statue matching the camera's azimuth, blending between the two
// nearest frames — reads as a full 3D model from every direction.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

// azimuth (deg) each numbered frame was captured at — measured from the video
const FRAMES: [file: string, azimuth: number][] = [
  ['00.png', 0], ['01.png', 20], ['02.png', 40], ['03.png', 60],
  ['04.png', 85], ['05.png', 105], ['06.png', 125], ['07.png', 145],
  ['08.png', 160], ['09.png', 172], ['10.png', 182], ['11.png', 195],
  ['12.png', 215], ['13.png', 228], ['14.png', 252], ['15.png', 268],
  ['16.png', 285], ['17.png', 300], ['18.png', 318], ['19.png', 335],
  ['20.png', 350],
];
const H = 3.8;
const W = H * (894 / 1079); // frame aspect

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D texA;
  uniform sampler2D texB;
  uniform float t;
  varying vec2 vUv;
  void main() {
    vec4 c = mix(texture2D(texA, vUv), texture2D(texB, vUv), t);
    if (c.a < 0.35) discard;
    gl_FragColor = vec4(c.rgb, 1.0);
  }
`;

export function ImpostorStatue({ position = [0, 0, 0] as [number, number, number] }) {
  const textures = useTexture(FRAMES.map(f => `/statue-frames/${f[0]}`));
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);

  useMemo(() => textures.forEach(t => { t.colorSpace = THREE.SRGBColorSpace; }), [textures]);
  const uniforms = useMemo(() => ({
    texA: { value: textures[0]! },
    texB: { value: textures[0]! },
    t: { value: 0 },
  }), [textures]);
  const depthMat = useMemo(() => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.4 }), []);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g || !mesh.current) return;
    const yaw = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
    g.rotation.y = yaw;

    let deg = (yaw * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;

    let i = FRAMES.length - 1;
    for (let j = 0; j < FRAMES.length; j++) {
      if (FRAMES[j][1] > deg) { i = j - 1; break; }
    }
    if (i < 0) i = FRAMES.length - 1;
    const next = (i + 1) % FRAMES.length;
    const span = (FRAMES[next][1] - FRAMES[i][1] + 360) % 360;
    const t = span > 0 ? Math.min(1, ((deg - FRAMES[i][1] + 360) % 360) / span) : 0;

    uniforms.texA.value = textures[i]!;
    uniforms.texB.value = textures[next]!;
    uniforms.t.value = t;
    depthMat.map = textures[i]!;
  });

  return (
    <group ref={group} position={position}>
      <mesh ref={mesh} position={[0, H / 2, 0]} castShadow customDepthMaterial={depthMat}>
        <planeGeometry args={[W, H]} />
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} />
      </mesh>
    </group>
  );
}
