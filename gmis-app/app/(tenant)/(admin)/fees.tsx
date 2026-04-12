// ============================================================
// GMIS — Admin Fee Structure Management
// Route: /(tenant)/(admin)/fees
// Uses: fee_structure (fee_type_id FK → fee_types), student_payments
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput, Switch,
  StyleSheet, RefreshControl, Alert, ActivityIndicator,
} from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useToast }        from "@/components/ui/Toast";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { StatCard }        from "@/components/ui/StatCard";
import { EmptyState }      from "@/components/ui/EmptyState";
import { Spinner }         from "@/components/ui/Spinner";
import { BottomSheet }     from "@/components/ui/BottomSheet";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { formatNaira }     from "@/lib/helpers";
import { useAutoLoad }     from "@/lib/useAutoLoad";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────

interface FeeType  { id: string; name: string; description: string | null; }
interface FeeItem  {
  id:          string;
  name:        string;
  amount:      number;
  level:       string | null;
  session:     string | null;
  semester:    string | null;
  is_active:   boolean;
  description: string | null;
  fee_type_id: string | null;
  fee_type_name?: string;   // joined from fee_types
}
interface Payment  { id: string; amount: number; status: string; fee_structure_id?: string | null; fee_type_id?: string | null; }

type FilterTab = "all" | "active" | "inactive";

interface FeeFormData {
  name:        string;
  amount:      string;
  fee_type_id: string;
  level:       string;
  session:     string;
  semester:    string;
  description: string;
  is_active:   boolean;
}

const EMPTY_FORM: FeeFormData = {
  name:        "",
  amount:      "",
  fee_type_id: "",
  level:       "all",
  session:     "",
  semester:    "all",
  description: "",
  is_active:   true,
};

const LEVEL_OPTIONS = ["all", "100", "200", "300", "400", "500", "600"];
const SEMESTER_OPTIONS = [
  { key: "all",    label: "All"    },
  { key: "first",  label: "First"  },
  { key: "second", label: "Second" },
  { key: "third",  label: "Third"  },
];

// ── Fee Form Sheet ─────────────────────────────────────────

interface FeeSheetProps {
  visible:   boolean;
  onClose:   () => void;
  onSave:    (data: FeeFormData) => Promise<void>;
  initial?:  FeeFormData;
  feeTypes:  FeeType[];
  colors:    any;
  editMode:  boolean;
  currentSession: string;
}

function FeeSheet({ visible, onClose, onSave, initial, feeTypes, colors, editMode, currentSession }: FeeSheetProps) {
  const [form,   setForm]   = useState<FeeFormData>(initial ?? { ...EMPTY_FORM, session: currentSession });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setForm(initial ?? { ...EMPTY_FORM, session: currentSession });
  }, [visible, initial, currentSession]);

  const set = <K extends keyof FeeFormData>(key: K, val: FeeFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert("Required", "Please enter a fee name."); return; }
    if (!form.fee_type_id) { Alert.alert("Required", "Please select a fee type."); return; }
    const amt = parseFloat(form.amount.replace(/[^0-9.]/g, ""));
    if (isNaN(amt) || amt <= 0) { Alert.alert("Invalid amount", "Please enter a valid positive amount."); return; }
    setSaving(true);
    try { await onSave({ ...form, amount: String(amt) }); onClose(); }
    catch (err: any) { Alert.alert("Error", err?.message || "Failed to save fee item. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable snapHeight={720}>
      <View style={[layout.rowBetween, { paddingHorizontal: spacing[5], marginBottom: spacing[4] }]}>
        <Text variant="subtitle" weight="bold" color="primary">{editMode ? "Edit Fee Item" : "Add Fee Item"}</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.iconBtn}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing[5] }}>
        {/* Fee Name */}
        <Text variant="caption" weight="semibold" color="muted" style={s.fieldLabel}>FEE NAME</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
          placeholder="e.g. First Semester School Fees 2025/2026"
          placeholderTextColor={colors.text.muted}
          value={form.name}
          onChangeText={(v) => set("name", v)}
          maxLength={120}
        />

        {/* Amount */}
        <Text variant="caption" weight="semibold" color="muted" style={[s.fieldLabel, { marginTop: spacing[4] }]}>AMOUNT (₦)</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
          placeholder="e.g. 75000"
          placeholderTextColor={colors.text.muted}
          value={form.amount}
          onChangeText={(v) => set("amount", v)}
          keyboardType="numeric"
        />

        {/* Fee Type */}
        <Text variant="caption" weight="semibold" color="muted" style={[s.fieldLabel, { marginTop: spacing[4] }]}>FEE TYPE *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[1] }}>
          <View style={[layout.row, { gap: spacing[2], paddingBottom: spacing[1] }]}>
            {feeTypes.map((ft) => {
              const active = form.fee_type_id === ft.id;
              return (
                <TouchableOpacity key={ft.id} onPress={() => set("fee_type_id", ft.id)} activeOpacity={0.75}
                  style={[s.chip, { backgroundColor: active ? brand.blue : colors.bg.hover, borderColor: active ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: active ? "#fff" : colors.text.secondary }}>
                    {ft.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Level */}
        <Text variant="caption" weight="semibold" color="muted" style={[s.fieldLabel, { marginTop: spacing[4] }]}>LEVEL</Text>
        <View style={[layout.row, { flexWrap: "wrap", gap: spacing[2] }]}>
          {LEVEL_OPTIONS.map((l) => {
            const active = form.level === l;
            return (
              <TouchableOpacity key={l} onPress={() => set("level", l)} activeOpacity={0.75}
                style={[s.chipSm, { backgroundColor: active ? brand.indigo : colors.bg.hover, borderColor: active ? brand.indigo : colors.border.DEFAULT }]}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: active ? "#fff" : colors.text.secondary }}>
                  {l === "all" ? "All" : `${l}L`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Session */}
        <Text variant="caption" weight="semibold" color="muted" style={[s.fieldLabel, { marginTop: spacing[4] }]}>SESSION</Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
          placeholder={`e.g. ${currentSession || "2025/2026"}`}
          placeholderTextColor={colors.text.muted}
          value={form.session}
          onChangeText={(v) => set("session", v)}
          maxLength={20}
        />

        {/* Semester */}
        <Text variant="caption" weight="semibold" color="muted" style={[s.fieldLabel, { marginTop: spacing[4] }]}>SEMESTER</Text>
        <View style={[layout.row, { gap: spacing[2] }]}>
          {SEMESTER_OPTIONS.map((sem) => {
            const active = form.semester === sem.key;
            return (
              <TouchableOpacity key={sem.key} onPress={() => set("semester", sem.key)} activeOpacity={0.75}
                style={[s.chipSm, { backgroundColor: active ? brand.gold : colors.bg.hover, borderColor: active ? brand.gold : colors.border.DEFAULT }]}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: active ? "#fff" : colors.text.secondary }}>
                  {sem.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <Text variant="caption" weight="semibold" color="muted" style={[s.fieldLabel, { marginTop: spacing[4] }]}>DESCRIPTION (OPTIONAL)</Text>
        <TextInput
          style={[s.input, s.multilineInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
          placeholder="Short description..."
          placeholderTextColor={colors.text.muted}
          value={form.description}
          onChangeText={(v) => set("description", v)}
          multiline textAlignVertical="top" maxLength={300}
        />

        {/* Active toggle */}
        <View style={[layout.rowBetween, s.toggleRow, { borderColor: colors.border.DEFAULT, marginTop: spacing[4] }]}>
          <View style={layout.fill}>
            <Text variant="label" weight="semibold" color="primary">Active</Text>
            <Text variant="micro" color="muted">Students can pay this fee when active</Text>
          </View>
          <Switch value={form.is_active} onValueChange={(v) => set("is_active", v)}
            trackColor={{ false: colors.border.DEFAULT, true: brand.blue }} thumbColor="#fff" />
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !form.name.trim() || !form.amount.trim() || !form.fee_type_id}
          activeOpacity={0.75}
          style={[s.saveBtn, {
            backgroundColor: saving || !form.name.trim() || !form.amount.trim() || !form.fee_type_id
              ? colors.bg.hover : brand.blue,
            marginTop: spacing[5], marginBottom: spacing[6],
          }]}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Icon name="action-save" size="sm" color="#fff" />
              <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>
                {editMode ? "Save Changes" : "Add Fee Item"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// ── Main Screen ────────────────────────────────────────────

export default function AdminFees() {
  const router            = useRouter();
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();
  const { showToast }     = useToast();

  const [fees,           setFees]           = useState<FeeItem[]>([]);
  const [feeTypes,       setFeeTypes]       = useState<FeeType[]>([]);
  const [payments,       setPayments]       = useState<Payment[]>([]);
  const [currentSession, setCurrentSession] = useState("");
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [filterTab,      setFilterTab]      = useState<FilterTab>("all");
  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [editTarget,     setEditTarget]     = useState<FeeItem | null>(null);

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useAutoLoad(() => { if (db) load(); }, [db], { hasData: feeTypes.length > 0 });

  const load = useCallback(async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    try {
      const [feesRes, typesRes, paymentsRes, settingsRes] = await Promise.allSettled([
        db.from("fee_structure")
          .select("id, name, amount, level, session, semester, is_active, description, fee_type_id, fee_types(id, name)")
          .order("session", { ascending: false }).order("name"),
        db.from("fee_types").select("id, name, description").order("name"),
        db.from("student_payments").select("id, amount, status, fee_type_id").limit(5000),
        db.from("org_settings").select("current_session").maybeSingle(),
      ]);

      if (typesRes.status === "fulfilled" && typesRes.value.data) {
        setFeeTypes(typesRes.value.data as FeeType[]);
      }
      if (feesRes.status === "fulfilled" && feesRes.value.data) {
        const mapped = (feesRes.value.data as any[]).map((f) => ({
          id:           f.id,
          name:         f.name,
          amount:       parseFloat(f.amount) || 0,
          level:        f.level,
          session:      f.session,
          semester:     f.semester,
          is_active:    f.is_active,
          description:  f.description,
          fee_type_id:  f.fee_type_id,
          fee_type_name: (f.fee_types as any)?.name || "",
        }));
        setFees(mapped);
      }
      if (paymentsRes.status === "fulfilled" && paymentsRes.value.data) {
        setPayments(paymentsRes.value.data as Payment[]);
      }
      if (settingsRes.status === "fulfilled") {
        setCurrentSession((settingsRes.value.data as any)?.current_session || "");
      }
    } finally { setLoading(false); setRefreshing(false); }
  }, [db]);

  // ── CRUD ────────────────────────────────────────────────

  const handleSave = async (formData: FeeFormData) => {
    if (!db) throw new Error("No DB");
    const payload: any = {
      name:        formData.name.trim(),
      amount:      parseFloat(formData.amount),
      fee_type_id: formData.fee_type_id || null,
      level:       formData.level === "all" ? null : formData.level,
      session:     formData.session.trim() || null,
      semester:    formData.semester === "all" ? null : formData.semester,
      description: formData.description.trim() || null,
      is_active:   formData.is_active,
    };

    if (editTarget) {
      const { error } = await db.from("fee_structure").update(payload).eq("id", editTarget.id);
      if (error) throw error;
      showToast({ message: "Fee item updated.", variant: "success" });
    } else {
      const { error } = await db.from("fee_structure").insert(payload);
      if (error) throw error;
      showToast({ message: "Fee item added.", variant: "success" });
    }
    setEditTarget(null);
    await load(true);
  };

  const handleDelete = (fee: FeeItem) => {
    Alert.alert("Delete Fee Item", `Remove "${fee.name}"? This will not affect existing payment records.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!db) return;
        const { error } = await db.from("fee_structure").delete().eq("id", fee.id);
        if (error) { showToast({ message: "Failed to delete fee item.", variant: "error" }); return; }
        setFees((prev) => prev.filter((f) => f.id !== fee.id));
        showToast({ message: "Fee item deleted.", variant: "info" });
      }},
    ]);
  };

  const openActions = (fee: FeeItem) => {
    Alert.alert(fee.name, formatNaira(fee.amount), [
      { text: "Edit",   onPress: () => { setEditTarget(fee); setSheetOpen(true); } },
      { text: "Toggle " + (fee.is_active ? "Inactive" : "Active"), onPress: async () => {
        if (!db) return;
        const newState = !fee.is_active;
        await db.from("fee_structure").update({ is_active: newState } as any).eq("id", fee.id);
        setFees((prev) => prev.map((f) => f.id === fee.id ? { ...f, is_active: newState } : f));
        showToast({ message: `Fee marked ${newState ? "active" : "inactive"}.`, variant: "info" });
      }},
      { text: "Delete", style: "destructive", onPress: () => handleDelete(fee) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ── Derived stats ──────────────────────────────────────
  const activeFeeCount  = fees.filter((f) => f.is_active).length;
  const pendingCount    = payments.filter((p) => p.status === "pending").length;
  const totalCollected  = payments.filter((p) => p.status === "success").reduce((s, p) => s + (p.amount || 0), 0);
  const expectedRevenue = fees.filter((f) => f.is_active).reduce((s, f) => s + (f.amount || 0), 0);

  const filteredFees = useMemo(() => {
    if (filterTab === "active")   return fees.filter((f) => f.is_active);
    if (filterTab === "inactive") return fees.filter((f) => !f.is_active);
    return fees;
  }, [fees, filterTab]);

  const editInitial: FeeFormData | undefined = useMemo(() => {
    if (!editTarget) return undefined;
    return {
      name:        editTarget.name,
      amount:      String(editTarget.amount),
      fee_type_id: editTarget.fee_type_id ?? "",
      level:       editTarget.level    ?? "all",
      session:     editTarget.session  ?? "",
      semester:    editTarget.semester ?? "all",
      description: editTarget.description ?? "",
      is_active:   editTarget.is_active,
    };
  }, [editTarget]);

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: "all",      label: `All (${fees.length})` },
    { key: "active",   label: `Active (${activeFeeCount})` },
    { key: "inactive", label: `Inactive (${fees.length - activeFeeCount})` },
  ];

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Fee Structure"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <View style={[layout.fill, { backgroundColor: colors.bg.primary }]}>

        {/* Top bar */}
        <View style={[s.topBar, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          <View>
            <Text variant="heading" color="primary">Fee Structure</Text>
            <Text variant="caption" color="muted">{fees.length} fee item{fees.length !== 1 ? "s" : ""} · {currentSession}</Text>
          </View>
          <TouchableOpacity onPress={() => { setEditTarget(null); setSheetOpen(true); }} activeOpacity={0.75}
            style={[s.addBtn, { backgroundColor: brand.blue }]}>
            <Icon name="ui-add" size="sm" color="#fff" />
            <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Add Fee</Text>
          </TouchableOpacity>
        </View>

        {/* Filter tabs */}
        <View style={[s.tabBar, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[layout.row, { gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3] }]}>
              {FILTER_TABS.map((t) => {
                const active = filterTab === t.key;
                return (
                  <TouchableOpacity key={t.key} onPress={() => setFilterTab(t.key)} activeOpacity={0.75}
                    style={[s.tab, { backgroundColor: active ? brand.blue : colors.bg.hover, borderColor: active ? brand.blue : colors.border.DEFAULT }]}>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: active ? "#fff" : colors.text.secondary }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <ScrollView
          style={layout.fill}
          contentContainerStyle={{ padding: pagePadding, gap: spacing[4], paddingBottom: spacing[20] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
        >
          {loading ? (
            <View style={[layout.centred, { paddingVertical: spacing[16] }]}><Spinner size="lg" label="Loading fees..." /></View>
          ) : (
            <>
              {/* Stats row */}
              <View style={[layout.row, { flexWrap: "wrap", gap: spacing[3] }]}>
                <StatCard icon="nav-payments" label="Collected" value={formatNaira(totalCollected)} color="success" style={{ flex: 1, minWidth: 140 }} />
                <StatCard icon="status-pending" label="Pending" value={String(pendingCount)} color={pendingCount > 0 ? "warning" : "success"} style={{ flex: 1, minWidth: 140 }} />
                <StatCard icon="nav-fees" label="Active Fees" value={String(activeFeeCount)} color="brand" style={{ flex: 1, minWidth: 140 }} />
                <StatCard icon="nav-paystack" label="Expected" value={formatNaira(expectedRevenue)} color="gold" style={{ flex: 1, minWidth: 140 }} />
              </View>

              {/* Fee items list */}
              <Card>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Fee Items</Text>
                {filteredFees.length === 0 ? (
                  <EmptyState icon="nav-fees" title="No fee items"
                    description={filterTab === "all" ? 'Tap "Add Fee" to create your first fee.' : `No ${filterTab} fees.`} />
                ) : (
                  filteredFees.map((fee, i) => (
                    <TouchableOpacity key={fee.id} activeOpacity={0.75} onPress={() => openActions(fee)}
                      style={[s.feeRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < filteredFees.length - 1 ? 1 : 0 }]}>
                      <View style={layout.fill}>
                        <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap", marginBottom: 2 }]}>
                          <Text variant="label" weight="semibold" color="primary">{fee.name}</Text>
                          {fee.fee_type_name ? <Badge label={fee.fee_type_name} variant="blue" size="xs" /> : null}
                        </View>
                        <Text variant="micro" color="muted">
                          {fee.level ? `${fee.level}L` : "All levels"}
                          {fee.session  ? ` · ${fee.session}`  : ""}
                          {fee.semester ? ` · ${fee.semester.charAt(0).toUpperCase() + fee.semester.slice(1)} Sem` : ""}
                        </Text>
                        {fee.description ? <Text variant="micro" color="muted" numberOfLines={1}>{fee.description}</Text> : null}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: spacing[2] }}>
                        <Text variant="label" weight="bold" color="primary">{formatNaira(fee.amount)}</Text>
                        <Badge label={fee.is_active ? "Active" : "Inactive"} variant={fee.is_active ? "green" : "gray"} size="sm" />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </Card>

              {/* Revenue summary */}
              {totalCollected > 0 && (
                <Card>
                  <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Payment Summary</Text>
                  <View style={[layout.rowBetween, { paddingVertical: spacing[2] }]}>
                    <Text variant="caption" color="secondary">Total collected</Text>
                    <Text variant="label" weight="bold" color="success">{formatNaira(totalCollected)}</Text>
                  </View>
                  <View style={[layout.rowBetween, { paddingVertical: spacing[2] }]}>
                    <Text variant="caption" color="secondary">Pending payments</Text>
                    <Text variant="label" weight="bold" color="warning">{pendingCount}</Text>
                  </View>
                  <View style={[layout.rowBetween, { paddingVertical: spacing[2] }]}>
                    <Text variant="caption" color="secondary">Expected revenue</Text>
                    <Text variant="label" weight="bold" color="primary">{formatNaira(expectedRevenue)}</Text>
                  </View>
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </View>

      <FeeSheet
        visible={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        initial={editInitial}
        feeTypes={feeTypes}
        colors={colors}
        editMode={!!editTarget}
        currentSession={currentSession}
      />
    </AppShell>
  );
}

const s = StyleSheet.create({
  topBar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomWidth: 1 },
  tabBar:        { borderBottomWidth: 1 },
  tab:           { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  addBtn:        { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full },
  iconBtn:       { width: spacing[8], height: spacing[8], borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  fieldLabel:    { marginBottom: spacing[2] },
  input:         { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[3], fontSize: fontSize.sm },
  multilineInput:{ height: 72, paddingTop: spacing[3] },
  chip:          { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  chipSm:        { paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2, borderRadius: radius.full, borderWidth: 1 },
  toggleRow:     { paddingVertical: spacing[3], borderTopWidth: 1 },
  saveBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[2], paddingVertical: spacing[3] + 2, borderRadius: radius.xl },
  feeRow:        { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
});
