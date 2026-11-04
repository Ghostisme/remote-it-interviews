import { eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { categories, menuItems, orderItems } from "../db/schema";
import { DomainError } from "./errors";

/** Keep the missing-item response consistent across menu lifecycle commands. */
const menuItemNotFound = () =>
  new DomainError(404, "ITEM_NOT_FOUND", "This menu item could not be found.");

/** Hide or restore a dish without removing the rows referenced by historical orders. */
export async function setMenuItemArchived(db: Database, menuItemId: string, archived: boolean) {
  const [menuItem] = await db
    .update(menuItems)
    .set({
      archivedAt: archived ? new Date() : null,
      // Restoring does not silently promote a dish back into the featured selection.
      ...(archived ? { featured: false } : {}),
      updatedAt: new Date(),
    })
    .where(eq(menuItems.id, menuItemId))
    .returning();
  if (!menuItem) throw menuItemNotFound();
  return menuItem;
}

/** Permanently remove only archived dishes that have never appeared in an order. */
export async function deleteMenuItem(db: Database, menuItemId: string) {
  await db.transaction(async (tx) => {
    // Conflicts with the share lock taken while an order is placed for this item.
    const [item] = await tx
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, menuItemId))
      .for("update");
    if (!item) throw menuItemNotFound();
    if (!item.archivedAt)
      throw new DomainError(
        409,
        "ITEM_NOT_ARCHIVED",
        "Archive this dish before deleting it permanently.",
      );
    const [historicalOrderItem] = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.menuItemId, menuItemId))
      .limit(1);
    if (historicalOrderItem)
      throw new DomainError(
        409,
        "ITEM_HAS_ORDERS",
        `${item.name} appears in past orders, so it stays archived to keep order history intact.`,
      );
    await tx.delete(menuItems).where(eq(menuItems.id, menuItemId));
  });
}

/** Rename or reorder a category while retaining its stable dish references. */
export async function updateCategory(
  db: Database,
  categoryId: string,
  input: Partial<Pick<typeof categories.$inferInsert, "name" | "sortOrder">>,
) {
  const [category] = await db
    .update(categories)
    .set(input)
    .where(eq(categories.id, categoryId))
    .returning();
  if (!category)
    throw new DomainError(404, "CATEGORY_NOT_FOUND", "This category could not be found.");
  return category;
}

/** Delete an empty category; archived dishes still count as references to preserve. */
export async function deleteCategory(db: Database, categoryId: string) {
  await db.transaction(async (tx) => {
    const [category] = await tx
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .for("update");
    if (!category)
      throw new DomainError(404, "CATEGORY_NOT_FOUND", "This category could not be found.");
    const [usage] = await tx
      .select({
        active: sql<number>`count(*) filter (where ${isNull(menuItems.archivedAt)})::int`,
        archived: sql<number>`count(*) filter (where ${isNotNull(menuItems.archivedAt)})::int`,
      })
      .from(menuItems)
      .where(eq(menuItems.categoryId, categoryId));
    const { active = 0, archived = 0 } = usage ?? {};
    if (active + archived > 0)
      throw new DomainError(
        409,
        "CATEGORY_NOT_EMPTY",
        active
          ? `Move all dishes in ${category.name}, including archived dishes, to another category first.`
          : `${category.name} still holds archived dishes that keep order history intact.`,
      );
    await tx.delete(categories).where(eq(categories.id, categoryId));
  });
}
