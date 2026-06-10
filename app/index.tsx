import { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/data/store';
import { memberRepo, householdRepo } from '@/data/repositories';
import { useTheme } from '@/theme';
import type { Member } from '@/types';

export default function ProfilePicker() {
  const { t } = useTranslation();
  const households = useStore((s) => s.households);
  const activeHouseholdId = useStore((s) => s.activeHouseholdId);
  const members = useStore((s) => s.members);
  const setActiveHousehold = useStore((s) => s.setActiveHousehold);
  const setActiveMember = useStore((s) => s.setActiveMember);
  const { colors } = useTheme();

  const [pinTarget, setPinTarget] = useState<Member | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showNewHousehold, setShowNewHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');

  const householdMembers = members.filter((m) => m.householdId === activeHouseholdId);

  function selectHousehold(id: string) {
    setActiveHousehold(id);
    setActiveMember(null);
  }

  function handleCreateHousehold() {
    const name = newHouseholdName.trim();
    if (!name) return;
    const h = householdRepo.create(name);
    setActiveHousehold(h.id);
    setActiveMember(null);
    setShowNewHousehold(false);
    setNewHouseholdName('');
  }

  function pick(member: Member) {
    if (member.pin) {
      setPinTarget(member);
      setPinInput('');
      setPinError(false);
    } else {
      login(member.id);
    }
  }

  function login(id: string) {
    setActiveMember(id);
    // Root layout's Redirect reacts to activeMemberId being set
  }

  function handlePinSubmit() {
    if (!pinTarget) return;
    if (memberRepo.verifyPin(pinTarget.id, pinInput)) {
      setPinTarget(null);
      login(pinTarget.id);
    } else {
      setPinError(true);
    }
  }

  function goBackToHouseholds() {
    setActiveHousehold(null);
    setActiveMember(null);
  }

  // ── Household picker ──
  if (!activeHouseholdId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('common.selectHousehold')}</Text>

        {households.length === 0 && (
          <Text style={{ color: colors.muted }}>{t('common.noHouseholds')}</Text>
        )}

        {households.map((h) => (
          <Pressable
            key={h.id}
            style={[styles.row, { borderLeftColor: colors.primary, backgroundColor: colors.card }]}
            onPress={() => selectHousehold(h.id)}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Ionicons name="home-outline" size={20} color="white" />
            </View>
            <Text style={[styles.name, { color: colors.text }]}>{h.name}</Text>
          </Pressable>
        ))}

        <Pressable
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowNewHousehold(true)}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.btnText}>{t('common.createHousehold')}</Text>
        </Pressable>

        {/* New household modal */}
        <Modal visible={showNewHousehold} transparent animationType="fade">
          <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialog, { backgroundColor: colors.card }]}>
              <Text style={[styles.dialogTitle, { color: colors.text }]}>{t('common.createHousehold')}</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                placeholder={t('common.householdNamePlaceholder')}
                placeholderTextColor={colors.muted}
                value={newHouseholdName}
                onChangeText={setNewHouseholdName}
                autoFocus
              />
              <View style={styles.dialogButtons}>
                <Pressable
                  style={[styles.btn, { backgroundColor: colors.primary }, !newHouseholdName.trim() && { opacity: 0.4 }]}
                  onPress={handleCreateHousehold}
                  disabled={!newHouseholdName.trim()}
                >
                  <Text style={styles.btnText}>{t('common.save')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]}
                  onPress={() => { setShowNewHousehold(false); setNewHouseholdName(''); }}
                >
                  <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Profile picker (scoped to active household) ──
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable style={styles.backRow} onPress={goBackToHouseholds}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('common.switchHousehold')}</Text>
      </Pressable>

      <Text style={[styles.title, { color: colors.text }]}>{t('common.whoAreYou')}</Text>
      {householdMembers.map((m) => (
        <Pressable key={m.id} style={[styles.row, { borderLeftColor: m.color, backgroundColor: colors.card }]} onPress={() => pick(m)}>
          <View style={[styles.avatar, { backgroundColor: m.color }]}>
            <Text style={styles.avatarText}>{m.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]}>{m.name}</Text>
            <Text style={[styles.role, { color: colors.muted }]}>{t(`common.${m.role}`)}</Text>
          </View>
          {m.pin && <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />}
        </Pressable>
      ))}

      {householdMembers.length === 0 && (
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 16 }}>
          {t('settings.membersHint')}
        </Text>
      )}

      {/* PIN entry modal */}
      <Modal visible={pinTarget !== null} transparent animationType="fade">
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <View style={styles.dialogHeader}>
              {pinTarget && (
                <View style={[styles.dialogAvatar, { backgroundColor: pinTarget.color }]}>
                  <Text style={styles.avatarText}>{pinTarget.name[0]}</Text>
                </View>
              )}
              <Text style={[styles.dialogTitle, { color: colors.text }]}>
                {t('common.enterPin')}
              </Text>
            </View>

            <TextInput
              style={[styles.pinInput, { borderColor: pinError ? colors.danger : colors.border, color: colors.text }]}
              placeholder={t('common.pinPlaceholder')}
              placeholderTextColor={colors.muted}
              value={pinInput}
              onChangeText={(v) => { setPinInput(v.replace(/[^0-9]/g, '').slice(0, 4)); setPinError(false); }}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
            />
            {pinError && <Text style={{ color: colors.danger, fontSize: 13 }}>{t('common.wrongPin')}</Text>}

            <View style={styles.dialogButtons}>
              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary }, pinInput.length < 4 && { opacity: 0.4 }]}
                onPress={handlePinSubmit}
                disabled={pinInput.length < 4}
              >
                <Text style={styles.btnText}>{t('common.confirm')}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.primary }]} onPress={() => setPinTarget(null)}>
                <Text style={[styles.btnOutlineText, { color: colors.primary }]}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderLeftWidth: 4, borderRadius: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontWeight: '700', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '600' },
  role: { fontSize: 13 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 8, marginTop: 8 },
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 12, padding: 20, gap: 16 },
  dialogHeader: { alignItems: 'center', gap: 10 },
  dialogAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dialogTitle: { fontSize: 18, fontWeight: '700' },
  input: { borderWidth: 1.5, borderRadius: 8, padding: 14, fontSize: 16 },
  pinInput: { borderWidth: 1.5, borderRadius: 8, padding: 14, fontSize: 24, textAlign: 'center', letterSpacing: 12 },
  dialogButtons: { gap: 8 },
  btn: { paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1 },
  btnOutlineText: { fontWeight: '600' },
});
