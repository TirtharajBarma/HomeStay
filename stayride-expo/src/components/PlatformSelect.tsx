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

  // iOS: Apple Liquid UI (Frosted glass sheet with smooth rounded card)
  const renderIosModal = () => (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.iosBackdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.iosLiquidSheet}>
              <BlurView intensity={90} tint="light" style={styles.iosBlurContainer}>
                {label && (
                  <View style={styles.iosHeader}>
                    <Text style={styles.iosHeaderTitle}>{label}</Text>
                    <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.iosDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <ScrollView
                  style={styles.iosList}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {options.map((opt, idx) => {
                    const isSelected = opt.value === value;
                    const isLast = idx === options.length - 1;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.iosOptionRow, !isLast && styles.iosOptionBorder]}
                        onPress={() => handleChoose(opt.value)}
                        activeOpacity={0.6}
                      >
                        {opt.icon && (
                          <View style={styles.optionIconContainer}>
                            <Ionicons
                              name={opt.icon}
                              size={18}
                              color={isSelected ? Colors.brandPrimary : Colors.textSecondary}
                            />
                          </View>
                        )}
                        <View style={styles.optionTextContainer}>
                          <Text
                            style={[
                              styles.iosOptionText,
                              isSelected && styles.iosOptionTextSelected,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {opt.subLabel && (
                            <Text style={styles.iosSubLabel}>{opt.subLabel}</Text>
                          )}
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={Colors.brandPrimary}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </BlurView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  // Android: Material UI 3 (Elevated Bottom Sheet with drag handle & radio buttons)
  const renderAndroidModal = () => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.androidBackdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.androidSheet}>
              {/* Material 3 Drag Handle */}
              <View style={styles.androidHandleBar}>
                <View style={styles.androidHandle} />
              </View>

              {label && <Text style={styles.androidHeaderTitle}>{label}</Text>}

              <ScrollView
                style={styles.androidList}
                showsVerticalScrollIndicator={false}
              >
                {options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.androidOptionRow,
                        isSelected && styles.androidOptionRowSelected,
                      ]}
                      onPress={() => handleChoose(opt.value)}
                      activeOpacity={0.7}
                    >
                      {opt.icon && (
                        <Ionicons
                          name={opt.icon}
                          size={20}
                          color={isSelected ? Colors.brandPrimary : Colors.textSecondary}
                          style={{ marginRight: 14 }}
                        />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.androidOptionText,
                            isSelected && styles.androidOptionTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {opt.subLabel && (
                          <Text style={styles.androidSubLabel}>{opt.subLabel}</Text>
                        )}
                      </View>

                      {/* Material Radio Circle */}
                      <View
                        style={[
                          styles.materialRadio,
                          isSelected && styles.materialRadioSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.materialRadioInner} />}
                      </View>
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
      {Platform.OS === 'ios' ? renderIosModal() : renderAndroidModal()}
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

  // iOS Liquid UI Styles
  iosBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 32,
  },
  iosLiquidSheet: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  iosBlurContainer: {
    padding: 18,
    maxHeight: 380,
  },
  iosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    marginBottom: 4,
  },
  iosHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  iosDoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brandPrimary,
  },
  iosList: {
    maxHeight: 300,
  },
  iosOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 4,
  },
  iosOptionBorder: {
    borderBottomWidth: 0.8,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  iosOptionText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  iosOptionTextSelected: {
    color: Colors.brandPrimaryDark,
    fontWeight: '700',
  },
  iosSubLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  optionIconContainer: {
    width: 28,
    alignItems: 'center',
    marginRight: 10,
  },
  optionTextContainer: {
    flex: 1,
  },

  // Android Material 3 Styles
  androidBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  androidSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: 440,
    elevation: 16,
  },
  androidHandleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  androidHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  androidHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  androidList: {
    maxHeight: 340,
  },
  androidOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  androidOptionRowSelected: {
    backgroundColor: Colors.brandPrimaryLight,
  },
  androidOptionText: {
    fontSize: 15,
    color: '#1F2937',
  },
  androidOptionTextSelected: {
    color: Colors.brandPrimaryDark,
    fontWeight: '700',
  },
  androidSubLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  materialRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  materialRadioSelected: {
    borderColor: Colors.brandPrimary,
  },
  materialRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brandPrimary,
  },
});
