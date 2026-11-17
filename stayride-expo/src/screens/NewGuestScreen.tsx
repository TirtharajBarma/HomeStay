import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useStayRide } from '../data/store';
import { api } from '../data/api';
import { Header } from '../components/Header';
import { Colors, Radii, Shadows } from '../theme/colors';
import { FormScroll } from '../components/FormScroll';

export const NewGuestScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: { guestId?: number } }, 'params'>>();
  const { guestId } = route.params || {};

  const { guests, createGuest, updateGuest } = useStayRide();
  // Leaving this form ends the submission: a reopened form gets a fresh Idempotency-Key
  useEffect(() => () => api.clearIdempotencyKeys('/guests'), []);

  const editingGuest = guestId ? guests.find((g) => g.id === guestId) : null;

  const [name, setName] = useState(() => editingGuest?.name || '');
  const [phone, setPhone] = useState(() => editingGuest?.phone || '');
  const [email, setEmail] = useState(() => editingGuest?.email || '');
  const [notes, setNotes] = useState(() => editingGuest?.notes || '');
  // Marketing is opt-in: the owner switches it on only when the guest agrees
  const [consent, setConsent] = useState(() => editingGuest?.marketingConsent ?? false);
  // Fix 6: phone validation error
  const [phoneError, setPhoneError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [syncedGuestId, setSyncedGuestId] = useState<number | undefined>(editingGuest?.id);
  if (editingGuest && editingGuest.id !== syncedGuestId) {
    setSyncedGuestId(editingGuest.id);
    setName(editingGuest.name);
    setPhone(editingGuest.phone);
    setEmail(editingGuest.email || '');
    setNotes(editingGuest.notes || '');
    setConsent(editingGuest.marketingConsent);
  }

  // Fix 6: real-time phone validation
  const handlePhoneChange = (text: string) => {
    setPhone(text);
    const digits = text.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 10) {
      setPhoneError('Enter a valid 10-digit WhatsApp number');
    } else {
      setPhoneError('');
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert('Required', 'Please enter guest full name');
      return;
    }
    if (!trimmedPhone) {
      Alert.alert('Required', 'Please enter guest phone number');
      return;
    }
    const digits = trimmedPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setPhoneError('Enter a valid 10-digit WhatsApp number');
      Alert.alert('Invalid Phone', 'Please enter a 10-digit WhatsApp number.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingGuest) {
        const outcome = await updateGuest(editingGuest.id, {
          name: trimmedName,
          phone: trimmedPhone,
          email: email.trim(),
          notes: notes.trim(),
          marketingConsent: consent,
        });
        if (!outcome.ok) {
          Alert.alert("Couldn't save", outcome.error || 'Please try again.');
          return;
        }
        Alert.alert('Success', 'Guest updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        let createdGuest: any = null;
        try {
          createdGuest = await createGuest({
            name: trimmedName,
            phone: trimmedPhone,
            email: email.trim(),
            notes: notes.trim(),
            marketingConsent: consent,
          });
        } catch (e: any) {
          Alert.alert('Not saved', e?.message || 'Please try again.');
          return;
        }
        // Fix 6: Post-save options
        Alert.alert(
          `${trimmedName} added`,
          'What would you like to do next?',
          [
            {
              text: 'Book a Room',
              onPress: () => {
                navigation.goBack();
                navigation.navigate('NewBooking', { guestId: createdGuest?.id });
              },
            },
            {
              text: 'Request a Cab',
              onPress: () => {
                navigation.goBack();
                navigation.navigate('FindDriver');
              },
            },
            { text: 'Done', style: 'cancel', onPress: () => navigation.goBack() },
          ]
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={editingGuest ? 'Edit Guest' : 'Add Guest'}
        onBack={() => navigation.goBack()}
      />

      <FormScroll contentContainerStyle={styles.scrollContent}>
        {/* Primary Contact Group */}
        <Text style={styles.sectionHeader}>PRIMARY CONTACT</Text>
        <View style={styles.cardGroup}>
          <View style={styles.fieldRow}>
            <Ionicons name="person-outline" size={18} color="#64748B" style={styles.fieldIcon} />
            <View style={styles.fieldInputContainer}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                autoFocus={!editingGuest}
              />
            </View>
          </View>

          <View style={styles.innerDivider} />

          <View style={styles.fieldRow}>
            <Ionicons name="call-outline" size={18} color="#64748B" style={styles.fieldIcon} />
            <View style={styles.fieldInputContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>WhatsApp / Mobile *</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="logo-whatsapp" size={11} color="#15803D" />
                  <Text style={styles.verifiedBadgeText}>WhatsApp</Text>
                </View>
              </View>
              <TextInput
                style={[styles.fieldInput, phoneError ? styles.inputErrorText : undefined]}
                placeholder="+91 98000 00000"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={handlePhoneChange}
              />
              {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
            </View>
          </View>
        </View>

        {/* Additional Details Group */}
        <Text style={styles.sectionHeader}>OPTIONAL DETAILS</Text>
        <View style={styles.cardGroup}>
          <View style={styles.fieldRow}>
            <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.fieldIcon} />
            <View style={styles.fieldInputContainer}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="rahul@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.innerDivider} />

          <View style={[styles.fieldRow, { alignItems: 'flex-start', paddingTop: 10 }]}>
            <Ionicons name="document-text-outline" size={18} color="#64748B" style={[styles.fieldIcon, { marginTop: 4 }]} />
            <View style={styles.fieldInputContainer}>
              <Text style={styles.inputLabel}>Notes & Preferences</Text>
              <TextInput
                style={[styles.fieldInput, styles.textArea]}
                placeholder="Food preferences, arrival details, special requests..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </View>
        </View>

        {/* Communication Consent */}
        <Text style={styles.sectionHeader}>COMMUNICATION CONSENT</Text>
        <View style={styles.cardGroup}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Ionicons name="notifications-outline" size={16} color={Colors.brandPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.switchTitle}>Allow WhatsApp & Offers</Text>
              </View>
              <Text style={styles.switchSub}>
                Guest agreed to receive booking vouchers, cab dispatch updates, and seasonal homestay offers via WhatsApp.
              </Text>
            </View>
            <Switch
              value={consent}
              onValueChange={setConsent}
              trackColor={{ false: '#CBD5E1', true: Colors.brandPrimaryLight }}
              thumbColor={consent ? Colors.brandPrimary : '#94A3B8'}
            />
          </View>
        </View>

        {/* Save CTA Button */}
        <TouchableOpacity
          style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          <Ionicons name={editingGuest ? 'checkmark-circle-outline' : 'person-add-outline'} size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.saveBtnText}>
            {isSubmitting ? 'Saving…' : editingGuest ? 'Update Guest Profile' : 'Save Guest to Homestay'}
          </Text>
        </TouchableOpacity>
      </FormScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#64748B',
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 4,
    ...Shadows.card,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  fieldIcon: {
    marginRight: 12,
  },
  fieldInputContainer: {
    flex: 1,
    minWidth: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    gap: 3,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  fieldInput: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  inputErrorText: {
    color: '#DC2626',
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  innerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 30,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  switchSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 15,
    borderRadius: Radii.button,
    marginTop: 28,
    ...Shadows.sm,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
});
