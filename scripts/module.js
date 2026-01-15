const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

function getModuleApi(id) {
  return game?.modules?.get(id)?.api || null;
}

async function waitForActorUpdate(actor, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    let timer;
    const hookFn = (doc) => {
      if (doc.id !== actor.id) return;
      Hooks.off("updateActor", hookFn);
      clearTimeout(timer);
      resolve();
    };

    timer = setTimeout(() => {
      Hooks.off("updateActor", hookFn);
      reject(new Error(`Timed out waiting for actor update (${actor.id})`));
    }, timeoutMs);

    Hooks.on("updateActor", hookFn);
  });
}

async function waitForActorCondition(
  checkFn,
  { timeoutMs = 2000, intervalMs = 50 } = {}
) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        if (checkFn()) {
          resolve();
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error("Timed out waiting for actor state update"));
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

async function ensureSheet(actor) {
  const sheet = actor.sheet;
  if (!sheet) {
    throw new Error("Actor has no sheet instance");
  }
  if (!sheet.rendered) {
    await sheet.render(true);
  }
  // Allow the DOM to settle.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return sheet;
}

async function findClassItem(playbookName) {
  const packs = Array.from(game.packs.values()).filter(
    (pack) => pack.documentName === "Item"
  );
  const normalized = playbookName?.toLowerCase?.() || null;
  let fallback = null;
  let fallbackPriority = -1;

  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["type", "name"] });
    if (normalized) {
      const exact = index.find(
        (doc) =>
          doc.type === "class" && doc.name?.toLowerCase?.() === normalized
      );
      if (exact) {
        return pack.getDocument(exact._id);
      }
    }

    const entry = index.find((doc) => doc.type === "class");
    if (entry) {
      const isSystemClass = pack.collection === "blades-in-the-dark.class";
      const label = pack.metadata?.label?.toLowerCase?.() || "";
      const priority = isSystemClass ? 2 : label.includes("class") ? 1 : 0;
      if (priority > fallbackPriority) {
        fallback = { pack, entry };
        fallbackPriority = priority;
      }
    }
  }

  if (fallback) {
    return fallback.pack.getDocument(fallback.entry._id);
  }

  return null;
}

async function createTestActor({ name, playbookName } = {}) {
  const actorName = name || `Alt Sheets Test ${Date.now()}`;
  const actor = await Actor.create({ name: actorName, type: "character" });
  if (!actor) {
    throw new Error("Failed to create test actor");
  }

  const playbook = await findClassItem(playbookName);
  if (!playbook) {
    throw new Error("No class/playbook item found in compendia");
  }

  const playbookData = playbook.toObject();
  delete playbookData._id;
  const [createdPlaybook] = await actor.createEmbeddedDocuments("Item", [
    playbookData,
  ]);
  if (!createdPlaybook) {
    throw new Error("Failed to create embedded playbook item");
  }
  await actor.update({ "system.playbook": createdPlaybook.name });

  const sheet = await ensureSheet(actor);
  await sheet.switchPlaybook(createdPlaybook);
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { actor, playbookItem: createdPlaybook };
}

function getAttributeExpMax(actor, attribute) {
  const raw = foundry.utils.getProperty(
    actor.system,
    `attributes.${attribute}.exp_max`
  );
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getTeethState(root, actorId, attribute, max) {
  const teeth = [];
  for (let value = 1; value <= max; value += 1) {
    const label = root.querySelector(
      `label[for="character-${actorId}-${attribute}-${value}"]`
    );
    teeth.push({ value, lit: Boolean(label?.classList?.contains("on")) });
  }
  return teeth;
}

function getLitValues(teeth) {
  return teeth.filter((tooth) => tooth.lit).map((tooth) => tooth.value);
}

async function applyToothClick({ actor, attribute, value, timeoutMs = 1000 }) {
  const sheet = await ensureSheet(actor);
  const root = sheet.element?.[0] || sheet.element;
  if (!root) {
    throw new Error("Sheet DOM not available");
  }

  const id = `character-${actor.id}-${attribute}-${value}`;
  const input = root.querySelector(`#${id}`);
  if (!input) {
    throw new Error(`Missing tooth input for ${attribute} ${value}`);
  }

  let updateTimedOut = false;
  const updatePromise = waitForActorUpdate(actor, { timeoutMs }).catch(() => {
    updateTimedOut = true;
  });

  input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  await updatePromise;
  await sheet.render(false);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const exp = foundry.utils.getProperty(
    actor.system,
    `attributes.${attribute}.exp`
  );
  const max = getAttributeExpMax(actor, attribute);
  const teeth = getTeethState(root, actor.id, attribute, max);

  return { exp, teeth, updateTimedOut };
}

async function setAttributeExp(actor, attribute, value) {
  await actor.update({ [`system.attributes.${attribute}.exp`]: String(value) });
  const sheet = await ensureSheet(actor);
  await sheet.render(false);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function runTeethTest({ playbookName, cleanup = true } = {}) {
  const { actor, playbookItem } = await createTestActor({ playbookName });
  const classCheck = {
    requestedPlaybookName: playbookName || null,
    playbookName: playbookItem.name,
    systemPlaybook: actor.system?.playbook || null,
    classItemExists: actor.items.some(
      (item) => item.type === "class" && item.name === playbookItem.name
    ),
  };
  classCheck.matchedRequested =
    !classCheck.requestedPlaybookName ||
    classCheck.playbookName === classCheck.requestedPlaybookName;
  classCheck.ok =
    classCheck.classItemExists && classCheck.systemPlaybook === playbookItem.name;

  const assertions = [];
  const assert = (ok, message, details) => {
    assertions.push({ ok: Boolean(ok), message, details });
  };

  assert(classCheck.classItemExists, "playbook item is created", classCheck);
  assert(
    classCheck.systemPlaybook === playbookItem.name,
    "system.playbook matches playbook",
    classCheck
  );
  assert(
    classCheck.matchedRequested,
    "requested playbook was found",
    classCheck
  );

  const attributes = ["insight", "prowess", "resolve"];

  for (const attribute of attributes) {
    const max = getAttributeExpMax(actor, attribute);
    assert(max > 0, `${attribute}: exp_max is set`, { max });

    await setAttributeExp(actor, attribute, 0);
    const sheet = await ensureSheet(actor);
    const root = sheet.element?.[0] || sheet.element;
    const emptyTeeth = getTeethState(root, actor.id, attribute, max);
    assert(
      getLitValues(emptyTeeth).length === 0,
      `${attribute}: starts with no teeth lit`,
      { lit: getLitValues(emptyTeeth) }
    );

    const step1 = await applyToothClick({ actor, attribute, value: 1 });
    assert(
      String(step1.exp) === "1",
      `${attribute}: click 1 sets exp to 1`,
      { exp: step1.exp, updateTimedOut: step1.updateTimedOut }
    );
    assert(
      JSON.stringify(getLitValues(step1.teeth)) === JSON.stringify([1]),
      `${attribute}: after click 1, only tooth 1 is lit`,
      { lit: getLitValues(step1.teeth) }
    );

    const step3 = await applyToothClick({ actor, attribute, value: 3 });
    assert(
      String(step3.exp) === "3",
      `${attribute}: click 3 sets exp to 3`,
      { exp: step3.exp, updateTimedOut: step3.updateTimedOut }
    );
    assert(
      JSON.stringify(getLitValues(step3.teeth)) === JSON.stringify([1, 2, 3]),
      `${attribute}: after click 3, teeth 1-3 are lit`,
      { lit: getLitValues(step3.teeth) }
    );

    const stepMax = await applyToothClick({ actor, attribute, value: max });
    const allLit = Array.from({ length: max }, (_, i) => i + 1);
    assert(
      String(stepMax.exp) === String(max),
      `${attribute}: click max sets exp to ${max}`,
      { exp: stepMax.exp, updateTimedOut: stepMax.updateTimedOut }
    );
    assert(
      JSON.stringify(getLitValues(stepMax.teeth)) === JSON.stringify(allLit),
      `${attribute}: after click max, all teeth are lit`,
      { lit: getLitValues(stepMax.teeth) }
    );

    if (max >= 5) {
      const step5 = await applyToothClick({ actor, attribute, value: 5 });
      assert(
        String(step5.exp) === "4",
        `${attribute}: click 5 after max clears tooth 5+ (exp 4)`,
        { exp: step5.exp, updateTimedOut: step5.updateTimedOut }
      );
      assert(
        JSON.stringify(getLitValues(step5.teeth)) === JSON.stringify([1, 2, 3, 4]),
        `${attribute}: after click 5, teeth 1-4 are lit`,
        { lit: getLitValues(step5.teeth) }
      );
    } else {
      assert(true, `${attribute}: exp_max < 5, skipped toggle test`, { max });
    }
  }

  const ok = assertions.every((entry) => entry.ok);

  if (cleanup) {
    await actor.delete();
  } else if (actor.sheet) {
    await actor.sheet.render(true);
  }

  return {
    ok,
    classCheck,
    assertions,
    actorId: actor.id,
    actorName: actor.name,
  };
}

function summarizeAssertions(assertions) {
  const total = assertions.length;
  const failed = assertions.filter((entry) => !entry.ok);
  const passed = total - failed.length;
  return { total, passed, failed };
}

function reportTestResult(name, result) {
  const summary = summarizeAssertions(result.assertions || []);
  const status = result.ok ? "PASS" : "FAIL";
  console.group(`[${MODULE_ID}] ${name}: ${status}`);
  console.log("Summary:", {
    status,
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed.length,
    actor: result.actorName,
    actorId: result.actorId,
  });
  if (result.assertions?.length) {
    console.table(result.assertions);
  }
  console.groupEnd();

  const message = `[${MODULE_ID}] ${name}: ${status} (${summary.passed}/${summary.total})`;
  if (result.ok) {
    ui.notifications?.info?.(message, { permanent: false });
  } else {
    ui.notifications?.warn?.(message, { permanent: false });
  }
}

async function runTeethTestWithReport(options = {}) {
  const result = await runTeethTest(options);
  reportTestResult("Teeth Test", result);
  return result;
}

function ensureControlButton() {
  if (!game.user?.isGM) return false;
  if (!game.modules?.get(TARGET_MODULE_ID)?.active) return false;

  const root = ui?.controls?.element?.[0] || ui?.controls?.element;
  if (!root) return false;

  const tools = root.querySelector("#scene-controls-tools");
  if (!tools) return false;

  if (tools.querySelector('[data-bitd-alt-test="teeth"]')) {
    return true;
  }

  const li = document.createElement("li");
  li.innerHTML =
    '<button type="button" class="control ui-control tool icon fas fa-vial" data-bitd-alt-test="teeth" aria-label="Run BitD Alt Teeth Test" title="Run BitD Alt Teeth Test"></button>';

  li.querySelector("button")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    runTeethTestWithReport({ playbookName: "Cutter", cleanup: true });
  });

  tools.appendChild(li);
  return true;
}

Hooks.once("ready", () => {
  if (!game?.modules?.get(TARGET_MODULE_ID)?.active) {
    ui.notifications?.warn(
      `[${MODULE_ID}] ${TARGET_MODULE_ID} is not active; test helpers disabled.`
    );
    return;
  }

  const api = {
    createTestActor,
    runTeethTest,
    runTeethTestWithReport,
  };

  game.modules.get(MODULE_ID).api = api;
  ensureControlButton();
  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    if (ensureControlButton() || attempts >= 10) {
      clearInterval(interval);
    }
  }, 500);
});

Hooks.on("renderSceneControls", () => {
  ensureControlButton();
});
