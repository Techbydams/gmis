// ============================================================
// GMIS — School / Institution Registration
// Route: /register (from landing page)
// Prospective schools fill this form with:
//  - Basic info (name, type, email, phone, address)
//  - Admin contact (who will run the portal)
//  - Documents (CAC, accreditation letter)
// Data saved to master DB organizations table.
// Status defaults to 'pending' — DAMS Tech approves.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import {
  View, ScrollView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { isValidEmail } from "@/lib/helpers";
import { Text, Input, Button, Card } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type Step = 1 | 2 | 3;

const INSTITUTION_TYPES = [
  { label: "University",         value: "university"         },
  { label: "Polytechnic",        value: "polytechnic"        },
  { label: "College of Education", value: "college_education" },
  { label: "Monotechnic",        value: "monotechnic"        },
  { label: "Other",              value: "other"              },
];

interface RegistrationForm {
  // Step 1: Institution info
  name:        string;
  type:        string;
  email:       string;
  phone:       string;
  website:     string;
  address:     string;
  state:       string;
  year_founded:string;
  // Step 2: Admin contact
  admin_name:  string;
  admin_email: string;
  admin_phone: string;
  slug:        string;
}

const INIT: RegistrationForm = {
  name: "", type: "university", email: "", phone: "", website: "",
  address: "", state: "", year_founded: "",
  admin_name: "", admin_email: "", admin_phone: "", slug: "",
};

const LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const LOGO_DARK  = require("@/assets/gmis_logo_dark.png");

export default function RegisterPage() {
  const router    = useRouter();
  const { colors, isDark } = useTheme();
  const LOGO = isDark ? LOGO_DARK : LOGO_LIGHT;

  const [step,     setStep]     = useState<Step>(1);
  const [form,     setForm]     = useState<RegistrationForm>(INIT);
  const [errors,   setErrors]   = useState<Partial<RegistrationForm>>({});
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; ok?: boolean } | null>(null);
  const [done,     setDone]     = useState(false);

  const showToast = (msg: string, ok = false) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 5000); };

  const set = (field: keyof RegistrationForm, val: string) => {
    setForm((p) => ({ ...p, [field]: val }));
    if (field === "name" && step === 1) {
      // Auto-generate slug from name
      const slug = val.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
      setForm((p) => ({ ...p, name: val, slug }));
    }
    setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const validateStep1 = (): boolean => {
    const e: Partial<RegistrationForm> = {};
    if (!form.name.trim())            e.name    = "Institution name is required";
    if (!form.email.trim())           e.email   = "Email is required";
    else if (!isValidEmail(form.email)) e.email = "Enter a valid email";
    if (!form.phone.trim())           e.phone   = "Phone number is required";
    if (!form.state.trim())           e.state   = "State is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Partial<RegistrationForm> = {};
    if (!form.admin_name.trim())           e.admin_name  = "Admin name is required";
    if (!form.admin_email.trim())          e.admin_email = "Admin email is required";
    else if (!isValidEmail(form.admin_email)) e.admin_email = "Enter a valid email";
    if (!form.admin_phone.trim())          e.admin_phone = "Admin phone is required";
    if (!form.slug.trim())                 e.slug        = "Portal slug is required";
    else if (!/^[a-z0-9]+$/.test(form.slug)) e.slug     = "Only lowercase letters and numbers";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validateStep2()) return;
    setLoading(true);

    try {
      // Check slug not already taken
      const { data: existing } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", form.slug.trim())
        .maybeSingle();

      if (existing) {
        setErrors({ slug: `"${form.slug}" is already taken. Choose another.` });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("organizations").insert({
        name:         form.name.trim(),
        type:         form.type,
        email:        form.email.trim().toLowerCase(),
        phone:        form.phone.trim(),
        website:      form.website.trim() || null,
        address:      form.address.trim() || null,
        state:        form.state.trim(),
        slug:         form.slug.trim().toLowerCase(),
        year_founded: form.year_founded ? parseInt(form.year_founded) : null,
        admin_name:   form.admin_name.trim(),
        admin_email:  form.admin_email.trim().toLowerCase(),
        admin_phone:  form.admin_phone.trim(),
        status:       "pending",   // DAMS Tech approves
        country:      "Nigeria",
      } as any);

      if (error) {
        showToast(`Registration failed: ${error.message}`);
        return;
      }

      setDone(true);
    } catch (err: any) {
      showToast(`Error: ${err?.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (done) {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary, padding: spacing[6] }]}>
        <Icon name="status-success" size="3xl" color={colors.status.success} filled />
        <Text variant="heading" color="primary" align="center" style={{ marginTop: spacing[5], marginBottom: spacing[2] }}>
          Application submitted!
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ maxWidth: 400, marginBottom: spacing[5], lineHeight: 24 }}>
          Thank you, <Text variant="body" weight="bold" color="primary">{form.admin_name}</Text>.{"\n"}
          Your application for{" "}
          <Text variant="body" weight="bold" color="primary">{form.name}</Text>{" "}
          has been received. DAMS Technologies will review your documents within 48 hours and email{" "}
          <Text variant="body" color="link">{form.admin_email}</Text> once approved.
        </Text>
        <Card style={{ width: "100%", maxWidth: 400, marginBottom: spacing[5] }}>
          {[
            ["Institution",  form.name],
            ["Portal URL",   `${form.slug}.gmis.app`],
            ["Admin email",  form.admin_email],
            ["Status",       "Pending review"],
          ].map(([label, value]) => (
            <View key={label} style={[layout.rowBetween, { paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.border.subtle }]}>
              <Text variant="caption" color="muted">{label}</Text>
              <Text variant="label" color="primary" weight="semibold">{value}</Text>
            </View>
          ))}
        </Card>
        <Button label="← Back to GMIS" variant="primary" size="lg" onPress={() => router.push("/(landing)")} />
      </View>
    );
  }

  const STEPS = ["Institution info", "Admin contact", "Review"];

  return (
    <SafeAreaView style={[layout.fill, { backgroundColor: colors.bg.primary }]} edges={["top", "bottom"]}>
    <KeyboardAvoidingView style={layout.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>

      {toast && (
        <View style={[styles.toast, { backgroundColor: toast.ok ? colors.status.successBg : colors.status.errorBg, borderColor: toast.ok ? colors.status.successBorder : colors.status.errorBorder }]}>
          <Icon name={toast.ok ? "status-success" : "status-error"} size="sm" color={toast.ok ? colors.status.success : colors.status.error} />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: toast.ok ? colors.status.success : colors.status.error, marginLeft: spacing[2] }}>{toast.msg}</Text>
        </View>
      )}

      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>

          {/* Back + header */}
          <TouchableOpacity onPress={() => router.push("/(landing)")} style={[layout.row, { gap: spacing[2], marginBottom: spacing[5] }]} activeOpacity={0.7}>
            <Icon name="ui-back" size="sm" color={colors.text.muted} />
            <Text variant="caption" color="muted">Back to GMIS</Text>
          </TouchableOpacity>

          <View style={[styles.logoRow, layout.centredH]}>
            <Image source={LOGO} style={{ width: 40, height: 40 }} resizeMode="contain" />
            <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize["2xl"], color: colors.text.primary }}>GMIS</Text>
          </View>

          <Text variant="heading" color="primary" align="center" style={{ marginBottom: spacing[1] }}>
            Register your institution
          </Text>
          <Text variant="caption" color="muted" align="center" style={{ marginBottom: spacing[6] }}>
            DAMS Technologies reviews all applications within 48 hours.
          </Text>

          {/* Step progress */}
          <View style={[layout.row, { marginBottom: spacing[6] }]}>
            {STEPS.map((s, i) => {
              const num = i + 1;
              const done_ = num < step;
              const cur   = num === step;
              return (
                <View key={s} style={{ flex: 1, alignItems: "center" }}>
                  <View style={[styles.stepCircle, { borderColor: done_ || cur ? brand.blue : colors.border.DEFAULT, backgroundColor: done_ ? brand.blue : cur ? brand.blueAlpha15 : "transparent" }]}>
                    {done_ ? <Icon name="ui-check" size="xs" color="#fff" /> : <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: cur ? brand.blue : colors.text.muted }}>{num}</Text>}
                  </View>
                  <Text style={{ fontSize: fontSize["2xs"], color: cur ? brand.blue : colors.text.muted, marginTop: spacing[1], fontWeight: cur ? fontWeight.semibold : fontWeight.normal }}>
                    {s}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <Card padding="none" style={styles.formCard}>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Institution information</Text>

              <Input label="Institution name *" value={form.name} onChangeText={(v) => set("name", v)} placeholder="e.g. ESTAM University" error={errors.name} iconLeft="academic-grade" />

              {/* Type selector */}
              <View style={{ marginBottom: spacing[4] }}>
                <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[2] }}>Institution type *</Text>
                <View style={[layout.row, { flexWrap: "wrap", gap: spacing[2] }]}>
                  {INSTITUTION_TYPES.map(({ label, value }) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() => set("type", value)}
                      activeOpacity={0.75}
                      style={[
                        styles.typeBtn,
                        form.type === value
                          ? { backgroundColor: brand.blueAlpha15, borderColor: brand.blue }
                          : { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT },
                      ]}
                    >
                      <Text style={{ fontSize: fontSize.sm, fontWeight: form.type === value ? fontWeight.bold : fontWeight.normal, color: form.type === value ? brand.blue : colors.text.secondary }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Input label="Official email *"    value={form.email}       onChangeText={(v) => set("email", v)}   placeholder="registrar@school.edu.ng" keyboardType="email-address" autoCapitalize="none" iconLeft="nav-chat" error={errors.email} />
              <Input label="Phone number *"      value={form.phone}       onChangeText={(v) => set("phone", v)}   placeholder="+234 800 000 0000" keyboardType="phone-pad" iconLeft="nav-chat" error={errors.phone} />
              <Input label="State *"             value={form.state}       onChangeText={(v) => set("state", v)}   placeholder="e.g. Lagos, Ogun, Edo" error={errors.state} />
              <Input label="Address"             value={form.address}     onChangeText={(v) => set("address", v)} placeholder="School address" />
              <Input label="Website"             value={form.website}     onChangeText={(v) => set("website", v)} placeholder="https://yourschool.edu.ng" keyboardType="url" autoCapitalize="none" />
              <Input label="Year founded"        value={form.year_founded} onChangeText={(v) => set("year_founded", v)} placeholder="e.g. 1985" keyboardType="number-pad" />

              <Button label="Continue →" variant="primary" size="lg" full onPress={() => validateStep1() && setStep(2)} />
            </Card>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <Card padding="none" style={styles.formCard}>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Administrator contact</Text>
              <Text variant="caption" color="muted" style={{ marginBottom: spacing[4] }}>
                This person will manage the school's GMIS portal. They'll receive login credentials by email after approval.
              </Text>

              <Input label="Admin full name *"   value={form.admin_name}  onChangeText={(v) => set("admin_name", v)}  placeholder="Dr. Firstname Lastname" iconLeft="user-admin" error={errors.admin_name} />
              <Input label="Admin email *"       value={form.admin_email} onChangeText={(v) => set("admin_email", v)} placeholder="admin@school.edu.ng" keyboardType="email-address" autoCapitalize="none" iconLeft="nav-chat" error={errors.admin_email} />
              <Input label="Admin phone *"       value={form.admin_phone} onChangeText={(v) => set("admin_phone", v)} placeholder="+234 800 000 0000" keyboardType="phone-pad" iconLeft="nav-chat" error={errors.admin_phone} />

              <Input
                label="Portal slug *"
                value={form.slug}
                onChangeText={(v) => set("slug", v.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                placeholder="e.g. estamuniversity"
                autoCapitalize="none"
                iconLeft="content-link"
                hint={form.slug ? `Your portal: ${form.slug}.gmis.app` : "Only lowercase letters and numbers"}
                error={errors.slug}
              />

              <Card variant="info" style={{ marginBottom: spacing[4] }}>
                <View style={[layout.row, { gap: spacing[2] }]}>
                  <Icon name="status-info" size="sm" color={colors.status.info} />
                  <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, lineHeight: 18 }}>
                    DAMS Technologies will review your application and email your admin once approved. Your portal at{" "}
                    <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>{form.slug || "yourschool"}.gmis.app</Text>
                    {" "}will be activated within 48 hours.
                  </Text>
                </View>
              </Card>

              <View style={[layout.row, { gap: spacing[3] }]}>
                <Button label="← Back" variant="secondary" size="md" onPress={() => setStep(1)} />
                <Button label={loading ? "Submitting..." : "Submit application"} variant="primary" size="md" full loading={loading} onPress={submit} style={layout.fill} />
              </View>
            </Card>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingVertical: spacing[8], paddingHorizontal: spacing[5] },
  inner:  { width: "100%", maxWidth: 520, alignSelf: "center" },
  toast:  { position: "absolute", top: spacing[3], left: spacing[4], right: spacing[4], zIndex: 100, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  logoRow:{ gap: spacing[2], marginBottom: spacing[4] },
  logoBox:{ width: spacing[10], height: spacing[10], borderRadius: radius.xl, backgroundColor: brand.blue, alignItems: "center", justifyContent: "center" },
  stepCircle: { width: spacing[7], height: spacing[7], borderRadius: spacing[7] / 2, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: spacing[1] },
  formCard:   { paddingHorizontal: spacing[5], paddingVertical: spacing[5] },
  typeBtn:    { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1 },
});
