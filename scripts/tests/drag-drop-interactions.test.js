/**
 * Quench test batch for drag-drop interactions.
 * Tests item drops, playbook drops, and edit mode restrictions.
 */

import {
  createTestActor,
  createTestCrewActor,
  ensureSheet,
  waitForActorUpdate,
  isTargetModuleActive,
  closeAllDialogs,
  testCleanup,
  findClassItem,
  TestNumberer,
  assertExists,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

/**
 * Find a compendium item by type.
 * @param {string} type - Item type (e.g., "item", "ability")
 * @returns {Promise<Item|null>}
 */
async function findCompendiumItem(type) {
  const packs = Array.from(game.packs.values()).filter(
    (pack) => pack.documentName === "Item"
  );

  for (const pack of packs) {
    const index = await pack.getIndex({ fields: ["type", "name"] });
    const entry = index.find((doc) => doc.type === type);
    if (entry) {
      return pack.getDocument(entry._id);
    }
  }
  return null;
}

/**
 * Simulate a drop event on a sheet.
 * @param {ActorSheet} sheet - The sheet to drop on
 * @param {object} data - The drop data
 * @returns {Promise<void>}
 */
async function simulateDropOnSheet(sheet, data) {
  const root = sheet.element?.[0] || sheet.element;
  const dropZone = root.querySelector(".window-content") || root;

  const dropEvent = new DragEvent("drop", {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  });

  dropEvent.dataTransfer.setData("text/plain", JSON.stringify(data));
  dropZone.dispatchEvent(dropEvent);
  await new Promise((resolve) => setTimeout(resolve, 200));
}

/**
 * Check if an item exists on an actor.
 * @param {Actor} actor
 * @param {string} itemName
 * @param {string} itemType
 * @returns {boolean}
 */
function actorHasItem(actor, itemName, itemType = null) {
  return actor.items.some((i) => {
    const nameMatch = i.name === itemName;
    const typeMatch = itemType ? i.type === itemType : true;
    return nameMatch && typeMatch;
  });
}

/**
 * Get item count for an actor.
 * @param {Actor} actor
 * @param {string} type - Optional item type filter
 * @returns {number}
 */
function getItemCount(actor, type = null) {
  if (type) {
    return actor.items.filter((i) => i.type === type).size;
  }
  return actor.items.size;
}

const t = new TestNumberer("20");

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping drag-drop tests`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.drag-drop",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      t.section("Playbook Drop on Character Sheet", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "DragDrop-Playbook-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("dropping a different playbook triggers switchPlaybook", async function () {
          this.timeout(15000);

          const sheet = await ensureSheet(actor);

          // Get current playbook name
          const currentPlaybook = actor.system?.playbook;
          assert.ok(currentPlaybook, "Actor should have a playbook assigned");

          // Find a different playbook
          const newPlaybook = await findClassItem("Lurk");
          assert.ok(newPlaybook,
            "Lurk playbook should be found in compendia - compendia may not be loaded");

          // Verify it's different from current
          assert.ok(newPlaybook.name.toLowerCase() !== currentPlaybook?.toLowerCase(),
            "Test should use different playbook than current - findClassItem may have returned wrong playbook");

          // CRITICAL: Capture initial state
          const initialPlaybook = actor.system.playbook;

          // Drop the new playbook
          const dropData = {
            type: "Item",
            uuid: newPlaybook.uuid,
          };

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 3000 }).catch(() => {});
          await simulateDropOnSheet(sheet, dropData);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 500));

          // CRITICAL: Verify playbook was switched
          const newPlaybookName = actor.system.playbook;
          assert.notEqual(
            newPlaybookName,
            initialPlaybook,
            `Playbook should change after drop (was "${initialPlaybook}", now "${newPlaybookName}")`
          );

          console.log(`[DragDrop Test] Playbook switched: ${initialPlaybook} -> ${newPlaybookName}`);
        });

        t.test("dropping same playbook does not duplicate items", async function () {
          this.timeout(12000);

          const sheet = await ensureSheet(actor);
          const currentPlaybook = actor.system?.playbook;

          // Find the same playbook
          const samePlaybook = await findClassItem(currentPlaybook);
          assert.ok(samePlaybook,
            `Current playbook (${currentPlaybook}) should be found in compendia - compendia may not be loaded`);

          // CRITICAL: Capture initial item count
          const initialItemCount = actor.items.size;

          // Drop the same playbook
          const dropData = {
            type: "Item",
            uuid: samePlaybook.uuid,
          };

          await simulateDropOnSheet(sheet, dropData);
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Item count should not dramatically increase
          const finalItemCount = actor.items.size;
          const increase = finalItemCount - initialItemCount;

          // Allow for some variance (re-drop might add playbook item itself)
          assert.ok(
            increase <= 2,
            `Item count should not dramatically increase on same playbook drop (was ${initialItemCount}, now ${finalItemCount})`
          );

          console.log(`[DragDrop Test] Same playbook drop: items ${initialItemCount} -> ${finalItemCount}`);
        });
      });

      t.section("Item Drop on Character Sheet", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "DragDrop-Item-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("dropping item adds it to actor", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);

          // Find an item from compendia
          const item = await findCompendiumItem("item");
          assert.ok(item,
            "Items should be found in compendia - compendia may not be loaded");

          // CRITICAL: Capture initial state
          const initialCount = actor.items.size;

          // Drop the item
          const dropData = {
            type: "Item",
            uuid: item.uuid,
          };

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await simulateDropOnSheet(sheet, dropData);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify item was added
          const finalCount = actor.items.size;
          assert.ok(
            finalCount >= initialCount + 1,
            `Item count should increase by at least 1 after drop (was ${initialCount}, now ${finalCount}, item: "${item.name}")`
          );

          console.log(`[DragDrop Test] Item drop: ${initialCount} -> ${finalCount} items`);
        });

        t.test("dropping ability adds it to actor", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);

          // Find an ability from compendia
          const ability = await findCompendiumItem("ability");
          assert.ok(ability,
            "Abilities should be found in compendia - compendia may not be loaded");

          // CRITICAL: Capture initial state
          const initialAbilityCount = getItemCount(actor, "ability");

          // Drop the ability
          const dropData = {
            type: "Item",
            uuid: ability.uuid,
          };

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await simulateDropOnSheet(sheet, dropData);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify ability was added
          const finalAbilityCount = getItemCount(actor, "ability");
          assert.ok(
            finalAbilityCount >= initialAbilityCount + 1,
            `Ability count should increase by at least 1 after drop (was ${initialAbilityCount}, now ${finalAbilityCount}, ability: "${ability.name}")`
          );

          console.log(`[DragDrop Test] Ability drop: ${initialAbilityCount} -> ${finalAbilityCount} abilities`);
        });
      });

      t.section("NPC Drop as Acquaintance", () => {
        let actor;
        let npcActor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "DragDrop-NPC-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;

          // Create an NPC to drop
          npcActor = await Actor.create({
            name: "Test NPC for DragDrop",
            type: "npc",
          });
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor, npcActor] });
          actor = null;
          npcActor = null;
        });

        t.test("dropping NPC adds acquaintance", async function () {
          this.timeout(10000);

          assert.ok(npcActor,
            "NPC actor should be created - NPC actor type must be available in system");

          const sheet = await ensureSheet(actor);

          // Get initial acquaintance count
          const acquaintances = actor.getFlag(TARGET_MODULE_ID, "acquaintances") || [];
          const initialCount = acquaintances.length;

          // Drop the NPC
          const dropData = {
            type: "Actor",
            uuid: npcActor.uuid,
          };

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await simulateDropOnSheet(sheet, dropData);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Verify acquaintance was added
          const newAcquaintances = actor.getFlag(TARGET_MODULE_ID, "acquaintances") || [];
          assert.ok(
            newAcquaintances.length > initialCount,
            `Acquaintance count should increase (was ${initialCount}, now ${newAcquaintances.length})`
          );

          console.log(`[DragDrop Test] NPC drop: ${initialCount} -> ${newAcquaintances.length} acquaintances`);
        });

        t.test("dropping same NPC twice does not duplicate", async function () {
          this.timeout(12000);

          assert.ok(npcActor,
            "NPC actor should be created - NPC actor type must be available in system");

          const sheet = await ensureSheet(actor);

          // Drop the NPC once
          const dropData = {
            type: "Actor",
            uuid: npcActor.uuid,
          };

          await simulateDropOnSheet(sheet, dropData);
          await new Promise((resolve) => setTimeout(resolve, 500));

          const countAfterFirst = (actor.getFlag(TARGET_MODULE_ID, "acquaintances") || []).length;

          // Drop the same NPC again
          await simulateDropOnSheet(sheet, dropData);
          await new Promise((resolve) => setTimeout(resolve, 500));

          const countAfterSecond = (actor.getFlag(TARGET_MODULE_ID, "acquaintances") || []).length;

          // Should not duplicate
          assert.equal(
            countAfterSecond,
            countAfterFirst,
            `Dropping same NPC twice should not duplicate (first: ${countAfterFirst}, second: ${countAfterSecond})`
          );

          console.log(`[DragDrop Test] Duplicate NPC drop prevented: count stayed at ${countAfterSecond}`);
        });
      });

      t.section("Crew Sheet Drops", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestCrewActor({
            name: "DragDrop-Crew-Test",
            crewTypeName: "Assassins",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("dropping crew_ability on crew adds it", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);

          // Find a crew ability
          const crewAbility = await findCompendiumItem("crew_ability");
          assert.ok(crewAbility,
            "Crew abilities should be found in compendia - compendia may not be loaded");

          // CRITICAL: Capture initial state
          const initialCount = getItemCount(actor, "crew_ability");

          // Drop the crew ability
          const dropData = {
            type: "Item",
            uuid: crewAbility.uuid,
          };

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await simulateDropOnSheet(sheet, dropData);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify crew ability was added
          const finalCount = getItemCount(actor, "crew_ability");
          assert.ok(
            finalCount >= initialCount + 1,
            `Crew ability count should increase by at least 1 after drop (was ${initialCount}, now ${finalCount}, ability: "${crewAbility.name}")`
          );

          console.log(`[DragDrop Test] Crew ability drop: ${initialCount} -> ${finalCount}`);
        });

        t.test("dropping crew_upgrade on crew adds it", async function () {
          this.timeout(10000);

          const sheet = await ensureSheet(actor);

          // Find a crew upgrade
          const crewUpgrade = await findCompendiumItem("crew_upgrade");
          assert.ok(crewUpgrade,
            "Crew upgrades should be found in compendia - compendia may not be loaded");

          // CRITICAL: Capture initial state
          const initialCount = getItemCount(actor, "crew_upgrade");

          // Drop the crew upgrade
          const dropData = {
            type: "Item",
            uuid: crewUpgrade.uuid,
          };

          const updatePromise = waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await simulateDropOnSheet(sheet, dropData);
          await updatePromise;
          await new Promise((resolve) => setTimeout(resolve, 300));

          // CRITICAL: Verify crew upgrade was added
          const finalCount = getItemCount(actor, "crew_upgrade");
          assert.ok(
            finalCount >= initialCount + 1,
            `Crew upgrade count should increase by at least 1 after drop (was ${initialCount}, now ${finalCount}, upgrade: "${crewUpgrade.name}")`
          );

          console.log(`[DragDrop Test] Crew upgrade drop: ${initialCount} -> ${finalCount}`);
        });
      });

      t.section("Permission Checks", () => {
        let actor;

        beforeEach(async function () {
          this.timeout(10000);
          const result = await createTestActor({
            name: "DragDrop-Permission-Test",
            playbookName: "Cutter",
          });
          actor = result.actor;
        });

        afterEach(async function () {
          this.timeout(5000);
          await testCleanup({ actors: [actor] });
          actor = null;
        });

        t.test("owner can drop items on sheet", async function () {
          this.timeout(8000);

          // Verify we are the owner
          assert.ok(actor.isOwner, "Test actor should be owned by current user");

          const sheet = await ensureSheet(actor);
          const root = sheet.element?.[0] || sheet.element;

          // Sheet should be droppable (no blocked state)
          const wrapper = root.querySelector(".sheet-wrapper");
          assert.ok(
            !wrapper?.classList.contains("no-drops"),
            "Sheet should allow drops for owner"
          );
        });

        t.test("drop handlers exist on sheet", async function () {
          this.timeout(8000);

          const sheet = await ensureSheet(actor);

          // Verify the sheet has drop handler methods
          assert.ok(
            typeof sheet._onDropItem === "function" || typeof sheet.handleDrop === "function",
            "Sheet should have drop handler method"
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Drag-Drop Interactions" }
  );
});
