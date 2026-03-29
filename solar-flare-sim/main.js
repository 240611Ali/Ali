import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// --- UI Elements ---
const triggerBtn = document.getElementById('trigger-flare');
const statusLed = document.getElementById('status-led');
const statusText = document.getElementById('status-text');
const windSpeed = document.getElementById('wind-speed');
const xrayFlux = document.getElementById('xray-flux');
const timeline = document.querySelector('.timeline');
const stepSun = document.getElementById('step-sun');
const stepTransit = document.getElementById('step-transit');
const stepImpact = document.getElementById('step-impact');
const impactPanel = document.getElementById('impact-panel');
const impacts = document.querySelectorAll('.impact-list li');

// --- Three.js Setup (WebXR ready) ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010103); // Deeper space black
scene.fog = new THREE.FogExp2(0x010103, 0.002);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);
// Initial wide cinematic shot
camera.position.set(25, 20, 90);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); // Disable antialias for post-processing performance
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true; // ENABLING VIRTUAL REALITY
// Enable shadow mapping
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer)); // Add physical "Enter VR" button

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 500;
controls.minDistance = 2;

// --- Post-Processing (Bloom for glowing effects) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.1;
bloomPass.strength = 1.2; 
bloomPass.radius = 0.5;

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0x111111);
scene.add(ambientLight);

// The sun is the main literal light source
const sunLight = new THREE.PointLight(0xffeedd, 5, 500);
sunLight.position.set(0, 0, 0);
sunLight.castShadow = true;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

// --- Audio (Web Audio API Synthesizer) ---
let audioCtx;
let spaceRumble, flareRattle;

function initAudio() {
    if(!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Endless deep space hum
        spaceRumble = audioCtx.createOscillator();
        const masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.05; // very quiet
        
        spaceRumble.type = 'sine';
        spaceRumble.frequency.value = 50; 
        
        spaceRumble.connect(masterGain);
        masterGain.connect(audioCtx.destination);
        spaceRumble.start();
        
        // Flare noise generator
        const bufferSize = audioCtx.sampleRate * 2; // 2 seconds buff
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; 
        }
        flareRattle = audioCtx.createBufferSource();
        flareRattle.buffer = buffer;
        flareRattle.loop = true;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 100; // Will increase during flare
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.value = 0; // Off initially
        
        flareRattle.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        flareRattle.start();
        
        // Attach to global for updates
        window.flareFilter = filter;
        window.flareGain = noiseGain;
    }
}

// --- Objects ---
const textureLoader = new THREE.TextureLoader();

// 1. The Sun
const sunGeometry = new THREE.SphereGeometry(15, 64, 64);
const sunMaterial = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xff3300,
    emissiveIntensity: 3.0, // Glows very bright because of Bloom!
    roughness: 0.8,
});
// Simple procedural bump mapping trick using normal map
textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png', (tex) => {
    sunMaterial.normalMap = tex; // Gives the sun a textured, bubbly surface look
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

const coronaGeometry = new THREE.SphereGeometry(16.5, 32, 32);
const coronaMaterial = new THREE.MeshBasicMaterial({
    color: 0xffbb00,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
});
const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
scene.add(corona);

// 2. The Earth
const earthGroup = new THREE.Group();
earthGroup.position.set(80, 0, 0); // Distance from sun
scene.add(earthGroup);

const earthGeometry = new THREE.SphereGeometry(4, 64, 64);
const earthMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.1
});

// Load photo-realistic Earth textures
textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg', (tex) => { earthMaterial.map = tex; earthMaterial.needsUpdate = true; });
textureLoader.load('https://unpkg.com/three-globe/example/img/earth-water.png', (tex) => { earthMaterial.roughnessMap = tex; earthMaterial.needsUpdate = true; });

const earth = new THREE.Mesh(earthGeometry, earthMaterial);
earth.rotation.z = 0.41; 
earth.castShadow = true;
earth.receiveShadow = true;
earthGroup.add(earth);

// Earth Clouds
const cloudsGeo = new THREE.SphereGeometry(4.05, 64, 64);
const cloudsMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
});
textureLoader.load('https://unpkg.com/three-globe/example/img/earth-clouds10k.png', (tex) => { 
    cloudsMat.alphaMap = tex; // Or map it directly
    cloudsMat.map = tex; 
});
const clouds = new THREE.Mesh(cloudsGeo, cloudsMat);
earth.add(clouds);

// 3. Magnetic Field Array
const magGeometry = new THREE.SphereGeometry(7, 32, 32);
const magMaterial = new THREE.MeshBasicMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.2, // Increased for Bloom to catch it
    blending: THREE.AdditiveBlending,
    wireframe: true
});
const magnetosphere = new THREE.Mesh(magGeometry, magMaterial);
magnetosphere.scale.x = 1.3;
earthGroup.add(magnetosphere);

// 4. Space Station (Detailed)
const stationGroup = new THREE.Group();
const bodyGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 16);
const panelGeo = new THREE.BoxGeometry(2.0, 0.05, 0.6);
const stationMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 1.0, roughness: 0.2 });
const panelMat = new THREE.MeshStandardMaterial({ color: 0x1133aa, metalness: 0.9, roughness: 0.4 });

const stationBody = new THREE.Mesh(bodyGeo, stationMat);
const stationPanels = new THREE.Mesh(panelGeo, panelMat);
stationBody.rotation.z = Math.PI / 2;
stationBody.castShadow = true;
stationPanels.castShadow = true;
stationGroup.add(stationBody);
stationGroup.add(stationPanels);

stationGroup.position.set(0, 5, 0);
earthGroup.add(stationGroup);

// --- Particle System (Flare) ---
const particleCount = 4000;
const particlesGeo = new THREE.BufferGeometry();
const posArray = new Float32Array(particleCount * 3);
const velArray = new Float32Array(particleCount * 3); 
const lifeArray = new Float32Array(particleCount); 

for(let i=0; i < particleCount * 3; i+=3) {
    posArray[i] = 0; posArray[i+1] = 0; posArray[i+2] = 0;
    velArray[i] = (Math.random() * 0.8 + 0.8); 
    velArray[i+1] = (Math.random() - 0.5) * 0.8; 
    velArray[i+2] = (Math.random() - 0.5) * 0.8; 
    lifeArray[i/3] = 0; 
}
particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
particlesGeo.setAttribute('velocity', new THREE.BufferAttribute(velArray, 3));
particlesGeo.setAttribute('life', new THREE.BufferAttribute(lifeArray, 1));

const textureDot = new THREE.TextureLoader().load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAZklEQVQYlWP4//8/Awz///8/A8P////5MCIImDFQACMezMKH4Qowxogk+w/GQJHM////L2Agy//EUBbIfTAHqwQ/TAaT////+yD//3cIyyK4AWTB//8wA2EGsQzEA4QZRDYQ5kByAADf/y4m7G36aAAAAABJRU5ErkJggg=='); // Small soft dot
const particlesMat = new THREE.PointsMaterial({
    size: 0.6,
    color: 0xffffff, // White inner core, Bloom will add colored glow around it
    map: textureDot,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const flareParticles = new THREE.Points(particlesGeo, particlesMat);
scene.add(flareParticles);

// --- Starfield ---
const starsGeo = new THREE.BufferGeometry();
const starsCount = 3000;
const starsPos = new Float32Array(starsCount * 3);
for(let i=0; i<starsCount*3; i++) { starsPos[i] = (Math.random() - 0.5) * 800; }
starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
const starsMat = new THREE.PointsMaterial({color: 0xffffff, size: 0.2, transparent: true, opacity: 0.8});
const starField = new THREE.Points(starsGeo, starsMat);
scene.add(starField);


// --- Cinematic & Animation State ---
let isFlareActive = false;
let flarePhase = 0; 
let stationAngle = 0;

// Camera targets
const camTargetIdle = new THREE.Vector3(45, 10, 80); 
const camTargetSun = new THREE.Vector3(20, 5, 30);
const camTargetTransit = new THREE.Vector3(40, -5, 40);
const camTargetEarth = new THREE.Vector3(88, 12, 15);
const currentCameraTarget = new THREE.Vector3().copy(camTargetIdle);
let cinematicMode = false; // Is camera being automated?

function triggerSolarFlare() {
    if (isFlareActive) return;
    initAudio(); // Required context resume block
    
    isFlareActive = true;
    flarePhase = 1;
    cinematicMode = true;
    
    // Switch target to Sun
    currentCameraTarget.copy(camTargetSun);

    triggerBtn.disabled = true;
    triggerBtn.innerText = "EVENT IN PROGRESS...";
    triggerBtn.style.opacity = '0.5';
    
    // UI Update Phase 1
    statusLed.className = 'led warning';
    statusText.innerText = 'WARNING - X-Class Flare Detected';
    statusText.className = 'text-yellow';
    xrayFlux.innerText = 'X3.2 (Severe)';
    xrayFlux.className = 'text-yellow';
    windSpeed.innerText = '1,250 km/s (Rising)';
    
    timeline.classList.add('active');
    stepSun.classList.add('current');
    
    // Audio FX
    if(window.flareGain) {
        window.flareGain.gain.setTargetAtTime(0.05, audioCtx.currentTime, 0.5); // Fade in rumble
        window.flareFilter.frequency.setTargetAtTime(800, audioCtx.currentTime, 1.0); // Open filter
    }
    
    // Reset particles
    const positions = flareParticles.geometry.attributes.position.array;
    const lives = flareParticles.geometry.attributes.life.array;
    
    for(let i=0; i < particleCount; i++) {
        positions[i*3] = 16;
        positions[i*3+1] = (Math.random() - 0.5) * 6;
        positions[i*3+2] = (Math.random() - 0.5) * 6;
        lives[i] = 1;
    }
    flareParticles.geometry.attributes.position.needsUpdate = true;
    flareParticles.geometry.attributes.life.needsUpdate = true;

    // Simulate phases over time
    setTimeout(() => {
        if (!isFlareActive) return;
        flarePhase = 2; // Transit
        currentCameraTarget.copy(camTargetTransit);
        controls.target.copy(new THREE.Vector3(40, 0, 0)); // Pan looking target center

        stepSun.classList.remove('current');
        stepSun.classList.add('done');
        stepTransit.classList.add('current');
        statusText.innerText = 'CRITICAL - Coronal Mass Ejection En Route';
        
        // Audio peak wind
        if(window.flareFilter) window.flareFilter.frequency.setTargetAtTime(2000, audioCtx.currentTime, 2.0);
    }, 3500);

    setTimeout(() => {
        if (!isFlareActive) return;
        flarePhase = 3; // Impact
        currentCameraTarget.copy(camTargetEarth);
        controls.target.set(80, 0, 0); // Look exactly at Earth
        controls.maxDistance = 30; // Force closer

        stepTransit.classList.remove('current');
        stepTransit.classList.add('done');
        stepImpact.classList.add('current');
        
        statusLed.className = 'led danger';
        statusText.innerText = 'IMPACT - Geomagnetic Storm G4';
        statusText.className = 'text-red';
        windSpeed.innerText = '2,800 km/s (Peak)';
        windSpeed.className = 'text-red';
        
        // Visual effects of impact
        magMaterial.opacity = 0.8;
        magMaterial.color.setHex(0xff2255); // Reddish shield piercing
        sunMaterial.emissiveIntensity = 2.0; // Rest sun
        bloomPass.strength = 1.6; // Heavy Bloom flash
        
        // Audio blast
        if(window.flareGain) {
            window.flareGain.gain.setTargetAtTime(0.15, audioCtx.currentTime, 0.1); // Impact sound
            window.flareFilter.frequency.setTargetAtTime(100, audioCtx.currentTime, 4.0); // Slow fade out
        }
        
        // Panel UI
        impactPanel.classList.add('visible');
        setTimeout(() => impacts[0].classList.add('alerted'), 500);
        setTimeout(() => impacts[1].classList.add('alerted'), 1500);
        setTimeout(() => {
            impacts[2].classList.add('alerted');
            setTimeout(resetSimulation, 8000); // Trigger cleanup
        }, 2500);
        
    }, 7500);
}

function resetSimulation() {
    isFlareActive = false;
    flarePhase = 0;
    cinematicMode = false;
    controls.maxDistance = 500;
    
    // Go back to idle viewing point
    currentCameraTarget.copy(camTargetIdle);
    controls.target.set(40, 0, 0); // Center looks halfway between sun and earth
    
    triggerBtn.disabled = false;
    triggerBtn.innerText = "INITIALIZE SCENARIO";
    triggerBtn.style.opacity = '1';
    
    statusLed.className = 'led';
    statusText.innerText = 'NOMINAL - Normal Solar Activity';
    statusText.className = '';
    xrayFlux.innerText = 'A-Class Base';
    xrayFlux.className = '';
    windSpeed.innerText = '350 km/s';
    windSpeed.className = '';
    
    timeline.classList.remove('active');
    stepSun.classList.remove('current', 'done');
    stepTransit.classList.remove('current', 'done');
    stepImpact.classList.remove('current', 'done');
    
    impactPanel.classList.remove('visible');
    impacts.forEach(el => el.classList.remove('alerted'));
    
    // Smooth fade outs
    magMaterial.color.setHex(0x44aaff);
    magMaterial.opacity = 0.2;
    bloomPass.strength = 1.2;
    
    if(window.flareGain) window.flareGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 1.0);
    
    // Kill particles
    const lives = flareParticles.geometry.attributes.life.array;
    for(let i=0; i<particleCount; i++) lives[i] = 0;
    flareParticles.geometry.attributes.life.needsUpdate = true;
}

triggerBtn.addEventListener('click', triggerSolarFlare);

// --- Main Animation Loop ---
// Use WebXR-compatible loop setter
renderer.setAnimationLoop((time) => {
    // Basic time delta mapping (simplified for setAnimationLoop)
    const dt = 0.016; // approx 60fps dt

    controls.update();
    
    // Cinematic Camera Lerping
    if(cinematicMode) {
        camera.position.lerp(currentCameraTarget, 0.03);
    }

    // Earth and clouds rotation
    earth.rotation.y += 0.2 * dt;
    clouds.rotation.y += 0.25 * dt;
    
    // Orbit Station
    stationAngle += (isFlareActive && flarePhase === 3) ? 0.3 * dt : 0.8 * dt; // Slows down under atmospheric drag
    stationGroup.position.x = Math.cos(stationAngle) * 5.5; // Orbit radius
    stationGroup.position.z = Math.sin(stationAngle) * 5.5;
    stationGroup.lookAt(earthGroup.position);

    // Sun animations
    sun.rotation.y += 0.05 * dt;
    corona.scale.setScalar(1 + Math.sin(time * 0.002) * 0.03);
    
    if (isFlareActive) {
        // Sun pulses during emission
        if(flarePhase < 3) sunMaterial.emissiveIntensity = 3.0 + Math.sin(time * 0.01) * 2.5;
        
        if (flarePhase === 1 || flarePhase === 2) {
            const positions = flareParticles.geometry.attributes.position.array;
            const velocities = flareParticles.geometry.attributes.velocity.array;
            const lives = flareParticles.geometry.attributes.life.array;
            
            for(let i=0; i < particleCount; i++) {
                if(lives[i] === 1) {
                    // Update positions
                    positions[i*3] += velocities[i*3] * dt * 45;
                    positions[i*3+1] += velocities[i*3+1] * dt * 45;
                    positions[i*3+2] += velocities[i*3+2] * dt * 45;
                    
                    // Kill if past earth (X>85ish)
                    if (positions[i*3] > 85) {
                        lives[i] = 0;
                        positions[i*3] = -1000;
                    }
                }
            }
            flareParticles.geometry.attributes.position.needsUpdate = true;
        }
        
        if (flarePhase === 3) {
            // Earth magnetosphere vibrates drastically
            magnetosphere.scale.x = 1.3 + Math.random() * 0.15;
            magnetosphere.scale.y = 1.0 + Math.random() * 0.1;
            magnetosphere.scale.z = 1.0 + Math.random() * 0.1;
            
            // Station flashes brilliant red due to radiation warning
            stationMat.emissive.setHex(Math.sin(time*0.015) > 0 ? 0xff0000 : 0x000000);
            stationMat.emissiveIntensity = 2.0; // Glows brightly with bloom
        }
        
    } else {
        sunMaterial.emissiveIntensity = 3.0;
        stationMat.emissive.setHex(0x000000);
        magnetosphere.scale.set(1.3, 1, 1);
    }

    // Render using composer so we gain the Bloom Pass
    composer.render();
});

// Resizing handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
