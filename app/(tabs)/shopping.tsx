import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, SectionList, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/data/store';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/theme';
import { supplyRepo } from '@/data/repositories';
import type { SupplyRequest } from '@/types';

type ShoppingFilter = 'toBuy' | 'purchased';

/** Extract YYYY-MM-DD from an ISO datetime string. */
function toDateKey(iso: string | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/** Format a date key into a human-friendly label. */
function formatDateLabel(dateKey: string, todayKey: string, yesterdayKey: string, t: (k: string) => string): string {
  if (dateKey === todayKey) return t('shopping.today');
  if (dateKey === yesterdayKey) return t('shopping.yesterday');
  return dateKey; // YYYY-MM-DD fallback
}

/** Group items into sections by a date extractor, most recent first. */
function groupByDate(
  items: SupplyRequest[],
  getDate: (item: SupplyRequest) => string | undefined,
  todayKey: string,
  yesterdayKey: string,
  t: (k: string) => string,
): { title: string; data: SupplyRequest[] }[] {
  const groups = new Map<string, SupplyRequest[]>();
  for (const item of items) {
    const key = toDateKey(getDate(item));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  // Sort date keys descending (most recent first)
  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return sorted.map(([key, data]) => ({
    title: formatDateLabel(key, todayKey, yesterdayKey, t),
    data,
  }));
}

export default function ShoppingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isAdmin } = useRole();
  const activeHouseholdId = useStore((s) => s.activeHouseholdId);
  const supplies = useStore((s) => s.supplies).filter((s) => s.householdId === activeHouseholdId);
  const members = useStore((s) => s.members).filter((m) => m.householdId === activeHouseholdId);
  const [filter, setFilter] = useState<ShoppingFilter>('toBuy');

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  const byUrgency = (a: SupplyRequest, b: SupplyRequest) =>
    a.urgency === b.urgency ? 0 : a.urgency === 'urgent' ? -1 : 1;

  const toBuy = supplies.filter((s) => s.status === 'approved').sort(byUrgency);
  const purchased = supplies.filter((s) => s.status === 'purchased').sort(
    (a, b) => (b.purchasedAt ?? '').localeCompare(a.purchasedAt ?? ''),
  );

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const sections = useMemo(() => {
    if (filter === 'toBuy') {
      return groupByDate(toBuy, (item) => item.decidedAt, todayKey, yesterdayKey, t);
    }
    return groupByDate(purchased, (item) => item.purchasedAt, todayKey, yesterdayKey, t);
  }, [filter, toBuy, purchased, todayKey, yesterdayKey, t]);

  function renderItem({ item }: { item: SupplyRequest }) {
    const isPurchased = item.status === 'purchased';
    return (
      <View style={[styles.card, { backgroundColor: colors.card }, isPurchased && styles.cardPurchased]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }, isPurchased && styles.cardTitlePurchased]}>
              {item.name}
              {item.quantity ? ` · ${item.quantity}` : ''}
            </Text>
            {item.note ? <Text style={{ color: colors.muted }}>{item.note}</Text> : null}
          </View>
          {item.urgency === 'urgent' && !isPurchased && (
            <Text style={[styles.urgentBadge, { color: colors.danger }]}>{t('supplies.urgent')}</Text>
          )}
        </View>

        <Text style={{ color: colors.muted }}>{t('shopping.requestedBy', { name: nameOf(item.requestedById) })}</Text>

        {isAdmin && !isPurchased && (
          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => supplyRepo.markPurchased(item.id)}>
              <Ionicons name="checkmark-circle-outline" size={16} color="white" />
              <Text style={styles.btnText}>{t('shopping.markPurchased')}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]} onPress={() => supplyRepo.unapprove(item.id)}>
              <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('shopping.unapprove')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  function renderSectionHeader({ section }: { section: { title: string } }) {
    return (
      <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
        <Ionicons name="calendar-outline" size={14} color={colors.muted} />
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['toBuy', 'purchased'] as ShoppingFilter[]).map((f) => {
            const count = f === 'toBuy' ? toBuy.length : purchased.length;
            return (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, { backgroundColor: colors.chipBg }, filter === f && { backgroundColor: colors.primary }]}>
                <Text style={filter === f ? styles.chipTextActive : [styles.chipText, { color: colors.textSecondary }]}>
                  {t(`shopping.filter.${f}`)} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {!isAdmin && filter === 'toBuy' && <Text style={[styles.hint, { color: colors.muted }]}>{t('shopping.readOnlyHint')}</Text>}

      <SectionList
        sections={sections}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={<Text style={{ color: colors.muted, padding: 16 }}>{t('shopping.empty')}</Text>}
        contentContainerStyle={{ gap: 10, padding: 16 }}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { padding: 16, paddingBottom: 0 },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16 },
  chipText: {},
  chipTextActive: { color: 'white', fontWeight: '600' },
  hint: { paddingHorizontal: 16, paddingTop: 8, fontStyle: 'italic' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600' },
  card: { padding: 12, borderRadius: 8, gap: 4 },
  cardPurchased: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardTitlePurchased: { textDecorationLine: 'line-through' },
  urgentBadge: { fontWeight: '700', fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flexDirection: 'row', gap: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flex: 1 },
  btnText: { color: 'white', fontWeight: '600' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1 },
  btnOutlineText: { fontWeight: '600' },
});
