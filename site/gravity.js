import {
  MASS_MEV,
  addFourMomenta,
  energyFromMomentum,
  fourMomentum,
  invariantMass,
  kineticEnergy,
  sumParticleEnergy,
  sumParticleKineticEnergy,
  sumParticleRestEnergy,
  threeBodyFinalState,
  twoBodyFinalState,
} from "./fusion-physics.js";

// Override any value with `window.FUSION_BANNER_CONFIG` before this module
// loads; the probabilities and temperature are intentionally independent.
const DEFAULT_FUSION_CONFIG = Object.freeze({
  seed: 26031996,
  protonCount: 68,
  baseTemperatureKeV: 1.3,
  protonFusionProbability: 1 / 3,
  deuteriumCaptureProbability: 1 / 3,
  helium3FusionProbability: 1,
  alphaAlphaFusionProbability: 1 / 3,
  // NUBASE2020 gives an 81.9-attosecond ground-state half-life. The requested
  // five-second visual residence time makes the 8Be resonance observable.
  // https://www-nds.iaea.org/amdc/ame2020/nubase_4.mas20.txt
  beryllium8LifetimeSeconds: 5,
  fixedStepSeconds: 1 / 120,
  maxSubsteps: 8,
  visualSpeedScale: 70,
  maxVisualSpeed: 1.6,
  traceCapacity: 22,
  traceSampleSteps: 4,
  trailLogSpeedScale: 0.3,
  injectedProtonKineticEnergyKeV: 0.5,
  protonSpawnHoldDelayMs: 250,
  protonSpawnIntervalMs: 125,
  protonSpawnParticleLimit: 200,
  autoReset: true,
  cycleResetDelaySeconds: 5,
});

const MASSIVE_KINDS = new Set([
  "proton",
  "deuterium",
  "helium3",
  "helium4",
  "beryllium8",
  "carbon12",
]);
const ESCAPING_KINDS = new Set(["positron", "neutrino", "photon"]);
const NUCLEON_RADIUS_PX = 2.8;
const EDGE_MARGIN_PX = 7;
const RADIATION_ESCAPE_MARGIN = 0.18;
const ENERGY_UPDATE_INTERVAL_MS = 100;
const REACTION_FLASH_SECONDS = 1.35;
const RED = "rgba(144, 52, 38, 0.96)";
const RED_TRAIL = "rgba(134, 70, 47, 0.16)";
const BLACK = "rgba(43, 40, 33, 0.96)";
const BLACK_TRAIL = "rgba(43, 40, 33, 0.18)";
const HIGHLIGHT = "rgba(246, 235, 213, 0.72)";

const SPECIES = Object.freeze({
  proton: Object.freeze({
    massMeV: MASS_MEV.proton,
    collisionRadiusPx: 4.5,
    nucleons: Object.freeze([[0, 0, "proton"]]),
  }),
  deuterium: Object.freeze({
    massMeV: MASS_MEV.deuteron,
    collisionRadiusPx: 6.2,
    nucleons: Object.freeze([
      [-2.25, 0, "proton"],
      [2.25, 0, "neutron"],
    ]),
  }),
  helium3: Object.freeze({
    massMeV: MASS_MEV.helium3,
    collisionRadiusPx: 6.8,
    nucleons: Object.freeze([
      [0, -2.35, "proton"],
      [-2.4, 1.75, "proton"],
      [2.4, 1.75, "neutron"],
    ]),
  }),
  helium4: Object.freeze({
    massMeV: MASS_MEV.helium4,
    collisionRadiusPx: 7.2,
    nucleons: Object.freeze([
      [-2.25, -2.25, "proton"],
      [2.25, -2.25, "neutron"],
      [-2.25, 2.25, "neutron"],
      [2.25, 2.25, "proton"],
    ]),
  }),
  beryllium8: Object.freeze({
    // The resonance stores its event-specific invariant mass.
    massMeV: null,
    collisionRadiusPx: 10,
    nucleons: Object.freeze([
      [-5.25, -1.75, "proton"],
      [-1.75, -1.75, "neutron"],
      [-5.25, 1.75, "neutron"],
      [-1.75, 1.75, "proton"],
      [1.75, -1.75, "proton"],
      [5.25, -1.75, "neutron"],
      [1.75, 1.75, "neutron"],
      [5.25, 1.75, "proton"],
    ]),
  }),
  carbon12: Object.freeze({
    massMeV: MASS_MEV.carbon12,
    collisionRadiusPx: 11.2,
    nucleons: Object.freeze([
      [-2.1, -2.1, "proton"],
      [2.1, -2.1, "neutron"],
      [-2.1, 2.1, "neutron"],
      [2.1, 2.1, "proton"],
      [0, -6.3, "proton"],
      [4.5, -4.5, "neutron"],
      [6.3, 0, "proton"],
      [4.5, 4.5, "neutron"],
      [0, 6.3, "proton"],
      [-4.5, 4.5, "neutron"],
      [-6.3, 0, "proton"],
      [-4.5, -4.5, "neutron"],
    ]),
  }),
  positron: Object.freeze({
    massMeV: MASS_MEV.positron,
    collisionRadiusPx: 0,
    nucleons: Object.freeze([]),
  }),
  neutrino: Object.freeze({
    massMeV: MASS_MEV.neutrino,
    collisionRadiusPx: 0,
    nucleons: Object.freeze([]),
  }),
  photon: Object.freeze({
    massMeV: MASS_MEV.photon,
    collisionRadiusPx: 0,
    nucleons: Object.freeze([]),
  }),
});

const canvas = document.getElementById("gravity-canvas");
const banner = document.getElementById("gravity-banner");
const kineticEnergyReadout = document.getElementById("gravity-energy-value");
const totalEnergyReadout = document.getElementById(
  "gravity-total-energy-value",
);
const restMassReadout = document.getElementById(
  "gravity-rest-mass-value",
);

initializeNavigation();

if (
  canvas instanceof HTMLCanvasElement &&
  banner instanceof HTMLElement &&
  kineticEnergyReadout instanceof HTMLElement &&
  totalEnergyReadout instanceof HTMLElement &&
  restMassReadout instanceof HTMLElement
) {
  const context = canvas.getContext("2d", { alpha: true });

  if (context !== null) {
    startFusionBanner(context);
  }
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finitePositive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteNonnegative(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function probability(value, fallback) {
  return clamp(Number.isFinite(value) ? value : fallback, 0, 1);
}

function readConfiguration() {
  const overrides =
    window.FUSION_BANNER_CONFIG !== null &&
    typeof window.FUSION_BANNER_CONFIG === "object"
      ? window.FUSION_BANNER_CONFIG
      : {};
  const protonCount = Math.round(
    clamp(
      finitePositive(
        overrides.protonCount,
        DEFAULT_FUSION_CONFIG.protonCount,
      ),
      12,
      160,
    ),
  );

  return Object.freeze({
    seed: Number.isInteger(overrides.seed)
      ? overrides.seed
      : DEFAULT_FUSION_CONFIG.seed,
    protonCount,
    baseTemperatureKeV: finitePositive(
      overrides.baseTemperatureKeV,
      DEFAULT_FUSION_CONFIG.baseTemperatureKeV,
    ),
    protonFusionProbability: probability(
      overrides.protonFusionProbability,
      DEFAULT_FUSION_CONFIG.protonFusionProbability,
    ),
    deuteriumCaptureProbability: probability(
      overrides.deuteriumCaptureProbability,
      DEFAULT_FUSION_CONFIG.deuteriumCaptureProbability,
    ),
    helium3FusionProbability: probability(
      overrides.helium3FusionProbability,
      DEFAULT_FUSION_CONFIG.helium3FusionProbability,
    ),
    alphaAlphaFusionProbability: probability(
      overrides.alphaAlphaFusionProbability,
      DEFAULT_FUSION_CONFIG.alphaAlphaFusionProbability,
    ),
    beryllium8LifetimeSeconds: finiteNonnegative(
      overrides.beryllium8LifetimeSeconds,
      DEFAULT_FUSION_CONFIG.beryllium8LifetimeSeconds,
    ),
    fixedStepSeconds: finitePositive(
      overrides.fixedStepSeconds,
      DEFAULT_FUSION_CONFIG.fixedStepSeconds,
    ),
    maxSubsteps: Math.round(
      clamp(
        finitePositive(overrides.maxSubsteps, DEFAULT_FUSION_CONFIG.maxSubsteps),
        1,
        24,
      ),
    ),
    visualSpeedScale: finitePositive(
      overrides.visualSpeedScale,
      DEFAULT_FUSION_CONFIG.visualSpeedScale,
    ),
    maxVisualSpeed: finitePositive(
      overrides.maxVisualSpeed,
      DEFAULT_FUSION_CONFIG.maxVisualSpeed,
    ),
    traceCapacity: Math.round(
      clamp(
        finitePositive(
          overrides.traceCapacity,
          DEFAULT_FUSION_CONFIG.traceCapacity,
        ),
        4,
        80,
      ),
    ),
    traceSampleSteps: Math.round(
      clamp(
        finitePositive(
          overrides.traceSampleSteps,
          DEFAULT_FUSION_CONFIG.traceSampleSteps,
        ),
        1,
        20,
      ),
    ),
    trailLogSpeedScale: finitePositive(
      overrides.trailLogSpeedScale,
      DEFAULT_FUSION_CONFIG.trailLogSpeedScale,
    ),
    injectedProtonKineticEnergyKeV: clamp(
      finitePositive(
        overrides.injectedProtonKineticEnergyKeV,
        DEFAULT_FUSION_CONFIG.injectedProtonKineticEnergyKeV,
      ),
      0.001,
      100,
    ),
    protonSpawnHoldDelayMs: clamp(
      finiteNonnegative(
        overrides.protonSpawnHoldDelayMs,
        DEFAULT_FUSION_CONFIG.protonSpawnHoldDelayMs,
      ),
      50,
      2000,
    ),
    protonSpawnIntervalMs: clamp(
      finitePositive(
        overrides.protonSpawnIntervalMs,
        DEFAULT_FUSION_CONFIG.protonSpawnIntervalMs,
      ),
      40,
      1000,
    ),
    protonSpawnParticleLimit: Math.max(
      protonCount,
      Math.round(
        clamp(
          finitePositive(
            overrides.protonSpawnParticleLimit ?? overrides.maxParticleCount,
            DEFAULT_FUSION_CONFIG.protonSpawnParticleLimit,
          ),
          80,
          400,
        ),
      ),
    ),
    autoReset: overrides.autoReset !== false,
    cycleResetDelaySeconds: finiteNonnegative(
      overrides.cycleResetDelaySeconds,
      DEFAULT_FUSION_CONFIG.cycleResetDelaySeconds,
    ),
  });
}

function seededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianRandom(random) {
  let spare = null;

  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }

    const radius = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random())));
    const angle = random() * Math.PI * 2;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

function startFusionBanner(context) {
  const config = readConfiguration();
  const random = seededRandom(config.seed);
  const visualRandom = seededRandom(config.seed ^ 0x9e3779b9);
  const spawnRandom = seededRandom(config.seed ^ 0x85ebca6b);
  const normalRandom = gaussianRandom(random);
  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  let particles = [];
  let contacts = new Set();
  let reactionFlashes = [];
  let nextParticleId = 1;
  let cssWidth = 1;
  let cssHeight = 1;
  let aspect = 1;
  let simulationTime = 0;
  let traceStep = 0;
  let accumulator = 0;
  let previousTime = performance.now();
  let previousEnergyUpdateTime = -Infinity;
  let animationFrame = null;
  let isIntersecting = true;
  let initialTotalEnergyMeV = 0;
  let escapedTotalEnergyMeV = 0;
  let escapedKineticEnergyMeV = 0;
  let escapedRestEnergyMeV = 0;
  let injectedTotalEnergyMeV = 0;
  let injectedProtonCount = 0;
  let reactionCount = 0;
  let terminalSince = null;
  let activeSpawnSource = null;
  let spawnHoldTimer = null;
  let spawnRepeatTimer = null;

  function createParticle(kind, options) {
    const species = SPECIES[kind];

    if (species === undefined) {
      throw new RangeError(`Unknown particle species: ${kind}`);
    }

    const massMeV = options.massMeV ?? species.massMeV;

    if (!Number.isFinite(massMeV) || massMeV < 0) {
      throw new RangeError(`Invalid rest mass for ${kind}`);
    }

    if (
      !Number.isFinite(options.x) ||
      !Number.isFinite(options.y) ||
      !Number.isFinite(options.px) ||
      !Number.isFinite(options.py)
    ) {
      throw new RangeError(`Invalid position or momentum for ${kind}`);
    }

    return {
      id: nextParticleId++,
      kind,
      massMeV,
      x: options.x,
      y: options.y,
      px: options.px,
      py: options.py,
      bornAt: simulationTime,
      decayAt: options.decayAt ?? null,
      phase: visualRandom() * Math.PI * 2,
      spin: (visualRandom() - 0.5) * 1.4,
      trace: [{ x: options.x, y: options.y }],
    };
  }

  function pointerPosition(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();

    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    const fractionX = (clientX - bounds.left) / bounds.width;
    const fractionY = (clientY - bounds.top) / bounds.height;

    if (
      fractionX < 0 ||
      fractionX > 1 ||
      fractionY < 0 ||
      fractionY > 1
    ) {
      return null;
    }

    const margin =
      Math.max(EDGE_MARGIN_PX, SPECIES.proton.collisionRadiusPx) / cssHeight;
    return {
      x: clamp(fractionX * aspect, margin, aspect - margin),
      y: clamp(fractionY, margin, 1 - margin),
    };
  }

  function particleLoadContribution(particle) {
    return particle.kind === "beryllium8" ? 2 : 1;
  }

  function particleLoadWithDecayHeadroom() {
    return particles.reduce(
      (load, particle) => load + particleLoadContribution(particle),
      0,
    );
  }

  function spawnProtonAt(x, y) {
    if (
      particleLoadWithDecayHeadroom() >= config.protonSpawnParticleLimit
    ) {
      return false;
    }

    const kineticEnergyMeV = config.injectedProtonKineticEnergyKeV / 1000;
    const momentumMagnitude = Math.sqrt(
      kineticEnergyMeV * (kineticEnergyMeV + 2 * MASS_MEV.proton),
    );

    if (!Number.isFinite(momentumMagnitude)) {
      return false;
    }

    const direction = spawnRandom() * Math.PI * 2;
    const momentumX = Math.cos(direction) * momentumMagnitude;
    const momentumY = Math.sin(direction) * momentumMagnitude;
    const injectedEnergyMeV = energyFromMomentum(
      MASS_MEV.proton,
      momentumX,
      momentumY,
    );

    if (!Number.isFinite(injectedEnergyMeV)) {
      return false;
    }

    const proton = createParticle("proton", {
      x,
      y,
      px: momentumX,
      py: momentumY,
    });

    particles.push(proton);
    injectedProtonCount += 1;
    injectedTotalEnergyMeV += injectedEnergyMeV;
    banner.dataset.lastInjectedProton = JSON.stringify({
      id: proton.id,
      massMeV: proton.massMeV,
      x: proton.x,
      y: proton.y,
      px: proton.px,
      py: proton.py,
      kineticEnergyMeV,
      totalEnergyMeV: injectedEnergyMeV,
    });
    banner.dataset.protonSpawnBlocked = "false";
    terminalSince = null;
    render();
    updateEnergyReadout(performance.now(), true);
    updateAnimationState();
    return true;
  }

  function spawnFromActiveSource() {
    if (activeSpawnSource === null) {
      return;
    }

    const position =
      activeSpawnSource.type === "pointer"
        ? pointerPosition(
            activeSpawnSource.clientX,
            activeSpawnSource.clientY,
          )
        : { x: aspect / 2, y: 0.5 };

    if (position === null) {
      stopProtonSpawning();
      return;
    }

    if (spawnProtonAt(position.x, position.y)) {
      activeSpawnSource.hasSpawned = true;
    } else {
      banner.dataset.protonSpawnBlocked = "true";
      stopProtonSpawning();
    }
  }

  function scheduleHeldProtonSpawning() {
    spawnHoldTimer = window.setTimeout(() => {
      spawnHoldTimer = null;

      if (activeSpawnSource === null) {
        return;
      }

      spawnFromActiveSource();

      if (activeSpawnSource === null) {
        return;
      }

      spawnRepeatTimer = window.setInterval(
        spawnFromActiveSource,
        config.protonSpawnIntervalMs,
      );
    }, config.protonSpawnHoldDelayMs);
  }

  function stopProtonSpawning() {
    const previousSource = activeSpawnSource;
    activeSpawnSource = null;
    banner.dataset.protonSpawning = "false";

    if (spawnHoldTimer !== null) {
      window.clearTimeout(spawnHoldTimer);
      spawnHoldTimer = null;
    }

    if (spawnRepeatTimer !== null) {
      window.clearInterval(spawnRepeatTimer);
      spawnRepeatTimer = null;
    }

    if (
      previousSource?.type === "pointer" &&
      canvas.hasPointerCapture(previousSource.pointerId)
    ) {
      canvas.releasePointerCapture(previousSource.pointerId);
    }
  }

  function beginPointerSpawning(event) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      activeSpawnSource !== null
    ) {
      return;
    }

    const position = pointerPosition(event.clientX, event.clientY);

    if (position === null) {
      return;
    }

    activeSpawnSource = {
      type: "pointer",
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      clientX: event.clientX,
      clientY: event.clientY,
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasSpawned: false,
    };
    banner.dataset.protonSpawning = "true";

    if (event.pointerType === "touch") {
      if (!motionPreference.matches) {
        scheduleHeldProtonSpawning();
      }
    } else {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        stopProtonSpawning();
        return;
      }

      spawnFromActiveSource();

      if (!motionPreference.matches && activeSpawnSource !== null) {
        scheduleHeldProtonSpawning();
      }
    }
  }

  function updatePointerSpawnPosition(event) {
    if (
      activeSpawnSource?.type !== "pointer" ||
      activeSpawnSource.pointerId !== event.pointerId
    ) {
      return;
    }

    if (
      activeSpawnSource.pointerType !== "touch" &&
      (event.buttons & 1) === 0
    ) {
      stopProtonSpawning();
      return;
    }

    if (
      activeSpawnSource.pointerType === "touch" &&
      Math.hypot(
        event.clientX - activeSpawnSource.startClientX,
        event.clientY - activeSpawnSource.startClientY,
      ) > 10
    ) {
      stopProtonSpawning();
      return;
    }

    if (pointerPosition(event.clientX, event.clientY) === null) {
      stopProtonSpawning();
      return;
    }

    activeSpawnSource.clientX = event.clientX;
    activeSpawnSource.clientY = event.clientY;
  }

  function endPointerSpawning(event) {
    if (
      activeSpawnSource?.type === "pointer" &&
      activeSpawnSource.pointerId === event.pointerId
    ) {
      if (
        event.type === "pointerup" &&
        activeSpawnSource.pointerType === "touch" &&
        !activeSpawnSource.hasSpawned
      ) {
        spawnFromActiveSource();
      }

      stopProtonSpawning();
    }
  }

  function beginKeyboardSpawning(event) {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (event.repeat || activeSpawnSource !== null) {
      return;
    }

    activeSpawnSource = {
      type: "keyboard",
      key: event.key,
      hasSpawned: false,
    };
    banner.dataset.protonSpawning = "true";
    spawnFromActiveSource();

    if (!motionPreference.matches && activeSpawnSource !== null) {
      scheduleHeldProtonSpawning();
    }
  }

  function endKeyboardSpawning(event) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
    }

    if (
      activeSpawnSource?.type === "keyboard" &&
      activeSpawnSource.key === event.key
    ) {
      stopProtonSpawning();
    }
  }

  function handleSyntheticClick(event) {
    if (event.detail === 0 && activeSpawnSource === null) {
      if (!spawnProtonAt(aspect / 2, 0.5)) {
        banner.dataset.protonSpawnBlocked = "true";
      }
    }
  }

  function initializeReducedMotionTableau() {
    const margin = EDGE_MARGIN_PX / cssHeight;
    const availableWidth = Math.max(0.001, aspect - 2 * margin);
    const availableHeight = Math.max(0.001, 1 - 2 * margin);
    const tableau = [
      ["proton", 0.04, 0.28, 0, 0],
      ["proton", 0.1, 0.72, 0, 0],
      ["deuterium", 0.2, 0.46, 0, 0],
      ["helium3", 0.31, 0.72, 0, 0],
      ["helium4", 0.41, 0.27, 0, 0],
      ["beryllium8", 0.54, 0.66, 0, 0],
      ["carbon12", 0.68, 0.31, 0, 0],
      ["positron", 0.79, 0.7, 0.28, -0.08],
      ["neutrino", 0.89, 0.27, 0.22, -0.12],
      ["photon", 0.96, 0.64, 0.42, 0.08],
    ];

    for (const [kind, fractionX, fractionY, px, py] of tableau) {
      particles.push(
        createParticle(kind, {
          x: margin + availableWidth * fractionX,
          y: margin + availableHeight * fractionY,
          px,
          py,
          massMeV:
            kind === "beryllium8" ? MASS_MEV.beryllium8 : undefined,
          decayAt:
            kind === "beryllium8"
              ? config.beryllium8LifetimeSeconds
              : undefined,
        }),
      );
    }
  }

  function initializeParticles() {
    stopProtonSpawning();
    particles = [];
    contacts = new Set();
    reactionFlashes = [];
    nextParticleId = 1;
    simulationTime = 0;
    traceStep = 0;
    accumulator = 0;
    escapedTotalEnergyMeV = 0;
    escapedKineticEnergyMeV = 0;
    escapedRestEnergyMeV = 0;
    injectedTotalEnergyMeV = 0;
    injectedProtonCount = 0;
    delete banner.dataset.lastInjectedProton;
    banner.dataset.protonSpawnBlocked = "false";
    reactionCount = 0;
    terminalSince = null;

    if (motionPreference.matches) {
      initializeReducedMotionTableau();
      initialTotalEnergyMeV = sumParticleEnergy(particles);
      updateEnergyReadout(performance.now(), true);
      return;
    }

    const temperatureMeV = config.baseTemperatureKeV / 1000;
    const momentumSigma = Math.sqrt(MASS_MEV.proton * temperatureMeV);
    const radius = SPECIES.proton.collisionRadiusPx / cssHeight;
    const marginX = Math.max(EDGE_MARGIN_PX / cssHeight, radius);
    const marginY = marginX;

    for (let index = 0; index < config.protonCount; index += 1) {
      let x = aspect / 2;
      let y = 0.5;

      for (let attempt = 0; attempt < 80; attempt += 1) {
        x = marginX + random() * Math.max(0.001, aspect - 2 * marginX);
        y = marginY + random() * Math.max(0.001, 1 - 2 * marginY);

        const overlaps = particles.some(
          (particle) =>
            Math.hypot(particle.x - x, particle.y - y) < radius * 2.25,
        );

        if (!overlaps) {
          break;
        }
      }

      particles.push(
        createParticle("proton", {
          x,
          y,
          px: normalRandom() * momentumSigma,
          py: normalRandom() * momentumSigma,
        }),
      );
    }

    const meanMomentumX =
      particles.reduce((total, particle) => total + particle.px, 0) /
      particles.length;
    const meanMomentumY =
      particles.reduce((total, particle) => total + particle.py, 0) /
      particles.length;

    for (const particle of particles) {
      particle.px -= meanMomentumX;
      particle.py -= meanMomentumY;
    }

    initialTotalEnergyMeV = sumParticleEnergy(particles);
    updateEnergyReadout(performance.now(), true);
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));

    if (
      nextWidth === cssWidth &&
      nextHeight === cssHeight &&
      particles.length > 0
    ) {
      return;
    }

    const previousAspect = aspect;
    cssWidth = nextWidth;
    cssHeight = nextHeight;
    aspect = cssWidth / cssHeight;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if (particles.length === 0) {
      initializeParticles();
      render();
      return;
    }

    const horizontalScale = aspect / previousAspect;

    for (const particle of particles) {
      particle.x *= horizontalScale;

      for (const point of particle.trace) {
        point.x *= horizontalScale;
      }
    }

    for (const flash of reactionFlashes) {
      flash.x *= horizontalScale;
    }

    render();
    updateEnergyReadout(performance.now(), true);
  }

  function positionVelocity(particle) {
    const energy = energyFromMomentum(
      particle.massMeV,
      particle.px,
      particle.py,
    );

    if (energy <= Number.EPSILON) {
      return { x: 0, y: 0 };
    }

    let velocityX = (particle.px / energy) * config.visualSpeedScale;
    let velocityY = (particle.py / energy) * config.visualSpeedScale;
    const speed = Math.hypot(velocityX, velocityY);

    if (speed > config.maxVisualSpeed) {
      const scale = config.maxVisualSpeed / speed;
      velocityX *= scale;
      velocityY *= scale;
    }

    return { x: velocityX, y: velocityY };
  }

  function physicalFourMomentum(particle) {
    return fourMomentum(particle.massMeV, particle.px, particle.py);
  }

  function containMassiveParticle(particle) {
    const radius =
      Math.max(EDGE_MARGIN_PX, SPECIES[particle.kind].collisionRadiusPx) /
      cssHeight;

    if (particle.x < radius) {
      particle.x = radius;
      particle.px = Math.abs(particle.px);
    } else if (particle.x > aspect - radius) {
      particle.x = aspect - radius;
      particle.px = -Math.abs(particle.px);
    }

    if (particle.y < radius) {
      particle.y = radius;
      particle.py = Math.abs(particle.py);
    } else if (particle.y > 1 - radius) {
      particle.y = 1 - radius;
      particle.py = -Math.abs(particle.py);
    }
  }

  function advanceParticles(step) {
    const escapedIds = new Set();

    for (const particle of particles) {
      const velocity = positionVelocity(particle);
      particle.x += velocity.x * step;
      particle.y += velocity.y * step;

      if (MASSIVE_KINDS.has(particle.kind)) {
        containMassiveParticle(particle);
        continue;
      }

      if (
        ESCAPING_KINDS.has(particle.kind) &&
        (particle.x < -RADIATION_ESCAPE_MARGIN ||
          particle.x > aspect + RADIATION_ESCAPE_MARGIN ||
          particle.y < -RADIATION_ESCAPE_MARGIN ||
          particle.y > 1 + RADIATION_ESCAPE_MARGIN)
      ) {
        escapedTotalEnergyMeV += energyFromMomentum(
          particle.massMeV,
          particle.px,
          particle.py,
        );
        escapedKineticEnergyMeV += kineticEnergy(
          particle.massMeV,
          particle.px,
          particle.py,
        );
        escapedRestEnergyMeV += particle.massMeV;
        escapedIds.add(particle.id);
      }
    }

    if (escapedIds.size > 0) {
      particles = particles.filter(
        (particle) => !escapedIds.has(particle.id),
      );
    }
  }

  function productPosition(origin, product, offsetIndex) {
    const directionLength = Math.hypot(product.px, product.py);
    const fallbackAngle =
      ((offsetIndex + 1) * Math.PI * 2) / 3 + visualRandom() * 0.2;
    const directionX =
      directionLength > Number.EPSILON
        ? product.px / directionLength
        : Math.cos(fallbackAngle);
    const directionY =
      directionLength > Number.EPSILON
        ? product.py / directionLength
        : Math.sin(fallbackAngle);
    const offset = (2.5 + offsetIndex * 0.65) / cssHeight;

    return {
      x: origin.x + directionX * offset,
      y: origin.y + directionY * offset,
    };
  }

  function particlesFromFinalState(origin, kinds, finalState) {
    return finalState.map((state, index) => {
      const position = productPosition(origin, state, index);

      return createParticle(kinds[index], {
        x: position.x,
        y: position.y,
        px: state.px,
        py: state.py,
      });
    });
  }

  function addReactionFlash(x, y, label, color = RED) {
    reactionFlashes.push({
      x,
      y,
      label,
      color,
      startedAt: simulationTime,
    });
  }

  function processBeryllium8Decays() {
    const decaying = particles.filter(
      (particle) =>
        particle.kind === "beryllium8" &&
        particle.decayAt !== null &&
        simulationTime >= particle.decayAt,
    );

    if (decaying.length === 0) {
      return new Set();
    }

    const decayingIds = new Set(decaying.map((particle) => particle.id));
    const products = [];

    for (const parent of decaying) {
      const finalState = twoBodyFinalState(
        physicalFourMomentum(parent),
        MASS_MEV.alpha,
        MASS_MEV.alpha,
        random() * Math.PI * 2,
      );
      products.push(
        ...particlesFromFinalState(
          parent,
          ["helium4", "helium4"],
          finalState,
        ),
      );
      reactionCount += 1;
      addReactionFlash(parent.x, parent.y, "⁸Be → 2α", BLACK);
    }

    particles = particles
      .filter((particle) => !decayingIds.has(particle.id))
      .concat(products);

    // Do not let newborn daughters immediately collide (and possibly reform
    // 8Be) in the very substep in which they were emitted.
    return new Set(products.map((particle) => particle.id));
  }

  function pairKey(first, second) {
    return first.id < second.id
      ? `${first.id}:${second.id}`
      : `${second.id}:${first.id}`;
  }

  function pairMatches(first, second, firstKind, secondKind) {
    return (
      (first.kind === firstKind && second.kind === secondKind) ||
      (first.kind === secondKind && second.kind === firstKind)
    );
  }

  function collisionOrigin(first, second) {
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
  }

  function createDeuteriumAndLeptons(first, second) {
    const total = addFourMomenta(
      physicalFourMomentum(first),
      physicalFourMomentum(second),
    );
    const origin = collisionOrigin(first, second);
    const finalState = threeBodyFinalState(
      total,
      [MASS_MEV.deuteron, MASS_MEV.positron, MASS_MEV.neutrino],
      random,
    );

    reactionCount += 1;
    addReactionFlash(origin.x, origin.y, "p + p → d + e⁺ + νₑ");
    return particlesFromFinalState(
      origin,
      ["deuterium", "positron", "neutrino"],
      finalState,
    );
  }

  function createHelium3AndPhoton(first, second) {
    const total = addFourMomenta(
      physicalFourMomentum(first),
      physicalFourMomentum(second),
    );
    const origin = collisionOrigin(first, second);
    const finalState = twoBodyFinalState(
      total,
      MASS_MEV.helium3,
      MASS_MEV.photon,
      random() * Math.PI * 2,
    );

    reactionCount += 1;
    addReactionFlash(origin.x, origin.y, "d + p → ³He + γ");
    return particlesFromFinalState(
      origin,
      ["helium3", "photon"],
      finalState,
    );
  }

  function createHelium4AndProtons(first, second) {
    const total = addFourMomenta(
      physicalFourMomentum(first),
      physicalFourMomentum(second),
    );
    const origin = collisionOrigin(first, second);
    const finalState = threeBodyFinalState(
      total,
      [MASS_MEV.helium4, MASS_MEV.proton, MASS_MEV.proton],
      random,
    );

    reactionCount += 1;
    addReactionFlash(origin.x, origin.y, "³He + ³He → ⁴He + 2p");
    return particlesFromFinalState(
      origin,
      ["helium4", "proton", "proton"],
      finalState,
    );
  }

  function createBeryllium8(first, second) {
    const total = addFourMomenta(
      physicalFourMomentum(first),
      physicalFourMomentum(second),
    );
    const origin = collisionOrigin(first, second);

    reactionCount += 1;
    addReactionFlash(origin.x, origin.y, "α + α → ⁸Be");
    return [
      createParticle("beryllium8", {
        x: origin.x,
        y: origin.y,
        px: total.px,
        py: total.py,
        // The visual resonance carries the exact incoming four-momentum;
        // forcing its nominal mass would create or destroy energy.
        massMeV: invariantMass(total),
        decayAt: simulationTime + config.beryllium8LifetimeSeconds,
      }),
    ];
  }

  function createCarbonAndPhoton(first, second) {
    const total = addFourMomenta(
      physicalFourMomentum(first),
      physicalFourMomentum(second),
    );
    const origin = collisionOrigin(first, second);
    const finalState = twoBodyFinalState(
      total,
      MASS_MEV.carbon12,
      MASS_MEV.photon,
      random() * Math.PI * 2,
    );

    reactionCount += 1;
    addReactionFlash(origin.x, origin.y, "⁸Be + α → ¹²C + γ");
    return particlesFromFinalState(
      origin,
      ["carbon12", "photon"],
      finalState,
    );
  }

  function tryFusion(first, second) {
    if (pairMatches(first, second, "proton", "proton")) {
      return random() < config.protonFusionProbability
        ? createDeuteriumAndLeptons(first, second)
        : null;
    }

    if (pairMatches(first, second, "proton", "deuterium")) {
      return random() < config.deuteriumCaptureProbability
        ? createHelium3AndPhoton(first, second)
        : null;
    }

    if (pairMatches(first, second, "helium3", "helium3")) {
      return random() < config.helium3FusionProbability
        ? createHelium4AndProtons(first, second)
        : null;
    }

    if (pairMatches(first, second, "helium4", "helium4")) {
      return random() < config.alphaAlphaFusionProbability
        ? createBeryllium8(first, second)
        : null;
    }

    if (pairMatches(first, second, "beryllium8", "helium4")) {
      return createCarbonAndPhoton(first, second);
    }

    return null;
  }

  function separateOverlappingPair(first, second, directionX, directionY, overlap) {
    const correction = (overlap + 0.05 / cssHeight) / 2;
    first.x -= directionX * correction;
    first.y -= directionY * correction;
    second.x += directionX * correction;
    second.y += directionY * correction;

    const margin = EDGE_MARGIN_PX / cssHeight;
    first.x = clamp(first.x, margin, aspect - margin);
    first.y = clamp(first.y, margin, 1 - margin);
    second.x = clamp(second.x, margin, aspect - margin);
    second.y = clamp(second.y, margin, 1 - margin);
  }

  function scatterElastically(first, second, directionX, directionY) {
    // A conservative hard-sphere proxy for Coulomb scattering: the visible
    // collision radii are larger than the drawn nucleons, so positive nuclei
    // turn away before their rendered surfaces touch.
    const total = addFourMomenta(
      physicalFourMomentum(first),
      physicalFourMomentum(second),
    );
    const outgoingAngle = Math.atan2(-directionY, -directionX);
    const finalState = twoBodyFinalState(
      total,
      first.massMeV,
      second.massMeV,
      outgoingAngle,
    );
    first.px = finalState[0].px;
    first.py = finalState[0].py;
    second.px = finalState[1].px;
    second.py = finalState[1].py;
  }

  function processCollisions(ineligibleIds = new Set()) {
    const nextContacts = new Set();
    const consumedIds = new Set();
    const products = [];

    for (let firstIndex = 0; firstIndex < particles.length; firstIndex += 1) {
      const first = particles[firstIndex];

      if (
        !MASSIVE_KINDS.has(first.kind) ||
        consumedIds.has(first.id) ||
        ineligibleIds.has(first.id)
      ) {
        continue;
      }

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < particles.length;
        secondIndex += 1
      ) {
        const second = particles[secondIndex];

        if (
          !MASSIVE_KINDS.has(second.kind) ||
          consumedIds.has(second.id) ||
          ineligibleIds.has(second.id)
        ) {
          continue;
        }

        const deltaX = second.x - first.x;
        const deltaY = second.y - first.y;
        const distance = Math.hypot(deltaX, deltaY);
        const minimumDistance =
          (SPECIES[first.kind].collisionRadiusPx +
            SPECIES[second.kind].collisionRadiusPx) /
          cssHeight;

        if (distance >= minimumDistance) {
          continue;
        }

        const key = pairKey(first, second);
        nextContacts.add(key);

        const fallbackAngle = (first.id + second.id) * 2.399963229728653;
        const directionX =
          distance > Number.EPSILON ? deltaX / distance : Math.cos(fallbackAngle);
        const directionY =
          distance > Number.EPSILON ? deltaY / distance : Math.sin(fallbackAngle);
        separateOverlappingPair(
          first,
          second,
          directionX,
          directionY,
          minimumDistance - distance,
        );

        if (contacts.has(key)) {
          continue;
        }

        const firstVelocity = positionVelocity(first);
        const secondVelocity = positionVelocity(second);
        const approachSpeed =
          (secondVelocity.x - firstVelocity.x) * directionX +
          (secondVelocity.y - firstVelocity.y) * directionY;

        if (approachSpeed >= 0) {
          continue;
        }

        const fusionProducts = tryFusion(first, second);

        if (fusionProducts !== null) {
          consumedIds.add(first.id);
          consumedIds.add(second.id);
          products.push(...fusionProducts);
          break;
        }

        scatterElastically(first, second, directionX, directionY);
      }
    }

    if (consumedIds.size > 0) {
      particles = particles
        .filter((particle) => !consumedIds.has(particle.id))
        .concat(products);
    }

    contacts = new Set(
      Array.from(nextContacts).filter((key) => {
        const [firstId, secondId] = key.split(":").map(Number);
        return !consumedIds.has(firstId) && !consumedIds.has(secondId);
      }),
    );
  }

  function recordTraces() {
    traceStep += 1;

    if (traceStep < config.traceSampleSteps) {
      return;
    }

    traceStep = 0;

    for (const particle of particles) {
      particle.trace.push({ x: particle.x, y: particle.y });

      if (particle.trace.length > config.traceCapacity) {
        particle.trace.shift();
      }
    }
  }

  function reactionChannelsRemain() {
    const counts = particles.reduce((totals, particle) => {
      totals[particle.kind] = (totals[particle.kind] ?? 0) + 1;
      return totals;
    }, {});

    if (
      config.protonFusionProbability > 0 &&
      (counts.proton ?? 0) >= 2
    ) {
      return true;
    }

    if (
      config.deuteriumCaptureProbability > 0 &&
      (counts.proton ?? 0) >= 1 &&
      (counts.deuterium ?? 0) >= 1
    ) {
      return true;
    }

    if (
      config.helium3FusionProbability > 0 &&
      (counts.helium3 ?? 0) >= 2
    ) {
      return true;
    }

    const alphaEquivalents =
      (counts.helium4 ?? 0) + 2 * (counts.beryllium8 ?? 0);

    if (
      config.alphaAlphaFusionProbability > 0 &&
      alphaEquivalents >= 3 &&
      (counts.helium4 ?? 0) >= 2
    ) {
      return true;
    }

    // A lone 8Be can still decay, and one accompanied by an alpha can instead
    // complete the triple-alpha channel, so neither state is terminal. Two
    // leftover free alphas alone do not hold the automatic cycle reset open.
    return (counts.beryllium8 ?? 0) >= 1;
  }

  function simulate(step) {
    simulationTime += step;
    advanceParticles(step);
    const decayProductIds = processBeryllium8Decays();
    processCollisions(decayProductIds);
    recordTraces();
    reactionFlashes = reactionFlashes.filter(
      (flash) => simulationTime - flash.startedAt < REACTION_FLASH_SECONDS,
    );

    if (!config.autoReset || reactionCount === 0 || reactionChannelsRemain()) {
      terminalSince = null;
      return false;
    }

    terminalSince ??= simulationTime;
    return (
      simulationTime - terminalSince >= config.cycleResetDelaySeconds
    );
  }

  function formatEnergy(energyMeV) {
    if (energyMeV < 1000) {
      return `${energyMeV.toFixed(3)} MeV`;
    }

    return `${energyMeV.toExponential(3)} MeV`;
  }

  function conservedEnergyMeV() {
    return sumParticleEnergy(particles) + escapedTotalEnergyMeV;
  }

  function kineticEnergyMeV() {
    return sumParticleKineticEnergy(particles) + escapedKineticEnergyMeV;
  }

  function restEnergyMeV() {
    return sumParticleRestEnergy(particles) + escapedRestEnergyMeV;
  }

  function expectedTotalEnergyMeV() {
    return initialTotalEnergyMeV + injectedTotalEnergyMeV;
  }

  function particleCounts() {
    return particles.reduce((counts, particle) => {
      counts[particle.kind] = (counts[particle.kind] ?? 0) + 1;
      return counts;
    }, {});
  }

  function updateEnergyReadout(currentTime, force = false) {
    if (
      !force &&
      currentTime - previousEnergyUpdateTime < ENERGY_UPDATE_INTERVAL_MS
    ) {
      return;
    }

    previousEnergyUpdateTime = currentTime;
    const totalEnergy = conservedEnergyMeV();
    const kineticEnergy = kineticEnergyMeV();
    const restEnergy = restEnergyMeV();
    const counts = particleCounts();
    totalEnergyReadout.textContent = formatEnergy(totalEnergy);
    restMassReadout.textContent = formatEnergy(restEnergy);
    kineticEnergyReadout.textContent = formatEnergy(kineticEnergy);
    kineticEnergyReadout.dataset.energyDriftMev = (
      totalEnergy - expectedTotalEnergyMeV()
    ).toExponential(6);
    kineticEnergyReadout.dataset.energyBalanceMev = (
      totalEnergy - restEnergy - kineticEnergy
    ).toExponential(6);
    banner.dataset.reactionCount = String(reactionCount);
    banner.dataset.injectedProtonCount = String(injectedProtonCount);
    banner.dataset.injectedTotalEnergyMev = injectedTotalEnergyMeV.toFixed(9);
    banner.dataset.protonSpawning = String(activeSpawnSource !== null);
    banner.dataset.protonSpawnBlocked ??= "false";
    banner.dataset.particleLoad = String(particleLoadWithDecayHeadroom());
    banner.dataset.beryllium8Count = String(counts.beryllium8 ?? 0);
    banner.dataset.carbon12Count = String(counts.carbon12 ?? 0);
  }

  function renderTrace(particle) {
    if (particle.trace.length < 2 || particle.kind === "photon") {
      return;
    }

    const scale = cssHeight;
    const isRed = particle.kind === "proton" || particle.kind === "positron";
    const velocity = positionVelocity(particle);
    const speed = Math.hypot(velocity.x, velocity.y);
    const normalizedSpeed = speed / config.trailLogSpeedScale;
    // Retaining log(1 + v/s)/(v/s) of the history turns a straight tail's
    // growth from vΔt into sΔt log(1 + v/s), without distorting its path.
    const visibleTraceFraction =
      normalizedSpeed > Number.EPSILON
        ? Math.log1p(normalizedSpeed) / normalizedSpeed
        : 1;
    const visibleTraceCount = Math.max(
      2,
      Math.ceil(particle.trace.length * visibleTraceFraction),
    );
    const visibleTrace = particle.trace.slice(-visibleTraceCount);
    context.beginPath();

    visibleTrace.forEach((point, index) => {
      const x = point.x * scale;
      const y = point.y * scale;

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.lineTo(particle.x * scale, particle.y * scale);
    context.strokeStyle = isRed ? RED_TRAIL : BLACK_TRAIL;
    context.lineWidth = particle.kind === "neutrino" ? 0.65 : 0.8;
    context.stroke();
  }

  function renderNucleon(x, y, kind) {
    context.beginPath();
    context.arc(x, y, NUCLEON_RADIUS_PX, 0, Math.PI * 2);
    context.fillStyle = kind === "proton" ? RED : BLACK;
    context.fill();

    context.beginPath();
    context.arc(
      x - NUCLEON_RADIUS_PX * 0.3,
      y - NUCLEON_RADIUS_PX * 0.32,
      NUCLEON_RADIUS_PX * 0.22,
      0,
      Math.PI * 2,
    );
    context.fillStyle = HIGHLIGHT;
    context.fill();
  }

  function renderNucleus(particle) {
    const scale = cssHeight;
    const x = particle.x * scale;
    const y = particle.y * scale;
    const species = SPECIES[particle.kind];
    const rotation = particle.phase + particle.spin * simulationTime;

    context.save();
    context.translate(x, y);
    context.rotate(rotation);

    for (const [offsetX, offsetY, nucleon] of species.nucleons) {
      renderNucleon(offsetX, offsetY, nucleon);
    }

    if (
      particle.kind === "beryllium8" &&
      particle.decayAt !== null &&
      particle.decayAt > particle.bornAt
    ) {
      const lifetime = particle.decayAt - particle.bornAt;
      const remainingFraction = clamp(
        (particle.decayAt - simulationTime) / lifetime,
        0,
        1,
      );
      context.beginPath();
      context.arc(
        0,
        0,
        10.5,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * remainingFraction,
      );
      context.strokeStyle = "rgba(43, 40, 33, 0.32)";
      context.lineWidth = 0.75;
      context.setLineDash([1.5, 2.2]);
      context.stroke();
      context.setLineDash([]);
    }

    context.restore();
  }

  function renderPositron(particle) {
    const scale = cssHeight;
    const x = particle.x * scale;
    const y = particle.y * scale;

    context.beginPath();
    context.arc(x, y, 1.65, 0, Math.PI * 2);
    context.fillStyle = RED;
    context.fill();

    context.beginPath();
    context.arc(x, y, 3.2, 0, Math.PI * 2);
    context.strokeStyle = "rgba(144, 52, 38, 0.36)";
    context.lineWidth = 0.7;
    context.stroke();
  }

  function radiationDirection(particle) {
    const length = Math.hypot(particle.px, particle.py);

    if (length <= Number.EPSILON) {
      return { x: 1, y: 0, angle: 0 };
    }

    return {
      x: particle.px / length,
      y: particle.py / length,
      angle: Math.atan2(particle.py, particle.px),
    };
  }

  function renderNeutrino(particle) {
    const scale = cssHeight;
    const x = particle.x * scale;
    const y = particle.y * scale;
    const direction = radiationDirection(particle);

    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - direction.x * 17, y - direction.y * 17);
    context.strokeStyle = "rgba(43, 40, 33, 0.42)";
    context.lineWidth = 0.75;
    context.stroke();

    context.beginPath();
    context.arc(x, y, 1.45, 0, Math.PI * 2);
    context.fillStyle = BLACK;
    context.fill();
  }

  function renderPhoton(particle) {
    const scale = cssHeight;
    const x = particle.x * scale;
    const y = particle.y * scale;
    const direction = radiationDirection(particle);

    context.save();
    context.translate(x, y);
    context.rotate(direction.angle);
    context.beginPath();
    context.moveTo(-1, 0);

    for (let distance = 2; distance <= 30; distance += 1) {
      context.lineTo(-distance, Math.sin(distance * 0.78) * 2.1);
    }

    context.strokeStyle = "rgba(43, 40, 33, 0.58)";
    context.lineWidth = 0.85;
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 1.4, 0, Math.PI * 2);
    context.fillStyle = BLACK;
    context.fill();
    context.restore();
  }

  function renderParticle(particle) {
    if (MASSIVE_KINDS.has(particle.kind)) {
      renderNucleus(particle);
    } else if (particle.kind === "positron") {
      renderPositron(particle);
    } else if (particle.kind === "neutrino") {
      renderNeutrino(particle);
    } else if (particle.kind === "photon") {
      renderPhoton(particle);
    }
  }

  function renderReactionFlashes() {
    const scale = cssHeight;
    context.save();
    context.font = '9px "SFMono-Regular", Consolas, monospace';
    context.textAlign = "center";
    context.textBaseline = "bottom";

    for (const flash of reactionFlashes) {
      const progress = clamp(
        (simulationTime - flash.startedAt) / REACTION_FLASH_SECONDS,
        0,
        1,
      );
      const alpha = Math.sin(progress * Math.PI);
      const x = flash.x * scale;
      const y = flash.y * scale;

      context.beginPath();
      context.arc(x, y, 5 + progress * 15, 0, Math.PI * 2);
      context.strokeStyle = flash.color.replace(
        /[\d.]+\)$/,
        `${(alpha * 0.45).toFixed(3)})`,
      );
      context.lineWidth = 0.8;
      context.stroke();
      // Reaction labels are intentionally hidden for now; uncomment these
      // lines to restore the text without changing the reaction data.
      // context.fillStyle = `rgba(43, 40, 33, ${(alpha * 0.72).toFixed(3)})`;
      // context.fillText(flash.label, x, y - 10 - progress * 8);
    }

    context.restore();
  }

  function render() {
    context.clearRect(0, 0, cssWidth, cssHeight);

    for (const particle of particles) {
      renderTrace(particle);
    }

    for (const particle of particles) {
      renderParticle(particle);
    }

    renderReactionFlashes();
  }

  function shouldAnimate() {
    return !motionPreference.matches && isIntersecting && !document.hidden;
  }

  function updateAnimationState() {
    if (shouldAnimate() && animationFrame === null) {
      previousTime = performance.now();
      animationFrame = window.requestAnimationFrame(animationLoop);
    } else if (!shouldAnimate() && animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function animationLoop(currentTime) {
    animationFrame = null;
    const elapsed = Math.min((currentTime - previousTime) / 1000, 0.05);
    previousTime = currentTime;
    accumulator += elapsed;

    let substeps = 0;

    while (
      accumulator >= config.fixedStepSeconds &&
      substeps < config.maxSubsteps
    ) {
      accumulator -= config.fixedStepSeconds;
      substeps += 1;

      if (simulate(config.fixedStepSeconds)) {
        initializeParticles();
        break;
      }
    }

    if (substeps === config.maxSubsteps) {
      accumulator = Math.min(accumulator, config.fixedStepSeconds);
    }

    render();
    updateEnergyReadout(currentTime);
    updateAnimationState();
  }

  canvas.addEventListener("pointerdown", beginPointerSpawning);
  canvas.addEventListener("pointermove", updatePointerSpawnPosition);
  canvas.addEventListener("pointerup", endPointerSpawning);
  canvas.addEventListener("pointercancel", endPointerSpawning);
  canvas.addEventListener("lostpointercapture", endPointerSpawning);
  canvas.addEventListener("keydown", beginKeyboardSpawning);
  canvas.addEventListener("keyup", endKeyboardSpawning);
  canvas.addEventListener("click", handleSyntheticClick);
  canvas.addEventListener("blur", stopProtonSpawning);
  window.addEventListener("blur", stopProtonSpawning);

  motionPreference.addEventListener("change", () => {
    initializeParticles();
    render();
    updateAnimationState();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopProtonSpawning();
    }

    updateAnimationState();
  });

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(banner);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }

  if ("IntersectionObserver" in window) {
    const bannerObserver = new IntersectionObserver((entries) => {
      isIntersecting = entries[0]?.isIntersecting ?? true;

      if (!isIntersecting) {
        stopProtonSpawning();
      }

      updateAnimationState();
    });
    bannerObserver.observe(banner);
  }

  window.fusionBanner = Object.freeze({
    config,
    getSnapshot: () => ({
      simulationTime,
      particleCounts: particleCounts(),
      kineticEnergyMeV: kineticEnergyMeV(),
      restEnergyMeV: restEnergyMeV(),
      totalEnergyMeV: conservedEnergyMeV(),
      expectedTotalEnergyMeV: expectedTotalEnergyMeV(),
      energyDriftMeV: conservedEnergyMeV() - expectedTotalEnergyMeV(),
      escapedTotalEnergyMeV,
      escapedRestEnergyMeV,
      injectedProtonCount,
      injectedTotalEnergyMeV,
      protonSpawning: activeSpawnSource !== null,
      protonSpawnBlocked: banner.dataset.protonSpawnBlocked === "true",
      particleLoad: particleLoadWithDecayHeadroom(),
      particles: particles.map(({ id, kind, massMeV, x, y, px, py }) => ({
        id,
        kind,
        massMeV,
        x,
        y,
        px,
        py,
      })),
    }),
  });

  resizeCanvas();
  render();
  updateEnergyReadout(performance.now(), true);
  updateAnimationState();
}

function initializeNavigation() {
  const navigationLinks = Array.from(
    document.querySelectorAll("[data-nav-link]"),
  );
  const sections = navigationLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter((section) => section instanceof HTMLElement);

  function setCurrentNavigation(section) {
    for (const link of navigationLinks) {
      const isCurrent = link.getAttribute("href") === `#${section.id}`;

      if (isCurrent) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  if ("IntersectionObserver" in window && sections.length > 0) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const pageBottom = window.scrollY + window.innerHeight;
        const documentBottom = document.documentElement.scrollHeight;

        if (pageBottom >= documentBottom - 2) {
          setCurrentNavigation(sections[sections.length - 1]);
          return;
        }

        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              second.intersectionRatio - first.intersectionRatio,
          )[0];

        if (visibleEntry !== undefined) {
          setCurrentNavigation(visibleEntry.target);
        }
      },
      { rootMargin: "-20% 0px -58%", threshold: [0.05, 0.25, 0.5] },
    );

    for (const section of sections) {
      sectionObserver.observe(section);
    }
  }
}
