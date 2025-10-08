// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import './style.css';

/* --- helper: Sierpinski tetrahedron subdivide --- */
function subdivideTetra(a, b, c, d, level, outTetras) {
  if (level === 0) {
    outTetras.push([a.clone(), b.clone(), c.clone(), d.clone()]);
    return;
  }

  const ab = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const ac = new THREE.Vector3().addVectors(a, c).multiplyScalar(0.5);
  const ad = new THREE.Vector3().addVectors(a, d).multiplyScalar(0.5);
  const bc = new THREE.Vector3().addVectors(b, c).multiplyScalar(0.5);
  const bd = new THREE.Vector3().addVectors(b, d).multiplyScalar(0.5);
  const cd = new THREE.Vector3().addVectors(c, d).multiplyScalar(0.5);

  subdivideTetra(a, ab, ac, ad, level - 1, outTetras);
  subdivideTetra(ab, b, bc, bd, level - 1, outTetras);
  subdivideTetra(ac, bc, c, cd, level - 1, outTetras);
  subdivideTetra(ad, bd, cd, d, level - 1, outTetras);
}

/* --- scena, kamera, renderer --- */
const container = document.getElementById('app');
const scene = new THREE.Scene();

const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 1000);
camera.position.set(0, 0, 4);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x1a1a1a);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

/* --- światła --- */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
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
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI * 0.99;

/* --- params & GUI --- */
const params = {
  level: 2,
  color: '#ff0000',
  rotationSpeed: 0.3,
  autoRotateCamera: false,
  showEdges: true,
  frame: () => frameToGeometry(),
  resetCamera: () => resetCamera()
};

const gui = new GUI();
gui.add(params, 'level', 0, 8, 1).name('Level').onChange(() => regenerate());
gui.addColor(params, 'color').name('Color').onChange((v) => { if (material) material.color.set(v); });
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

/* --- Sierpinski 3D (tetrahedra) --- */
function buildSierpinski3D(level, colorHex) {
  const s = 1.6; // skala tetrahedronu
  const h = Math.sqrt(2 / 3) * s; // wysokość tetra
  const A = new THREE.Vector3(0, h * 0.5, 0); // top
  const B = new THREE.Vector3(-s / 2, -h * 0.5, s * (Math.sqrt(3) / 6));
  const C = new THREE.Vector3(s / 2, -h * 0.5, s * (Math.sqrt(3) / 6));
  const D = new THREE.Vector3(0, -h * 0.5, -s * (Math.sqrt(3) / 3));

  const tetras = [];
  subdivideTetra(A, B, C, D, level, tetras);

  const triCount = tetras.length * 4;
  const positions = new Float32Array(triCount * 3 * 3);
  let off = 0;
  for (let i = 0; i < tetras.length; i++) {
    const [a, b, c, d] = tetras[i];
    const faces = [
      [a, b, c],
      [a, c, d],
      [a, d, b],
      [b, d, c]
    ];
    for (let f = 0; f < faces.length; f++) {
      const face = faces[f];
      for (let v = 0; v < 3; v++) {
        positions[off++] = face[v].x;
        positions[off++] = face[v].y;
        positions[off++] = face[v].z;
      }
    }
  }

  geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
  geom.computeVertexNormals();

  material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.5 });
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
  ground.position.y = minY - 0.5;
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
  const distance = Math.max(1.0, radius * 3.0);
  camera.position.set(center.x + distance * 0.6, center.y + radius * 0.6, center.z + distance * 0.8);
  camera.updateProjectionMatrix();
  controls.update();
}

/* --- shadow bounds --- */
function updateShadowCameraBounds() {
  if (!geom || !geom.boundingSphere) return;
  const center = geom.boundingSphere.center;
  const radius = geom.boundingSphere.radius;

  const pad = radius * 1.8;
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
  camera.position.set(0, 0, 4);
  controls.target.set(0, 0, 0);
  controls.update();
}

/* --- regenerate --- */
function regenerate() {
  const level = Math.min(Math.max(0, Math.floor(params.level)), 8);
  params.level = level;
  disposeIfExists();
  buildSierpinski3D(level, params.color);
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
