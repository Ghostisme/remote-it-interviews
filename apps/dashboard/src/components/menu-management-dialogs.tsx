import { errorMessage } from "@odyssey/api-client";
import type { Category, MenuItem } from "@odyssey/types";
import { Badge, Banner, Button, Dialog, Row, Stack, Txt, tokens as t } from "@odyssey/ui";
import { Archive, Pencil, RotateCcw, Trash2 } from "lucide-react-native";
import { useState } from "react";
import {
  type MenuAction,
  useCategoryManagement,
  useMenuLifecycle,
} from "../features/menu/use-menu-management";
import { FoodImage, FormActions } from "./common";
import { CategoryDialog } from "./menu-dialogs";

/** Explain archive, restore, and guarded permanent deletion before applying the chosen action. */
export function MenuLifecycleDialog({
  item,
  action,
  onClose,
}: {
  item: MenuItem;
  action: MenuAction;
  onClose: () => void;
}) {
  const form = useMenuLifecycle(item, action, onClose);
  const title =
    action === "archive"
      ? "Archive this dish?"
      : action === "restore"
        ? "Back on the menu?"
        : "Delete this dish?";
  return (
    <Dialog
      visible
      title={title}
      onClose={() => {
        if (!form.saving) onClose();
      }}
      footer={
        <Row wrap style={{ justifyContent: "flex-end", flex: 1 }}>
          <Button variant="secondary" onPress={onClose} disabled={form.saving}>
            Cancel
          </Button>
          <Button
            variant={action === "delete" ? "danger" : "primary"}
            loading={form.saving}
            onPress={form.submit}
            icon={
              action === "archive" ? (
                <Archive size={15} color="white" />
              ) : action === "restore" ? (
                <RotateCcw size={15} color="white" />
              ) : (
                <Trash2 size={15} color={t.color.danger} />
              )
            }
          >
            {action === "archive"
              ? "Archive dish"
              : action === "restore"
                ? "Restore dish"
                : "Delete permanently"}
          </Button>
        </Row>
      }
    >
      <Stack gap={18}>
        {form.error ? <Banner tone="danger" message={form.error} /> : null}
        <Row gap={14}>
          <FoodImage imageKey={item.imageKey} size={64} />
          <Stack gap={4} style={{ flex: 1 }}>
            <Txt weight="semibold">{item.name}</Txt>
            <Badge tone={item.archivedAt ? "neutral" : "brand"}>
              {item.archivedAt ? "Archived" : "Active menu"}
            </Badge>
          </Stack>
        </Row>
        <Txt size={13} color={t.color.muted}>
          {action === "archive"
            ? "This dish will leave the active menu and cannot be added to new orders. Past orders stay intact. You can restore it from Archived at any time."
            : action === "restore"
              ? `This dish will return to the active menu as ${item.available ? "available" : "sold out"}. You can update its details and availability after restoring it.`
              : "This cannot be undone. Only dishes that have never appeared in an order can be permanently deleted. Dishes with order history stay safely archived."}
        </Txt>
      </Stack>
    </Dialog>
  );
}

/** Manage category identities and count archived dishes when deciding whether deletion is possible. */
export function CategoryManagerDialog({
  categories,
  items,
  onClose,
}: {
  categories: Category[];
  items: MenuItem[];
  onClose: () => void;
}) {
  const actions = useCategoryManagement();
  const [editing, setEditing] = useState<Category | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const [error, setError] = useState("");
  /** Delete the confirmed empty category and keep the dialog open if the API rejects it. */
  const remove = async () => {
    if (!removing) return;
    setError("");
    try {
      await actions.deleteCategory(removing);
      setRemoving(null);
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return (
    <>
      <Dialog
        visible
        title="Menu categories"
        subtitle="A little organization makes a great menu easier to explore."
        onClose={onClose}
        footer={
          <Button variant="secondary" onPress={onClose}>
            Done
          </Button>
        }
      >
        <Stack gap={12}>
          <Txt size={12} color={t.color.muted}>
            Rename a category or adjust its display order. Move all its dishes, including archived
            dishes, before deleting a category.
          </Txt>
          {categories.length === 0 ? (
            <Txt color={t.color.muted}>
              No categories yet. Add your first category from the menu.
            </Txt>
          ) : null}
          {categories.map((category) => {
            const dishes = items.filter((item) => item.categoryId === category.id);
            const archived = dishes.filter((item) => item.archivedAt).length;
            return (
              <Row
                key={category.id}
                wrap
                style={{
                  borderWidth: 1,
                  borderColor: t.color.line,
                  borderRadius: t.radius.md,
                  padding: 14,
                }}
              >
                <Stack gap={4} style={{ flex: 1, minWidth: 120 }}>
                  <Txt weight="medium">{category.name}</Txt>
                  <Txt size={11} color={t.color.muted}>
                    {dishes.length - archived} active · {archived} archived · Order{" "}
                    {category.sortOrder}
                  </Txt>
                </Stack>
                <Row gap={4}>
                  <Button
                    small
                    variant="secondary"
                    label={`Edit category ${category.name}`}
                    icon={<Pencil size={14} color={t.color.muted} />}
                    onPress={() => setEditing(category)}
                  >
                    Edit
                  </Button>
                  <Button
                    small
                    variant="ghost"
                    label={`Delete category ${category.name}`}
                    disabled={dishes.length > 0}
                    icon={<Trash2 size={15} color={t.color.danger} />}
                    onPress={() => {
                      setError("");
                      setRemoving(category);
                    }}
                  />
                </Row>
              </Row>
            );
          })}
        </Stack>
      </Dialog>
      {editing ? (
        <CategoryDialog
          category={editing}
          onClose={() => setEditing(null)}
          onSave={(name, sortOrder) => actions.save(editing, name, sortOrder)}
          saving={actions.saving}
        />
      ) : null}
      {removing ? (
        <Dialog
          visible
          title="Delete this category?"
          onClose={() => {
            if (!actions.deleting) setRemoving(null);
          }}
          footer={
            <FormActions
              onClose={() => setRemoving(null)}
              onSubmit={remove}
              loading={actions.deleting}
              label="Delete category"
              danger
            />
          }
        >
          <Stack>
            {error ? <Banner tone="danger" message={error} /> : null}
            <Txt>{removing.name}</Txt>
            <Txt size={12} color={t.color.muted}>
              This empty category will be permanently deleted. No dishes or orders will be removed.
            </Txt>
          </Stack>
        </Dialog>
      ) : null}
    </>
  );
}
