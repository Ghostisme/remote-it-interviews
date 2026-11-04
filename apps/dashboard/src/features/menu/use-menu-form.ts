import {
  CreateMenuItemImageKey,
  errorMessage,
  useCreateCategory,
  useCreateMenuItem,
  useUpdateMenuItem,
} from "@odyssey/api-client";
import type { Category, CreateMenuItem, MenuItem } from "@odyssey/types";
import { useToast } from "@odyssey/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { parseDecimalToHundredths } from "../orders/cart";

/** Create or edit a dish while keeping display prices separate from integer-cent API values. */
export function useMenuForm(
  categories: Category[],
  item: MenuItem | undefined,
  onSaved: () => void,
) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? (item.priceCents / 100).toFixed(2) : "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [imageKey, setImageKey] = useState<CreateMenuItem["imageKey"]>(
    Object.values(CreateMenuItemImageKey).find((key) => key === item?.imageKey) ?? "salad",
  );
  const [available, setAvailable] = useState(item?.available ?? true);
  const [featured, setFeatured] = useState(item?.featured ?? false);
  const [error, setError] = useState("");
  const createMenuItemMutation = useCreateMenuItem();
  const updateMenuItemMutation = useUpdateMenuItem();
  const queryClient = useQueryClient();
  const toast = useToast();
  /** Validate the dish draft, convert its price to cents, and create or update the item. */
  const save = async () => {
    setError("");
    const priceCents = parseDecimalToHundredths(price);
    if (name.trim().length < 2) return setError("Give your dish a name of at least 2 characters.");
    if (priceCents === null || priceCents <= 0)
      return setError("Enter a price between $0.01 and $10,000.00, with up to 2 decimal places.");
    if (!categoryId) return setError("Create and choose a category first.");
    const menuItemPayload: CreateMenuItem = {
      name: name.trim(),
      description: description.trim(),
      priceCents,
      categoryId,
      imageKey,
      available,
      featured,
    };
    try {
      if (item) await updateMenuItemMutation.mutateAsync({ id: item.id, data: menuItemPayload });
      else await createMenuItemMutation.mutateAsync({ data: menuItemPayload });
      await queryClient.invalidateQueries();
      toast(item ? "Menu item updated." : "A delicious new addition to the menu.");
      onSaved();
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return {
    name,
    setName,
    description,
    setDescription,
    price,
    setPrice,
    categoryId,
    setCategoryId,
    imageKey,
    setImageKey,
    available,
    setAvailable,
    featured,
    setFeatured,
    error,
    save,
    saving: createMenuItemMutation.isPending || updateMenuItemMutation.isPending,
  };
}

/** Expose quick availability changes and category creation outside the dish editor. */
export function useMenuActions() {
  const updateMenuItemMutation = useUpdateMenuItem();
  const createCategoryMutation = useCreateCategory();
  const toast = useToast();
  const queryClient = useQueryClient();
  /** Toggle temporary sold-out status without changing the dish's archive lifecycle. */
  const toggle = async (item: MenuItem) => {
    try {
      await updateMenuItemMutation.mutateAsync({
        id: item.id,
        data: { available: !item.available },
      });
      await queryClient.invalidateQueries();
      toast(item.available ? `${item.name} marked sold out.` : `${item.name} is back on the menu.`);
    } catch (error) {
      toast(errorMessage(error), "danger");
    }
  };
  /** Create a category and return its persisted row to the calling form. */
  const addCategory = async (name: string) => {
    const result = await createCategoryMutation.mutateAsync({ data: { name: name.trim() } });
    await queryClient.invalidateQueries();
    toast("Category created.");
    return result;
  };
  return {
    toggle,
    toggling: updateMenuItemMutation.isPending,
    addCategory,
    adding: createCategoryMutation.isPending,
  };
}
