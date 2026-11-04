import { formatMoney } from "@odyssey/shared";
import type { Summary } from "@odyssey/types";
import { Badge, Button, Row, Stack, Txt, tokens as t } from "@odyssey/ui";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

/** Plot completed revenue in integer cents with touch targets and keyboard-operable day navigation. */
export function RevenueChart({ daily }: { daily: Summary["daily"] }) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  // A fixed SVG coordinate system scales with its container without widening the page.
  const width = 710;
  const height = 245;
  const left = 47;
  const top = 16;
  const bottom = 211;
  const right = 695;
  // Round the axis up to $100 steps and keep zero-revenue ranges readable.
  const maxRevenueCents = Math.max(10000, ...daily.map((day) => day.revenueCents));
  const axisCeilingCents = Math.ceil(maxRevenueCents / 10000) * 10000;
  const points = daily.map((day, index) => ({
    ...day,
    x: left + (index / Math.max(1, daily.length - 1)) * (right - left),
    y: bottom - (day.revenueCents / axisCeilingCents) * (bottom - top),
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const selectedPoint = selectedDayIndex === null ? null : points[selectedDayIndex];
  // API buckets are UTC dates; local timezone conversion would shift some day labels.
  const formatUtcDate = (value: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(`${value}T00:00:00Z`),
    );
  return (
    <Stack gap={16}>
      <Row wrap style={{ justifyContent: "space-between", minHeight: 26 }}>
        <Row gap={7}>
          <View style={{ height: 7, width: 7, borderRadius: 4, backgroundColor: t.color.brand }} />
          <Txt size={11} color={t.color.muted}>
            Completed revenue
          </Txt>
        </Row>
        <Row gap={3}>
          <Button
            small
            variant="ghost"
            label="Previous chart day"
            onPress={() =>
              setSelectedDayIndex((current) =>
                current === null ? points.length - 1 : Math.max(0, current - 1),
              )
            }
            icon={<ChevronLeft size={12} color={t.color.brand} />}
          />
          <Badge tone={selectedPoint ? "brand" : "neutral"}>
            {selectedPoint
              ? `${formatUtcDate(selectedPoint.date)} · ${formatMoney(selectedPoint.revenueCents)} · ${selectedPoint.orderCount} orders`
              : "Select a point to explore"}
          </Badge>
          <Button
            small
            variant="ghost"
            label="Next chart day"
            onPress={() =>
              setSelectedDayIndex((current) =>
                current === null ? 0 : Math.min(points.length - 1, current + 1),
              )
            }
            icon={<ChevronRight size={12} color={t.color.brand} />}
          />
        </Row>
      </Row>
      <View style={{ width: "100%", aspectRatio: width / height }}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          accessibilityLabel={`Revenue over ${daily.length} days. Select a point for daily revenue and orders.`}
        >
          <Defs>
            <LinearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.color.brand} stopOpacity={0.18} />
              <Stop offset="1" stopColor={t.color.brand} stopOpacity={0.015} />
            </LinearGradient>
          </Defs>
          {[0, 1, 2, 3, 4].map((index) => {
            const y = bottom - (index / 4) * (bottom - top);
            return (
              <G key={index}>
                <Line
                  x1={left}
                  y1={y}
                  x2={right}
                  y2={y}
                  stroke={t.color.line}
                  strokeDasharray={index ? "4 5" : undefined}
                />
                <SvgText
                  x={left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={t.color.muted}
                >{`$${Math.round(((axisCeilingCents / 100) * index) / 4)}`}</SvgText>
              </G>
            );
          })}
          {firstPoint && lastPoint ? (
            <Path
              d={`${linePath} L ${lastPoint.x} ${bottom} L ${firstPoint.x} ${bottom} Z`}
              fill="url(#revenue-fill)"
            />
          ) : null}
          <Path
            d={linePath}
            fill="none"
            stroke={t.color.brand}
            strokeWidth={2.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((point, index) => (
            <G key={point.date}>
              {selectedDayIndex === index ? (
                <Line
                  x1={point.x}
                  x2={point.x}
                  y1={top}
                  y2={bottom}
                  stroke={t.color.brand}
                  strokeOpacity={0.25}
                  strokeDasharray="4 4"
                />
              ) : null}
              <Circle
                cx={point.x}
                cy={point.y}
                r={selectedDayIndex === index ? 5 : 3}
                fill={t.color.surface}
                stroke={t.color.brand}
                strokeWidth={2}
              />
              <Rect
                x={point.x - 14}
                y={top}
                width={28}
                height={bottom - top + 8}
                fill="transparent"
                onPress={() => setSelectedDayIndex(selectedDayIndex === index ? null : index)}
                accessibilityLabel={`${formatUtcDate(point.date)}: ${formatMoney(point.revenueCents)}, ${point.orderCount} orders`}
              />
              {daily.length <= 7 ||
              index % Math.ceil(daily.length / 7) === 0 ||
              index === points.length - 1 ? (
                <SvgText
                  x={point.x}
                  y={height - 9}
                  textAnchor="middle"
                  fontSize={11}
                  fill={t.color.muted}
                >
                  {formatUtcDate(point.date)}
                </SvgText>
              ) : null}
            </G>
          ))}
        </Svg>
      </View>
    </Stack>
  );
}
