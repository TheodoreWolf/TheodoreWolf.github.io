/**
 * Dependency-free relativistic kinematics for the fusion banner.
 *
 * Energies and masses are in MeV, momenta are in MeV/c, and c = 1.
 */

// Rest-energy equivalents from NIST's 2022 CODATA recommended values:
// https://physics.nist.gov/cuu/Constants/ (nuclear masses, in MeV).
const PROTON_MASS_MEV = 938.27208943;
const NEUTRON_MASS_MEV = 939.56542194;
const ELECTRON_MASS_MEV = 0.51099895069;
const DEUTERON_MASS_MEV = 1875.612945;
const HELION_MASS_MEV = 2808.39161112;
const ATOMIC_MASS_CONSTANT_MEV = 931.49410372;
const HELIUM4_ATOMIC_MASS_U = 4.00260325413;
const BERYLLIUM8_ATOMIC_MASS_U = 8.005305102;
const HELIUM_ELECTRON_BINDING_MEV = 0.0000790051545392;
const BERYLLIUM_ELECTRON_BINDING_MEV = 0.00039914863159;
const CARBON_ELECTRON_BINDING_MEV = 0.001030108499;

// AME2020 neutral-atom masses are converted to fully stripped nuclei using
// M_nucleus = M_atom - Z m_e + total electron binding energy. This keeps the
// alpha, 8Be, and 12C masses in one convention throughout the energy ledger:
// https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt
// https://physics.nist.gov/PhysRefData/ASD/ionEnergy.html
const ALPHA_MASS_MEV =
  HELIUM4_ATOMIC_MASS_U * ATOMIC_MASS_CONSTANT_MEV -
  2 * ELECTRON_MASS_MEV +
  HELIUM_ELECTRON_BINDING_MEV;
const BERYLLIUM8_MASS_MEV =
  BERYLLIUM8_ATOMIC_MASS_U * ATOMIC_MASS_CONSTANT_MEV -
  4 * ELECTRON_MASS_MEV +
  BERYLLIUM_ELECTRON_BINDING_MEV;
const CARBON12_MASS_MEV =
  12 * ATOMIC_MASS_CONSTANT_MEV -
  6 * ELECTRON_MASS_MEV +
  CARBON_ELECTRON_BINDING_MEV;

export const MASS_MEV = Object.freeze({
  p: PROTON_MASS_MEV,
  proton: PROTON_MASS_MEV,
  neutron: NEUTRON_MASS_MEV,
  electron: ELECTRON_MASS_MEV,
  positron: ELECTRON_MASS_MEV,
  e: ELECTRON_MASS_MEV,
  eMinus: ELECTRON_MASS_MEV,
  ePlus: ELECTRON_MASS_MEV,
  "e-": ELECTRON_MASS_MEV,
  "e+": ELECTRON_MASS_MEV,
  d: DEUTERON_MASS_MEV,
  deuterium: DEUTERON_MASS_MEV,
  deuteron: DEUTERON_MASS_MEV,
  he3: HELION_MASS_MEV,
  He3: HELION_MASS_MEV,
  helium3: HELION_MASS_MEV,
  helion: HELION_MASS_MEV,
  he4: ALPHA_MASS_MEV,
  He4: ALPHA_MASS_MEV,
  helium4: ALPHA_MASS_MEV,
  alpha: ALPHA_MASS_MEV,
  be8: BERYLLIUM8_MASS_MEV,
  Be8: BERYLLIUM8_MASS_MEV,
  beryllium8: BERYLLIUM8_MASS_MEV,
  c12: CARBON12_MASS_MEV,
  C12: CARBON12_MASS_MEV,
  carbon12: CARBON12_MASS_MEV,
  neutrino: 0,
  photon: 0,
});

export const REACTION_Q_MEV = Object.freeze({
  protonProton:
    2 * MASS_MEV.proton - MASS_MEV.deuteron - MASS_MEV.positron,
  deuteriumProton:
    MASS_MEV.deuteron + MASS_MEV.proton - MASS_MEV.helion,
  helium3Helium3:
    2 * MASS_MEV.helion - MASS_MEV.alpha - 2 * MASS_MEV.proton,
  beryllium8Decay: MASS_MEV.beryllium8 - 2 * MASS_MEV.alpha,
  beryllium8Alpha:
    MASS_MEV.beryllium8 + MASS_MEV.alpha - MASS_MEV.carbon12,
  tripleAlpha: 3 * MASS_MEV.alpha - MASS_MEV.carbon12,
});

const ROUNDING_ULPS = 64;
const MAX_PHASE_SPACE_ATTEMPTS = 128;

function requireFinite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }

  return value;
}

function requireMass(value, label = "massMeV") {
  const mass = requireFinite(value, label);

  if (mass < 0) {
    throw new RangeError(`${label} must be nonnegative`);
  }

  return mass;
}

function requireFourMomentum(value, label = "four-momentum") {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${label} must be an object`);
  }

  const energy = requireFinite(value.energy, `${label}.energy`);
  const px = requireFinite(value.px, `${label}.px`);
  const py = requireFinite(value.py, `${label}.py`);

  if (energy < 0) {
    throw new RangeError(`${label}.energy must be nonnegative`);
  }

  return { energy, px, py };
}

function requireParticle(value, label = "particle") {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${label} must be an object`);
  }

  const rawMass = value.massMeV ?? value.mass;
  const massMeV = requireMass(rawMass, `${label}.massMeV`);
  const px = requireFinite(value.px, `${label}.px`);
  const py = requireFinite(value.py, `${label}.py`);

  return { massMeV, px, py };
}

function particleFromFourMomentum(massMeV, value) {
  return {
    massMeV,
    energy: value.energy,
    px: value.px,
    py: value.py,
  };
}

function requireRandomSample(random, label) {
  const sample = requireFinite(random(), label);

  if (sample < 0 || sample >= 1) {
    throw new RangeError(`${label} must be in [0, 1)`);
  }

  return sample;
}

function kallenFactor(parentMass, firstMass, secondMass) {
  if (parentMass === 0) {
    return firstMass === 0 && secondMass === 0 ? 1 : 0;
  }

  const sumRatio = (firstMass + secondMass) / parentMass;
  const differenceRatio = Math.abs(firstMass - secondMass) / parentMass;
  const sumFactor = Math.max(0, (1 - sumRatio) * (1 + sumRatio));
  const differenceFactor = Math.max(
    0,
    (1 - differenceRatio) * (1 + differenceRatio),
  );

  return Math.sqrt(sumFactor * differenceFactor);
}

function kallenRoot(parentMass, firstMass, secondMass) {
  const root =
    parentMass *
    (parentMass * kallenFactor(parentMass, firstMass, secondMass));

  if (!Number.isFinite(root)) {
    throw new RangeError("the Källén factor is outside the finite range");
  }

  return root;
}

function requireReactionThreshold(parentMass, daughterMassSum, label) {
  const tolerance =
    ROUNDING_ULPS *
    Number.EPSILON *
    Math.max(1, parentMass, daughterMassSum);

  if (parentMass < daughterMassSum - tolerance) {
    throw new RangeError(
      `parent invariant mass is below the ${label} threshold`,
    );
  }

  if (Math.abs(parentMass - daughterMassSum) <= tolerance) {
    return daughterMassSum;
  }

  return parentMass;
}

function threeBodyPhaseSpaceWeight(
  parentMass,
  firstMass,
  secondMass,
  thirdMass,
  clusterMass,
) {
  // This is sqrt(lambda(W^2,m1^2,u)) * sqrt(lambda(u,m2^2,m3^2)) / u,
  // with the second ratio evaluated directly to remain stable as u -> 0.
  return (
    kallenRoot(parentMass, firstMass, clusterMass) *
    kallenFactor(clusterMass, secondMass, thirdMass)
  );
}

/** Return the on-shell total energy sqrt(m^2 + |p|^2). */
export function energyFromMomentum(massMeV, px, py) {
  const mass = requireMass(massMeV);
  const momentumX = requireFinite(px, "px");
  const momentumY = requireFinite(py, "py");
  const energy = Math.hypot(mass, momentumX, momentumY);

  if (!Number.isFinite(energy)) {
    throw new RangeError("the resulting energy is outside the finite range");
  }

  return energy;
}

/** Return E - mc^2 without catastrophic cancellation at low momentum. */
export function kineticEnergy(massMeV, px, py) {
  const mass = requireMass(massMeV);
  const momentumX = requireFinite(px, "px");
  const momentumY = requireFinite(py, "py");
  const momentum = Math.hypot(momentumX, momentumY);

  if (!Number.isFinite(momentum)) {
    throw new RangeError("the momentum magnitude is outside the finite range");
  }

  if (mass === 0) {
    return momentum;
  }

  const energy = energyFromMomentum(mass, momentumX, momentumY);
  const denominator = energy + mass;

  if (!Number.isFinite(denominator)) {
    return Math.max(0, energy - mass);
  }

  return momentum * (momentum / denominator);
}

/** Construct an on-shell four-momentum from (mass, px, py) or a particle. */
export function fourMomentum(massMeV, px, py) {
  const particle =
    massMeV !== null && typeof massMeV === "object"
      ? requireParticle(massMeV)
      : {
          massMeV: requireMass(massMeV),
          px: requireFinite(px, "px"),
          py: requireFinite(py, "py"),
        };

  return {
    energy: energyFromMomentum(particle.massMeV, particle.px, particle.py),
    px: particle.px,
    py: particle.py,
  };
}

/** Add either an array of four-momenta or variadic four-momentum arguments. */
export function addFourMomenta(...values) {
  const momenta =
    values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  let energy = 0;
  let px = 0;
  let py = 0;

  for (let index = 0; index < momenta.length; index += 1) {
    const momentum = requireFourMomentum(
      momenta[index],
      `four-momenta[${index}]`,
    );
    energy += momentum.energy;
    px += momentum.px;
    py += momentum.py;
  }

  if (![energy, px, py].every(Number.isFinite)) {
    throw new RangeError("the summed four-momentum is outside the finite range");
  }

  return { energy, px, py };
}

/** Return sqrt(E^2 - |p|^2), rejecting genuinely spacelike inputs. */
export function invariantMass(value) {
  const momentum = requireFourMomentum(value);
  const spatialMagnitude = Math.hypot(momentum.px, momentum.py);
  const deficit = spatialMagnitude - momentum.energy;
  const tolerance =
    ROUNDING_ULPS *
    Number.EPSILON *
    Math.max(1, spatialMagnitude, momentum.energy);

  if (deficit > tolerance) {
    throw new RangeError("four-momentum must be timelike or null");
  }

  if (Math.abs(momentum.energy - spatialMagnitude) <= tolerance) {
    return 0;
  }

  const lowerFactor = Math.max(0, momentum.energy - spatialMagnitude);
  const upperFactor = momentum.energy + spatialMagnitude;
  const mass = Math.sqrt(lowerFactor) * Math.sqrt(upperFactor);

  if (!Number.isFinite(mass)) {
    throw new RangeError("the invariant mass is outside the finite range");
  }

  return mass;
}

/**
 * Apply an active Lorentz boost with velocity (betaX, betaY).
 * Positive beta sends a rest particle in the positive-beta direction.
 */
export function boostFourMomentum(value, betaX, betaY) {
  const momentum = requireFourMomentum(value);
  const velocityX = requireFinite(betaX, "betaX");
  const velocityY = requireFinite(betaY, "betaY");
  const betaMagnitude = Math.hypot(velocityX, velocityY);

  if (betaMagnitude >= 1) {
    throw new RangeError("boost speed must be less than the speed of light");
  }

  if (betaMagnitude === 0) {
    return { ...momentum };
  }

  const gamma = 1 / Math.sqrt((1 - betaMagnitude) * (1 + betaMagnitude));
  const betaDotMomentum =
    velocityX * momentum.px + velocityY * momentum.py;
  const parallelCoefficient =
    (gamma / (1 + 1 / gamma)) * betaDotMomentum +
    gamma * momentum.energy;
  const boosted = {
    energy: gamma * (momentum.energy + betaDotMomentum),
    px: momentum.px + parallelCoefficient * velocityX,
    py: momentum.py + parallelCoefficient * velocityY,
  };

  if (![boosted.energy, boosted.px, boosted.py].every(Number.isFinite)) {
    throw new RangeError("the boosted four-momentum is outside the finite range");
  }

  return boosted;
}

/**
 * Produce an exact two-body final state in the supplied parent's lab frame.
 * The angle specifies particle A's direction in the centre-of-momentum frame.
 */
export function twoBodyFinalState(
  totalFour,
  massA,
  massB,
  angleRadians,
) {
  const parent = requireFourMomentum(totalFour, "totalFour");
  const firstMass = requireMass(massA, "massA");
  const secondMass = requireMass(massB, "massB");
  const angle = requireFinite(angleRadians, "angleRadians");
  const measuredParentMass = invariantMass(parent);

  if (measuredParentMass === 0) {
    throw new RangeError("a two-body parent must have positive invariant mass");
  }

  const daughterMassSum = firstMass + secondMass;

  if (!Number.isFinite(daughterMassSum)) {
    throw new RangeError("the daughter mass threshold is outside the finite range");
  }

  const parentMass = requireReactionThreshold(
    measuredParentMass,
    daughterMassSum,
    "two-body",
  );

  // Factored, dimensionless Källén function avoids subtracting large
  // near-equal squared masses at threshold.
  const centreMomentum =
    0.5 * parentMass * kallenFactor(parentMass, firstMass, secondMass);
  const px = centreMomentum * Math.cos(angle);
  const py = centreMomentum * Math.sin(angle);
  const firstCentre = fourMomentum(firstMass, px, py);
  const secondCentre = fourMomentum(secondMass, -px, -py);
  const betaX = parent.px / parent.energy;
  const betaY = parent.py / parent.energy;
  const firstLab = boostFourMomentum(firstCentre, betaX, betaY);
  const secondLab = boostFourMomentum(secondCentre, betaX, betaY);

  return [
    particleFromFourMomentum(firstMass, firstLab),
    particleFromFourMomentum(secondMass, secondLab),
  ];
}

/**
 * Generate a sequential three-body decay: parent -> 1 + (23), then (23) -> 2 + 3.
 * The intermediate invariant mass squared follows Lorentz-invariant phase
 * space; both COM angles are uniform in this two-dimensional simulation.
 */
export function threeBodyFinalState(
  totalFour,
  daughterMasses,
  random = Math.random,
) {
  const parent = requireFourMomentum(totalFour, "totalFour");

  if (!Array.isArray(daughterMasses) || daughterMasses.length !== 3) {
    throw new TypeError("daughterMasses must contain exactly three masses");
  }

  if (typeof random !== "function") {
    throw new TypeError("random must be a function");
  }

  const masses = daughterMasses.map((mass, index) =>
    requireMass(mass, `daughterMasses[${index}]`),
  );
  const measuredParentMass = invariantMass(parent);
  const daughterMassSum = masses[0] + masses[1] + masses[2];

  if (!Number.isFinite(daughterMassSum)) {
    throw new RangeError("the daughter mass threshold is outside the finite range");
  }

  const parentMass = requireReactionThreshold(
    measuredParentMass,
    daughterMassSum,
    "three-body",
  );

  const clusterMinimum = masses[1] + masses[2];
  const clusterMaximum = parentMass - masses[0];
  const minimumSquared = clusterMinimum * clusterMinimum;
  const maximumSquared = clusterMaximum * clusterMaximum;
  const squaredRange = maximumSquared - minimumSquared;
  const maximumWeight =
    kallenRoot(parentMass, masses[0], clusterMinimum) *
    kallenFactor(clusterMaximum, masses[1], masses[2]);
  let clusterSquared = minimumSquared;
  let bestSquared = minimumSquared;
  let bestWeight = -1;

  if (squaredRange > 0 && maximumWeight > 0) {
    for (let attempt = 0; attempt < MAX_PHASE_SPACE_ATTEMPTS; attempt += 1) {
      let massSample = requireRandomSample(random, "random mass sample");

      // A zero-mass pair cannot be decayed in its rest frame at the exact
      // lower endpoint. That endpoint has measure zero, so remap only it.
      if (minimumSquared === 0 && massSample === 0) {
        massSample = 0.5;
      }

      const candidateSquared = minimumSquared + massSample * squaredRange;
      const candidateMass = Math.sqrt(candidateSquared);
      const candidateWeight = threeBodyPhaseSpaceWeight(
        parentMass,
        masses[0],
        masses[1],
        masses[2],
        candidateMass,
      );

      if (candidateWeight > bestWeight) {
        bestWeight = candidateWeight;
        bestSquared = candidateSquared;
      }

      const acceptanceSample = requireRandomSample(
        random,
        "random acceptance sample",
      );

      if (
        candidateWeight > 0 &&
        acceptanceSample * maximumWeight < candidateWeight
      ) {
        clusterSquared = candidateSquared;
        break;
      }

      if (attempt === MAX_PHASE_SPACE_ATTEMPTS - 1) {
        // An adversarial random source must not hang the animation. Reusing
        // the best bounded proposal preserves exact four-momentum even though
        // this vanishingly rare fallback is not distribution-perfect.
        clusterSquared = bestSquared;
      }
    }
  }

  const firstAngleSample = requireRandomSample(random, "random angle sample");
  const secondAngleSample = requireRandomSample(random, "random angle sample");
  const clusterMass = Math.sqrt(clusterSquared);
  const firstSplit = twoBodyFinalState(
    parent,
    masses[0],
    clusterMass,
    firstAngleSample * 2 * Math.PI,
  );
  const clusterFour = {
    energy: firstSplit[1].energy,
    px: firstSplit[1].px,
    py: firstSplit[1].py,
  };

  if (clusterMass === 0) {
    const halfCluster = {
      energy: clusterFour.energy / 2,
      px: clusterFour.px / 2,
      py: clusterFour.py / 2,
    };

    return [
      firstSplit[0],
      particleFromFourMomentum(masses[1], halfCluster),
      particleFromFourMomentum(masses[2], halfCluster),
    ];
  }

  const secondSplit = twoBodyFinalState(
    clusterFour,
    masses[1],
    masses[2],
    secondAngleSample * 2 * Math.PI,
  );

  return [firstSplit[0], secondSplit[0], secondSplit[1]];
}

/** Sum on-shell particle energies, including massless radiation. */
export function sumParticleEnergy(particles) {
  if (!Array.isArray(particles)) {
    throw new TypeError("particles must be an array");
  }

  return particles.reduce((total, particle, index) => {
    const value = requireParticle(particle, `particles[${index}]`);
    const energy = energyFromMomentum(value.massMeV, value.px, value.py);
    const sum = total + energy;

    if (!Number.isFinite(sum)) {
      throw new RangeError("the particle energy sum is outside the finite range");
    }

    return sum;
  }, 0);
}

/** Sum particle rest-energy equivalents; massless radiation contributes zero. */
export function sumParticleRestEnergy(particles) {
  if (!Array.isArray(particles)) {
    throw new TypeError("particles must be an array");
  }

  return particles.reduce((total, particle, index) => {
    const value = requireParticle(particle, `particles[${index}]`);
    const sum = total + value.massMeV;

    if (!Number.isFinite(sum)) {
      throw new RangeError(
        "the particle rest-energy sum is outside the finite range",
      );
    }

    return sum;
  }, 0);
}

/** Sum relativistic kinetic energies, treating massless-particle energy as kinetic. */
export function sumParticleKineticEnergy(particles) {
  if (!Array.isArray(particles)) {
    throw new TypeError("particles must be an array");
  }

  return particles.reduce((total, particle, index) => {
    const value = requireParticle(particle, `particles[${index}]`);
    const kinetic = kineticEnergy(value.massMeV, value.px, value.py);
    const sum = total + kinetic;

    if (!Number.isFinite(sum)) {
      throw new RangeError(
        "the particle kinetic-energy sum is outside the finite range",
      );
    }

    return sum;
  }, 0);
}

/**
 * Relativistically scatter two on-shell particles without changing their masses.
 * The outgoing angle is measured for the first particle in the COM frame.
 */
export function elasticScatter(first, second, outgoingAngle) {
  const incomingFirst = requireParticle(first, "first");
  const incomingSecond = requireParticle(second, "second");
  const total = addFourMomenta(
    fourMomentum(
      incomingFirst.massMeV,
      incomingFirst.px,
      incomingFirst.py,
    ),
    fourMomentum(
      incomingSecond.massMeV,
      incomingSecond.px,
      incomingSecond.py,
    ),
  );

  return twoBodyFinalState(
    total,
    incomingFirst.massMeV,
    incomingSecond.massMeV,
    outgoingAngle,
  );
}
