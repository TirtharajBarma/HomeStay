import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Booking, Room } from '../types';
import { Colors, Radii, Shadows } from '../theme/colors';
import { heldUntil } from '../utils/rooms';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIMELINE_DAYS = 14;
const CELL_W = 46;
const CELL_H = 42;
const LABEL_W = 64;

interface Props {
  rooms: Room[];
  bookings: Booking[];
  onOpenBooking: (b: Booking) => void;
  onNewBooking: (room: Room, day: number) => void;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const addDays = (ms: number, n: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
};

export const OccupancyGrid: React.FC<Props> = ({
  rooms,
  bookings,
  onOpenBooking,
  onNewBooking,
}) => {
  const insets = useSafeAreaInsets();

  // View mode: 'month' (User's recommended Monthly Grid) vs 'timeline' (14-day multi-room matrix)
  const [viewMode, setViewMode] = useState<'month' | 'timeline'>('month');

  // Filter 1: Month & Year (defaults to current month)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Filter 2: Room Selection (defaults to first room, or 'ALL')
  const [selectedRoomId, setSelectedRoomId] = useState<number | 'ALL'>(() => {
    return rooms.length > 0 ? rooms[0].id : 'ALL';
  });

  // Modal inspection on cell tap
  const [inspectDate, setInspectDate] = useState<number | null>(null);

  const [now] = useState(() => Date.now());
  const today = useMemo(() => startOfDay(now), [now]);
  const nowMonth = useMemo(() => new Date(now), [now]);

  // Timeline view state
  const [timelineFrom, setTimelineFrom] = useState(() => startOfDay(now));

  const isCurrentMonth =
    currentMonth.getFullYear() === nowMonth.getFullYear() &&
    currentMonth.getMonth() === nowMonth.getMonth();

  // Booking helper
  const holder = useCallback(
    (room: Room, day: number) =>
      bookings.find(
        (b) =>
          b.roomNumber === room.number &&
          b.status !== 'CANCELLED' &&
          b.checkIn <= day &&
          day < heldUntil(b)
      ),
    [bookings]
  );

  const colorOf = (b: Booking) =>
    b.external?.conflict
      ? Colors.statusRed
      : b.status === 'CHECKED_IN'
      ? Colors.brandPrimaryDark
      : b.external
      ? Colors.statusBlue
      : Colors.brandPrimary;

  // Month navigation
  const shiftMonth = (delta: number) => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1)
    );
  };

  const jumpToToday = () => {
    const d = new Date(now);
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  // Month days computation
  const { monthLabel, daysInMonth, monthWeeks } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const label = currentMonth.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const cells: (number | null)[] = [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: totalDays }, (_, i) =>
        new Date(year, month, i + 1).getTime()
      ),
    ];
    // Pad to full 7-column rows
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    return {
      monthLabel: label,
      daysInMonth: totalDays,
      monthWeeks: weeks,
    };
  }, [currentMonth]);

  // Selected room object
  const activeRoom =
    selectedRoomId === 'ALL'
      ? null
      : rooms.find((r) => r.id === selectedRoomId) || rooms[0] || null;

  // Month statistics computation
  const stats = useMemo(() => {
    let bookedNights = 0;
    let vacantNights = 0;
    let maintenanceNights = 0;

    const days = Array.from({ length: daysInMonth }, (_, i) =>
      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1).getTime()
    );

    if (activeRoom) {
      days.forEach((day) => {
        if (activeRoom.status === 'MAINTENANCE') {
          maintenanceNights++;
        } else if (holder(activeRoom, day)) {
          bookedNights++;
        } else {
          vacantNights++;
        }
      });
      const occupancyRate =
        daysInMonth > 0 ? Math.round((bookedNights / daysInMonth) * 100) : 0;
      return { bookedNights, vacantNights, maintenanceNights, occupancyRate };
    } else {
      // ALL rooms summary
      let totalRoomNights = daysInMonth * Math.max(1, rooms.length);
      days.forEach((day) => {
        rooms.forEach((r) => {
          if (r.status === 'MAINTENANCE') {
            maintenanceNights++;
          } else if (holder(r, day)) {
            bookedNights++;
          } else {
            vacantNights++;
          }
        });
      });
      const occupancyRate =
        totalRoomNights > 0
          ? Math.round((bookedNights / totalRoomNights) * 100)
          : 0;
      return { bookedNights, vacantNights, maintenanceNights, occupancyRate };
    }
  }, [currentMonth, activeRoom, rooms, daysInMonth, holder]);

  // Timeline days
  const timelineDays = Array.from({ length: TIMELINE_DAYS }, (_, i) =>
    addDays(timelineFrom, i)
  );
  const occupiedTonight = rooms.filter((r) => holder(r, today)).length;

  // Cell status evaluator
  const getCellStatus = useCallback(
    (dayMs: number) => {
      if (!activeRoom) {
        // ALL rooms mode
        const total = rooms.length;
        if (total === 0) return { type: 'VACANT', label: 'No rooms', freeCount: 0 };
        const booked = rooms.filter((r) => holder(r, dayMs)).length;
        const maintenance = rooms.filter((r) => r.status === 'MAINTENANCE').length;
        const free = total - booked - maintenance;

        if (booked === total) {
          return { type: 'ALL_BOOKED', label: 'Full', freeCount: 0 };
        }
        if (free === total) {
          return { type: 'ALL_VACANT', label: `${total} free`, freeCount: total };
        }
        return { type: 'PARTIAL', label: `${free}/${total} free`, freeCount: free };
      }

      if (activeRoom.status === 'MAINTENANCE') {
        return { type: 'MAINTENANCE', label: 'Blocked', booking: null };
      }

      const b = holder(activeRoom, dayMs);
      if (b) {
        return {
          type: 'BOOKED',
          label: b.guestName.split(' ')[0] || 'Booked',
          booking: b,
        };
      }

      return { type: 'VACANT', label: 'Vacant', booking: null };
    },
    [activeRoom, rooms, holder]
  );

  // Inspect modal content
  const inspectedData = useMemo(() => {
    if (!inspectDate) return null;
    const dateObj = new Date(inspectDate);
    const dateStr = dateObj.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const isPast = inspectDate < today;

    if (activeRoom) {
      const status = getCellStatus(inspectDate);
      return {
        dateStr,
        isPast,
        mode: 'single' as const,
        room: activeRoom,
        status,
        booking: status.booking,
      };
    } else {
      // All rooms breakdown for this day
      const roomBreakdown = rooms.map((r) => {
        const b = holder(r, inspectDate);
        return {
          room: r,
          booking: b,
          isMaintenance: r.status === 'MAINTENANCE',
        };
      });
      return {
        dateStr,
        isPast,
        mode: 'all' as const,
        roomBreakdown,
      };
    }
  }, [inspectDate, activeRoom, rooms, today, getCellStatus, holder]);

  const handleDayPress = (dayMs: number) => {
    setInspectDate(dayMs);
  };

  return (
    <View style={styles.container}>
      {/* Top Header & View Toggle (Month Grid vs Timeline) */}
      <View style={styles.headerBar}>
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[
              styles.viewModeBtn,
              viewMode === 'month' && styles.viewModeBtnActive,
            ]}
            onPress={() => setViewMode('month')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar"
              size={15}
              color={
                viewMode === 'month' ? Colors.brandPrimaryDark : Colors.textSecondary
              }
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'month' && styles.viewModeTextActive,
              ]}
            >
              Month Grid
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeBtn,
              viewMode === 'timeline' && styles.viewModeBtnActive,
            ]}
            onPress={() => setViewMode('timeline')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="list"
              size={15}
              color={
                viewMode === 'timeline'
                  ? Colors.brandPrimaryDark
                  : Colors.textSecondary
              }
            />
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'timeline' && styles.viewModeTextActive,
              ]}
            >
              Timeline
            </Text>
          </TouchableOpacity>
        </View>

        {!isCurrentMonth && viewMode === 'month' && (
          <TouchableOpacity
            style={styles.todayPill}
            onPress={jumpToToday}
            activeOpacity={0.7}
          >
            <Text style={styles.todayPillText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      {viewMode === 'month' ? (
        /* ==================== MONTH GRID VIEW ==================== */
        <View>
          {/* FILTER 1: Date & Month Navigation */}
          <View style={styles.filterSection}>
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => shiftMonth(-1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={Colors.brandPrimaryDark}
                />
              </TouchableOpacity>

              <View style={styles.monthTitleBox}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={Colors.brandPrimary}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.monthTitleText}>{monthLabel}</Text>
              </View>

              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => shiftMonth(1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.brandPrimaryDark}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* FILTER 2: Room Selector (Horizontal Pills) */}
          <View style={styles.roomFilterContainer}>
            <Text style={styles.filterLabel}>SELECT ROOM:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.roomPillsScroll}
            >
              {rooms.map((r) => {
                const isSelected = selectedRoomId === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.roomPill,
                      isSelected && styles.roomPillActive,
                    ]}
                    onPress={() => setSelectedRoomId(r.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="bed-outline"
                      size={14}
                      color={isSelected ? Colors.white : Colors.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.roomPillText,
                        isSelected && styles.roomPillTextActive,
                      ]}
                    >
                      Room {r.number}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* All Rooms option */}
              <TouchableOpacity
                style={[
                  styles.roomPill,
                  selectedRoomId === 'ALL' && styles.roomPillActive,
                ]}
                onPress={() => setSelectedRoomId('ALL')}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="grid-outline"
                  size={14}
                  color={
                    selectedRoomId === 'ALL' ? Colors.white : Colors.textSecondary
                  }
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.roomPillText,
                    selectedRoomId === 'ALL' && styles.roomPillTextActive,
                  ]}
                >
                  All Rooms ({rooms.length})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Monthly Statistics Summary Bar */}
          <View style={styles.statsBanner}>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statNumber}>
                  {stats.occupancyRate}%
                </Text>
                <Text style={styles.statLabel}>Occupancy</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <View style={styles.statDotRow}>
                  <View
                    style={[
                      styles.indicatorDot,
                      { backgroundColor: Colors.statusRed },
                    ]}
                  />
                  <Text style={styles.statNumber}>{stats.bookedNights}</Text>
                </View>
                <Text style={styles.statLabel}>Booked Nights</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <View style={styles.statDotRow}>
                  <View
                    style={[
                      styles.indicatorDot,
                      { backgroundColor: Colors.statusGreen },
                    ]}
                  />
                  <Text style={styles.statNumber}>{stats.vacantNights}</Text>
                </View>
                <Text style={styles.statLabel}>Vacant Nights</Text>
              </View>
              {stats.maintenanceNights > 0 && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={styles.statNumber}>
                      {stats.maintenanceNights}
                    </Text>
                    <Text style={styles.statLabel}>Blocked</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Calendar Card Container */}
          <View style={styles.calendarCard}>
            {/* Weekday Header (Sun - Sat) */}
            <View style={styles.weekdayHeaderRow}>
              {WEEKDAYS.map((wd) => (
                <View key={wd} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{wd}</Text>
                </View>
              ))}
            </View>

            {/* Weeks */}
            {monthWeeks.map((week, wIndex) => (
              <View key={`week-${wIndex}`} style={styles.weekRow}>
                {week.map((dayMs, dIndex) => {
                  if (dayMs === null) {
                    return (
                      <View
                        key={`blank-${wIndex}-${dIndex}`}
                        style={styles.emptyDayCell}
                      />
                    );
                  }

                  const dateObj = new Date(dayMs);
                  const dayNum = dateObj.getDate();
                  const isToday = dayMs === today;
                  const isPast = dayMs < today;
                  const cellStatus = getCellStatus(dayMs);

                  // Visual styling by status
                  let cellBg = Colors.statusGreenBg;
                  let cellBorder = '#86EFAC';
                  let badgeColor = Colors.statusGreen;
                  let badgeBg = '#BBF7D0';

                  if (
                    cellStatus.type === 'BOOKED' ||
                    cellStatus.type === 'ALL_BOOKED'
                  ) {
                    cellBg = Colors.statusRedBg;
                    cellBorder = '#FCA5A5';
                    badgeColor = Colors.statusRed;
                    badgeBg = '#FECDD3';
                  } else if (cellStatus.type === 'PARTIAL') {
                    cellBg = Colors.statusOrangeBg;
                    cellBorder = '#FCD34D';
                    badgeColor = Colors.statusOrange;
                    badgeBg = '#FDE68A';
                  } else if (cellStatus.type === 'MAINTENANCE') {
                    cellBg = '#F1F5F9';
                    cellBorder = '#CBD5E1';
                    badgeColor = '#64748B';
                    badgeBg = '#E2E8F0';
                  }

                  return (
                    <TouchableOpacity
                      key={dayMs}
                      style={[
                        styles.dayCell,
                        {
                          backgroundColor: cellBg,
                          borderColor: cellBorder,
                          opacity: isPast ? 0.68 : 1,
                        },
                        isToday && styles.dayCellToday,
                      ]}
                      onPress={() => handleDayPress(dayMs)}
                      activeOpacity={0.7}
                    >
                      {/* Day Number */}
                      <View
                        style={[
                          styles.dayNumWrapper,
                          isToday && styles.dayNumTodayBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumText,
                            isToday && styles.dayNumTodayText,
                          ]}
                        >
                          {dayNum}
                        </Text>
                      </View>

                      {/* Status Indicator / Label */}
                      <View
                        style={[
                          styles.cellBadge,
                          { backgroundColor: badgeBg },
                        ]}
                      >
                        <Text
                          style={[styles.cellBadgeText, { color: badgeColor }]}
                          numberOfLines={1}
                        >
                          {cellStatus.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Quick Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendBox,
                  {
                    backgroundColor: Colors.statusGreenBg,
                    borderColor: '#86EFAC',
                  },
                ]}
              />
              <Text style={styles.legendLabel}>Vacant (Green)</Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendBox,
                  { backgroundColor: Colors.statusRedBg, borderColor: '#FCA5A5' },
                ]}
              />
              <Text style={styles.legendLabel}>Booked (Red)</Text>
            </View>

            {selectedRoomId === 'ALL' && (
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendBox,
                    {
                      backgroundColor: Colors.statusOrangeBg,
                      borderColor: '#FCD34D',
                    },
                  ]}
                />
                <Text style={styles.legendLabel}>Partial (Orange)</Text>
              </View>
            )}

            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendBox,
                  { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
                ]}
              />
              <Text style={styles.legendLabel}>Maintenance</Text>
            </View>
          </View>

          <Text style={styles.helperHint}>
            Tap any block to inspect booking details or create a new reservation.
          </Text>
        </View>
      ) : (
        /* ==================== TIMELINE VIEW (ORIGINAL MATRIX) ==================== */
        <View style={styles.timelineSection}>
          <View style={styles.timelineToolbar}>
            <TouchableOpacity
              style={styles.navArrowBtn}
              onPress={() => setTimelineFrom(addDays(timelineFrom, -7))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={Colors.brandPrimaryDark}
              />
            </TouchableOpacity>
            <Text style={styles.timelineRangeText}>
              {new Date(timelineDays[0]).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}{' '}
              –{' '}
              {new Date(
                timelineDays[TIMELINE_DAYS - 1]
              ).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
            <TouchableOpacity
              style={styles.navArrowBtn}
              onPress={() => setTimelineFrom(addDays(timelineFrom, 7))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.brandPrimaryDark}
              />
            </TouchableOpacity>
            {timelineFrom !== today && (
              <TouchableOpacity
                style={styles.todayPill}
                onPress={() => setTimelineFrom(today)}
              >
                <Text style={styles.todayPillText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.summaryText}>
            Tonight: {occupiedTonight} of {rooms.length} rooms occupied
          </Text>

          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            {/* Room labels */}
            <View style={{ width: LABEL_W }}>
              <View style={[styles.timelineHeadCell, { width: LABEL_W }]} />
              {rooms.map((r) => (
                <View
                  key={r.id}
                  style={[styles.timelineLabelCell, { width: LABEL_W }]}
                >
                  <Text style={styles.timelineLabelText} numberOfLines={1}>
                    {r.number}
                  </Text>
                </View>
              ))}
            </View>

            {/* Scrolling days */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={{ flexDirection: 'row' }}>
                  {timelineDays.map((d) => {
                    const date = new Date(d);
                    const isDToday = d === today;
                    return (
                      <View
                        key={d}
                        style={[
                          styles.timelineHeadCell,
                          isDToday && styles.timelineHeadToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.timelineHeadDow,
                            isDToday && styles.timelineHeadTodayText,
                          ]}
                        >
                          {date
                            .toLocaleDateString('en-IN', { weekday: 'short' })
                            .slice(0, 2)}
                        </Text>
                        <Text
                          style={[
                            styles.timelineHeadDay,
                            isDToday && styles.timelineHeadTodayText,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {rooms.map((r) => (
                  <View key={r.id} style={{ flexDirection: 'row' }}>
                    {timelineDays.map((d) => {
                      const b = holder(r, d);
                      if (b) {
                        const starts = b.checkIn === d || d === timelineDays[0];
                        return (
                          <TouchableOpacity
                            key={d}
                            style={[
                              styles.timelineCell,
                              { backgroundColor: colorOf(b) },
                            ]}
                            onPress={() => onOpenBooking(b)}
                            activeOpacity={0.8}
                          >
                            {starts && (
                              <Text
                                style={styles.timelineCellText}
                                numberOfLines={1}
                              >
                                {b.guestName.split(' ')[0]}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      }
                      if (r.status === 'MAINTENANCE') {
                        return (
                          <View
                            key={d}
                            style={[
                              styles.timelineCell,
                              styles.timelineCellBlocked,
                            ]}
                          />
                        );
                      }
                      const past = d < today;
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[
                            styles.timelineCell,
                            styles.timelineCellFree,
                            past && styles.timelineCellPast,
                          ]}
                          disabled={past}
                          onPress={() => onNewBooking(r, d)}
                          activeOpacity={0.6}
                        >
                          {!past && (
                            <Ionicons
                              name="add"
                              size={14}
                              color={Colors.divider}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* ==================== INSPECT DAY MODAL / BOTTOM SHEET ==================== */}
      <Modal
        visible={inspectDate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectDate(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setInspectDate(null)}
        >
          <TouchableOpacity
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(28, insets.bottom + 16) },
            ]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalDateText}>
                  {inspectedData?.dateStr}
                </Text>
                <Text style={styles.modalSubText}>
                  {inspectedData?.mode === 'single'
                    ? `Room ${inspectedData?.room?.number} (${inspectedData?.room?.floor})`
                    : `All Rooms Overview`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInspectDate(null)}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Single Room Inspection */}
            {inspectedData?.mode === 'single' && (
              <View style={styles.modalBody}>
                {inspectedData.status?.type === 'BOOKED' && inspectedData.booking ? (
                  <View>
                    <View style={styles.bookingCard}>
                      <View style={styles.bookingStatusRow}>
                        <View style={styles.bookedBadge}>
                          <Text style={styles.bookedBadgeText}>Booked</Text>
                        </View>
                        <Text style={styles.bookingSourceText}>
                          {inspectedData.booking.source || 'Direct'}
                        </Text>
                      </View>

                      <Text style={styles.guestNameText}>
                        {inspectedData.booking.guestName}
                      </Text>

                      {inspectedData.booking.phone ? (
                        <View style={styles.contactRow}>
                          <Text style={styles.guestPhoneText}>
                            {inspectedData.booking.phone}
                          </Text>
                          <View style={styles.contactActions}>
                            <TouchableOpacity
                              style={styles.callIconBtn}
                              onPress={() => {
                                Linking.openURL(
                                  `tel:${inspectedData.booking?.phone}`
                                ).catch(() => {});
                              }}
                            >
                              <Ionicons
                                name="call"
                                size={15}
                                color={Colors.white}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.waIconBtn}
                              onPress={() => {
                                const clean = (
                                  inspectedData.booking?.phone || ''
                                ).replace(/\D/g, '');
                                Linking.openURL(
                                  `https://wa.me/${clean}`
                                ).catch(() => {});
                              }}
                            >
                              <Ionicons
                                name="logo-whatsapp"
                                size={16}
                                color={Colors.white}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.bookingDetailsRow}>
                        <View>
                          <Text style={styles.detailLabel}>Stay Dates</Text>
                          <Text style={styles.detailVal}>
                            {new Date(
                              inspectedData.booking.checkIn
                            ).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}{' '}
                            –{' '}
                            {new Date(
                              inspectedData.booking.checkOut
                            ).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.detailLabel}>Amount</Text>
                          <Text style={styles.detailVal}>
                            ₹{inspectedData.booking.amount} (
                            {inspectedData.booking.paid ? 'Paid' : 'Due'})
                          </Text>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={() => {
                        const b = inspectedData.booking;
                        setInspectDate(null);
                        if (b) onOpenBooking(b);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.primaryActionBtnText}>
                        View Booking Details
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={16}
                        color={Colors.white}
                        style={{ marginLeft: 6 }}
                      />
                    </TouchableOpacity>
                  </View>
                ) : inspectedData.status?.type === 'MAINTENANCE' ? (
                  <View style={styles.maintenanceNoticeBox}>
                    <Ionicons
                      name="construct-outline"
                      size={28}
                      color={Colors.statusGrey}
                      style={{ marginBottom: 6 }}
                    />
                    <Text style={styles.maintenanceTitle}>
                      Room Under Maintenance
                    </Text>
                    <Text style={styles.maintenanceSub}>
                      This room is marked for cleaning, repairs, or blocked by the
                      owner. No bookings can be made for this night.
                    </Text>
                  </View>
                ) : (
                  <View>
                    <View style={styles.vacantNoticeBox}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={32}
                        color={Colors.statusGreen}
                        style={{ marginBottom: 6 }}
                      />
                      <Text style={styles.vacantTitle}>Room is Vacant</Text>
                      <Text style={styles.vacantSub}>
                        Room {inspectedData.room?.number} is available on this
                        date. Standard rate is ₹{inspectedData.room?.price} / night.
                      </Text>
                    </View>

                    {!inspectedData.isPast ? (
                      <TouchableOpacity
                        style={[
                          styles.primaryActionBtn,
                          { backgroundColor: Colors.brandPrimary },
                        ]}
                        onPress={() => {
                          const r = inspectedData.room;
                          const d = inspectDate;
                          setInspectDate(null);
                          if (r && d) onNewBooking(r, d);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={18}
                          color={Colors.white}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.primaryActionBtnText}>
                          + Book Room on this Date
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.pastDateNotice}>
                        <Text style={styles.pastDateNoticeText}>
                          This date is in the past.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* All Rooms Breakdown for this Date */}
            {inspectedData?.mode === 'all' && (
              <ScrollView style={{ maxHeight: 300 }}>
                {inspectedData.roomBreakdown?.map((item) => (
                  <View key={item.room.id} style={styles.roomBreakdownRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomBreakdownTitle}>
                        Room {item.room.number}
                      </Text>
                      <Text style={styles.roomBreakdownSub}>
                        {item.booking
                          ? `Booked: ${item.booking.guestName}`
                          : item.isMaintenance
                          ? 'Maintenance'
                          : 'Vacant (Available)'}
                      </Text>
                    </View>

                    {item.booking ? (
                      <TouchableOpacity
                        style={styles.smActionBtn}
                        onPress={() => {
                          setInspectDate(null);
                          onOpenBooking(item.booking!);
                        }}
                      >
                        <Text style={styles.smActionBtnText}>View</Text>
                      </TouchableOpacity>
                    ) : !item.isMaintenance && !inspectedData.isPast ? (
                      <TouchableOpacity
                        style={[
                          styles.smActionBtn,
                          { backgroundColor: Colors.brandPrimary },
                        ]}
                        onPress={() => {
                          const d = inspectDate;
                          setInspectDate(null);
                          if (d) onNewBooking(item.room, d);
                        }}
                      >
                        <Text
                          style={[styles.smActionBtnText, { color: Colors.white }]}
                        >
                          Book
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#ECE7DE',
    borderRadius: Radii.pill,
    padding: 3,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    gap: 4,
  },
  viewModeBtnActive: {
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  viewModeTextActive: {
    color: Colors.brandPrimaryDark,
    fontWeight: '700',
  },
  todayPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.brandPrimaryLight,
    borderWidth: 1,
    borderColor: '#C7E0D2',
  },
  todayPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandPrimaryDark,
  },

  /* FILTER 1: Month / Year Navigation */
  filterSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 10,
    ...Shadows.sm,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brandPrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },

  /* FILTER 2: Room Selection */
  roomFilterContainer: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.textTertiary,
    marginBottom: 6,
    marginLeft: 2,
  },
  roomPillsScroll: {
    paddingRight: 10,
    gap: 8,
  },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  roomPillActive: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  roomPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roomPillTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  /* Month Stats Banner */
  statsBanner: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.divider,
  },

  /* Calendar Card */
  calendarCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.sm,
  },
  weekdayHeaderRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  emptyDayCell: {
    flex: 1,
    height: 52,
  },
  dayCell: {
    flex: 1,
    height: 52,
    paddingVertical: 3,
    paddingHorizontal: 1,
    borderRadius: 8,
    borderWidth: 1.2,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: Colors.brandPrimary,
  },
  dayNumWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumTodayBadge: {
    backgroundColor: Colors.brandPrimary,
  },
  dayNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dayNumTodayText: {
    color: Colors.white,
    fontWeight: '800',
  },
  cellBadge: {
    width: '100%',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 1,
    alignItems: 'center',
  },
  cellBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  /* Legend */
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  helperHint: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 8,
    paddingHorizontal: 4,
  },

  /* Timeline Matrix Styles */
  timelineSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.card,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.sm,
  },
  timelineToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  timelineRangeText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  timelineHeadCell: {
    width: CELL_W,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineHeadToday: {
    backgroundColor: Colors.brandPrimaryLight,
    borderRadius: 8,
  },
  timelineHeadDow: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '700',
  },
  timelineHeadDay: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  timelineHeadTodayText: {
    color: Colors.brandPrimaryDark,
  },
  timelineLabelCell: {
    height: CELL_H,
    justifyContent: 'center',
    paddingRight: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  timelineLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  timelineCell: {
    width: CELL_W,
    height: CELL_H,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  timelineCellFree: {
    backgroundColor: '#F8FAFC',
    borderColor: Colors.divider,
  },
  timelineCellPast: {
    backgroundColor: '#F1F5F9',
  },
  timelineCellBlocked: {
    backgroundColor: '#CBD5E1',
  },
  timelineCellText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Modal / Bottom Sheet */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radii.dialog,
    borderTopRightRadius: Radii.dialog,
    padding: 20,
    paddingBottom: 36,
    ...Shadows.hover,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: 12,
  },
  modalDateText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalSubText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgPage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    gap: 12,
  },
  bookingCard: {
    backgroundColor: Colors.bgPage,
    borderRadius: Radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 12,
  },
  bookingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bookedBadge: {
    backgroundColor: Colors.statusRedBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  bookedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.statusRed,
    textTransform: 'uppercase',
  },
  bookingSourceText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  guestNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  guestPhoneText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  callIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 8,
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  primaryActionBtn: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: Radii.button,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  vacantNoticeBox: {
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: Colors.statusGreenBg,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginBottom: 14,
  },
  vacantTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.statusGreen,
  },
  vacantSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  maintenanceNoticeBox: {
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  maintenanceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  maintenanceSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  pastDateNotice: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  pastDateNoticeText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  roomBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  roomBreakdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  roomBreakdownSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  smActionBtn: {
    backgroundColor: Colors.brandPrimaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  smActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandPrimaryDark,
  },
});
