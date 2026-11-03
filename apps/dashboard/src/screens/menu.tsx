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
import { FolderPlus, Pencil, Plus, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { contentWidth, FoodImage, PageHeading, QueryError, Tabs } from "../components/common";
import { CategoryDialog, MenuItemDialog } from "../components/menu-dialogs";
import { useMenuActions } from "../features/menu/use-menu-form";

export default function MenuScreen() {
  const query = useGetMenu();
  const actions = useMenuActions();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("all");
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const { width } = useWindowDimensions();
  const columns = width >= 1400 ? 3 : width >= 1000 ? 2 : width >= 650 ? 2 : 1;
  const itemWidth = (contentWidth(width) - (columns - 1) * 20) / columns;
  const categories = query.data?.categories ?? [];
  const items = query.data?.items ?? [];
  const filtered = items.filter(
    (item) =>
      (category === "all" || item.categoryId === category) &&
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
          <Row wrap>
            <Button
              variant="secondary"
              icon={<FolderPlus size={15} color={t.color.ink} />}
              onPress={() => setAddingCategory(true)}
            >
              Add category
            </Button>
            <Button
              icon={<Plus size={16} color="white" />}
              onPress={() => setEditing("new")}
              disabled={!query.data}
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
              value={category}
              onChange={setCategory}
              options={[
                { value: "all", label: "All dishes", count: items.length },
                ...categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                  count: items.filter((i) => i.categoryId === c.id).length,
                })),
              ]}
            />
            <Badge tone="success" dot>
              {items.filter((i) => i.available).length} available
            </Badge>
          </Row>
          <Row wrap style={{ borderTopWidth: 1, borderColor: t.color.line, paddingTop: 16 }}>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search your menu..."
              style={{ flex: 1, minWidth: 190 }}
            />
            <Select
              value={availability}
              onChange={setAvailability}
              options={[
                { value: "all", label: "All availability" },
                { value: "available", label: "Available" },
                { value: "soldout", label: "Sold out" },
              ]}
            />
          </Row>
        </Stack>
      </Card>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <QueryError error={query.error} retry={query.refetch} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={
              search || category !== "all" || availability !== "all"
                ? "No dishes found"
                : "Your menu starts here"
            }
            message="Try another filter, or add something delicious to the menu."
            action={
              <Button
                variant="secondary"
                onPress={() => {
                  setCategory("all");
                  setSearch("");
                  setAvailability("all");
                  if (!items.length) setEditing("new");
                }}
              >
                {items.length ? "Clear filters" : "Add your first dish"}
              </Button>
            }
          />
        </Card>
      ) : (
        <Row wrap gap={20} style={{ alignItems: "stretch" }}>
          {filtered.map((item) => (
            <View key={item.id} style={{ width: itemWidth }}>
              <Card padding={0} style={{ overflow: "hidden", flex: 1 }}>
                <View>
                  <FoodImage imageKey={item.imageKey} height={195} radius={0} />
                  <View style={{ position: "absolute", top: 14, left: 14 }}>
                    {item.featured ? (
                      <Badge tone="brand">
                        <Sparkles size={10} color={t.color.brand} /> Chef's pick
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        {categories.find((c) => c.id === item.categoryId)?.name ?? "Menu"}
                      </Badge>
                    )}
                  </View>
                  {!item.available ? (
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
                    style={{
                      marginTop: "auto",
                      paddingTop: 14,
                      borderTopWidth: 1,
                      borderColor: t.color.line,
                      justifyContent: "space-between",
                    }}
                  >
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
                    <Button
                      small
                      variant="secondary"
                      label={`Edit ${item.name}`}
                      onPress={() => setEditing(item)}
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
      {editing ? (
        <MenuItemDialog
          categories={categories}
          item={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {addingCategory ? (
        <CategoryDialog
          onClose={() => setAddingCategory(false)}
          onSave={actions.addCategory}
          saving={actions.adding}
        />
      ) : null}
    </Stack>
  );
}
