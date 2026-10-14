import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { Colors } from '../theme/colors';

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: Slice[];
  size?: number;
  centerText?: string;
  centerSub?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  size = 140,
  centerText,
  centerSub,
}) => {
  const total = slices.reduce((acc, s) => acc + s.value, 0) || 1;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {slices.map((slice, i) => {
              const strokeDashoffset = circumference - (slice.value / total) * circumference;
              const rotation = (accumulatedPercent * 360) / total;
              accumulatedPercent += slice.value;

              return (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  fill="transparent"
                  origin={`${size / 2}, ${size / 2}`}
                  rotation={rotation}
                />
              );
            })}
          </G>
        </Svg>
        <View style={styles.centerLabel}>
          {centerText && <Text style={styles.centerText}>{centerText}</Text>}
          {centerSub && <Text style={styles.centerSub}>{centerSub}</Text>}
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map((slice, idx) => (
          <View key={idx} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
            <Text style={styles.legendText}>
              {slice.label} ({Math.round((slice.value / total) * 100)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  centerSub: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  legend: {
    marginLeft: 16,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
