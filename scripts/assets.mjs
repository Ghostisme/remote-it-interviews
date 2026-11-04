/** Refresh the curated, bundled food photos; the running dashboard reads the committed local copies. */
import { mkdir, writeFile } from "node:fs/promises";

const photoSources = {
  salad: "1512621776951-a57141f2eefd",
  burger: "1568901346375-23c9450c58cd",
  pasta: "1473093295043-cdd812d0e601",
  pizza: "1513104890138-7c749659a591",
  salmon: "1467003909585-2f8a72700288",
  steak: "1558030006-450675393462",
  soup: "1547592180-85f173990554",
  cake: "1578985545062-69928b1d9587",
  coffee: "1461023058943-07fcbe16d735",
  lemonade: "1544145945-f90425340c7e",
  bowl: "1540420773420-3366772f4999",
  bread: "1509440159596-0249088772ff",
};
const imageDirectory = new URL("../apps/dashboard/public/images/", import.meta.url);
await mkdir(imageDirectory, { recursive: true });
await Promise.all(
  Object.entries(photoSources).map(async ([imageKey, photoId]) => {
    const url = `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=760&q=85`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${imageKey}: ${response.status}`);
    const imageBytes = Buffer.from(await response.arrayBuffer());
    // Reject failed or unexpectedly small downloads before replacing a bundled image.
    if (!response.headers.get("content-type")?.startsWith("image/") || imageBytes.length < 5000)
      throw new Error(`Invalid asset: ${imageKey}`);
    await writeFile(new URL(`${imageKey}.jpg`, imageDirectory), imageBytes);
    console.log(`${imageKey}: ${imageBytes.length} bytes`);
  }),
);
