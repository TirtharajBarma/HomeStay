import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Colors, Radii, Shadows } from '../theme/colors';

export interface SelectOption {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  subLabel?: string;
}

interface PlatformSelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const PlatformSelect: React.FC<PlatformSelectProps> = ({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select an option',
  disabled = false,
}) => {
  const [visible, setVisible] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  const handleOpen = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    setVisible(true);
  };

  const handleClose = () => {
    setVisible(false);
  };

  const handleChoose = (optValue: string) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync().catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onSelect(optValue);
    setVisible(false);
  };

  const renderTrigger = () => (
    <TouchableOpacity
      style={[styles.trigger, disabled && styles.triggerDisabled]}
      onPress={handleOpen}
      activeOpacity={0.7}
      disabled={disabled}
    >
      {selectedOption?.icon && (
        <Ionicons
          name={selectedOption.icon}
          size={18}
          color={Colors.brandPrimary}
          style={styles.triggerIcon}
        />
      )}
      <Text
        style={[
          styles.triggerText,
          !selectedOption && styles.triggerPlaceholder,
        ]}
        numberOfLines={1}
      >
        {selectedOption ? selectedOption.label : placeholder}
      </Text>
      <Ionicons
        name="chevron-down"
        size={18}
        color={Colors.textSecondary}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );

  // iOS & Android: Authentic Native Bottom Sheet (Apple HIG & Material 3 compliant)
  const renderNativeSheet = () => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.sheetBackdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.nativeSheetContainer}>
              {/* Native Drag Indicator Pill */}
              <View style={styles.handleBar}>
                <View style={styles.dragHandle} />
              </View>

              {/* Sheet Header */}
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetHeaderTitle}>{label || placeholder}</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.doneBtn}
                >
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Options List */}
              <ScrollView
                style={styles.optionsList}
                contentContainerStyle={styles.optionsListContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {options.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isLast = idx === options.length - 1;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.optionRow,
                        isSelected && styles.optionRowSelected,
                        !isLast && styles.optionRowBorder,
                      ]}
                      onPress={() => handleChoose(opt.value)}
                      activeOpacity={0.7}
                    >
                      {opt.icon && (
                        <View style={[styles.optionIconBox, isSelected && styles.optionIconBoxSelected]}>
                          <Ionicons
                            name={opt.icon}
                            size={18}
                            color={isSelected ? Colors.brandPrimaryDark : Colors.textSecondary}
                          />
                        </View>
                      )}
                      <View style={styles.optionTextBox}>
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {opt.subLabel ? (
                          <Text style={styles.optionSubLabel}>{opt.subLabel}</Text>
                        ) : null}
                      </View>
                      {isSelected ? (
                        <View style={styles.checkIconBox}>
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={Colors.brandPrimary}
                          />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.fieldLabel}>{label}</Text>}
      {renderTrigger()}
      {renderNativeSheet()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radii.button,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Shadows.card,
  },
  triggerDisabled: {
    opacity: 0.6,
    backgroundColor: '#F3F4F6',
  },
  triggerIcon: {
    marginRight: 8,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  triggerPlaceholder: {
    color: Colors.textSecondary,
  },
  chevron: {
    marginLeft: 8,
  },

  // Native Bottom Sheet Styles (Apple HIG + Material 3)
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  nativeSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  sheetHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    letterSpacing: -0.3,
  },
  doneBtn: {
    paddingLeft: 12,
    paddingVertical: 4,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brandPrimary,
  },
  optionsList: {
    maxHeight: 380,
  },
  optionsListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  optionRowSelected: {
    backgroundColor: '#F5F3FF',
  },
  optionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  optionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIconBoxSelected: {
    backgroundColor: '#EDE9FE',
  },
  optionTextBox: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
  },
  optionLabelSelected: {
    color: Colors.brandPrimaryDark,
    fontWeight: '700',
  },
  optionSubLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checkIconBox: {
    marginLeft: 10,
  },
});
