// ============================================================
// GMIS — Admin Payment Gateway Settings
// Route: /(tenant)/(admin)/payment-gateway
//
// Features:
//   • Support multiple gateways: Paystack, Flutterwave, Remita,
//     Interswitch, Squad, and custom
//   • Per-gateway: public key, secret key, webhook secret, mode
//   • Enable / disable each gateway
//   • Assign a default gateway for all fees
//   • Per-fee gateway override (from fees page)
//   • Instructions link per gateway
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Switch, ActivityIndicator,
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
import { Spinner }         from "@/components/ui/Spinner";
import { BottomSheet }     from "@/components/ui/BottomSheet";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

// ── Gateway catalogue ──────────────────────────────────────
const GATEWAY_CATALOGUE = [
  {
    key: "paystack",
    name: "Paystack",
    description: "Most popular in Nigeria. Supports cards, bank transfer, USSD.",
    color: "#00C3F7",
    fields: [
      { key: "public_key",    label: "Public Key",    placeholder: "pk_live_…",  secret: false },
      { key: "secret_key",    label: "Secret Key",    placeholder: "sk_live_…",  secret: true  },
      { key: "webhook_secret", label: "Webhook Secret", placeholder: "Optional", secret: true  },
    ],
  },
  {
    key: "flutterwave",
    name: "Flutterwave",
    description: "Pan-African gateway. Supports mobile money, cards, USSD.",
    color: "#F5A623",
    fields: [
      { key: "public_key",    label: "Public Key",    placeholder: "FLWPUBK-…", secret: false },
      { key: "secret_key",    label: "Secret Key",    placeholder: "FLWSECK-…", secret: true  },
      { key: "encryption_key", label: "Encryption Key", placeholder: "…",      secret: true  },
    ],
  },
  {
    key: "remita",
    name: "Remita",
    description: "Government-approved. Used widely in public universities.",
    color: "#003E91",
    fields: [
      { key: "merchant_id",  label: "Merchant ID",   placeholder: "…",          secret: false },
      { key: "service_type_id", label: "Service Type ID", placeholder: "…",     secret: false },
      { key: "api_key",      label: "API Key",        placeholder: "…",          secret: true  },
    ],
  },
  {
    key: "interswitch",
    name: "Interswitch",
    description: "QuickTeller / Webpay for Nigerian institutions.",
    color: "#E31837",
    fields: [
      { key: "merchant_code", label: "Merchant Code", placeholder: "…", secret: false },
      { key: "pay_item_id",   label: "Pay Item ID",   placeholder: "…", secret: false },
      { key: "mac_key",       label: "MAC Key",       placeholder: "…", secret: true  },
    ],
  },
  {
    key: "squad",
    name: "Squad (GTBank)",
    description: "GTBank's payment gateway with instant settlement.",
    color: "#F68B1E",
    fields: [
      { key: "public_key",  label: "Public Key",  placeholder: "sandbox_pk_…", secret: false },
      { key: "secret_key",  label: "Secret Key",  placeholder: "sandbox_sk_…", secret: true  },
    ],
  },
  {
    key: "custom",
    name: "Custom Gateway",
    description: "Use any custom payment provider with your own integration.",
    color: "#6b7280",
    fields: [
      { key: "gateway_name", label: "Gateway Name", placeholder: "e.g. MyPay",  secret: false },
      { key: "api_key",      label: "API Key",       placeholder: "…",          secret: true  },
      { key: "base_url",     label: "API Base URL",  placeholder: "https://…",  secret: false },
    ],
  },
] as const;

type GatewayKey = typeof GATEWAY_CATALOGUE[number]["key"];

interface GatewayConfig {
  id?: string;
  gateway: GatewayKey;
  is_enabled: boolean;
  is_default: boolean;
  test_mode: boolean;
  credentials: Record<string, string>;
}

// ── Gateway Config Sheet ───────────────────────────────────
function GatewaySheet({ visible, onClose, gatewayKey, config, onSave, colors }: {
  visible: boolean; onClose: () => void; gatewayKey: GatewayKey;
  config: GatewayConfig | null; onSave: (data: Partial<GatewayConfig>) => Promise<void>; colors: any;
}) {
  const catalogue = GATEWAY_CATALOGUE.find((g) => g.key === gatewayKey)!;
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [testMode,    setTestMode]    = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) {
      setCredentials(config?.credentials || {});
      setTestMode(config?.test_mode ?? true);
    }
  }, [visible, config]);

  const setField = (key: string, value: string) =>
    setCredentials((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ gateway: gatewayKey, credentials, test_mode: testMode });
      onClose();
    } catch { Alert.alert("Error", "Failed to save gateway settings."); }
    finally { setSaving(false); }
  };

  if (!catalogue) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable snapHeight={600}>
      <View style={[layout.rowBetween, { marginBottom: spacing[5] }]}>
        <View style={[layout.row, { gap: spacing[3] }]}>
          <View style={[styles.gatewayIcon, { backgroundColor: `${catalogue.color}20` }]}>
            <Icon name="nav-payments" size="md" color={catalogue.color} />
          </View>
          <View>
            <Text variant="subtitle" weight="bold" color="primary">{catalogue.name}</Text>
            <Text variant="micro" color="muted">{config ? "Update credentials" : "Configure gateway"}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: spacing[2] }}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <Text variant="caption" color="secondary" style={{ marginBottom: spacing[4] }}>{catalogue.description}</Text>

      {([...catalogue.fields] as any[]).map((field: any) => (
        <View key={field.key} style={{ marginBottom: spacing[3] }}>
          <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>{field.label}</Text>
          <View style={{ position: "relative" }}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT, paddingRight: field.secret ? spacing[12] : spacing[4] }]}
              value={credentials[field.key] || ""}
              onChangeText={(v) => setField(field.key, v)}
              placeholder={field.placeholder}
              placeholderTextColor={colors.text.muted}
              secureTextEntry={field.secret && !showSecrets[field.key]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {field.secret && (
              <TouchableOpacity
                onPress={() => setShowSecrets((p) => ({ ...p, [field.key]: !p[field.key] }))}
                style={styles.eyeBtn}
              >
                <Icon name={showSecrets[field.key] ? "auth-eye-off" : "auth-eye"} size="sm" color={colors.text.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {/* Test / Live mode */}
      <View style={[layout.rowBetween, styles.toggleRow, { borderColor: colors.border.DEFAULT, marginTop: spacing[2] }]}>
        <View style={layout.fill}>
          <Text variant="label" weight="semibold" color="primary">Test / Sandbox mode</Text>
          <Text variant="micro" color="muted">Disable when ready to go live. Live mode processes real payments.</Text>
        </View>
        <Switch value={testMode} onValueChange={setTestMode} trackColor={{ false: "#ef4444", true: brand.blue }} thumbColor="#fff" />
      </View>

      {!testMode && (
        <View style={[styles.warningBanner, { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.30)" }]}>
          <Icon name="status-warning" size="sm" color="#dc2626" />
          <Text style={{ flex: 1, fontSize: fontSize.xs, color: "#dc2626" }}>
            Live mode is active. Real money will be charged. Ensure credentials are correct.
          </Text>
        </View>
      )}

      <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.75} style={[styles.saveBtn, { backgroundColor: catalogue.color, marginTop: spacing[5] }]}>
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>Save Gateway Settings</Text>
        }
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function AdminPaymentGateway() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();
  const { showToast }      = useToast();

  const [gateways,      setGateways]      = useState<Record<GatewayKey, GatewayConfig | null>>({} as any);
  const [loading,       setLoading]       = useState(true);
  const [activeSheet,   setActiveSheet]   = useState<GatewayKey | null>(null);
  const [togglingKey,   setTogglingKey]   = useState<GatewayKey | null>(null);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    const { data } = await db
      .from("payment_gateways")
      .select("id, gateway, is_enabled, is_default, test_mode, credentials")
      .limit(20);
    const map: Record<string, GatewayConfig | null> = {};
    GATEWAY_CATALOGUE.forEach((g) => { map[g.key] = null; });
    (data || []).forEach((row: any) => { map[row.gateway] = row as GatewayConfig; });
    setGateways(map as any);
    setLoading(false);
  }, [db]);

  const handleSave = async (gatewayKey: GatewayKey, patch: Partial<GatewayConfig>) => {
    if (!db) throw new Error("No DB");
    const existing = gateways[gatewayKey];
    if (existing?.id) {
      await db.from("payment_gateways").update(patch as any).eq("id", existing.id);
    } else {
      await db.from("payment_gateways").insert({ gateway: gatewayKey, is_enabled: true, is_default: false, ...patch } as any);
    }
    showToast({ message: `${GATEWAY_CATALOGUE.find((g) => g.key === gatewayKey)?.name} settings saved!`, variant: "success" });
    await load();
  };

  const toggleGateway = async (gatewayKey: GatewayKey) => {
    if (!db) return;
    setTogglingKey(gatewayKey);
    const existing = gateways[gatewayKey];
    const newState = !(existing?.is_enabled ?? false);
    if (existing?.id) {
      await db.from("payment_gateways").update({ is_enabled: newState } as any).eq("id", existing.id);
    } else {
      await db.from("payment_gateways").insert({ gateway: gatewayKey, is_enabled: newState, is_default: false, test_mode: true, credentials: {} } as any);
    }
    setGateways((prev) => ({
      ...prev,
      [gatewayKey]: prev[gatewayKey]
        ? { ...prev[gatewayKey]!, is_enabled: newState }
        : { gateway: gatewayKey, is_enabled: newState, is_default: false, test_mode: true, credentials: {} },
    }));
    setTogglingKey(null);
  };

  const setDefault = async (gatewayKey: GatewayKey) => {
    if (!db) return;
    // Unset all defaults
    await db.from("payment_gateways").update({ is_default: false } as any).neq("id", "");
    const existing = gateways[gatewayKey];
    if (existing?.id) {
      await db.from("payment_gateways").update({ is_default: true } as any).eq("id", existing.id);
    }
    showToast({ message: `${GATEWAY_CATALOGUE.find((g) => g.key === gatewayKey)?.name} set as default.`, variant: "success" });
    await load();
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Payment Gateways"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4], paddingBottom: spacing[20] }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading" color="primary">Payment Gateways</Text>
        <Text variant="caption" color="muted" style={{ marginTop: -spacing[3] }}>Configure payment providers for fee collection</Text>

        <View style={[styles.infoBanner, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha30 }]}>
          <Icon name="status-info" size="sm" color={brand.blue} />
          <Text variant="caption" color="primary" style={{ flex: 1 }}>
            Enable one or more payment gateways. Set a default that applies to all fees, or assign different gateways per fee item.
          </Text>
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" label="Loading gateways..." /></View>
        ) : (
          GATEWAY_CATALOGUE.map((catalogue) => {
            const config = gateways[catalogue.key];
            const isEnabled = config?.is_enabled ?? false;
            const isDefault = config?.is_default ?? false;
            const hasConfig = config && Object.keys(config.credentials || {}).length > 0;

            return (
              <Card key={catalogue.key}>
                <View style={layout.rowBetween}>
                  <View style={[layout.row, { gap: spacing[3], flex: 1 }]}>
                    <View style={[styles.gatewayIcon, { backgroundColor: `${catalogue.color}20` }]}>
                      <Icon name="nav-payments" size="md" color={catalogue.color} />
                    </View>
                    <View style={layout.fill}>
                      <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap" }]}>
                        <Text variant="label" weight="bold" color="primary">{catalogue.name}</Text>
                        {isDefault  && <Badge label="Default" variant="green" size="sm" />}
                        {config?.test_mode && isEnabled && <Badge label="Test Mode" variant="amber" size="sm" />}
                        {hasConfig  && <Badge label="Configured" variant="blue" size="sm" />}
                      </View>
                      <Text variant="micro" color="muted" numberOfLines={2} style={{ marginTop: spacing[1] }}>{catalogue.description}</Text>
                    </View>
                  </View>
                  {togglingKey === catalogue.key
                    ? <ActivityIndicator color={catalogue.color} size="small" />
                    : <Switch
                        value={isEnabled}
                        onValueChange={() => toggleGateway(catalogue.key)}
                        trackColor={{ false: colors.border.DEFAULT, true: catalogue.color }}
                        thumbColor="#fff"
                      />
                  }
                </View>

                {/* Action row */}
                <View style={[layout.row, { gap: spacing[2], marginTop: spacing[4], flexWrap: "wrap" }]}>
                  <TouchableOpacity
                    onPress={() => setActiveSheet(catalogue.key)}
                    activeOpacity={0.75}
                    style={[styles.actionBtn, { backgroundColor: `${catalogue.color}15`, borderColor: `${catalogue.color}40` }]}
                  >
                    <Icon name="nav-settings" size="sm" color={catalogue.color} />
                    <Text style={{ fontSize: fontSize.xs, color: catalogue.color, fontWeight: fontWeight.semibold }}>
                      {hasConfig ? "Edit Credentials" : "Configure"}
                    </Text>
                  </TouchableOpacity>
                  {isEnabled && !isDefault && (
                    <TouchableOpacity
                      onPress={() => setDefault(catalogue.key)}
                      activeOpacity={0.75}
                      style={[styles.actionBtn, { backgroundColor: brand.emeraldAlpha15, borderColor: "rgba(16,185,129,0.30)" }]}
                    >
                      <Icon name="ui-check" size="sm" color={brand.emerald} />
                      <Text style={{ fontSize: fontSize.xs, color: brand.emerald, fontWeight: fontWeight.semibold }}>Set as Default</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Config sheet */}
      {activeSheet && (
        <GatewaySheet
          visible={!!activeSheet}
          onClose={() => setActiveSheet(null)}
          gatewayKey={activeSheet}
          config={gateways[activeSheet]}
          onSave={(patch) => handleSave(activeSheet, patch)}
          colors={colors}
        />
      )}
    </AppShell>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  infoBanner:  { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  gatewayIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  actionBtn:   { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1 },
  input:       { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, fontSize: fontSize.md },
  eyeBtn:      { position: "absolute", right: spacing[3], top: "50%", transform: [{ translateY: -10 }] },
  toggleRow:   { paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: spacing[4] },
  warningBanner: { flexDirection: "row", alignItems: "flex-start", gap: spacing[2], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, marginTop: spacing[2] },
  saveBtn:     { paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
});
