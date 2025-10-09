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
let material = null;
let ground = null;
let groupTetras = null;
let tetraObjects = [];

/* --- OrbitControls --- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI * 0.99;

/* --- params & GUI --- */
const params = {
  level: 2,
  color: '#ff0000',
  rotationSpeed: 0.3,
  autoRotateCamera: false,
  showEdges: true,
  explode: false,
  explodeSpeed: 0.3,
  explodeAmount: 0.1,
  frame: () => frameToGeometry(),
  resetCamera: () => resetCamera()
};

const gui = new GUI();
gui.add(params, 'level', 0, 8, 1).name('Level').onChange(() => regenerate());
gui.addColor(params, 'color').name('Color').onChange((v) => {
  if (material) material.color.set(v);
});
gui.add(params, 'rotationSpeed', 0, 2, 0.01).name('Rotation speed');
gui.add(params, 'autoRotateCamera').name('Auto-rotate cam').onChange(v => controls.autoRotate = v);
gui.add(params, 'showEdges').name('Show edges').onChange(v => {
  tetraObjects.forEach(o => { if (o.edge) o.edge.visible = v; });
});
gui.add(params, 'explode').name('Explode');
gui.add(params, 'explodeSpeed', 0.1, 3.0, 0.01).name('Explode speed');
gui.add(params, 'explodeAmount', 0.0, 0.5, 0.01).name('Explode amount');
gui.add(params, 'frame').name('Frame geometry');
gui.add(params, 'resetCamera').name('Reset camera');

/* --- dispose --- */
function disposeIfExists() {
  if (groupTetras) {
    groupTetras.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material && child.material !== material) child.material.dispose();
    });
    scene.remove(groupTetras);
    groupTetras = null;
  }
  tetraObjects.forEach(o => {
    if (o.edge) {
      if (o.edge.geometry) o.edge.geometry.dispose();
      if (o.edge.material) o.edge.material.dispose();
    }
  });
  tetraObjects = [];
  if (material) {
    material.dispose();
    material = null;
  }
  if (ground) {
    scene.remove(ground);
    if (ground.geometry) ground.geometry.dispose();
    if (ground.material) ground.material.dispose();
    ground = null;
  }
  geom = null;
}

/* --- Sierpinski 3D (tetrahedra) --- */
function buildSierpinski3D(level, colorHex) {
  const s = 1.6;
  const h = Math.sqrt(2 / 3) * s;
  const A = new THREE.Vector3(0, h * 0.5, 0);
  const B = new THREE.Vector3(-s / 2, -h * 0.5, s * (Math.sqrt(3) / 6));
  const C = new THREE.Vector3(s / 2, -h * 0.5, s * (Math.sqrt(3) / 6));
  const D = new THREE.Vector3(0, -h * 0.5, -s * (Math.sqrt(3) / 3));

  const tetras = [];
  subdivideTetra(A, B, C, D, level, tetras);

  const centroids = [];
  const allVerts = [];
  for (let i = 0; i < tetras.length; i++) {
    const [a, b, c, d] = tetras[i];
    const centroid = new THREE.Vector3().addVectors(a, b).add(c).add(d).multiplyScalar(1 / 4);
    centroids.push(centroid);
    allVerts.push(a.clone(), b.clone(), c.clone(), d.clone());
  }

  const center = new THREE.Vector3();
  centroids.forEach(ct => center.add(ct));
  center.multiplyScalar(1 / Math.max(1, centroids.length));

  let maxDist = 0;
  let minY = Infinity;
  allVerts.forEach(v => {
    maxDist = Math.max(maxDist, v.distanceTo(center));
    minY = Math.min(minY, v.y);
  });

  material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.5 });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x071a0f });
  groupTetras = new THREE.Group();
  tetraObjects = [];

  for (let i = 0; i < tetras.length; i++) {
    const [a, b, c, d] = tetras[i];
    const centroid = centroids[i];

    const faces = [
      [a, b, c],
      [a, c, d],
      [a, d, b],
      [b, d, c]
    ];

    const triCount = faces.length;
    const positions = new Float32Array(triCount * 3 * 3);
    let off = 0;
    for (let f = 0; f < faces.length; f++) {
      const face = faces[f];
      for (let v = 0; v < 3; v++) {
        const rv = new THREE.Vector3().subVectors(face[v], centroid);
        positions[off++] = rv.x;
        positions[off++] = rv.y;
        positions[off++] = rv.z;
      }
    }

    const geomT = new THREE.BufferGeometry();
    geomT.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geomT.computeVertexNormals();

    const meshT = new THREE.Mesh(geomT, material);
    meshT.castShadow = true;
    meshT.receiveShadow = false;
    meshT.position.copy(centroid);

    const edgesGeom = new THREE.EdgesGeometry(geomT);
    const edgeLine = new THREE.LineSegments(edgesGeom, lineMat);
    edgeLine.visible = params.showEdges;
    meshT.add(edgeLine);

    groupTetras.add(meshT);

    const dir = new THREE.Vector3().subVectors(centroid, center);
    const dist = dir.length();
    if (dist > 0.0001) dir.normalize();
    else dir.set(0, 1, 0);

    tetraObjects.push({
      mesh: meshT,
      originalPosition: centroid.clone(),
      dir: dir.clone(),
      dist,
      edge: edgeLine
    });
  }

  scene.add(groupTetras);

  geom = {
    boundingSphere: { center: center.clone(), radius: maxDist },
    boundingBox: { min: new THREE.Vector3(-1, minY, -1), max: new THREE.Vector3(1, maxDist, 1) }
  };

  const planeSize = Math.max(6, maxDist * 6);
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
  const elapsed = clock.getElapsedTime();

  if (groupTetras) groupTetras.rotation.y += delta * params.rotationSpeed;

  if (params.explode && tetraObjects.length) {
    const t = (Math.sin(elapsed * params.explodeSpeed * Math.PI * 2) + 1) * 0.5;
    tetraObjects.forEach(o => {
      const offset = t * params.explodeAmount * (1 + o.dist);
      const newPos = new THREE.Vector3().copy(o.originalPosition).addScaledVector(o.dir, offset);
      o.mesh.position.copy(newPos);
    });
  } else {
    tetraObjects.forEach(o => {
      o.mesh.position.copy(o.originalPosition);
    });
  }

  // sync edges rotation if you rotate group; edges are children of each mesh so they follow automatically

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
