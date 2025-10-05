// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import './style.css';

/* ---------- helper: Sierpinski subdivide ---------- */
function subdivideTriangle(a, b, c, level, outTriangles) {
  if (level === 0) {
    outTriangles.push([a.clone(), b.clone(), c.clone()]);
    return;
  }
  const ab = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const bc = new THREE.Vector3().addVectors(b, c).multiplyScalar(0.5);
  const ca = new THREE.Vector3().addVectors(c, a).multiplyScalar(0.5);

  subdivideTriangle(a, ab, ca, level - 1, outTriangles);
  subdivideTriangle(ab, b, bc, level - 1, outTriangles);
  subdivideTriangle(ca, bc, c, level - 1, outTriangles);
}

/* ---------- scena, kamera, renderer ---------- */
const container = document.getElementById('app');
const scene = new THREE.Scene();

const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 1000);
camera.position.set(0, 0, 3);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x0b0b0b);
container.appendChild(renderer.domElement);

/* ---------- globaly zarządzane obiekty (będziemy je regenerować) ---------- */
let geom = null;
let mesh = null;
let edges = null;
let material = null;

/* ---------- OrbitControls ---------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI * 0.99;

/* ---------- parametry i GUI ---------- */
const params = {
  level: 3,
  color: '#44c88d',
  rotationSpeed: 0.4,   // rad/s dla obracania mesh
  autoRotateCamera: false,
  showEdges: true,
  frame: () => frameToGeometry(),
  resetCamera: () => resetCamera()
};

const gui = new GUI();
gui.add(params, 'level', 0, 6, 1).name('Level').onChange(() => regenerate());
gui.addColor(params, 'color').name('Color').onChange((v) => {
  if (material) material.color.set(v);
});
gui.add(params, 'rotationSpeed', 0, 2, 0.01).name('Rotation speed');
gui.add(params, 'autoRotateCamera').name('Auto-rotate cam').onChange(v => controls.autoRotate = v);
gui.add(params, 'showEdges').name('Show edges').onChange(v => { if (edges) edges.visible = v; });
gui.add(params, 'frame').name('Frame geometry');
gui.add(params, 'resetCamera').name('Reset camera');

/* ---------- helper: utwórz/usuń geometrię Sierpinskiego ---------- */
function disposeIfExists() {
  if (mesh) {
    scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
    mesh = null;
  }
  if (edges) {
    scene.remove(edges);
    if (edges.geometry) edges.geometry.dispose();
    if (edges.material) edges.material.dispose();
    edges = null;
  }
  if (geom) {
    // geom może być już zamknięty przez mesh, ale dla bezpieczeństwa:
    try { geom.dispose(); } catch (e) {}
    geom = null;
  }
}

function buildSierpinski(level, colorHex) {
  // baza: równoboczny trójkąt o boku ~2, centroid w (0,0)
  const h = Math.sqrt(3);
  const A = new THREE.Vector3(-1, -h / 3, 0);
  const B = new THREE.Vector3(1, -h / 3, 0);
  const C = new THREE.Vector3(0, (2 * h) / 3, 0);

  const triangles = [];
  subdivideTriangle(A, B, C, level, triangles);

  const triangleCount = triangles.length;
  const positions = new Float32Array(triangleCount * 3 * 3);
  let offset = 0;
  for (let i = 0; i < triangleCount; i++) {
    const tri = triangles[i];
    for (let v = 0; v < 3; v++) {
      positions[offset++] = tri[v].x;
      positions[offset++] = tri[v].y;
      positions[offset++] = tri[v].z;
    }
  }

  geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.computeBoundingSphere();

  material = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
  mesh = new THREE.Mesh(geom, material);
  scene.add(mesh);

  const edgesGeom = new THREE.EdgesGeometry(geom);
  const edgesMat = new THREE.LineBasicMaterial({ color: 0x071a0f });
  edges = new THREE.LineSegments(edgesGeom, edgesMat);
  edges.visible = params.showEdges;
  scene.add(edges);
}

/* ---------- regeneracja z bezpiecznym dispose ---------- */
function regenerate() {
  // zapobiegnij zbyt wysokim poziomom (wydajność)
  const level = Math.min(Math.max(0, Math.floor(params.level)), 6);
  params.level = level; // normalizacja

  disposeIfExists();
  buildSierpinski(level, params.color);
  frameToGeometry();
}

/* ---------- dopasowanie kamery do geometrii ---------- */
function frameToGeometry() {
  if (!geom || !geom.boundingSphere) return;
  const center = geom.boundingSphere.center;
  const radius = geom.boundingSphere.radius;

  // ustaw target i przesun kamerę wzdłuż osi Z względem środka
  controls.target.copy(center);
  // zachowaj obecne kąty kamery względem target: ustaw pozycję na osi Z w odległości proporcjonalnej do radius
  const distance = Math.max(1.0, radius * 2.5);
  camera.position.set(center.x, center.y, center.z + distance);
  camera.updateProjectionMatrix();
  controls.update();
}

/* ---------- reset kamery do domyślnej pozycji (upraszcza UX) ---------- */
function resetCamera() {
  camera.position.set(0, 0, 3);
  controls.target.set(0, 0, 0);
  controls.update();
}

/* ---------- resize ---------- */
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});

/* ---------- init ---------- */
regenerate();
controls.autoRotate = params.autoRotateCamera;
controls.autoRotateSpeed = 2.0;

/* ---------- animacja ---------- */
const clock = new THREE.Clock();
function tick() {
  const delta = clock.getDelta();

  // rotacja mesh (2D: wokół Y)
  if (mesh) mesh.rotation.y += delta * params.rotationSpeed;
  if (edges) edges.rotation.y = mesh.rotation.y;

  controls.update(); // potrzebne jeśli enableDamping lub autoRotate
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
