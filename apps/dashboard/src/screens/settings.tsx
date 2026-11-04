import { useGetSettings } from "@odyssey/api-client";
import type { Settings } from "@odyssey/types";
import {
  Badge,
  Banner,
  Button,
  Card,
  Field,
  LoadingState,
  Row,
  Stack,
  Toggle,
  Txt,
  tokens as t,
} from "@odyssey/ui";
import { Bike, Check, Clock3, Coffee, Info, Save, ShoppingBag, Store } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { PageHeading, QueryError, SectionHeading, useCompact } from "../components/common";
import { useSettingsForm } from "../features/settings/use-settings-form";

/** Pair an ordering preference with its label, explanation, and accessible switch. */
function Preference({
  title,
  description,
  value,
  onChange,
  icon,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Row gap={14} style={{ paddingVertical: 17, borderBottomWidth: 1, borderColor: t.color.line }}>
      {icon ? (
        <View style={{ backgroundColor: t.color.canvas, padding: 10, borderRadius: 9 }}>
          {icon}
        </View>
      ) : null}
      <Stack gap={3} style={{ flex: 1 }}>
        <Txt size={13} weight="medium">
          {title}
        </Txt>
        <Txt size={11} color={t.color.muted}>
          {description}
        </Txt>
      </Stack>
      <Toggle label={title} value={value} onChange={onChange} disabled={disabled} />
    </Row>
  );
}
/** Present editable preferences and explicit save/discard actions across narrow and wide screens. */
function SettingsForm({ settings }: { settings: Settings }) {
  const form = useSettingsForm(settings);
  const compact = useCompact();
  const draft = form.draft;
  return (
    <Stack gap={20}>
      <PageHeading
        eyebrow="The way you work"
        title="Your restaurant. Your rhythm."
        subtitle="Set the little things that keep every service running smoothly."
        action={
          <Button
            disabled={!form.isDirty}
            loading={form.saving}
            onPress={form.save}
            icon={<Save size={15} color="white" />}
          >
            Save changes
          </Button>
        }
      />
      {form.error ? <Banner message={form.error} /> : null}
      <Row wrap gap={24} style={{ alignItems: "flex-start" }}>
        <Stack gap={22} style={{ flex: 1.65, minWidth: compact ? 250 : 420 }}>
          <Card>
            <Stack gap={22}>
              <SectionHeading
                title="Restaurant details"
                subtitle="A familiar name, a consistent experience."
              />
              <Row gap={14}>
                <View style={{ backgroundColor: "#F6EDDD", borderRadius: 14, padding: 17 }}>
                  <Store size={27} color="#A27C44" />
                </View>
                <Stack gap={3}>
                  <Txt size={16} weight="semibold">
                    {settings.restaurantName}
                  </Txt>
                  <Txt size={11} color={t.color.muted}>
                    Restaurant workspace · USD
                  </Txt>
                </Stack>
              </Row>
              <Field
                label="Restaurant name"
                value={draft.restaurantName}
                onChangeText={(value) => form.setField("restaurantName", value)}
                maxLength={80}
              />
              <Banner
                tone="info"
                message="This workspace uses USD. Prices are tax-exclusive; tax is added at checkout."
              />
            </Stack>
          </Card>
          <Card>
            <SectionHeading
              title="Ordering preferences"
              subtitle="A little less friction. A little more flow."
            />
            <Preference
              title="Accepting orders"
              description="Pause new orders whenever the kitchen needs a breather."
              value={draft.acceptingOrders}
              onChange={(value) => form.setField("acceptingOrders", value)}
              disabled={form.saving}
            />
            <Preference
              title="Auto-accept orders"
              description="New orders go straight to accepted, ready for preparation."
              value={draft.autoAccept}
              onChange={(value) => form.setField("autoAccept", value)}
              disabled={form.saving}
            />
            <View style={{ marginTop: 20 }}>
              <Field
                label="Preparation time (minutes)"
                value={draft.prepTime}
                onChangeText={(value) => form.setField("prepTime", value)}
                keyboardType="number-pad"
                hint="Between 5 and 120 minutes. Shown when creating an order."
              />
            </View>
          </Card>
          <Card>
            <SectionHeading
              title="Ways to enjoy"
              subtitle="Choose the services your restaurant offers."
            />
            <Preference
              title="Delivery"
              description="Bring good food to your guests' doorsteps."
              icon={<Bike size={19} color={t.color.brand} />}
              value={draft.deliveryEnabled}
              onChange={(value) => form.setField("deliveryEnabled", value)}
              disabled={form.saving}
            />
            <Preference
              title="Pickup"
              description="Freshly prepared, ready when your guests are."
              icon={<ShoppingBag size={19} color={t.color.brand} />}
              value={draft.pickupEnabled}
              onChange={(value) => form.setField("pickupEnabled", value)}
              disabled={form.saving}
            />
            <Preference
              title="Dine in"
              description="Welcome guests to a seat at your table."
              icon={<Coffee size={19} color={t.color.brand} />}
              value={draft.dineInEnabled}
              onChange={(value) => form.setField("dineInEnabled", value)}
              disabled={form.saving}
            />
            {!draft.deliveryEnabled && !draft.pickupEnabled && !draft.dineInEnabled ? (
              <View style={{ marginTop: 16 }}>
                <Banner
                  tone="warning"
                  message="All services are disabled. New orders will be blocked until a service is enabled."
                />
              </View>
            ) : null}
          </Card>
        </Stack>
        <Stack gap={22} style={{ flex: 1, minWidth: 250 }}>
          <Card>
            <Stack gap={20}>
              <SectionHeading title="The numbers" subtitle="Clear pricing, no surprises." />
              <Field
                label="Delivery fee (USD)"
                value={draft.deliveryFee}
                onChangeText={(value) => form.setField("deliveryFee", value)}
                keyboardType="decimal-pad"
                hint="Added to delivery orders only."
              />
              <Field
                label="Minimum order subtotal (USD)"
                value={draft.minimumOrder}
                onChangeText={(value) => form.setField("minimumOrder", value)}
                keyboardType="decimal-pad"
                hint="Set to 0.00 for no minimum."
              />
              <Field
                label="Tax rate (%)"
                value={draft.taxRatePercent}
                onChangeText={(value) => form.setField("taxRatePercent", value)}
                keyboardType="decimal-pad"
                hint="0–30%. Calculated once on the order subtotal."
              />
            </Stack>
          </Card>
          <Card>
            <Stack gap={20}>
              <SectionHeading title="Hours & time" subtitle="Your daily rhythm, in local time." />
              <Row>
                <Stack style={{ flex: 1 }}>
                  <Field
                    label="Opens at"
                    value={draft.openingTime}
                    onChangeText={(value) => form.setField("openingTime", value)}
                    placeholder="09:00"
                    maxLength={5}
                  />
                </Stack>
                <Stack style={{ flex: 1 }}>
                  <Field
                    label="Closes at"
                    value={draft.closingTime}
                    onChangeText={(value) => form.setField("closingTime", value)}
                    placeholder="22:00"
                    maxLength={5}
                  />
                </Stack>
              </Row>
              <Field
                label="Timezone"
                value={draft.timezone}
                onChangeText={(value) => form.setField("timezone", value)}
                placeholder="America/New_York"
                autoCapitalize="none"
              />
              <Row gap={9} style={{ alignItems: "flex-start" }}>
                <Clock3 size={16} color={t.color.muted} />
                <Txt size={11} color={t.color.muted} style={{ flex: 1 }}>
                  Hours are informational. Use Accepting orders to control live availability.
                  Analytics periods use UTC.
                </Txt>
              </Row>
            </Stack>
          </Card>
          <Card padding={20} style={{ backgroundColor: t.color.brandSoft, borderColor: "#DBE8DF" }}>
            <Stack gap={10}>
              <Info size={20} color={t.color.brand} />
              <Txt size={14} weight="semibold">
                A change for what's next.
              </Txt>
              <Txt size={12} color={t.color.muted}>
                Saved preferences apply to new orders. The totals and details of existing orders
                stay as they were.
              </Txt>
            </Stack>
          </Card>
        </Stack>
      </Row>
      <Card padding={18}>
        <Row wrap style={{ justifyContent: "space-between" }}>
          <Row gap={8}>
            {form.isDirty ? (
              <Badge tone="warning" dot>
                Unsaved changes
              </Badge>
            ) : (
              <>
                <Check size={15} color={t.color.brand} />
                <Txt size={12} color={t.color.muted}>
                  All preferences are saved
                </Txt>
              </>
            )}
          </Row>
          <Row>
            <Button
              variant="secondary"
              disabled={!form.isDirty || form.saving}
              onPress={form.reset}
            >
              Discard changes
            </Button>
            <Button disabled={!form.isDirty} loading={form.saving} onPress={form.save}>
              Save changes
            </Button>
          </Row>
        </Row>
      </Card>
    </Stack>
  );
}
/** Wait for persisted settings before mounting a form with its saved baseline. */
export default function SettingsScreen() {
  const settingsQuery = useGetSettings();
  if (settingsQuery.isPending) return <LoadingState />;
  if (settingsQuery.isError)
    return <QueryError error={settingsQuery.error} retry={settingsQuery.refetch} />;
  return <SettingsForm settings={settingsQuery.data} />;
}
