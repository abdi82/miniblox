// Bygger en blockig figur (Roblox-stil) i Three.js utifrån avatar-inställningarna.
import * as THREE from 'three';

const faceCache = new Map();
export function faceTexture(style, skin) {
  const key = style + skin;
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#111';
  const eye = (x, y, w = 14, h = 20) => { g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 6); g.fill(); };
  const brow = (x, y, tilt) => { g.save(); g.translate(x, y); g.rotate(tilt); g.fillRect(-14, -3, 28, 6); g.restore(); };
  g.lineWidth = 7; g.strokeStyle = '#111'; g.lineCap = 'round';
  switch (style) {
    case 'cool':
      g.fillStyle = '#111'; g.beginPath(); g.roundRect(22, 40, 34, 22, 6); g.fill(); g.beginPath(); g.roundRect(72, 40, 34, 22, 6); g.fill();
      g.fillRect(56, 46, 16, 5); g.fillRect(10, 46, 12, 5); g.fillRect(106, 46, 12, 5);
      g.beginPath(); g.moveTo(44, 90); g.quadraticCurveTo(64, 104, 84, 90); g.stroke();
      break;
    case 'surprised':
      eye(42, 50, 16, 24); eye(86, 50, 16, 24);
      g.beginPath(); g.ellipse(64, 94, 12, 15, 0, 0, Math.PI * 2); g.fill();
      break;
    case 'angry':
      eye(42, 54); eye(86, 54); brow(42, 36, 0.35); brow(86, 36, -0.35);
      g.beginPath(); g.moveTo(46, 98); g.quadraticCurveTo(64, 86, 82, 98); g.stroke();
      break;
    case 'wink':
      eye(42, 52); g.beginPath(); g.moveTo(74, 52); g.lineTo(98, 52); g.stroke();
      g.beginPath(); g.moveTo(40, 86); g.quadraticCurveTo(64, 108, 92, 84); g.stroke();
      break;
    default: // smile
      eye(42, 52); eye(86, 52);
      g.beginPath(); g.moveTo(40, 86); g.quadraticCurveTo(64, 108, 88, 86); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  faceCache.set(key, t); return t;
}

const mat = (color) => new THREE.MeshLambertMaterial({ color });

function hatMesh(id, skin) {
  const g = new THREE.Group();
  const add = (geo, color, y = 0, x = 0, z = 0, rot) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); if (rot) m.rotation.set(...rot); m.castShadow = true; g.add(m); return m; };
  switch (id) {
    case 'cap':
      add(new THREE.CylinderGeometry(0.68, 0.68, 0.35, 16), '#e2231a', 0.75);
      add(new THREE.BoxGeometry(0.9, 0.08, 0.6), '#e2231a', 0.62, 0, 0.75);
      break;
    case 'tophat':
      add(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 20), '#111', 0.65);
      add(new THREE.CylinderGeometry(0.55, 0.6, 1.0, 20), '#111', 1.2);
      add(new THREE.CylinderGeometry(0.57, 0.62, 0.15, 20), '#e2231a', 0.78);
      break;
    case 'crown': {
      add(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 8), '#f5b400', 0.78);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(0.14, 0.4, 4), '#f5b400', 1.12, Math.cos(a) * 0.55, Math.sin(a) * 0.55); }
      add(new THREE.SphereGeometry(0.1, 8, 8), '#e2231a', 0.9, 0, 0.6);
      break;
    }
    case 'horns':
      add(new THREE.ConeGeometry(0.16, 0.6, 8), '#b3261e', 0.85, -0.45, 0, [0, 0, 0.5]);
      add(new THREE.ConeGeometry(0.16, 0.6, 8), '#b3261e', 0.85, 0.45, 0, [0, 0, -0.5]);
      break;
    case 'halo':
      add(new THREE.TorusGeometry(0.55, 0.07, 10, 24), '#ffe680', 1.2, 0, 0, [Math.PI / 2, 0, 0]);
      break;
    case 'party':
      add(new THREE.ConeGeometry(0.4, 1.1, 16), '#9b51e0', 1.1);
      add(new THREE.SphereGeometry(0.12, 8, 8), '#f5b400', 1.68);
      break;
    case 'wizard':
      add(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 20), '#2b2b7a', 0.65);
      add(new THREE.ConeGeometry(0.6, 1.6, 16), '#2b2b7a', 1.4);
      add(new THREE.SphereGeometry(0.1, 8, 8), '#f5b400', 1.0, 0.35, 0.45);
      break;
  }
  return g;
}

// Proportioner som Roblox R6 (huvud 1.2, kropp 2x2x1, armar/ben 1x2x1) och sedan nedskalat.
export const AVATAR_SCALE = 0.46;
export const AVATAR_HEIGHT = 5.2 * AVATAR_SCALE; // ~2.4

export function buildAvatar(cfg) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const skin = mat(cfg.skin), shirt = mat(cfg.shirt), pants = mat(cfg.pants);
  const box = (w, h, d, m) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.castShadow = true; return mesh; };

  const legL = box(1, 2, 1, pants), legR = box(1, 2, 1, pants);
  legL.geometry.translate(0, -1, 0); legR.geometry.translate(0, -1, 0);
  legL.position.set(-0.5, 2, 0); legR.position.set(0.5, 2, 0);
  const torso = box(2, 2, 1, shirt); torso.position.y = 3;
  const armL = box(1, 2, 1, shirt), armR = box(1, 2, 1, shirt);
  armL.geometry.translate(0, -1, 0); armR.geometry.translate(0, -1, 0);
  armL.position.set(-1.5, 4, 0); armR.position.set(1.5, 4, 0);
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTexture(cfg.face, cfg.skin) });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), [skin, skin, skin, skin, faceMat, skin]);
  head.castShadow = true; head.position.y = 4.6;
  const hat = hatMesh(cfg.hat, cfg.skin); hat.position.y = 4.6; head.add(hat); hat.position.y = 0;
  body.add(legL, legR, torso, armL, armR, head);
  root.scale.setScalar(AVATAR_SCALE);
  root.userData = { legL, legR, armL, armR, body, head };
  return root;
}

// Enkel gånganimation
export function animateAvatar(root, t, moving, airborne, flying = false) {
  const { legL, legR, armL, armR, body } = root.userData;
  if (flying) { // superman: armarna rakt fram, benen bakåt, kroppen lutad
    armL.rotation.x = armR.rotation.x = -3.0; legL.rotation.x = legR.rotation.x = 0.4; body.rotation.x = 0.9; body.position.y = 1.2 + Math.sin(t * 4) * 0.15;
    return;
  }
  body.rotation.x = 0;
  if (airborne) {
    armL.rotation.x = armR.rotation.x = -2.6; legL.rotation.x = 0.3; legR.rotation.x = -0.3; body.position.y = 0;
    return;
  }
  const s = moving ? Math.sin(t * 11) : 0;
  legL.rotation.x = s * 0.7; legR.rotation.x = -s * 0.7;
  armL.rotation.x = -s * 0.7; armR.rotation.x = s * 0.7;
  body.position.y = moving ? Math.abs(Math.cos(t * 11)) * 0.12 : 0;
}
