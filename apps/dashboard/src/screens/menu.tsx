import { useGetMenu } from "@odyssey/api-client";
import { formatMoney } from "@odyssey/shared";
import type { MenuItem } from "@odyssey/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Row,
  SearchField,
  Select,
  Stack,
  Toggle,
  Txt,
  tokens as t,
} from "@odyssey/ui";
import {
  FolderPlus,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { contentWidth, FoodImage, PageHeading, QueryError, Tabs } from "../components/common";
import { CategoryDialog, MenuItemDialog } from "../components/menu-dialogs";
import { CategoryManagerDialog, MenuLifecycleDialog } from "../components/menu-management-dialogs";
import { useMenuActions } from "../features/menu/use-menu-form";
import type { MenuAction } from "../features/menu/use-menu-management";

/** Filter active/archived dishes and coordinate dish, category, and lifecycle dialogs. */
export default function MenuScreen() {
  const menuQuery = useGetMenu();
  const actions = useMenuActions();
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("all");
  const [menuView, setMenuView] = useState("active");
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | "new" | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [lifecycleCommand, setLifecycleCommand] = useState<{
    item: MenuItem;
    action: MenuAction;
  } | null>(null);
  const { width } = useWindowDimensions();
  const compactFilters = width < 650;
  const columnCount = width >= 1400 ? 3 : width >= 1000 ? 2 : width >= 650 ? 2 : 1;
  // Use the same sidebar and gutter calculation as the shell to avoid mobile overflow.
  const menuCardWidth = (contentWidth(width) - (columnCount - 1) * 20) / columnCount;
  const categories = menuQuery.data?.categories ?? [];
  const allItems = menuQuery.data?.items ?? [];
  const items = allItems.filter((item) =>
    menuView === "archived" ? !!item.archivedAt : !item.archivedAt,
  );
  const visibleMenuItems = items.filter(
    (item) =>
      (selectedCategoryId === "all" || item.categoryId === selectedCategoryId) &&
      `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()) &&
      (availability === "all" || item.available === (availability === "available")),
  );
  return (
    <Stack gap={20}>
      <PageHeading
        eyebrow="Made with care"
        title="A menu worth coming back for."
        subtitle="Your signature dishes. Every detail, just right."
        action={
          <Row wrap style={{ maxWidth: "100%", flexShrink: 1 }}>
            <Button
              variant="secondary"
              icon={<FolderPlus size={15} color={t.color.ink} />}
              onPress={() => setAddingCategory(true)}
            >
              Add category
            </Button>
            <Button
              icon={<Plus size={16} color="white" />}
              onPress={() => setEditingMenuItem("new")}
              disabled={!menuQuery.data}
            >
              Add menu item
            </Button>
          </Row>
        }
      />
      <Card padding={18}>
        <Stack gap={16}>
          <Row wrap style={{ justifyContent: "space-between" }}>
            <Tabs
              value={menuView}
              onChange={(value) => {
                setMenuView(value);
                setAvailability("all");
              }}
              options={[
                {
                  value: "active",
                  label: compactFilters ? "Active" : "Active menu",
                  count: allItems.filter((item) => !item.archivedAt).length,
                },
                {
                  value: "archived",
                  label: "Archived",
                  count: allItems.filter((item) => item.archivedAt).length,
                },
              ]}
            />
            <Button
              small
              variant="ghost"
              label="Manage categories"
              icon={<SlidersHorizontal size={14} color={t.color.muted} />}
              onPress={() => setManagingCategories(true)}
              disabled={!menuQuery.data}
            >
              {compactFilters ? undefined : "Manage categories"}
            </Button>
          </Row>
          {!compactFilters ? (
            <Row wrap style={{ justifyContent: "space-between" }}>
              <Tabs
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                options={[
                  { value: "all", label: "All dishes", count: items.length },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                    count: items.filter((menuItem) => menuItem.categoryId === category.id).length,
                  })),
                ]}
              />
              <Badge tone={menuView === "archived" ? "neutral" : "success"} dot>
                {menuView === "archived"
                  ? "Hidden from new orders"
                  : `${items.filter((menuItem) => menuItem.available).length} available`}
              </Badge>
            </Row>
          ) : null}
          <Row wrap style={{ borderTopWidth: 1, borderColor: t.color.line, paddingTop: 16 }}>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search your menu..."
              style={{ flex: 1, minWidth: 190 }}
            />
            {!compactFilters ? (
              <Select
                value={availability}
                onChange={setAvailability}
                options={[
                  { value: "all", label: "All availability" },
                  { value: "available", label: "Available" },
                  { value: "soldout", label: "Sold out" },
                ]}
              />
            ) : null}
          </Row>
          {compactFilters ? (
            <Row style={{ alignItems: "flex-start" }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Select
                  label="Menu category"
                  value={selectedCategoryId}
                  onChange={setSelectedCategoryId}
                  options={[
                    { value: "all", label: `All dishes (${items.length})` },
                    ...categories.map((category) => ({ value: category.id, label: category.name })),
                  ]}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Select
                  label="Availability"
                  value={availability}
                  onChange={setAvailability}
                  options={[
                    { value: "all", label: "All availability" },
                    { value: "available", label: "Available" },
                    { value: "soldout", label: "Sold out" },
                  ]}
                />
              </View>
            </Row>
          ) : null}
        </Stack>
      </Card>
      {menuQuery.isPending ? (
        <LoadingState />
      ) : menuQuery.isError ? (
        <QueryError error={menuQuery.error} retry={menuQuery.refetch} />
      ) : visibleMenuItems.length === 0 ? (
        <Card>
          <EmptyState
            title={
              search || selectedCategoryId !== "all" || availability !== "all"
                ? "No dishes found"
                : menuView === "archived"
                  ? "No archived dishes"
                  : "Your menu starts here"
            }
            message={
              menuView === "archived"
                ? "Archived dishes stay here for safekeeping. You can restore them whenever you're ready."
                : "Try another filter, or add something delicious to the menu."
            }
            action={
              <Button
                variant="secondary"
                onPress={() => {
                  setSelectedCategoryId("all");
                  setSearch("");
                  setAvailability("all");
                  if (!items.length) {
                    if (menuView === "archived") setMenuView("active");
                    else setEditingMenuItem("new");
                  }
                }}
              >
                {items.length
                  ? "Clear filters"
                  : menuView === "archived"
                    ? "Back to active menu"
                    : "Add your first dish"}
              </Button>
            }
          />
        </Card>
      ) : (
        <Row wrap gap={20} style={{ alignItems: "stretch" }}>
          {visibleMenuItems.map((item) => (
            <View key={item.id} style={{ width: menuCardWidth }}>
              <Card padding={0} style={{ overflow: "hidden", flex: 1 }}>
                <View>
                  <FoodImage imageKey={item.imageKey} height={195} radius={0} />
                  <View
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 14,
                      right: 14,
                      alignItems: "flex-start",
                    }}
                  >
                    {item.archivedAt ? (
                      <Badge tone="neutral">Archived</Badge>
                    ) : item.featured ? (
                      <Badge tone="brand">
                        <Sparkles size={10} color={t.color.brand} /> Chef's pick
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        {categories.find((category) => category.id === item.categoryId)?.name ??
                          "Menu"}
                      </Badge>
                    )}
                  </View>
                  {!item.available && !item.archivedAt ? (
                    <View style={{ position: "absolute", bottom: 14, right: 14 }}>
                      <Badge tone="danger">Sold out</Badge>
                    </View>
                  ) : null}
                </View>
                <Stack gap={12} style={{ padding: 20, flex: 1 }}>
                  <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Txt size={16} weight="semibold" style={{ flex: 1 }}>
                      {item.name}
                    </Txt>
                    <Txt size={16} weight="semibold" color={t.color.brand}>
                      {formatMoney(item.priceCents)}
                    </Txt>
                  </Row>
                  <Txt size={12} color={t.color.muted} lines={2} style={{ minHeight: 36 }}>
                    {item.description || "Made fresh, with a little extra care."}
                  </Txt>
                  <Row
                    wrap
                    style={{
                      marginTop: "auto",
                      paddingTop: 14,
                      borderTopWidth: 1,
                      borderColor: t.color.line,
                      justifyContent: "space-between",
                    }}
                  >
                    {item.archivedAt ? (
                      <Row gap={6}>
                        <Button
                          small
                          variant="secondary"
                          label={`Restore ${item.name}`}
                          icon={<RotateCcw size={13} color={t.color.brand} />}
                          onPress={() => setLifecycleCommand({ item, action: "restore" })}
                        >
                          Restore
                        </Button>
                        <Button
                          small
                          variant="ghost"
                          label={`Delete ${item.name}`}
                          icon={<Trash2 size={14} color={t.color.danger} />}
                          onPress={() => setLifecycleCommand({ item, action: "delete" })}
                        />
                      </Row>
                    ) : (
                      <Row gap={7}>
                        <Toggle
                          label="Available"
                          value={item.available}
                          onChange={() => {
                            void actions.toggle(item);
                          }}
                          disabled={actions.toggling}
                        />
                        <Txt size={11} color={t.color.muted}>
                          {item.available ? "Available" : "Sold out"}
                        </Txt>
                      </Row>
                    )}
                    <Button
                      small
                      variant="secondary"
                      label={`Edit ${item.name}`}
                      onPress={() => setEditingMenuItem(item)}
                      icon={<Pencil size={13} color={t.color.muted} />}
                    >
                      Edit
                    </Button>
                  </Row>
                </Stack>
              </Card>
            </View>
          ))}
        </Row>
      )}
      <Txt size={11} color={t.color.muted}>
        Changes are saved to your menu immediately. Existing orders retain the price at the time
        they were placed.
      </Txt>
      {editingMenuItem ? (
        <MenuItemDialog
          categories={categories}
          item={editingMenuItem === "new" ? undefined : editingMenuItem}
          onClose={() => setEditingMenuItem(null)}
          onArchive={
            editingMenuItem === "new"
              ? undefined
              : () => {
                  setEditingMenuItem(null);
                  setLifecycleCommand({ item: editingMenuItem, action: "archive" });
                }
          }
        />
      ) : null}
      {addingCategory ? (
        <CategoryDialog
          onClose={() => setAddingCategory(false)}
          onSave={actions.addCategory}
          saving={actions.adding}
        />
      ) : null}
      {managingCategories ? (
        <CategoryManagerDialog
          categories={categories}
          items={allItems}
          onClose={() => {
            setManagingCategories(false);
            if (!categories.some((item) => item.id === selectedCategoryId))
              setSelectedCategoryId("all");
          }}
        />
      ) : null}
      {lifecycleCommand ? (
        <MenuLifecycleDialog
          item={lifecycleCommand.item}
          action={lifecycleCommand.action}
          onClose={() => setLifecycleCommand(null)}
        />
      ) : null}
    </Stack>
  );
}
