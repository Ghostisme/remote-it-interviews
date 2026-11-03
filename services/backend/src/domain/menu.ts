import { eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { categories, menuItems, orderItems } from "../db/schema";
import { DomainError } from "./errors";

const itemNotFound = () =>
  new DomainError(404, "ITEM_NOT_FOUND", "This menu item could not be found.");

export async function setMenuItemArchived(db: Database, id: string, archived: boolean) {
  const [row] = await db
    .update(menuItems)
    .set({
      archivedAt: archived ? new Date() : null,
      ...(archived ? { featured: false } : {}),
      updatedAt: new Date(),
    })
    .where(eq(menuItems.id, id))
    .returning();
  if (!row) throw itemNotFound();
  return row;
}

export async function deleteMenuItem(db: Database, id: string) {
  await db.transaction(async (tx) => {
    // Conflicts with the share lock taken while an order is placed for this item.
    const [item] = await tx.select().from(menuItems).where(eq(menuItems.id, id)).for("update");
    if (!item) throw itemNotFound();
    if (!item.archivedAt)
      throw new DomainError(
        409,
        "ITEM_NOT_ARCHIVED",
        "Archive this dish before deleting it permanently.",
      );
    const [ordered] = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.menuItemId, id))
      .limit(1);
    if (ordered)
      throw new DomainError(
        409,
        "ITEM_HAS_ORDERS",
        `${item.name} appears in past orders, so it stays archived to keep order history intact.`,
      );
    await tx.delete(menuItems).where(eq(menuItems.id, id));
  });
}

export async function updateCategory(
  db: Database,
  id: string,
  input: Partial<Pick<typeof categories.$inferInsert, "name" | "sortOrder">>,
) {
  const [row] = await db.update(categories).set(input).where(eq(categories.id, id)).returning();
  if (!row) throw new DomainError(404, "CATEGORY_NOT_FOUND", "This category could not be found.");
  return row;
}

export async function deleteCategory(db: Database, id: string) {
  await db.transaction(async (tx) => {
    const [category] = await tx
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .for("update");
    if (!category)
      throw new DomainError(404, "CATEGORY_NOT_FOUND", "This category could not be found.");
    const [usage] = await tx
      .select({
        active: sql<number>`count(*) filter (where ${isNull(menuItems.archivedAt)})::int`,
        archived: sql<number>`count(*) filter (where ${isNotNull(menuItems.archivedAt)})::int`,
      })
      .from(menuItems)
      .where(eq(menuItems.categoryId, id));
    const { active = 0, archived = 0 } = usage ?? {};
    if (active + archived > 0)
      throw new DomainError(
        409,
        "CATEGORY_NOT_EMPTY",
        active
          ? `Move or archive the ${active} ${active === 1 ? "dish" : "dishes"} in ${category.name} first.`
          : `${category.name} still holds archived dishes that keep order history intact.`,
      );
    await tx.delete(categories).where(eq(categories.id, id));
  });
}
