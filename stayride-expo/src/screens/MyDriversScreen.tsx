import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStayRide } from '../data/store';
import { Header } from '../components/Header';
import { DriverItem } from '../components/DriverItem';
import { Colors } from '../theme/colors';
import { FormScroll } from '../components/FormScroll';
import { KeyboardAwareOverlay } from '../components/KeyboardAwareOverlay';
import { Driver } from '../types';
import { reportOutcome } from '../utils/report';
import { vehicleLabel } from '../utils/vehicle';
import { api } from '../data/api';

const VEHICLE_TYPES = ['SUV', 'Sedan', '7-seater', '9-seater'];
const ROUTE_OPTIONS = ['NJP', 'Bagdogra', 'Sightseeing', 'Local'];

export const MyDriversScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const {
    drivers,
    createDriver,
    updateDriver,
    deleteDriver,
    setDriverActive,
  } = useStayRide();

  const [formVisible, setFormVisible] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [vehicleType, setVehicleType] = useState('SUV');
  const [seats, setSeats] = useState('4');
  const [area, setArea] = useState('');
  const [available, setAvailable] = useState(true);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(['Local', 'NJP']);

  // Closing the add/edit form ends that submission: a reopened form gets a fresh Idempotency-Key
  useEffect(() => {
    if (!formVisible) api.clearIdempotencyKeys('/drivers');
  }, [formVisible]);

  const activeCount = drivers.filter((d) => d.active).length;
  const availableCount = drivers.filter((d) => d.active && d.available).length;

  const openAddForm = () => {
    setEditingDriver(null);
    setName('');
    setPhone('');
    setVehicle('');
    setVehicleType('SUV');
    setSeats('4');
    setArea('');
    setAvailable(true);
    setSelectedRoutes(['Local', 'NJP']);
    setFormVisible(true);
  };

  const openEditForm = (d: Driver) => {
    setEditingDriver(d);
    setName(d.name);
    setPhone(d.phone);
    setVehicle(d.vehicle);
    setVehicleType(d.vehicleType);
    setSeats(String(d.seats));
    setArea(d.area);
    setAvailable(d.available);
    setSelectedRoutes(d.trips || []);
    setFormVisible(true);
  };

  const handleToggleRoute = (route: string) => {
    if (selectedRoutes.includes(route)) {
      setSelectedRoutes(selectedRoutes.filter((r) => r !== route));
    } else {
      setSelectedRoutes([...selectedRoutes, route]);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedVehicle = vehicle.trim();

    if (!trimmedName) {
      Alert.alert('Required', 'Driver name is required');
      return;
    }
    if (!trimmedPhone) {
      Alert.alert('Required', 'Phone number is required');
      return;
    }
    if (!trimmedVehicle) {
      Alert.alert('Required', 'Vehicle model is required');
      return;
    }

    const parsedSeats = parseInt(seats, 10) || 4;

    if (editingDriver) {
      const outcome = await updateDriver(editingDriver.id, {
        name: trimmedName,
        phone: trimmedPhone,
        vehicle: trimmedVehicle,
        vehicleType: vehicleType as any,
        seats: parsedSeats,
        area: area.trim(),
        trips: selectedRoutes,
        available,
      });
      reportOutcome(outcome, 'Success', `${trimmedName} updated`);
    } else {
      try {
        await createDriver({
          name: trimmedName,
          phone: trimmedPhone,
          vehicle: trimmedVehicle,
          vehicleType: vehicleType as any,
          seats: parsedSeats,
          area: area.trim(),
          trips: selectedRoutes,
          available,
        });
      } catch (e: any) {
        Alert.alert('Not saved', e?.message || 'Please try again.');
        return;
      }
      Alert.alert('Success', `${trimmedName} added to your driver team`);
    }
    setFormVisible(false);
  };

  const handleDelete = (d: Driver) => {
    Alert.alert(
      `Remove ${d.name}?`,
      'He will no longer be offered to guests for cab bookings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const outcome = await deleteDriver(d.id);
            reportOutcome(outcome, 'Removed', `${d.name} removed`);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header title="My Drivers" onBack={() => navigation.goBack()} />

      <FormScroll contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {drivers.length} drivers · {activeCount} active · {availableCount} available now
          </Text>
        </View>

        {drivers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No drivers added yet.</Text>
            <TouchableOpacity style={styles.addFirstBtn} onPress={openAddForm}>
              <Text style={styles.addFirstBtnText}>+ Add your first driver</Text>
            </TouchableOpacity>
          </View>
        ) : (
          drivers.map((driver) => (
            <DriverItem
              key={driver.id}
              driver={driver}
              showActiveToggle
              onPress={() => openEditForm(driver)}
              onToggleActive={(active) => {
                setDriverActive(driver.id, active);
              }}
              onDelete={() => handleDelete(driver)}
            />
          ))
        )}
      </FormScroll>

      {/* Floating Add Driver Button */}
      <TouchableOpacity style={styles.fab} onPress={openAddForm}>
        <Text style={styles.fabIcon}>+</Text>
        <Text style={styles.fabLabel}>Add Driver</Text>
      </TouchableOpacity>

      {/* Driver Form Modal */}
      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <KeyboardAwareOverlay style={{ flex: 1 }}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFormVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingDriver ? 'Edit driver' : 'Add your driver'}
            </Text>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Driver full name"
                placeholderTextColor={Colors.textSecondary}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Phone *</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 98000 00000"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.label}>Vehicle Model *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Innova Crysta, Scorpio"
                placeholderTextColor={Colors.textSecondary}
                value={vehicle}
                onChangeText={setVehicle}
              />

              <Text style={styles.label}>Vehicle Type</Text>
              <View style={styles.chipRow}>
                {VEHICLE_TYPES.map((t) => {
                  const active = vehicleType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                      onPress={() => setVehicleType(t)}
                    >
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {vehicleLabel(t)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Seats</Text>
              <TextInput
                style={styles.input}
                placeholder="4"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="number-pad"
                value={seats}
                onChangeText={setSeats}
              />

              <Text style={styles.label}>Base Location / Area</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Gangtok, Deorali"
                placeholderTextColor={Colors.textSecondary}
                value={area}
                onChangeText={setArea}
              />

              <Text style={styles.label}>Frequent Routes / Pickups</Text>
              <View style={styles.chipRow}>
                {ROUTE_OPTIONS.map((r) => {
                  const active = selectedRoutes.includes(r);
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                      onPress={() => handleToggleRoute(r)}
                    >
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Available for rides right now</Text>
                <Switch
                  value={available}
                  onValueChange={setAvailable}
                  trackColor={{ false: '#D1D5DB', true: Colors.brandPrimaryLight }}
                  thumbColor={available ? Colors.brandPrimary : '#9CA3AF'}
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>
                {editingDriver ? 'Save changes' : 'Add driver'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        </KeyboardAwareOverlay>
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
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginBottom: 14,
  },
  addFirstBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addFirstBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  typeChipActive: {
    backgroundColor: Colors.brandPrimary,
  },
  typeChipText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  typeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
