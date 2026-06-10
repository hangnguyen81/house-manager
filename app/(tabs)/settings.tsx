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
import { setAppLanguage } from '@/i18n';
import { choreTemplateRepo, memberRepo } from '@/data/repositories';
import { useTheme } from '@/theme';
import type { Language, ChoreCategory, ChoreTemplate, ThemeMode, Role, Member, HouseholdSettings } from '@/types';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
];

const CATEGORIES: ChoreCategory[] = ['daily', 'weekly', 'monthly', 'seasonal'];

const CATEGORY_COLORS: Record<ChoreCategory, string> = {
  daily: '#2563eb',
  weekly: '#7c3aed',
  monthly: '#d97706',
  seasonal: '#16a34a',
};

const THEME_MODES: ThemeMode[] = ['light', 'dark'];
const ROLES: Role[] = ['admin', 'member'];
const MEMBER_COLORS = ['#E8743B', '#19A979', '#945ECF', '#1F77B4', '#DC2626', '#D97706', '#0D9488', '#7C3AED'];

export default function Settings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const currentLang = useStore((s) => s.settings.language);
  const currentTheme = useStore((s) => s.settings.theme);
  const activeHouseholdId = useStore((s) => s.activeHouseholdId);
  const allTemplates = useStore((s) => s.choreTemplates);
  const allMembers = useStore((s) => s.members);
  const templates = allTemplates.filter((t) => t.householdId === activeHouseholdId);
  const members = allMembers.filter((m) => m.householdId === activeHouseholdId);

  // Chore template form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ChoreCategory>('daily');

  // Member form state
  const [memberFormVisible, setMemberFormVisible] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<Role>('member');
  const [memberColor, setMemberColor] = useState(MEMBER_COLORS[0]);

  // PIN modal state
  const [pinModalMember, setPinModalMember] = useState<Member | null>(null);
  const [newPin, setNewPin] = useState('');

  // Adjust points modal state
  const [adjustPointsMember, setAdjustPointsMember] = useState<Member | null>(null);
  const [pointsDelta, setPointsDelta] = useState('');

  // Points config section
  const [pointsCollapsed, setPointsCollapsed] = useState(true);
  const settings = useStore((s) => s.settings);

  // Track which sections are collapsed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ daily: true, weekly: true, monthly: true, seasonal: true });
  const [membersCollapsed, setMembersCollapsed] = useState(true);

  function toggleCategory(cat: ChoreCategory) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  function openAdd(cat: ChoreCategory) {
    setEditingId(null);
    setTitle('');
    setCategory(cat);
    setFormVisible(true);
  }

  function openEdit(tmpl: ChoreTemplate) {
    setEditingId(tmpl.id);
    setTitle(tmpl.title);
    setCategory(tmpl.category);
    setFormVisible(true);
  }

  function handleSave() {
    if (!title.trim()) return;
    if (editingId) {
      choreTemplateRepo.edit(editingId, { title: title.trim(), category });
    } else {
      choreTemplateRepo.add({ title: title.trim(), category });
    }
    setFormVisible(false);
  }

  function handleDelete(id: string) {
    Alert.alert(t('settings.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => choreTemplateRepo.remove(id) },
    ]);
  }

  // Member CRUD
  function openAddMember() {
    setEditingMemberId(null);
    setMemberName('');
    setMemberRole('member');
    setMemberColor(MEMBER_COLORS[members.length % MEMBER_COLORS.length]);
    setMemberFormVisible(true);
  }

  function openEditMember(m: Member) {
    setEditingMemberId(m.id);
    setMemberName(m.name);
    setMemberRole(m.role);
    setMemberColor(m.color);
    setMemberFormVisible(true);
  }

  function handleSaveMember() {
    if (!memberName.trim()) return;
    if (editingMemberId) {
      memberRepo.update(editingMemberId, { name: memberName.trim(), role: memberRole, color: memberColor });
    } else {
      memberRepo.add({ name: memberName.trim(), role: memberRole, color: memberColor });
    }
    setMemberFormVisible(false);
  }

  function handleDeleteMember(id: string) {
    Alert.alert(t('settings.deleteMemberConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          try {
            memberRepo.remove(id);
          } catch (e) {
            const msg = e instanceof Error ? e.message : '';
            if (msg.includes('Cannot delete member')) {
              Alert.alert(t('settings.memberInUseError'), msg);
            } else {
              Alert.alert(t('settings.lastAdminError'));
            }
          }
        },
      },
    ]);
  }

  function openPinModal(m: Member) {
    setPinModalMember(m);
    setNewPin('');
  }

  function handleSetPin() {
    if (!pinModalMember || newPin.length < 4) return;
    memberRepo.setPin(pinModalMember.id, newPin);
    setPinModalMember(null);
    Alert.alert(t('common.pinUpdated'));
  }

  function handleAdjustPoints() {
    if (!adjustPointsMember || !pointsDelta.trim()) return;
    const delta = parseInt(pointsDelta.trim(), 10);
    if (isNaN(delta) || delta === 0) return;
    try {
      memberRepo.adjustPoints(adjustPointsMember.id, delta);
      setAdjustPointsMember(null);
      Alert.alert(t('settings.pointsAdjusted'));
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : 'Error');
    }
  }

  function updatePointsSetting(key: keyof HouseholdSettings, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      useStore.getState().setSettings({ [key]: num });
    }
  }

  function handleRemovePin() {
    if (!pinModalMember) return;
    memberRepo.setPin(pinModalMember.id, undefined);
    setPinModalMember(null);
    Alert.alert(t('common.pinRemoved'));
  }

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.container}>
      {/* Members section */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.members')}</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>{t('settings.membersHint')}</Text>
        </View>
      </View>

      <View style={[styles.categoryBlock, { backgroundColor: colors.card }]}>
        <Pressable style={styles.categoryHeader} onPress={() => setMembersCollapsed((v) => !v)}>
          <Ionicons name="people-outline" size={18} color={colors.primary} />
          <Text style={[styles.categoryTitle, { color: colors.text }]}>{t('settings.membersInFamily')}</Text>
          <Text style={[styles.categoryCount, { color: colors.muted }]}>{members.length}</Text>
          <Ionicons name={membersCollapsed ? 'chevron-forward' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>

        {!membersCollapsed && (
          <View style={styles.categoryItems}>
            {members.map((m) => (
              <View key={m.id} style={[styles.memberRow, { backgroundColor: colors.background }]}>
                <View style={[styles.memberAvatar, { backgroundColor: m.color }]}>
                  <Text style={styles.memberAvatarText}>{m.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.text }]}>{m.name}</Text>
                  <View style={styles.memberMeta}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{t(`common.${m.role}`)}</Text>
                    <Ionicons name={m.pin ? 'lock-closed-outline' : 'lock-open-outline'} size={12} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{m.pin ? t('common.pinSet') : t('common.noPin')}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{m.points ?? 0} pts</Text>
                <View style={styles.templateActions}>
                  <Pressable onPress={() => { setAdjustPointsMember(m); setPointsDelta(''); }} hitSlop={8}>
                    <Ionicons name="trophy-outline" size={16} color={colors.accent} />
                  </Pressable>
                  <Pressable onPress={() => openPinModal(m)} hitSlop={8}>
                    <Ionicons name="key-outline" size={16} color={colors.accent} />
                  </Pressable>
                  <Pressable onPress={() => openEditMember(m)} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteMember(m.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable style={styles.addRow} onPress={openAddMember}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.addText, { color: colors.primary }]}>{t('settings.addMember')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Chore templates section */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.choreTemplates')}</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>{t('settings.choreTemplatesHint')}</Text>
        </View>
      </View>

      {CATEGORIES.map((cat) => {
        const items = templates.filter((tmpl) => tmpl.category === cat);
        const isCollapsed = collapsed[cat] ?? false;
        const color = CATEGORY_COLORS[cat];

        return (
          <View key={cat} style={[styles.categoryBlock, { backgroundColor: colors.card }]}>
            <Pressable style={styles.categoryHeader} onPress={() => toggleCategory(cat)}>
              <View style={[styles.categoryDot, { backgroundColor: color }]} />
              <Text style={[styles.categoryTitle, { color: colors.text }]}>{t(`settings.category.${cat}`)}</Text>
              <Text style={[styles.categoryCount, { color: colors.muted }]}>{items.length}</Text>
              <Ionicons
                name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                size={18}
                color={colors.muted}
              />
            </Pressable>

            {!isCollapsed && (
              <View style={styles.categoryItems}>
                {items.length === 0 ? (
                  <Text style={[styles.muted, { color: colors.muted }]}>{t('settings.emptyCategory')}</Text>
                ) : (
                  items.map((tmpl) => (
                    <View key={tmpl.id} style={[styles.templateRow, { backgroundColor: colors.background }]}>
                      <Text style={[styles.templateTitle, { color: colors.text }]}>{tmpl.title}</Text>
                      <View style={styles.templateActions}>
                        <Pressable onPress={() => openEdit(tmpl)} hitSlop={8}>
                          <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                        </Pressable>
                        <Pressable onPress={() => handleDelete(tmpl.id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
                <Pressable style={styles.addRow} onPress={() => openAdd(cat)}>
                  <Ionicons name="add-circle-outline" size={18} color={color} />
                  <Text style={[styles.addText, { color }]}>{t('settings.addChore')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {/* Points configuration section */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.pointsConfig')}</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>{t('settings.pointsConfigHint')}</Text>
        </View>
      </View>

      <View style={[styles.categoryBlock, { backgroundColor: colors.card }]}>
        <Pressable style={styles.categoryHeader} onPress={() => setPointsCollapsed((v) => !v)}>
          <Ionicons name="trophy-outline" size={18} color={colors.accent} />
          <Text style={[styles.categoryTitle, { color: colors.text }]}>{t('settings.pointsConfig')}</Text>
          <Ionicons name={pointsCollapsed ? 'chevron-forward' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>

        {!pointsCollapsed && (
          <View style={styles.categoryItems}>
            {([
              { key: 'pointsDaily' as const, label: t('settings.pointsDaily') },
              { key: 'pointsWeekly' as const, label: t('settings.pointsWeekly') },
              { key: 'pointsMonthly' as const, label: t('settings.pointsMonthly') },
              { key: 'pointsSeasonal' as const, label: t('settings.pointsSeasonal') },
            ]).map(({ key, label }) => (
              <View key={key} style={[styles.pointsRow, { backgroundColor: colors.background }]}>
                <Text style={[styles.pointsLabel, { color: colors.text }]}>{label}</Text>
                <TextInput
                  style={[styles.pointsInput, { borderColor: colors.border, color: colors.text }]}
                  value={String(settings[key] ?? 0)}
                  onChangeText={(v) => updatePointsSetting(key, v)}
                  keyboardType="number-pad"
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Language section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('common.language')}</Text>
      <View style={styles.langRow}>
        {LANGUAGES.map((l) => (
          <Pressable
            key={l.code}
            style={[styles.langChip, { backgroundColor: colors.chipBg }, currentLang === l.code && { backgroundColor: colors.primary }]}
            onPress={() => setAppLanguage(l.code)}
          >
            <Text style={currentLang === l.code ? styles.langTextActive : [styles.langText, { color: colors.text }]}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Theme section */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('common.theme')}</Text>
      <View style={styles.langRow}>
        {THEME_MODES.map((mode) => (
          <Pressable
            key={mode}
            style={[styles.langChip, { backgroundColor: colors.chipBg }, currentTheme === mode && { backgroundColor: colors.primary }]}
            onPress={() => useStore.getState().setSettings({ theme: mode })}
          >
            <Text style={currentTheme === mode ? styles.langTextActive : [styles.langText, { color: colors.text }]}>
              {t(`common.${mode}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Add / Edit template Modal */}
      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={[styles.formContainer, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {editingId ? t('settings.editChore') : t('settings.addChore')}
          </Text>

          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('settings.choreTitlePlaceholder')}
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('chores.recurrence')}</Text>
          <View style={styles.optionRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.chip,
                  { backgroundColor: colors.chipBg },
                  category === cat && { backgroundColor: CATEGORY_COLORS[cat] },
                ]}
              >
                <Text style={category === cat ? styles.chipTextActive : [styles.chipText, { color: colors.textSecondary }]}>
                  {t(`settings.category.${cat}`)}
                </Text>
              </Pressable>
            ))}
          </View>

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
      {/* Add / Edit member Modal */}
      <Modal visible={memberFormVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={[styles.formContainer, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {editingMemberId ? t('settings.editMember') : t('settings.addMember')}
          </Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('settings.memberName')}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={t('settings.memberName')}
            placeholderTextColor={colors.muted}
            value={memberName}
            onChangeText={setMemberName}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('settings.memberRole')}</Text>
          <View style={styles.optionRow}>
            {ROLES.map((r) => (
              <Pressable
                key={r}
                onPress={() => setMemberRole(r)}
                style={[styles.chip, { backgroundColor: colors.chipBg }, memberRole === r && { backgroundColor: colors.primary }]}
              >
                <Text style={memberRole === r ? styles.chipTextActive : [styles.chipText, { color: colors.textSecondary }]}>
                  {t(`common.${r}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('settings.memberColor')}</Text>
          <View style={styles.optionRow}>
            {MEMBER_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setMemberColor(c)}
                style={[styles.colorSwatch, { backgroundColor: c }, memberColor === c && styles.colorSwatchActive]}
              />
            ))}
          </View>

          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary }, !memberName.trim() && { opacity: 0.4 }]}
            onPress={handleSaveMember}
            disabled={!memberName.trim()}
          >
            <Text style={styles.btnText}>{t('common.save')}</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]} onPress={() => setMemberFormVisible(false)}>
            <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('common.cancel')}</Text>
          </Pressable>
        </ScrollView>
      </Modal>

      {/* Adjust points modal */}
      <Modal visible={adjustPointsMember !== null} transparent animationType="fade">
        <View style={[styles.pinOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.pinDialog, { backgroundColor: colors.card }]}>
            {adjustPointsMember && (
              <>
                <View style={styles.pinHeader}>
                  <View style={[styles.memberAvatar, { backgroundColor: adjustPointsMember.color }]}>
                    <Text style={styles.memberAvatarText}>{adjustPointsMember.name[0]}</Text>
                  </View>
                  <Text style={[styles.pinDialogTitle, { color: colors.text }]}>{adjustPointsMember.name}</Text>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>{adjustPointsMember.points ?? 0} pts</Text>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('settings.adjustPointsDelta')}</Text>
                <TextInput
                  style={[styles.pinInput, { borderColor: colors.border, color: colors.text }]}
                  placeholder="+10 / -5"
                  placeholderTextColor={colors.muted}
                  value={pointsDelta}
                  onChangeText={(v) => setPointsDelta(v.replace(/[^0-9\-]/g, ''))}
                  keyboardType="number-pad"
                />

                <Pressable
                  style={[styles.btn, { backgroundColor: colors.primary }, !pointsDelta.trim() && { opacity: 0.4 }]}
                  onPress={handleAdjustPoints}
                  disabled={!pointsDelta.trim()}
                >
                  <Text style={styles.btnText}>{t('settings.adjustPoints')}</Text>
                </Pressable>

                <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]} onPress={() => setAdjustPointsMember(null)}>
                  <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('common.cancel')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* PIN management modal */}
      <Modal visible={pinModalMember !== null} transparent animationType="fade">
        <View style={[styles.pinOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.pinDialog, { backgroundColor: colors.card }]}>
            {pinModalMember && (
              <>
                <View style={styles.pinHeader}>
                  <View style={[styles.memberAvatar, { backgroundColor: pinModalMember.color }]}>
                    <Text style={styles.memberAvatarText}>{pinModalMember.name[0]}</Text>
                  </View>
                  <Text style={[styles.pinDialogTitle, { color: colors.text }]}>{pinModalMember.name}</Text>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {pinModalMember.pin ? t('common.changePin') : t('common.setPin')}
                </Text>
                <TextInput
                  style={[styles.pinInput, { borderColor: colors.border, color: colors.text }]}
                  placeholder={t('common.newPinPlaceholder')}
                  placeholderTextColor={colors.muted}
                  value={newPin}
                  onChangeText={(v) => setNewPin(v.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />

                <Pressable
                  style={[styles.btn, { backgroundColor: colors.primary }, newPin.length < 4 && { opacity: 0.4 }]}
                  onPress={handleSetPin}
                  disabled={newPin.length < 4}
                >
                  <Text style={styles.btnText}>{t('common.save')}</Text>
                </Pressable>

                {pinModalMember.pin && (
                  <Pressable style={[styles.btn, { backgroundColor: colors.danger }]} onPress={handleRemovePin}>
                    <Text style={styles.btnText}>{t('common.removePin')}</Text>
                  </Pressable>
                )}

                <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]} onPress={() => setPinModalMember(null)}>
                  <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('common.cancel')}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionHint: { fontSize: 13, marginTop: 2 },
  langRow: { flexDirection: 'row', gap: 8 },
  langChip: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  langText: { fontSize: 15 },
  langTextActive: { fontSize: 15, color: 'white', fontWeight: '600' },
  categoryBlock: { borderRadius: 10, overflow: 'hidden' },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  categoryCount: { fontSize: 13, marginRight: 4 },
  categoryItems: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  templateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 6 },
  templateTitle: { fontSize: 14, flex: 1 },
  templateActions: { flexDirection: 'row', gap: 12, paddingLeft: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addText: { fontSize: 14, fontWeight: '600' },
  muted: { fontSize: 13 },
  formContainer: { flex: 1 },
  formTitle: { fontSize: 20, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  label: { fontSize: 14, fontWeight: '600' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16 },
  chipText: { fontSize: 13 },
  chipTextActive: { color: 'white', fontWeight: '600', fontSize: 13 },
  btn: { paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1 },
  btnOutlineText: { fontWeight: '600' },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, gap: 10 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: 'white', fontWeight: '700', fontSize: 16 },
  memberName: { fontSize: 15, fontWeight: '600' },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { borderWidth: 3, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pinOverlay: { flex: 1, justifyContent: 'center', padding: 24 },
  pinDialog: { borderRadius: 12, padding: 20, gap: 12 },
  pinHeader: { alignItems: 'center', gap: 8 },
  pinDialogTitle: { fontSize: 18, fontWeight: '700' },
  pinInput: { borderWidth: 1.5, borderRadius: 8, padding: 14, fontSize: 24, textAlign: 'center', letterSpacing: 12 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 6 },
  pointsLabel: { fontSize: 14, flex: 1 },
  pointsInput: { borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 15, width: 60, textAlign: 'center' },
});
