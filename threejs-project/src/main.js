import * as THREE from 'three';
import './style.css';

const container = document.getElementById('app');

/* scena, kamera, renderer */
const scene = new THREE.Scene();

const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 100);
camera.position.set(2, 2, 4);
camera.lookAt(0, 0, 0);

scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

/* sześcian */
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x4488ff, metalness: 0.2, roughness: 0.6 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

/* oświetlenie */
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(5, 5, 5);
scene.add(dir);

/* resize */
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/* animacja */
const clock = new THREE.Clock();
function tick() {
  const delta = clock.getDelta();
  cube.rotation.x += delta * 0.8;
  cube.rotation.y += delta * 1.2;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
