import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client, handle_file } from "@gradio/client";

const OUTPUT_DIR = "staged_full";
const FRAME_DIR = "frames";
const ORIGINAL_VIDEO =
  "C:\\Users\\rokes\\Downloads\\WhatsApp Video 2026-03-16 at 11.10.48 AM.mp4";

const ADDITIONAL_PROMPT =
  "design-style interior designed, smooth painted walls, elegant modern furniture, warm ambient lighting, balanced daylight, photorealistic, captured with a DSLR camera using f/10 aperture, 1/60 sec shutter speed, ISO 400, 20mm focal length";

const NEGATIVE_PROMPT =
  "EasyNegativeV2, fcNeg, clutter, distortion, duplicate objects, warped walls, unfinished construction debris, low quality, blurry details";

function getScene(frameNumber) {
  if (frameNumber <= 3) {
    return {
      style: "Minimalistic",
      prompt:
        "modern Indian house entrance facade, warm ivory painted walls, refined front elevation, polished exterior finish, subtle architectural lighting, clean and photorealistic",
    };
  }

  if (frameNumber <= 10) {
    return {
      style: "Minimalistic",
      prompt:
        "modern Indian living hall, warm cream walls, elegant sofa seating, TV unit, dining accents, ceiling spotlights, cove lighting, polished flooring, fully furnished and photorealistic",
    };
  }

  if (frameNumber <= 13) {
    return {
      style: "Scandinavian",
      prompt:
        "modern Indian bedroom, warm white walls, wooden bed, wardrobe, side tables, curtains, soft lighting, fully furnished and photorealistic",
    };
  }

  if (frameNumber <= 20) {
    return {
      style: "Minimalistic",
      prompt:
        "modern staircase lobby, warm ivory walls, refined railing, console table, ambient stair lighting, polished floor, elegant and photorealistic",
    };
  }

  if (frameNumber <= 27) {
    return {
      style: "Minimalistic",
      prompt:
        "modern upper hallway and landing, warm white walls, wooden trim, decorative wall lighting, finished flooring, clean passage design, photorealistic",
    };
  }

  if (frameNumber <= 32) {
    return {
      style: "Scandinavian",
      prompt:
        "modern bright bedroom or lounge, warm off-white walls, soft wooden furniture, cozy decor, finished flooring, warm lighting, fully furnished and photorealistic",
    };
  }

  if (frameNumber <= 35) {
    return {
      style: "Beach",
      prompt:
        "modern rooftop terrace, painted parapet walls, outdoor seating, planters, tropical modern style, warm outdoor lighting, polished terrace floor, photorealistic",
    };
  }

  if (frameNumber <= 40) {
    return {
      style: "Minimalistic",
      prompt:
        "modern upstairs family lounge, warm cream walls, stylish sofa seating, decor accents, elegant ceiling lights, finished modern home interior, fully furnished and photorealistic",
    };
  }

  return {
    style: "Minimalistic",
    prompt:
      "modern finished utility room, clean tiled walls, compact storage, neat interior finish, bright lighting, polished and photorealistic",
  };
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, buffer);
}

async function renderFrame(frameName, attempt = 1) {
  const frameNumber = Number(frameName.match(/(\d+)/)?.[1] ?? 0);
  const scene = getScene(frameNumber);
  const source = join(FRAME_DIR, frameName);
  const output = join(OUTPUT_DIR, frameName.replace(".jpg", ".webp"));

  if (await exists(output)) {
    console.log(`Skipping ${frameName} (already rendered)`);
    return;
  }

  console.log(`Rendering ${frameName} [attempt ${attempt}]`);

  try {
    const app = await Client.connect("broyang/interior-ai-designer");
    const result = await app.predict("/auto_process_image", {
      image: handle_file(source),
      style_selection: scene.style,
      prompt: scene.prompt,
      a_prompt: ADDITIONAL_PROMPT,
      n_prompt: NEGATIVE_PROMPT,
      num_images: 1,
      image_resolution: 512,
      preprocess_resolution: 512,
      num_steps: 12,
      guidance_scale: 5.5,
      seed: 12345,
    });

    const image = result.data?.[0];
    if (!image?.url) {
      throw new Error(`No output URL returned for ${frameName}`);
    }

    await download(image.url, output);
    console.log(`Saved ${output}`);
  } catch (error) {
    if (attempt < 3) {
      console.log(`Retrying ${frameName} after error: ${String(error).slice(0, 160)}`);
      await delay(3000);
      return renderFrame(frameName, attempt + 1);
    }

    throw error;
  }
}

async function createConcatList(frameNames) {
  const lines = [];

  for (const frameName of frameNames) {
    const stagedName = frameName.replace(".jpg", ".webp");
    const stagedPath = join(process.cwd(), OUTPUT_DIR, stagedName).replace(/\\/g, "/");
    lines.push(`file '${stagedPath}'`);
    lines.push("duration 2");
  }

  const lastStaged = join(process.cwd(), OUTPUT_DIR, frameNames.at(-1).replace(".jpg", ".webp")).replace(
    /\\/g,
    "/",
  );
  lines.push(`file '${lastStaged}'`);

  await writeFile(join(OUTPUT_DIR, "frames.txt"), `${lines.join("\n")}\n`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const frameNames = (await readdir(FRAME_DIR))
    .filter((name) => name.endsWith(".jpg"))
    .sort();

  for (const frameName of frameNames) {
    await renderFrame(frameName);
    await delay(1000);
  }

  await createConcatList(frameNames);
  console.log(`Generated ${frameNames.length} staged frames.`);
  console.log(`Concat list ready at ${join(OUTPUT_DIR, "frames.txt")}`);
  console.log(`Original audio source: ${basename(ORIGINAL_VIDEO)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
