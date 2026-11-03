import { errorMessage, useUpdateSettings } from "@odyssey/api-client";
import type { Settings, UpdateSettings } from "@odyssey/types";
import { useToast } from "@odyssey/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { parseMoney } from "../orders/cart";

const fromSettings = (settings: Settings) => ({
  restaurantName: settings.restaurantName,
  acceptingOrders: settings.acceptingOrders,
  autoAccept: settings.autoAccept,
  deliveryEnabled: settings.deliveryEnabled,
  pickupEnabled: settings.pickupEnabled,
  dineInEnabled: settings.dineInEnabled,
  prepTime: String(settings.prepTimeMinutes),
  deliveryFee: (settings.deliveryFeeCents / 100).toFixed(2),
  minimum: (settings.minimumOrderCents / 100).toFixed(2),
  tax: (settings.taxRateBps / 100).toFixed(2),
  openingTime: settings.openingTime,
  closingTime: settings.closingTime,
  timezone: settings.timezone,
});
export function useSettingsForm(settings: Settings) {
  const [draft, setDraft] = useState(() => fromSettings(settings));
  const [baseline, setBaseline] = useState(() => JSON.stringify(fromSettings(settings)));
  const [error, setError] = useState("");
  const update = useUpdateSettings();
  const client = useQueryClient();
  const toast = useToast();
  const dirty = JSON.stringify(draft) !== baseline;
  const field = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const reset = () => {
    const next = fromSettings(settings);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setError("");
  };
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = async () => {
    setError("");
    if (draft.restaurantName.trim().length < 2)
      return setError("Use at least 2 characters for the restaurant name.");
    const fee = parseMoney(draft.deliveryFee);
    const minimum = parseMoney(draft.minimum);
    const tax = parseMoney(draft.tax);
    if (fee === null || fee > 100000)
      return setError("Delivery fee must be between $0.00 and $1,000.00.");
    if (minimum === null) return setError("Minimum order must be between $0.00 and $10,000.00.");
    if (tax === null || tax > 3000)
      return setError("Tax must be between 0% and 30%, with up to 2 decimal places.");
    if (!/^\d+$/.test(draft.prepTime) || Number(draft.prepTime) < 5 || Number(draft.prepTime) > 120)
      return setError("Preparation time must be a whole number between 5 and 120 minutes.");
    if (
      ![draft.openingTime, draft.closingTime].every((value) =>
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
      )
    )
      return setError("Use 24-hour HH:MM format for opening and closing times.");
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: draft.timezone });
    } catch {
      return setError("Enter a valid IANA timezone, such as America/New_York.");
    }
    const data: UpdateSettings = {
      restaurantName: draft.restaurantName.trim(),
      currency: "USD",
      acceptingOrders: draft.acceptingOrders,
      autoAccept: draft.autoAccept,
      deliveryEnabled: draft.deliveryEnabled,
      pickupEnabled: draft.pickupEnabled,
      dineInEnabled: draft.dineInEnabled,
      prepTimeMinutes: Number(draft.prepTime),
      deliveryFeeCents: fee,
      minimumOrderCents: minimum,
      taxRateBps: tax,
      openingTime: draft.openingTime,
      closingTime: draft.closingTime,
      timezone: draft.timezone,
    };
    try {
      const result = await update.mutateAsync({ data });
      const next = fromSettings(result);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      await client.invalidateQueries();
      toast("Settings saved. Your next orders will use these preferences.");
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return { draft, field, dirty, error, save, reset, saving: update.isPending };
}
