console.clear();

// Mobile device detection and optimization
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
const isRedmiA2 = /Redmi A2|M2101K9G/i.test(navigator.userAgent);

// Performance settings based on device
const PERFORMANCE_SETTINGS = {
  particleCount: isMobile ? (isLowEnd || isRedmiA2 ? 800 : 1000) : 1400,
  pixelRatio: isMobile ? (window.devicePixelRatio > 1 ? 1.5 : 1) : (window.devicePixelRatio > 1 ? 2 : 1),
  antialias: !isMobile || !isLowEnd,
  powerPreference: isMobile ? 'low-power' : 'high-performance'
};

// Loading screen management
const loadingEl = document.getElementById('loading');
const touchHintEl = document.getElementById('touchHint');

function hideLoading() {
  if (loadingEl) {
    loadingEl.classList.add('hidden');
    setTimeout(() => {
      if (loadingEl.parentNode) {
        loadingEl.parentNode.removeChild(loadingEl);
      }
    }, 500);
  }
}

// Scene setup with mobile optimizations
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.z = 700;

const renderer = new THREE.WebGLRenderer({ 
  antialias: PERFORMANCE_SETTINGS.antialias, 
  alpha: true,
  powerPreference: PERFORMANCE_SETTINGS.powerPreference,
  preserveDrawingBuffer: false,
  failIfMajorPerformanceCaveat: false
});

renderer.setPixelRatio(PERFORMANCE_SETTINGS.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);

// Mobile-specific renderer settings
if (isMobile) {
  renderer.shadowMap.enabled = false;
  renderer.autoClear = true;
  renderer.sortObjects = false;
}

document.body.appendChild(renderer.domElement);

// Optimized resize handler with debouncing
let resizeTimeout;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    
    // Recompute targets for new screen size
    targets = computeTargets();
    
    // Restart animation sequence with new targets
    startSequence();
  }, 100);
}

window.addEventListener('resize', handleResize, { passive: true });

// Handle orientation change
window.addEventListener('orientationchange', () => {
  setTimeout(handleResize, 500);
}, { passive: true });

const PARTICLE_COUNT = PERFORMANCE_SETTINGS.particleCount;
const COLOR = 0xee5282;
const particlesVerts = [];
let pointsMesh, positions;

// Performance monitoring
let frameCount = 0;
let lastTime = performance.now();
let fps = 60;

function updateFPS() {
  frameCount++;
  const currentTime = performance.now();
  if (currentTime - lastTime >= 1000) {
    fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
    frameCount = 0;
    lastTime = currentTime;
    
    // Adjust quality based on FPS
    if (fps < 30 && PARTICLE_COUNT > 600) {
      console.log('Reducing particles for better performance');
    }
  }
}

function sampleTextPoints(text, w, h, step = 4, fontScale = 0.6) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  
  // Mobile optimization: reduce canvas size for better performance
  const scaleFactor = isMobile ? 0.8 : 1;
  const scaledW = Math.floor(w * scaleFactor);
  const scaledH = Math.floor(h * scaleFactor);
  
  octx.clearRect(0, 0, scaledW, scaledH);
  octx.fillStyle = '#fff';
  const fontSize = Math.floor(scaledH * fontScale);
  octx.font = `bold ${fontSize}px Arial`;
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillText(text, scaledW/2, scaledH/2);
  
  const img = octx.getImageData(0, 0, scaledW, scaledH).data;
  const pts = [];
  const adjustedStep = isMobile ? Math.max(step, 6) : step;
  
  for (let y = 0; y < scaledH; y += adjustedStep) {
    for (let x = 0; x < scaledW; x += adjustedStep) {
      const idx = (y * scaledW + x) * 4;
      if (img[idx+3] > 150) {
        pts.push({ 
          x: (x - scaledW/2) / scaleFactor, 
          y: (scaledH/2 - y) / scaleFactor 
        });
      }
    }
  }
  return pts;
}

function sampleHeartPoints(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = Math.random() * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
    pts.push({ x, y });
  }
  return pts;
}

function buildParticles() {
  if (pointsMesh) scene.remove(pointsMesh);
  particlesVerts.length = 0;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const vx = (Math.random() - 0.5) * window.innerWidth;
    const vy = (Math.random() - 0.5) * window.innerHeight;
    const vz = (Math.random() - 0.5) * 400;
    particlesVerts.push(new THREE.Vector3(vx, vy, vz));
  }

  positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i*3] = particlesVerts[i].x;
    positions[i*3+1] = particlesVerts[i].y;
    positions[i*3+2] = particlesVerts[i].z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  // Dynamic particle size based on device performance
  const baseSize = isMobile ? 
    (isRedmiA2 ? 1.8 : 2.0) : 
    Math.max(2.2, (window.innerWidth / 900));

  const material = new THREE.PointsMaterial({
    size: baseSize,
    color: COLOR,
    transparent: true,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: !isMobile // Disable size attenuation on mobile for better performance
  });

  pointsMesh = new THREE.Points(geometry, material);
  scene.add(pointsMesh);
}

function computeTargets() {
  const heartRaw = sampleHeartPoints(PARTICLE_COUNT);

  // Enhanced responsive scaling for all screen sizes
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;
  const aspectRatio = width / height;
  const minDimension = Math.min(width, height);
  const maxDimension = Math.max(width, height);
  
  // Smart heart scaling based on screen size and orientation
  let heartScale;
  if (isLandscape) {
    // Landscape mode: use height as base
    if (height <= 400) {
      heartScale = height * 0.35;
    } else if (height <= 600) {
      heartScale = height * 0.4;
    } else if (height <= 800) {
      heartScale = height * 0.45;
    } else {
      heartScale = height * 0.5;
    }
  } else {
    // Portrait mode: use width as base
    if (width <= 320) {
      heartScale = width * 0.5;
    } else if (width <= 375) {
      heartScale = width * 0.55;
    } else if (width <= 414) {
      heartScale = width * 0.6;
    } else if (width <= 768) {
      heartScale = width * 0.65;
    } else {
      heartScale = width * 0.7;
    }
  }
  
  // Apply base scale factor (heart formula scale)
  const scale = heartScale / 36;
  
  // Heart vertical position - centered with smart offset
  let heartYOffset = 0;
  if (isLandscape) {
    heartYOffset = height * 0.1;
  } else {
    if (height <= 600) {
      heartYOffset = -height * 0.05;
    } else if (height <= 800) {
      heartYOffset = height * 0.05;
    } else {
      heartYOffset = height * 0.1;
    }
  }

  const heartTargets = heartRaw.map(p => {
    const zOffset = isMobile ? (Math.random()-0.5)*40 : (Math.random()-0.5)*80;
    return new THREE.Vector3(p.x * scale, p.y * scale + heartYOffset, zOffset);
  });

  // Smart text sizing - adaptive to screen size
  let nameW, nameH, phraseW, phraseH;
  let nameFontScale, phraseFontScale;
  
  if (isLandscape) {
    // Landscape mode
    nameW = Math.max(200, Math.floor(width * 0.25));
    nameH = Math.max(60, Math.floor(height * 0.25));
    phraseW = Math.max(300, Math.floor(width * 0.35));
    phraseH = Math.max(50, Math.floor(height * 0.2));
    
    if (height <= 400) {
      nameFontScale = 0.75;
      phraseFontScale = 0.55;
    } else if (height <= 600) {
      nameFontScale = 0.85;
      phraseFontScale = 0.6;
    } else {
      nameFontScale = 0.9;
      phraseFontScale = 0.65;
    }
  } else {
    // Portrait mode
    nameW = Math.max(250, Math.floor(width * 0.75));
    nameH = Math.max(70, Math.floor(height * 0.12));
    phraseW = Math.max(350, Math.floor(width * 0.85));
    phraseH = Math.max(60, Math.floor(height * 0.1));
    
    if (width <= 320) {
      nameFontScale = 0.75;
      phraseFontScale = 0.5;
    } else if (width <= 375) {
      nameFontScale = 0.8;
      phraseFontScale = 0.55;
    } else if (width <= 414) {
      nameFontScale = 0.85;
      phraseFontScale = 0.6;
    } else if (width <= 768) {
      nameFontScale = 0.9;
      phraseFontScale = 0.65;
    } else {
      nameFontScale = 0.95;
      phraseFontScale = 0.7;
    }
  }

  // Text sampling step - adaptive based on screen size
  const textStep = isMobile ? 
    (minDimension <= 360 ? 7 : minDimension <= 480 ? 6 : 5) : 
    4;

  const nameRaw = sampleTextPoints('Shahd', nameW, nameH, textStep, nameFontScale);
  const nameTargets = nameRaw.map(r => {
    const zOffset = isMobile ? (Math.random()-0.5)*20 : (Math.random()-0.5)*40;
    // Position name above heart
    let nameYPos;
    if (isLandscape) {
      nameYPos = heartYOffset + heartScale * 0.6;
    } else {
      nameYPos = heartYOffset + heartScale * 0.5;
    }
    return new THREE.Vector3(r.x, r.y + nameYPos, zOffset);
  });

  const phraseRaw = sampleTextPoints('I LOVE YOU SHAHD', phraseW, phraseH, textStep, phraseFontScale);
  const phraseTargets = phraseRaw.map(r => {
    const zOffset = isMobile ? (Math.random()-0.5)*20 : (Math.random()-0.5)*40;
    // Position phrase below name
    let phraseYPos;
    if (isLandscape) {
      phraseYPos = heartYOffset + heartScale * 0.6 + nameH * 0.6;
    } else {
      phraseYPos = heartYOffset + heartScale * 0.5 + nameH * 0.5;
    }
    return new THREE.Vector3(r.x, r.y + phraseYPos, zOffset);
  });

  return { heartTargets, nameTargets, phraseTargets };
}

let targets = computeTargets();
let tl;

function startSequence() {
  if (tl) tl.kill();
  tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });

  tl.to(particlesVerts, {
    duration: 1.2,
    ease: "power1.out",
    onStart: () => {
      for (let v of particlesVerts) {
        v.x = (Math.random() - 0.5) * window.innerWidth;
        v.y = (Math.random() - 0.5) * window.innerHeight;
        v.z = (Math.random() - 0.5) * 400;
      }
    },
    onUpdate: updatePositions
  });

  tl.to({}, { duration: 0.6 });

  tl.to(particlesVerts, {
    duration: 3,
    ease: "power2.inOut",
    onStart: () => {
      for (let i=0;i<PARTICLE_COUNT;i++) {
        particlesVerts[i].target = targets.heartTargets[i % targets.heartTargets.length];
      }
    },
    onUpdate: moveToTargets
  });

  tl.to({}, { duration: 1 });

  tl.to(particlesVerts, {
    duration: 0.6,
    ease: "power2.out",
    onStart: () => {
      for (let v of particlesVerts) {
        const ang = Math.random()*Math.PI*2;
        const dist = 200 + Math.random()*400;
        v.target = new THREE.Vector3(v.x + Math.cos(ang)*dist, v.y + Math.sin(ang)*dist, (Math.random()-0.5)*600);
      }
    },
    onUpdate: moveToTargets
  });

  tl.to({}, { duration: 0.5 });

  tl.to(particlesVerts, {
    duration: 2.4,
    ease: "power2.inOut",
    onStart: () => {
      for (let i=0;i<PARTICLE_COUNT;i++) {
        const t = targets.nameTargets[i % targets.nameTargets.length];
        particlesVerts[i].target = new THREE.Vector3(t.x, t.y, t.z);
      }
    },
    onUpdate: moveToTargets
  });

  tl.to({}, { duration: 1 });

  tl.to(particlesVerts, {
    duration: 2.6,
    ease: "power2.inOut",
    onStart: () => {
      for (let i=0;i<PARTICLE_COUNT;i++) {
        const pt = targets.phraseTargets[i % targets.phraseTargets.length];
        particlesVerts[i].target = new THREE.Vector3(pt.x, pt.y, pt.z);
      }
    },
    onUpdate: moveToTargets
  });

  tl.to({}, { duration: 1.6 });
}

function moveToTargets() {
  // Optimized movement with performance monitoring
  const lerpSpeed = isMobile ? 0.06 : 0.08; // Slower on mobile for better performance
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const v = particlesVerts[i];
    if (!v.target) continue;
    
    v.x += (v.target.x - v.x) * lerpSpeed;
    v.y += (v.target.y - v.y) * lerpSpeed;
    v.z += (v.target.z - v.z) * lerpSpeed;
    
    positions[i*3] = v.x;
    positions[i*3+1] = v.y;
    positions[i*3+2] = v.z;
  }
  
  pointsMesh.geometry.attributes.position.needsUpdate = true;
  updateFPS(); // Monitor performance
}

function updatePositions() {
  for (let i=0;i<PARTICLE_COUNT;i++) {
    positions[i*3] = particlesVerts[i].x;
    positions[i*3+1] = particlesVerts[i].y;
    positions[i*3+2] = particlesVerts[i].z;
  }
  pointsMesh.geometry.attributes.position.needsUpdate = true;
}

// Enhanced audio handling for mobile devices
const audio = document.getElementById('bgMusic');
audio.volume = 0.4;

// Mobile-specific audio initialization
function initAudio() {
  // Preload audio for better mobile experience
  audio.load();
  
  // Handle audio context for mobile browsers
  const playAudio = () => {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Audio play failed:', error);
        // Show touch hint if audio fails
        if (touchHintEl) {
          touchHintEl.style.display = 'block';
        }
      });
    }
  };
  
  // Multiple event listeners for better mobile compatibility
  const events = ['click', 'touchstart', 'touchend'];
  events.forEach(event => {
    document.addEventListener(event, playAudio, { once: true, passive: true });
  });
  
  // Hide touch hint after successful play
  audio.addEventListener('play', () => {
    if (touchHintEl) {
      touchHintEl.classList.add('hidden');
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// Initialize everything
function init() {
  // Hide loading screen after a short delay
  setTimeout(hideLoading, 1000);
  
  // Initialize audio
  initAudio();
  
  // Start the animation sequence
  buildParticles();
  targets = computeTargets();
  startSequence();
  
  // Start scene rotation
  gsap.to(scene.rotation, { 
    y: 0.35, 
    duration: 6, 
    repeat: -1, 
    yoyo: true, 
    ease: "sine.inOut" 
  });
  
  // Start animation loop
  animate();
}

// Wait for everything to load before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}