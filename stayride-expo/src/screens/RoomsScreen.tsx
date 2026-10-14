import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';
import { useStayRide } from '../data/store';
import { RoomItem } from '../components/RoomItem';
import { BookingItem } from '../components/BookingItem';
import { PlatformSelect } from '../components/PlatformSelect';
import { Header } from '../components/Header';
import { Room, RoomStatus } from '../types';

const ROOM_TYPE_OPTIONS = [
  { label: 'Standard Room', value: 'Standard', icon: 'bed-outline' as const },
  { label: 'Deluxe Valley View', value: 'Deluxe Valley View', icon: 'sparkles-outline' as const },
  { label: 'Family Suite', value: 'Family Suite', icon: 'people-outline' as const },
  { label: 'Attic Cottage Room', value: 'Attic Cottage Room', icon: 'home-outline' as const },
  { label: 'Budget Twin Room', value: 'Budget Twin Room', icon: 'cash-outline' as const },
  { label: 'Executive Suite', value: 'Executive Suite', icon: 'star-outline' as const },
];

const FLOOR_OPTIONS = [
  { label: 'Ground Floor', value: 'Ground Floor', icon: 'layers-outline' as const },
  { label: '1st Floor', value: '1st Floor', icon: 'layers-outline' as const },
  { label: '2nd Floor', value: '2nd Floor', icon: 'layers-outline' as const },
  { label: '3rd Floor', value: '3rd Floor', icon: 'layers-outline' as const },
  { label: 'Attic / Rooftop', value: 'Attic', icon: 'arrow-up-outline' as const },
  { label: 'Cottage Wing', value: 'Cottage Wing', icon: 'leaf-outline' as const },
];

const ROOM_STATUS_OPTIONS = [
  { label: 'Available (Clean & vacant)', value: 'AVAILABLE', icon: 'checkmark-circle-outline' as const },
  { label: 'Occupied (Guest checked in)', value: 'OCCUPIED', icon: 'person-outline' as const },
  { label: 'Reserved (Booked upcoming)', value: 'RESERVED', icon: 'calendar-outline' as const },
  { label: 'Maintenance (Cleaning/Repairs)', value: 'MAINTENANCE', icon: 'construct-outline' as const },
];

export const RoomsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { rooms, bookings, countRooms, createRoom, updateRoom, deleteRoom } = useStayRide();

  const [activeTab, setActiveTab] = useState<'rooms' | 'bookings'>(
    route.params?.initialTab === 'bookings' ? 'bookings' : 'rooms'
  );
  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [bookingFilter, setBookingFilter] = useState<string>('ALL');

  // Room Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editType, setEditType] = useState('Standard');
  const [editFloor, setEditFloor] = useState('1st Floor');
  const [editPrice, setEditPrice] = useState('1800');
  const [editStatus, setEditStatus] = useState<RoomStatus>('AVAILABLE');
  const [editNote, setEditNote] = useState('');

  const openRoomModal = (room?: Room) => {
    if (room) {
      setSelectedRoom(room);
      setEditNumber(room.number);
      setEditType(room.type);
      setEditFloor(room.floor);
      setEditPrice(String(room.price));
      setEditStatus(room.status);
      setEditNote(room.note || '');
    } else {
      setSelectedRoom(null);
      setEditNumber('');
      setEditType('Standard');
      setEditFloor('1st Floor');
      setEditPrice('1800');
      setEditStatus('AVAILABLE');
      setEditNote('');
    }
    setModalVisible(true);
  };

  const handleSaveRoom = async () => {
    if (!editNumber.trim()) {
      Alert.alert('Validation Error', 'Room number is required');
      return;
    }
    const priceNum = parseInt(editPrice, 10) || 1800;

    if (selectedRoom) {
      await updateRoom(selectedRoom.id, {
        number: editNumber.trim(),
        type: editType,
        floor: editFloor.trim(),
        price: priceNum,
        status: editStatus,
        note: editNote.trim(),
      });
    } else {
      await createRoom({
        number: editNumber.trim(),
        type: editType,
        floor: editFloor.trim(),
        price: priceNum,
        status: editStatus,
        note: editNote.trim(),
      });
    }
    setModalVisible(false);
  };

  const handleDeleteRoom = () => {
    if (!selectedRoom) return;
    Alert.alert(
      `Delete room ${selectedRoom.number}?`,
      'This removes the room from your homestay. Existing bookings keep their history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRoom(selectedRoom.id);
            setModalVisible(false);
          },
        },
      ]
    );
  };

  const filteredRooms = rooms.filter((r) => {
    if (roomFilter === 'ALL') return true;
    return r.status === roomFilter;
  });

  const filteredBookings = bookings
    .filter((b) => {
      if (bookingFilter === 'ALL') return true;
      return b.status === bookingFilter;
    })
    .sort((a, b) => b.checkIn - a.checkIn);

  return (
    <View style={styles.container}>
      <Header title="Rooms & Bookings" />
      {/* Top Segmented Button Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'rooms' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('rooms')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, activeTab === 'rooms' && styles.toggleBtnTextActive]}>
            Rooms
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'bookings' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('bookings')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, activeTab === 'bookings' && styles.toggleBtnTextActive]}>
            Bookings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {activeTab === 'rooms' ? (
            ['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, roomFilter === f && styles.chipActive]}
                onPress={() => setRoomFilter(f)}
              >
                <Text style={[styles.chipText, roomFilter === f && styles.chipTextActive]}>
                  {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            ['ALL', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, bookingFilter === f && styles.chipActive]}
                onPress={() => setBookingFilter(f)}
              >
                <Text style={[styles.chipText, bookingFilter === f && styles.chipTextActive]}>
                  {f === 'ALL'
                    ? 'All'
                    : f.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Counter subheader */}
      <Text style={styles.countText}>
        {activeTab === 'rooms'
          ? `${filteredRooms.length} of ${rooms.length} rooms • ${countRooms('AVAILABLE')} available`
          : `${filteredBookings.length} of ${bookings.length} bookings`}
      </Text>

      {/* Main List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {activeTab === 'rooms' ? (
          filteredRooms.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No rooms match this filter.</Text>
            </View>
          ) : (
            filteredRooms.map((r) => (
              <RoomItem key={r.id} room={r} onPress={() => openRoomModal(r)} />
            ))
          )
        ) : filteredBookings.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No bookings match this filter.</Text>
          </View>
        ) : (
          filteredBookings.map((b) => (
            <BookingItem
              key={b.id}
              booking={b}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: b.id })}
            />
          ))
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => (activeTab === 'rooms' ? openRoomModal() : navigation.navigate('NewBooking'))}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      {/* Add / Edit Room Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {selectedRoom ? `Room ${selectedRoom.number}` : 'Add room'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Room Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="101"
                value={editNumber}
                onChangeText={setEditNumber}
              />

              <PlatformSelect
                label="Room Type"
                value={editType}
                options={ROOM_TYPE_OPTIONS}
                onSelect={setEditType}
              />

              <PlatformSelect
                label="Floor"
                value={editFloor}
                options={FLOOR_OPTIONS}
                onSelect={setEditFloor}
              />

              <Text style={styles.modalLabel}>Price per Night (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="1800"
                keyboardType="numeric"
                value={editPrice}
                onChangeText={setEditPrice}
              />

              <PlatformSelect
                label="Status"
                value={editStatus}
                options={ROOM_STATUS_OPTIONS}
                onSelect={(val) => setEditStatus(val as RoomStatus)}
              />

              <Text style={styles.modalLabel}>Note</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="Valley side, 1 double bed"
                multiline
                value={editNote}
                onChangeText={setEditNote}
              />

              <View style={styles.modalButtonsRow}>
                {selectedRoom && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteRoom}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRoom}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.button,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: Radii.button - 2,
  },
  toggleBtnActive: {
    backgroundColor: Colors.brandPrimary,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: Colors.white,
  },
  chipsContainer: {
    marginTop: 10,
  },
  chipsScroll: {
    paddingHorizontal: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.bgCard,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  chipActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  countText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 80,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.brandPrimaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radii.dialog,
    borderTopRightRadius: Radii.dialog,
    padding: 20,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: Colors.bgPage,
    borderRadius: Radii.button,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  pillSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.bgPage,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  typePillActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  typePillText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  typePillTextActive: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
  },
  deleteBtnText: {
    color: Colors.statusRed,
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: Radii.button,
  },
  saveBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
});
