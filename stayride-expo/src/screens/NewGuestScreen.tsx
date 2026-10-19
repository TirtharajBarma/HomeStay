import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { api } from '../data/api';
import { Header } from '../components/Header';
import { Colors } from '../theme/colors';
import { FormScroll } from '../components/FormScroll';

export const NewGuestScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: { guestId?: number } }, 'params'>>();
  const { guestId } = route.params || {};

  const { guests, createGuest, updateGuest } = useStayRide();
  // Leaving this form ends the submission: a reopened form gets a fresh Idempotency-Key
  useEffect(() => () => api.clearIdempotencyKeys('/guests'), []);

  const editingGuest = guestId ? guests.find((g) => g.id === guestId) : null;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  // Marketing is opt-in: the owner switches it on only when the guest agrees
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (editingGuest) {
      setName(editingGuest.name);
      setPhone(editingGuest.phone);
      setEmail(editingGuest.email || '');
      setNotes(editingGuest.notes || '');
      setConsent(editingGuest.marketingConsent);
    }
  }, [editingGuest]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Alert.alert('Required', 'Name is required');
      return;
    }
    if (!trimmedPhone) {
      Alert.alert('Required', 'Phone number is required');
      return;
    }

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
      Alert.alert('Success', 'Guest updated', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      try {
        await createGuest({
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
      Alert.alert('Success', `${trimmedName} added to guest database`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={editingGuest ? 'Edit guest' : 'Add guest'}
        onBack={() => navigation.goBack()}
      />

      <FormScroll contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Rahul Sharma"
          placeholderTextColor={Colors.textSecondary}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="+91 98000 00000"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="rahul@example.com"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Preferences, family details, special requests..."
          placeholderTextColor={Colors.textSecondary}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.switchTitle}>Allow WhatsApp & marketing offers</Text>
            <Text style={styles.switchSub}>
              Guest will be included in targeted WhatsApp broadcast campaigns.
            </Text>
          </View>
          <Switch
            value={consent}
            onValueChange={setConsent}
            trackColor={{ false: '#D1D5DB', true: Colors.brandPrimaryLight }}
            thumbColor={consent ? Colors.brandPrimary : '#9CA3AF'}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>
            {editingGuest ? 'Update guest' : 'Add guest to database'}
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
    paddingTop: 14,
    paddingBottom: 36,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  switchSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
