import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { PlatformSelect } from '../components/PlatformSelect';
import { Colors, Radii, Shadows } from '../theme/colors';
import { FormScroll } from '../components/FormScroll';
import { LocationPicker, PickedLocation } from '../components/LocationPicker';
import { uploadPhoto, isImagePhoto, photoUrl } from '../services/photoUploader';

type IconName = keyof typeof Ionicons.glyphMap;

const MAX_PHOTOS = 10; // same limit as the server (MAX_PHOTOS in server/src/stayride/store.ts)

const AMENITIES: { label: string; icon: IconName }[] = [
  { label: 'Free Wi-Fi', icon: 'wifi' },
  { label: '24x7 Hot Water', icon: 'water' },
  { label: 'Private Parking', icon: 'car' },
  { label: 'Home Breakfast', icon: 'cafe' },
  { label: 'Air Conditioning', icon: 'snow' },
  { label: 'Power Backup', icon: 'flash' },
  { label: 'Luggage Storage', icon: 'briefcase' },
  { label: 'Mountain View', icon: 'image' },
  { label: 'Laundry Service', icon: 'shirt' },
  { label: 'In-house Cabs & Mobility', icon: 'navigate' },
  { label: 'Airport Pickup', icon: 'airplane' },
  { label: 'Restaurant', icon: 'restaurant' },
  { label: 'Garden', icon: 'leaf' },
  { label: 'CCTV Security', icon: 'videocam' },
  { label: 'Doctor on Call', icon: 'medkit' },
  { label: 'Travel Desk', icon: 'map' },
];
const iconFor = (amenity: string): IconName => AMENITIES.find((a) => a.label === amenity)?.icon || 'checkmark-circle';

// House check-in / check-out times (half-hour steps), shown on bookings and receipts
const HOUSE_TIMES = Array.from({ length: 40 }, (_, i) => {
  const m = 4 * 60 + i * 30; // 04:00 AM … 11:30 PM
  const h = Math.floor(m / 60);
  const label = `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return { label, value: label, icon: 'time-outline' as const };
});

export const HomestayProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const { homestay, rooms, updateHomestay, setHomestayLocation } = useStayRide();

  const [editVisible, setEditVisible] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [amenitiesVisible, setAmenitiesVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(''); // progress text while photos upload
  const [viewing, setViewing] = useState<string | null>(null);

  // Edit form (copied from the saved profile when opened)
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState(''); // filled from the map pin, never typed
  const [pinDraft, setPinDraft] = useState<{ latitude: number; longitude: number } | null>(null);
  const [editPinVisible, setEditPinVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [checkInTime, setCheckInTime] = useState('12:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('11:00 AM');
  const [amenityDraft, setAmenityDraft] = useState<string[]>([]);

  const hasPin = typeof homestay.latitude === 'number' && typeof homestay.longitude === 'number';
  const amenities = homestay.amenities || [];
  // Older profiles may hold text labels ("Deluxe room") instead of photos: they are not shown and are
  // dropped on the next photo save
  const photos = (homestay.photos || []).filter(isImagePhoto);

  const openEdit = () => {
    setName(homestay.name || '');
    setOwner(homestay.ownerName || '');
    setPhone(homestay.phone || '');
    setEmail(homestay.email || '');
    setAddress(homestay.location || '');
    setPinDraft(hasPin ? { latitude: homestay.latitude!, longitude: homestay.longitude! } : null);
    setDescription(homestay.description || '');
    setCheckInTime(homestay.checkInTime || '12:00 PM');
    setCheckOutTime(homestay.checkOutTime || '11:00 AM');
    setEditVisible(true);
  };

  const save = async (data: Parameters<typeof updateHomestay>[0], done?: () => void, successTitle?: string) => {
    setSaving(true);
    const outcome = await updateHomestay(data);
    setSaving(false);
    if (!outcome.ok) return Alert.alert('Not saved', outcome.error || 'Could not save your change. Please try again.');
    done?.();
    if (successTitle) Alert.alert(successTitle, 'Your homestay profile is updated.');
  };

  const pinChanged = Boolean(pinDraft) && (pinDraft!.latitude !== homestay.latitude || pinDraft!.longitude !== homestay.longitude);

  const saveDetails = async () => {
    if (!name.trim()) return Alert.alert('Required', 'Your homestay needs a name.');
    if (phone && phone.replace(/\D/g, '').length < 10) return Alert.alert('Check phone', 'Enter a 10-digit phone number.');
    if (pinChanged) {
      setSaving(true);
      const outcome = await setHomestayLocation({ ...pinDraft!, address });
      setSaving(false);
      if (!outcome.ok) return Alert.alert('Location not saved', outcome.error || 'Could not save the location. Please try again.');
    }
    // coordinates are saved only through the pin (above); never resend the old ones from this snapshot
    const { latitude: _lat, longitude: _lng, mapQuery: _mq, ...rest } = homestay as typeof homestay & { mapQuery?: string };
    save(
      { ...rest, name: name.trim(), ownerName: owner.trim(), phone: phone.trim(), email: email.trim(), location: address, description: description.trim(), checkInTime, checkOutTime },
      () => setEditVisible(false),
      'Saved'
    );
  };

  const handlePinned = async (loc: PickedLocation) => {
    setPinVisible(false);
    const outcome = await setHomestayLocation(loc);
    if (!outcome.ok) Alert.alert('Not saved', outcome.error || 'Could not save the location. Please try again.');
    else Alert.alert('Location saved', loc.address || 'Your homestay pin is saved.');
  };

  // Pick → upload each straight to Cloudinary → save the URLs on the homestay (synced via the server)
  const addPhotos = async () => {
    const room = MAX_PHOTOS - photos.length;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.7 });
    if (picked.canceled || !picked.assets?.length) return;
    const assets = picked.assets.slice(0, room);
    const urls: string[] = [];
    try {
      for (const [i, a] of assets.entries()) {
        setUploading(`Uploading ${i + 1} of ${assets.length}…`);
        urls.push(await uploadPhoto(a));
      }
    } catch (e: any) {
      Alert.alert('Upload failed', `${e?.message || 'Could not upload the photo.'}${urls.length ? ` ${urls.length} photo(s) uploaded before this are kept.` : ''}`);
    } finally {
      setUploading('');
    }
    // ponytail: removed/failed-to-save images stay in Cloudinary; add a cleanup job if storage grows
    if (urls.length) save({ photos: [...photos, ...urls] }, undefined, urls.length === assets.length ? 'Photos added' : undefined);
  };

  const removePhoto = (p: string) =>
    Alert.alert('Remove photo?', 'It will no longer show on your homestay profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => save({ photos: photos.filter((x) => x !== p) }, () => setViewing(null)) },
    ]);

  const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const initial = (homestay.name || 'H').trim().charAt(0).toUpperCase();

  const fact = (icon: IconName, label: string, value: string) => (
    <View style={styles.fact}>
      <Ionicons name={icon} size={18} color={Colors.brandPrimaryDark} />
      <Text style={styles.factValue}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Homestay profile" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Identity */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName} numberOfLines={2}>
              {homestay.name || 'Your homestay'}
            </Text>
            {homestay.ownerName ? <Text style={styles.heroOwner}>Hosted by {homestay.ownerName}</Text> : null}
            {homestay.location ? (
              <Text style={styles.heroLocation} numberOfLines={2}>
                {homestay.location}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={openEdit} accessibilityRole="button" accessibilityLabel="Edit homestay details">
            <Ionicons name="create-outline" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* At a glance */}
        <View style={styles.factsRow}>
          {fact('log-in-outline', 'Check-in', homestay.checkInTime || '—')}
          {fact('log-out-outline', 'Check-out', homestay.checkOutTime || '—')}
          {fact('bed-outline', 'Rooms', String(rooms.length))}
        </View>

        {/* Only when missing: drivers can't find an unpinned homestay */}
        {!hasPin ? (
          <TouchableOpacity style={[styles.card, styles.locationCard, { marginTop: 12 }]} onPress={() => setPinVisible(true)} accessibilityRole="button">
            <View style={[styles.locIcon, { backgroundColor: Colors.statusOrangeBg }]}>
              <Ionicons name="location" size={20} color={Colors.statusOrange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Pin your homestay on the map</Text>
              <Text style={styles.cardSub}>Your address is filled in from the pin, and nearby drivers get your cab requests</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}

        {/* Contact */}
        <Text style={styles.section}>Contact</Text>
        <View style={styles.card}>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.contactText}>{homestay.phone || 'Add a phone number'}</Text>
          </View>
          <View style={[styles.contactRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.contactText}>{homestay.email || 'Add an email'}</Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>About</Text>
          <TouchableOpacity onPress={openEdit} hitSlop={8}>
            <Text style={styles.sectionAction}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <Text style={homestay.description ? styles.about : styles.placeholder}>
            {homestay.description || 'Tell guests what makes your homestay special: views, food, the walk to town…'}
          </Text>
        </View>

        {/* Amenities */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Amenities · {amenities.length}</Text>
          <TouchableOpacity
            onPress={() => {
              setAmenityDraft(amenities);
              setAmenitiesVisible(true);
            }}
            hitSlop={8}
          >
            <Text style={styles.sectionAction}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.card, styles.chipWrap]}>
          {amenities.length === 0 ? (
            <Text style={styles.placeholder}>No amenities yet. Tap Edit to choose them.</Text>
          ) : (
            amenities.map((a) => (
              <View key={a} style={styles.chip}>
                <Ionicons name={iconFor(a)} size={14} color={Colors.brandPrimaryDark} />
                <Text style={styles.chipText}>{a}</Text>
              </View>
            ))
          )}
        </View>

        {/* Photos */}
        <Text style={styles.section}>
          Photos · {photos.length}/{MAX_PHOTOS}
        </Text>
        <View style={styles.card}>
          {photos.length === 0 ? <Text style={[styles.placeholder, { marginBottom: 10 }]}>Add photos of your rooms, views and common areas.</Text> : null}
          <View style={styles.photoGrid}>
            {photos.map((p) => (
              <TouchableOpacity key={p} style={styles.photoTile} onPress={() => setViewing(p)} accessibilityRole="imagebutton" accessibilityLabel="View photo">
                <Image source={{ uri: photoUrl(p, 400) }} style={styles.photoImg} />
              </TouchableOpacity>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <TouchableOpacity
                style={[styles.photoTile, styles.photoAdd]}
                onPress={addPhotos}
                disabled={Boolean(uploading) || saving}
                accessibilityRole="button"
                accessibilityLabel="Add photos"
              >
                {uploading ? (
                  <>
                    <ActivityIndicator color={Colors.brandPrimaryDark} />
                    <Text style={styles.photoAddText}>{uploading}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="add" size={26} color={Colors.brandPrimaryDark} />
                    <Text style={styles.photoAddText}>Add photos</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <LocationPicker
        visible={pinVisible}
        title="Pin your homestay"
        initial={hasPin ? { latitude: homestay.latitude!, longitude: homestay.longitude! } : null}
        onConfirm={handlePinned}
        onClose={() => setPinVisible(false)}
      />

      {/* Edit details: full-screen form with grouped fields */}
      <Modal visible={editVisible} animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <View style={[styles.sheet, { paddingTop: insets.top }]}>
          {/* iOS shows one modal at a time: the map opens inside this sheet */}
          <LocationPicker
            visible={editPinVisible}
            title="Pin your homestay"
            initial={pinDraft}
            onConfirm={(loc) => {
              setPinDraft({ latitude: loc.latitude, longitude: loc.longitude });
              if (loc.address) setAddress(loc.address);
              setEditPinVisible(false);
            }}
            onClose={() => setEditPinVisible(false)}
          />
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={() => setEditVisible(false)} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Edit homestay</Text>
            <View style={{ width: 24 }} />
          </View>
          <FormScroll contentContainerStyle={styles.form}>
            <Text style={styles.formGroup}>Basics</Text>
            <Text style={styles.label}>Homestay name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Hill View Homestay" placeholderTextColor={Colors.textTertiary} />
            <Text style={styles.label}>Host name</Text>
            <TextInput style={styles.input} value={owner} onChangeText={setOwner} placeholder="Your name" placeholderTextColor={Colors.textTertiary} />
            <Text style={styles.label}>Location</Text>
            <TouchableOpacity style={[styles.input, styles.pinField]} onPress={() => setEditPinVisible(true)} accessibilityRole="button" accessibilityLabel="Set location on map">
              <Ionicons name="location" size={18} color={pinDraft ? Colors.brandPrimaryDark : Colors.statusOrange} />
              <View style={{ flex: 1 }}>
                <Text style={pinDraft ? styles.pinFieldText : styles.placeholder} numberOfLines={3}>
                  {pinDraft ? address || `${pinDraft.latitude.toFixed(5)}, ${pinDraft.longitude.toFixed(5)}` : 'Pin your homestay on the map'}
                </Text>
                <Text style={styles.cardSub}>{pinDraft ? 'Tap to move the pin' : 'The address is filled in from the pin'}</Text>
              </View>
              <Ionicons name="map-outline" size={18} color={Colors.brandPrimaryDark} />
            </TouchableOpacity>

            <Text style={styles.formGroup}>Contact</Text>
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit mobile" placeholderTextColor={Colors.textTertiary} />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.formGroup}>House times</Text>
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <PlatformSelect label="Check-in from" value={checkInTime} options={HOUSE_TIMES} onSelect={setCheckInTime} />
              </View>
              <View style={{ flex: 1 }}>
                <PlatformSelect label="Check-out by" value={checkOutTime} options={HOUSE_TIMES} onSelect={setCheckOutTime} />
              </View>
            </View>

            <Text style={styles.formGroup}>About</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="What guests will love about your place"
              placeholderTextColor={Colors.textTertiary}
            />
          </FormScroll>
          <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveDetails} disabled={saving} accessibilityRole="button">
              {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>Save changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full-screen photo with remove */}
      <Modal visible={Boolean(viewing)} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={[styles.viewer, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.viewerBar}>
            <TouchableOpacity onPress={() => setViewing(null)} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => viewing && removePhoto(viewing)} disabled={saving} hitSlop={10} accessibilityLabel="Remove photo">
              {saving ? <ActivityIndicator color={Colors.white} /> : <Ionicons name="trash-outline" size={24} color={Colors.white} />}
            </TouchableOpacity>
          </View>
          {viewing ? <Image source={{ uri: photoUrl(viewing, 1600) }} style={{ flex: 1 }} resizeMode="contain" /> : null}
        </View>
      </Modal>

      {/* Amenities: tick what you have, save once */}
      {(
        [
          [amenitiesVisible, setAmenitiesVisible, 'Amenities', AMENITIES.map((a) => a.label), amenityDraft, setAmenityDraft, 'amenities'],
        ] as const
      ).map(([visible, setVisible, title, options, draft, setDraft, field]) => (
        <Modal key={field} visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
          <View style={styles.pickOverlay}>
            <View style={[styles.pickSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{title}</Text>
                <TouchableOpacity onPress={() => setVisible(false)} hitSlop={10} accessibilityLabel="Close">
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.pickGrid}>
                {options.map((o) => {
                  const on = draft.includes(o);
                  return (
                    <TouchableOpacity
                      key={o}
                      style={[styles.pickItem, on && styles.pickItemOn]}
                      onPress={() => setDraft(toggle(draft, o))}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Ionicons name={field === 'amenities' ? iconFor(o) : 'image-outline'} size={16} color={on ? Colors.white : Colors.brandPrimaryDark} />
                      <Text style={[styles.pickText, on && { color: Colors.white }]}>{o}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={() => save({ ...homestay, [field]: draft }, () => setVisible(false))}
                accessibilityRole="button"
              >
                {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>Save {draft.length} selected</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPage },
  content: { padding: 16, paddingBottom: 40 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: Colors.brandPrimaryDark, borderRadius: Radii.dialog, padding: 18, ...Shadows.hover },
  avatar: { width: 54, height: 54, borderRadius: 16, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: Colors.brandPrimaryDark },
  heroName: { fontSize: 20, fontWeight: '800', color: Colors.white },
  heroOwner: { fontSize: 13, color: '#E2DAFF', marginTop: 3 },
  heroLocation: { fontSize: 13, color: '#E2DAFF', marginTop: 4, lineHeight: 18 },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  factsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  fact: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radii.card, paddingVertical: 12, alignItems: 'center', ...Shadows.card },
  factValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginTop: 6 },
  factLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  section: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 20, marginBottom: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionAction: { fontSize: 13, fontWeight: '700', color: Colors.brandPrimaryDark },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radii.card, padding: 14, ...Shadows.card },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.brandPrimaryLight, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  contactText: { fontSize: 14, color: Colors.textPrimary },
  about: { fontSize: 14, color: Colors.textPrimary, lineHeight: 21 },
  placeholder: { fontSize: 13, color: Colors.textTertiary, lineHeight: 19 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.brandPrimaryLight, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radii.pill },
  chipGrey: { backgroundColor: Colors.statusGreyBg },
  chipText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  sheet: { flex: 1, backgroundColor: Colors.bgPage },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  form: { paddingHorizontal: 16, paddingBottom: 24 },
  formGroup: { fontSize: 12, fontWeight: '800', color: Colors.brandPrimaryDark, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 2 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.divider, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary },
  textArea: { minHeight: 100, textAlignVertical: 'top', marginTop: 6 },
  timeRow: { flexDirection: 'row', gap: 10 },
  sheetFooter: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.divider },
  saveBtn: { backgroundColor: Colors.brandPrimary, borderRadius: Radii.button, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  saveText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  pickOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickSheet: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radii.dialog, borderTopRightRadius: Radii.dialog, paddingHorizontal: 16 },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 6 },
  pickItem: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.divider, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radii.pill, backgroundColor: Colors.white },
  pickItemOn: { backgroundColor: Colors.brandPrimary, borderColor: Colors.brandPrimary },
  pinField: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinFieldText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 20 },
  pickText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoTile: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.statusGreyBg },
  photoImg: { width: '100%', height: '100%' },
  photoAdd: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.brandPrimary, backgroundColor: Colors.brandPrimaryLight, padding: 6 },
  photoAddText: { fontSize: 11, fontWeight: '700', color: Colors.brandPrimaryDark, marginTop: 4, textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  viewerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
});
