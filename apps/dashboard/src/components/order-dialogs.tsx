import { errorMessage, useApplyOrderAction, useGetOrder } from "@odyssey/api-client";
import { formatMoney } from "@odyssey/shared";
import type { CreateOrder, OrderAction } from "@odyssey/types";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  LoadingState,
  Row,
  SearchField,
  Select,
  Stack,
  Txt,
  tokens as t,
  useToast,
} from "@odyssey/ui";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check, MapPin, Minus, Plus, ShoppingBag } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useOrderDraft } from "../features/orders/use-order-draft";
import {
  dateLabel,
  FoodImage,
  FormActions,
  orderNumber,
  QueryError,
  StatusBadge,
  titleCase,
  useCompact,
} from "./common";

export function NewOrderDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const draft = useOrderDraft(onCreated);
  const compact = useCompact();
  const config = draft.config.data;
  const preview = draft.preview;
  const services = config
    ? [
        { value: "pickup", label: "Pickup", enabled: config.pickupEnabled },
        { value: "delivery", label: "Delivery", enabled: config.deliveryEnabled },
        { value: "dine_in", label: "Dine in", enabled: config.dineInEnabled },
      ].filter((s) => s.enabled)
    : [];
  const serviceEnabled = services.some((s) => s.value === draft.fulfillment);
  const error = draft.menu.error ?? draft.config.error ?? draft.customers.error;
  return (
    <Dialog
      visible
      wide
      title="A new order"
      subtitle="Good things are on the way. Let's get the details right."
      onClose={() => {
        if (!draft.saving) onClose();
      }}
      footer={
        <FormActions
          onClose={onClose}
          onSubmit={draft.submit}
          loading={draft.saving}
          label={
            preview?.lines.length ? `Place order · ${formatMoney(preview.total)}` : "Place order"
          }
          disabled={
            !config?.acceptingOrders ||
            !serviceEnabled ||
            !preview?.lines.length ||
            preview.belowMinimum ||
            preview.unavailable
          }
        />
      }
    >
      {error ? (
        <QueryError
          error={error}
          retry={() => {
            void draft.menu.refetch();
            void draft.config.refetch();
            void draft.customers.refetch();
          }}
        />
      ) : !config || !draft.menu.data ? (
        <LoadingState />
      ) : (
        <Stack gap={20}>
          {!config.acceptingOrders ? (
            <Banner
              message="New orders are paused. Enable accepting orders in Settings to continue."
              tone="warning"
            />
          ) : null}
          {draft.error ? <Banner tone="danger" message={draft.error} /> : null}
          <Row wrap style={{ alignItems: "flex-start" }} gap={24}>
            <Stack gap={18} style={{ flex: 1.15, minWidth: compact ? 220 : 360 }}>
              <Stack gap={8}>
                <Txt size={12} weight="semibold">
                  1. Choose a guest
                </Txt>
                <SearchField
                  value={draft.customerSearch}
                  onChange={draft.setCustomerSearch}
                  placeholder="Find a customer by name or email"
                />
                <Select
                  label="Customer"
                  placeholder="Choose a customer"
                  value={draft.customerId}
                  onChange={draft.setCustomerId}
                  options={
                    draft.customers.data?.data.map((c) => ({
                      value: c.id,
                      label: c.name,
                      description: c.email ?? undefined,
                    })) ?? []
                  }
                />
                <Button
                  variant="ghost"
                  small
                  onPress={() => {
                    onClose();
                    router.push("/crm?new=1");
                  }}
                >
                  Add a new customer
                </Button>
              </Stack>
              <View style={{ height: 1, backgroundColor: t.color.line }} />
              <Stack gap={12}>
                <Txt size={12} weight="semibold">
                  2. Something delicious
                </Txt>
                <SearchField
                  value={draft.search}
                  onChange={draft.setSearch}
                  placeholder="Find a dish"
                />
                {draft.menu.data.items
                  .filter((item) => !item.archivedAt)
                  .filter((item) =>
                    `${item.name} ${item.description}`
                      .toLowerCase()
                      .includes(draft.search.toLowerCase()),
                  )
                  .map((item) => (
                    <Row
                      key={item.id}
                      gap={12}
                      style={{ paddingVertical: 7, opacity: item.available ? 1 : 0.55 }}
                    >
                      <FoodImage imageKey={item.imageKey} size={51} />
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Txt size={12} weight="semibold">
                          {item.name}
                        </Txt>
                        <Txt size={11} color={t.color.muted}>
                          {formatMoney(item.priceCents)}
                          {!item.available ? " · Sold out" : ""}
                        </Txt>
                      </Stack>
                      <Button
                        small
                        variant="secondary"
                        label={`Add ${item.name}`}
                        disabled={!item.available || (draft.cart[item.id] ?? 0) >= 99}
                        icon={<Plus size={14} color={t.color.brand} />}
                        onPress={() => draft.adjust(item.id, 1)}
                      />
                    </Row>
                  ))}
              </Stack>
            </Stack>
            <Stack gap={16} style={{ flex: 1, minWidth: 220 }}>
              <Card padding={18} style={{ backgroundColor: "#F8FAF8" }}>
                <Stack gap={16}>
                  <Row wrap>
                    <ShoppingBag size={17} color={t.color.brand} />
                    <Txt size={14} weight="semibold">
                      Order summary
                    </Txt>
                    <Badge tone="brand">
                      {preview?.lines.reduce((n, line) => n + line.quantity, 0) ?? 0} items
                    </Badge>
                  </Row>
                  {!preview?.lines.length ? (
                    <EmptyState
                      title="Your basket is waiting"
                      message="Add a dish from the menu to get started."
                    />
                  ) : (
                    preview.lines.map(({ item, quantity }) => (
                      <Stack key={item.id} gap={7}>
                        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Txt size={12} weight="medium" style={{ flex: 1 }}>
                            {item.name}
                          </Txt>
                          <Txt size={12} weight="semibold">
                            {formatMoney(item.priceCents * quantity)}
                          </Txt>
                        </Row>
                        <Row gap={10}>
                          <Button
                            small
                            variant="secondary"
                            label={`Remove one ${item.name}`}
                            icon={<Minus size={12} color={t.color.muted} />}
                            onPress={() => draft.adjust(item.id, -1)}
                          />
                          <Txt size={12}>{quantity}</Txt>
                          <Button
                            small
                            variant="secondary"
                            disabled={quantity >= 99 || !item.available || !!item.archivedAt}
                            label={`Add one ${item.name}`}
                            icon={<Plus size={12} color={t.color.muted} />}
                            onPress={() => draft.adjust(item.id, 1)}
                          />
                          {item.archivedAt ? (
                            <Badge tone="danger">Archived — remove to continue</Badge>
                          ) : !item.available ? (
                            <Badge tone="danger">Sold out</Badge>
                          ) : null}
                        </Row>
                      </Stack>
                    ))
                  )}
                  <View style={{ height: 1, backgroundColor: t.color.line }} />
                  <Select
                    label="Service"
                    value={draft.fulfillment}
                    onChange={(value) => draft.setFulfillment(value as CreateOrder["fulfillment"])}
                    options={services}
                  />
                  {!serviceEnabled ? (
                    <Banner tone="warning" message="Choose an available service to continue." />
                  ) : null}
                  {draft.fulfillment === "delivery" ? (
                    <Field
                      label="Delivery address"
                      value={draft.address}
                      onChangeText={draft.setAddress}
                      placeholder="Street, apartment, city"
                      multiline
                      maxLength={300}
                    />
                  ) : null}
                  <Field
                    label="Order notes"
                    value={draft.notes}
                    onChangeText={draft.setNotes}
                    placeholder="Allergies, preferences, little details..."
                    multiline
                    maxLength={600}
                  />
                  {preview ? (
                    <Stack gap={8}>
                      {[
                        ["Subtotal", preview.subtotal],
                        [`Tax (${config.taxRateBps / 100}%)`, preview.tax],
                        ["Delivery", preview.delivery],
                      ].map(([label, value]) => (
                        <Row key={label} style={{ justifyContent: "space-between" }}>
                          <Txt size={12} color={t.color.muted}>
                            {label}
                          </Txt>
                          <Txt size={12}>{formatMoney(Number(value))}</Txt>
                        </Row>
                      ))}
                      <Row
                        style={{
                          borderTopWidth: 1,
                          borderColor: t.color.line,
                          paddingTop: 12,
                          justifyContent: "space-between",
                        }}
                      >
                        <Txt weight="semibold">Total</Txt>
                        <Txt size={21} weight="semibold">
                          {formatMoney(preview.total)}
                        </Txt>
                      </Row>
                      {preview.belowMinimum ? (
                        <Txt size={11} color={t.color.warning}>
                          Minimum subtotal: {formatMoney(config.minimumOrderCents)}
                        </Txt>
                      ) : null}
                    </Stack>
                  ) : null}
                </Stack>
              </Card>
              <Txt size={10} color={t.color.muted}>
                Estimated preparation: {config.prepTimeMinutes} minutes. The final price is
                confirmed when your order is placed.
              </Txt>
            </Stack>
          </Row>
        </Stack>
      )}
    </Dialog>
  );
}

const actionLabels: Record<OrderAction, string> = {
  accept: "Accept order",
  prepare: "Start preparing",
  mark_ready: "Mark ready",
  complete: "Complete order",
  cancel: "Cancel order",
};
export function OrderDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useGetOrder(id, { query: { refetchInterval: 10000 } });
  const mutation = useApplyOrderAction();
  const client = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");
  const detail = query.data;
  const apply = async (action: OrderAction) => {
    if (!detail) return;
    setError("");
    try {
      await mutation.mutateAsync({
        id,
        data: {
          action,
          version: detail.order.version,
          note: action === "cancel" ? note : undefined,
        },
      });
      await client.invalidateQueries();
      setCancelling(false);
      toast(action === "cancel" ? "Order cancelled." : `${actionLabels[action]} — done.`);
    } catch (e) {
      setError(errorMessage(e));
      await client.invalidateQueries();
    }
  };
  return (
    <Dialog
      visible
      title={detail ? orderNumber(detail.order.number) : "Order details"}
      subtitle={
        detail ? `Placed ${dateLabel(detail.order.createdAt, true)}` : "Every detail, in one place."
      }
      onClose={onClose}
      footer={
        detail ? (
          <Row wrap style={{ justifyContent: "space-between" }}>
            <Button variant="ghost" onPress={onClose}>
              Close
            </Button>
            <Row wrap>
              {!cancelling ? (
                detail.allowedActions.map((action) => (
                  <Button
                    key={action}
                    variant={action === "cancel" ? "danger" : "primary"}
                    loading={mutation.isPending && mutation.variables?.data.action === action}
                    disabled={mutation.isPending}
                    onPress={() => {
                      if (action === "cancel") setCancelling(true);
                      else void apply(action);
                    }}
                  >
                    {actionLabels[action]}
                  </Button>
                ))
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onPress={() => setCancelling(false)}
                    disabled={mutation.isPending}
                  >
                    Keep order
                  </Button>
                  <Button
                    variant="danger"
                    loading={mutation.isPending}
                    onPress={() => apply("cancel")}
                  >
                    Confirm cancellation
                  </Button>
                </>
              )}
            </Row>
          </Row>
        ) : undefined
      }
    >
      {query.isPending ? (
        <LoadingState />
      ) : query.error ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : detail ? (
        <Stack gap={22}>
          {error ? <Banner tone="danger" message={error} /> : null}
          {cancelling ? (
            <Stack gap={10}>
              <Banner
                tone="warning"
                message="Cancel this order? This action cannot be undone. Completed orders cannot be cancelled."
              />
              <Field
                label="Cancellation reason (optional)"
                value={note}
                onChangeText={setNote}
                maxLength={300}
              />
            </Stack>
          ) : null}
          <Row style={{ justifyContent: "space-between" }}>
            <StatusBadge status={detail.order.status} />
            <Badge tone="brand">{titleCase(detail.order.fulfillment)}</Badge>
          </Row>
          <Card padding={16} style={{ backgroundColor: t.color.canvas }}>
            <Row>
              <Avatar name={detail.customer.name} />
              <Stack gap={2} style={{ flex: 1 }}>
                <Txt weight="semibold">{detail.customer.name}</Txt>
                <Txt size={11} color={t.color.muted}>
                  {detail.customer.email ?? detail.customer.phone ?? "No contact details added"}
                </Txt>
              </Stack>
            </Row>
            {detail.order.deliveryAddress ? (
              <Row style={{ paddingTop: 12 }}>
                <MapPin size={15} color={t.color.muted} />
                <Txt size={12} color={t.color.muted} style={{ flex: 1 }}>
                  {detail.order.deliveryAddress}
                </Txt>
              </Row>
            ) : null}
          </Card>
          <Stack gap={14}>
            {detail.items.map((item) => (
              <Row key={item.id} style={{ justifyContent: "space-between" }}>
                <Badge tone="neutral">{item.quantity}×</Badge>
                <Stack gap={0} style={{ flex: 1 }}>
                  <Txt size={13} weight="medium">
                    {item.name}
                  </Txt>
                  <Txt size={10} color={t.color.muted}>
                    {formatMoney(item.unitPriceCents)} each
                  </Txt>
                </Stack>
                <Txt size={13} weight="semibold">
                  {formatMoney(item.unitPriceCents * item.quantity)}
                </Txt>
              </Row>
            ))}
          </Stack>
          <Stack gap={8} style={{ borderTopWidth: 1, borderColor: t.color.line, paddingTop: 16 }}>
            {[
              ["Subtotal", detail.order.subtotalCents],
              ["Tax", detail.order.taxCents],
              ["Delivery fee", detail.order.deliveryFeeCents],
              ["Total", detail.order.totalCents],
            ].map(([label, value]) => (
              <Row key={label} style={{ justifyContent: "space-between" }}>
                <Txt
                  size={label === "Total" ? 16 : 12}
                  weight={label === "Total" ? "semibold" : "regular"}
                  color={label === "Total" ? t.color.ink : t.color.muted}
                >
                  {label}
                </Txt>
                <Txt size={label === "Total" ? 20 : 12} weight="semibold">
                  {formatMoney(Number(value))}
                </Txt>
              </Row>
            ))}
          </Stack>
          {detail.order.notes ? (
            <Stack gap={5}>
              <Txt size={11} weight="semibold">
                Order notes
              </Txt>
              <Txt size={12} color={t.color.muted}>
                {detail.order.notes}
              </Txt>
            </Stack>
          ) : null}
          <Stack gap={15}>
            <Txt size={13} weight="semibold">
              The order's journey
            </Txt>
            {detail.events.map((event, index) => (
              <Row key={event.id} style={{ alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 25,
                    height: 25,
                    borderRadius: 13,
                    backgroundColor:
                      index === detail.events.length - 1 ? t.color.brand : t.color.brandSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check
                    size={12}
                    color={index === detail.events.length - 1 ? "white" : t.color.brand}
                  />
                </View>
                <Stack gap={1} style={{ flex: 1 }}>
                  <Txt size={12} weight="medium">
                    {titleCase(event.status)}
                  </Txt>
                  {event.note ? (
                    <Txt size={11} color={t.color.muted}>
                      {event.note}
                    </Txt>
                  ) : null}
                </Stack>
                <Txt size={10} color={t.color.muted}>
                  {dateLabel(event.createdAt, true)}
                </Txt>
              </Row>
            ))}
          </Stack>
        </Stack>
      ) : null}
    </Dialog>
  );
}
