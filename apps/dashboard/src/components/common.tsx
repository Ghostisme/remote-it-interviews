import { errorMessage } from "@odyssey/api-client";
import { formatMoney } from "@odyssey/shared";
import type { OrderStatus, OrderSummary } from "@odyssey/types";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  DataTable,
  Interactive,
  Row,
  Stack,
  type Tone,
  Txt,
  tokens as t,
} from "@odyssey/ui";
import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Image, Platform, useWindowDimensions, View } from "react-native";

export const statusTones: Record<OrderStatus, Tone> = {
  pending: "warning",
  accepted: "info",
  preparing: "orange",
  ready: "violet",
  completed: "success",
  cancelled: "neutral",
};
export const titleCase = (text: string) =>
  text.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const dateLabel = (value: string, time = false) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
export const orderNumber = (number: number) => `#OE-${String(number).padStart(4, "0")}`;
export function useCompact() {
  return useWindowDimensions().width < 1000;
}
export function contentWidth(width: number) {
  const compact = width < t.layout.breakpoint;
  return (
    Math.min(width - (compact ? 0 : t.layout.sidebar), t.layout.maxWidth) -
    2 * (compact ? t.layout.mobileGutter : t.layout.gutter)
  );
}
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <Row wrap style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 26 }}>
      <Stack gap={5} style={{ flex: 1, minWidth: 230 }}>
        {eyebrow ? (
          <Txt size={10} weight="semibold" color={t.color.muted} style={{ letterSpacing: 1.5 }}>
            {eyebrow.toUpperCase()}
          </Txt>
        ) : null}
        <Txt size={32} weight="display" style={{ lineHeight: 42 }}>
          {title}
        </Txt>
        <Txt size={13} color={t.color.muted}>
          {subtitle}
        </Txt>
      </Stack>
      {action}
    </Row>
  );
}
export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <Row style={{ justifyContent: "space-between" }}>
      <Stack gap={3}>
        <Txt size={16} weight="semibold">
          {title}
        </Txt>
        {subtitle ? (
          <Txt size={11} color={t.color.muted}>
            {subtitle}
          </Txt>
        ) : null}
      </Stack>
      {action}
    </Row>
  );
}
export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={statusTones[status]} dot>
      {titleCase(status)}
    </Badge>
  );
}
export function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
  return <Banner message={errorMessage(error)} tone="danger" onRetry={retry} />;
}
export function FoodImage({
  imageKey,
  size,
  height,
  radius = 10,
}: {
  imageKey: string;
  size?: number;
  height?: number;
  radius?: number;
}) {
  const uri =
    Platform.OS === "web"
      ? `/images/${imageKey}.jpg`
      : `${process.env.EXPO_PUBLIC_ASSET_URL ?? "http://localhost:8081"}/images/${imageKey}.jpg`;
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={titleCase(imageKey)}
      style={{
        width: size ?? "100%",
        height: height ?? size ?? 180,
        borderRadius: radius,
        backgroundColor: t.color.soft,
      }}
      resizeMode="cover"
    />
  );
}
export function Tabs({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Row wrap gap={5}>
      {options.map((option) => (
        <Interactive
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={({ hovered }) => ({
            paddingHorizontal: 15,
            paddingVertical: 9,
            borderRadius: 8,
            backgroundColor:
              value === option.value ? t.color.brandSoft : hovered ? t.color.soft : "transparent",
          })}
        >
          <Row gap={7}>
            <Txt
              size={12}
              weight={value === option.value ? "semibold" : "medium"}
              color={value === option.value ? t.color.brand : t.color.muted}
            >
              {option.label}
            </Txt>
            {option.count !== undefined ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  borderRadius: 5,
                  backgroundColor: value === option.value ? "#D7E7DC" : t.color.soft,
                }}
              >
                <Txt size={10} color={value === option.value ? t.color.brand : t.color.muted}>
                  {option.count}
                </Txt>
              </View>
            ) : null}
          </Row>
        </Interactive>
      ))}
    </Row>
  );
}
export function OrdersTable({
  rows,
  onSelect,
  compact = false,
}: {
  rows: OrderSummary[];
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <DataTable
      rows={rows}
      keyOf={(r) => r.id}
      onRowPress={(r) => onSelect(r.id)}
      minWidth={compact ? 620 : 820}
      columns={[
        {
          title: "Order",
          flex: 1.1,
          render: (r) => (
            <Stack gap={2}>
              <Txt size={12} weight="semibold">
                {orderNumber(r.number)}
              </Txt>
              <Txt size={10} color={t.color.muted}>
                {dateLabel(r.createdAt, true)}
              </Txt>
            </Stack>
          ),
        },
        {
          title: "Customer",
          flex: 1.4,
          render: (r) => (
            <Row gap={9}>
              <Avatar name={r.customerName} size={30} />
              <Txt size={12} lines={1}>
                {r.customerName}
              </Txt>
            </Row>
          ),
        },
        ...(!compact
          ? [
              {
                title: "Service",
                render: (r: OrderSummary) => (
                  <Txt size={12} color={t.color.muted}>
                    {titleCase(r.fulfillment)}
                  </Txt>
                ),
              },
              {
                title: "Items",
                flex: 0.55,
                render: (r: OrderSummary) => (
                  <Txt size={12} color={t.color.muted}>
                    {r.itemCount} items
                  </Txt>
                ),
              },
            ]
          : []),
        {
          title: "Amount",
          flex: 0.8,
          render: (r) => (
            <Txt size={12} weight="semibold">
              {formatMoney(r.totalCents)}
            </Txt>
          ),
        },
        {
          title: "Status",
          flex: 1,
          render: (r) => (
            <Row style={{ justifyContent: "space-between" }}>
              <StatusBadge status={r.status} />
              <ChevronRight size={14} color={t.color.subtle} />
            </Row>
          ),
        },
      ]}
    />
  );
}
export function FormActions({
  onClose,
  onSubmit,
  loading,
  label = "Save changes",
  disabled = false,
  danger = false,
}: {
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  label?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Row wrap style={{ justifyContent: "flex-end", maxWidth: "100%" }}>
      <Button variant="secondary" onPress={onClose} disabled={loading}>
        Cancel
      </Button>
      <Button
        variant={danger ? "danger" : "primary"}
        onPress={onSubmit}
        loading={loading}
        disabled={disabled}
      >
        {label}
      </Button>
    </Row>
  );
}
