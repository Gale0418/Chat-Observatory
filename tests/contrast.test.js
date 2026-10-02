const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "content.css"), "utf8");
const themes = ["black", "red", "orange", "yellow", "green", "blue", "purple", "gray", "white", "gold", "silver", "rainbow"];

function themeToken(theme, token) {
  let value;
  for (const [, selectors, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const matches = selectors.trim() === ":root" || selectors.split(",")
      .some((selector) => selector.trim() === `body[data-chatobs-theme="${theme}"]`);
    if (!matches) continue;
    const declaration = declarations.match(new RegExp(`${token}:\\s*([^;]+);`));
    if (declaration) value = declaration[1];
  }
  assert.ok(value, `${theme}: ${token}`);
  return value;
}

function rgb(hex) {
  return hex.match(/[a-f\d]{2}/gi).map((channel) => parseInt(channel, 16));
}

function luminance(channels) {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

test("十二套主題的選中語言與主題選單在整段漸層維持 4.5:1 文字對比", () => {
  for (const selector of [".chatobs-language-switch button.is-active", ".chatobs-theme-select-control"]) {
    const block = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .find(([, selectors]) => selectors.trim() === selector)?.[2];
    assert.match(block, /background:\s*linear-gradient\(var\(--chatobs-active-scrim\), var\(--chatobs-active-scrim\)\),\s*var\(--chatobs-active-gradient\)/);
  }
  for (const theme of themes) {
    const foreground = luminance(rgb(themeToken(theme, "--chatobs-text")));
    const stops = themeToken(theme, "--chatobs-active-gradient").match(/#[a-f\d]{6}/gi).map(rgb);
    const scrim = themeToken(theme, "--chatobs-active-scrim").match(/[\d.]+/g).map(Number);
    for (let segment = 0; segment < stops.length - 1; segment += 1) {
      for (let step = 0; step <= 100; step += 1) {
        const color = stops[segment].map((start, channel) => {
          const gradient = start + (stops[segment + 1][channel] - start) * step / 100;
          return scrim[channel] * scrim[3] + gradient * (1 - scrim[3]);
        });
        const background = luminance(color);
        const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        assert.ok(contrast >= 4.5, `${theme}: ${contrast.toFixed(2)}:1`);
      }
    }
  }
});
