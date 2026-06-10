import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/data/store';
import { useRole } from '@/hooks/useRole';
import { choreRepo } from '@/data/repositories';
import { useTheme } from '@/theme';
import type { Chore, Recurrence, ChoreCategory } from '@/types';

const RECURRENCE_OPTIONS: Recurrence[] = ['none', 'daily', 'weekly', 'monthly'];
const CATEGORIES: ChoreCategory[] = ['daily', 'weekly', 'monthly', 'seasonal'];
const CATEGORY_TO_RECURRENCE: Record<ChoreCategory, Recurrence> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  seasonal: 'none',
};
const CATEGORY_COLORS: Record<ChoreCategory, string> = {
  daily: '#2563eb',
  weekly: '#7c3aed',
  monthly: '#d97706',
  seasonal: '#16a34a',
};

export default function ChoresScreen() {
  const { t } = useTranslation();
  const { actor, isAdmin } = useRole();
  const activeHouseholdId = useStore((s) => s.activeHouseholdId);
  const chores = useStore((s) => s.chores).filter((c) => c.householdId === activeHouseholdId);
  const members = useStore((s) => s.members).filter((m) => m.householdId === activeHouseholdId);
  const choreTemplates = useStore((s) => s.choreTemplates).filter((t) => t.householdId === activeHouseholdId);
  const { colors } = useTheme();
  // 'mine' | 'everyone' | a specific member id
  const [filter, setFilter] = useState<string>('mine');

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [selectedCategory, setSelectedCategory] = useState<ChoreCategory>('daily');
  const [pointsOverride, setPointsOverride] = useState('');

  const visible = chores
    .filter((c) => {
      if (filter === 'mine') return c.assigneeId === actor?.id;
      if (filter === 'everyone') return true;
      return c.assigneeId === filter;
    })
    .sort((a, b) => {
      // Incomplete chores first, completed last
      const aDone = a.status === 'completed' ? 1 : 0;
      const bDone = b.status === 'completed' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      // Within same group, latest due date first (no due date goes after dated items)
      const aDate = a.dueDate ?? '';
      const bDate = b.dueDate ?? '';
      return bDate.localeCompare(aDate);
    });
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  function openCreate() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDueDate('');
    setAssigneeId(members[0]?.id ?? '');
    setRecurrence('daily');
    setSelectedCategory('daily');
    setPointsOverride('');
    setFormVisible(true);
  }

  function openEdit(chore: Chore) {
    setEditingId(chore.id);
    setTitle(chore.title);
    setDescription(chore.description ?? '');
    setDueDate(chore.dueDate ?? '');
    setAssigneeId(chore.assigneeId);
    setRecurrence(chore.recurrence);
    setPointsOverride(chore.pointsOverride != null ? String(chore.pointsOverride) : '');
    setFormVisible(true);
  }

  function handleSave() {
    if (!title.trim()) return;
    const parsedOverride = pointsOverride.trim() ? parseInt(pointsOverride.trim(), 10) : undefined;
    const effectiveOverride = parsedOverride != null && !isNaN(parsedOverride) ? parsedOverride : undefined;
    // For seasonal category (recurrence=none), auto-set pointsOverride to pointsSeasonal if no explicit override
    const finalOverride = !editingId && selectedCategory === 'seasonal' && effectiveOverride == null
      ? undefined // seasonal will use pointsDaily by default from settings, so auto-set the seasonal value
      : effectiveOverride;
    // Actually: seasonal chores default to pointsDaily. So auto-set pointsSeasonal as override.
    const seasonalAuto = !editingId && selectedCategory === 'seasonal' && finalOverride == null;
    try {
      if (editingId) {
        choreRepo.edit(editingId, {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate.trim() || undefined,
          assigneeId,
          recurrence,
          pointsOverride: effectiveOverride,
        });
      } else {
        const settings = useStore.getState().settings;
        choreRepo.create({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate.trim() || undefined,
          assigneeId,
          recurrence,
          pointsOverride: seasonalAuto ? settings.pointsSeasonal : effectiveOverride,
        });
      }
      setFormVisible(false);
    } catch (e: any) {
      if (typeof e?.message === 'string' && e.message.startsWith('DUPLICATE:')) {
        Alert.alert(t('chores.duplicateError', { title: title.trim() }));
      } else {
        throw e;
      }
    }
  }

  function handleDelete(id: string) {
    Alert.alert(t('chores.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => choreRepo.remove(id) },
    ]);
  }

  function renderItem({ item }: { item: Chore }) {
    const mine = item.assigneeId === actor?.id;
    const canAct = mine || isAdmin;
    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
            {item.description ? <Text style={{ color: colors.muted }}>{item.description}</Text> : null}
          </View>
          {isAdmin && (
            <View style={styles.cardActions}>
              <Pressable onPress={() => openEdit(item)} hitSlop={8}>
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => handleDelete(item.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          )}
        </View>

        <Text style={{ color: colors.muted }}>{t('chores.assignedTo', { name: nameOf(item.assigneeId) })}</Text>
        <Text style={{ color: colors.muted }}>
          {item.dueDate ? t('chores.dueOn', { date: item.dueDate }) : t('chores.noDueDate')}
        </Text>
        {item.recurrence !== 'none' && (
          <Text style={[styles.recurrenceBadge, { color: colors.accent }]}>
            <Ionicons name="repeat-outline" size={12} />{' '}
            {t(`chores.recurrenceOptions.${item.recurrence}`)}
          </Text>
        )}
        <View style={styles.badgeRow}>
          <Text style={[styles.badge, { color: colors.primary }]}>{t(`chores.status.${item.status}`)}</Text>
          {item.pointsOverride != null && (
            <View style={[styles.pointsBadge, { backgroundColor: colors.accent + '20' }]}>
              <Ionicons name="trophy" size={12} color={colors.accent} />
              <Text style={[styles.pointsBadgeText, { color: colors.accent }]}>{item.pointsOverride} pts</Text>
            </View>
          )}
        </View>

        <View style={styles.btnRow}>
          {canAct && item.status === 'assigned' && (
            <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => choreRepo.start(item.id)}>
              <Text style={styles.btnText}>{t('chores.start')}</Text>
            </Pressable>
          )}
          {canAct && item.status !== 'completed' && (
            <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => {
              const { pointsAwarded } = choreRepo.complete(item.id);
              if (pointsAwarded > 0) Alert.alert(t('chores.pointsAwarded', { points: pointsAwarded }));
            }}>
              <Text style={styles.btnText}>{t('chores.markDone')}</Text>
            </Pressable>
          )}
          {isAdmin && item.status === 'completed' && (
            <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]} onPress={() => choreRepo.reopen(item.id)}>
              <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('chores.reopen')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {['mine', 'everyone'].map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, { backgroundColor: colors.chipBg }, filter === f && { backgroundColor: colors.primary }]}>
              <Text style={filter === f ? styles.chipTextActive : [styles.chipText, { color: colors.textSecondary }]}>{t(`chores.filter.${f}`)}</Text>
            </Pressable>
          ))}
          {members.filter((m) => m.id !== actor?.id).map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setFilter(m.id)}
              style={[styles.chip, { backgroundColor: colors.chipBg }, filter === m.id && { backgroundColor: m.color }]}
            >
              <Text style={filter === m.id ? styles.chipTextActive : [styles.chipText, { color: colors.textSecondary }]}>{m.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={{ color: colors.muted, padding: 16 }}>{t('chores.empty')}</Text>}
        contentContainerStyle={{ gap: 10, padding: 16 }}
      />

      {isAdmin && (
        <Pressable style={[styles.fab, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      )}

      {/* Create / Edit Modal */}
      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={[styles.formContainer, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {editingId ? t('chores.editChore') : t('chores.newChore')}
          </Text>

          {/* Category selector — only on create */}
          {!editingId && (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('chores.category')}</Text>
              <View style={styles.optionRow}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setRecurrence(CATEGORY_TO_RECURRENCE[cat]);
                      setTitle('');
                    }}
                    style={[styles.chip, { backgroundColor: colors.chipBg }, selectedCategory === cat && { backgroundColor: CATEGORY_COLORS[cat] }]}
                  >
                    <Text style={selectedCategory === cat ? styles.chipTextActive : [styles.chipText, { color: colors.textSecondary }]}>
                      {t(`settings.category.${cat}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Templates in selected category */}
              {choreTemplates.filter((t) => t.category === selectedCategory).length > 0 && (
                <View style={styles.templatePicker}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{t('chores.pickTemplate')}</Text>
                  <View style={styles.templateList}>
                    {choreTemplates
                      .filter((tmpl) => tmpl.category === selectedCategory)
                      .map((tmpl) => (
                        <Pressable
                          key={tmpl.id}
                          onPress={() => setTitle(tmpl.title)}
                          style={[styles.templateItem, { backgroundColor: colors.card, borderColor: title === tmpl.title ? CATEGORY_COLORS[selectedCategory] : colors.border }]}
                        >
                          {title === tmpl.title && (
                            <Ionicons name="checkmark-circle" size={18} color={CATEGORY_COLORS[selectedCategory]} />
                          )}
                          <Text style={[styles.templateItemText, { color: colors.text }]}>{tmpl.title}</Text>
                        </Pressable>
                      ))}
                  </View>
                </View>
              )}

              <Text style={[styles.formTitle, { color: colors.text }]}>{t('chores.customTitle')}</Text>
            </>
          )}

          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('chores.titlePlaceholder')}
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('chores.descriptionPlaceholder')}
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('chores.dueDatePlaceholder')}
            placeholderTextColor={colors.muted}
            value={dueDate}
            onChangeText={setDueDate}
          />

          <Text style={[styles.formTitle, { color: colors.text }]}>{t('chores.assignee')}</Text>
          <View style={styles.optionRow}>
            {members.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setAssigneeId(m.id)}
                style={[styles.chip, { backgroundColor: colors.chipBg }, assigneeId === m.id && { backgroundColor: m.color }]}
              >
                <Text style={assigneeId === m.id ? styles.chipTextActive : [styles.chipText, { color: colors.textSecondary }]}>{m.name}</Text>
              </Pressable>
            ))}
          </View>

          {/* Recurrence — auto-set by category on create, manually editable on edit */}
          <Text style={[styles.formTitle, { color: colors.text }]}>{t('chores.recurrence')}</Text>
          <View style={styles.optionRow}>
            {RECURRENCE_OPTIONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setRecurrence(r)}
                style={[styles.chip, { backgroundColor: colors.chipBg }, recurrence === r && { backgroundColor: colors.primary }]}
              >
                <Text style={recurrence === r ? styles.chipTextActive : [styles.chipText, { color: colors.textSecondary }]}>
                  {t(`chores.recurrenceOptions.${r}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('chores.pointsOverride')}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('chores.pointsOverridePlaceholder')}
            placeholderTextColor={colors.muted}
            value={pointsOverride}
            onChangeText={(v) => setPointsOverride(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />

          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary }, !title.trim() && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={!title.trim()}
          >
            <Text style={styles.btnText}>{t('common.save')}</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]} onPress={() => setFormVisible(false)}>
            <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('common.cancel')}</Text>
          </Pressable>
        </ScrollView>
      </Modal>
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
  card: { padding: 12, borderRadius: 8, gap: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardActions: { flexDirection: 'row', gap: 12, paddingLeft: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  badge: { fontSize: 12, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  pointsBadgeText: { fontSize: 11, fontWeight: '700' },
  recurrenceBadge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center', flex: 1 },
  btnText: { color: 'white', fontWeight: '600' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1 },
  btnOutlineText: { fontWeight: '600' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  formContainer: { flex: 1 },
  formTitle: { fontSize: 20, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  label: { fontSize: 14, fontWeight: '600' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templatePicker: { gap: 8 },
  templateList: { gap: 6 },
  templateItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, borderWidth: 1.5 },
  templateItemText: { fontSize: 14 },
});
