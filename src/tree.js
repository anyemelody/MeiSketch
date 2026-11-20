const BRANCH_COUNT = 200;
const ROOT_WEIGHT = 0.027;

// Same hashes as the shader, so the tree keeps the look of the GLSL fractal tree.
const fract = (x) => x - Math.floor(x);
const random = (x) => fract(Math.sin(x) * 100);
const random2D = (x, y) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123);

const DAMPING_RATIO = 0.15;
const PUSH_RADIUS = 0.07;
const PUSH_STRENGTH = 0.8;
const BREEZE_STRENGTH = 0.1;
// How much a child lags behind when its parent accelerates.
const BRANCH_INERTIA = 0.12;
const FLOWER_INERTIA = 0.5;
const FLOWER_OMEGA = 2 * Math.PI * 0.8;
const FLOWER_STIFFNESS = FLOWER_OMEGA * FLOWER_OMEGA;
const FLOWER_DAMPING = 2 * 0.16 * FLOWER_OMEGA;
const MAX_DEFLECTION = 0.35;
// Repeated clicks saturate here instead of whipping the branch further each time.
const MAX_SWAY = 0.16;
const REST_THRESHOLD = 6e-4;

const PETAL_COUNT = 5;
const PETAL_DISTANCE = 0.013;
const MAX_FALLING = 32;
const SHAKE_RADIUS = 0.12;
// Seconds a flower remembers a shake, so only clicks in quick succession add up.
const SHAKE_MEMORY = 2;
const SHED_THRESHOLD = 2;
const SHED_RATE = 0.5;
const PETAL_GRAVITY = 0.2;
const PETAL_FLUTTER = 0.2;
// Seconds for a new bud to swell and open, and for a bare flower to wither away.
const BLOOM_SECONDS = 14;
const WITHER_SECONDS = 3;
const BLOOM_INTERVAL = [4, 9];
// How many flowers may open on top of the ones the tree starts with.
const EXTRA_BLOOMS = 6;
const BLOOM_SPACING = 0.055;
// Share of the flower spots that are in bloom when the tree first appears.
const INITIAL_FLOWERS = 0.55;
// The tree also starts with this many buds about to open.
const INITIAL_BUDS = [1, 3];

function createTree(trunkTilt) {
  const n = BRANCH_COUNT;
  const parent = new Int16Array(n).fill(-1);
  const depth = new Uint8Array(n);
  const length = new Float64Array(n);
  const restAngle = new Float64Array(n);
  const bend = new Float64Array(n);
  const stiffness = new Float64Array(n);
  const damping = new Float64Array(n);
  const compliance = new Float64Array(n);
  const omegas = new Float64Array(n);

  const deflection = new Float64Array(n);
  const velocity = new Float64Array(n);
  const flowerDeflection = new Float64Array(n);
  const flowerVelocity = new Float64Array(n);
  const sway = new Float64Array(n);
  const acceleration = new Float64Array(n);
  const localAcceleration = new Float64Array(n);

  // Uniform arrays: segA = start, first end. segB = second end, sway, cull radius.
  // rest = rest-pose start, flower sway, flower state packed as 2 * shed petal bitmask + bloom.
  const segA = new Float32Array(n * 4);
  const segB = new Float32Array(n * 4);
  const rest = new Float32Array(n * 4);
  // Falling petals: fallA = flower's rest start, flower index, petal index.
  // fallB = position, rotation, squash. fallC = petal offset inside its flower, active flag.
  const fallA = new Float32Array(MAX_FALLING * 4);
  const fallB = new Float32Array(MAX_FALLING * 4);
  const fallC = new Float32Array(MAX_FALLING * 4);

  length[0] = 0.14;
  restAngle[0] = Math.PI * (-0.75 + (trunkTilt - 0.5) * 0.1);
  rest[0] = 1;
  rest[1] = 1;

  for (let i = 0; i < n; i++) {
    const angle = restAngle[i];
    const len = length[i];
    bend[i] = (random(i) - 0.5) * 0.2 * Math.PI;
    const x1 = rest[i * 4] + Math.cos(angle) * len;
    const y1 = rest[i * 4 + 1] + Math.sin(angle) * len;
    const x2 = x1 + Math.cos(angle + bend[i]) * len;
    const y2 = y1 + Math.sin(angle + bend[i]) * len;

    const grow = (child, childLength, childAngle, x, y) => {
      if (child >= n) return;
      parent[child] = i;
      depth[child] = depth[i] + 1;
      length[child] = childLength;
      restAngle[child] = childAngle;
      rest[child * 4] = x;
      rest[child * 4 + 1] = y;
    };

    if (i % 2 === 0) {
      const turn = (random2D(x1, y1) - random(i)) * 0.3 * Math.PI;
      grow(i + 1 + i / 2, len * (random(i) * 0.8 + 0.5), angle + turn, x1, y1);
    } else {
      const hash = random2D(x2, y2);
      const child = (i + 1) / 2 + i;
      grow(child, len * (random(i * 0.5) * 0.75 + 0.5), -Math.abs(angle) + random(i) * 0.3 * Math.PI, x2, y2);
      grow(child + 1, len * (hash + 0.5), angle - hash * 0.24 * Math.PI, x2, y2);
    }

    // Thick wood is stiff and slow, twigs are loose and a little quicker.
    const thickness = Math.pow(0.812, depth[i]);
    const hertz = (0.22 + 0.3 * (1 - thickness)) * (0.85 + 0.3 * random(i * 1.7 + 3));
    const omega = 2 * Math.PI * hertz;
    omegas[i] = omega;
    stiffness[i] = omega * omega;
    damping[i] = 2 * DAMPING_RATIO * omega;
    compliance[i] = 0.02 + 0.98 * Math.pow(1 - thickness, 2.2);
    segB[i * 4 + 3] = ROOT_WEIGHT * 1.05 * Math.pow(0.945, depth[i]) + 1e-4;
  }

  // Mirrors the flower layout in flower.frag, to know where each petal sits.
  // Every fifth node may carry a flower from the start. The other nodes are
  // empty spots where a flower can bud later.
  const flowers = [];
  for (let i = 16; i < n; i++) {
    const original = i % 5 === 0;
    const open = original && Math.random() < INITIAL_FLOWERS;
    const petalAngles = [];
    let angle = Math.PI * random(i) * 2;
    for (let k = 0; k < PETAL_COUNT; k++) {
      angle += (0.2 + random(k) * 0.1) * 2 * Math.PI;
      petalAngles.push(angle);
    }
    flowers.push({
      node: i,
      offsetX: original ? (random(rest[i * 4]) - 0.5) * 0.1 : 0,
      offsetY: original ? (random(rest[i * 4 + 1]) - 0.5) * 0.1 : 0,
      size: random(i) * 0.02 + 0.016,
      petalAngles,
      stress: 0,
      shakenAt: 0,
      shed: 0,
      loosened: 0,
      // 0 = nothing there, then the petals grow out of the centre, 1 = in full bloom
      bloom: open ? 1 : 0,
      phase: open ? 'open' : 'empty',
    });
    rest[i * 4 + 3] = open ? 1 : 0;
  }
  const loosening = [];
  const falling = [];
  let petalBudget = Infinity;
  let clock = 0;
  let nextBloomAt = 1.5;

  let atRest = false;

  function pose() {
    for (let i = 0; i < n; i++) {
      const p = parent[i];
      let x = 1;
      let y = 1;
      sway[i] = deflection[i];
      if (p >= 0) {
        sway[i] += sway[p];
        // Even branches fork at their bend, odd ones at their tip.
        const joint = p % 2 === 0 ? segA : segB;
        const at = p % 2 === 0 ? p * 4 + 2 : p * 4;
        x = joint[at];
        y = joint[at + 1];
      }
      const angle = restAngle[i] + sway[i];
      const x1 = x + Math.cos(angle) * length[i];
      const y1 = y + Math.sin(angle) * length[i];
      segA[i * 4] = x;
      segA[i * 4 + 1] = y;
      segA[i * 4 + 2] = x1;
      segA[i * 4 + 3] = y1;
      segB[i * 4] = x1 + Math.cos(angle + bend[i]) * length[i];
      segB[i * 4 + 1] = y1 + Math.sin(angle + bend[i]) * length[i];
      segB[i * 4 + 2] = sway[i];
      rest[i * 4 + 2] = sway[i] + flowerDeflection[i];
    }
  }

  function closestOnSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const h = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const cx = ax + dx * h;
    const cy = ay + dy * h;
    return { x: cx, y: cy, distance: Math.hypot(px - cx, py - cy) };
  }

  // Applies an impulse at (x, y) in shader space (origin bottom-left) along the force (fx, fy).
  function push(x, y, fx, fy) {
    const scale = 1 / Math.hypot(fx, fy);
    for (let i = 0; i < n; i++) {
      const a = i * 4;
      const first = closestOnSegment(x, y, segA[a], segA[a + 1], segA[a + 2], segA[a + 3]);
      const second = closestOnSegment(x, y, segA[a + 2], segA[a + 3], segB[a], segB[a + 1]);
      const hit = first.distance < second.distance ? first : second;
      const falloff = Math.exp(-Math.pow(hit.distance / PUSH_RADIUS, 2));
      if (falloff < 0.002) continue;
      const leverX = (hit.x - segA[a]) / (2 * length[i]);
      const leverY = (hit.y - segA[a + 1]) / (2 * length[i]);
      const torque = (leverX * fy - leverY * fx) * scale;
      const limit = omegas[i] * MAX_SWAY;
      velocity[i] = limit * Math.tanh((velocity[i] + PUSH_STRENGTH * falloff * compliance[i] * torque) / limit);
    }
    shake(x, y);
    atRest = false;
  }

  // A gust along (fx, fy) that catches every branch at once.
  function breeze(fx, fy) {
    for (let i = 0; i < n; i++) {
      const torque = Math.cos(restAngle[i] + sway[i]) * fy - Math.sin(restAngle[i] + sway[i]) * fx;
      const limit = omegas[i] * MAX_SWAY;
      velocity[i] = limit * Math.tanh((velocity[i] + BREEZE_STRENGTH * compliance[i] * torque) / limit);
    }
    atRest = false;
  }

  function rotated(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [c * x - s * y, s * x + c * y];
  }

  function flowerCenter(flower) {
    const a = flower.node * 4;
    const [ox, oy] = rotated(flower.offsetX, flower.offsetY, segB[a + 2]);
    return [segA[a] + ox, segA[a + 1] + oy];
  }

  // Shakes build up on the flowers around the click. Past the threshold each petal
  // may come loose, less likely the further the flower is from the click.
  function shake(x, y) {
    for (const flower of flowers) {
      if (flower.phase !== 'open') continue;
      const [cx, cy] = flowerCenter(flower);
      const reach = Math.exp(-Math.pow(Math.hypot(x - cx, y - cy) / SHAKE_RADIUS, 2));
      flower.stress = flower.stress * Math.exp(-(clock - flower.shakenAt) / SHAKE_MEMORY) + reach;
      flower.shakenAt = clock;
      const chance = Math.min(0.8, (flower.stress - SHED_THRESHOLD) * SHED_RATE) * reach;
      if (chance <= 0) continue;
      for (let k = 0; k < PETAL_COUNT; k++) {
        if (flower.loosened & (1 << k)) continue;
        if (loosening.length + falling.length >= MAX_FALLING) return;
        if (Math.random() < chance) {
          flower.loosened |= 1 << k;
          loosening.push({ flower, petal: k, delay: Math.random() * 0.6 });
        }
      }
    }
  }

  function release(flower, petal) {
    const a = flower.node * 4;
    const reach = PETAL_DISTANCE + flower.size * 0.5;
    const offsetX = reach * Math.cos(flower.petalAngles[petal]);
    const offsetY = -reach * Math.sin(flower.petalAngles[petal]);
    const [cx, cy] = flowerCenter(flower);
    const [dx, dy] = rotated(offsetX, offsetY, rest[a + 2]);
    flower.shed |= 1 << petal;
    rest[a + 3] = 2 * flower.shed + flower.bloom;
    falling.push({
      flower,
      petal,
      offsetX,
      offsetY,
      x: cx + dx,
      y: cy + dy,
      vx: dx * 1.2 + (Math.random() - 0.5) * 0.04,
      vy: dy * 1.2 - Math.random() * 0.03,
      rotation: rest[a + 2],
      spin: (Math.random() - 0.5) * 3,
      tumble: 0,
      tumbleRate: 1.5 + Math.random() * 2.5,
      flutter: Math.random() * Math.PI * 2,
      flutterRate: 1.8 + Math.random() * 1.6,
    });
  }

  function updatePetals(dt) {
    for (let j = loosening.length - 1; j >= 0; j--) {
      loosening[j].delay -= dt;
      if (loosening[j].delay <= 0) {
        release(loosening[j].flower, loosening[j].petal);
        loosening.splice(j, 1);
      }
    }
    fallC.fill(0);
    for (let j = falling.length - 1; j >= 0; j--) {
      const petal = falling[j];
      petal.flutter += petal.flutterRate * dt;
      petal.vx += (PETAL_FLUTTER * Math.cos(petal.flutter) - 1.5 * petal.vx) * dt;
      petal.vy += (-PETAL_GRAVITY + 0.06 * Math.sin(2 * petal.flutter) - 1.2 * petal.vy) * dt;
      petal.x += petal.vx * dt;
      petal.y += petal.vy * dt;
      petal.rotation += (petal.spin + 8 * petal.vx) * dt;
      petal.tumble += petal.tumbleRate * dt;
      if (petal.y < -0.08 || petal.x < -0.1 || petal.x > 1.1) {
        falling.splice(j, 1);
      }
    }
    falling.forEach((petal, j) => {
      const a = petal.flower.node * 4;
      fallA.set([rest[a], rest[a + 1], petal.flower.node, petal.petal], j * 4);
      fallB.set([petal.x, petal.y, petal.rotation, 0.3 + 0.7 * Math.abs(Math.cos(petal.tumble))], j * 4);
      fallC.set([petal.offsetX, petal.offsetY, 1, 0], j * 4);
    });
  }

  function integrate(dt) {
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const p = parent[i];
      // Only the direct parent drags a branch: feeding the whole chain in resonates and pumps energy.
      const a = -stiffness[i] * deflection[i] - damping[i] * velocity[i] - (p >= 0 ? BRANCH_INERTIA * localAcceleration[p] : 0);
      velocity[i] += a * dt;
      deflection[i] = Math.max(-MAX_DEFLECTION, Math.min(MAX_DEFLECTION, deflection[i] + velocity[i] * dt));
      localAcceleration[i] = a;
      acceleration[i] = (p >= 0 ? acceleration[p] : 0) + a;

      const fa = -FLOWER_STIFFNESS * flowerDeflection[i] - FLOWER_DAMPING * flowerVelocity[i] - FLOWER_INERTIA * acceleration[i];
      flowerVelocity[i] += fa * dt;
      flowerDeflection[i] = Math.max(-MAX_DEFLECTION, Math.min(MAX_DEFLECTION, flowerDeflection[i] + flowerVelocity[i] * dt));

      energy = Math.max(energy, Math.abs(deflection[i]), Math.abs(velocity[i]), Math.abs(flowerDeflection[i]), Math.abs(flowerVelocity[i]));
    }
    return energy;
  }

  function petalsLeft(flower) {
    let count = 0;
    for (let k = 0; k < PETAL_COUNT; k++) if (!(flower.shed & (1 << k))) count++;
    return count;
  }

  function startBloom(bloom) {
    const inBloom = flowers.filter((flower) => flower.bloom > 0);
    const petals = inBloom.reduce((sum, flower) => sum + petalsLeft(flower), 0);
    if (petalBudget - petals < PETAL_COUNT) return;
    const restCenter = (flower) => [rest[flower.node * 4] + flower.offsetX, rest[flower.node * 4 + 1] + flower.offsetY];
    const spots = flowers.filter((flower) => {
      if (flower.phase !== 'empty') return false;
      const [x, y] = restCenter(flower);
      if (x < 0.06 || x > 0.94 || y < 0.06 || y > 0.94) return false;
      return inBloom.every((other) => {
        const [ox, oy] = restCenter(other);
        return Math.hypot(x - ox, y - oy) >= BLOOM_SPACING;
      });
    });
    if (!spots.length) return;
    const spot = spots[Math.floor(Math.random() * spots.length)];
    spot.phase = 'blooming';
    spot.bloom = bloom;
    rest[spot.node * 4 + 3] = bloom;
  }

  // Opens new buds, and lets flowers that lost every petal wither so the spot frees up.
  function updateBlooms(dt) {
    if (clock >= nextBloomAt) {
      nextBloomAt = clock + BLOOM_INTERVAL[0] + Math.random() * (BLOOM_INTERVAL[1] - BLOOM_INTERVAL[0]);
      startBloom(0);
    }
    let changing = false;
    for (const flower of flowers) {
      if (flower.phase === 'open' && flower.shed === 31) flower.phase = 'withering';
      if (flower.phase === 'blooming') {
        flower.bloom = Math.min(1, flower.bloom + dt / BLOOM_SECONDS);
        if (flower.bloom === 1) flower.phase = 'open';
      } else if (flower.phase === 'withering') {
        flower.bloom = Math.max(0, flower.bloom - dt / WITHER_SECONDS);
        if (flower.bloom === 0) {
          flower.phase = 'empty';
          flower.shed = 0;
          flower.loosened = 0;
          flower.stress = 0;
        }
      } else {
        continue;
      }
      rest[flower.node * 4 + 3] = 2 * flower.shed + flower.bloom;
      changing = true;
    }
    return changing;
  }

  // Advances the sway. Returns true while the pose changed and the tree needs a redraw.
  function step(seconds) {
    clock += seconds;
    const bloomsChanging = updateBlooms(seconds);
    if (bloomsChanging) atRest = false;
    if (atRest) return false;
    const steps = Math.max(1, Math.ceil(seconds / (1 / 120)));
    let energy = 0;
    for (let s = 0; s < steps; s++) energy = integrate(seconds / steps);
    const petalsMoving = loosening.length + falling.length > 0;
    if (energy < REST_THRESHOLD && !petalsMoving && !bloomsChanging) {
      deflection.fill(0);
      velocity.fill(0);
      flowerDeflection.fill(0);
      flowerVelocity.fill(0);
      acceleration.fill(0);
      localAcceleration.fill(0);
      atRest = true;
    }
    pose();
    updatePetals(seconds);
    return true;
  }

  pose();
  const buds = INITIAL_BUDS[0] + Math.floor(Math.random() * (INITIAL_BUDS[1] - INITIAL_BUDS[0] + 1));
  for (let b = 0; b < buds; b++) startBloom(0.15 + Math.random() * 0.15);
  petalBudget = (flowers.filter((flower) => flower.bloom > 0).length + EXTRA_BLOOMS) * PETAL_COUNT;
  return { segA, segB, rest, fallA, fallB, fallC, push, breeze, step };
}

module.exports = createTree;
