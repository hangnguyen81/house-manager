import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/data/store';
import { useRole } from '@/hooks/useRole';
import { rewardRepo, redemptionRepo } from '@/data/repositories';
import { useTheme } from '@/theme';
import type { Reward, Redemption } from '@/types';

export default function RewardsScreen() {
  const { t } = useTranslation();
  const { actor, isAdmin } = useRole();
  const { colors } = useTheme();
  const activeHouseholdId = useStore((s) => s.activeHouseholdId);
  const rewards = useStore((s) => s.rewards).filter((r) => r.householdId === activeHouseholdId);
  const redemptions = useStore((s) => s.redemptions).filter((rd) => rd.householdId === activeHouseholdId);
  const members = useStore((s) => s.members).filter((m) => m.householdId === activeHouseholdId);

  const activeRewards = rewards.filter((r) => r.isActive);
  const myRedemptions = redemptions.filter((rd) => rd.memberId === actor?.id);
  const pendingRedemptions = redemptions.filter((rd) => rd.status === 'pending');

  // Reward form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [icon, setIcon] = useState('gift-outline');

  // Reject reason modal
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  function openCreate() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setCost('');
    setIcon('gift-outline');
    setFormVisible(true);
  }

  function openEdit(reward: Reward) {
    setEditingId(reward.id);
    setTitle(reward.title);
    setDescription(reward.description ?? '');
    setCost(String(reward.cost));
    setIcon(reward.icon ?? 'gift-outline');
    setFormVisible(true);
  }

  function handleSave() {
    if (!title.trim() || !cost.trim()) return;
    const parsedCost = parseInt(cost.trim(), 10);
    if (isNaN(parsedCost) || parsedCost <= 0) return;
    try {
      if (editingId) {
        rewardRepo.edit(editingId, {
          title: title.trim(),
          description: description.trim() || undefined,
          cost: parsedCost,
          icon: icon.trim() || undefined,
        });
      } else {
        rewardRepo.create({
          title: title.trim(),
          description: description.trim() || undefined,
          cost: parsedCost,
          icon: icon.trim() || undefined,
        });
      }
      setFormVisible(false);
    } catch (e: any) {
      Alert.alert(e?.message ?? 'Error');
    }
  }

  function handleRedeem(reward: Reward) {
    const points = actor?.points ?? 0;
    if (points < reward.cost) {
      Alert.alert(t('rewards.notEnoughPoints', { cost: reward.cost, points }));
      return;
    }
    Alert.alert(
      t('rewards.redeemConfirm', { cost: reward.cost, title: reward.title }),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('rewards.redeem'),
          onPress: () => {
            try {
              redemptionRepo.redeem(reward.id);
            } catch (e: any) {
              Alert.alert(e?.message ?? 'Error');
            }
          },
        },
      ],
    );
  }

  function handleArchive(id: string) {
    Alert.alert(t('rewards.archiveConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('rewards.archive'), onPress: () => rewardRepo.archive(id) },
    ]);
  }

  function handleDelete(id: string) {
    Alert.alert(t('rewards.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          try {
            rewardRepo.remove(id);
          } catch (e: any) {
            Alert.alert(t('rewards.cannotDelete'), e?.message ?? '');
          }
        },
      },
    ]);
  }

  function handleFulfill(id: string) {
    try {
      redemptionRepo.fulfill(id);
    } catch (e: any) {
      Alert.alert(e?.message ?? 'Error');
    }
  }

  function handleReject() {
    if (!rejectId) return;
    try {
      redemptionRepo.reject(rejectId, rejectReason.trim() || undefined);
      setRejectId(null);
    } catch (e: any) {
      Alert.alert(e?.message ?? 'Error');
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case 'fulfilled': return colors.primary;
      case 'rejected': return colors.danger;
      default: return colors.accent;
    }
  }

  const ICONS = ['gift-outline', 'tv-outline', 'restaurant-outline', 'film-outline', 'close-circle-outline', 'game-controller-outline', 'ice-cream-outline', 'star-outline', 'happy-outline', 'bicycle-outline'];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Points badge */}
        <View style={[styles.pointsBadge, { backgroundColor: colors.card }]}>
          <Ionicons name="trophy-outline" size={18} color={colors.accent} />
          <Text style={[styles.pointsText, { color: colors.accent }]}>{actor?.points ?? 0} pts</Text>
        </View>

        {/* Catalog */}
        <Text style={[styles.section, { color: colors.text }]}>{t('rewards.catalog')}</Text>
        {activeRewards.length === 0 ? (
          <Text style={{ color: colors.muted }}>{t('rewards.empty')}</Text>
        ) : (
          activeRewards.map((reward) => (
            <View key={reward.id} style={[styles.rewardCard, { backgroundColor: colors.card }]}>
              <View style={styles.rewardHeader}>
                <Ionicons name={(reward.icon ?? 'gift-outline') as any} size={24} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.rewardTitle, { color: colors.text }]}>{reward.title}</Text>
                  {reward.description ? <Text style={{ color: colors.muted, fontSize: 13 }}>{reward.description}</Text> : null}
                </View>
                <View style={[styles.costBadge, { backgroundColor: colors.accent + '20' }]}>
                  <Ionicons name="trophy" size={12} color={colors.accent} />
                  <Text style={[styles.costText, { color: colors.accent }]}>{t('rewards.costLabel', { cost: reward.cost })}</Text>
                </View>
              </View>
              <View style={styles.rewardActions}>
                <Pressable
                  style={[styles.btn, { backgroundColor: colors.primary }, (actor?.points ?? 0) < reward.cost && { opacity: 0.4 }]}
                  onPress={() => handleRedeem(reward)}
                >
                  <Text style={styles.btnText}>{t('rewards.redeem')}</Text>
                </Pressable>
                {isAdmin && (
                  <>
                    <Pressable onPress={() => openEdit(reward)} hitSlop={8}>
                      <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => handleArchive(reward.id)} hitSlop={8}>
                      <Ionicons name="archive-outline" size={18} color={colors.muted} />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(reward.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          ))
        )}

        {/* Admin: archived rewards */}
        {isAdmin && rewards.filter((r) => !r.isActive).length > 0 && (
          <>
            <Text style={[styles.section, { color: colors.muted }]}>{t('rewards.archived')}</Text>
            {rewards.filter((r) => !r.isActive).map((reward) => (
              <View key={reward.id} style={[styles.rewardCard, { backgroundColor: colors.card, opacity: 0.6 }]}>
                <View style={styles.rewardHeader}>
                  <Ionicons name={(reward.icon ?? 'gift-outline') as any} size={24} color={colors.muted} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.rewardTitle, { color: colors.muted }]}>{reward.title}</Text>
                  </View>
                  <Pressable onPress={() => handleDelete(reward.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Admin: pending redemptions */}
        {isAdmin && pendingRedemptions.length > 0 && (
          <>
            <Text style={[styles.section, { color: colors.text }]}>{t('rewards.pendingRedemptions')}</Text>
            {pendingRedemptions.map((rd) => (
              <View key={rd.id} style={[styles.rewardCard, { backgroundColor: colors.card }]}>
                <View style={styles.rewardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rewardTitle, { color: colors.text }]}>{rd.rewardTitle}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{t('rewards.redeemedBy', { name: nameOf(rd.memberId) })}</Text>
                  </View>
                  <Text style={[styles.costText, { color: colors.accent }]}>{rd.rewardCost} pts</Text>
                </View>
                <View style={styles.rewardActions}>
                  <Pressable style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]} onPress={() => handleFulfill(rd.id)}>
                    <Text style={styles.btnText}>{t('rewards.fulfill')}</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.danger, flex: 1 }]} onPress={() => { setRejectId(rd.id); setRejectReason(''); }}>
                    <Text style={[styles.btnOutlineText, { color: colors.danger }]}>{t('rewards.reject')}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {/* My redemptions */}
        <Text style={[styles.section, { color: colors.text }]}>{t('rewards.myRedemptions')}</Text>
        {myRedemptions.length === 0 ? (
          <Text style={{ color: colors.muted }}>{t('rewards.emptyRedemptions')}</Text>
        ) : (
          myRedemptions.map((rd) => (
            <View key={rd.id} style={[styles.rewardCard, { backgroundColor: colors.card }]}>
              <View style={styles.rewardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rewardTitle, { color: colors.text }]}>{rd.rewardTitle}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{t('rewards.redeemedOn', { date: rd.redeemedAt.slice(0, 10) })}</Text>
                </View>
                <Text style={[styles.statusBadge, { color: statusColor(rd.status) }]}>{t(`rewards.${rd.status}`)}</Text>
              </View>
              {rd.status === 'rejected' && rd.rejectionReason && (
                <Text style={{ color: colors.danger, fontSize: 12 }}>{t('rewards.rejectedReason', { reason: rd.rejectionReason })}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Admin FAB */}
      {isAdmin && (
        <Pressable style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      )}

      {/* Create / Edit Modal */}
      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={[styles.formContainer, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {editingId ? t('rewards.editReward') : t('rewards.newReward')}
          </Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('rewards.rewardTitle')}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('rewards.rewardTitlePlaceholder')}
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('rewards.rewardDescription')}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('rewards.rewardDescriptionPlaceholder')}
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('rewards.rewardCost')}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('rewards.rewardCostPlaceholder')}
            placeholderTextColor={colors.muted}
            value={cost}
            onChangeText={(v) => setCost(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Icon</Text>
          <View style={styles.iconRow}>
            {ICONS.map((ic) => (
              <Pressable key={ic} onPress={() => setIcon(ic)} style={[styles.iconBtn, { backgroundColor: colors.chipBg }, icon === ic && { backgroundColor: colors.primary }]}>
                <Ionicons name={ic as any} size={20} color={icon === ic ? 'white' : colors.text} />
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary }, (!title.trim() || !cost.trim()) && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={!title.trim() || !cost.trim()}
          >
            <Text style={styles.btnText}>{t('common.save')}</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]} onPress={() => setFormVisible(false)}>
            <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('common.cancel')}</Text>
          </Pressable>
        </ScrollView>
      </Modal>

      {/* Reject reason modal */}
      <Modal visible={rejectId !== null} transparent animationType="fade">
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text style={[styles.formTitle, { color: colors.text }]}>{t('rewards.reject')}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder={t('rewards.rejectReasonPlaceholder')}
              placeholderTextColor={colors.muted}
              value={rejectReason}
              onChangeText={setRejectReason}
            />
            <Pressable style={[styles.btn, { backgroundColor: colors.danger }]} onPress={handleReject}>
              <Text style={styles.btnText}>{t('rewards.reject')}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]} onPress={() => setRejectId(null)}>
              <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 80 },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  pointsText: { fontSize: 14, fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  rewardCard: { padding: 12, borderRadius: 8, gap: 8 },
  rewardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  rewardTitle: { fontSize: 15, fontWeight: '600' },
  costBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  costText: { fontSize: 12, fontWeight: '700' },
  statusBadge: { fontSize: 12, fontWeight: '700' },
  rewardActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1 },
  btnOutlineText: { fontWeight: '600' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  formContainer: { flex: 1 },
  formTitle: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 12, padding: 20, gap: 12 },
});
