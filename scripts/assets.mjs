import { mkdir, writeFile } from "node:fs/promises";

const photos = {
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
const dir = new URL("../apps/dashboard/public/images/", import.meta.url);
await mkdir(dir, { recursive: true });
await Promise.all(
  Object.entries(photos).map(async ([key, id]) => {
    const url = `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=760&q=85`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${key}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.headers.get("content-type")?.startsWith("image/") || bytes.length < 5000)
      throw new Error(`Invalid asset: ${key}`);
    await writeFile(new URL(`${key}.jpg`, dir), bytes);
    console.log(`${key}: ${bytes.length} bytes`);
  }),
);
