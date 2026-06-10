import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/data/store';
import { useRole } from '@/hooks/useRole';
import { choreRepo } from '@/data/repositories';
import { useTheme } from '@/theme';

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { actor, isAdmin } = useRole();
  const { colors } = useTheme();
  const setActiveMember = useStore((s) => s.setActiveMember);

  const activeHouseholdId = useStore((s) => s.activeHouseholdId);
  const chores = useStore((s) => s.chores).filter((c) => c.householdId === activeHouseholdId);
  const supplies = useStore((s) => s.supplies).filter((s) => s.householdId === activeHouseholdId);
  const members = useStore((s) => s.members).filter((m) => m.householdId === activeHouseholdId);

  function handleLogout() {
    setActiveMember(null);
    // Root layout's Redirect reacts to activeMemberId becoming null
  }

  const myOpenChores = chores.filter((c) => c.assigneeId === actor?.id && c.status !== 'completed');
  const pendingCount = supplies.filter((s) => s.status === 'requested').length;
  const shoppingCount = supplies.filter((s) => s.status === 'approved').length;
  const myRequests = supplies.filter((s) => s.requestedById === actor?.id && s.status === 'requested');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.greetingRow}>
        <Text style={[styles.greeting, { color: colors.text, flex: 1 }]}>{t('home.greeting', { name: actor?.name ?? '' })}</Text>
        <Pressable onPress={handleLogout} style={styles.logoutBtn} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={colors.muted} />
        </Pressable>
      </View>

      <View style={[styles.pointsBadge, { backgroundColor: colors.card }]}>
        <Ionicons name="trophy-outline" size={18} color={colors.accent} />
        <Text style={[styles.pointsText, { color: colors.accent }]}>{t('home.myPoints', { points: actor?.points ?? 0 })}</Text>
      </View>

      <View style={styles.bannerRow}>
        {isAdmin && pendingCount > 0 && (
          <Pressable style={[styles.banner, { backgroundColor: colors.bannerWarningBg }]} onPress={() => router.push('/(tabs)/supplies')}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.bannerWarningText} />
            <Text style={{ color: colors.bannerWarningText, fontWeight: '600' }}>{t('home.pendingApprovals', { count: pendingCount })}</Text>
          </Pressable>
        )}
        {shoppingCount > 0 && (
          <Pressable style={[styles.banner, { backgroundColor: colors.bannerInfoBg }]} onPress={() => router.push('/(tabs)/shopping')}>
            <Ionicons name="cart-outline" size={20} color={colors.bannerInfoText} />
            <Text style={{ color: colors.bannerInfoText, fontWeight: '600' }}>{t('home.shoppingCount', { count: shoppingCount })}</Text>
          </Pressable>
        )}
      </View>

      {/* My chores */}
      <Text style={[styles.section, { color: colors.text }]}>{t('home.myChoresToday')}</Text>
      {myOpenChores.length === 0 ? (
        <Text style={{ color: colors.muted }}>{t('home.nothingDue')}</Text>
      ) : (
        myOpenChores.map((c) => (
          <Pressable key={c.id} style={[styles.card, { backgroundColor: colors.card }]} onPress={() => router.push('/(tabs)/chores')}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{c.title}</Text>
                {c.dueDate ? (
                  <Text style={{ color: colors.muted }}>{t('chores.dueOn', { date: c.dueDate })}</Text>
                ) : null}
              </View>
              <Text style={[styles.statusBadge, { color: colors.primary }]}>{t(`chores.status.${c.status}`)}</Text>
            </View>
            {c.recurrence !== 'none' && (
              <Text style={[styles.recurrenceBadge, { color: colors.accent }]}>
                <Ionicons name="repeat-outline" size={12} /> {t(`chores.recurrenceOptions.${c.recurrence}`)}
              </Text>
            )}
            {c.status === 'assigned' && (
              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={(e) => { e.stopPropagation(); choreRepo.start(c.id); }}
              >
                <Text style={styles.btnText}>{t('chores.start')}</Text>
              </Pressable>
            )}
            {c.status === 'in_progress' && (
              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={(e) => {
                  e.stopPropagation();
                  const { pointsAwarded } = choreRepo.complete(c.id);
                  if (pointsAwarded > 0) Alert.alert(t('chores.pointsAwarded', { points: pointsAwarded }));
                }}
              >
                <Text style={styles.btnText}>{t('chores.markDone')}</Text>
              </Pressable>
            )}
          </Pressable>
        ))
      )}

      <Text style={[styles.section, { color: colors.text }]}>{t('home.myRequests')}</Text>
      {myRequests.length === 0 ? (
        <Text style={{ color: colors.muted }}>{t('home.noRequests')}</Text>
      ) : (
        myRequests.map((s) => (
          <Pressable key={s.id} style={[styles.card, { backgroundColor: colors.card }]} onPress={() => router.push('/(tabs)/supplies')}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {s.name}
                {s.quantity ? ` · ${s.quantity}` : ''}
              </Text>
              {s.urgency === 'urgent' && (
                <Text style={styles.urgentBadge}>{t('supplies.urgent')}</Text>
              )}
            </View>
            <Text style={{ color: colors.muted }}>{t('supplies.pending')}</Text>
          </Pressable>
        ))
      )}

      {/* Leaderboard */}
      <Text style={[styles.section, { color: colors.text }]}>{t('home.leaderboard')}</Text>
      {[...members].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).map((m, idx) => (
        <View key={m.id} style={[styles.leaderRow, { backgroundColor: colors.card }]}>
          <Text style={[styles.leaderRank, { color: colors.muted }]}>{idx + 1}</Text>
          <View style={[styles.leaderAvatar, { backgroundColor: m.color }]}>
            <Text style={styles.leaderAvatarText}>{m.name[0]}</Text>
          </View>
          <Text style={[styles.leaderName, { color: colors.text }]}>{m.name}</Text>
          <View style={styles.leaderPointsWrap}>
            <Ionicons name="trophy" size={14} color={colors.accent} />
            <Text style={[styles.leaderPoints, { color: colors.accent }]}>{t('home.pointsLabel', { points: m.points ?? 0 })}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  greetingRow: { flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: 22, fontWeight: '700' },
  logoutBtn: { padding: 4 },
  bannerRow: { gap: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  card: { padding: 12, borderRadius: 8, gap: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  statusBadge: { fontSize: 12, fontWeight: '600' },
  recurrenceBadge: { fontSize: 12, fontWeight: '600' },
  urgentBadge: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
  btn: { paddingVertical: 8, borderRadius: 6, alignItems: 'center', marginTop: 4 },
  btnText: { color: 'white', fontWeight: '600' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  pointsText: { fontSize: 14, fontWeight: '700' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, gap: 10 },
  leaderRank: { fontSize: 14, fontWeight: '700', width: 20, textAlign: 'center' },
  leaderAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  leaderAvatarText: { color: 'white', fontWeight: '700', fontSize: 14 },
  leaderName: { flex: 1, fontSize: 14, fontWeight: '600' },
  leaderPointsWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leaderPoints: { fontSize: 13, fontWeight: '700' },
});
