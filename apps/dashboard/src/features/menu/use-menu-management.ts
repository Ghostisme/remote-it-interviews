import {
  errorMessage,
  useArchiveMenuItem,
  useDeleteCategory,
  useDeleteMenuItem,
  useRestoreMenuItem,
  useUpdateCategory,
} from "@odyssey/api-client";
import type { Category, MenuItem } from "@odyssey/types";
import { useToast } from "@odyssey/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export type MenuAction = "archive" | "restore" | "delete";

export function useMenuLifecycle(item: MenuItem, action: MenuAction, onDone: () => void) {
  const archive = useArchiveMenuItem();
  const restore = useRestoreMenuItem();
  const remove = useDeleteMenuItem();
  const client = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState("");
  const submit = async () => {
    setError("");
    try {
      const mutation = action === "archive" ? archive : action === "restore" ? restore : remove;
      await mutation.mutateAsync({ id: item.id });
      await client.invalidateQueries();
      toast(
        action === "archive"
          ? "Dish archived. Past orders are preserved."
          : action === "restore"
            ? "Dish restored to the active menu."
            : "Dish permanently deleted.",
      );
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      await client.invalidateQueries();
    }
  };
  return { submit, error, saving: archive.isPending || restore.isPending || remove.isPending };
}

export function useCategoryManagement() {
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const client = useQueryClient();
  const toast = useToast();
  const save = async (category: Category, name: string, sortOrder = category.sortOrder) => {
    await update.mutateAsync({ id: category.id, data: { name: name.trim(), sortOrder } });
    await client.invalidateQueries();
    toast("Category updated. Dishes keep their category and order history.");
  };
  const deleteCategory = async (category: Category) => {
    await remove.mutateAsync({ id: category.id });
    await client.invalidateQueries();
    toast("Empty category deleted.");
  };
  return { save, deleteCategory, saving: update.isPending, deleting: remove.isPending };
}
