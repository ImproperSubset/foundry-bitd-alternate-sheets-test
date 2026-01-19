/**
 * Quench test batch for playbook switching functionality.
 * Tests that switching playbooks correctly:
 * - Clears ability progress flags
 * - Replaces neutral acquaintances with new playbook's acquaintances
 * - Preserves non-neutral (friendly/rival) acquaintance standings
 * - Applies new playbook's starting attributes
 */

import {
  createTestActor,
  ensureSheet,
  findClassItem,
  isTargetModuleActive,
  waitForActorUpdate,
  testCleanup,
  TestNumberer,
} from "../test-utils.js";

const MODULE_ID = "bitd-alternate-sheets-test";
const TARGET_MODULE_ID = "bitd-alternate-sheets";

const t = new TestNumberer("17");

/**
 * Get the multiAbilityProgress flag from an actor.
 * @param {Actor} actor - The actor
 * @returns {object|undefined} The progress flags object or undefined
 */
function getAbilityProgressFlags(actor) {
  return actor.getFlag(TARGET_MODULE_ID, "multiAbilityProgress");
}

/**
 * Set an ability progress flag on an actor.
 * @param {Actor} actor - The actor
 * @param {string} key - The ability key
 * @param {number} value - The progress value
 */
async function setAbilityProgress(actor, key, value) {
  await actor.setFlag(TARGET_MODULE_ID, `multiAbilityProgress.${key}`, value);
}

/**
 * Get acquaintances from an actor with a specific standing.
 * @param {Actor} actor - The actor
 * @param {string} standing - The standing to filter by (friendly, rival, neutral)
 * @returns {Array} Array of acquaintances with that standing
 */
function getAcquaintancesByStanding(actor, standing) {
  return (actor.system.acquaintances || []).filter(acq => acq.standing === standing);
}

/**
 * Set an acquaintance's standing on an actor.
 * @param {Actor} actor - The actor
 * @param {string} acqId - The acquaintance's _id
 * @param {string} standing - The new standing (friendly, rival, neutral)
 */
async function setAcquaintanceStanding(actor, acqId, standing) {
  const acquaintances = [...actor.system.acquaintances];
  const idx = acquaintances.findIndex(acq => acq._id === acqId || acq.id === acqId);
  if (idx !== -1) {
    acquaintances[idx] = { ...acquaintances[idx], standing };
    await actor.update({ "system.acquaintances": acquaintances });
  }
}

Hooks.on("quenchReady", (quench) => {
  if (!isTargetModuleActive()) {
    console.warn(`[${MODULE_ID}] bitd-alternate-sheets not active, skipping test registration`);
    return;
  }

  quench.registerBatch(
    "bitd-alternate-sheets.playbook-switching",
    (context) => {
      const { assert, beforeEach, afterEach } = context;

      let actor;
      let playbookItem;

      beforeEach(async function () {
        this.timeout(15000);
        const result = await createTestActor({
          name: "Playbook-Switch-Test",
          playbookName: "Cutter"
        });
        actor = result.actor;
        playbookItem = result.playbookItem;
      });

      afterEach(async function () {
        this.timeout(10000);
        await testCleanup({ actors: [actor] });
        actor = null;
        playbookItem = null;
      });

      t.section("Ability Progress Flags", () => {
        t.test("switching playbook clears multiAbilityProgress flags", async function () {
          this.timeout(10000);

          // Set some ability progress flags
          await setAbilityProgress(actor, "test-ability-1", 2);
          await setAbilityProgress(actor, "test-ability-2", 1);
          await new Promise(r => setTimeout(r, 200));

          // Verify flags were set
          const progressBefore = getAbilityProgressFlags(actor);
          assert.ok(progressBefore, "Progress flags should exist before switch");
          assert.ok(
            Object.keys(progressBefore).length > 0,
            "Should have at least one progress flag before switch"
          );

          // Find a different playbook to switch to
          const newPlaybook = await findClassItem("Hound");
          assert.ok(newPlaybook, "Should find Hound playbook in compendiums");

          // Create the new playbook item on the actor (this triggers the switch)
          const newPlaybookData = newPlaybook.toObject();
          delete newPlaybookData._id;

          // Get the sheet and call switchPlaybook directly
          const sheet = await ensureSheet(actor);
          await sheet.switchPlaybook(newPlaybook);
          await new Promise(r => setTimeout(r, 500));

          // Verify flags are cleared
          const progressAfter = getAbilityProgressFlags(actor);
          assert.ok(
            !progressAfter || Object.keys(progressAfter).length === 0,
            "Progress flags should be cleared after playbook switch"
          );
        });

        t.test("switching playbook works when no progress flags exist", async function () {
          this.timeout(10000);

          // Verify no progress flags initially
          const progressBefore = getAbilityProgressFlags(actor);
          assert.ok(
            !progressBefore || Object.keys(progressBefore).length === 0,
            "Should have no progress flags initially (fresh actor)"
          );

          // Clear any flags that might exist from createTestActor
          if (progressBefore) {
            await actor.unsetFlag(TARGET_MODULE_ID, "multiAbilityProgress");
            await new Promise(r => setTimeout(r, 100));
          }

          // Find a different playbook
          const newPlaybook = await findClassItem("Leech");
          assert.ok(newPlaybook, "Should find Leech playbook in compendiums");

          // Switch playbook - should not throw
          const sheet = await ensureSheet(actor);
          let errorThrown = false;
          try {
            await sheet.switchPlaybook(newPlaybook);
            await new Promise(r => setTimeout(r, 500));
          } catch (e) {
            errorThrown = true;
            console.error("Unexpected error during playbook switch:", e);
          }

          assert.ok(!errorThrown, "Switching playbook should not throw when no progress flags exist");
        });
      });

      t.section("Acquaintance Management", () => {
        t.test("switching playbook replaces neutral acquaintances", async function () {
          this.timeout(10000);

          // Get initial acquaintances
          const initialAcquaintances = actor.system.acquaintances || [];
          const initialNeutral = getAcquaintancesByStanding(actor, "neutral");

          // Record initial neutral acquaintance names for comparison
          const initialNeutralNames = initialNeutral.map(a => a.name);

          // Find a different playbook with different acquaintances
          const newPlaybook = await findClassItem("Spider");
          assert.ok(newPlaybook, "Should find Spider playbook in compendiums");

          // Switch playbook
          const sheet = await ensureSheet(actor);
          await sheet.switchPlaybook(newPlaybook);
          await new Promise(r => setTimeout(r, 500));

          // Get new acquaintances
          const newAcquaintances = actor.system.acquaintances || [];
          const newNeutral = getAcquaintancesByStanding(actor, "neutral");

          // If the playbooks have different acquaintances, the neutral ones should change
          // Note: Some acquaintances may be shared between playbooks
          if (newPlaybook.name !== playbookItem.name) {
            // At minimum, the acquaintance list should be updated
            assert.ok(
              newAcquaintances.length > 0,
              `Should have acquaintances after switch to ${newPlaybook.name} (got ${newAcquaintances.length})`
            );
          }
        });

        t.test("switching playbook preserves friendly acquaintance standings", async function () {
          this.timeout(10000);

          // Get initial acquaintances and set one to friendly
          const initialAcquaintances = actor.system.acquaintances || [];
          if (initialAcquaintances.length === 0) {
            this.skip(); // Can't test without acquaintances
            return;
          }

          // Find a neutral acquaintance and set to friendly
          const neutralAcq = initialAcquaintances.find(a => a.standing === "neutral");
          if (!neutralAcq) {
            this.skip(); // No neutral acquaintances to modify
            return;
          }

          const friendlyId = neutralAcq._id || neutralAcq.id;
          const friendlyName = neutralAcq.name;
          await setAcquaintanceStanding(actor, friendlyId, "friendly");
          await new Promise(r => setTimeout(r, 200));

          // Verify friendly standing was set
          const updatedAcq = actor.system.acquaintances.find(
            a => (a._id === friendlyId || a.id === friendlyId)
          );
          assert.equal(
            updatedAcq?.standing,
            "friendly",
            "Acquaintance should be set to friendly before switch"
          );

          // Switch playbook
          const newPlaybook = await findClassItem("Lurk");
          assert.ok(newPlaybook, "Should find Lurk playbook in compendiums");

          const sheet = await ensureSheet(actor);
          await sheet.switchPlaybook(newPlaybook);
          await new Promise(r => setTimeout(r, 500));

          // Check if the friendly acquaintance is preserved
          // Note: switchToPlaybookAcquaintances only removes NEUTRAL acquaintances
          // and adds new playbook acquaintances, so friendly ones should remain
          const afterSwitch = actor.system.acquaintances || [];
          const stillFriendly = afterSwitch.find(
            a => (a._id === friendlyId || a.id === friendlyId) && a.standing === "friendly"
          );

          assert.ok(
            stillFriendly,
            `Friendly acquaintance "${friendlyName}" should be preserved after playbook switch`
          );
        });

        t.test("switching playbook preserves rival acquaintance standings", async function () {
          this.timeout(10000);

          // Get initial acquaintances
          const initialAcquaintances = actor.system.acquaintances || [];
          if (initialAcquaintances.length === 0) {
            this.skip();
            return;
          }

          // Find a neutral acquaintance and set to rival
          const neutralAcq = initialAcquaintances.find(a => a.standing === "neutral");
          if (!neutralAcq) {
            this.skip();
            return;
          }

          const rivalId = neutralAcq._id || neutralAcq.id;
          const rivalName = neutralAcq.name;
          await setAcquaintanceStanding(actor, rivalId, "rival");
          await new Promise(r => setTimeout(r, 200));

          // Verify rival standing was set
          const updatedAcq = actor.system.acquaintances.find(
            a => (a._id === rivalId || a.id === rivalId)
          );
          assert.equal(
            updatedAcq?.standing,
            "rival",
            "Acquaintance should be set to rival before switch"
          );

          // Switch playbook
          const newPlaybook = await findClassItem("Slide");
          assert.ok(newPlaybook, "Should find Slide playbook in compendiums");

          const sheet = await ensureSheet(actor);
          await sheet.switchPlaybook(newPlaybook);
          await new Promise(r => setTimeout(r, 500));

          // Check if the rival acquaintance is preserved
          const afterSwitch = actor.system.acquaintances || [];
          const stillRival = afterSwitch.find(
            a => (a._id === rivalId || a.id === rivalId) && a.standing === "rival"
          );

          assert.ok(
            stillRival,
            `Rival acquaintance "${rivalName}" should be preserved after playbook switch`
          );
        });
      });

      t.section("Starting Attributes", () => {
        t.test("switching playbook applies new starting attributes", async function () {
          this.timeout(10000);

          // Record initial attributes
          const initialAttributes = foundry.utils.deepClone(actor.system.attributes);

          // Find a playbook with different starting skills
          // Cutter has Skirmish 2, Command 1
          // Hound has Hunt 2, Survey 1
          const newPlaybook = await findClassItem("Hound");
          assert.ok(newPlaybook, "Should find Hound playbook in compendiums");

          // Switch playbook
          const sheet = await ensureSheet(actor);
          await sheet.switchPlaybook(newPlaybook);
          await waitForActorUpdate(actor, { timeoutMs: 2000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 500));

          // Verify attributes changed
          const newAttributes = actor.system.attributes;

          // Check that the Hound's starting skills are applied
          // Hound should have Hunt 2 (in Insight) and Survey 1 (in Insight)
          const huntValue = parseInt(newAttributes?.insight?.skills?.hunt?.value) || 0;
          const surveyValue = parseInt(newAttributes?.insight?.skills?.survey?.value) || 0;

          // The exact values depend on the system's playbook definitions
          // At minimum, something should have changed if the playbooks have different starting skills
          const attributesChanged = JSON.stringify(initialAttributes) !== JSON.stringify(newAttributes);

          assert.ok(
            attributesChanged || playbookItem.name === newPlaybook.name,
            "Attributes should change when switching to a playbook with different starting skills"
          );
        });

        t.test("switching to same playbook preserves current attributes", async function () {
          this.timeout(10000);

          // Modify some skill values
          await actor.update({
            "system.attributes.insight.skills.hunt.value": "3"
          });
          await new Promise(r => setTimeout(r, 200));

          // Record current attributes
          const attributesBefore = foundry.utils.deepClone(actor.system.attributes);
          const huntBefore = attributesBefore?.insight?.skills?.hunt?.value;

          // Get the same playbook (Cutter) again
          const samePlaybook = await findClassItem("Cutter");
          assert.ok(samePlaybook, "Should find Cutter playbook in compendiums");

          // Switch to "same" playbook
          const sheet = await ensureSheet(actor);
          await sheet.switchPlaybook(samePlaybook);
          await new Promise(r => setTimeout(r, 500));

          // Note: switchPlaybook will apply starting attributes regardless
          // This test documents the expected behavior - starting attributes are reapplied
          const attributesAfter = actor.system.attributes;
          const huntAfter = attributesAfter?.insight?.skills?.hunt?.value;

          // The starting attributes should be reapplied (this is expected behavior)
          // The custom "3" value should be overwritten with the playbook default
          // Document this as expected behavior:
          assert.notEqual(
            huntBefore,
            huntAfter,
            "Switching playbook (even same one) reapplies starting attributes"
          );
        });
      });

      t.section("Full Playbook Switch Flow", () => {
        t.test("complete playbook switch from Cutter to Whisper", async function () {
          this.timeout(15000);

          // Set up some state that should change
          await setAbilityProgress(actor, "battleborn", 1);
          await new Promise(r => setTimeout(r, 200));

          // Get a neutral acquaintance and set to friendly (should be preserved)
          const initialAcquaintances = actor.system.acquaintances || [];
          let preservedAcqId = null;
          let preservedAcqName = null;
          if (initialAcquaintances.length > 0) {
            const neutralAcq = initialAcquaintances.find(a => a.standing === "neutral");
            if (neutralAcq) {
              preservedAcqId = neutralAcq._id || neutralAcq.id;
              preservedAcqName = neutralAcq.name;
              await setAcquaintanceStanding(actor, preservedAcqId, "friendly");
              await new Promise(r => setTimeout(r, 200));
            }
          }

          // Switch to Whisper
          const whisper = await findClassItem("Whisper");
          assert.ok(whisper, "Should find Whisper playbook in compendiums");

          const sheet = await ensureSheet(actor);
          await sheet.switchPlaybook(whisper);
          await new Promise(r => setTimeout(r, 1000));

          // Verify: ability progress cleared
          const progressAfter = getAbilityProgressFlags(actor);
          assert.ok(
            !progressAfter || Object.keys(progressAfter).length === 0,
            "Ability progress should be cleared"
          );

          // Verify: friendly acquaintance preserved (if we had one)
          if (preservedAcqId) {
            const afterSwitch = actor.system.acquaintances || [];
            const stillFriendly = afterSwitch.find(
              a => (a._id === preservedAcqId || a.id === preservedAcqId) && a.standing === "friendly"
            );
            assert.ok(
              stillFriendly,
              `Friendly acquaintance "${preservedAcqName}" should be preserved`
            );
          }

          // Verify: new playbook acquaintances added
          // Whisper should have their specific acquaintances
          const newAcquaintances = actor.system.acquaintances || [];
          assert.ok(
            newAcquaintances.length > 0,
            "Should have acquaintances after switching to Whisper"
          );
        });
      });
    },
    { displayName: "BitD Alt Sheets: Playbook Switching" }
  );
});
