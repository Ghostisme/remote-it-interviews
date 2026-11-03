import { useGetCustomer } from "@odyssey/api-client";
import { formatMoney } from "@odyssey/shared";
import type { Customer } from "@odyssey/types";
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
  Stack,
  Txt,
  tokens as t,
} from "@odyssey/ui";
import { Mail, Pencil, Phone } from "lucide-react-native";
import { useCustomerForm } from "../features/customers/use-customer-form";
import { dateLabel, FormActions, OrdersTable, QueryError, SectionHeading } from "./common";

export function CustomerFormDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const form = useCustomerForm(customer, onSaved);
  return (
    <Dialog
      visible
      title={customer ? "The little details matter" : "A new face at the table"}
      subtitle={
        customer
          ? "Keep your guest's details and preferences up to date."
          : "Start a lasting relationship, one good meal at a time."
      }
      onClose={() => {
        if (!form.saving) onClose();
      }}
      footer={
        <FormActions
          onClose={onClose}
          onSubmit={form.submit}
          loading={form.saving}
          label={customer ? "Save customer" : "Add customer"}
        />
      }
    >
      <Stack gap={18}>
        {form.error ? <Banner message={form.error} /> : null}
        <Field
          label="Full name"
          value={form.name}
          onChangeText={form.setName}
          placeholder="e.g. Jamie Parker"
          autoFocus
          maxLength={80}
        />
        <Field
          label="Email address"
          value={form.email}
          onChangeText={form.setEmail}
          placeholder="jamie@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={180}
          hint="Optional. Each email can belong to one customer."
        />
        <Field
          label="Phone number"
          value={form.phone}
          onChangeText={form.setPhone}
          placeholder="+1 (555) 000-0000"
          keyboardType="phone-pad"
          maxLength={30}
        />
        <Field
          label="Guest notes"
          value={form.notes}
          onChangeText={form.setNotes}
          placeholder="Favorite table, dietary preferences, special occasions..."
          multiline
          maxLength={600}
        />
      </Stack>
    </Dialog>
  );
}

export function CustomerDetailDialog({
  id,
  onClose,
  onEdit,
  onOrder,
}: {
  id: string;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onOrder: (id: string) => void;
}) {
  const query = useGetCustomer(id);
  const detail = query.data;
  return (
    <Dialog
      visible
      wide
      title="A familiar face"
      subtitle="Good hospitality starts with knowing your guests."
      onClose={onClose}
      footer={
        <Row>
          <Button variant="secondary" onPress={onClose}>
            Close
          </Button>
          {detail ? (
            <Button
              icon={<Pencil size={14} color="white" />}
              onPress={() => onEdit(detail.customer)}
            >
              Edit customer
            </Button>
          ) : null}
        </Row>
      }
    >
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <QueryError error={query.error} retry={query.refetch} />
      ) : detail ? (
        <Stack gap={24}>
          <Row wrap gap={16}>
            <Avatar name={detail.customer.name} size={64} />
            <Stack gap={5} style={{ flex: 1, minWidth: 180 }}>
              <Txt size={23} weight="semibold">
                {detail.customer.name}
              </Txt>
              <Row wrap gap={14}>
                {detail.customer.email ? (
                  <Row gap={6}>
                    <Mail size={13} color={t.color.muted} />
                    <Txt size={12} color={t.color.muted}>
                      {detail.customer.email}
                    </Txt>
                  </Row>
                ) : null}
                {detail.customer.phone ? (
                  <Row gap={6}>
                    <Phone size={13} color={t.color.muted} />
                    <Txt size={12} color={t.color.muted}>
                      {detail.customer.phone}
                    </Txt>
                  </Row>
                ) : null}
              </Row>
            </Stack>
            <Badge tone="neutral">Guest since {dateLabel(detail.customer.createdAt)}</Badge>
          </Row>
          <Row wrap gap={12}>
            {[
              ["Orders placed", String(detail.customer.orderCount)],
              ["Lifetime spend", formatMoney(detail.customer.spendCents)],
              [
                "Last visit",
                detail.customer.lastOrderAt ? dateLabel(detail.customer.lastOrderAt) : "Not yet",
              ],
            ].map(([label, value]) => (
              <Card
                key={label}
                padding={18}
                style={{ flex: 1, minWidth: 170, backgroundColor: t.color.canvas }}
              >
                <Stack gap={5}>
                  <Txt size={11} color={t.color.muted}>
                    {label}
                  </Txt>
                  <Txt size={24} weight="semibold">
                    {value}
                  </Txt>
                </Stack>
              </Card>
            ))}
          </Row>
          {detail.customer.notes ? (
            <Card padding={16} style={{ backgroundColor: "#FFF9EF", borderColor: "#F1EBD9" }}>
              <Stack gap={5}>
                <Txt size={12} weight="semibold">
                  A little to remember
                </Txt>
                <Txt size={12} color={t.color.muted}>
                  {detail.customer.notes}
                </Txt>
              </Stack>
            </Card>
          ) : null}
          <SectionHeading
            title="Order history"
            subtitle="The 50 most recent orders. Spend includes completed orders only."
          />
          {detail.orders.length ? (
            <OrdersTable rows={detail.orders} compact onSelect={onOrder} />
          ) : (
            <EmptyState
              title="Their first visit is still to come"
              message="Create an order for this guest, and their story will start here."
            />
          )}
        </Stack>
      ) : null}
    </Dialog>
  );
}
