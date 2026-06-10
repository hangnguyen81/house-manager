import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/data/store';
import { useRole } from '@/hooks/useRole';
import { supplyRepo } from '@/data/repositories';
import { useTheme, type ThemeColors } from '@/theme';
import type { SupplyRequest, SupplyStatus, Urgency } from '@/types';

const STATUS_FILTERS: Array<'all' | SupplyStatus> = ['all', 'requested', 'approved', 'rejected', 'purchased'];

export default function SuppliesScreen() {
  const { t } = useTranslation();
  const { actor, isAdmin } = useRole();
  const activeHouseholdId = useStore((s) => s.activeHouseholdId);
  const supplies = useStore((s) => s.supplies).filter((s) => s.householdId === activeHouseholdId);
  const members = useStore((s) => s.members).filter((m) => m.householdId === activeHouseholdId);

  const [filter, setFilter] = useState<'all' | SupplyStatus>('requested');

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('normal');

  // Reject reason modal
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { colors } = useTheme();
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  const visible = supplies
    .filter((s) => (filter === 'all' ? true : s.status === filter))
    .sort((a, b) => (a.urgency === b.urgency ? 0 : a.urgency === 'urgent' ? -1 : 1));

  function openCreate() {
    setEditingId(null);
    setName('');
    setQuantity('');
    setNote('');
    setUrgency('normal');
    setFormVisible(true);
  }

  function openEdit(item: SupplyRequest) {
    setEditingId(item.id);
    setName(item.name);
    setQuantity(item.quantity ?? '');
    setNote(item.note ?? '');
    setUrgency(item.urgency);
    setFormVisible(true);
  }

  function handleSave() {
    if (!name.trim()) return;
    if (editingId) {
      supplyRepo.edit(editingId, {
        name: name.trim(),
        quantity: quantity.trim() || undefined,
        note: note.trim() || undefined,
        urgency,
      });
    } else {
      supplyRepo.flag({
        name: name.trim(),
        quantity: quantity.trim() || undefined,
        note: note.trim() || undefined,
        urgency,
      });
    }
    setFormVisible(false);
  }

  function handleCancel(id: string) {
    Alert.alert(t('supplies.cancelConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => supplyRepo.cancel(id) },
    ]);
  }

  function handleReject() {
    if (!rejectTarget) return;
    supplyRepo.reject(rejectTarget, rejectReason.trim() || undefined);
    setRejectTarget(null);
    setRejectReason('');
  }

  function renderItem({ item }: { item: SupplyRequest }) {
    const isOwner = item.requestedById === actor?.id;
    const canEdit = item.status === 'requested' && (isOwner || isAdmin);

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {item.name}
              {item.quantity ? ` · ${item.quantity}` : ''}
            </Text>
            {item.note ? <Text style={{ color: colors.muted }}>{item.note}</Text> : null}
          </View>
          {canEdit && (
            <View style={styles.cardActions}>
              <Pressable onPress={() => openEdit(item)} hitSlop={8}>
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => handleCancel(item.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <Text style={{ color: colors.muted }}>{t('supplies.requestedBy', { name: nameOf(item.requestedById) })}</Text>
          {item.urgency === 'urgent' && <Text style={[styles.urgentBadge, { color: colors.danger }]}>{t('supplies.urgent')}</Text>}
        </View>

        <Text style={[styles.statusBadge, statusColor(item.status, colors)]}>
          {t(`supplies.status.${item.status}`)}
        </Text>

        {item.status === 'rejected' && item.rejectionReason ? (
          <Text style={{ color: colors.danger, fontSize: 13 }}>{t('supplies.rejectedReason', { reason: item.rejectionReason })}</Text>
        ) : null}

        <View style={styles.btnRow}>
          {isAdmin && item.status === 'requested' && (
            <>
              <Pressable style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => supplyRepo.approve(item.id)}>
                <Text style={[styles.btnText, { color: colors.background }]}>{t('supplies.approve')}</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: colors.danger }]} onPress={() => { setRejectTarget(item.id); setRejectReason(''); }}>
                <Text style={[styles.btnText, { color: colors.background }]}>{t('supplies.reject')}</Text>
              </Pressable>
            </>
          )}
          {isAdmin && item.status === 'approved' && (
            <>
              <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => supplyRepo.markPurchased(item.id)}>
                <Text style={[styles.btnText, { color: colors.background }]}>{t('shopping.markPurchased')}</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary }]} onPress={() => supplyRepo.unapprove(item.id)}>
                <Text style={[styles.btnText, { color: colors.primary }]}>{t('supplies.unapprove')}</Text>
              </Pressable>
            </>
          )}
        </View>

        {!isAdmin && item.status === 'requested' && (
          <Text style={{ color: colors.muted }}>{t('supplies.pending')}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {STATUS_FILTERS.map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, { backgroundColor: colors.chipBg }, filter === f && { backgroundColor: colors.primary }]}>
              <Text style={filter === f ? [styles.chipTextActive, { color: colors.background }] : { color: colors.textSecondary }}>
                {t(`supplies.filter.${f}`)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={{ color: colors.muted, padding: 16 }}>{t('supplies.empty')}</Text>}
        contentContainerStyle={{ gap: 10, padding: 16 }}
      />

      {/* FAB — any member can flag a supply */}
      <Pressable style={[styles.fab, { backgroundColor: colors.success }]} onPress={openCreate}>
        <Ionicons name="add" size={28} color={colors.background} />
      </Pressable>

      {/* Create / Edit Modal */}
      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={[styles.formContainer, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {editingId ? t('supplies.editRequest') : t('supplies.newRequest')}
          </Text>

          <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t('supplies.namePlaceholder')} placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
          <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t('supplies.quantityPlaceholder')} placeholderTextColor={colors.muted} value={quantity} onChangeText={setQuantity} />
          <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t('supplies.notePlaceholder')} placeholderTextColor={colors.muted} value={note} onChangeText={setNote} multiline />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('supplies.urgencyLabel')}</Text>
          <View style={styles.optionRow}>
            {(['normal', 'urgent'] as Urgency[]).map((u) => (
              <Pressable
                key={u}
                onPress={() => setUrgency(u)}
                style={[styles.chip, { backgroundColor: colors.chipBg }, urgency === u && { backgroundColor: u === 'urgent' ? colors.danger : colors.primary }]}
              >
                <Text style={urgency === u ? [styles.chipTextActive, { color: colors.background }] : { color: colors.textSecondary }}>
                  {t(`supplies.${u}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={[styles.btn, { backgroundColor: colors.success }, !name.trim() && { opacity: 0.4 }]} onPress={handleSave} disabled={!name.trim()}>
            <Text style={[styles.btnText, { color: colors.background }]}>{t('common.save')}</Text>
          </Pressable>
          <Pressable style={[styles.btn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary }]} onPress={() => setFormVisible(false)}>
            <Text style={[styles.btnText, { color: colors.primary }]}>{t('common.cancel')}</Text>
          </Pressable>
        </ScrollView>
      </Modal>

      <Modal visible={rejectTarget !== null} transparent animationType="fade">
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text style={[styles.formTitle, { color: colors.text }]}>{t('supplies.reject')}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholder={t('supplies.rejectReasonPlaceholder')} placeholderTextColor={colors.muted} value={rejectReason} onChangeText={setRejectReason} />
            <View style={styles.btnRow}>
              <Pressable style={[styles.btn, { backgroundColor: colors.danger }]} onPress={handleReject}>
                <Text style={[styles.btnText, { color: colors.background }]}>{t('supplies.reject')}</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary }]} onPress={() => setRejectTarget(null)}>
                <Text style={[styles.btnText, { color: colors.primary }]}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function statusColor(status: SupplyStatus, c: ThemeColors) {
  switch (status) {
    case 'requested': return { color: c.primary };
    case 'approved': return { color: c.success };
    case 'rejected': return { color: c.danger };
    case 'purchased': return { color: c.muted };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { padding: 16, paddingBottom: 0 },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16 },
  chipTextActive: { fontWeight: '600' },
  card: { padding: 12, borderRadius: 8, gap: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardActions: { flexDirection: 'row', gap: 12, paddingLeft: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  urgentBadge: { fontWeight: '700', fontSize: 12 },
  statusBadge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', flex: 1 },
  btnText: { fontWeight: '600' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  formContainer: { flex: 1 },
  formTitle: { fontSize: 20, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  label: { fontSize: 14, fontWeight: '600' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 12, padding: 20, gap: 12 },
});
