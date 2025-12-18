import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js";


// --------------------------------------------------
// DEVICE / PERFORMANCE FLAGS
// --------------------------------------------------

// Basic heuristic: small screen or coarse pointer => treat as mobile
const IS_MOBILE = window.matchMedia(
  "(max-width: 768px), (pointer: coarse)"
).matches;
 
const MOBILE_BUBBLE_COUNT = 100;
const DESKTOP_BUBBLE_COUNT = 160;

const MOBILE_SEGMENTS = 36;   // sphere segments on mobile
const DESKTOP_SEGMENTS = 64;  // sphere segments on desktop

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
  antialias: !IS_MOBILE, // skip antialias on mobile for a bit more speed
  alpha: true
});

renderer.setSize(container.clientWidth, container.clientHeight);

// cap pixel ratio on mobile so GPUs don’t die at 3x scale
const maxMobilePixelRatio = 1.5;
renderer.setPixelRatio(
  IS_MOBILE
    ? Math.min(maxMobilePixelRatio, window.devicePixelRatio || 1)
    : window.devicePixelRatio || 1
);

// shadows are expensive – disable them on mobile
renderer.shadowMap.enabled = !IS_MOBILE;
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
spotLight.castShadow = !IS_MOBILE; // no shadows on mobile
scene.add(spotLight);

const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
directionalLight1.position.set(0, -4, 0);
scene.add(directionalLight1);

// --------------------------------------------------
// GLASS MATERIAL
// --------------------------------------------------

const material = new THREE.MeshPhysicalMaterial({
  // base glass
  color: 0x6b6b6b,
  metalness: 0.6, 
  transmission: 1.0,
  transparent: true,
  opacity: 1.0, 
  clearcoat: 1.0, 
});

// --------------------------------------------------
// BUBBLE GENERATION SYSTEM
// --------------------------------------------------

const spheres = [];
const group = new THREE.Group();
scene.add(group);

// use lower bubble count on mobile
const BUBBLE_COUNT = IS_MOBILE ? MOBILE_BUBBLE_COUNT : DESKTOP_BUBBLE_COUNT;
const MIN_RADIUS = 0.4;
const MAX_RADIUS = 1.8;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function generateBubbles() {
  // Remove old
  spheres.forEach((s) => {
    s.geometry.dispose();
    group.remove(s);
  });
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

    // lower segment count on mobile to reduce geometry cost
    const widthSegments = IS_MOBILE ? MOBILE_SEGMENTS : DESKTOP_SEGMENTS;
    const heightSegments = IS_MOBILE ? MOBILE_SEGMENTS : DESKTOP_SEGMENTS;

    const geometry = new THREE.SphereGeometry(
      radius,
      widthSegments,
      heightSegments
    );
    const sphere = new THREE.Mesh(geometry, material);

    sphere.position.set(pos.x, pos.y, pos.z);
    sphere.castShadow = !IS_MOBILE;
    sphere.receiveShadow = !IS_MOBILE;

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

// On mobile the pointer may be touch; you can also attach to "pointermove"
// For simplicity we keep mousemove – mobile browsers synthesize mouse events
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
      const minDist = (rA + rB) * 1.35;

      if (dist < minDist) {
        tempVector.subVectors(B.position, A.position).normalize();

        const push = (minDist - dist) * 0.7;
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
let frameIndex = 0;

function animate() {
  requestAnimationFrame(animate);

  frameIndex++;

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

  // On mobile, run collisions every 2nd frame to cut cost ~in half
  if (!IS_MOBILE || frameIndex % 2 === 0) {
    handleCollisions();
  }

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
