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
import { Colors } from '../theme/colors';

const PHOTO_PRESETS = [
  'Front elevation',
  'Deluxe room',
  'Valley view balcony',
  'Dining hall',
  'Rooftop garden',
  'Reception',
  'Garden view',
  'Family room',
  'Kitchen',
  'Bonfire area',
];

const AMENITY_PRESETS = [
  'Free Wi-Fi',
  '24x7 Hot Water',
  'Private Parking',
  'Home Breakfast',
  'Air Conditioning',
  'Power Backup',
  'Luggage Storage',
  'Mountain View',
  'Laundry Service',
  'In-house Cabs (StayRide)',
  'Airport Pickup',
  'Restaurant',
  'Garden',
  'CCTV Security',
  'Doctor on Call',
  'Travel Desk',
];

export const HomestayProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { homestay, updateHomestay } = useStayRide();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);
  const [amenityPickerVisible, setAmenityPickerVisible] = useState(false);

  // Edit fields
  const [name, setName] = useState(homestay.name);
  const [owner, setOwner] = useState(homestay.ownerName);
  const [phone, setPhone] = useState(homestay.phone);
  const [email, setEmail] = useState(homestay.email);
  const [location, setLocation] = useState(homestay.location);
  const [description, setDescription] = useState(homestay.description);

  const openEditModal = () => {
    setName(homestay.name);
    setOwner(homestay.ownerName);
    setPhone(homestay.phone);
    setEmail(homestay.email);
    setLocation(homestay.location);
    setDescription(homestay.description);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Name cannot be empty');
      return;
    }
    try {
      await updateHomestay({
        ...homestay,
        name: name.trim(),
        ownerName: owner.trim(),
        phone: phone.trim(),
        email: email.trim(),
        location: location.trim(),
        description: description.trim(),
      });
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Could not save your profile. Please try again.');
      return;
    }
    setEditModalVisible(false);
    Alert.alert('Profile Updated', 'Homestay profile saved successfully');
  };

  // Photo/amenity edits: report server failures instead of leaving an unhandled rejection
  const save = async (data: Parameters<typeof updateHomestay>[0]) => {
    try {
      await updateHomestay(data);
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Could not save your change. Please try again.');
    }
  };

  const handleRemovePhoto = async (photo: string) => {
    const updated = homestay.photos.filter((p) => p !== photo);
    await save({ ...homestay, photos: updated });
  };

  const handleAddPhoto = async (photo: string) => {
    setPhotoPickerVisible(false);
    if (homestay.photos.includes(photo)) return;
    await save({ ...homestay, photos: [...homestay.photos, photo] });
  };

  const handleRemoveAmenity = async (amenity: string) => {
    const updated = homestay.amenities.filter((a) => a !== amenity);
    await save({ ...homestay, amenities: updated });
  };

  const handleAddAmenity = async (amenity: string) => {
    setAmenityPickerVisible(false);
    if (homestay.amenities.includes(amenity)) return;
    await save({ ...homestay, amenities: [...homestay.amenities, amenity] });
  };

  const remainingPhotos = PHOTO_PRESETS.filter((p) => !homestay.photos.includes(p));
  const remainingAmenities = AMENITY_PRESETS.filter((a) => !homestay.amenities.includes(a));

  return (
    <View style={styles.container}>
      <Header title="Homestay Profile" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.name}>{homestay.name}</Text>
            <TouchableOpacity onPress={openEditModal}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.location}>{homestay.location}</Text>
          <Text style={styles.owner}>Owned by {homestay.ownerName}</Text>
          <Text style={styles.description}>{homestay.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.contact}>
            {homestay.phone}  ·  {homestay.email}
          </Text>
        </View>

        {/* Photos Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Photos ({homestay.photos.length})</Text>
          <View style={styles.chipsContainer}>
            {homestay.photos.map((p) => (
              <View key={p} style={styles.chipItem}>
                <Text style={styles.chipText}>{p}</Text>
                <TouchableOpacity onPress={() => handleRemovePhoto(p)}>
                  <Text style={styles.chipRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.chipAdd}
              onPress={() => setPhotoPickerVisible(true)}
            >
              <Text style={styles.chipAddText}>+ Add photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Amenities Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Amenities ({homestay.amenities.length})
          </Text>
          <View style={styles.chipsContainer}>
            {homestay.amenities.map((a) => (
              <View key={a} style={styles.chipItem}>
                <Text style={styles.chipText}>{a}</Text>
                <TouchableOpacity onPress={() => handleRemoveAmenity(a)}>
                  <Text style={styles.chipRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.chipAdd}
              onPress={() => setAmenityPickerVisible(true)}
            >
              <Text style={styles.chipAddText}>+ Add amenity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Homestay Profile</Text>

            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={styles.label}>Homestay Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Owner Name</Text>
              <TextInput
                style={styles.input}
                value={owner}
                onChangeText={setOwner}
              />

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />

              <Text style={styles.label}>Location / Address</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Photo Preset Modal */}
      <Modal
        visible={photoPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPhotoPickerVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add photo</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {remainingPhotos.length === 0 ? (
                <Text style={styles.emptyPrompt}>All presets already added</Text>
              ) : (
                remainingPhotos.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={styles.presetItem}
                    onPress={() => handleAddPhoto(p)}
                  >
                    <Text style={styles.presetItemText}>{p}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Amenity Preset Modal */}
      <Modal
        visible={amenityPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAmenityPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAmenityPickerVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add amenity</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {remainingAmenities.length === 0 ? (
                <Text style={styles.emptyPrompt}>All presets already added</Text>
              ) : (
                remainingAmenities.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={styles.presetItem}
                    onPress={() => handleAddAmenity(a)}
                  >
                    <Text style={styles.presetItemText}>{a}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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
    paddingBottom: 36,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    flex: 1,
  },
  editLink: {
    color: Colors.brandPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  location: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  owner: {
    fontSize: 13,
    color: Colors.brandPrimaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    color: Colors.textPrimary,
    marginTop: 8,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 12,
  },
  contact: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textPrimary,
    marginRight: 6,
  },
  chipRemove: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  chipAdd: {
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipAddText: {
    fontSize: 13,
    color: Colors.brandPrimaryDark,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
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
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  textArea: {
    minHeight: 75,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 18,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  emptyPrompt: {
    color: Colors.textSecondary,
    fontSize: 14,
    paddingVertical: 10,
  },
  presetItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  presetItemText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
});
