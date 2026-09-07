import assert from "node:assert/strict";
import test from "node:test";

import {
  MASS_MEV,
  REACTION_Q_MEV,
  addFourMomenta,
  boostFourMomentum,
  elasticScatter,
  energyFromMomentum,
  fourMomentum,
  invariantMass,
  kineticEnergy,
  sumParticleEnergy,
  sumParticleKineticEnergy,
  sumParticleRestEnergy,
  threeBodyFinalState,
  twoBodyFinalState,
} from "../site/fusion-physics.js";

const CONSERVATION_TOLERANCE = 2e-10;

function assertClose(actual, expected, tolerance = CONSERVATION_TOLERANCE) {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= tolerance * scale,
    `expected ${actual} to be within ${tolerance * scale} of ${expected}`,
  );
}

function assertFourMomentumConserved(before, particles) {
  const after = addFourMomenta(
    particles.map(({ energy, px, py }) => ({ energy, px, py })),
  );

  assertClose(after.energy, before.energy);
  assertClose(after.px, before.px);
  assertClose(after.py, before.py);
}

function assertOnShell(particle, expectedMass) {
  assertClose(invariantMass(particle), expectedMass);
  assert.equal(particle.massMeV, expectedMass);
}

function sequenceRandom(samples) {
  let index = 0;

  return () => {
    assert.ok(index < samples.length, "random source was sampled too often");
    const sample = samples[index];
    index += 1;
    return sample;
  };
}

test("CODATA and AME2020 masses derive the fusion Q values", () => {
  assert.equal(MASS_MEV.proton, 938.27208943);
  assert.equal(MASS_MEV.neutron, 939.56542194);
  assert.equal(MASS_MEV.positron, 0.51099895069);
  assert.equal(MASS_MEV.e, MASS_MEV.positron);
  assert.equal(MASS_MEV.deuteron, 1875.612945);
  assert.equal(MASS_MEV.helion, 2808.39161112);
  assertClose(MASS_MEV.alpha, 3727.379411856354, 1e-12);
  assertClose(MASS_MEV.beryllium8, 7454.850904338512, 1e-12);
  assertClose(MASS_MEV.carbon12, 11174.864281044, 1e-12);
  assert.equal(MASS_MEV.neutrino, 0);
  assert.equal(MASS_MEV.photon, 0);

  assertClose(
    REACTION_Q_MEV.protonProton,
    2 * MASS_MEV.proton - MASS_MEV.deuteron - MASS_MEV.positron,
  );
  assertClose(
    REACTION_Q_MEV.deuteriumProton,
    MASS_MEV.deuteron + MASS_MEV.proton - MASS_MEV.helion,
  );
  assertClose(
    REACTION_Q_MEV.helium3Helium3,
    2 * MASS_MEV.helion - MASS_MEV.alpha - 2 * MASS_MEV.proton,
  );
  assertClose(REACTION_Q_MEV.protonProton, 0.42023490931, 1e-12);
  assertClose(REACTION_Q_MEV.deuteriumProton, 5.49342331, 1e-12);
  assertClose(REACTION_Q_MEV.helium3Helium3, 12.859631523646, 1e-12);
  assertClose(REACTION_Q_MEV.beryllium8Decay, 0.092080625795, 1e-12);
  assertClose(REACTION_Q_MEV.beryllium8Alpha, 7.3660351505, 1e-10);
  assertClose(REACTION_Q_MEV.tripleAlpha, 7.273954524706, 1e-10);
  assertClose(
    REACTION_Q_MEV.beryllium8Alpha - REACTION_Q_MEV.beryllium8Decay,
    REACTION_Q_MEV.tripleAlpha,
    1e-12,
  );
});

test("energy helpers are relativistic, stable, and finite", () => {
  assert.equal(energyFromMomentum(0, 3, 4), 5);
  assert.equal(kineticEnergy(0, 3, 4), 5);
  assertClose(energyFromMomentum(12, 3, 4), 13);
  assertClose(kineticEnergy(12, 3, 4), 1);
  assert.deepEqual(fourMomentum({ massMeV: 12, px: 3, py: 4 }), {
    energy: 13,
    px: 3,
    py: 4,
  });

  const tinyKineticEnergy = kineticEnergy(1e12, 1e-3, 0);
  assert.ok(Number.isFinite(tinyKineticEnergy));
  assert.ok(tinyKineticEnergy > 0);
  assert.throws(() => energyFromMomentum(-1, 0, 0), RangeError);
  assert.throws(() => kineticEnergy(1, Number.NaN, 0), TypeError);
  assert.throws(
    () => boostFourMomentum(fourMomentum(1, 0, 0), 1, 0),
    RangeError,
  );

  const original = { energy: 5, px: 3, py: 0 };
  const boosted = boostFourMomentum(original, 0.3, 0.4);
  const roundTrip = boostFourMomentum(boosted, -0.3, -0.4);
  assertClose(invariantMass(boosted), invariantMass(original));
  assertClose(roundTrip.energy, original.energy);
  assertClose(roundTrip.px, original.px);
  assertClose(roundTrip.py, original.py);

  const mixedParticles = [
    { massMeV: 12, px: 3, py: 4 },
    { massMeV: 0, px: 0, py: 5 },
  ];
  assert.equal(sumParticleRestEnergy(mixedParticles), 12);
  assertClose(
    sumParticleEnergy(mixedParticles),
    sumParticleRestEnergy(mixedParticles) +
      sumParticleKineticEnergy(mixedParticles),
  );
});

test("two-body final states conserve four-momentum in a boosted lab frame", () => {
  for (const [parentMass, daughterMasses, angle] of [
    [10, [3, 2], 0.73],
    [7, [2, 0], -1.17],
    [7, [0, 0], 0.4],
  ]) {
    const parent = boostFourMomentum(
      { energy: parentMass, px: 0, py: 0 },
      0.31,
      -0.22,
    );
    const products = twoBodyFinalState(
      parent,
      daughterMasses[0],
      daughterMasses[1],
      angle,
    );

    assertFourMomentumConserved(parent, products);
    assertOnShell(products[0], daughterMasses[0]);
    assertOnShell(products[1], daughterMasses[1]);
    assert.ok(products.every((particle) => particle.energy >= 0));
  }

  assert.throws(
    () => twoBodyFinalState({ energy: 4, px: 0, py: 0 }, 3, 2, 0),
    RangeError,
  );

  const boostedThreshold = boostFourMomentum(
    { energy: 7, px: 0, py: 0 },
    0.8,
    0.1,
  );
  const thresholdProducts = twoBodyFinalState(boostedThreshold, 3, 4, 0.4);
  assertFourMomentumConserved(boostedThreshold, thresholdProducts);
  assertOnShell(thresholdProducts[0], 3);
  assertOnShell(thresholdProducts[1], 4);
});

test("sequential three-body final state conserves energy and momentum", () => {
  const parent = boostFourMomentum(
    { energy: 20, px: 0, py: 0 },
    -0.27,
    0.19,
  );
  const masses = [3, 2, 0];
  const products = threeBodyFinalState(
    parent,
    masses,
    sequenceRandom([0.37, 0, 0.13, 0.83]),
  );

  assert.equal(products.length, 3);
  assertFourMomentumConserved(parent, products);
  products.forEach((particle, index) => assertOnShell(particle, masses[index]));
  const sampledCluster = addFourMomenta(products.slice(1));
  const expectedClusterSquared = 4 + 0.37 * (17 ** 2 - 4);
  assertClose(invariantMass(sampledCluster) ** 2, expectedClusterSquared);
  assert.ok(products[2].energy > 0, "massless product must carry energy");
  assertClose(sumParticleEnergy(products), parent.energy);
  assert.ok(Number.isFinite(sumParticleKineticEnergy(products)));
  assert.ok(sumParticleKineticEnergy(products) >= 0);

  const boostedThreshold = boostFourMomentum(
    { energy: 7, px: 0, py: 0 },
    0.8,
    0.1,
  );
  const thresholdProducts = threeBodyFinalState(
    boostedThreshold,
    [2, 3, 2],
    sequenceRandom([0.2, 0.7]),
  );
  assertFourMomentumConserved(boostedThreshold, thresholdProducts);
  thresholdProducts.forEach((particle, index) =>
    assertOnShell(particle, [2, 3, 2][index]),
  );

  const fallbackParent = { energy: 10, px: 0, py: 0 };
  const fallbackProducts = threeBodyFinalState(
    fallbackParent,
    [1, 1, 1],
    () => 0.999999,
  );
  assertFourMomentumConserved(fallbackParent, fallbackProducts);

  const allMasslessProducts = threeBodyFinalState(
    fallbackParent,
    [0, 0, 0],
    sequenceRandom([0, 0, 0.2, 0.7]),
  );
  assertFourMomentumConserved(fallbackParent, allMasslessProducts);
  allMasslessProducts.forEach((particle) => assertOnShell(particle, 0));

  for (const [betaX, betaY] of [
    [0.1, 0.2],
    [0.8, 0.1],
    [-0.65, 0.5],
  ]) {
    const masslessThresholdParent = boostFourMomentum(
      { energy: 7, px: 0, py: 0 },
      betaX,
      betaY,
    );
    const masslessThresholdProducts = threeBodyFinalState(
      masslessThresholdParent,
      [7, 0, 0],
      sequenceRandom([0.2, 0.7]),
    );
    assertFourMomentumConserved(
      masslessThresholdParent,
      masslessThresholdProducts,
    );
    masslessThresholdProducts.forEach((particle, index) =>
      assertOnShell(particle, [7, 0, 0][index]),
    );
  }
});

test("rest-frame reaction kinetic-energy release equals each Q value", () => {
  const ppProducts = threeBodyFinalState(
    { energy: 2 * MASS_MEV.proton, px: 0, py: 0 },
    [MASS_MEV.deuteron, MASS_MEV.positron, MASS_MEV.neutrino],
    sequenceRandom([0.4, 0, 0.2, 0.7]),
  );
  assertClose(
    sumParticleKineticEnergy(ppProducts),
    REACTION_Q_MEV.protonProton,
  );

  const deuteriumProtonProducts = twoBodyFinalState(
    {
      energy: MASS_MEV.deuteron + MASS_MEV.proton,
      px: 0,
      py: 0,
    },
    MASS_MEV.helion,
    MASS_MEV.photon,
    0.9,
  );
  assertClose(
    sumParticleKineticEnergy(deuteriumProtonProducts),
    REACTION_Q_MEV.deuteriumProton,
  );

  const helium3Products = threeBodyFinalState(
    { energy: 2 * MASS_MEV.helion, px: 0, py: 0 },
    [MASS_MEV.alpha, MASS_MEV.proton, MASS_MEV.proton],
    sequenceRandom([0.6, 0, 0.1, 0.8]),
  );
  assertClose(
    sumParticleKineticEnergy(helium3Products),
    REACTION_Q_MEV.helium3Helium3,
  );

  const beryllium8Products = twoBodyFinalState(
    { energy: MASS_MEV.beryllium8, px: 0, py: 0 },
    MASS_MEV.alpha,
    MASS_MEV.alpha,
    0.35,
  );
  assertClose(
    sumParticleKineticEnergy(beryllium8Products),
    REACTION_Q_MEV.beryllium8Decay,
  );

  const carbonProducts = twoBodyFinalState(
    {
      energy: MASS_MEV.beryllium8 + MASS_MEV.alpha,
      px: 0,
      py: 0,
    },
    MASS_MEV.carbon12,
    MASS_MEV.photon,
    -0.7,
  );
  assertClose(
    sumParticleKineticEnergy(carbonProducts),
    REACTION_Q_MEV.beryllium8Alpha,
  );
});

test("moving triple-alpha intermediates conserve four-momentum", () => {
  const centreMomentum = 20;
  const boostX = 0.14;
  const boostY = -0.09;
  const firstAlpha = boostFourMomentum(
    fourMomentum(MASS_MEV.alpha, centreMomentum, 0),
    boostX,
    boostY,
  );
  const secondAlpha = boostFourMomentum(
    fourMomentum(MASS_MEV.alpha, -centreMomentum, 0),
    boostX,
    boostY,
  );
  const resonance = addFourMomenta(firstAlpha, secondAlpha);

  assert.ok(invariantMass(resonance) > MASS_MEV.beryllium8);
  const decayProducts = twoBodyFinalState(
    resonance,
    MASS_MEV.alpha,
    MASS_MEV.alpha,
    1.1,
  );
  assertFourMomentumConserved(resonance, decayProducts);
  decayProducts.forEach((particle) => assertOnShell(particle, MASS_MEV.alpha));

  const thirdAlpha = boostFourMomentum(
    fourMomentum(MASS_MEV.alpha, 0, 0),
    boostX,
    boostY,
  );
  const captureInitialState = addFourMomenta(resonance, thirdAlpha);
  const captureProducts = twoBodyFinalState(
    captureInitialState,
    MASS_MEV.carbon12,
    MASS_MEV.photon,
    -0.45,
  );
  assertFourMomentumConserved(captureInitialState, captureProducts);
  assertOnShell(captureProducts[0], MASS_MEV.carbon12);
  assertOnShell(captureProducts[1], MASS_MEV.photon);
});

test("a direct pp reaction conserves four-momentum in a moving frame", () => {
  const centreMomentum = 0.25;
  const firstCentre = fourMomentum(MASS_MEV.proton, centreMomentum, 0);
  const secondCentre = fourMomentum(MASS_MEV.proton, -centreMomentum, 0);
  const firstLab = boostFourMomentum(firstCentre, 0.12, -0.08);
  const secondLab = boostFourMomentum(secondCentre, 0.12, -0.08);
  const ppInitialState = addFourMomenta(firstLab, secondLab);
  const expectedInvariantMass =
    2 * energyFromMomentum(MASS_MEV.proton, centreMomentum, 0);

  assertClose(invariantMass(ppInitialState), expectedInvariantMass);
  assert.ok(
    invariantMass(ppInitialState) > MASS_MEV.deuteron + MASS_MEV.positron,
  );

  const products = threeBodyFinalState(
    ppInitialState,
    [MASS_MEV.deuteron, MASS_MEV.positron, MASS_MEV.neutrino],
    sequenceRandom([0.42, 0, 0.7, 0.19]),
  );

  assertFourMomentumConserved(ppInitialState, products);
  assertOnShell(products[0], MASS_MEV.deuteron);
  assertOnShell(products[1], MASS_MEV.positron);
  assertOnShell(products[2], MASS_MEV.neutrino);
  assert.ok(products.every((particle) => Number.isFinite(particle.energy)));
});

test("elastic scattering preserves masses, energy, momentum, and kinetic energy", () => {
  const first = { massMeV: MASS_MEV.proton, px: 7.5, py: -1.2 };
  const second = { massMeV: MASS_MEV.alpha, px: -0.4, py: 0.8 };
  const before = addFourMomenta(
    fourMomentum(first.massMeV, first.px, first.py),
    fourMomentum(second.massMeV, second.px, second.py),
  );
  const beforeKinetic = sumParticleKineticEnergy([first, second]);
  const products = elasticScatter(first, second, 1.31);

  assertFourMomentumConserved(before, products);
  assertOnShell(products[0], first.massMeV);
  assertOnShell(products[1], second.massMeV);
  assertClose(sumParticleKineticEnergy(products), beforeKinetic);
  assert.ok(
    products.every((particle) =>
      Number.isFinite(
        kineticEnergy(particle.massMeV, particle.px, particle.py),
      ),
    ),
  );
});
