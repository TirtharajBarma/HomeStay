import React, { useState, useEffect } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Shadows } from '../theme/colors';
import { KeyboardAwareOverlay } from '../components/KeyboardAwareOverlay';
import { useStayRide } from '../data/store';
import { RoomItem } from '../components/RoomItem';
import { OccupancyGrid } from '../components/OccupancyGrid';
import { RoomCalendarSync } from '../components/RoomCalendarSync';
import { BookingItem } from '../components/BookingItem';
import { PlatformSelect } from '../components/PlatformSelect';
import { Header } from '../components/Header';
import { Booking, Room, RoomStatus } from '../types';
import { uploadPhoto, photoUrl } from '../services/photoUploader';

const FLOOR_DEFAULTS = [
  { label: 'Ground Floor', value: 'Ground Floor', icon: 'layers-outline' as const },
  { label: '1st Floor', value: '1st Floor', icon: 'layers-outline' as const },
  { label: '2nd Floor', value: '2nd Floor', icon: 'layers-outline' as const },
  { label: '3rd Floor', value: '3rd Floor', icon: 'layers-outline' as const },
  { label: 'Attic / Rooftop', value: 'Attic', icon: 'arrow-up-outline' as const },
  { label: 'Cottage Wing', value: 'Cottage Wing', icon: 'leaf-outline' as const },
];

const ROOM_CATEGORY_OPTIONS = [
  { label: 'Standard Room', value: 'Standard Room', icon: 'bed-outline' as const },
  { label: 'Deluxe Room', value: 'Deluxe Room', icon: 'star-outline' as const },
  { label: 'Valley View Suite', value: 'Valley View Suite', icon: 'image-outline' as const },
  { label: 'Family Suite', value: 'Family Suite', icon: 'people-outline' as const },
  { label: 'Attic Cottage Room', value: 'Attic Cottage Room', icon: 'home-outline' as const },
  { label: 'Budget Twin Room', value: 'Budget Twin Room', icon: 'bed-outline' as const },
  { label: '➕ Custom Category...', value: 'CUSTOM', icon: 'create-outline' as const },
];

// Occupied / Reserved come from bookings automatically; the owner only blocks a room for maintenance
const ROOM_STATUS_OPTIONS = [
  { label: 'Open for bookings', value: 'AVAILABLE', icon: 'checkmark-circle-outline' as const },
  { label: 'Maintenance (cleaning / repairs, no bookings)', value: 'MAINTENANCE', icon: 'construct-outline' as const },
];

const ROOM_TYPE_OPTIONS = [
  { label: 'Private Room (Entire Room)', value: 'PRIVATE', icon: 'bed-outline' as const },
  { label: 'Hostel Dorm (Per-bed booking)', value: 'DORM', icon: 'people-outline' as const },
];

export const RoomsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { rooms, bookings, countRooms, createRoom, updateRoom, deleteRoom } = useStayRide();

  const [activeTab, setActiveTab] = useState<'calendar' | 'bookings' | 'rooms'>(
    route.params?.initialTab === 'rooms'
      ? 'rooms'
      : route.params?.initialTab === 'bookings'
      ? 'bookings'
      : 'calendar'
  );

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [bookingFilter, setBookingFilter] = useState<string>('ALL');

  // Room Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editFloor, setEditFloor] = useState('1st Floor');
  const [customFloor, setCustomFloor] = useState('');
  const [isCustomFloor, setIsCustomFloor] = useState(false);
  const [editCategory, setEditCategory] = useState('Standard Room');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [editPrice, setEditPrice] = useState('1800');
  const [editStatus, setEditStatus] = useState<RoomStatus>('AVAILABLE');
  const [editRoomType, setEditRoomType] = useState<'PRIVATE' | 'DORM'>('PRIVATE');
  const [editBedCount, setEditBedCount] = useState('4');
  const [editBedLabels, setEditBedLabels] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Collect all unique custom floors already present in the homestay's rooms
  const existingFloors = Array.from(new Set(rooms.map((r) => r.floor).filter(Boolean)));
  const dynamicFloorOptions = [
    ...FLOOR_DEFAULTS,
    ...existingFloors
      .filter((f) => !FLOOR_DEFAULTS.some((d) => d.value === f))
      .map((f) => ({ label: f, value: f, icon: 'layers-outline' as const })),
    { label: '➕ Other / Custom Floor / Wing...', value: 'CUSTOM', icon: 'create-outline' as const },
  ];

  const openRoomModal = (room?: Room) => {
    if (room) {
      setSelectedRoom(room);
      setEditNumber(room.number);

      const isKnownFloor = FLOOR_DEFAULTS.some((f) => f.value === room.floor) || existingFloors.includes(room.floor);
      if (isKnownFloor) {
        setEditFloor(room.floor);
        setCustomFloor('');
        setIsCustomFloor(false);
      } else {
        setEditFloor('CUSTOM');
        setCustomFloor(room.floor);
        setIsCustomFloor(true);
      }

      if (room.type) {
        const isKnownCategory = ROOM_CATEGORY_OPTIONS.some((c) => c.value === room.type);
        if (isKnownCategory) {
          setEditCategory(room.type);
          setCustomCategory('');
          setIsCustomCategory(false);
        } else {
          setEditCategory('CUSTOM');
          setCustomCategory(room.type);
          setIsCustomCategory(true);
        }
      } else {
        setEditCategory('Standard Room');
        setCustomCategory('');
        setIsCustomCategory(false);
      }

      setEditPrice(String(room.price));
      setEditStatus(room.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE');
      setEditRoomType(room.roomType || 'PRIVATE');
      setEditBedCount(room.bedCount ? String(room.bedCount) : '4');
      setEditBedLabels(room.beds ? room.beds.join(', ') : '');
      setEditNote(room.note || '');
      setEditPhoto(room.photo || (room.photos && room.photos.length > 0 ? room.photos[0] : '') || '');
    } else {
      setSelectedRoom(null);
      setEditNumber('');
      setEditFloor('1st Floor');
      setCustomFloor('');
      setIsCustomFloor(false);
      setEditCategory('Standard Room');
      setCustomCategory('');
      setIsCustomCategory(false);
      setEditPrice('1800');
      setEditStatus('AVAILABLE');
      setEditRoomType('PRIVATE');
      setEditBedCount('4');
      setEditBedLabels('');
      setEditNote('');
      setEditPhoto('');
    }
    setModalVisible(true);
  };

  const pickRoomPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow photo gallery access to pick room photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.75,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setUploadingPhoto(true);
      const url = await uploadPhoto(asset);
      setEditPhoto(url);
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message || 'Could not upload room photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveRoom = async () => {
    if (!editNumber.trim()) {
      Alert.alert('Validation Error', 'Room number is required');
      return;
    }
    const priceNum = /^\d+$/.test(editPrice.trim()) ? parseInt(editPrice.trim(), 10) : 0;
    if (priceNum <= 0) {
      Alert.alert('Validation Error', 'Enter the room price per night in whole rupees.');
      return;
    }
    const finalFloor = isCustomFloor ? (customFloor.trim() || 'Ground Floor') : editFloor;
    const finalType = isCustomCategory ? (customCategory.trim() || 'Standard Room') : editCategory;
    const bedCountNum = editRoomType === 'DORM' ? Math.max(1, parseInt(editBedCount.trim() || '4', 10)) : undefined;
    const bedsArray = editRoomType === 'DORM' && editBedLabels.trim()
      ? editBedLabels.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const payload = {
      number: editNumber.trim(),
      floor: finalFloor,
      type: finalType,
      price: priceNum,
      status: editStatus,
      roomType: editRoomType,
      bedCount: bedCountNum,
      beds: bedsArray,
      note: editNote.trim(),
      photo: editPhoto.trim() || undefined,
      photos: editPhoto.trim() ? [editPhoto.trim()] : [],
    };

    if (selectedRoom) {
      const outcome = await updateRoom(selectedRoom.id, payload);
      if (!outcome.ok) {
        Alert.alert("Couldn't save", outcome.error || 'Please try again.');
        return;
      }
    } else {
      try {
        await createRoom(payload);
      } catch (e: any) {
        Alert.alert('Not saved', e?.message || 'Please try again.');
        return;
      }
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
            const outcome = await deleteRoom(selectedRoom.id);
            if (!outcome.ok) {
              Alert.alert("Couldn't delete", outcome.error || 'Please try again.');
              return;
            }
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

  // Bookings ordered the way a front desk works: in-house first, then upcoming (soonest first), then past
  const dayStart = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  })();
  const isToday = (b: Booking) =>
    b.status !== 'CANCELLED' &&
    ((b.checkIn >= dayStart && b.checkIn < dayStart + 86400000) || (b.status === 'CHECKED_IN' && b.checkOut < dayStart + 86400000));
  const rank: Record<string, number> = { CHECKED_IN: 0, CONFIRMED: 1, CHECKED_OUT: 2, CANCELLED: 3 };
  const filteredBookings = bookings
    .filter((b) => {
      if (bookingFilter === 'ALL') return true;
      if (bookingFilter === 'TODAY') return isToday(b);
      return b.status === bookingFilter;
    })
    .sort((a, b) =>
      rank[a.status] !== rank[b.status]
        ? rank[a.status] - rank[b.status]
        : a.status === 'CONFIRMED' || a.status === 'CHECKED_IN'
        ? a.checkIn - b.checkIn
        : b.checkIn - a.checkIn
    );

  return (
    <View style={styles.container}>
      <Header title="Rooms & Bookings" />
      {/* Top Segmented Button Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'calendar' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('calendar')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, activeTab === 'calendar' && styles.toggleBtnTextActive]}>
            Calendar
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
        <TouchableOpacity
          style={[styles.toggleBtn, activeTab === 'rooms' && styles.toggleBtnActive]}
          onPress={() => setActiveTab('rooms')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, activeTab === 'rooms' && styles.toggleBtnTextActive]}>
            Rooms
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      {activeTab !== 'calendar' && (
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
            (
              [
                ['ALL', 'All'],
                ['TODAY', 'Today'],
                ['CHECKED_IN', 'In-house'],
                ['CONFIRMED', 'Upcoming'],
                ['CHECKED_OUT', 'Past'],
                ['CANCELLED', 'Cancelled'],
              ] as const
            ).map(([f, label]) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, bookingFilter === f && styles.chipActive]}
                onPress={() => setBookingFilter(f)}
              >
                <Text style={[styles.chipText, bookingFilter === f && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      )}

      {/* Counter subheader */}
      {activeTab !== 'calendar' && (
      <Text style={styles.countText}>
        {activeTab === 'rooms'
          ? `${filteredRooms.length} of ${rooms.length} rooms • ${countRooms('AVAILABLE')} available`
          : `${filteredBookings.length} of ${bookings.length} bookings`}
      </Text>
      )}

      {/* Main List */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {activeTab === 'calendar' ? (
          <OccupancyGrid
            rooms={rooms}
            bookings={bookings}
            onOpenBooking={(b) => navigation.navigate('BookingDetail', { bookingId: b.id })}
            onNewBooking={(room, day) => navigation.navigate('NewBooking', { roomId: room.id, checkIn: day })}
          />
        ) : activeTab === 'rooms' ? (
          filteredRooms.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="bed-outline" size={26} color={Colors.brandPrimary} />
              </View>
              <Text style={styles.emptyTitle}>No rooms match this filter</Text>
              <Text style={styles.emptyText}>Switch the filter chip above to see all homestay rooms.</Text>
            </View>
          ) : (
            filteredRooms.map((r) => (
              <RoomItem key={r.id} room={r} onPress={() => openRoomModal(r)} />
            ))
          )
        ) : filteredBookings.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={26} color={Colors.brandPrimary} />
            </View>
              <Text style={styles.emptyTitle}>No bookings found</Text>
              <Text style={styles.emptyText}>Create a new room reservation for your guest.</Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => navigation.navigate('NewBooking')}
            >
              <Text style={styles.emptyActionBtnText}>+ Create Booking</Text>
            </TouchableOpacity>
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
        <KeyboardAwareOverlay style={{ flex: 1 }}>
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
              {/* Room Photo (Optional) */}
              <View style={styles.photoUploadContainer}>
                <Text style={styles.modalLabel}>Room Photo (Optional)</Text>
                {uploadingPhoto ? (
                  <View style={styles.photoLoadingBox}>
                    <ActivityIndicator size="small" color={Colors.brandPrimary} />
                    <Text style={styles.photoLoadingText}>Uploading photo to Cloudinary...</Text>
                  </View>
                ) : editPhoto ? (
                  <View style={styles.photoPreviewCard}>
                    <Image
                      source={{ uri: photoUrl(editPhoto, 600) }}
                      style={styles.photoPreviewImage}
                      resizeMode="cover"
                    />
                    <View style={styles.photoActionOverlay}>
                      <TouchableOpacity
                        style={styles.photoActionButton}
                        onPress={pickRoomPhoto}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera" size={14} color="#FFFFFF" />
                        <Text style={styles.photoActionText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.photoActionButton, styles.photoDeleteButton]}
                        onPress={() => setEditPhoto('')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.photoActionText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoPickArea}
                    onPress={pickRoomPhoto}
                    activeOpacity={0.7}
                  >
                    <View style={styles.photoPickIconCircle}>
                      <Ionicons name="camera-outline" size={20} color={Colors.brandPrimary} />
                    </View>
                    <Text style={styles.photoPickTitle}>Add Room Photo</Text>
                    <Text style={styles.photoPickSub}>JPG, PNG, WebP up to 5MB</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Row 1: Room Number (50%) + Floor (50%) */}
              <View style={styles.grid5050}>
                <View style={styles.col50}>
                  <Text style={styles.modalLabel}>Room No / Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="101, Attic A"
                    value={editNumber}
                    onChangeText={setEditNumber}
                  />
                </View>
                <View style={styles.col50}>
                  <PlatformSelect
                    label="Floor / Wing"
                    value={isCustomFloor ? 'CUSTOM' : editFloor}
                    options={dynamicFloorOptions}
                    onSelect={(val) => {
                      if (val === 'CUSTOM') {
                        setIsCustomFloor(true);
                        setEditFloor('CUSTOM');
                      } else {
                        setIsCustomFloor(false);
                        setEditFloor(val);
                      }
                    }}
                  />
                </View>
              </View>

              {/* If Custom Floor */}
              {isCustomFloor && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.modalLabel}>Custom Floor or Wing Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. River Wing, Basement, Block B, Pine Villa"
                    value={customFloor}
                    onChangeText={setCustomFloor}
                  />
                </View>
              )}

              {/* Row 2: Price (50%) + Room Setup (50%) */}
              <View style={styles.grid5050}>
                <View style={styles.col50}>
                  <Text style={styles.modalLabel}>Price / Night (₹) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="1800"
                    keyboardType="numeric"
                    value={editPrice}
                    onChangeText={setEditPrice}
                  />
                </View>
                <View style={styles.col50}>
                  <PlatformSelect
                    label="Room Setup"
                    value={editRoomType}
                    options={ROOM_TYPE_OPTIONS}
                    onSelect={(val) => setEditRoomType(val as 'PRIVATE' | 'DORM')}
                  />
                </View>
              </View>

              {/* Row 3: Room Category (50%) + Availability (50%) */}
              <View style={styles.grid5050}>
                <View style={styles.col50}>
                  <PlatformSelect
                    label="Room Category"
                    value={isCustomCategory ? 'CUSTOM' : editCategory}
                    options={ROOM_CATEGORY_OPTIONS}
                    onSelect={(val) => {
                      if (val === 'CUSTOM') {
                        setIsCustomCategory(true);
                        setEditCategory('CUSTOM');
                      } else {
                        setIsCustomCategory(false);
                        setEditCategory(val);
                      }
                    }}
                  />
                </View>
                <View style={styles.col50}>
                  <PlatformSelect
                    label="Availability"
                    value={editStatus}
                    options={ROOM_STATUS_OPTIONS}
                    onSelect={(val) => setEditStatus(val as RoomStatus)}
                  />
                </View>
              </View>

              {/* If Custom Category */}
              {isCustomCategory && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.modalLabel}>Custom Category Name</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Glamping Tent, Duplex Cottage, Treehouse"
                    value={customCategory}
                    onChangeText={setCustomCategory}
                  />
                </View>
              )}

              {/* If Dorm: Beds Count & Bed Labels */}
              {editRoomType === 'DORM' && (
                <View style={styles.grid5050}>
                  <View style={styles.col50}>
                    <Text style={styles.modalLabel}>Bed Count</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="4"
                      keyboardType="numeric"
                      value={editBedCount}
                      onChangeText={setEditBedCount}
                    />
                  </View>
                  <View style={styles.col50}>
                    <Text style={styles.modalLabel}>Custom Bed Labels (Optional)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Lower 1, Upper 1..."
                      value={editBedLabels}
                      onChangeText={setEditBedLabels}
                    />
                  </View>
                </View>
              )}

              {selectedRoom && selectedRoom.status !== 'MAINTENANCE' && (
                <Text style={styles.statusHelperText}>
                  Current live status: {selectedRoom.status.toLowerCase()} (managed automatically by bookings)
                </Text>
              )}

              {/* Row 4: Room Features / Notes (100%) */}
              <Text style={styles.modalLabel}>Features / Balcony / View (Optional)</Text>
              <TextInput
                style={[styles.modalInput, { height: 50 }]}
                placeholder="e.g. Balcony with Kanchenjunga view, 1 King bed"
                multiline
                value={editNote}
                onChangeText={setEditNote}
              />

              {/* Calendar sync is per saved room */}
              {selectedRoom && <RoomCalendarSync roomId={selectedRoom.id} />}

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
        </KeyboardAwareOverlay>
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
    backgroundColor: '#EDE9FE',
    borderRadius: Radii.button,
    padding: 3,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: Radii.button - 2,
  },
  toggleBtnActive: {
    backgroundColor: Colors.brandPrimary,
    ...Shadows.sm,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5A556B',
  },
  toggleBtnTextActive: {
    color: Colors.white,
    fontWeight: '800',
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
    paddingVertical: 36,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.brandPrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyActionBtn: {
    marginTop: 14,
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
  grid5050: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  col50: {
    flex: 1,
    minWidth: 0,
  },
  statusHelperText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 8,
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
  photoUploadContainer: {
    marginBottom: 12,
  },
  photoPickArea: {
    height: 100,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C084FC',
    backgroundColor: '#FAF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  photoPickIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoPickTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brandPrimaryDark,
  },
  photoPickSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  photoLoadingBox: {
    height: 100,
    borderRadius: Radii.card,
    backgroundColor: '#FAF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoLoadingText: {
    fontSize: 12,
    color: Colors.brandPrimaryDark,
    fontWeight: '600',
  },
  photoPreviewCard: {
    height: 125,
    borderRadius: Radii.card,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoActionOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  photoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  photoDeleteButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
  },
  photoActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
