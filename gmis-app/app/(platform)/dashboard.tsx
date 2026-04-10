// ============================================================
// GMIS — Platform Admin Dashboard (Full)
// Route: /(platform)/dashboard
// Tabs: Dashboard | Pending | Approved | Feature Toggles | Billing
// All data from master Supabase DB (supabase client — not tenantClient)
// Shows org logo if available, falls back to initials
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Image, Modal, FlatList, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";   // master DB
import { formatDate } from "@/lib/helpers";
import { Text, Badge, Spinner, Card } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Types (matching confirmed master DB schema) ────────────
interface Org {
  id:               string;
  name:             string;
  slug:             string;
  email:            string;
  phone:            string | null;
  type:             string | null;
  state:            string | null;
  country:          string | null;
  logo_url:         string | null;
  status:           string;
  payment_status:   string | null;
  admin_name:       string | null;
  admin_email:      string | null;
  created_at:       string;
  approved_at:      string | null;
  locked_at:        string | null;
  lock_reason:      string | null;
  subscription_end: string | null;
  supabase_url:     string | null;
  rejection_reason: string | null;
  organization_documents?: OrgDoc[];
}

interface OrgDoc {
  id: string; document_type: string;
  file_url: string; file_name: string | null; verified: boolean;
}

interface Feature {
  id: string; key: string; label: string; category: string;
}

interface FeatureToggle { feature_id: string; is_enabled: boolean; }

type Tab = "dashboard" | "pending" | "approved" | "toggles" | "billing";

// ── Org Logo / Initials ────────────────────────────────────
function OrgAvatar({ org, size = 40 }: { org: Org; size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  const showLogo = org.logo_url && !imgErr;

  if (showLogo) {
    return (
      <Image
        source={{ uri: org.logo_url! }}
        style={{ width: size, height: size, borderRadius: radius.md }}
        onError={() => setImgErr(true)}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[{
      width: size, height: size, borderRadius: radius.md,
      backgroundColor: brand.blueAlpha15,
      alignItems: "center", justifyContent: "center",
    }]}>
      <Text style={{ fontSize: size * 0.3, fontWeight: fontWeight.bold, color: brand.blue }}>
        {org.slug.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

// ── Status Badge ───────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const v: Record<string, "green" | "amber" | "red" | "blue" | "gray"> = {
    approved: "green", pending: "amber", rejected: "red",
    locked: "red", suspended: "red", paid: "green",
    unpaid: "amber", overdue: "red", trial: "blue",
  };
  return <Badge label={status} variant={v[status] || "gray"} size="xs" />;
}

// ── Main Dashboard Component ───────────────────────────────
export default function PlatformDashboard() {
  const router     = useRouter();
  const { colors } = useTheme();

  const [tab,       setTab]       = useState<Tab>("dashboard");
  const [orgs,      setOrgs]      = useState<Org[]>([]);
  const [features,  setFeatures]  = useState<Feature[]>([]);
  const [toggles,   setToggles]   = useState<FeatureToggle[]>([]);
  const [toggleOrg, setToggleOrg] = useState("");
  const [selected,  setSelected]  = useState<Org | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [stats,     setStats]     = useState({ total: 0, pending: 0, approved: 0, locked: 0 });
  const [toast,     setToast]     = useState<{ msg: string; ok?: boolean } | null>(null);

  const showToast = (msg: string, ok = false) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => { loadData(); loadAdminInfo(); }, []);

  const loadAdminInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/(platform)/login"); return; }
    const { data: admin } = await supabase
      .from("platform_admins")
      .select("full_name")
      .eq("supabase_uid", user.id)
      .maybeSingle();
    if (admin) setAdminName((admin as any).full_name || "Admin");
  };

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const { data } = await supabase
        .from("organizations")
        .select("*, organization_documents(*)")
        .order("created_at", { ascending: false });

      if (data) {
        const list = data as Org[];
        setOrgs(list);
        setStats({
          total:    list.length,
          pending:  list.filter((o) => o.status === "pending").length,
          approved: list.filter((o) => o.status === "approved").length,
          locked:   list.filter((o) => o.status === "locked").length,
        });
      }

      const { data: feats } = await supabase.from("features").select("*").order("category");
      if (feats) setFeatures(feats as Feature[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── Actions ────────────────────────────────────────────
  const approveOrg = async (org: Org) => {
    const { error } = await supabase
      .from("organizations")
      .update({ status: "approved", approved_at: new Date().toISOString() } as any)
      .eq("id", org.id);
    if (error) { showToast("Failed to approve"); return; }
    showToast(`${org.name} approved!`, true);
    setSelected(null);
    loadData(true);
  };

  const rejectOrg = async (org: Org, reason: string) => {
    await supabase.from("organizations")
      .update({ status: "rejected", rejection_reason: reason } as any)
      .eq("id", org.id);
    showToast(`${org.name} rejected.`);
    setSelected(null);
    loadData(true);
  };

  const toggleLock = async (org: Org) => {
    const newStatus = org.status === "locked" ? "approved" : "locked";
    await supabase.from("organizations").update({
      status:     newStatus,
      locked_at:  newStatus === "locked" ? new Date().toISOString() : null,
      lock_reason: newStatus === "locked" ? "Manual lock by platform admin" : null,
    } as any).eq("id", org.id);
    showToast(`${org.name} ${newStatus === "locked" ? "locked" : "unlocked"}.`, newStatus !== "locked");
    loadData(true);
  };

  const loadToggles = async (orgId: string) => {
    setToggleOrg(orgId);
    const { data } = await supabase
      .from("org_feature_toggles")
      .select("feature_id, is_enabled")
      .eq("org_id", orgId);
    if (data) setToggles(data as FeatureToggle[]);
  };

  const toggleFeature = async (featureId: string) => {
    const current = toggles.find((t) => t.feature_id === featureId);
    const newVal  = !current?.is_enabled;
    await supabase.from("org_feature_toggles")
      .upsert({ org_id: toggleOrg, feature_id: featureId, is_enabled: newVal } as any, { onConflict: "org_id,feature_id" });
    setToggles((prev) =>
      prev.some((t) => t.feature_id === featureId)
        ? prev.map((t) => t.feature_id === featureId ? { ...t, is_enabled: newVal } : t)
        : [...prev, { feature_id: featureId, is_enabled: newVal }]
    );
  };

  const isEnabled = (fid: string) => toggles.find((t) => t.feature_id === fid)?.is_enabled ?? true;

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(platform)/login");
  };

  // ── Sidebar nav ────────────────────────────────────────
  const NAV: { id: Tab; label: string; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "pending",   label: "Pending",   badge: stats.pending },
    { id: "approved",  label: "Approved"  },
    { id: "toggles",   label: "Features"  },
    { id: "billing",   label: "Billing"   },
  ];

  const pendingOrgs  = orgs.filter((o) => o.status === "pending");
  const approvedOrgs = orgs.filter((o) => ["approved", "locked"].includes(o.status));

  if (loading) {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
        <Spinner size="lg" label="Loading platform data..." />
      </View>
    );
  }

  return (
    <View style={[layout.fill, layout.fillRow, { backgroundColor: colors.bg.primary }]}>

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: toast.ok ? colors.status.successBg : colors.status.errorBg, borderColor: toast.ok ? colors.status.successBorder : colors.status.errorBorder }]}>
          <Icon name={toast.ok ? "status-success" : "status-error"} size="sm" color={toast.ok ? colors.status.success : colors.status.error} />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: toast.ok ? colors.status.success : colors.status.error, marginLeft: spacing[2] }}>{toast.msg}</Text>
        </View>
      )}

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <View style={[styles.sidebar, { backgroundColor: colors.bg.card, borderRightColor: colors.border.DEFAULT }]}>
        {/* Brand */}
        <View style={[styles.sidebarHeader, { borderBottomColor: colors.border.DEFAULT }]}>
          <View style={styles.brandLogo}>
            <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.base, color: "#fff" }}>G</Text>
          </View>
          <View style={layout.fill}>
            <Text style={{ fontWeight: fontWeight.bold, fontSize: fontSize.sm, color: colors.text.primary }}>GMIS Admin</Text>
            <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted }}>DAMS Technologies</Text>
          </View>
        </View>

        {/* Nav */}
        <View style={{ flex: 1, padding: spacing[2] }}>
          {NAV.map(({ id, label, badge }) => (
            <TouchableOpacity
              key={id}
              onPress={() => setTab(id)}
              activeOpacity={0.75}
              style={[
                styles.navItem,
                tab === id
                  ? { backgroundColor: brand.blueAlpha15, borderRightWidth: 3, borderRightColor: brand.blue }
                  : { borderRightWidth: 3, borderRightColor: "transparent" },
              ]}
            >
              <Text style={{
                flex: 1, fontSize: fontSize.sm,
                fontWeight: tab === id ? fontWeight.semibold : fontWeight.normal,
                color: tab === id ? brand.blue : colors.text.secondary,
              }}>
                {label}
              </Text>
              {!!badge && badge > 0 && (
                <Badge label={String(badge)} variant="amber" size="xs" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={[styles.sidebarFooter, { borderTopColor: colors.border.DEFAULT }]}>
          <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginBottom: spacing[2] }}>
            {adminName}
          </Text>
          <TouchableOpacity onPress={signOut} activeOpacity={0.7}>
            <Text style={{ fontSize: fontSize.xs, color: colors.status.error }}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <ScrollView
        style={layout.fill}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} tintColor={brand.blue} />}
      >

        {/* ── DASHBOARD TAB ── */}
        {tab === "dashboard" && (
          <>
            <Text style={[styles.pageTitle, { color: colors.text.primary }]}>Platform Dashboard</Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing[5] }}>
              DAMS Technologies · Master control
            </Text>

            {/* Stats */}
            <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap", marginBottom: spacing[5] }]}>
              {[
                { label: "Total orgs",  value: stats.total,    color: colors.text.primary },
                { label: "Pending",     value: stats.pending,  color: "#fbbf24" },
                { label: "Approved",    value: stats.approved, color: "#4ade80" },
                { label: "Locked",      value: stats.locked,   color: "#f87171" },
              ].map(({ label, value, color }) => (
                <Card key={label} style={[styles.statCard]}>
                  <Text style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.black, color }}>{value}</Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</Text>
                </Card>
              ))}
            </View>

            {/* Recent orgs */}
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Recent registrations</Text>
              <OrgList orgs={orgs.slice(0, 8)} colors={colors} onSelect={setSelected} onApprove={approveOrg} onLock={toggleLock} />
            </Card>
          </>
        )}

        {/* ── PENDING TAB ── */}
        {tab === "pending" && (
          <>
            <Text style={[styles.pageTitle, { color: colors.text.primary }]}>Pending approvals</Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing[5] }}>
              Review documents and approve or reject each institution
            </Text>
            {pendingOrgs.length === 0 ? (
              <Card>
                <View style={[layout.centredH, { paddingVertical: spacing[8] }]}>
                  <Icon name="status-success" size="3xl" color={colors.status.success} filled />
                  <Text variant="body" color="muted" style={{ marginTop: spacing[3] }}>No pending applications</Text>
                </View>
              </Card>
            ) : (
              pendingOrgs.map((org) => (
                <PendingOrgCard
                  key={org.id}
                  org={org}
                  colors={colors}
                  onApprove={() => approveOrg(org)}
                  onReject={(r) => rejectOrg(org, r)}
                  onView={() => setSelected(org)}
                />
              ))
            )}
          </>
        )}

        {/* ── APPROVED TAB ── */}
        {tab === "approved" && (
          <>
            <Text style={[styles.pageTitle, { color: colors.text.primary }]}>Approved organisations</Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing[5] }}>
              All active schools on GMIS · {approvedOrgs.length} total
            </Text>
            <Card>
              <OrgList orgs={approvedOrgs} colors={colors} onSelect={setSelected} onApprove={approveOrg} onLock={toggleLock} />
            </Card>
          </>
        )}

        {/* ── FEATURE TOGGLES TAB ── */}
        {tab === "toggles" && (
          <>
            <Text style={[styles.pageTitle, { color: colors.text.primary }]}>Feature toggles</Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing[5] }}>
              Turn features on/off per organisation
            </Text>

            {/* Org selector */}
            <Card style={{ marginBottom: spacing[4] }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.secondary, marginBottom: spacing[3] }}>
                Select organisation
              </Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {orgs.filter((o) => o.status === "approved").map((org) => (
                  <TouchableOpacity
                    key={org.id}
                    onPress={() => loadToggles(org.id)}
                    activeOpacity={0.75}
                    style={[
                      styles.orgSelectRow,
                      {
                        backgroundColor: toggleOrg === org.id ? brand.blueAlpha15 : "transparent",
                        borderColor: toggleOrg === org.id ? brand.blue : colors.border.subtle,
                      },
                    ]}
                  >
                    <OrgAvatar org={org} size={32} />
                    <Text style={{ flex: 1, fontSize: fontSize.sm, color: toggleOrg === org.id ? brand.blue : colors.text.primary, marginLeft: spacing[3] }}>
                      {org.name}
                    </Text>
                    {toggleOrg === org.id && <Icon name="ui-check" size="sm" color={brand.blue} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Card>

            {/* Toggles */}
            {toggleOrg && features.length > 0 && (
              <Card>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  Features for {orgs.find((o) => o.id === toggleOrg)?.name}
                </Text>
                {["student", "admin", "lecturer"].map((cat) => {
                  const catFeatures = features.filter((f) => f.category === cat);
                  if (!catFeatures.length) return null;
                  return (
                    <View key={cat} style={{ marginBottom: spacing[5] }}>
                      <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: "uppercase", letterSpacing: 1.2, color: colors.text.muted, marginBottom: spacing[3] }}>
                        {cat} features
                      </Text>
                      {catFeatures.map((feat) => (
                        <View key={feat.id} style={[layout.rowBetween, { paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.border.subtle }]}>
                          <Text style={{ fontSize: fontSize.sm, color: colors.text.primary }}>{feat.label}</Text>
                          <TouchableOpacity
                            onPress={() => toggleFeature(feat.id)}
                            activeOpacity={0.8}
                            style={[
                              styles.toggle,
                              { backgroundColor: isEnabled(feat.id) ? brand.blue : colors.bg.hover },
                            ]}
                          >
                            <View style={[styles.toggleKnob, { left: isEnabled(feat.id) ? spacing[5] : spacing[1] }]} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}

        {/* ── BILLING TAB ── */}
        {tab === "billing" && (
          <>
            <Text style={[styles.pageTitle, { color: colors.text.primary }]}>Billing overview</Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing[5] }}>
              GMIS subscription revenue across all institutions
            </Text>

            <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap", marginBottom: spacing[5] }]}>
              {[
                { label: "Active schools",    value: orgs.filter((o) => o.status === "approved").length, color: "#4ade80" },
                { label: "Overdue payments",  value: orgs.filter((o) => o.payment_status === "overdue").length, color: "#f87171" },
                { label: "Total registered",  value: orgs.length, color: colors.text.primary },
              ].map(({ label, value, color }) => (
                <Card key={label} style={styles.statCard}>
                  <Text style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.black, color }}>{value}</Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</Text>
                </Card>
              ))}
            </View>

            <Card>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>All organisations</Text>
              {orgs.map((org, i) => (
                <View key={org.id} style={[layout.rowBetween, { paddingVertical: spacing[3], flexWrap: "wrap", gap: spacing[2], borderBottomWidth: i < orgs.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}>
                  <View style={[layout.row, { gap: spacing[3] }]}>
                    <OrgAvatar org={org} size={36} />
                    <View>
                      <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.primary }}>{org.name}</Text>
                      <Text style={{ fontSize: fontSize.xs, color: brand.blue }}>{org.slug}.gmis.app</Text>
                    </View>
                  </View>
                  <View style={[layout.row, { gap: spacing[2] }]}>
                    <StatusChip status={org.payment_status || "—"} />
                    <TouchableOpacity
                      onPress={() => toggleLock(org)}
                      activeOpacity={0.75}
                      style={[styles.actionBtn, { backgroundColor: org.status === "locked" ? colors.status.successBg : colors.status.errorBg, borderColor: org.status === "locked" ? colors.status.successBorder : colors.status.errorBorder }]}
                    >
                      <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: org.status === "locked" ? colors.status.success : colors.status.error }}>
                        {org.status === "locked" ? "Unlock" : "Lock"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      {/* ── ORG DETAIL MODAL ─────────────────────────────── */}
      {selected && (
        <OrgDetailModal
          org={selected}
          colors={colors}
          onClose={() => setSelected(null)}
          onApprove={() => approveOrg(selected)}
          onReject={(r) => rejectOrg(selected, r)}
          onLock={() => { toggleLock(selected); setSelected(null); }}
        />
      )}
    </View>
  );
}

// ── Org list (table) ───────────────────────────────────────
function OrgList({ orgs, colors, onSelect, onApprove, onLock }: { orgs: Org[]; colors: any; onSelect: (o: Org) => void; onApprove: (o: Org) => void; onLock: (o: Org) => void }) {
  if (orgs.length === 0) return (
    <View style={[layout.centredH, { paddingVertical: spacing[6] }]}>
      <Text style={{ color: colors.text.muted }}>No organisations yet</Text>
    </View>
  );
  return (
    <View>
      {orgs.map((org, i) => (
        <View key={org.id} style={[layout.rowBetween, { paddingVertical: spacing[3], flexWrap: "wrap", gap: spacing[2], borderBottomWidth: i < orgs.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}>
          <View style={[layout.row, { gap: spacing[3], flex: 1 }]}>
            <OrgAvatar org={org} size={38} />
            <View style={layout.fill}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.primary }} numberOfLines={1}>{org.name}</Text>
              <Text style={{ fontSize: fontSize.xs, color: brand.blue }}>{org.slug}.gmis.app</Text>
              {org.admin_email && <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted }}>{org.admin_email}</Text>}
            </View>
          </View>
          <View style={[layout.row, { gap: spacing[2] }]}>
            <StatusChip status={org.status} />
            <TouchableOpacity onPress={() => onSelect(org)} activeOpacity={0.75} style={styles.btnSm}>
              <Text style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>View</Text>
            </TouchableOpacity>
            {org.status === "pending"  && <TouchableOpacity onPress={() => onApprove(org)} activeOpacity={0.75} style={[styles.btnSm, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}><Text style={{ fontSize: fontSize.xs, color: colors.status.success, fontWeight: fontWeight.bold }}>Approve</Text></TouchableOpacity>}
            {org.status === "approved" && <TouchableOpacity onPress={() => onLock(org)} activeOpacity={0.75} style={[styles.btnSm, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder }]}><Text style={{ fontSize: fontSize.xs, color: colors.status.error }}>Lock</Text></TouchableOpacity>}
            {org.status === "locked"   && <TouchableOpacity onPress={() => onLock(org)} activeOpacity={0.75} style={[styles.btnSm, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}><Text style={{ fontSize: fontSize.xs, color: colors.status.success }}>Unlock</Text></TouchableOpacity>}
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Pending org card ───────────────────────────────────────
function PendingOrgCard({ org, colors, onApprove, onReject, onView }: { org: Org; colors: any; onApprove: () => void; onReject: (r: string) => void; onView: () => void }) {
  const [showReject, setShowReject] = useState(false);
  const [reason,     setReason]     = useState("");

  return (
    <Card style={{ marginBottom: spacing[3] }}>
      <View style={[layout.row, { gap: spacing[3], marginBottom: spacing[4] }]}>
        <OrgAvatar org={org} size={48} />
        <View style={layout.fill}>
          <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary, marginBottom: spacing[1] }}>{org.name}</Text>
          <Text style={{ fontSize: fontSize.xs, color: brand.blue, marginBottom: spacing[1] }}>{org.slug}.gmis.app</Text>
          <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap" }]}>
            {[org.admin_name, org.state && `${org.state}, ${org.country}`, org.type, formatDate(org.created_at)].filter(Boolean).map((v) => (
              <Text key={v} style={{ fontSize: fontSize.xs, color: colors.text.muted }}>{v}</Text>
            ))}
          </View>
        </View>
      </View>

      <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap", marginBottom: showReject ? spacing[4] : 0 }]}>
        <TouchableOpacity onPress={onView} activeOpacity={0.75} style={styles.btnSm}>
          <Text style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>View docs</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onApprove} activeOpacity={0.75} style={[styles.btnSm, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}>
          <Icon name="ui-check" size="xs" color={colors.status.success} />
          <Text style={{ fontSize: fontSize.xs, color: colors.status.success, fontWeight: fontWeight.bold, marginLeft: spacing[1] }}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowReject((v) => !v)} activeOpacity={0.75} style={[styles.btnSm, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder }]}>
          <Text style={{ fontSize: fontSize.xs, color: colors.status.error }}>Reject</Text>
        </TouchableOpacity>
      </View>

      {showReject && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, paddingTop: spacing[4] }}>
          <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginBottom: spacing[2] }}>Rejection reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Documents are unclear..."
            placeholderTextColor={colors.text.muted}
            multiline
            style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], color: colors.text.primary, fontSize: fontSize.sm, marginBottom: spacing[3], minHeight: spacing[16] }}
          />
          <TouchableOpacity
            onPress={() => reason && onReject(reason)}
            disabled={!reason}
            activeOpacity={0.75}
            style={[styles.btnSm, { opacity: reason ? 1 : 0.5, backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder }]}
          >
            <Text style={{ fontSize: fontSize.xs, color: colors.status.error, fontWeight: fontWeight.bold }}>Confirm rejection</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

// ── Org detail modal ───────────────────────────────────────
function OrgDetailModal({ org, colors, onClose, onApprove, onReject, onLock }: { org: Org; colors: any; onClose: () => void; onApprove: () => void; onReject: (r: string) => void; onLock: () => void }) {
  const [reason, setReason] = useState("");
  const docs = (org as any).organization_documents || [];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.7)" }]} activeOpacity={1} onPress={onClose} />
      <View style={[styles.modal, { backgroundColor: colors.bg.elevated, borderColor: colors.border.DEFAULT }]}>
        <View style={[layout.rowBetween, { marginBottom: spacing[4] }]}>
          <View style={[layout.row, { gap: spacing[3] }]}>
            <OrgAvatar org={org} size={44} />
            <View>
              <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary }}>{org.name}</Text>
              <Text style={{ fontSize: fontSize.xs, color: brand.blue }}>{org.slug}.gmis.app</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="ui-close" size="md" color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {[
            ["Type",       org.type || "—"],
            ["State",      org.state || "—"],
            ["Country",    org.country || "—"],
            ["Phone",      org.phone || "—"],
            ["Admin",      org.admin_name || "—"],
            ["Admin email",org.admin_email || "—"],
            ["Status",     org.status],
            ["Registered", formatDate(org.created_at)],
          ].map(([k, v]) => (
            <View key={k} style={[layout.rowBetween, { paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.border.subtle }]}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text.muted }}>{k}</Text>
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.primary }}>{v}</Text>
            </View>
          ))}

          {docs.length > 0 && (
            <>
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: "uppercase", letterSpacing: 1, color: colors.text.muted, marginTop: spacing[4], marginBottom: spacing[3] }}>Documents</Text>
              {docs.map((doc: OrgDoc) => (
                <TouchableOpacity
                  key={doc.id}
                  style={[layout.rowBetween, { paddingVertical: spacing[3], backgroundColor: colors.bg.hover, borderRadius: radius.lg, paddingHorizontal: spacing[3], marginBottom: spacing[2] }]}
                  activeOpacity={0.7}
                >
                  <View style={[layout.row, { gap: spacing[2] }]}>
                    <Icon name="content-file" size="sm" color={colors.text.secondary} />
                    <Text style={{ fontSize: fontSize.sm, color: colors.text.primary }}>{doc.document_type.toUpperCase()}</Text>
                  </View>
                  <Text style={{ fontSize: fontSize.xs, color: brand.blue }}>View →</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <View style={{ marginTop: spacing[5], gap: spacing[3] }}>
            {org.status === "pending" && (
              <TouchableOpacity onPress={onApprove} activeOpacity={0.75} style={[styles.modalBtn, { backgroundColor: brand.blue }]}>
                <Icon name="ui-check" size="sm" color="#fff" />
                <Text style={{ color: "#fff", fontWeight: fontWeight.bold, marginLeft: spacing[2] }}>Approve school</Text>
              </TouchableOpacity>
            )}
            {org.status === "approved" && (
              <TouchableOpacity onPress={onLock} activeOpacity={0.75} style={[styles.modalBtn, { backgroundColor: colors.status.errorBg, borderWidth: 1, borderColor: colors.status.errorBorder }]}>
                <Text style={{ color: colors.status.error, fontWeight: fontWeight.semibold }}>Lock school</Text>
              </TouchableOpacity>
            )}
            {org.status === "locked" && (
              <TouchableOpacity onPress={onLock} activeOpacity={0.75} style={[styles.modalBtn, { backgroundColor: colors.status.successBg, borderWidth: 1, borderColor: colors.status.successBorder }]}>
                <Text style={{ color: colors.status.success, fontWeight: fontWeight.semibold }}>Unlock school</Text>
              </TouchableOpacity>
            )}
            {org.status === "pending" && (
              <>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Rejection reason..."
                  placeholderTextColor={colors.text.muted}
                  style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], color: colors.text.primary, fontSize: fontSize.sm }}
                />
                <TouchableOpacity
                  onPress={() => reason && onReject(reason)}
                  disabled={!reason}
                  activeOpacity={0.75}
                  style={[styles.modalBtn, { opacity: reason ? 1 : 0.5, backgroundColor: colors.status.errorBg, borderWidth: 1, borderColor: colors.status.errorBorder }]}
                >
                  <Text style={{ color: colors.status.error, fontWeight: fontWeight.semibold }}>Reject school</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toast: { position: "absolute", top: spacing[3], left: spacing[3], right: spacing[3], zIndex: 200, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  sidebar: { width: 220, borderRightWidth: 1, flexDirection: "column" },
  sidebarHeader: { flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[4], borderBottomWidth: 1 },
  brandLogo: { width: spacing[9], height: spacing[9], borderRadius: radius.lg, backgroundColor: brand.blue, alignItems: "center", justifyContent: "center" },
  navItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.md, marginBottom: spacing[1] },
  sidebarFooter: { padding: spacing[4], borderTopWidth: 1 },
  mainContent: { padding: spacing[6] },
  pageTitle: { fontSize: fontSize["2xl"], fontWeight: fontWeight.bold, marginBottom: spacing[1] },
  sectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: spacing[4] },
  statCard: { flex: 1, minWidth: 100, alignItems: "center", padding: spacing[4] },
  orgSelectRow: { flexDirection: "row", alignItems: "center", padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing[2] },
  toggle: { width: 44, height: 24, borderRadius: 12, position: "relative" },
  toggleKnob: { width: 20, height: 20, backgroundColor: "#fff", borderRadius: 10, position: "absolute", top: 2 },
  btnSm: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 1, borderRadius: radius.full, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)" },
  actionBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1 },
  modal: { position: "absolute", top: "5%", left: "5%", right: "5%", bottom: "5%", borderRadius: radius["2xl"], borderWidth: 1, padding: spacing[6], zIndex: 10, maxWidth: 560, alignSelf: "center", width: "90%" },
  modalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing[3], borderRadius: radius.xl },
});
