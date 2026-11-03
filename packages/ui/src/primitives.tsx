import { initials } from "@odyssey/shared";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Search,
  X,
} from "lucide-react-native";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable as NativePressable,
  Platform,
  type PressableProps,
  type PressableStateCallbackType,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { type Tone, tokens as t, tones } from "./tokens";

export function Interactive({
  style,
  ...props
}: Omit<PressableProps, "style"> & {
  style?:
    | StyleProp<ViewStyle>
    | ((state: PressableStateCallbackType & { hovered: boolean }) => StyleProp<ViewStyle>);
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <NativePressable
      {...props}
      aria-checked={props["aria-checked"] ?? props.accessibilityState?.checked}
      aria-disabled={props["aria-disabled"] ?? props.accessibilityState?.disabled}
      aria-expanded={props["aria-expanded"] ?? props.accessibilityState?.expanded}
      aria-selected={props["aria-selected"] ?? props.accessibilityState?.selected}
      aria-busy={props["aria-busy"] ?? props.accessibilityState?.busy}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      onHoverIn={(event) => {
        setHovered(true);
        props.onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        props.onHoverOut?.(event);
      }}
      style={(state) => [
        typeof style === "function" ? style({ ...state, hovered }) : style,
        focused && Platform.OS === "web"
          ? {
              outlineWidth: 2,
              outlineColor: t.color.brand,
              outlineOffset: 3,
              outlineStyle: "solid",
            }
          : null,
      ]}
    />
  );
}
const Pressable = Interactive;

export function Txt({
  children,
  size = 14,
  weight = "regular",
  color = t.color.ink,
  style,
  lines,
  testID,
}: {
  children?: ReactNode;
  size?: number;
  weight?: keyof typeof t.font;
  color?: string;
  style?: TextStyle;
  lines?: number;
  testID?: string;
}) {
  return (
    <Text
      testID={testID}
      numberOfLines={lines}
      style={[
        { fontFamily: t.font[weight], fontSize: size, color, lineHeight: size * 1.5, minWidth: 0 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Row({
  children,
  gap = 12,
  style,
  wrap = false,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
}) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Stack({
  children,
  gap = 16,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}
export function Card({
  children,
  style,
  padding = 24,
}: {
  children: ReactNode;
  style?: ViewStyle;
  padding?: number;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: t.color.surface,
          borderWidth: 1,
          borderColor: t.color.line,
          borderRadius: t.radius.lg,
          padding,
          boxShadow: t.shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  children,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  loading = false,
  small = false,
  style,
  label,
}: {
  children?: ReactNode;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle;
  label?: string;
}) {
  const primary = variant === "primary";
  const danger = variant === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? (typeof children === "string" ? children : undefined)}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        {
          minHeight: small ? 34 : 42,
          paddingHorizontal: small ? 12 : 16,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: primary
            ? t.color.brand
            : danger
              ? t.color.dangerSoft
              : variant === "ghost"
                ? "transparent"
                : t.color.line,
          backgroundColor: primary
            ? hovered
              ? t.color.brandHover
              : t.color.brand
            : danger
              ? t.color.dangerSoft
              : hovered
                ? t.color.soft
                : variant === "ghost"
                  ? "transparent"
                  : t.color.surface,
          opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? t.color.white : t.color.brand} />
      ) : (
        icon
      )}
      {children ? (
        <Txt
          size={small ? 12 : 13}
          weight="semibold"
          color={primary ? t.color.white : danger ? t.color.danger : t.color.ink}
        >
          {children}
        </Txt>
      ) : null}
    </Pressable>
  );
}
export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  const colors = tones[tone];
  return (
    <Row
      gap={6}
      style={{
        backgroundColor: colors.bg,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: t.radius.sm,
        alignSelf: "flex-start",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      {dot ? (
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.fg }} />
      ) : null}
      <Txt size={11} weight="medium" color={colors.fg} lines={1} style={{ flexShrink: 1 }}>
        {children}
      </Txt>
    </Row>
  );
}
export function Avatar({
  name,
  size = 36,
  tone = "brand",
}: {
  name: string;
  size?: number;
  tone?: Tone;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tones[tone].bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt size={size * 0.34} weight="semibold" color={tones[tone].fg}>
        {initials(name)}
      </Txt>
    </View>
  );
}
export function Field({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  const { width } = useWindowDimensions();
  return (
    <Stack gap={6} style={{ flex: 1 }}>
      {label ? (
        <Txt size={12} weight="medium">
          {label}
        </Txt>
      ) : null}
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={t.color.subtle}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          {
            minHeight: 43,
            borderWidth: 1,
            borderColor: error ? t.color.danger : focused ? t.color.brand : t.color.line,
            borderRadius: t.radius.md,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: t.color.ink,
            backgroundColor: props.editable === false ? t.color.soft : t.color.surface,
            fontFamily: t.font.regular,
            fontSize: width < 600 ? 16 : 13,
          },
          style,
        ]}
      />
      {error || hint ? (
        <Txt size={11} color={error ? t.color.danger : t.color.muted}>
          {error ?? hint}
        </Txt>
      ) : null}
    </Stack>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Search...",
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}) {
  const { width } = useWindowDimensions();
  return (
    <Row
      gap={8}
      style={[
        {
          borderWidth: 1,
          borderColor: t.color.line,
          borderRadius: t.radius.md,
          backgroundColor: t.color.surface,
          paddingHorizontal: 12,
          minHeight: 41,
        },
        style,
      ]}
    >
      <Search size={16} color={t.color.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={t.color.subtle}
        value={value}
        onChangeText={onChange}
        style={{
          flex: 1,
          minWidth: 0,
          paddingVertical: 10,
          fontFamily: t.font.regular,
          fontSize: width < 600 ? 16 : 13,
          color: t.color.ink,
        }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChange("")}
        >
          <X size={14} color={t.color.muted} />
        </Pressable>
      ) : null}
    </Row>
  );
}
export function Toggle({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{
        width: 36,
        height: 21,
        borderRadius: 12,
        padding: 3,
        backgroundColor: value ? t.color.brand : "#D5DDDA",
        opacity: disabled ? 0.5 : 1,
        alignItems: value ? "flex-end" : "flex-start",
      }}
    >
      <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: t.color.white }} />
    </Pressable>
  );
}
let dialogCount = 0;
const openDialogs: string[] = [];
export function Dialog({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const padding = width < 400 ? 16 : 24;
  const [id] = useState(() => `odyssey-dialog-${++dialogCount}`);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasVisible = useRef(false);
  if (Platform.OS === "web" && visible && !wasVisible.current)
    previousFocus.current = document.activeElement as HTMLElement | null;
  wasVisible.current = visible;
  const restoreFocus = () => {
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
  };
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    openDialogs.push(id);
    const previous = previousFocus.current;
    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      if (openDialogs[openDialogs.length - 1] !== id || el?.contains(document.activeElement))
        return;
      (
        (el?.querySelector("input, textarea") ??
          el?.querySelector("button:not(:disabled), [tabindex='0']")) as HTMLElement | null
      )?.focus();
    }, 0);
    const handler = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (!event.repeat) closeRef.current();
      }
      if (event.key !== "Tab") return;
      const nodes = document
        .getElementById(id)
        ?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), textarea, [tabindex='0']",
        );
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handler);
      const index = openDialogs.indexOf(id);
      if (index >= 0) openDialogs.splice(index, 1);
      // Wait for the native modal's focus trap to unmount before restoring focus.
      setTimeout(() => {
        if (previous?.isConnected) previous.focus();
      }, 0);
    };
  }, [visible, id]);
  return (
    <Modal
      visible={visible}
      transparent
      // Web's fade activates the new focus trap only after the animation ends.
      // Immediate activation prevents the previous dialog from stealing typed input.
      animationType={Platform.OS === "web" ? "none" : "fade"}
      // The web stack handles Escape on keydown; RN Web also closes on keyup.
      onRequestClose={Platform.OS === "web" ? undefined : onClose}
      onDismiss={restoreFocus}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          backgroundColor: "rgba(13, 34, 27, 0.38)",
        }}
      >
        <Pressable
          onPress={onClose}
          accessibilityLabel="Dismiss dialog"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          nativeID={id}
          role="dialog"
          aria-modal
          accessibilityLabel={title}
          style={{
            width: Math.min(width - 32, wide ? 900 : 520),
            maxHeight: height - 64,
            backgroundColor: t.color.surface,
            borderRadius: t.radius.xl,
            boxShadow: t.shadow.floating,
            overflow: "hidden",
          }}
        >
          <Row
            style={{
              padding,
              borderBottomWidth: 1,
              borderColor: t.color.line,
              justifyContent: "space-between",
            }}
          >
            <Stack gap={3} style={{ flex: 1 }}>
              <Txt size={21} weight="semibold">
                {title}
              </Txt>
              {subtitle ? (
                <Txt size={12} color={t.color.muted}>
                  {subtitle}
                </Txt>
              ) : null}
            </Stack>
            <Button
              variant="ghost"
              label="Close dialog"
              icon={<X size={20} color={t.color.muted} />}
              onPress={onClose}
            />
          </Row>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding }}>
            {children}
          </ScrollView>
          {footer ? (
            <Row
              style={{
                padding: width < 400 ? 16 : 20,
                width: "100%",
                borderTopWidth: 1,
                borderColor: t.color.line,
                justifyContent: "flex-end",
                backgroundColor: "#FCFDFC",
              }}
            >
              {footer}
            </Row>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = "Select",
}: {
  label?: string;
  value: string;
  options: { label: string; value: string; description?: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Stack gap={6} style={{ maxWidth: "100%", minWidth: label ? 0 : 130 }}>
      {label ? (
        <Txt size={12} weight="medium">
          {label}
        </Txt>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          label
            ? `${label}: ${options.find((o) => o.value === value)?.label ?? placeholder}`
            : (options.find((o) => o.value === value)?.label ?? placeholder)
        }
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ hovered }) => ({
          minHeight: 42,
          minWidth: 0,
          borderWidth: 1,
          borderColor: t.color.line,
          backgroundColor: hovered ? t.color.soft : t.color.surface,
          borderRadius: t.radius.md,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        })}
      >
        <Txt size={12} lines={1} style={{ flex: 1, minWidth: 0 }}>
          {options.find((o) => o.value === value)?.label ?? placeholder}
        </Txt>
        <ChevronDown size={14} color={t.color.muted} />
      </Pressable>
      <Dialog visible={open} title={label ?? "Select an option"} onClose={() => setOpen(false)}>
        <Stack gap={4}>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={option.label}
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={({ hovered }) => ({
                flexDirection: "row",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 8,
                backgroundColor:
                  option.value === value
                    ? t.color.brandSoft
                    : hovered
                      ? t.color.soft
                      : t.color.surface,
              })}
            >
              <Stack gap={2} style={{ flex: 1 }}>
                <Txt>{option.label}</Txt>
                {option.description ? (
                  <Txt size={11} color={t.color.muted}>
                    {option.description}
                  </Txt>
                ) : null}
              </Stack>
              {option.value === value ? <Check size={18} color={t.color.brand} /> : null}
            </Pressable>
          ))}
        </Stack>
      </Dialog>
    </Stack>
  );
}
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <Stack gap={12} style={{ alignItems: "center", padding: 44 }}>
      <View style={{ padding: 18, borderRadius: 40, backgroundColor: t.color.brandSoft }}>
        <Inbox size={28} color={t.color.brand} />
      </View>
      <Txt size={17} weight="semibold">
        {title}
      </Txt>
      <Txt size={13} color={t.color.muted} style={{ textAlign: "center", maxWidth: 330 }}>
        {message}
      </Txt>
      {action}
    </Stack>
  );
}
export function Banner({
  message,
  tone = "danger",
  onRetry,
}: {
  message: string;
  tone?: Tone;
  onRetry?: () => void;
}) {
  return (
    <Row
      style={{
        padding: 14,
        borderRadius: t.radius.md,
        backgroundColor: tones[tone].bg,
        alignItems: "flex-start",
      }}
    >
      <AlertCircle size={18} color={tones[tone].fg} />
      <Txt size={13} color={tones[tone].fg} style={{ flex: 1 }}>
        {message}
      </Txt>
      {onRetry ? (
        <Button small variant="secondary" onPress={onRetry}>
          Try again
        </Button>
      ) : null}
    </Row>
  );
}
export function Skeleton({
  width = "100%",
  height = 18,
}: {
  width?: ViewStyle["width"];
  height?: number;
}) {
  return (
    <View
      accessibilityLabel="Loading"
      style={{ width, height, backgroundColor: t.color.soft, borderRadius: t.radius.sm }}
    />
  );
}
export function LoadingState() {
  return (
    <Stack gap={20}>
      <Row gap={20}>
        {[1, 2, 3].map((key) => (
          <Card key={key} style={{ flex: 1 }}>
            <Stack gap={16}>
              <Skeleton width="50%" />
              <Skeleton height={36} />
              <Skeleton width="70%" />
            </Stack>
          </Card>
        ))}
      </Row>
      <Card>
        <Stack gap={24}>
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} height={32} />
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
export type Column<T> = { title: string; flex?: number; render: (row: T) => ReactNode };
export function DataTable<T>({
  rows,
  columns,
  keyOf,
  onRowPress,
  minWidth = 680,
}: {
  rows: T[];
  columns: Column<T>[];
  keyOf: (row: T) => string;
  onRowPress?: (row: T) => void;
  minWidth?: number;
}) {
  return (
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flex: 1, minWidth }}>
        <Row
          gap={12}
          style={{
            paddingHorizontal: 24,
            paddingVertical: 12,
            backgroundColor: "#FAFBFA",
            borderBottomWidth: 1,
            borderColor: t.color.line,
          }}
        >
          {columns.map((column) => (
            <View key={column.title} style={{ flex: column.flex ?? 1 }}>
              <Txt
                size={10}
                weight="semibold"
                color={t.color.muted}
                style={{ textTransform: "uppercase", letterSpacing: 0.8 }}
              >
                {column.title}
              </Txt>
            </View>
          ))}
        </Row>
        {rows.map((row) => (
          <Pressable
            key={keyOf(row)}
            accessibilityRole={onRowPress ? "button" : undefined}
            onPress={() => onRowPress?.(row)}
            style={({ hovered }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 24,
              paddingVertical: 17,
              borderBottomWidth: 1,
              borderColor: t.color.line,
              backgroundColor: hovered && onRowPress ? "#F8FBF9" : t.color.surface,
            })}
          >
            {columns.map((column) => (
              <View key={column.title} style={{ flex: column.flex ?? 1, minWidth: 0 }}>
                {column.render(row)}
              </View>
            ))}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  return (
    <Row
      wrap
      style={{ justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16 }}
    >
      <Txt size={11} color={t.color.muted}>
        {total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}` : "0"} of{" "}
        {total} results
      </Txt>
      <Row gap={8}>
        <Button
          variant="secondary"
          small
          disabled={page <= 1}
          label="Previous page"
          icon={<ChevronLeft size={14} color={t.color.muted} />}
          onPress={() => onChange(page - 1)}
        />
        <Txt size={11} color={t.color.muted}>
          {page} / {totalPages}
        </Txt>
        <Button
          variant="secondary"
          small
          disabled={page >= totalPages}
          label="Next page"
          icon={<ChevronRight size={14} color={t.color.muted} />}
          onPress={() => onChange(page + 1)}
        />
      </Row>
    </Row>
  );
}
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={(message, tone = "success") => setToast({ message, tone })}>
      {children}
      {toast ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            right: 24,
            bottom: 24,
            left: Platform.OS === "web" ? undefined : 24,
            maxWidth: Math.min(440, width - 48),
            padding: 16,
            borderRadius: t.radius.lg,
            backgroundColor: t.color.ink,
            boxShadow: t.shadow.floating,
          }}
        >
          <Row>
            <CheckCircle2 size={18} color={toast.tone === "danger" ? "#FEBBBB" : "#A6D5B5"} />
            <Txt color={t.color.white} size={13} style={{ flex: 1 }}>
              {toast.message}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              onPress={() => setToast(null)}
            >
              <X size={16} color={t.color.white} />
            </Pressable>
          </Row>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
