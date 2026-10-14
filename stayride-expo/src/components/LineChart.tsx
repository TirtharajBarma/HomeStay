import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Text as SvgText, Line } from 'react-native-svg';
import { Colors } from '../theme/colors';

interface LineChartProps {
  labels: string[];
  values: number[];
  height?: number;
  isCurrency?: boolean;
}

export const LineChart: React.FC<LineChartProps> = ({
  labels,
  values,
  height = 170,
  isCurrency = false,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const width = screenWidth - 56; // Accounting for card and screen padding

  if (!values || values.length === 0) {
    return <View style={[styles.container, { height }]} />;
  }

  const paddingTop = 20;
  const paddingBottom = 28;
  const paddingLeft = 36;
  const paddingRight = 16;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...values, 10);
  const minVal = Math.min(0, Math.min(...values));
  const range = maxVal - minVal || 1;

  // Generate points
  const points = values.map((val, idx) => {
    const x = paddingLeft + (idx / (values.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((val - minVal) / range) * chartHeight;
    return { x, y, val };
  });

  // Build Bézier Curve Path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) / 2;
    const cp2y = p1.y;
    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }

  // Fill area under path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

  // Format numbers (e.g. 248k or 248)
  const formatVal = (v: number) => {
    if (v >= 100000) return `${Math.round(v / 1000)}k`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return `${Math.round(v)}`;
  };

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="gradientFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.brandPrimary} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={Colors.brandPrimary} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio, i) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const gridVal = minVal + range * ratio;
          return (
            <React.Fragment key={i}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke={Colors.divider}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 4}
                fontSize={9}
                fill={Colors.textSecondary}
                textAnchor="end"
              >
                {isCurrency ? `₹${formatVal(gridVal)}` : formatVal(gridVal)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Area fill */}
        <Path d={areaD} fill="url(#gradientFill)" />

        {/* Spline stroke */}
        <Path d={pathD} fill="none" stroke={Colors.brandPrimary} strokeWidth={2.5} />

        {/* Data points & X Labels */}
        {points.map((pt, i) => (
          <React.Fragment key={i}>
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill={Colors.white}
              stroke={Colors.brandPrimary}
              strokeWidth={2}
            />
            {labels[i] && (
              <SvgText
                x={pt.x}
                y={height - 8}
                fontSize={10}
                fill={Colors.textSecondary}
                textAnchor="middle"
              >
                {labels[i]}
              </SvgText>
            )}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
});
