import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { Pill } from '../components/Pill';
import { PlatformSelect } from '../components/PlatformSelect';
import { Colors } from '../theme/colors';
import { Campaign } from '../types';

const AUDIENCE_OPTIONS = [
  { label: 'All Opted-in Guests', value: 'All guests', icon: 'people-outline' as const, subLabel: 'Entire guestbook with WhatsApp consent' },
  { label: 'Repeat Guests (2+ stays)', value: 'Repeat guests', icon: 'repeat-outline' as const, subLabel: 'Guests who have booked more than once' },
  { label: 'Recent Guests (last 60 days)', value: 'Recent guests', icon: 'time-outline' as const, subLabel: 'Stayed recently and warm to rebook' },
  { label: 'Inactive Guests (90+ days ago)', value: 'Inactive guests', icon: 'moon-outline' as const, subLabel: 'Re-engage guests who haven\'t stayed recently' },
];

const AUDIENCES = ['All guests', 'Repeat guests', 'Recent guests', 'Inactive guests'];

export const CampaignScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { campaigns, guests, createCampaign, sendCampaign, homestay } = useStayRide();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState(AUDIENCES[0]);
  const [title, setTitle] = useState(`Special holiday stay at ${homestay.name || 'our homestay'}`);
  const [message, setMessage] = useState(
    `Hi {name}! Plan your next mountain holiday at ${homestay.name || 'our homestay'} with 15% off and a free pickup. Book on StayRide.`
  );

  const consentCount = guests.filter((g) => g.marketingConsent).length;

  const countForAudience = (aud: string) => {
    switch (aud) {
      case 'Repeat guests':
        return guests.filter((g) => g.marketingConsent && g.visits > 1).length;
      case 'Recent guests':
        return guests.filter((g) => g.marketingConsent && g.visits === 1).length;
      case 'Inactive guests':
        return Math.max(1, Math.floor(consentCount / 3));
      default:
        return consentCount;
    }
  };

  const handleCampaignPress = (c: Campaign) => {
    if (c.status === 'CREATED') {
      Alert.alert(
        'Send campaign?',
        `Mark “${c.title}” as sent? Automatic WhatsApp delivery is not connected yet, so no messages will go out.`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Mark as sent',
            onPress: async () => {
              try {
                await sendCampaign(c.id);
              } catch (e: any) {
                Alert.alert('Not saved', e?.message || 'Please try again.');
                return;
              }
              Alert.alert('Campaign Updated', 'Campaign marked as sent. Automatic WhatsApp delivery is not connected yet.');
            },
          },
        ]
      );
    } else if (c.status === 'SENDING') {
      Alert.alert('In Progress', `Sending… ${c.sent}/${c.recipients}`);
    } else {
      Alert.alert(
        c.title,
        `${c.message}\n\nAudience: ${c.audience}\nRecipients: ${c.recipients}\nSent: ${c.sent} · Failed: ${c.failed}\nCreated: ${new Date(c.createdOn).toLocaleDateString('en-IN')}`,
        [{ text: 'Close' }]
      );
    }
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    const trimmedMsg = message.trim();

    if (!trimmedTitle) {
      Alert.alert('Required', 'Title is required');
      return;
    }
    if (!trimmedMsg) {
      Alert.alert('Required', 'Message is required');
      return;
    }

    try {
      await createCampaign({
        title: trimmedTitle,
        message: trimmedMsg,
        audience: selectedAudience as any,
        recipients: countForAudience(selectedAudience),
      });
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Please try again.');
      return;
    }

    setCreateModalVisible(false);
    Alert.alert('Campaign Created', 'Tap it to start sending');
  };

  return (
    <View style={styles.container}>
      <Header title="Campaigns" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {campaigns.length} campaigns · {guests.length} guests · {consentCount} with marketing consent
          </Text>
        </View>

        {campaigns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No WhatsApp campaigns yet</Text>
            <Text style={styles.emptySubtitle}>
              Broadcast personalized discounts and holiday packages directly to past guests.
            </Text>
            <TouchableOpacity
              style={styles.createFirstBtn}
              onPress={() => setCreateModalVisible(true)}
            >
              <Text style={styles.createFirstBtnText}>+ Create campaign</Text>
            </TouchableOpacity>
          </View>
        ) : (
          campaigns.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.campaignCard}
              onPress={() => handleCampaignPress(c)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.campaignTitle}>{c.title}</Text>
                <Pill type="campaign" value={c.status} />
              </View>

              <Text style={styles.campaignMsg} numberOfLines={2}>
                {c.message}
              </Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  Audience: <Text style={{ fontWeight: '600' }}>{c.audience}</Text>
                </Text>
                <Text style={styles.metaText}>
                  {c.status === 'COMPLETED'
                    ? `${c.sent} delivered`
                    : `${c.recipients} recipients`}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateModalVisible(true)}
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={styles.fabLabel}>New Campaign</Text>
      </TouchableOpacity>

      {/* Create Campaign Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCreateModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New WhatsApp Campaign</Text>

            <PlatformSelect
              label="Target Audience"
              value={selectedAudience}
              options={AUDIENCE_OPTIONS}
              onSelect={setSelectedAudience}
            />

            <Text style={styles.recipientBadge}>
              {countForAudience(selectedAudience)} recipients will get this message
            </Text>

            <Text style={styles.label}>Campaign Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Diwali Weekend Special"
              placeholderTextColor={Colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>WhatsApp Message Template</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Hi {name}..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
              <Text style={styles.saveBtnText}>Create Campaign</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBackground,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 90,
  },
  summaryBar: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  createFirstBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createFirstBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  campaignCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  campaignTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: 10,
  },
  campaignMsg: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    backgroundColor: Colors.brandPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 28,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 6,
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  chipActive: {
    backgroundColor: Colors.brandPrimary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  recipientBadge: {
    fontSize: 12,
    color: Colors.brandPrimaryDark,
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
