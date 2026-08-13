import test from "node:test";
import assert from "node:assert/strict";

globalThis.Hooks = {
  once: () => {},
  on: () => {},
};
globalThis.window = { addEventListener: () => {} };
globalThis.document = {
  querySelectorAll: () => [],
  body: { appendChild: () => {} },
};
globalThis.canvas = { ready: true };
globalThis.game = {
  settings: { get: (_module, key) => key !== "enabled" },
};

const { PF2ETokenBar } = await import("../scripts/token-bar.js");

function renderDocument(initialBars = []) {
  const bars = [...initialBars];
  return {
    bars,
    querySelectorAll(selector) {
      assert.equal(selector, "#pf2e-token-bar");
      return [...bars];
    },
    body: {
      appendChild(element) {
        bars.push(element);
      },
    },
  };
}

function bar(label) {
  return {
    label,
    remove() {
      const index = this.owner.bars.indexOf(this);
      if (index >= 0) this.owner.bars.splice(index, 1);
    },
  };
}

function addBars(root, labels) {
  for (const label of labels) {
    const element = bar(label);
    element.owner = root;
    root.bars.push(element);
  }
}

test("latest concurrent render wins and a stale render cannot commit", () => {
  const root = renderDocument();
  const older = bar("older");
  const newer = bar("newer");
  older.owner = newer.owner = root;

  const generationA = ++PF2ETokenBar.renderGeneration;
  const generationB = ++PF2ETokenBar.renderGeneration;

  assert.equal(PF2ETokenBar.commitRender(generationB, newer, root), true);
  assert.equal(PF2ETokenBar.commitRender(generationA, older, root), false);
  assert.deepEqual(root.bars.map(element => element.label), ["newer"]);
});

test("a successful render removes every pre-existing duplicate bar", () => {
  const root = renderDocument();
  addBars(root, ["old-1", "old-2", "old-3"]);
  const newest = bar("newest");
  newest.owner = root;
  const generation = ++PF2ETokenBar.renderGeneration;

  assert.equal(PF2ETokenBar.commitRender(generation, newest, root), true);
  assert.deepEqual(root.bars.map(element => element.label), ["newest"]);
});

test("disabled rendering removes every pre-existing duplicate bar", async () => {
  const root = renderDocument();
  addBars(root, ["old-1", "old-2", "old-3"]);
  globalThis.document = root;
  game.settings.get = (_module, key) => key === "enabled" ? false : false;

  await PF2ETokenBar.render();

  assert.equal(root.bars.length, 0);
});
