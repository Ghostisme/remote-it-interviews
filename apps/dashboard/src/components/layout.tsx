import { useGetSettings } from "@odyssey/api-client";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Interactive,
  Row,
  Stack,
  Txt,
  tokens as t,
} from "@odyssey/ui";
import { router, usePathname } from "expo-router";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Command,
  House,
  Layers3,
  Leaf,
  Plus,
  ReceiptText,
  Settings2,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Share one route list between the desktop sidebar and compact horizontal navigation.
const navigation = [
  { path: "/", label: "Overview", icon: House },
  { path: "/orders", label: "Orders", icon: ReceiptText },
  { path: "/menu", label: "Menu", icon: UtensilsCrossed },
  { path: "/crm", label: "Customers", icon: UsersRound },
  { path: "/settings", label: "Settings", icon: Settings2 },
] as const;
/** Render one route with matching hover, selected, and accessibility states. */
function NavItem({
  path,
  label,
  icon: Icon,
  active,
  compact = false,
}: {
  path: string;
  label: string;
  icon: typeof House;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Interactive
      onPress={() => router.push(path)}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ hovered }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 44,
        paddingHorizontal: compact ? 12 : 16,
        borderRadius: 9,
        backgroundColor: active ? t.color.brandSoft : hovered ? t.color.canvas : "transparent",
      })}
    >
      <Icon
        size={18}
        strokeWidth={active ? 2 : 1.7}
        color={active ? t.color.brand : t.color.muted}
      />
      <Txt
        size={13}
        weight={active ? "semibold" : "medium"}
        color={active ? t.color.brand : t.color.muted}
      >
        {label}
      </Txt>
      {active && !compact ? (
        <View
          style={{
            marginLeft: "auto",
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: t.color.brand,
          }}
        />
      ) : null}
    </Interactive>
  );
}
/** Provide responsive navigation, workspace actions, safe-area spacing, and page content. */
export function AppShell({ children }: { children: ReactNode }) {
  const currentPath = usePathname();
  const { width } = useWindowDimensions();
  const compact = width < t.layout.breakpoint;
  const insets = useSafeAreaInsets();
  const settingsQuery = useGetSettings();
  const [isHelpVisible, setHelpVisible] = useState(false);
  const [isRestaurantDetailsVisible, setRestaurantDetailsVisible] = useState(false);
  const currentPageLabel =
    currentPath === "/ui-library"
      ? "UI Library"
      : (navigation.find((route) => route.path === currentPath)?.label ?? "Overview");
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        backgroundColor: t.color.canvas,
        paddingTop: insets.top,
      }}
    >
      {!compact ? (
        <ScrollView
          style={{
            width: t.layout.sidebar,
            flexGrow: 0,
            flexShrink: 0,
            backgroundColor: t.color.surface,
            borderRightWidth: 1,
            borderColor: t.color.line,
          }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 18,
            paddingTop: 31,
            paddingBottom: 20,
          }}
        >
          <Interactive
            onPress={() => router.push("/")}
            accessibilityRole="link"
            accessibilityLabel="Odyssey home"
            style={{ paddingHorizontal: 12, marginBottom: 38 }}
          >
            <Row gap={10}>
              <View
                style={{
                  backgroundColor: t.color.brand,
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: "-5deg" }],
                }}
              >
                <Command size={21} color="white" />
              </View>
              <Txt size={23} weight="bold" style={{ letterSpacing: -0.9 }}>
                odyssey
                <Txt size={23} color={t.color.orange}>
                  .
                </Txt>
              </Txt>
            </Row>
          </Interactive>
          <Interactive
            accessibilityRole="button"
            accessibilityLabel="Restaurant details"
            onPress={() => setRestaurantDetailsVisible(true)}
            style={{
              borderWidth: 1,
              borderColor: t.color.line,
              borderRadius: 10,
              padding: 12,
              marginBottom: 32,
            }}
          >
            <Row gap={9}>
              <View style={{ padding: 8, backgroundColor: "#F8EEE2", borderRadius: 8 }}>
                <Leaf size={17} color="#A67A43" />
              </View>
              <Stack gap={0} style={{ flex: 1 }}>
                <Txt size={11} weight="semibold" lines={1}>
                  {settingsQuery.data?.restaurantName ?? "Olive & Ember"}
                </Txt>
                <Txt size={9} color={t.color.muted}>
                  Restaurant workspace
                </Txt>
              </Stack>
              <ChevronDown size={13} color={t.color.muted} />
            </Row>
          </Interactive>
          <Txt
            size={9}
            weight="semibold"
            color={t.color.subtle}
            style={{ letterSpacing: 1.4, paddingHorizontal: 16, marginBottom: 11 }}
          >
            WORKSPACE
          </Txt>
          <Stack gap={6}>
            {navigation.map((route) => (
              <NavItem key={route.path} {...route} active={currentPath === route.path} />
            ))}
          </Stack>
          <View
            style={{
              marginTop: 31,
              marginBottom: 12,
              marginHorizontal: 15,
              height: 1,
              backgroundColor: t.color.line,
            }}
          />
          <NavItem
            path="/ui-library"
            label="UI Library"
            icon={Layers3}
            active={currentPath === "/ui-library"}
          />
          <View style={{ flex: 1, minHeight: 30 }} />
          <Card
            padding={15}
            style={{ backgroundColor: "#F6F8F2", borderColor: "#E9EDDE", marginBottom: 22 }}
          >
            <Stack gap={10}>
              <View
                style={{
                  alignSelf: "flex-start",
                  padding: 8,
                  borderRadius: 9,
                  backgroundColor: "#E8EDD9",
                }}
              >
                <BookOpen size={17} color={t.color.brand} />
              </View>
              <Txt size={12} weight="semibold">
                A little help goes a long way.
              </Txt>
              <Txt size={10} color={t.color.muted}>
                Your everyday guide to a smoother service.
              </Txt>
              <Button
                variant="secondary"
                small
                onPress={() => setHelpVisible(true)}
                icon={<ArrowUpRight size={13} color={t.color.brand} />}
              >
                Workspace guide
              </Button>
            </Stack>
          </Card>
          <Row
            gap={9}
            style={{
              borderTopWidth: 1,
              borderColor: t.color.line,
              paddingTop: 17,
              paddingHorizontal: 6,
            }}
          >
            <Avatar name="Alex Morgan" size={34} tone="orange" />
            <Stack gap={0}>
              <Txt size={12} weight="semibold">
                Alex Morgan
              </Txt>
              <Txt size={10} color={t.color.muted}>
                Restaurant manager
              </Txt>
            </Stack>
            <Badge tone="neutral">Demo</Badge>
          </Row>
        </ScrollView>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Row
          style={{
            backgroundColor: t.color.surface,
            borderBottomWidth: 1,
            borderColor: t.color.line,
            minHeight: 77,
            paddingHorizontal: compact ? t.layout.mobileGutter : t.layout.gutter,
            justifyContent: "space-between",
          }}
        >
          <Row gap={12}>
            {compact ? (
              <Command size={23} color={t.color.brand} />
            ) : (
              <Txt size={12} color={t.color.muted}>
                Workspace
              </Txt>
            )}
            {!compact ? <Txt color={t.color.subtle}>/</Txt> : null}
            <Txt size={12} weight="medium">
              {currentPageLabel}
            </Txt>
          </Row>
          <Row gap={16}>
            {width > 600 ? (
              <Badge tone={settingsQuery.data?.acceptingOrders ? "success" : "warning"} dot>
                {settingsQuery.data?.acceptingOrders
                  ? "Accepting orders"
                  : settingsQuery.data
                    ? "Orders paused"
                    : "Connecting"}
              </Badge>
            ) : null}
            <Button
              small
              icon={<Plus size={15} color="white" />}
              onPress={() => router.push("/orders?new=1")}
            >
              New order
            </Button>
            <Button
              variant="ghost"
              small
              label="Workspace help"
              icon={<CircleHelp size={18} color={t.color.muted} />}
              onPress={() => setHelpVisible(true)}
            />
          </Row>
        </Row>
        {compact ? (
          <View
            style={{
              backgroundColor: t.color.surface,
              borderBottomWidth: 1,
              borderColor: t.color.line,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ padding: 8, gap: 4 }}
            >
              {/* Keep route overflow inside the navigation strip on narrow screens. */}
              {navigation.map((route) => (
                <NavItem key={route.path} {...route} compact active={currentPath === route.path} />
              ))}
              <NavItem
                path="/ui-library"
                label="UI Library"
                icon={Layers3}
                active={currentPath === "/ui-library"}
                compact
              />
            </ScrollView>
          </View>
        ) : null}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: compact ? t.layout.mobileGutter : t.layout.gutter,
            paddingBottom: 40 + insets.bottom,
            width: "100%",
            maxWidth: t.layout.maxWidth,
            alignSelf: "center",
          }}
        >
          {/* Reset page-local form and dialog state when navigating to a different route. */}
          <View key={currentPath}>{children}</View>
          <Row wrap style={{ marginTop: 32, justifyContent: "space-between" }}>
            <Txt size={10} color={t.color.subtle}>
              A good day starts with a little order.
            </Txt>
            <Txt size={10} color={t.color.subtle}>
              Odyssey · Restaurant operations
            </Txt>
          </Row>
        </ScrollView>
      </View>
      <Dialog
        visible={isHelpVisible}
        title="Your workspace, at a glance"
        subtitle="A calmer way to run a busy restaurant."
        onClose={() => setHelpVisible(false)}
      >
        <Stack gap={20}>
          {[
            [
              "01",
              "Build your menu",
              "Add categories and dishes, set prices, and mark sold-out items unavailable.",
            ],
            [
              "02",
              "Know your guests",
              "Create a customer in Customers, then place an order for them.",
            ],
            [
              "03",
              "Keep service moving",
              "Accept → prepare → mark ready → complete. Open any order to see its full history.",
            ],
            [
              "04",
              "See the bigger picture",
              "Completed orders update revenue and customer spend. Settings control new orders.",
            ],
          ].map(([stepNumber, title, body]) => (
            <Row key={stepNumber} style={{ alignItems: "flex-start" }}>
              <Badge tone="brand">{stepNumber}</Badge>
              <Stack gap={3} style={{ flex: 1 }}>
                <Txt weight="semibold">{title}</Txt>
                <Txt size={12} color={t.color.muted}>
                  {body}
                </Txt>
              </Stack>
            </Row>
          ))}
        </Stack>
      </Dialog>
      <Dialog
        visible={isRestaurantDetailsVisible}
        title={settingsQuery.data?.restaurantName ?? "Olive & Ember"}
        subtitle="Restaurant workspace"
        onClose={() => setRestaurantDetailsVisible(false)}
      >
        <Stack gap={16}>
          <Badge tone={settingsQuery.data?.acceptingOrders ? "success" : "warning"} dot>
            {settingsQuery.data?.acceptingOrders ? "Accepting new orders" : "New orders paused"}
          </Badge>
          <Txt color={t.color.muted}>
            Manage service availability, preparation time, opening hours and ordering preferences in
            Settings.
          </Txt>
          <Button
            onPress={() => {
              setRestaurantDetailsVisible(false);
              router.push("/settings");
            }}
          >
            Open restaurant settings
          </Button>
        </Stack>
      </Dialog>
    </View>
  );
}
