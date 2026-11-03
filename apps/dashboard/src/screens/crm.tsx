import { useGetCustomers } from "@odyssey/api-client";
import { formatMoney } from "@odyssey/shared";
import type { Customer } from "@odyssey/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  LoadingState,
  Pagination,
  Row,
  SearchField,
  Stack,
  Txt,
  tokens as t,
} from "@odyssey/ui";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowUpRight, UserPlus, UsersRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { dateLabel, PageHeading, QueryError } from "../components/common";
import { CustomerDetailDialog, CustomerFormDialog } from "../components/customer-dialogs";
import { useDebounced } from "../features/use-debounced";

export default function CrmScreen() {
  const params = useLocalSearchParams<{ new?: string }>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | "new" | null>(
    params.new === "1" ? "new" : null,
  );
  const debounced = useDebounced(search);
  const query = useGetCustomers({ page, pageSize: 10, search: debounced || undefined });
  useEffect(() => {
    if (params.new === "1") setEditing("new");
  }, [params.new]);
  const closeForm = () => {
    setEditing(null);
    if (params.new) router.setParams({ new: undefined });
  };
  return (
    <Stack gap={20}>
      <PageHeading
        eyebrow="People, not just orders"
        title="Know the people at your table."
        subtitle="A little recognition goes a long way. Make every visit feel personal."
        action={
          <Button icon={<UserPlus size={16} color="white" />} onPress={() => setEditing("new")}>
            Add customer
          </Button>
        }
      />
      <Card padding={22} style={{ backgroundColor: "#ECF2EB", borderColor: "#E0E9DE" }}>
        <Row wrap gap={18}>
          <View style={{ padding: 13, borderRadius: 13, backgroundColor: "#DBE7D8" }}>
            <UsersRound size={25} color={t.color.brand} />
          </View>
          <Stack gap={3} style={{ flex: 1, minWidth: 180 }}>
            <Txt size={17} weight="semibold">
              Great service remembers.
            </Txt>
            <Txt size={12} color={t.color.muted}>
              Preferences, past orders, and the details that turn guests into regulars.
            </Txt>
          </Stack>
          <Badge tone="brand">
            {query.data?.pagination.total ?? "—"} {search ? "matching guests" : "guests & counting"}
          </Badge>
        </Row>
      </Card>
      <Card padding={0}>
        <Row wrap style={{ padding: 22, justifyContent: "space-between" }}>
          <Stack gap={2}>
            <Txt size={16} weight="semibold">
              Your guests
            </Txt>
            <Txt size={11} color={t.color.muted}>
              Every relationship, in one place.
            </Txt>
          </Stack>
          <SearchField
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search name, email or phone..."
            style={{ minWidth: 240 }}
          />
        </Row>
        {query.isPending ? (
          <View style={{ padding: 22 }}>
            <LoadingState />
          </View>
        ) : query.isError ? (
          <View style={{ padding: 22 }}>
            <QueryError error={query.error} retry={query.refetch} />
          </View>
        ) : !query.data.data.length ? (
          <EmptyState
            title={search ? "No guests found" : "Your first guest is a hello away"}
            message={
              search
                ? "Try a different name, email or phone number."
                : "Add a customer to start taking orders and building relationships."
            }
            action={
              <Button
                variant="secondary"
                onPress={() => (search ? setSearch("") : setEditing("new"))}
              >
                {search ? "Clear search" : "Add customer"}
              </Button>
            }
          />
        ) : (
          <>
            <DataTable
              rows={query.data.data}
              keyOf={(c) => c.id}
              onRowPress={(c) => setSelected(c.id)}
              minWidth={840}
              columns={[
                {
                  title: "Customer",
                  flex: 1.8,
                  render: (c) => (
                    <Row gap={12}>
                      <Avatar name={c.name} size={36} />
                      <Stack gap={2}>
                        <Txt size={12} weight="semibold">
                          {c.name}
                        </Txt>
                        <Txt size={10} color={t.color.muted}>
                          {c.email ?? "No email provided"}
                        </Txt>
                      </Stack>
                    </Row>
                  ),
                },
                {
                  title: "Phone",
                  flex: 1.25,
                  render: (c) => (
                    <Txt size={12} color={t.color.muted}>
                      {c.phone ?? "—"}
                    </Txt>
                  ),
                },
                {
                  title: "Orders",
                  flex: 0.7,
                  render: (c) => (
                    <Badge tone={c.orderCount >= 5 ? "brand" : "neutral"}>{c.orderCount}</Badge>
                  ),
                },
                {
                  title: "Total spend",
                  render: (c) => (
                    <Txt size={12} weight="semibold">
                      {formatMoney(c.spendCents)}
                    </Txt>
                  ),
                },
                {
                  title: "Last visit",
                  render: (c) => (
                    <Row style={{ justifyContent: "space-between" }}>
                      <Txt size={12} color={t.color.muted}>
                        {c.lastOrderAt ? dateLabel(c.lastOrderAt) : "Not yet"}
                      </Txt>
                      <ArrowUpRight size={14} color={t.color.subtle} />
                    </Row>
                  ),
                },
              ]}
            />
            <Pagination {...query.data.pagination} onChange={setPage} />
          </>
        )}
      </Card>
      <Txt size={11} color={t.color.muted}>
        Customer spend reflects completed orders. Cancelled orders are excluded from order counts.
      </Txt>
      {selected && !editing ? (
        <CustomerDetailDialog
          id={selected}
          onClose={() => setSelected(null)}
          onEdit={setEditing}
          onOrder={(id) => {
            setSelected(null);
            router.push(`/orders?id=${id}`);
          }}
        />
      ) : null}
      {editing ? (
        <CustomerFormDialog
          customer={editing === "new" ? undefined : editing}
          onClose={closeForm}
          onSaved={(id) => {
            closeForm();
            setSelected(id);
          }}
        />
      ) : null}
    </Stack>
  );
}
