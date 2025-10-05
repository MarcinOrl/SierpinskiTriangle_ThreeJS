// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

/* --- helper: generowanie Sierpinskiego (subdivide) --- */
function subdivideTriangle(a, b, c, level, outTriangles) {
  if (level === 0) {
    outTriangles.push([a, b, c]);
    return;
  }

  const ab = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const bc = new THREE.Vector3().addVectors(b, c).multiplyScalar(0.5);
  const ca = new THREE.Vector3().addVectors(c, a).multiplyScalar(0.5);

  subdivideTriangle(a, ab, ca, level - 1, outTriangles);
  subdivideTriangle(ab, b, bc, level - 1, outTriangles);
  subdivideTriangle(ca, bc, c, level - 1, outTriangles);
}

/* --- scena, kamera, renderer --- */
const container = document.getElementById('app');
const scene = new THREE.Scene();

const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 0, 3);
camera.lookAt(0, 0, 0);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x0b0b0b);
container.appendChild(renderer.domElement);

/* --- Sierpinski triangle (2D on Z=0) --- */
/* poziom fractala — zmień jeśli chcesz większe/większa szczegółowość */
const LEVEL = 3;

// bazowy trójkąt równoboczny o boku ~2 z centroidem w (0,0)
const h = Math.sqrt(3);
const A = new THREE.Vector3(-1, -h / 3, 0);
const B = new THREE.Vector3(1, -h / 3, 0);
const C = new THREE.Vector3(0, (2 * h) / 3, 0);

const triangles = [];
subdivideTriangle(A, B, C, LEVEL, triangles);

// utwórz BufferGeometry z małych trójkątów
const triangleCount = triangles.length; // 3^LEVEL
const positions = new Float32Array(triangleCount * 3 * 3); // triCount * (3 vertices) * (3 coords)
let offset = 0;
for (let i = 0; i < triangleCount; i++) {
  const tri = triangles[i];
  for (let v = 0; v < 3; v++) {
    positions[offset++] = tri[v].x;
    positions[offset++] = tri[v].y;
    positions[offset++] = tri[v].z;
  }
}

const geom = new THREE.BufferGeometry();
geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
// opcjonalnie: wylicz bounding box do ustawienia kamery/controls.target
geom.computeBoundingSphere();

// Mesh: 2D, bez oświetlenia (MeshBasicMaterial), ale DoubleSide żeby nie znikało
const material = new THREE.MeshBasicMaterial({
  color: 0x44c88d,
  side: THREE.DoubleSide,
});
const mesh = new THREE.Mesh(geom, material);
scene.add(mesh);

// Kontur (linie) dla lepszej czytelności
const edges = new THREE.LineSegments(
  new THREE.EdgesGeometry(geom),
  new THREE.LineBasicMaterial({ color: 0x071a0f, linewidth: 1 })
);
scene.add(edges);

/* --- oświetlenie (niepotrzebne dla MeshBasicMaterial, ale zostawiam subtelne ambient jeśli zmienisz materiał) --- */
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

/* --- OrbitControls --- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);
controls.minDistance = 1.2;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI * 0.99;

/* --- responsywność --- */
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});

/* --- animacja: obrót całego fraktala + update controls --- */
const clock = new THREE.Clock();
function tick() {
  const delta = clock.getDelta();

  // powolny obrót w 2D wokół osi Y
  mesh.rotation.y += delta * 0.4;
  edges.rotation.y = mesh.rotation.y;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
