import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Colors, Radii } from '../theme/colors';
import { useStayRide } from '../data/store';
import { FeatureKey } from '../types';

interface FeatureLockedProps {
  feature: FeatureKey;
  title: string;
}

// Shown when StayRide has switched a feature off for this homestay. The server still enforces the switch;
// this card only explains it and lets the owner ask for access (POST /appeals).
export const FeatureLocked: React.FC<FeatureLockedProps> = ({ feature, title }) => {
  const { requestFeature } = useStayRide();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      Alert.alert('Reason needed', 'Please provide a reason why you need this feature.');
      return;
    }
    setSending(true);
    const outcome = await requestFeature(feature, reason.trim());
    setSending(false);
    if (!outcome.ok) {
      Alert.alert('Could not send request', outcome.error || 'Please try again.');
      return;
    }
    setOpen(false);
    setReason('');
    Alert.alert('Request sent', 'Platform admin will review your request.');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>This feature is currently not enabled for your homestay.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)}>
        <Text style={styles.btnText}>Request access</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.title}>Request access</Text>
            <Text style={styles.body}>Why do you need {title.toLowerCase()}?</Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason"
              multiline
              maxLength={500}
            />
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.cancel} disabled={sending}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submit} style={styles.btn} disabled={sending}>
                {sending ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.statusOrangeBg,
    borderRadius: Radii.card,
    padding: 16,
    margin: 16,
  },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  body: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  btn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: Colors.brandPrimary,
    borderRadius: Radii.button,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnText: { color: Colors.white, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: Colors.bgCard, borderRadius: Radii.dialog, padding: 20 },
  input: {
    marginTop: 12,
    minHeight: 80,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radii.button,
    padding: 10,
    textAlignVertical: 'top',
    color: Colors.textPrimary,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  cancel: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 10 },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
});
