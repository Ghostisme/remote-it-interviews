import { count } from "drizzle-orm";
import { connectDatabase } from "../src/db/client";
import {
  categories,
  customers,
  menuItems,
  orderEvents,
  orderItems,
  orders,
  settings,
} from "../src/db/schema";
import { calculateTotals } from "../src/domain/orders";
import { databaseUrl, requireDemoDatabase } from "./env";

requireDemoDatabase(databaseUrl);
const { db, pool } = connectDatabase(databaseUrl);
try {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [existing] = await db.select({ value: count() }).from(menuItems);
  if (existing?.value) {
    console.log("Seed already exists; existing restaurant data was preserved.");
  } else {
    await db.transaction(async (tx) => {
      const cats = await tx
        .insert(categories)
        .values(
          ["Starters", "Mains", "Desserts", "Drinks"].map((name, sortOrder) => ({
            name,
            sortOrder,
          })),
        )
        .returning();
      const cat = (name: string) => {
        const row = cats.find((c) => c.name === name);
        if (!row) throw new Error(name);
        return row.id;
      };
      const dishes = await tx
        .insert(menuItems)
        .values([
          {
            categoryId: cat("Starters"),
            name: "Burrata garden salad",
            description: "Creamy burrata, heirloom tomatoes, basil oil & sourdough croutons.",
            priceCents: 1450,
            imageKey: "salad",
            featured: true,
          },
          {
            categoryId: cat("Starters"),
            name: "Roasted tomato soup",
            description: "Slow-roasted vine tomatoes, fresh cream & toasted artisan bread.",
            priceCents: 950,
            imageKey: "soup",
          },
          {
            categoryId: cat("Starters"),
            name: "Garlic sourdough",
            description: "Wood-fired sourdough, confit garlic butter & fresh parsley.",
            priceCents: 750,
            imageKey: "bread",
          },
          {
            categoryId: cat("Mains"),
            name: "The Ember burger",
            description: "Flame-grilled beef, aged cheddar, house pickles & smoky aioli.",
            priceCents: 1850,
            imageKey: "burger",
            featured: true,
          },
          {
            categoryId: cat("Mains"),
            name: "Wild mushroom pasta",
            description: "Fresh tagliatelle, woodland mushrooms, parmesan & truffle oil.",
            priceCents: 2200,
            imageKey: "pasta",
            featured: true,
          },
          {
            categoryId: cat("Mains"),
            name: "Margherita pizza",
            description: "San Marzano tomatoes, fior di latte, fresh basil & olive oil.",
            priceCents: 1650,
            imageKey: "pizza",
          },
          {
            categoryId: cat("Mains"),
            name: "Atlantic salmon",
            description: "Crisp-skinned salmon, seasonal greens & lemon beurre blanc.",
            priceCents: 2650,
            imageKey: "salmon",
          },
          {
            categoryId: cat("Mains"),
            name: "Harvest grain bowl",
            description: "Roasted vegetables, ancient grains, avocado & tahini dressing.",
            priceCents: 1550,
            imageKey: "bowl",
          },
          {
            categoryId: cat("Mains"),
            name: "Ember-grilled steak",
            description: "Grass-fed sirloin, rosemary potatoes & peppercorn jus.",
            priceCents: 3400,
            imageKey: "steak",
            available: false,
          },
          {
            categoryId: cat("Desserts"),
            name: "Chocolate fondant",
            description: "Warm dark chocolate centre, vanilla bean ice cream & berries.",
            priceCents: 1050,
            imageKey: "cake",
          },
          {
            categoryId: cat("Drinks"),
            name: "Iced oat latte",
            description: "Double-origin espresso, silky oat milk & plenty of ice.",
            priceCents: 550,
            imageKey: "coffee",
          },
          {
            categoryId: cat("Drinks"),
            name: "House citrus lemonade",
            description: "Freshly squeezed lemons, orange blossom & sparkling water.",
            priceCents: 600,
            imageKey: "lemonade",
          },
        ])
        .returning();
      const names = [
        "Sophie Chen",
        "James Wilson",
        "Emma Thompson",
        "Oliver Brown",
        "Mia Johnson",
        "Noah Williams",
        "Isabella Garcia",
        "Ethan Davis",
        "Amelia Martin",
        "Liam Anderson",
        "Charlotte Lee",
        "Lucas Taylor",
        "Harper White",
        "Henry Moore",
        "Evelyn Clark",
        "Leo Robinson",
      ];
      const people = await tx
        .insert(customers)
        .values(
          names.map((name, i) => ({
            name,
            email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
            phone: `+1 202 555 ${String(100 + i).padStart(4, "0")}`,
            notes: i === 0 ? "Prefers contactless delivery. A regular since opening day." : "",
            createdAt: new Date(Date.now() - (60 - i * 2) * 86400000),
          })),
        )
        .returning();
      for (let i = 0; i < 112; i++) {
        const person = people[i % people.length];
        const main = dishes[(i * 3 + Math.floor(i / 9)) % 8];
        const drink = dishes[10 + (i % 2)];
        if (!person || !main || !drink) throw new Error("Missing seed item");
        const lines = [
          {
            menuItemId: main.id,
            name: main.name,
            unitPriceCents: main.priceCents,
            quantity: (i % 3) + 1,
          },
          { menuItemId: drink.id, name: drink.name, unitPriceCents: drink.priceCents, quantity: 1 },
        ];
        const type = (["delivery", "pickup", "dine_in"] as const)[i % 3] ?? "pickup";
        const status =
          i > 105
            ? ((["pending", "accepted", "preparing", "ready"] as const)[i % 4] ?? "pending")
            : i % 19 === 0
              ? "cancelled"
              : "completed";
        const daysAgo = Math.floor((111 - i) / 8);
        const createdAt = new Date(Date.now() - daysAgo * 86400000 - ((111 - i) % 8) * 240000);
        const [row] = await tx
          .insert(orders)
          .values({
            customerId: person.id,
            status,
            fulfillment: type,
            ...calculateTotals(lines, 800, type === "delivery" ? 350 : 0),
            idempotencyKey: crypto.randomUUID(),
            requestHash: "seed",
            deliveryAddress: type === "delivery" ? "24 Maple Street, Apt 3B, New York" : null,
            notes: i % 7 === 0 ? "No cutlery, please." : "",
            createdAt,
            updatedAt: createdAt,
          })
          .returning();
        if (!row) throw new Error("Missing seed order");
        await tx.insert(orderItems).values(lines.map((line) => ({ ...line, orderId: row.id })));
        const sequence = ["pending", "accepted", "preparing", "ready", "completed"] as const;
        const last = status === "cancelled" ? 0 : sequence.indexOf(status);
        const events = sequence.slice(0, last + 1).map((state, j) => ({
          orderId: row.id,
          status: state,
          note: j === 0 ? "Order placed" : "",
          createdAt: new Date(createdAt.getTime() + j * 30000),
        }));
        if (status === "cancelled")
          events.push({
            orderId: row.id,
            status: "cancelled" as (typeof events)[number]["status"],
            note: "Cancelled at customer's request",
            createdAt: new Date(createdAt.getTime() + 60000),
          });
        await tx.insert(orderEvents).values(events);
      }
    });
    console.log(
      "Seeded Olive & Ember: 4 categories, 12 dishes, 16 customers, 112 orders with history.",
    );
  }
} finally {
  await pool.end();
}
