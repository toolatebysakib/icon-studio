import { newItem, defaults, renamePreview } from "./model";
import {
  sanitizeSvg,
  buildSvg,
  renderPng,
  loadImage,
  removeBackground,
  dataSvg,
} from "./engine";
import { zipSync, unzipSync, strToU8 } from "fflate";
const results = document.querySelector("#results"),
  artifacts = document.querySelector("#artifacts");
function check(condition, message) {
  if (!condition) throw new Error(message);
}
async function run(name, fn) {
  const li = document.createElement("li");
  results.append(li);
  try {
    await fn();
    li.textContent = "PASS — " + name;
  } catch (e) {
    li.textContent = "FAIL — " + name + ": " + e.message;
    li.style.color = "#b23e51";
  }
}
async function pixels(blob) {
  const img = await loadImage(URL.createObjectURL(blob));
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return { cv, ctx, img };
}
document.querySelector("#run").onclick = async () => {
  results.innerHTML = "";
  artifacts.innerHTML = "";
  const item = newItem({
    name: "test",
    svg: sanitizeSvg(
      '<svg viewBox="0 0 100 50"><rect width="100" height="50" fill="#ffffff"/></svg>',
    ),
  });
  await run("Unsafe SVG content and all animation elements are removed", () => {
    const svg = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><style>body{display:none}</style><set attributeName="href" to="javascript:x"/><image href="https://example.com/secret"/><path d="M0 0 L24 24"><animate attributeName="opacity" values="0;1" dur="1s"/></path></svg>',
    );
    check(
      !/script|onload|animate|<set|<style|https:\/\/example/.test(svg),
      "Unsafe or animated content survived",
    );
  });
  await run("SVG preserves a non-square source viewBox and is static", () => {
    const svg = buildSvg(item);
    check(svg.includes('viewBox="0 0 100 50"'), "Source viewBox changed");
    check(!svg.includes("<animate"), "Motion found");
  });
  await run(
    "PNG has correct dimensions, transparent corners, and an opaque center",
    async () => {
      const blob = await renderPng(item, { size: 256 });
      const { cv, ctx, img } = await pixels(blob);
      check(img.width === 256 && img.height === 256, "Wrong PNG size");
      check(
        ctx.getImageData(0, 0, 1, 1).data[3] === 0,
        "Corner should be transparent",
      );
      check(
        ctx.getImageData(128, 128, 1, 1).data[3] === 255,
        "Center should be opaque",
      );
      artifacts.append(cv);
    },
  );
  await run(
    "Glyph-only export has transparent space around the foreground",
    async () => {
      const { ctx } = await pixels(
        await renderPng(item, { size: 256, glyphOnly: true }),
      );
      check(
        ctx.getImageData(10, 128, 1, 1).data[3] === 0,
        "Background found in glyph-only PNG",
      );
      check(ctx.getImageData(128, 128, 1, 1).data[3] > 0, "Glyph missing");
    },
  );
  await run("Solid and gradient recoloring render correctly", async () => {
    const colored = {
      ...item,
      style: { ...item.style, iconColorMode: "solid", iconColor1: "#ff0000" },
    };
    const { ctx } = await pixels(await renderPng(colored, { size: 128 }));
    const p = ctx.getImageData(64, 64, 1, 1).data;
    check(p[0] > 245 && p[1] < 10 && p[2] < 10, "Glyph did not recolor red");
    const gradient = buildSvg({
      ...colored,
      style: { ...colored.style, iconColorMode: "gradient" },
    });
    check(gradient.includes("url(#"), "Missing gradient");
  });
  await run(
    "Batch archive retains unique filenames and real PNG signatures",
    async () => {
      const blob = await renderPng(item, { size: 64 });
      const archive = zipSync({
        "app-01.png": new Uint8Array(await blob.arrayBuffer()),
        "app-02.svg": strToU8(buildSvg(item)),
      });
      const unpacked = unzipSync(archive);
      check(Object.keys(unpacked).length === 2, "Wrong file count");
      check(
        unpacked["app-01.png"][0] === 137 && unpacked["app-01.png"][1] === 80,
        "PNG signature incorrect",
      );
    },
  );
  await run("Background removal protects a foreground object", async () => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const c = cv.getContext("2d");
    c.fillStyle = "white";
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = "red";
    c.fillRect(20, 20, 24, 24);
    const imported = newItem({ name: "image", image: cv.toDataURL() });
    const img = await loadImage(await removeBackground(imported));
    c.clearRect(0, 0, 64, 64);
    c.drawImage(img, 0, 0, 64, 64);
    check(c.getImageData(0, 0, 1, 1).data[3] === 0, "Background remained");
    check(
      c.getImageData(32, 32, 1, 1).data[3] === 255,
      "Foreground was removed",
    );
  });
  await run("All added effects render in exported PNGs",async()=>{
    const styled={...item,style:{...item.style,enableGlow:true,enableOutline:true,enableGrain:true,enableVignette:true,enableAmbientLight:true,enableMonochrome:true,enableGlyphShadow:true}};
    const output=buildSvg(styled);check(output.includes('feMorphology')&&output.includes('feTurbulence'),'Effect definitions missing');
    const {ctx}=await pixels(await renderPng(styled,{size:256}));check(ctx.getImageData(128,128,1,1).data[3]===255,'Glyph disappeared with effects');check(ctx.getImageData(0,0,1,1).data[3]===0,'Effects leak outside the transparent bounds');
  });
  await run("Monochrome and opacity affect the foreground",async()=>{
    const styled={...item,svg:sanitizeSvg('<svg viewBox="0 0 24 24"><rect width="24" height="24" fill="#ff0000"/></svg>'),style:{...item.style,enableMonochrome:true,glyphOpacity:50}};
    const {ctx}=await pixels(await renderPng(styled,{size:128,glyphOnly:true}));const p=ctx.getImageData(64,64,1,1).data;check(Math.abs(p[0]-p[1])<3&&Math.abs(p[1]-p[2])<3,'Foreground not monochrome');check(p[3]>=125&&p[3]<=130,'Foreground opacity not preserved');
  });
  document.querySelector("#run").textContent = "Validation finished";
};
