import * as THREE from 'three';

let camera, scene, renderer, uniforms;
const mouse = new THREE.Vector2(0.5, 0.5);

init();

function init() {
  const canvas = document.getElementById('bg-canvas');

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(camera);

  const geometry = new THREE.PlaneGeometry(2, 2);

  const loader = new THREE.TextureLoader();
  const texture = loader.load('assets/bg-img/orchid-bg-transparent.png');
  const backgroundTexture = loader.load('assets/bg-img/orchid-bg-purple.png'); // replace with your path

  uniforms = {
    uTime: { value: 0.0 },
    uTexture: { value: texture },
    uBackgroundTexture: { value: backgroundTexture },
    uMouse: { value: mouse },
    uGridSize: { value: 40 },
    uStrength: { value: 1.5 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `

    vec3 hueShift(vec3 color, float hue) {
        const mat3 toYIQ = mat3(
            0.299,  0.587,  0.114,
            0.596, -0.274, -0.322,
            0.211, -0.523,  0.312
        );
        const mat3 toRGB = mat3(
            1.0,  0.956,  0.621,
            1.0, -0.272, -0.647,
            1.0, -1.106,  1.703
        );
        vec3 yiq = toYIQ * color;
        float originalHue = atan(yiq.z, yiq.y);
        float chroma = length(yiq.yz);
        float newHue = originalHue + hue;
        yiq.yz = chroma * vec2(cos(newHue), sin(newHue));
        return toRGB * yiq;
    }

    precision mediump float;
    varying vec2 vUv;
    
    uniform sampler2D uTexture;
    uniform sampler2D uBackgroundTexture; 
    uniform float uGridSize;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform vec2 uResolution;
    uniform float uStrength;
    
    // Random hash
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    void main() {
        vec2 uv = vUv;
    
        // Calculate tile grid
        // vec2 gridUV = floor(uv * uGridSize);
    
        // Random delay per tile
       // float delay = hash(gridUV) * 2.7; // max 3 sec delay
        //float reveal = smoothstep(delay, delay + 0.1, uTime);
    
        // Pixel distortion (based on mouse)
        vec2 grid = floor(uv * uGridSize) / uGridSize;
        float dist = distance(grid, uMouse);
        float strength = uStrength * (1.0 - smoothstep(0.0, 0.5, dist));
        vec2 offset = (uv - grid) * strength;
    
        vec4 color = texture2D(uTexture, uv - offset);
        vec4 bg = texture2D(uBackgroundTexture, uv); // Add this line


// Animate hue over time (speed = 40.1 radians/sec)
// float hueAmount = uTime * 0.5;
// vec3 shifted = hueShift(color.rgb, hueAmount);

// vec3 finalColor = mix(bg.rgb, shifted, reveal);
// vec3 finalColor = shifted;
vec3 finalColor = color.rgb;

gl_FragColor = vec4(finalColor, color.a);

    }
    
    
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  window.addEventListener('resize', onResize, false);
  window.addEventListener('mousemove', onMouseMove, false);
}

function onResize() {
  uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
  mouse.x = event.clientX / window.innerWidth;
  mouse.y = 1.0 - event.clientY / window.innerHeight;
  uniforms.uMouse.value = mouse;
}



let startTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = (performance.now() - startTime) / 1000;
  uniforms.uTime.value = elapsed;
  renderer.render(scene, camera);
}


animate();
