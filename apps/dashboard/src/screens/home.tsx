import { useGetSettings, useGetSummary } from "@odyssey/api-client";
import { formatMoney } from "@odyssey/shared";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Row,
  Select,
  Stack,
  Txt,
  tokens as t,
} from "@odyssey/ui";
import { router } from "expo-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  ChefHat,
  Clock3,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  UsersRound,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import {
  contentWidth,
  FoodImage,
  OrdersTable,
  PageHeading,
  QueryError,
  SectionHeading,
} from "../components/common";
import { OrderDetailDialog } from "../components/order-dialogs";
import { RevenueChart } from "../components/revenue-chart";

function Metric({
  label,
  value,
  change,
  note,
  icon,
  columns,
}: {
  label: string;
  value: string;
  change?: number | null;
  note: string;
  icon: ReactNode;
  columns: number;
}) {
  const positive = (change ?? 0) >= 0;
  const { width } = useWindowDimensions();
  const availableWidth = contentWidth(width);
  return (
    <View style={{ width: (availableWidth - (columns - 1) * 18) / columns }}>
      <Card padding={21} style={{ minHeight: 163 }}>
        <Stack gap={14}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt size={12} color={t.color.muted}>
              {label}
            </Txt>
            <View style={{ backgroundColor: t.color.canvas, padding: 8, borderRadius: 9 }}>
              {icon}
            </View>
          </Row>
          <Txt size={29} weight="semibold" style={{ letterSpacing: -1 }}>
            {value}
          </Txt>
          <Row gap={6} wrap>
            {change !== undefined ? (
              <Badge tone={change === null ? "neutral" : positive ? "success" : "danger"}>
                {change === null ? "No prior data" : `${positive ? "+" : ""}${change.toFixed(1)}%`}
              </Badge>
            ) : null}
            <Txt size={10} color={t.color.muted}>
              {note}
            </Txt>
          </Row>
        </Stack>
      </Card>
    </View>
  );
}
export default function HomeScreen() {
  const [days, setDays] = useState(7);
  const [selected, setSelected] = useState<string | null>(null);
  const query = useGetSummary({ days }, { query: { refetchInterval: 15000 } });
  const config = useGetSettings();
  const { width } = useWindowDimensions();
  const columns = width >= 1200 ? 4 : width >= 600 ? 2 : 1;
  const data = query.data;
  const settings = config.data;
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return (
    <Stack gap={22}>
      <PageHeading
        eyebrow={today}
        title="A good day, in the making."
        subtitle="A little perspective on everything happening at your restaurant."
        action={
          <Select
            label="Reporting period"
            value={String(days)}
            onChange={(value) => setDays(Number(value))}
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "14", label: "Last 14 days" },
              { value: "30", label: "Last 30 days" },
            ]}
          />
        }
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <QueryError error={query.error} retry={query.refetch} />
      ) : data ? (
        <>
          <Row wrap gap={18} style={{ justifyContent: "space-between", alignItems: "stretch" }}>
            <Metric
              columns={columns}
              label="Total revenue"
              value={formatMoney(data.revenueCents)}
              change={data.revenueChange}
              note={`vs. previous ${days} days`}
              icon={<Banknote size={17} color={t.color.brand} />}
            />
            <Metric
              columns={columns}
              label="Orders placed"
              value={data.orderCount.toLocaleString("en-US")}
              change={data.orderChange}
              note={`vs. previous ${days} days`}
              icon={<ReceiptText size={17} color={t.color.info} />}
            />
            <Metric
              columns={columns}
              label="Active orders"
              value={String(data.activeOrders)}
              note="Across all dates · live"
              icon={<Clock3 size={17} color={t.color.orange} />}
            />
            <Metric
              columns={columns}
              label="Average order"
              value={formatMoney(data.averageOrderCents)}
              note="Completed orders in this period"
              icon={<ShoppingBag size={17} color={t.color.violet} />}
            />
          </Row>
          <Row wrap gap={22} style={{ alignItems: "stretch" }}>
            <Card style={{ flex: 1.9, minWidth: width < 650 ? 240 : 380 }}>
              <Stack gap={24}>
                <SectionHeading
                  title="The bigger picture"
                  subtitle={`Your last ${days} days, one good service at a time.`}
                  action={<Badge tone="brand">Revenue</Badge>}
                />
                <Row style={{ alignItems: "flex-end" }}>
                  <Txt size={29} weight="semibold" style={{ letterSpacing: -0.8 }}>
                    {formatMoney(data.revenueCents)}
                  </Txt>
                  {data.revenueChange !== null ? (
                    <Row gap={3} style={{ paddingBottom: 6 }}>
                      {data.revenueChange >= 0 ? (
                        <ArrowUpRight size={14} color={t.color.success} />
                      ) : (
                        <ArrowDownRight size={14} color={t.color.danger} />
                      )}
                      <Txt
                        size={11}
                        color={data.revenueChange >= 0 ? t.color.success : t.color.danger}
                      >
                        {Math.abs(data.revenueChange).toFixed(1)}%
                      </Txt>
                    </Row>
                  ) : null}
                </Row>
                <RevenueChart daily={data.daily} />
                <Txt size={10} color={t.color.muted}>
                  Completed orders only · Includes tax & delivery fees · UTC
                </Txt>
              </Stack>
            </Card>
            <Card style={{ flex: 1, minWidth: 255 }}>
              <Stack gap={23}>
                <SectionHeading
                  title="Crowd favorites"
                  subtitle="The dishes that keep them coming back."
                  action={<Sparkles size={18} color={t.color.orange} />}
                />
                {data.popularItems.length ? (
                  data.popularItems.map((item, index) => (
                    <Row key={item.menuItemId} gap={10}>
                      <Txt size={10} color={t.color.subtle}>
                        {String(index + 1).padStart(2, "0")}
                      </Txt>
                      <FoodImage imageKey={item.imageKey} size={47} />
                      <Stack gap={3} style={{ flex: 1 }}>
                        <Txt size={12} weight="semibold" lines={1}>
                          {item.name}
                        </Txt>
                        <Txt size={10} color={t.color.muted}>
                          {item.quantity} sold · {formatMoney(item.revenueCents)}
                        </Txt>
                      </Stack>
                    </Row>
                  ))
                ) : (
                  <EmptyState
                    title="Your next bestseller is waiting"
                    message="Complete orders to discover your crowd favorites."
                  />
                )}
                <Button
                  variant="secondary"
                  small
                  onPress={() => router.push("/menu")}
                  icon={<ArrowRight size={13} color={t.color.brand} />}
                >
                  Explore your menu
                </Button>
              </Stack>
            </Card>
          </Row>
          <Row wrap gap={22} style={{ alignItems: "stretch" }}>
            <Card
              padding={0}
              style={{ flex: 2, minWidth: width < 650 ? 240 : 400, overflow: "hidden" }}
            >
              <View style={{ padding: 24 }}>
                <SectionHeading
                  title="Fresh from the counter"
                  subtitle="Your five most recent orders, across all dates."
                  action={
                    <Button
                      variant="ghost"
                      small
                      onPress={() => router.push("/orders")}
                      icon={<ArrowUpRight size={14} color={t.color.brand} />}
                    >
                      View all
                    </Button>
                  }
                />
              </View>
              {data.recentOrders.length ? (
                <OrdersTable rows={data.recentOrders} onSelect={setSelected} compact />
              ) : (
                <EmptyState
                  title="The counter is ready"
                  message="Your first order will appear right here."
                  action={
                    <Button onPress={() => router.push("/orders?new=1")}>Create order</Button>
                  }
                />
              )}
            </Card>
            <Stack gap={20} style={{ flex: 0.95, minWidth: 255 }}>
              <Card
                padding={24}
                style={{ backgroundColor: t.color.brand, borderColor: t.color.brand }}
              >
                <Stack gap={19}>
                  <View
                    style={{
                      padding: 11,
                      borderRadius: 12,
                      backgroundColor: "#3B6E5D",
                      alignSelf: "flex-start",
                    }}
                  >
                    <ChefHat size={23} color="white" />
                  </View>
                  <Stack gap={6}>
                    <Txt size={22} weight="display" color="white">
                      {settings?.acceptingOrders
                        ? "Ready for a great service."
                        : settings
                          ? "A moment to catch your breath."
                          : "Your service, at a glance."}
                    </Txt>
                    <Txt size={12} color="#CBDDD4">
                      {settings
                        ? `${settings.prepTimeMinutes}-minute preparation. ${[settings.deliveryEnabled && "Delivery", settings.pickupEnabled && "pickup", settings.dineInEnabled && "dine in"].filter(Boolean).join(", ") || "No services enabled"}.`
                        : "Check ordering preferences and keep service flowing."}
                    </Txt>
                  </Stack>
                  <Button
                    small
                    variant="secondary"
                    onPress={() => router.push("/settings")}
                    icon={<ArrowUpRight size={13} color={t.color.brand} />}
                  >
                    Service settings
                  </Button>
                </Stack>
              </Card>
              <Card padding={22}>
                <Row gap={14}>
                  <View
                    style={{ backgroundColor: t.color.orangeSoft, padding: 11, borderRadius: 11 }}
                  >
                    <UsersRound size={21} color={t.color.orange} />
                  </View>
                  <Stack gap={0}>
                    <Txt size={25} weight="semibold">
                      {data.customersCount}
                    </Txt>
                    <Txt size={11} color={t.color.muted}>
                      Guests in your community
                    </Txt>
                  </Stack>
                </Row>
                <View style={{ marginTop: 16 }}>
                  <Button variant="ghost" small onPress={() => router.push("/crm")}>
                    Get to know your guests →
                  </Button>
                </View>
              </Card>
            </Stack>
          </Row>
        </>
      ) : null}
      <Row gap={6}>
        <View style={{ height: 5, width: 5, borderRadius: 3, backgroundColor: t.color.success }} />
        <Txt size={10} color={t.color.muted}>
          A live view of your restaurant · Refreshes every 15 seconds
        </Txt>
      </Row>
      {selected ? (
        <OrderDetailDialog key={selected} id={selected} onClose={() => setSelected(null)} />
      ) : null}
    </Stack>
  );
}
