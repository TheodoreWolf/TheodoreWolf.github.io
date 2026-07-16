(() => {
  "use strict";

  const trigger = document.querySelector(".wordmark");
  const dialog = document.getElementById("lorenz-warhol");
  const closeButton = dialog?.querySelector(".lorenz-warhol-close");
  const resetButton = dialog?.querySelector(".lorenz-warhol-grid");
  const canvases = Array.from(
    resetButton?.querySelectorAll("canvas") ?? [],
  );

  if (
    !(trigger instanceof HTMLButtonElement) ||
    !(dialog instanceof HTMLDialogElement) ||
    !(closeButton instanceof HTMLButtonElement) ||
    !(resetButton instanceof HTMLButtonElement) ||
    canvases.length !== 9
  ) {
    return;
  }

  const SIGMA = 10;
  const RHO = 28;
  const BETA = 8 / 3;
  const STEP = 0.005;
  const SIMULATION_SPEED = 0.45;
  const INITIAL_HOLD_MS = 800;
  const MAX_SUBSTEPS = 50;
  const SAMPLE_EVERY = 2;
  const MAX_POINTS = 1100;
  const BURN_IN_STEPS = 1200;

  const palettes = [
    { background: "#f6b6c8", trace: "#194d61" },
    { background: "#a8d8c8", trace: "#8a2533" },
    { background: "#f7d58b", trace: "#5e3975" },
    { background: "#b9c8f0", trace: "#c43a5a" },
    { background: "#efb38e", trace: "#174a46" },
    { background: "#d7b7df", trace: "#7b3c20" },
    { background: "#a9dce3", trace: "#b72e5d" },
    { background: "#f3c1a4", trace: "#31497a" },
    { background: "#c7d79b", trace: "#6b2b67" },
  ];

  const initialOffsets = [
    [-1e-4, -1e-4, 5e-5],
    [0, -1e-4, -5e-5],
    [1e-4, -1e-4, 0],
    [-1e-4, 0, -5e-5],
    [0, 0, 0],
    [1e-4, 0, 5e-5],
    [-1e-4, 1e-4, 0],
    [0, 1e-4, 5e-5],
    [1e-4, 1e-4, -5e-5],
  ];

  const tiles = canvases.map((canvas, index) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const context = canvas.getContext("2d");

    if (context === null) {
      return null;
    }

    return {
      canvas,
      context,
      palette: palettes[index],
      offset: initialOffsets[index],
      state: { x: 0, y: 0, z: 0 },
      points: [],
      width: 1,
      height: 1,
    };
  });

  if (tiles.some((tile) => tile === null)) {
    return;
  }

  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  let animationFrame = null;
  let previousTime = 0;
  let accumulator = 0;
  let stepCount = 0;

  function derivative(state) {
    return {
      x: SIGMA * (state.y - state.x),
      y: state.x * (RHO - state.z) - state.y,
      z: state.x * state.y - BETA * state.z,
    };
  }

  function integrate(state) {
    const k1 = derivative(state);
    const k2 = derivative({
      x: state.x + k1.x * STEP * 0.5,
      y: state.y + k1.y * STEP * 0.5,
      z: state.z + k1.z * STEP * 0.5,
    });
    const k3 = derivative({
      x: state.x + k2.x * STEP * 0.5,
      y: state.y + k2.y * STEP * 0.5,
      z: state.z + k2.z * STEP * 0.5,
    });
    const k4 = derivative({
      x: state.x + k3.x * STEP,
      y: state.y + k3.y * STEP,
      z: state.z + k3.z * STEP,
    });

    state.x +=
      ((k1.x + 2 * k2.x + 2 * k3.x + k4.x) * STEP) / 6;
    state.y +=
      ((k1.y + 2 * k2.y + 2 * k3.y + k4.y) * STEP) / 6;
    state.z +=
      ((k1.z + 2 * k2.z + 2 * k3.z + k4.z) * STEP) / 6;
  }

  function recordPoint(tile) {
    tile.points.push({ x: tile.state.x, z: tile.state.z });

    if (tile.points.length > MAX_POINTS) {
      tile.points.splice(0, tile.points.length - MAX_POINTS);
    }
  }

  function advance(record = true) {
    for (const tile of tiles) {
      integrate(tile.state);
    }

    stepCount += 1;

    if (record && stepCount % SAMPLE_EVERY === 0) {
      for (const tile of tiles) {
        recordPoint(tile);
      }
    }
  }

  function resetTiles() {
    stepCount = 0;
    const sharedState = { x: 0, y: 1, z: 1.05 };

    for (let index = 0; index < BURN_IN_STEPS; index += 1) {
      integrate(sharedState);
    }

    for (const tile of tiles) {
      tile.state.x = sharedState.x + tile.offset[0];
      tile.state.y = sharedState.y + tile.offset[1];
      tile.state.z = sharedState.z + tile.offset[2];
      tile.points.length = 0;
    }

    stepCount = 0;
  }

  function resizeTile(tile) {
    const bounds = tile.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    if (width === tile.width && height === tile.height) {
      return;
    }

    tile.width = width;
    tile.height = height;
    tile.canvas.width = Math.round(width * pixelRatio);
    tile.canvas.height = Math.round(height * pixelRatio);
    tile.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function project(tile, point) {
    const padding = Math.min(tile.width, tile.height) * 0.075;
    const plotWidth = tile.width - 2 * padding;
    const plotHeight = tile.height - 2 * padding;

    return {
      x: padding + ((point.x + 22) / 44) * plotWidth,
      y: tile.height - padding - (point.z / 52) * plotHeight,
    };
  }

  function drawPath(tile, points, alpha, lineWidth) {
    if (points.length < 2) {
      return;
    }

    const context = tile.context;
    const first = project(tile, points[0]);

    context.beginPath();
    context.moveTo(first.x, first.y);

    for (let index = 1; index < points.length; index += 1) {
      const point = project(tile, points[index]);
      context.lineTo(point.x, point.y);
    }

    context.globalAlpha = alpha;
    context.strokeStyle = tile.palette.trace;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  }

  function renderTile(tile) {
    resizeTile(tile);

    const context = tile.context;
    context.globalAlpha = 1;
    context.fillStyle = tile.palette.background;
    context.fillRect(0, 0, tile.width, tile.height);

    const scale = Math.max(0.75, Math.min(tile.width, tile.height) / 230);
    drawPath(tile, tile.points, 0.28, 0.85 * scale);
    drawPath(tile, tile.points.slice(-240), 0.96, 1.45 * scale);

    const point = project(tile, tile.state);
    context.globalAlpha = 1;
    context.fillStyle = tile.palette.trace;
    context.beginPath();
    context.arc(point.x, point.y, 2.15 * scale, 0, Math.PI * 2);
    context.fill();
  }

  function render() {
    for (const tile of tiles) {
      renderTile(tile);
    }
  }

  function stopSimulation() {
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function animationLoop(currentTime) {
    animationFrame = null;

    if (!dialog.open || document.hidden || motionPreference.matches) {
      return;
    }

    if (currentTime < previousTime) {
      animationFrame = window.requestAnimationFrame(animationLoop);
      return;
    }

    const elapsed = Math.min((currentTime - previousTime) / 1000, 0.05);
    previousTime = currentTime;
    accumulator += elapsed * SIMULATION_SPEED;

    let substeps = 0;

    while (accumulator >= STEP && substeps < MAX_SUBSTEPS) {
      advance();
      accumulator -= STEP;
      substeps += 1;
    }

    render();
    animationFrame = window.requestAnimationFrame(animationLoop);
  }

  function startSimulation() {
    stopSimulation();
    resetTiles();
    accumulator = 0;
    render();

    if (motionPreference.matches) {
      return;
    }

    previousTime = performance.now() + INITIAL_HOLD_MS;
    animationFrame = window.requestAnimationFrame(animationLoop);
  }

  function openDialog() {
    if (dialog.open) {
      return;
    }

    trigger.setAttribute("aria-expanded", "true");
    dialog.showModal();
    window.requestAnimationFrame(startSimulation);
  }

  function closeDialog() {
    if (dialog.open) {
      dialog.close();
    }
  }

  trigger.addEventListener("click", openDialog);
  closeButton.addEventListener("click", closeDialog);
  resetButton.addEventListener("click", startSimulation);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDialog();
    }
  });
  dialog.addEventListener("close", () => {
    stopSimulation();
    trigger.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopSimulation();
    } else if (dialog.open) {
      startSimulation();
    }
  });
  motionPreference.addEventListener("change", () => {
    if (dialog.open) {
      startSimulation();
    }
  });

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => {
      if (dialog.open) {
        render();
      }
    });
    resizeObserver.observe(dialog);
  } else {
    window.addEventListener("resize", () => {
      if (dialog.open) {
        render();
      }
    });
  }
})();
