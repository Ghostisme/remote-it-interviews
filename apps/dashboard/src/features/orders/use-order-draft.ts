import {
  errorMessage,
  useCreateOrder,
  useGetCustomers,
  useGetMenu,
  useGetSettings,
} from "@odyssey/api-client";
import type { CreateOrder } from "@odyssey/types";
import { useToast } from "@odyssey/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { type CartQuantities, calculateOrderPreview, changeQuantity } from "./cart";

/** Coordinate the order composer, advisory pricing, and retry-safe order creation. */
export function useOrderDraft(onCreated: (orderId: string) => void) {
  const menuQuery = useGetMenu();
  const settingsQuery = useGetSettings();
  const [customerSearch, setCustomerSearch] = useState("");
  const customersQuery = useGetCustomers({ pageSize: 50, search: customerSearch || undefined });
  const [customerId, setCustomerId] = useState("");
  const [fulfillment, setFulfillment] = useState<CreateOrder["fulfillment"]>("pickup");
  const [cart, setCart] = useState<CartQuantities>({});
  const [notes, setNotes] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [error, setError] = useState("");
  const idempotencyRef = useRef({ fingerprint: "", key: "" });
  const queryClient = useQueryClient();
  const toast = useToast();
  const createOrderMutation = useCreateOrder();
  const preview = settingsQuery.data
    ? calculateOrderPreview(cart, menuQuery.data?.items ?? [], settingsQuery.data, fulfillment)
    : null;
  const submit = async () => {
    setError("");
    if (!customerId) return setError("Choose a customer for this order.");
    if (!preview?.lines.length) return setError("Add at least one item to the order.");
    if (preview.hasUnavailableItems)
      return setError("Remove sold-out or archived dishes before placing this order.");
    if (fulfillment === "delivery" && !deliveryAddress.trim())
      return setError("Enter a delivery address.");
    const orderPayload = {
      customerId,
      fulfillment,
      notes: notes.trim(),
      deliveryAddress: fulfillment === "delivery" ? deliveryAddress.trim() : null,
      items: preview.lines.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity })),
    };
    // Reuse the key after an uncertain response; a changed payload starts a new intent.
    const fingerprint = JSON.stringify(orderPayload);
    if (idempotencyRef.current.fingerprint !== fingerprint)
      idempotencyRef.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const detail = await createOrderMutation.mutateAsync({
        data: { ...orderPayload, idempotencyKey: idempotencyRef.current.key },
      });
      // Orders also affect dashboard totals, customer spend, and menu popularity.
      await queryClient.invalidateQueries();
      toast("Order placed. Let's make something delicious.");
      onCreated(detail.order.id);
    } catch (error) {
      setError(errorMessage(error));
      // Refresh stale menu/settings data when the server rejects a draft.
      await queryClient.invalidateQueries();
    }
  };
  return {
    menuQuery,
    settingsQuery,
    customersQuery,
    customerSearch,
    setCustomerSearch,
    customerId,
    setCustomerId,
    fulfillment,
    setFulfillment,
    cart,
    adjust: (menuItemId: string, quantityChange: number) =>
      setCart((current) => changeQuantity(current, menuItemId, quantityChange)),
    notes,
    setNotes,
    deliveryAddress,
    setDeliveryAddress,
    menuSearch,
    setMenuSearch,
    error,
    preview,
    submit,
    saving: createOrderMutation.isPending,
  };
}
