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
import { parseMoney } from "../orders/cart";

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
  const create = useCreateMenuItem();
  const update = useUpdateMenuItem();
  const client = useQueryClient();
  const toast = useToast();
  const save = async () => {
    setError("");
    const priceCents = parseMoney(price);
    if (name.trim().length < 2) return setError("Give your dish a name of at least 2 characters.");
    if (priceCents === null || priceCents <= 0)
      return setError("Enter a price between $0.01 and $10,000.00, with up to 2 decimal places.");
    if (!categoryId) return setError("Create and choose a category first.");
    const data: CreateMenuItem = {
      name: name.trim(),
      description: description.trim(),
      priceCents,
      categoryId,
      imageKey,
      available,
      featured,
    };
    try {
      if (item) await update.mutateAsync({ id: item.id, data });
      else await create.mutateAsync({ data });
      await client.invalidateQueries();
      toast(item ? "Menu item updated." : "A delicious new addition to the menu.");
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
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
    saving: create.isPending || update.isPending,
  };
}

export function useMenuActions() {
  const update = useUpdateMenuItem();
  const category = useCreateCategory();
  const toast = useToast();
  const client = useQueryClient();
  const toggle = async (item: MenuItem) => {
    try {
      await update.mutateAsync({ id: item.id, data: { available: !item.available } });
      await client.invalidateQueries();
      toast(item.available ? `${item.name} marked sold out.` : `${item.name} is back on the menu.`);
    } catch (e) {
      toast(errorMessage(e), "danger");
    }
  };
  const addCategory = async (name: string) => {
    const result = await category.mutateAsync({ data: { name: name.trim() } });
    await client.invalidateQueries();
    toast("Category created.");
    return result;
  };
  return { toggle, toggling: update.isPending, addCategory, adding: category.isPending };
}
