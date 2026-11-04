import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Row,
  Select,
  Skeleton,
  Stack,
  Toggle,
  Txt,
  tokens as t,
  tones,
  useToast,
} from "@odyssey/ui";
import { Check, Plus } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { PageHeading, SectionHeading, Tabs, useCompact } from "../components/common";

/** Exercise the shared design tokens and interactive primitives in an inspectable reference page. */
export default function UILibraryScreen() {
  const [isDialogVisible, setDialogVisible] = useState(false);
  const [isToggleEnabled, setToggleEnabled] = useState(true);
  const [fulfillment, setFulfillment] = useState("pickup");
  const [activeTab, setActiveTab] = useState("all");
  const toast = useToast();
  const compact = useCompact();
  return (
    <Stack gap={24}>
      <PageHeading
        eyebrow="Design system / 01"
        title="Thoughtful by design."
        subtitle="The building blocks of a calmer, more consistent workspace."
        action={<Badge tone="brand">Olive system · v1.0</Badge>}
      />
      <Card>
        <Stack gap={22}>
          <SectionHeading
            title="Color & meaning"
            subtitle="A quiet foundation. A little warmth. Clear signals when they matter."
          />
          <Row wrap gap={16}>
            {["brand", "ink", "orange", "canvas", "surface", "muted"].map((key) => {
              const color = t.color[key as keyof typeof t.color];
              return (
                <Stack key={key} gap={8} style={{ flex: 1, minWidth: 100 }}>
                  <View
                    style={{
                      height: 70,
                      borderRadius: 10,
                      backgroundColor: color,
                      borderWidth: 1,
                      borderColor: t.color.line,
                    }}
                  />
                  <Txt size={12} weight="semibold">
                    {key}
                  </Txt>
                  <Txt size={10} color={t.color.muted}>
                    {color}
                  </Txt>
                </Stack>
              );
            })}
          </Row>
          <Row wrap>
            {Object.keys(tones).map((key) => (
              <Badge key={key} tone={key as keyof typeof tones} dot>
                {key}
              </Badge>
            ))}
          </Row>
        </Stack>
      </Card>
      <Row wrap style={{ alignItems: "stretch" }} gap={24}>
        <Card style={{ flex: 1, minWidth: compact ? 260 : 380 }}>
          <Stack gap={18}>
            <SectionHeading
              title="Type with a point of view"
              subtitle="DM Sans for clarity. DM Serif Display for character."
            />
            <Txt size={36} weight="display">
              Good food. Good company.
            </Txt>
            <Txt size={28} weight="semibold">
              A clear heading
            </Txt>
            <Txt size={20} weight="semibold">
              Section title
            </Txt>
            <Txt size={14}>The everyday details that make service feel effortless.</Txt>
            <Txt size={12} color={t.color.muted}>
              A supporting thought, a helpful hint, a little context.
            </Txt>
            <Txt size={10} weight="semibold" color={t.color.muted} style={{ letterSpacing: 1.5 }}>
              SMALL DETAILS, CLEARLY LABELLED
            </Txt>
          </Stack>
        </Card>
        <Card style={{ flex: 1, minWidth: 260 }}>
          <Stack gap={18}>
            <SectionHeading
              title="Space, shape & surface"
              subtitle="A 4px rhythm, with room to breathe."
            />
            <Row wrap gap={16} style={{ alignItems: "flex-end" }}>
              {Object.values(t.space).map((value) => (
                <Stack key={value} gap={7}>
                  <View
                    style={{
                      width: value,
                      height: value,
                      backgroundColor: t.color.brandSoft,
                      borderRadius: 3,
                    }}
                  />
                  <Txt size={10} color={t.color.muted}>
                    {value}
                  </Txt>
                </Stack>
              ))}
            </Row>
            <Row wrap>
              {Object.entries(t.radius)
                .filter(([key]) => key !== "pill")
                .map(([key, value]) => (
                  <View
                    key={key}
                    style={{
                      width: 68,
                      height: 52,
                      borderWidth: 1,
                      borderColor: t.color.line,
                      borderRadius: value,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Txt size={10}>
                      {key} · {value}
                    </Txt>
                  </View>
                ))}
            </Row>
            <Card padding={16}>
              <Txt size={12}>Surface · 1px border · soft shadow</Txt>
            </Card>
            <Txt size={11} color={t.color.muted}>
              Desktop: 234px navigation / 32px gutters. Compact: 18px gutters, wrapping grids and
              scrollable tables.
            </Txt>
          </Stack>
        </Card>
      </Row>
      <Card>
        <Stack gap={22}>
          <SectionHeading
            title="Actions & controls"
            subtitle="Every control has a clear purpose and a predictable response."
          />
          <Row wrap>
            <Button
              icon={<Plus size={16} color="white" />}
              onPress={() => toast("A new beginning.")}
            >
              Primary action
            </Button>
            <Button variant="secondary" onPress={() => setDialogVisible(true)}>
              Open dialog
            </Button>
            <Button variant="ghost" onPress={() => toast("A quiet little action.", "info")}>
              Ghost action
            </Button>
            <Button
              variant="danger"
              onPress={() => toast("Example warning, no data changed.", "warning")}
            >
              Destructive
            </Button>
            <Button disabled>Disabled</Button>
            <Button loading>Saving</Button>
            <Button
              small
              icon={<Check size={14} color="white" />}
              onPress={() => toast("Changes saved.")}
            >
              Small action
            </Button>
          </Row>
          <Row wrap style={{ alignItems: "flex-start" }}>
            <Field label="Default input" placeholder="Type something lovely" />
            <Field label="With validation" value="" error="This field is required." />
            <Field label="Read only" value="USD — US Dollar" editable={false} />
          </Row>
          <Row wrap>
            <View style={{ width: 240 }}>
              <Select
                label="Service type"
                value={fulfillment}
                options={[
                  { value: "pickup", label: "Pickup" },
                  { value: "delivery", label: "Delivery" },
                ]}
                onChange={setFulfillment}
              />
            </View>
            <Row>
              <Toggle
                value={isToggleEnabled}
                onChange={setToggleEnabled}
                label="Example availability"
              />
              <Txt size={12}>{isToggleEnabled ? "Available" : "Unavailable"}</Txt>
            </Row>
            <Avatar name="Sophie Chen" />
            <Avatar name="James Wilson" tone="orange" />
            <Avatar name="Emma Thompson" tone="violet" />
          </Row>
          <Tabs
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "all", label: "All items", count: 12 },
              { value: "available", label: "Available", count: 11 },
              { value: "sold", label: "Sold out", count: 1 },
            ]}
          />
        </Stack>
      </Card>
      <Card>
        <Stack gap={18}>
          <SectionHeading
            title="Feedback & states"
            subtitle="Keep people informed, even when there is nothing to show."
          />
          <Banner message="All changes have been saved." tone="success" />
          <Banner message="Your restaurant is currently not accepting orders." tone="warning" />
          <Banner
            message="We couldn't load this data. Try again in a moment."
            tone="danger"
            onRetry={() => toast("This is a preview of the retry interaction.", "info")}
          />
          <Row gap={24} wrap>
            <Stack gap={12} style={{ flex: 1, minWidth: 220 }}>
              <Skeleton width="65%" height={22} />
              <Skeleton height={12} />
              <Skeleton width="85%" height={12} />
              <Button variant="secondary" onPress={() => toast("Your changes are saved.")}>
                Show success toast
              </Button>
            </Stack>
            <View style={{ flex: 1, minWidth: 220 }}>
              <EmptyState
                title="A fresh start"
                message="Add your first item to bring this space to life."
                action={
                  <Button small onPress={() => setDialogVisible(true)}>
                    Add an item
                  </Button>
                }
              />
            </View>
          </Row>
        </Stack>
      </Card>
      <Card padding={0}>
        <View style={{ padding: 24 }}>
          <SectionHeading
            title="Lists that tell a story"
            subtitle="Shared table structure, readable rows and semantic status."
          />
        </View>
        <DataTable
          rows={[
            { id: "1", name: "Burrata garden salad", status: "Available" },
            { id: "2", name: "Ember-grilled steak", status: "Sold out" },
          ]}
          keyOf={(r) => r.id}
          columns={[
            { title: "Menu item", render: (r) => <Txt weight="medium">{r.name}</Txt> },
            {
              title: "Availability",
              render: (r) => (
                <Badge tone={r.id === "1" ? "success" : "neutral"} dot>
                  {r.status}
                </Badge>
              ),
            },
          ]}
        />
      </Card>
      <Dialog
        visible={isDialogVisible}
        title="A little space to focus"
        subtitle="Dialogs keep a task close, without losing your place."
        onClose={() => setDialogVisible(false)}
        footer={
          <Row style={{ justifyContent: "flex-end" }}>
            <Button variant="secondary" onPress={() => setDialogVisible(false)}>
              Cancel
            </Button>
            <Button
              onPress={() => {
                setDialogVisible(false);
                toast("Example saved successfully.");
              }}
            >
              Save example
            </Button>
          </Row>
        }
      >
        <Field
          label="Example name"
          placeholder="A lovely new dish"
          hint="Press Escape to close. Tab stays inside the dialog."
        />
      </Dialog>
    </Stack>
  );
}
