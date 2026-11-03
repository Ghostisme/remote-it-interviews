import { OrderStatus, useGetOrders } from "@odyssey/api-client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Pagination,
  Row,
  SearchField,
  Select,
  Stack,
  Txt,
  tokens as t,
} from "@odyssey/ui";
import { router, useLocalSearchParams } from "expo-router";
import { Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { OrdersTable, PageHeading, QueryError, Tabs, titleCase } from "../components/common";
import { NewOrderDialog, OrderDetailDialog } from "../components/order-dialogs";
import { useDebounced } from "../features/use-debounced";

export default function OrdersScreen() {
  const params = useLocalSearchParams<{ new?: string; id?: string }>();
  const [creating, setCreating] = useState(params.new === "1");
  const [selected, setSelected] = useState<string | null>(params.id ?? null);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [period, setPeriod] = useState<"all" | "today" | "week">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  const query = useGetOrders(
    { page, pageSize: 10, search: debounced || undefined, status, period },
    { query: { refetchInterval: 15000 } },
  );
  useEffect(() => {
    if (params.new === "1") setCreating(true);
    if (params.id) setSelected(params.id);
  }, [params.new, params.id]);
  const close = () => {
    setCreating(false);
    setSelected(null);
    if (params.id || params.new) router.setParams({ id: undefined, new: undefined });
  };
  return (
    <Stack gap={20}>
      <PageHeading
        eyebrow="Keep service moving"
        title="Every order, in good hands."
        subtitle="From the first craving to the last happy bite."
        action={
          <Button icon={<Plus size={16} color="white" />} onPress={() => setCreating(true)}>
            Create order
          </Button>
        }
      />
      <Card padding={0}>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderColor: t.color.line,
          }}
        >
          <Stack gap={18}>
            <Row wrap style={{ justifyContent: "space-between" }}>
              <Tabs
                value={status ?? "all"}
                onChange={(value) => {
                  setStatus(value === "all" ? undefined : (value as OrderStatus));
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All orders" },
                  ...Object.values(OrderStatus).map((s) => ({ value: s, label: titleCase(s) })),
                ]}
              />
              <Badge tone="neutral">{query.data?.pagination.total ?? "—"} orders</Badge>
            </Row>
            <Row wrap>
              <SearchField
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder="Search order number or customer"
                style={{ flex: 1, minWidth: 220 }}
              />
              <View style={{ width: 165 }}>
                <Select
                  label="Order period"
                  value={period}
                  onChange={(v) => {
                    setPeriod(v as typeof period);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All time" },
                    { value: "today", label: "Today (UTC)" },
                    { value: "week", label: "Last 7 days" },
                  ]}
                />
              </View>
            </Row>
          </Stack>
        </View>
        {query.isPending ? (
          <View style={{ padding: 24 }}>
            <LoadingState />
          </View>
        ) : query.error ? (
          <View style={{ padding: 24 }}>
            <QueryError error={query.error} retry={() => void query.refetch()} />
          </View>
        ) : !query.data?.data.length ? (
          <EmptyState
            title={search || status ? "No matching orders" : "Ready for your first order?"}
            message={
              search || status
                ? "Try a different search or status filter."
                : "Create an order and let a great service begin."
            }
            action={
              search || status ? (
                <Button
                  variant="secondary"
                  onPress={() => {
                    setSearch("");
                    setStatus(undefined);
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onPress={() => setCreating(true)}>Create order</Button>
              )
            }
          />
        ) : (
          <OrdersTable rows={query.data.data} onSelect={setSelected} />
        )}
        {query.data ? <Pagination {...query.data.pagination} onChange={setPage} /> : null}
      </Card>
      <Row>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.color.success }} />
        <Txt size={10} color={t.color.muted}>
          Orders refresh automatically every 15 seconds.
        </Txt>
      </Row>
      {creating ? (
        <NewOrderDialog
          onClose={close}
          onCreated={(id) => {
            setCreating(false);
            setSelected(id);
            router.setParams({ new: undefined, id });
          }}
        />
      ) : null}
      {selected && !creating ? (
        <OrderDetailDialog key={selected} id={selected} onClose={close} />
      ) : null}
    </Stack>
  );
}
