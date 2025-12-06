import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js";

// --------------------------------------------------
// SCENE SETUP
// --------------------------------------------------

const container = document.getElementById("bubble-container");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  25,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.z = 24;

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("webgl"),
  antialias: true,
  alpha: true
});
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Better lighting for glass
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// --------------------------------------------------
// LIGHTING
// --------------------------------------------------

const ambientLight = new THREE.AmbientLight(0xffffff, 1.7);
scene.add(ambientLight);

const spotLight = new THREE.SpotLight(0xffffff, 4.6);
spotLight.position.set(5, 15, 21);
spotLight.castShadow = true;
scene.add(spotLight);

const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
directionalLight1.position.set(0, -4, 0);
scene.add(directionalLight1);



// --------------------------------------------------
//fluid
// --------------------------------------------------

 

// --------------------------------------------------
// GLASS MATERIAL
// --------------------------------------------------

const material = new THREE.MeshPhysicalMaterial({
  // base glass
  color: 0x6b6b6b,
  metalness: 0.6,
  roughness: 0.02,
  transmission: 1.0, 
  transparent: true,
  opacity: 1.0,
  thickness: 1.8,
  ior:4.45,

  // reflections
  envMapIntensity: 16.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.02,
 
  iridescence: 1.0,                // 0–1, strength of iridescence
  iridescenceIOR: 1.9,             // index of refraction for the film
  iridescenceThicknessRange: [100, 400] // nm; controls rainbow banding
});





// --------------------------------------------------
// BUBBLE GENERATION SYSTEM
// --------------------------------------------------

const spheres = [];
const group = new THREE.Group();
scene.add(group);

const BUBBLE_COUNT = 160;
const MIN_RADIUS = 0.4;
const MAX_RADIUS = 1.8;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function generateBubbles() {
  // Remove old
  spheres.forEach((s) => group.remove(s));
  spheres.length = 0;

  const w = container.clientWidth;
  const h = container.clientHeight;

  const scaleX = (w / window.innerWidth) * 12;
  const scaleY = (h / window.innerHeight) * 12;

  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const radius = rand(MIN_RADIUS, MAX_RADIUS);
    const pos = {
      x: rand(-scaleX, scaleX),
      y: rand(-scaleY, scaleY),
      z: rand(-3, 3)
    };

    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const sphere = new THREE.Mesh(geometry, material);

    sphere.position.set(pos.x, pos.y, pos.z);
    sphere.castShadow = true;
    sphere.receiveShadow = true;

    sphere.userData = {
      originalPosition: { ...pos },
      radius
    };

    spheres.push(sphere);
    group.add(sphere);
  }
}

generateBubbles();

// --------------------------------------------------
// INTERACTION + PHYSICS
// --------------------------------------------------

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tempVector = new THREE.Vector3();
const forces = new Map();

function onMouseMove(event) {
  const rect = container.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObjects(spheres);

  if (hit.length > 0) {
    const s = hit[0].object;
    const force = new THREE.Vector3();

    force
      .subVectors(hit[0].point, s.position)
      .normalize()
      .multiplyScalar(0.25);

    forces.set(s.uuid, force);
  }
}

window.addEventListener("mousemove", onMouseMove);

// --------------------------------------------------
// COLLISIONS
// --------------------------------------------------

function handleCollisions() {
  for (let i = 0; i < spheres.length; i++) {
    for (let j = i + 1; j < spheres.length; j++) {
      const A = spheres[i];
      const B = spheres[j];

      const rA = A.userData.radius;
      const rB = B.userData.radius;

      const dist = A.position.distanceTo(B.position);
      const minDist = (rA + rB) * 1.15;

      if (dist < minDist) {
        tempVector.subVectors(B.position, A.position).normalize();

        const push = (minDist - dist) * 0.5;
        A.position.addScaledVector(tempVector, -push);
        B.position.addScaledVector(tempVector, push);
      }
    }
  }
}

// --------------------------------------------------
// ANIMATION LOOP
// --------------------------------------------------

const breathingAmplitude = 0.1;
const breathingSpeed = 0.002;

function animate() {
  requestAnimationFrame(animate);

  const t = Date.now() * breathingSpeed;

  spheres.forEach((sphere, i) => {
    const offset = i * 0.2;

    const breathingY = Math.sin(t + offset) * breathingAmplitude;
    const breathingZ = Math.cos(t + offset) * breathingAmplitude * 0.5;

    // Hover force
    const f = forces.get(sphere.uuid);
    if (f) {
      sphere.position.add(f);
      f.multiplyScalar(0.9);
      if (f.length() < 0.01) forces.delete(sphere.uuid);
    }

    // Return to ideal position + breathing motion
    const origin = sphere.userData.originalPosition;
    tempVector.set(origin.x, origin.y + breathingY, origin.z + breathingZ);
    sphere.position.lerp(tempVector, 0.02);
  });

  handleCollisions();
  renderer.render(scene, camera);
}

animate();

// --------------------------------------------------
// HANDLE RESIZE
// --------------------------------------------------

window.addEventListener("resize", () => {
  const w = container.clientWidth;
  const h = container.clientHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);

  generateBubbles();
});

