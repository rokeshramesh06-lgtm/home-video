import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Client, handle_file } from "@gradio/client";

const OUTPUT_DIR = "staged";

const ADDITIONAL_PROMPT =
  "design-style interior designed (interior space), warm ambient lighting, balanced daylight, photorealistic, captured with a DSLR camera using f/10 aperture, 1/60 sec shutter speed, ISO 400, 20mm focal length";

const NEGATIVE_PROMPT =
  "EasyNegativeV2, fcNeg, (badhandv4:1.4), (worst quality, low quality, bad quality, normal quality:2.0), clutter, distortion, warped walls, extra furniture, duplicate objects";

const rooms = [
  {
    input: "frames/frame_016.jpg",
    output: "living_hall.webp",
    style: "Minimalistic",
    prompt:
      "modern Indian family living hall with staircase, warm ivory walls, soft beige accents, elegant L-shaped sofa, TV unit, console table, subtle wood panels, recessed ceiling spotlights, cozy cove lighting, clean polished flooring, fully furnished",
  },
  {
    input: "frames/frame_030.jpg",
    output: "bedroom.webp",
    style: "Scandinavian",
    prompt:
      "modern Indian bedroom with warm white walls, light wood furniture, queen bed, side tables, wardrobe, curtains, soft layered bedding, recessed ceiling spotlights, warm ambient lighting, elegant and fully furnished",
  },
  {
    input: "frames/frame_038.jpg",
    output: "lounge.webp",
    style: "Minimalistic",
    prompt:
      "bright modern lounge in an Indian home, warm cream walls, textured TV wall, sofa set, accent chair, side table, indoor decor, recessed ceiling spotlights, soft cove lighting, airy and fully furnished",
  },
];

async function downloadImage(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, buffer);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const app = await Client.connect("broyang/interior-ai-designer");

  for (const room of rooms) {
    console.log(`Generating ${basename(room.output)} from ${room.input}...`);

    const result = await app.predict("/auto_process_image", {
      image: handle_file(room.input),
      style_selection: room.style,
      prompt: room.prompt,
      a_prompt: ADDITIONAL_PROMPT,
      n_prompt: NEGATIVE_PROMPT,
      num_images: 1,
      image_resolution: 512,
      preprocess_resolution: 512,
      num_steps: 15,
      guidance_scale: 5.5,
      seed: 12345,
    });

    const image = result.data?.[0];
    if (!image?.url) {
      throw new Error(`No output returned for ${room.input}`);
    }

    const destination = join(OUTPUT_DIR, room.output);
    await downloadImage(image.url, destination);
    console.log(`Saved ${destination}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
