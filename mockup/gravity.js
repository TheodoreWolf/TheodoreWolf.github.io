(() => {
  "use strict";

  const canvas = document.getElementById("gravity-canvas");
  const banner = document.getElementById("gravity-banner");
  const energyReadout = document.getElementById("gravity-energy-value");

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(banner instanceof HTMLElement) ||
    !(energyReadout instanceof HTMLElement)
  ) {
    return;
  }

  const context = canvas.getContext("2d", { alpha: true });

  if (context === null) {
    return;
  }

  const FIXED_STEP = 1 / 120;
  const MAX_SUBSTEPS = 6;
  const GRAVITY = 0.0035;
  const INTERACTION_RANGE_SCALE = 1.1;
  const BODY_MASS_SCALE = 1.1;
  const SOFTENING = 0.027;
  const REPULSION_RADIUS = 0.052 * INTERACTION_RANGE_SCALE;
  const REPULSION_STIFFNESS = 750;
  const REPULSION_DAMPING = 0;
  const CURSOR_SOFTENING = 0.095 * INTERACTION_RANGE_SCALE;
  const CURSOR_REPULSION_RADIUS = 0.28 * INTERACTION_RANGE_SCALE * 0.5;
  const CURSOR_REPULSION_ACCELERATION = 44;
  const CURSOR_REPULSION_DURATION = 0.18;
  const PREVIOUS_MAX_CURSOR_MASS = 40;
  const REPULSION_REFERENCE_MASS = 18;
  const DEFAULT_CURSOR_MASS = PREVIOUS_MAX_CURSOR_MASS;
  const MIN_CURSOR_MASS = 2;
  const MAX_CURSOR_MASS = PREVIOUS_MAX_CURSOR_MASS * 4;
  const MASS_SCROLL_PIXELS_PER_UNIT = 24;
  const TRACE_CAPACITY = 20;
  const TRACE_SAMPLE_STEPS = 4;
  const ENERGY_UPDATE_INTERVAL = 100;
  const VELOCITY_LIMIT = 2;
  const EDGE_RESTITUTION = 0.9;
  const EDGE_MARGIN = 0.025;

  const pointer = {
    active: false,
    mass: 0,
    repulsionRemaining: 0,
    x: 0.5,
    y: 0.5,
  };

  let bodyCount = 0;
  let positionsX = new Float32Array(0);
  let positionsY = new Float32Array(0);
  let velocitiesX = new Float32Array(0);
  let velocitiesY = new Float32Array(0);
  let accelerationsX = new Float32Array(0);
  let accelerationsY = new Float32Array(0);
  let masses = new Float32Array(0);
  let tracePositionsX = new Float32Array(0);
  let tracePositionsY = new Float32Array(0);
  let traceHead = 0;
  let traceLength = 0;
  let traceStep = 0;
  let cssWidth = 1;
  let cssHeight = 1;
  let aspect = 1;
  let previousAspect = 1;
  let accumulator = 0;
  let previousTime = performance.now();
  let previousEnergyUpdateTime = -Infinity;
  let animationFrame = null;
  let isIntersecting = true;
  let cursorMass = DEFAULT_CURSOR_MASS;

  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

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

  function initializeBodies() {
    bodyCount = Math.max(
      36,
      Math.min(72, Math.round((cssWidth * cssHeight) / 6500)),
    );
    positionsX = new Float32Array(bodyCount);
    positionsY = new Float32Array(bodyCount);
    velocitiesX = new Float32Array(bodyCount);
    velocitiesY = new Float32Array(bodyCount);
    accelerationsX = new Float32Array(bodyCount);
    accelerationsY = new Float32Array(bodyCount);
    masses = new Float32Array(bodyCount);
    tracePositionsX = new Float32Array(TRACE_CAPACITY * bodyCount);
    tracePositionsY = new Float32Array(TRACE_CAPACITY * bodyCount);
    traceHead = 0;
    traceLength = 0;
    traceStep = 0;

    const random = seededRandom(26031996);
    const centerX = aspect / 2;
    const centerY = 0.5;
    const diskRadius = 0.43;
    let momentumX = 0;
    let momentumY = 0;
    let totalMass = 0;

    for (let index = 0; index < bodyCount; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * diskRadius;
      const horizontalStretch = Math.min(1.65, aspect * 0.62);
      const jitterX = (random() - 0.5) * 0.018;
      const jitterY = (random() - 0.5) * 0.018;
      const mass = (0.68 + random() * 1.1) * BODY_MASS_SCALE;
      const enclosedMass = Math.max(
        1,
        bodyCount * Math.pow(radius / diskRadius, 2) * 1.08 * BODY_MASS_SCALE,
      );
      const orbitalSpeed =
        Math.sqrt((GRAVITY * enclosedMass) / (radius + SOFTENING)) * 1.15;

      positionsX[index] =
        centerX + Math.cos(angle) * radius * horizontalStretch + jitterX;
      positionsY[index] = centerY + Math.sin(angle) * radius + jitterY;
      velocitiesX[index] =
        -Math.sin(angle) * orbitalSpeed * horizontalStretch +
        (random() - 0.5) * 0.035;
      velocitiesY[index] =
        Math.cos(angle) * orbitalSpeed + (random() - 0.5) * 0.035;
      masses[index] = mass;
      momentumX += velocitiesX[index] * mass;
      momentumY += velocitiesY[index] * mass;
      totalMass += mass;
    }

    const centerVelocityX = momentumX / totalMass;
    const centerVelocityY = momentumY / totalMass;

    for (let index = 0; index < bodyCount; index += 1) {
      velocitiesX[index] -= centerVelocityX;
      velocitiesY[index] -= centerVelocityY;
    }

    pointer.x = centerX;
    pointer.y = centerY;
    recordTrace();
  }

  function recordTrace() {
    const baseIndex = traceHead * bodyCount;

    for (let index = 0; index < bodyCount; index += 1) {
      tracePositionsX[baseIndex + index] = positionsX[index];
      tracePositionsY[baseIndex + index] = positionsY[index];
    }

    traceHead = (traceHead + 1) % TRACE_CAPACITY;
    traceLength = Math.min(traceLength + 1, TRACE_CAPACITY);
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(bounds.width));
    const nextHeight = Math.max(1, Math.round(bounds.height));

    if (nextWidth === cssWidth && nextHeight === cssHeight && bodyCount > 0) {
      return;
    }

    cssWidth = nextWidth;
    cssHeight = nextHeight;
    previousAspect = aspect;
    aspect = cssWidth / cssHeight;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if (bodyCount === 0) {
      initializeBodies();
      return;
    }

    const horizontalScale = aspect / previousAspect;

    for (let index = 0; index < bodyCount; index += 1) {
      positionsX[index] *= horizontalScale;
      velocitiesX[index] *= horizontalScale;
    }

    for (let index = 0; index < tracePositionsX.length; index += 1) {
      tracePositionsX[index] *= horizontalScale;
    }

    pointer.x *= horizontalScale;
    render();
    updateEnergyReadout(performance.now(), true);
  }

  function calculateAccelerations() {
    accelerationsX.fill(0);
    accelerationsY.fill(0);

    for (let first = 0; first < bodyCount; first += 1) {
      for (let second = first + 1; second < bodyCount; second += 1) {
        const deltaX = positionsX[second] - positionsX[first];
        const deltaY = positionsY[second] - positionsY[first];
        const separationSquared = deltaX * deltaX + deltaY * deltaY;
        const separation = Math.sqrt(separationSquared);
        const distanceSquared = separationSquared + SOFTENING * SOFTENING;
        const inverseDistanceCubed =
          1 / (distanceSquared * Math.sqrt(distanceSquared));
        const forceScale = GRAVITY * inverseDistanceCubed;

        accelerationsX[first] += forceScale * masses[second] * deltaX;
        accelerationsY[first] += forceScale * masses[second] * deltaY;
        accelerationsX[second] -= forceScale * masses[first] * deltaX;
        accelerationsY[second] -= forceScale * masses[first] * deltaY;

        if (separation < REPULSION_RADIUS) {
          let directionX = 1;
          let directionY = 0;

          if (separation > 0.0001) {
            directionX = deltaX / separation;
            directionY = deltaY / separation;
          } else if ((first + second) % 2 === 0) {
            directionX = 0;
            directionY = 1;
          }

          const closingSpeed =
            (velocitiesX[second] - velocitiesX[first]) * directionX +
            (velocitiesY[second] - velocitiesY[first]) * directionY;
          const overlap = REPULSION_RADIUS - separation;
          const repulsionForce =
            REPULSION_STIFFNESS * overlap +
            REPULSION_DAMPING * Math.max(0, -closingSpeed);
          const firstAcceleration = repulsionForce / masses[first];
          const secondAcceleration = repulsionForce / masses[second];

          accelerationsX[first] -= firstAcceleration * directionX;
          accelerationsY[first] -= firstAcceleration * directionY;
          accelerationsX[second] += secondAcceleration * directionX;
          accelerationsY[second] += secondAcceleration * directionY;
        }
      }
    }

    const repulsionActive = pointer.repulsionRemaining > 0;

    if (pointer.mass <= 0.005 && !repulsionActive) {
      return;
    }

    for (let index = 0; index < bodyCount; index += 1) {
      const deltaX = pointer.x - positionsX[index];
      const deltaY = pointer.y - positionsY[index];

      if (repulsionActive) {
        const distance = Math.hypot(deltaX, deltaY);

        if (distance < CURSOR_REPULSION_RADIUS) {
          const normalizedDistance = distance / CURSOR_REPULSION_RADIUS;
          const falloff = Math.pow(
            1 - normalizedDistance * normalizedDistance,
            2,
          );
          const massScale = Math.sqrt(cursorMass / REPULSION_REFERENCE_MASS);
          const repulsionAcceleration =
            CURSOR_REPULSION_ACCELERATION * massScale * falloff;
          let directionX;
          let directionY;

          if (distance > 0.0001) {
            directionX = -deltaX / distance;
            directionY = -deltaY / distance;
          } else {
            const angle = index * 2.399963229728653;
            directionX = Math.cos(angle);
            directionY = Math.sin(angle);
          }

          accelerationsX[index] += repulsionAcceleration * directionX;
          accelerationsY[index] += repulsionAcceleration * directionY;
        }

        continue;
      }

      if (pointer.mass <= 0.005) {
        continue;
      }

      const distanceSquared =
        deltaX * deltaX + deltaY * deltaY + CURSOR_SOFTENING * CURSOR_SOFTENING;
      const inverseDistanceCubed =
        1 / (distanceSquared * Math.sqrt(distanceSquared));
      const forceScale = GRAVITY * pointer.mass * inverseDistanceCubed;

      accelerationsX[index] += forceScale * deltaX;
      accelerationsY[index] += forceScale * deltaY;
    }
  }

  function containBody(index) {
    if (positionsX[index] < EDGE_MARGIN) {
      positionsX[index] = EDGE_MARGIN;
      velocitiesX[index] = Math.abs(velocitiesX[index]) * EDGE_RESTITUTION;
    } else if (positionsX[index] > aspect - EDGE_MARGIN) {
      positionsX[index] = aspect - EDGE_MARGIN;
      velocitiesX[index] = -Math.abs(velocitiesX[index]) * EDGE_RESTITUTION;
    }

    if (positionsY[index] < EDGE_MARGIN) {
      positionsY[index] = EDGE_MARGIN;
      velocitiesY[index] = Math.abs(velocitiesY[index]) * EDGE_RESTITUTION;
    } else if (positionsY[index] > 1 - EDGE_MARGIN) {
      positionsY[index] = 1 - EDGE_MARGIN;
      velocitiesY[index] = -Math.abs(velocitiesY[index]) * EDGE_RESTITUTION;
    }
  }

  function simulate(step) {
    pointer.mass = pointer.active ? cursorMass : 0;

    calculateAccelerations();

    for (let index = 0; index < bodyCount; index += 1) {
      velocitiesX[index] = velocitiesX[index] + accelerationsX[index] * step;
      velocitiesY[index] = velocitiesY[index] + accelerationsY[index] * step;

      const speed = Math.hypot(velocitiesX[index], velocitiesY[index]);

      if (speed > VELOCITY_LIMIT) {
        const velocityScale = VELOCITY_LIMIT / speed;
        velocitiesX[index] *= velocityScale;
        velocitiesY[index] *= velocityScale;
      }

      positionsX[index] += velocitiesX[index] * step;
      positionsY[index] += velocitiesY[index] * step;
      containBody(index);
    }

    traceStep += 1;

    if (traceStep >= TRACE_SAMPLE_STEPS) {
      traceStep = 0;
      recordTrace();
    }

    pointer.repulsionRemaining = Math.max(0, pointer.repulsionRemaining - step);
  }

  function calculateKineticEnergy() {
    let kineticEnergy = 0;

    for (let index = 0; index < bodyCount; index += 1) {
      const speedSquared =
        velocitiesX[index] * velocitiesX[index] +
        velocitiesY[index] * velocitiesY[index];
      kineticEnergy += 0.5 * masses[index] * speedSquared;
    }

    return kineticEnergy;
  }

  function updateEnergyReadout(currentTime, force = false) {
    if (
      !force &&
      currentTime - previousEnergyUpdateTime < ENERGY_UPDATE_INTERVAL
    ) {
      return;
    }

    previousEnergyUpdateTime = currentTime;
    energyReadout.textContent = calculateKineticEnergy().toExponential(3);
  }

  function renderBody(index) {
    const scale = cssHeight;
    const positionX = positionsX[index] * scale;
    const positionY = positionsY[index] * scale;
    const radius = 1.35 + masses[index] * 0.95;

    context.beginPath();
    context.arc(positionX, positionY, radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(49, 43, 33, 0.92)";
    context.fill();

    context.beginPath();
    context.arc(
      positionX - radius * 0.3,
      positionY - radius * 0.32,
      Math.max(0.45, radius * 0.22),
      0,
      Math.PI * 2,
    );
    context.fillStyle = "rgba(239, 229, 207, 0.76)";
    context.fill();
  }

  function strokeTraceLayer(startFraction, alpha, lineWidth) {
    if (traceLength < 2) {
      return;
    }

    const firstOffset = Math.min(
      traceLength - 1,
      Math.floor((traceLength - 1) * startFraction),
    );
    const oldestSlot =
      (traceHead - traceLength + TRACE_CAPACITY) % TRACE_CAPACITY;
    const scale = cssHeight;

    context.beginPath();

    for (let body = 0; body < bodyCount; body += 1) {
      for (let offset = firstOffset; offset < traceLength; offset += 1) {
        const slot = (oldestSlot + offset) % TRACE_CAPACITY;
        const traceIndex = slot * bodyCount + body;
        const positionX = tracePositionsX[traceIndex] * scale;
        const positionY = tracePositionsY[traceIndex] * scale;

        if (offset === firstOffset) {
          context.moveTo(positionX, positionY);
        } else {
          context.lineTo(positionX, positionY);
        }
      }

      context.lineTo(positionsX[body] * scale, positionsY[body] * scale);
    }

    context.strokeStyle = `rgba(70, 57, 42, ${alpha})`;
    context.lineWidth = lineWidth;
    context.stroke();
  }

  function renderTraces() {
    strokeTraceLayer(0, 0.055, 0.6);
    strokeTraceLayer(0.45, 0.075, 0.7);
    strokeTraceLayer(0.72, 0.095, 0.8);
  }

  function cursorBallRadius(mass) {
    const massRatio = mass / PREVIOUS_MAX_CURSOR_MASS;
    return (12 + massRatio * 12) * INTERACTION_RANGE_SCALE;
  }

  function renderPointerMass() {
    if (pointer.mass < 0.12) {
      return;
    }

    const scale = cssHeight;
    const positionX = pointer.x * scale;
    const positionY = pointer.y * scale;
    const massRatio = pointer.mass / PREVIOUS_MAX_CURSOR_MASS;
    const opacityRatio = Math.min(1, massRatio);
    const outerRadius = cursorBallRadius(pointer.mass);

    context.beginPath();
    context.arc(positionX, positionY, outerRadius, 0, Math.PI * 2);
    context.strokeStyle = `rgba(134, 70, 47, ${0.22 + opacityRatio * 0.48})`;
    context.lineWidth = 1;
    context.stroke();

    context.beginPath();
    context.arc(positionX, positionY, 2.1 + massRatio * 2.7, 0, Math.PI * 2);
    context.fillStyle = `rgba(102, 51, 34, ${0.35 + opacityRatio * 0.6})`;
    context.fill();
  }

  function renderRepulsionPulse() {
    if (pointer.repulsionRemaining <= 0) {
      return;
    }

    const progress = 1 - pointer.repulsionRemaining / CURSOR_REPULSION_DURATION;
    const scale = cssHeight;
    const positionX = pointer.x * scale;
    const positionY = pointer.y * scale;
    const radius =
      cursorBallRadius(cursorMass) * (1 + Math.max(0, progress) * 0.4);

    context.beginPath();
    context.arc(positionX, positionY, radius, 0, Math.PI * 2);
    context.strokeStyle = `rgba(134, 70, 47, ${Math.max(0, 0.72 * (1 - progress))})`;
    context.lineWidth = 1.4;
    context.stroke();
  }

  function render() {
    context.clearRect(0, 0, cssWidth, cssHeight);

    renderTraces();

    for (let index = 0; index < bodyCount; index += 1) {
      renderBody(index);
    }

    renderPointerMass();
    renderRepulsionPulse();
  }

  function animationLoop(currentTime) {
    animationFrame = null;
    const elapsed = Math.min((currentTime - previousTime) / 1000, 0.05);
    previousTime = currentTime;
    accumulator += elapsed;

    let substeps = 0;

    while (accumulator >= FIXED_STEP && substeps < MAX_SUBSTEPS) {
      simulate(FIXED_STEP);
      accumulator -= FIXED_STEP;
      substeps += 1;
    }

    render();
    updateEnergyReadout(currentTime);
    updateAnimationState();
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

  function updatePointerPosition(event) {
    const bounds = canvas.getBoundingClientRect();
    const positionX = (event.clientX - bounds.left) / bounds.width;
    const positionY = (event.clientY - bounds.top) / bounds.height;
    pointer.x = Math.max(0, Math.min(aspect, positionX * aspect));
    pointer.y = Math.max(0, Math.min(1, positionY));
  }

  function activatePointer(event) {
    if (event.pointerType === "touch") {
      return;
    }

    updatePointerPosition(event);
    pointer.active = true;
    pointer.mass = cursorMass;
    updateEnergyReadout(performance.now(), true);
  }

  function deactivatePointer() {
    pointer.active = false;
    pointer.mass = 0;
    updateEnergyReadout(performance.now(), true);
  }

  function movePointer(event) {
    if (!pointer.active || event.pointerType === "touch") {
      return;
    }

    updatePointerPosition(event);
    updateEnergyReadout(performance.now());
  }

  function triggerRepulsion(event) {
    if (
      event.pointerType === "touch" ||
      event.button !== 0 ||
      !event.isPrimary
    ) {
      return;
    }

    updatePointerPosition(event);
    pointer.active = true;
    pointer.mass = cursorMass;
    pointer.repulsionRemaining = CURSOR_REPULSION_DURATION;
    render();
    updateEnergyReadout(performance.now(), true);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function wheelDeltaPixels(event) {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return event.deltaY * 16;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return event.deltaY * cssHeight;
    }

    return event.deltaY;
  }

  function adjustCursorMass(event) {
    if (!pointer.active || event.ctrlKey) {
      return;
    }

    const delta = clamp(wheelDeltaPixels(event), -120, 120);

    if (Math.abs(delta) < 0.01) {
      return;
    }

    event.preventDefault();
    updatePointerPosition(event);
    cursorMass = clamp(
      cursorMass - delta / MASS_SCROLL_PIXELS_PER_UNIT,
      MIN_CURSOR_MASS,
      MAX_CURSOR_MASS,
    );
    pointer.mass = cursorMass;
    render();
    updateEnergyReadout(performance.now(), true);
  }

  canvas.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") {
      activatePointer(event);
    }
  });

  canvas.addEventListener("pointermove", movePointer);
  canvas.addEventListener("pointerdown", triggerRepulsion);
  canvas.addEventListener("wheel", adjustCursorMass, { passive: false });
  canvas.addEventListener("pointercancel", deactivatePointer);
  canvas.addEventListener("pointerleave", deactivatePointer);
  document.addEventListener("visibilitychange", updateAnimationState);

  motionPreference.addEventListener("change", () => {
    deactivatePointer();
    render();
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
      updateAnimationState();
    });
    bannerObserver.observe(banner);
  }

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

        if (visibleEntry === undefined) {
          return;
        }

        setCurrentNavigation(visibleEntry.target);
      },
      { rootMargin: "-20% 0px -58%", threshold: [0.05, 0.25, 0.5] },
    );

    for (const section of sections) {
      sectionObserver.observe(section);
    }
  }

  resizeCanvas();
  render();
  updateEnergyReadout(performance.now(), true);
  updateAnimationState();
})();
