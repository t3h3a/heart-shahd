console.clear();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.z = 700;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const PARTICLE_COUNT = 1400;
const COLOR = 0xee5282;
const particlesVerts = [];
let pointsMesh, positions;

function sampleTextPoints(text, w, h, step = 4, fontScale = 0.6) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  octx.clearRect(0,0,w,h);
  octx.fillStyle = '#fff';
  const fontSize = Math.floor(h * fontScale);
  octx.font = `bold ${fontSize}px Arial`;
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillText(text, w/2, h/2);
  const img = octx.getImageData(0,0,w,h).data;
  const pts = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      if (img[idx+3] > 150) pts.push({ x: x - w/2, y: h/2 - y });
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
  const material = new THREE.PointsMaterial({
    size: Math.max(2.2, (window.innerWidth / 900)),
    color: COLOR,
    transparent: true,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });

  pointsMesh = new THREE.Points(geometry, material);
  scene.add(pointsMesh);
}

function computeTargets() {
  const heartRaw = sampleHeartPoints(PARTICLE_COUNT);

  // ✅ التعديل الجديد لضبط الحجم والموقع على جميع الأجهزة
  let scaleBase = Math.min(window.innerWidth, window.innerHeight);
  let scaleFactor = 1.3;

  if (window.innerWidth < 600) scaleFactor = 0.6;
  else if (window.innerWidth < 1000) scaleFactor = 0.9;
  else scaleFactor = 1.2;

  const scale = scaleBase / 36 * scaleFactor * 0.8;

  const heartTargets = heartRaw.map(p => {
    return new THREE.Vector3(p.x * scale, p.y * scale - 100, (Math.random()-0.5)*80);
  });

  const nameW = Math.max(380, Math.floor(window.innerWidth * 0.7));
  let nameH = Math.max(120, Math.floor(window.innerHeight * 0.18));
  const phraseW = Math.max(500, Math.floor(window.innerWidth * 0.9));
  let phraseH = Math.max(120, Math.floor(window.innerHeight * 0.18));

  if (window.innerWidth < 800) {
    nameH *= 0.6;
    phraseH *= 0.6;
  }

  const nameRaw = sampleTextPoints('Laura', nameW, nameH, 4, 0.72);
  const nameTargets = nameRaw.map(r => new THREE.Vector3(r.x, r.y - 20, (Math.random()-0.5)*40));

  const phraseRaw = sampleTextPoints('I MISS YOU LAURA', phraseW, phraseH, 4, 0.5);
  const phraseTargets = phraseRaw.map(r => new THREE.Vector3(r.x, r.y - 40, (Math.random()-0.5)*40));

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
        particlesVerts[i].target = new THREE.Vector3(t.x, t.y - 50, t.z);
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
        particlesVerts[i].target = new THREE.Vector3(pt.x + 120, pt.y - 50, pt.z);
      }
    },
    onUpdate: moveToTargets
  });

  tl.to({}, { duration: 1.6 });
}

function moveToTargets() {
  for (let i=0;i<PARTICLE_COUNT;i++) {
    const v = particlesVerts[i];
    if (!v.target) continue;
    v.x += (v.target.x - v.x) * 0.08;
    v.y += (v.target.y - v.y) * 0.08;
    v.z += (v.target.z - v.z) * 0.08;
    positions[i*3] = v.x;
    positions[i*3+1] = v.y;
    positions[i*3+2] = v.z;
  }
  pointsMesh.geometry.attributes.position.needsUpdate = true;
}

function updatePositions() {
  for (let i=0;i<PARTICLE_COUNT;i++) {
    positions[i*3] = particlesVerts[i].x;
    positions[i*3+1] = particlesVerts[i].y;
    positions[i*3+2] = particlesVerts[i].z;
  }
  pointsMesh.geometry.attributes.position.needsUpdate = true;
}

buildParticles();
targets = computeTargets();
startSequence();

gsap.to(scene.rotation, { y: 0.35, duration: 6, repeat: -1, yoyo: true, ease: "sine.inOut" });

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// ✅ تشغيل الموسيقى بعد أول لمسة
const audio = document.getElementById('bgMusic');
audio.volume = 0.4;
document.addEventListener("click", () => {
  audio.play().catch(() => {});
}, { once: true });
