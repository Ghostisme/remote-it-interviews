import { CreateMenuItemImageKey, errorMessage } from "@odyssey/api-client";
import type { Category, CreateMenuItem, MenuItem } from "@odyssey/types";
import {
  Badge,
  Banner,
  Dialog,
  Field,
  Interactive,
  Row,
  Select,
  Stack,
  Toggle,
  Txt,
  tokens as t,
} from "@odyssey/ui";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { useMenuForm } from "../features/menu/use-menu-form";
import { FoodImage, FormActions, titleCase } from "./common";

export function MenuItemDialog({
  categories,
  item,
  onClose,
}: {
  categories: Category[];
  item?: MenuItem;
  onClose: () => void;
}) {
  const form = useMenuForm(categories, item, onClose);
  return (
    <Dialog
      visible
      wide
      title={item ? "A little menu refinement" : "Something new on the menu"}
      subtitle={
        item
          ? "Update the details. Existing orders keep their original prices."
          : "A beautiful dish starts with the details."
      }
      onClose={() => {
        if (!form.saving) onClose();
      }}
      footer={
        <FormActions
          onClose={onClose}
          onSubmit={form.save}
          loading={form.saving}
          label={item ? "Save menu item" : "Add menu item"}
        />
      }
    >
      <Stack gap={20}>
        {form.error ? <Banner message={form.error} /> : null}
        <Row wrap gap={24} style={{ alignItems: "flex-start" }}>
          <Stack style={{ flex: 1.3, minWidth: 220 }}>
            <Field
              label="Dish name"
              placeholder="e.g. Summer garden salad"
              value={form.name}
              onChangeText={form.setName}
              maxLength={80}
              autoFocus
            />
            <Field
              label="Description"
              placeholder="Ingredients, flavors, what makes it special..."
              value={form.description}
              onChangeText={form.setDescription}
              multiline
              maxLength={600}
            />
            <Row style={{ alignItems: "flex-start" }}>
              <Stack style={{ flex: 1 }}>
                <Field
                  label="Price (USD)"
                  placeholder="14.50"
                  value={form.price}
                  onChangeText={form.setPrice}
                  keyboardType="decimal-pad"
                />
              </Stack>
              <Stack style={{ flex: 1 }}>
                <Select
                  label="Category"
                  value={form.categoryId}
                  onChange={form.setCategoryId}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Stack>
            </Row>
            <Toggle
              label="Available to order"
              value={form.available}
              onChange={form.setAvailable}
            />
            <Toggle label="Feature this dish" value={form.featured} onChange={form.setFeatured} />
            <Txt size={11} color={t.color.muted}>
              Sold-out dishes stay visible in your menu, but cannot be ordered.
            </Txt>
          </Stack>
          <Stack style={{ flex: 1, minWidth: 220 }} gap={12}>
            <FoodImage imageKey={form.imageKey} height={190} />
            <Row style={{ justifyContent: "space-between" }}>
              <Txt size={12} weight="semibold">
                Choose a cover
              </Txt>
              <Badge tone="neutral">Curated gallery</Badge>
            </Row>
            <Row wrap gap={8}>
              {Object.values(CreateMenuItemImageKey).map((key) => (
                <Interactive
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${titleCase(key)} cover`}
                  accessibilityState={{ selected: form.imageKey === key }}
                  onPress={() => form.setImageKey(key as CreateMenuItem["imageKey"])}
                  style={{
                    borderWidth: 2,
                    borderColor: form.imageKey === key ? t.color.brand : "transparent",
                    padding: 2,
                    borderRadius: 10,
                  }}
                >
                  <FoodImage imageKey={key} size={49} radius={6} />
                  {form.imageKey === key ? (
                    <Stack
                      style={{
                        position: "absolute",
                        right: 4,
                        bottom: 4,
                        backgroundColor: t.color.brand,
                        borderRadius: 10,
                      }}
                    >
                      <Check size={12} color="white" />
                    </Stack>
                  ) : null}
                </Interactive>
              ))}
            </Row>
          </Stack>
        </Row>
      </Stack>
    </Dialog>
  );
}

export function CategoryDialog({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (name: string) => Promise<unknown>;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    if (name.trim().length < 2) return setError("Use at least 2 characters for the category name.");
    try {
      await onSave(name);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <Dialog
      visible
      title="Make room for more"
      subtitle="A category helps guests find their next favorite."
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <FormActions onClose={onClose} onSubmit={submit} loading={saving} label="Create category" />
      }
    >
      <Stack>
        {error ? <Banner message={error} /> : null}
        <Field
          label="Category name"
          placeholder="e.g. Seasonal specials"
          value={name}
          onChangeText={setName}
          maxLength={80}
          autoFocus
        />
      </Stack>
    </Dialog>
  );
}
