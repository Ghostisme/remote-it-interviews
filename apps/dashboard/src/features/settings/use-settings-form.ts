import { errorMessage, useUpdateSettings } from "@odyssey/api-client";
import type { Settings, UpdateSettings } from "@odyssey/types";
import { useToast } from "@odyssey/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { parseDecimalToHundredths } from "../orders/cart";

/** Build editable strings without mixing display dollars/percent with stored cents/basis points. */
const createSettingsDraft = (settings: Settings) => ({
  restaurantName: settings.restaurantName,
  acceptingOrders: settings.acceptingOrders,
  autoAccept: settings.autoAccept,
  deliveryEnabled: settings.deliveryEnabled,
  pickupEnabled: settings.pickupEnabled,
  dineInEnabled: settings.dineInEnabled,
  prepTime: String(settings.prepTimeMinutes),
  deliveryFee: (settings.deliveryFeeCents / 100).toFixed(2),
  minimumOrder: (settings.minimumOrderCents / 100).toFixed(2),
  taxRatePercent: (settings.taxRateBps / 100).toFixed(2),
  openingTime: settings.openingTime,
  closingTime: settings.closingTime,
  timezone: settings.timezone,
});
/** Manage validated preferences, an explicit saved baseline, and browser unsaved-change warnings. */
export function useSettingsForm(settings: Settings) {
  const [draft, setDraft] = useState(() => createSettingsDraft(settings));
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState(() =>
    JSON.stringify(createSettingsDraft(settings)),
  );
  const [error, setError] = useState("");
  const updateSettingsMutation = useUpdateSettings();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isDirty = JSON.stringify(draft) !== savedDraftSnapshot;
  const setField = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const reset = () => {
    const savedDraft = createSettingsDraft(settings);
    setDraft(savedDraft);
    setSavedDraftSnapshot(JSON.stringify(savedDraft));
    setError("");
  };
  useEffect(() => {
    if (Platform.OS !== "web" || !isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);
  const save = async () => {
    setError("");
    if (draft.restaurantName.trim().length < 2)
      return setError("Use at least 2 characters for the restaurant name.");
    const deliveryFeeCents = parseDecimalToHundredths(draft.deliveryFee);
    const minimumOrderCents = parseDecimalToHundredths(draft.minimumOrder);
    const taxRateBps = parseDecimalToHundredths(draft.taxRatePercent);
    if (deliveryFeeCents === null || deliveryFeeCents > 100000)
      return setError("Delivery fee must be between $0.00 and $1,000.00.");
    if (minimumOrderCents === null)
      return setError("Minimum order must be between $0.00 and $10,000.00.");
    if (taxRateBps === null || taxRateBps > 3000)
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
    const settingsPayload: UpdateSettings = {
      restaurantName: draft.restaurantName.trim(),
      currency: "USD",
      acceptingOrders: draft.acceptingOrders,
      autoAccept: draft.autoAccept,
      deliveryEnabled: draft.deliveryEnabled,
      pickupEnabled: draft.pickupEnabled,
      dineInEnabled: draft.dineInEnabled,
      prepTimeMinutes: Number(draft.prepTime),
      deliveryFeeCents,
      minimumOrderCents,
      taxRateBps,
      openingTime: draft.openingTime,
      closingTime: draft.closingTime,
      timezone: draft.timezone,
    };
    try {
      const savedSettings = await updateSettingsMutation.mutateAsync({ data: settingsPayload });
      // Use the server response as the new baseline so reset and dirty state agree.
      const savedDraft = createSettingsDraft(savedSettings);
      setDraft(savedDraft);
      setSavedDraftSnapshot(JSON.stringify(savedDraft));
      await queryClient.invalidateQueries();
      toast("Settings saved. Your next orders will use these preferences.");
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return { draft, setField, isDirty, error, save, reset, saving: updateSettingsMutation.isPending };
}
