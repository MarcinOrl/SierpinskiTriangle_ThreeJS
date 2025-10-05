// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import './style.css';

/* --- helper: Sierpinski subdivide --- */
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

/* --- scena, kamera, renderer --- */
const container = document.getElementById('app');
const scene = new THREE.Scene();

const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 1000);
camera.position.set(0, 0, 3);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x1a1a1a);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

/* --- światła --- */
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
scene.add(dirLight);

/* --- zmienne globalne --- */
let geom = null;
let mesh = null;
let edges = null;
let material = null;
let ground = null;

/* --- OrbitControls --- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI * 0.99;

/* --- parametry i GUI --- */
const params = {
  level: 3,
  color: '#ff0000',
  rotationSpeed: 0.4,
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

/* --- dispose --- */
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
    try { geom.dispose(); } catch (e) {}
    geom = null;
  }
  if (ground) {
    scene.remove(ground);
    if (ground.geometry) ground.geometry.dispose();
    if (ground.material) ground.material.dispose();
    ground = null;
  }
}

/* --- Sierpinski --- */
function buildSierpinski(level, colorHex) {
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
  geom.computeBoundingBox();

  material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.7 });
  mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  scene.add(mesh);

  const edgesGeom = new THREE.EdgesGeometry(geom);
  const edgesMat = new THREE.LineBasicMaterial({ color: 0x071a0f });
  edges = new THREE.LineSegments(edgesGeom, edgesMat);
  edges.visible = params.showEdges;
  edges.castShadow = false;
  scene.add(edges);

  const bb = geom.boundingBox;
  const minY = bb.min.y;
  const planeSize = Math.max(6, geom.boundingSphere.radius * 6);

  const planeGeom = new THREE.PlaneGeometry(planeSize, planeSize);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 1, metalness: 0 });
  ground = new THREE.Mesh(planeGeom, planeMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = minY - 0.15;
  ground.receiveShadow = true;
  ground.castShadow = false;
  scene.add(ground);

  updateShadowCameraBounds();
}

/* --- frame kamera --- */
function frameToGeometry() {
  if (!geom || !geom.boundingSphere) return;
  const center = geom.boundingSphere.center;
  const radius = geom.boundingSphere.radius;

  controls.target.copy(center);
  const distance = Math.max(1.0, radius * 2.5);
  camera.position.set(center.x, center.y + radius * 0.2, center.z + distance);
  camera.updateProjectionMatrix();
  controls.update();
}

/* --- shadow bounds --- */
function updateShadowCameraBounds() {
  if (!geom || !geom.boundingSphere) return;
  const center = geom.boundingSphere.center;
  const radius = geom.boundingSphere.radius;

  const pad = radius * 1.5;
  const left = -pad, right = pad, top = pad, bottom = -pad;
  const near = 0.1;
  const far = Math.max(50, radius * 10);

  const cam = dirLight.shadow.camera;
  if (cam.isOrthographicCamera) {
    cam.left = center.x + left;
    cam.right = center.x + right;
    cam.top = center.y + top;
    cam.bottom = center.y + bottom;
    cam.near = near;
    cam.far = far;
    cam.updateProjectionMatrix();
    dirLight.shadow.bias = -0.0005;
  } else {
    cam.near = near;
    cam.far = far;
    cam.updateProjectionMatrix();
  }

  dirLight.position.set(center.x + pad * 1.2, center.y + pad * 2.0, center.z + pad * 1.2);
  dirLight.target.position.copy(center);
  scene.add(dirLight.target);
}

/* --- reset kamery --- */
function resetCamera() {
  camera.position.set(0, 0, 3);
  controls.target.set(0, 0, 0);
  controls.update();
}

/* --- regeneracja --- */
function regenerate() {
  const level = Math.min(Math.max(0, Math.floor(params.level)), 6);
  params.level = level;
  disposeIfExists();
  buildSierpinski(level, params.color);
  frameToGeometry();
}

/* --- resize --- */
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});

/* --- init --- */
regenerate();
controls.autoRotate = params.autoRotateCamera;
controls.autoRotateSpeed = 2.0;

/* --- animacja --- */
const clock = new THREE.Clock();
function tick() {
  const delta = clock.getDelta();
  if (mesh) {
    mesh.rotation.y += delta * params.rotationSpeed;
    if (edges) edges.rotation.y = mesh.rotation.y;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
