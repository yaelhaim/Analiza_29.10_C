const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");

// Loads index.html + script.js into a fake browser (jsdom) and returns helpers to drive the page.
async function loadPage() {
  const html = fs
    .readFileSync(path.join(ROOT, "index.html"), "utf8")
    .replace(/<script[^>]*src=["']script\.js["'][^>]*>\s*<\/script>/i, "");
  const script = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");

  // Errors thrown inside event listeners are reported here instead of being thrown.
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (err) => {
    if (!/Not implemented/.test(err.message)) errors.push(err);
  });

  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  try {
    window.eval(script);
  } catch (err) {
    throw new Error(`script.js crashed while loading: ${err.message}`);
  }
  if (window.document.readyState !== "complete") {
    await new Promise((resolve) => window.addEventListener("load", resolve));
  }

  const document = window.document;
  const page = {
    window,
    document,
    $: (selector) => document.querySelector(selector),
    $$: (selector) => [...document.querySelectorAll(selector)],

    // Fails the test if one of the student's event listeners threw an error.
    checkErrors() {
      if (errors.length) {
        const err = errors.shift();
        errors.length = 0;
        throw new Error(`Your code threw an error: ${err.detail?.message ?? err.message}`);
      }
    },

    // Types into an input/textarea like a user does (fires "input").
    type(selector, value) {
      const el = page.$(selector);
      el.focus();
      el.value = value;
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
      page.checkErrors();
    },

    // Chooses an option in a <select> (fires "input" and "change", like a browser).
    choose(selector, value) {
      const el = page.$(selector);
      el.value = value;
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
      el.dispatchEvent(new window.Event("change", { bubbles: true }));
      page.checkErrors();
    },

    click(target) {
      const el = typeof target === "string" ? page.$(target) : target;
      el.click();
      page.checkErrors();
    },

    // Submits a form by clicking its submit button. Returns true if the page would have reloaded.
    submit(formSelector) {
      const form = page.$(formSelector);
      let reloaded = false;
      const watch = (event) => {
        // runs after the student's listeners (registered on the window, last in the bubble path)
        reloaded = !event.defaultPrevented;
      };
      window.addEventListener("submit", watch);
      form.querySelector('[type="submit"]').click();
      window.removeEventListener("submit", watch);
      page.checkErrors();
      return reloaded;
    },
  };
  return page;
}

// True if the element is hidden with the hidden attribute, display:none or a "hidden" class.
function isHidden(el) {
  return el.hidden || el.style.display === "none" || el.classList.contains("hidden");
}

// Normalizes a CSS color so "#dc2626" and "rgb(220, 38, 38)" compare as equal.
function normalizeColor(window, value) {
  const probe = window.document.createElement("div");
  probe.style.color = value;
  return probe.style.color;
}

module.exports = { loadPage, isHidden, normalizeColor };
