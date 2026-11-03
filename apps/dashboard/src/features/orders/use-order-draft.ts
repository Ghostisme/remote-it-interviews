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
import { changeQuantity, previewOrder } from "./cart";

export function useOrderDraft(onCreated: (id: string) => void) {
  const menu = useGetMenu();
  const config = useGetSettings();
  const [customerSearch, setCustomerSearch] = useState("");
  const customers = useGetCustomers({ pageSize: 50, search: customerSearch || undefined });
  const [customerId, setCustomerId] = useState("");
  const [fulfillment, setFulfillment] = useState<CreateOrder["fulfillment"]>("pickup");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const key = useRef({ fingerprint: "", id: "" });
  const client = useQueryClient();
  const toast = useToast();
  const create = useCreateOrder();
  const preview = config.data
    ? previewOrder(cart, menu.data?.items ?? [], config.data, fulfillment)
    : null;
  const submit = async () => {
    setError("");
    if (!customerId) return setError("Choose a customer for this order.");
    if (!preview?.lines.length) return setError("Add at least one item to the order.");
    if (preview.unavailable)
      return setError("Remove sold-out or archived dishes before placing this order.");
    if (fulfillment === "delivery" && !address.trim()) return setError("Enter a delivery address.");
    const content = {
      customerId,
      fulfillment,
      notes: notes.trim(),
      deliveryAddress: fulfillment === "delivery" ? address.trim() : null,
      items: preview.lines.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity })),
    };
    const fingerprint = JSON.stringify(content);
    if (key.current.fingerprint !== fingerprint)
      key.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const detail = await create.mutateAsync({
        data: { ...content, idempotencyKey: key.current.id },
      });
      await client.invalidateQueries();
      toast("Order placed. Let's make something delicious.");
      onCreated(detail.order.id);
    } catch (e) {
      setError(errorMessage(e));
      await client.invalidateQueries();
    }
  };
  return {
    menu,
    config,
    customers,
    customerSearch,
    setCustomerSearch,
    customerId,
    setCustomerId,
    fulfillment,
    setFulfillment,
    cart,
    adjust: (id: string, delta: number) => setCart((current) => changeQuantity(current, id, delta)),
    notes,
    setNotes,
    address,
    setAddress,
    search,
    setSearch,
    error,
    preview,
    submit,
    saving: create.isPending,
  };
}
