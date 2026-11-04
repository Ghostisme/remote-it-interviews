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

/** Search and paginate guest profiles, then connect profile editing and order-history navigation. */
export default function CrmScreen() {
  const params = useLocalSearchParams<{ new?: string }>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | "new" | null>(
    params.new === "1" ? "new" : null,
  );
  const debouncedSearch = useDebounced(search);
  const customersQuery = useGetCustomers({
    page,
    pageSize: 10,
    search: debouncedSearch || undefined,
  });
  useEffect(() => {
    if (params.new === "1") setEditingCustomer("new");
  }, [params.new]);
  const closeForm = () => {
    setEditingCustomer(null);
    if (params.new) router.setParams({ new: undefined });
  };
  return (
    <Stack gap={20}>
      <PageHeading
        eyebrow="People, not just orders"
        title="Know the people at your table."
        subtitle="A little recognition goes a long way. Make every visit feel personal."
        action={
          <Button
            icon={<UserPlus size={16} color="white" />}
            onPress={() => setEditingCustomer("new")}
          >
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
            {customersQuery.data?.pagination.total ?? "—"}{" "}
            {search ? "matching guests" : "guests & counting"}
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
        {customersQuery.isPending ? (
          <View style={{ padding: 22 }}>
            <LoadingState />
          </View>
        ) : customersQuery.isError ? (
          <View style={{ padding: 22 }}>
            <QueryError error={customersQuery.error} retry={customersQuery.refetch} />
          </View>
        ) : !customersQuery.data.data.length ? (
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
                onPress={() => (search ? setSearch("") : setEditingCustomer("new"))}
              >
                {search ? "Clear search" : "Add customer"}
              </Button>
            }
          />
        ) : (
          <>
            <DataTable
              rows={customersQuery.data.data}
              keyOf={(customer) => customer.id}
              onRowPress={(customer) => setSelectedCustomerId(customer.id)}
              minWidth={840}
              columns={[
                {
                  title: "Customer",
                  flex: 1.8,
                  render: (customer) => (
                    <Row gap={12}>
                      <Avatar name={customer.name} size={36} />
                      <Stack gap={2}>
                        <Txt size={12} weight="semibold">
                          {customer.name}
                        </Txt>
                        <Txt size={10} color={t.color.muted}>
                          {customer.email ?? "No email provided"}
                        </Txt>
                      </Stack>
                    </Row>
                  ),
                },
                {
                  title: "Phone",
                  flex: 1.25,
                  render: (customer) => (
                    <Txt size={12} color={t.color.muted}>
                      {customer.phone ?? "—"}
                    </Txt>
                  ),
                },
                {
                  title: "Orders",
                  flex: 0.7,
                  render: (customer) => (
                    <Badge tone={customer.orderCount >= 5 ? "brand" : "neutral"}>
                      {customer.orderCount}
                    </Badge>
                  ),
                },
                {
                  title: "Total spend",
                  render: (customer) => (
                    <Txt size={12} weight="semibold">
                      {formatMoney(customer.spendCents)}
                    </Txt>
                  ),
                },
                {
                  title: "Last visit",
                  render: (customer) => (
                    <Row style={{ justifyContent: "space-between" }}>
                      <Txt size={12} color={t.color.muted}>
                        {customer.lastOrderAt ? dateLabel(customer.lastOrderAt) : "Not yet"}
                      </Txt>
                      <ArrowUpRight size={14} color={t.color.subtle} />
                    </Row>
                  ),
                },
              ]}
            />
            <Pagination {...customersQuery.data.pagination} onChange={setPage} />
          </>
        )}
      </Card>
      <Txt size={11} color={t.color.muted}>
        Customer spend reflects completed orders. Cancelled orders are excluded from order counts.
      </Txt>
      {selectedCustomerId && !editingCustomer ? (
        <CustomerDetailDialog
          id={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onEdit={setEditingCustomer}
          onOrder={(id) => {
            setSelectedCustomerId(null);
            router.push(`/orders?id=${id}`);
          }}
        />
      ) : null}
      {editingCustomer ? (
        <CustomerFormDialog
          customer={editingCustomer === "new" ? undefined : editingCustomer}
          onClose={closeForm}
          onSaved={(id) => {
            closeForm();
            setSelectedCustomerId(id);
          }}
        />
      ) : null}
    </Stack>
  );
}
