/** Seed a reviewable restaurant and historical workflow while preserving an existing menu. */
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
  // Treat a populated menu as an existing workspace; rerunning setup must preserve its data.
  const [existingMenuCount] = await db.select({ value: count() }).from(menuItems);
  if (existingMenuCount?.value) {
    console.log("Seed already exists; existing restaurant data was preserved.");
  } else {
    // Keep the initial category, menu, customer, order, and history fixtures atomic.
    await db.transaction(async (transaction) => {
      const seededCategories = await transaction
        .insert(categories)
        .values(
          ["Starters", "Mains", "Desserts", "Drinks"].map((name, sortOrder) => ({
            name,
            sortOrder,
          })),
        )
        .returning();
      /** Resolve a seeded category ID without relying on insertion order. */
      const categoryIdForName = (name: string) => {
        const row = seededCategories.find((category) => category.name === name);
        if (!row) throw new Error(name);
        return row.id;
      };
      const seededMenuItems = await transaction
        .insert(menuItems)
        .values([
          {
            categoryId: categoryIdForName("Starters"),
            name: "Burrata garden salad",
            description: "Creamy burrata, heirloom tomatoes, basil oil & sourdough croutons.",
            priceCents: 1450,
            imageKey: "salad",
            featured: true,
          },
          {
            categoryId: categoryIdForName("Starters"),
            name: "Roasted tomato soup",
            description: "Slow-roasted vine tomatoes, fresh cream & toasted artisan bread.",
            priceCents: 950,
            imageKey: "soup",
          },
          {
            categoryId: categoryIdForName("Starters"),
            name: "Garlic sourdough",
            description: "Wood-fired sourdough, confit garlic butter & fresh parsley.",
            priceCents: 750,
            imageKey: "bread",
          },
          {
            categoryId: categoryIdForName("Mains"),
            name: "The Ember burger",
            description: "Flame-grilled beef, aged cheddar, house pickles & smoky aioli.",
            priceCents: 1850,
            imageKey: "burger",
            featured: true,
          },
          {
            categoryId: categoryIdForName("Mains"),
            name: "Wild mushroom pasta",
            description: "Fresh tagliatelle, woodland mushrooms, parmesan & truffle oil.",
            priceCents: 2200,
            imageKey: "pasta",
            featured: true,
          },
          {
            categoryId: categoryIdForName("Mains"),
            name: "Margherita pizza",
            description: "San Marzano tomatoes, fior di latte, fresh basil & olive oil.",
            priceCents: 1650,
            imageKey: "pizza",
          },
          {
            categoryId: categoryIdForName("Mains"),
            name: "Atlantic salmon",
            description: "Crisp-skinned salmon, seasonal greens & lemon beurre blanc.",
            priceCents: 2650,
            imageKey: "salmon",
          },
          {
            categoryId: categoryIdForName("Mains"),
            name: "Harvest grain bowl",
            description: "Roasted vegetables, ancient grains, avocado & tahini dressing.",
            priceCents: 1550,
            imageKey: "bowl",
          },
          {
            categoryId: categoryIdForName("Mains"),
            name: "Ember-grilled steak",
            description: "Grass-fed sirloin, rosemary potatoes & peppercorn jus.",
            priceCents: 3400,
            imageKey: "steak",
            available: false,
          },
          {
            categoryId: categoryIdForName("Desserts"),
            name: "Chocolate fondant",
            description: "Warm dark chocolate centre, vanilla bean ice cream & berries.",
            priceCents: 1050,
            imageKey: "cake",
          },
          {
            categoryId: categoryIdForName("Drinks"),
            name: "Iced oat latte",
            description: "Double-origin espresso, silky oat milk & plenty of ice.",
            priceCents: 550,
            imageKey: "coffee",
          },
          {
            categoryId: categoryIdForName("Drinks"),
            name: "House citrus lemonade",
            description: "Freshly squeezed lemons, orange blossom & sparkling water.",
            priceCents: 600,
            imageKey: "lemonade",
          },
        ])
        .returning();
      const customerNames = [
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
      const seededCustomers = await transaction
        .insert(customers)
        .values(
          customerNames.map((name, customerIndex) => ({
            name,
            email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
            phone: `+1 202 555 ${String(100 + customerIndex).padStart(4, "0")}`,
            notes:
              customerIndex === 0
                ? "Prefers contactless delivery. A regular since opening day."
                : "",
            createdAt: new Date(Date.now() - (60 - customerIndex * 2) * 86400000),
          })),
        )
        .returning();
      // Spread representative orders over fourteen days, retaining a few active kitchen states.
      for (let orderIndex = 0; orderIndex < 112; orderIndex++) {
        const customer = seededCustomers[orderIndex % seededCustomers.length];
        const mainDish = seededMenuItems[(orderIndex * 3 + Math.floor(orderIndex / 9)) % 8];
        const drinkDish = seededMenuItems[10 + (orderIndex % 2)];
        if (!customer || !mainDish || !drinkDish) throw new Error("Missing seed item");
        const orderLines = [
          {
            menuItemId: mainDish.id,
            name: mainDish.name,
            unitPriceCents: mainDish.priceCents,
            quantity: (orderIndex % 3) + 1,
          },
          {
            menuItemId: drinkDish.id,
            name: drinkDish.name,
            unitPriceCents: drinkDish.priceCents,
            quantity: 1,
          },
        ];
        const fulfillment =
          (["delivery", "pickup", "dine_in"] as const)[orderIndex % 3] ?? "pickup";
        const status =
          orderIndex > 105
            ? ((["pending", "accepted", "preparing", "ready"] as const)[orderIndex % 4] ??
              "pending")
            : orderIndex % 19 === 0
              ? "cancelled"
              : "completed";
        const daysAgo = Math.floor((111 - orderIndex) / 8);
        const createdAt = new Date(
          Date.now() - daysAgo * 86400000 - ((111 - orderIndex) % 8) * 240000,
        );
        const [row] = await transaction
          .insert(orders)
          .values({
            customerId: customer.id,
            status,
            fulfillment: fulfillment,
            // Use the same integer-cent pricing and tax rounding as live order creation.
            ...calculateTotals(orderLines, 800, fulfillment === "delivery" ? 350 : 0),
            idempotencyKey: crypto.randomUUID(),
            requestHash: "seed",
            deliveryAddress:
              fulfillment === "delivery" ? "24 Maple Street, Apt 3B, New York" : null,
            notes: orderIndex % 7 === 0 ? "No cutlery, please." : "",
            createdAt,
            updatedAt: createdAt,
          })
          .returning();
        if (!row) throw new Error("Missing seed order");
        await transaction
          .insert(orderItems)
          .values(orderLines.map((line) => ({ ...line, orderId: row.id })));
        // Snapshot both line prices and the progression timeline for the seeded status.
        const statusSequence = ["pending", "accepted", "preparing", "ready", "completed"] as const;
        const finalStatusIndex = status === "cancelled" ? 0 : statusSequence.indexOf(status);
        const events = statusSequence
          .slice(0, finalStatusIndex + 1)
          .map((eventStatus, eventIndex) => ({
            orderId: row.id,
            status: eventStatus,
            note: eventIndex === 0 ? "Order placed" : "",
            createdAt: new Date(createdAt.getTime() + eventIndex * 30000),
          }));
        if (status === "cancelled")
          events.push({
            orderId: row.id,
            status: "cancelled" as (typeof events)[number]["status"],
            note: "Cancelled at customer's request",
            createdAt: new Date(createdAt.getTime() + 60000),
          });
        await transaction.insert(orderEvents).values(events);
      }
    });
    console.log(
      "Seeded Olive & Ember: 4 categories, 12 dishes, 16 customers, 112 orders with history.",
    );
  }
} finally {
  await pool.end();
}
