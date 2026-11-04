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

/** Explicit confirmation intents for the menu item lifecycle. */
export type MenuAction = "archive" | "restore" | "delete";

/** Apply one confirmed lifecycle action; the server protects references from past orders. */
export function useMenuLifecycle(item: MenuItem, action: MenuAction, onDone: () => void) {
  const archiveMenuItemMutation = useArchiveMenuItem();
  const restoreMenuItemMutation = useRestoreMenuItem();
  const deleteMenuItemMutation = useDeleteMenuItem();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState("");
  /** Run the confirmed lifecycle command and refresh dependent menu and order data. */
  const submit = async () => {
    setError("");
    try {
      const mutation =
        action === "archive"
          ? archiveMenuItemMutation
          : action === "restore"
            ? restoreMenuItemMutation
            : deleteMenuItemMutation;
      await mutation.mutateAsync({ id: item.id });
      await queryClient.invalidateQueries();
      toast(
        action === "archive"
          ? "Dish archived. Past orders are preserved."
          : action === "restore"
            ? "Dish restored to the active menu."
            : "Dish permanently deleted.",
      );
      onDone();
    } catch (error) {
      setError(errorMessage(error));
      await queryClient.invalidateQueries();
    }
  };
  return {
    submit,
    error,
    saving:
      archiveMenuItemMutation.isPending ||
      restoreMenuItemMutation.isPending ||
      deleteMenuItemMutation.isPending,
  };
}

/** Rename, reorder, or delete empty categories without rewriting dish or order identities. */
export function useCategoryManagement() {
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const queryClient = useQueryClient();
  const toast = useToast();
  /** Persist a category label and display order while keeping its identity stable. */
  const save = async (category: Category, name: string, sortOrder = category.sortOrder) => {
    await updateCategoryMutation.mutateAsync({
      id: category.id,
      data: { name: name.trim(), sortOrder },
    });
    await queryClient.invalidateQueries();
    toast("Category updated. Dishes keep their category and order history.");
  };
  /** Request deletion of an empty category; the API rechecks active and archived dish references. */
  const deleteCategory = async (category: Category) => {
    await deleteCategoryMutation.mutateAsync({ id: category.id });
    await queryClient.invalidateQueries();
    toast("Empty category deleted.");
  };
  return {
    save,
    deleteCategory,
    saving: updateCategoryMutation.isPending,
    deleting: deleteCategoryMutation.isPending,
  };
}
