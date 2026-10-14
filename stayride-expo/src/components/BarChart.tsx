import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { Colors } from '../theme/colors';

interface BarChartProps {
  labels: string[];
  values: number[];
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({ labels, values, height = 160 }) => {
  const screenWidth = Dimensions.get('window').width;
  const width = screenWidth - 56;

  const paddingTop = 16;
  const paddingBottom = 26;
  const paddingLeft = 34;
  const paddingRight = 14;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...values, 10);
  const barWidth = Math.min(24, (chartWidth / values.length) * 0.55);

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {/* Baseline */}
        <Line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={width - paddingRight}
          y2={paddingTop + chartHeight}
          stroke={Colors.divider}
          strokeWidth={1}
        />

        {values.map((val, idx) => {
          const barHeight = (val / maxVal) * chartHeight;
          const x =
            paddingLeft +
            idx * (chartWidth / values.length) +
            (chartWidth / values.length - barWidth) / 2;
          const y = paddingTop + chartHeight - barHeight;

          return (
            <React.Fragment key={idx}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={6}
                fill={idx % 2 === 0 ? Colors.brandPrimary : Colors.brandPrimaryDark}
              />
              <SvgText
                x={x + barWidth / 2}
                y={height - 8}
                fontSize={10}
                fill={Colors.textSecondary}
                textAnchor="middle"
              >
                {labels[idx] || ''}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
