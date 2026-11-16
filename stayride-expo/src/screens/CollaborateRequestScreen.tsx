import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';
import { Header } from '../components/Header';
import { api } from '../data/api';
import { useStayRide } from '../data/store';
import { InfluencerPackage } from '../types';

export const CollaborateRequestScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { influencerId, influencerName, influencerHandle, selectedPackage, packages } =
    route.params || {};

  const { homestay, session } = useStayRide();

  // Form State
  const [chosenPackage, setChosenPackage] = useState<InfluencerPackage | null>(
    selectedPackage || (packages && packages[0]) || null
  );
  const [homestayName, setHomestayName] = useState(homestay?.name || 'My Homestay');
  const [ownerName, setOwnerName] = useState(
    homestay?.ownerName || session?.owner?.name || ''
  );
  const [ownerPhone, setOwnerPhone] = useState(
    homestay?.phone || session?.owner?.phone || ''
  );
  const [ownerEmail, setOwnerEmail] = useState(
    homestay?.email || session?.owner?.email || ''
  );
  const [proposedDates, setProposedDates] = useState('');
  const [customRequirements, setCustomRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!homestayName.trim()) {
      Alert.alert('Missing Field', 'Please enter your homestay name.');
      return;
    }
    if (!ownerName.trim()) {
      Alert.alert('Missing Field', 'Please enter your name.');
      return;
    }
    const cleanPhone = ownerPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please provide a valid 10-digit WhatsApp number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        influencerId,
        homestayName: homestayName.trim(),
        homestayLocation: homestay?.location || '',
        ownerName: ownerName.trim(),
        ownerPhone: cleanPhone,
        ownerEmail: ownerEmail.trim(),
        selectedPackage: chosenPackage || {
          name: 'Standard Promotion',
          price: 5000,
        },
        proposedDates: proposedDates.trim(),
        customRequirements: customRequirements.trim(),
      };

      await api.post('/collaboration-requests', payload);

      Alert.alert(
        'Request Submitted! 🎉',
        `Your collaboration invite for ${influencerName} has been sent. StayCabs operations will review it and coordinate the dates with both you and the creator via WhatsApp.`,
        [
          {
            text: 'Track Request',
            onPress: () => {
              navigation.navigate('Promote');
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Could not submit collaboration request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Invite to Collaborate" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Creator Header Highlight */}
        <View style={styles.creatorBanner}>
          <Ionicons name="sparkles" size={18} color="#F59E0B" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.creatorBannerTitle}>
              Inviting <Text style={{ fontWeight: '800' }}>{influencerName}</Text>
            </Text>
            <Text style={styles.creatorBannerHandle}>{influencerHandle}</Text>
          </View>
        </View>

        {/* Package Selector */}
        {packages && packages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Promotion Package</Text>
            <View style={styles.packagesWrap}>
              {packages.map((pkg: InfluencerPackage, idx: number) => {
                const isSelected = chosenPackage?.name === pkg.name;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.pkgOption, isSelected && styles.pkgOptionSelected]}
                    onPress={() => setChosenPackage(pkg)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pkgName, isSelected && styles.pkgNameSelected]}>
                        {pkg.name}
                      </Text>
                      <Text style={styles.pkgDeliverables} numberOfLines={2}>
                        {pkg.deliverables}
                      </Text>
                    </View>
                    <Text style={[styles.pkgPrice, isSelected && styles.pkgPriceSelected]}>
                      ₹{pkg.price.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Homestay Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your Property & Contact Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Homestay Name *</Text>
            <TextInput
              style={styles.textInput}
              value={homestayName}
              onChangeText={setHomestayName}
              placeholder="e.g. Pine Ridge Homestay"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Owner / Host Name *</Text>
            <TextInput
              style={styles.textInput}
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="e.g. Tenzing Norbu"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>WhatsApp Phone Number *</Text>
            <TextInput
              style={styles.textInput}
              value={ownerPhone}
              onChangeText={setOwnerPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 9876543210"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInput}
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="e.g. host@gmail.com"
            />
          </View>
        </View>

        {/* Schedule & Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Collaboration Preferences</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Preferred Dates / Timing</Text>
            <TextInput
              style={styles.textInput}
              value={proposedDates}
              onChangeText={setProposedDates}
              placeholder="e.g. Next weekend, or 15-18 Dec 2026"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Special Message or Highlights for Creator</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={customRequirements}
              onChangeText={setCustomRequirements}
              multiline
              numberOfLines={4}
              placeholder="e.g. We have organic local breakfast, valley views of Kanchenjunga, and a wooden attic room we would love you to highlight..."
            />
          </View>
        </View>

        {/* Security & Support Note */}
        <View style={styles.supportNote}>
          <Ionicons name="shield-checkmark" size={16} color="#16A34A" style={{ marginRight: 6 }} />
          <Text style={styles.supportNoteText}>
            StayCabs manages the influencer coordination, dates and verification. No upfront payment is required now.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.submitBtnText}>Submit Collaboration Request</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  creatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    borderRadius: Radii.lg,
    padding: 14,
    marginBottom: 20,
    ...Shadows.sm,
  },
  creatorBannerTitle: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  creatorBannerHandle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A5B4FC',
    marginTop: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    ...Shadows.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  packagesWrap: {
    gap: 8,
  },
  pkgOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    backgroundColor: '#F8FAFC',
  },
  pkgOptionSelected: {
    borderColor: Colors.brandPrimary,
    backgroundColor: '#F5F3FF',
    borderWidth: 2,
  },
  pkgName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  pkgNameSelected: {
    color: Colors.brandPrimary,
  },
  pkgDeliverables: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pkgPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 10,
  },
  pkgPriceSelected: {
    color: Colors.brandPrimary,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  supportNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: Radii.md,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  supportNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandPrimary,
    borderRadius: Radii.md,
    paddingVertical: 14,
    ...Shadows.md,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
