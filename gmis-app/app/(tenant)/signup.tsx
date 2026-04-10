// ============================================================
// GMIS — Student Signup
// Route: /(tenant)/signup
// 3-step form: Account → Personal details → Done
// FIX: SelectModal import moved from app/ to components/ui/
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";

const GMIS_LOGO = require("@/assets/gmis_logo.png");
import { useRouter } from "expo-router";
import { useTenant }        from "@/context/TenantContext";
import { getTenantClient }  from "@/lib/supabase";
import {
  isValidEmail,
  isValidMatric,
  isValidPassword,
} from "@/lib/helpers";
import {
  Text, Input, Button, Card, Spinner, Badge, SelectModal,
} from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme }    from "@/context/ThemeContext";
import {
  brand, spacing, radius, fontSize, fontWeight, sizes,
} from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
interface Department {
  id:        string;
  name:      string;
  code:      string;
  faculties: { name: string }[] | null;
}

interface FormData {
  matric_number:    string;
  email:            string;
  password:         string;
  confirm_password: string;
  first_name:       string;
  last_name:        string;
  date_of_birth:    string;
  gender:           string;
  department_id:    string;
  level:            string;
  phone:            string;
  parent_email:     string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

const INIT: FormData = {
  matric_number: "", email: "", password: "", confirm_password: "",
  first_name: "", last_name: "", date_of_birth: "", gender: "male",
  department_id: "", level: "", phone: "", parent_email: "",
};

const STEPS = ["Account", "Personal", "Done"];

const LEVEL_OPTIONS = [
  { label: "Year 1 (100 Level)", value: "100" },
  { label: "Year 2 (200 Level)", value: "200" },
  { label: "Year 3 (300 Level)", value: "300" },
  { label: "Year 4 (400 Level)", value: "400" },
  { label: "Year 5 (500 Level)", value: "500" },
  { label: "Year 6 (600 Level)", value: "600" },
];

const GENDER_OPTIONS = [
  { label: "Male",                      value: "male"   },
  { label: "Female",                    value: "female" },
  { label: "Other / Prefer not to say", value: "other"  },
];

// ── Component ──────────────────────────────────────────────
export default function StudentSignup() {
  const router                          = useRouter();
  const { tenant, slug, loading: tenantLoading } = useTenant();
  const { colors }                      = useTheme();

  const [step,         setStep]         = useState(1);
  const [form,         setForm]         = useState<FormData>(INIT);
  const [errors,       setErrors]       = useState<FormErrors>({});
  const [loading,      setLoading]      = useState(false);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptsError,   setDeptsError]   = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const showToast = (msg: string, type: "error" | "success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const set = (field: keyof FormData, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: undefined }));
  };

  // ── Load departments — only after tenant confirmed ────
  useEffect(() => {
    if (tenantLoading) return;
    if (!tenant || !slug) return;
    if (!tenant.supabase_url || !tenant.supabase_anon_key) {
      setDeptsError("School database not configured. Contact your administrator.");
      return;
    }

    const fetchDepts = async () => {
      setLoadingDepts(true);
      setDeptsError(null);
      try {
        const db = getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug);
        const { data, error } = await db
          .from("departments")
          .select("id, name, code, faculties(name)")
          .eq("is_active", true)
          .order("name");

        if (error) {
          if (error.code === "401" || error.message?.includes("JWT")) {
            setDeptsError("Authentication failed. Contact your school administrator.");
          } else {
            setDeptsError("Could not load departments. Please refresh.");
          }
          return;
        }
        setDepartments((data || []) as Department[]);
      } catch {
        setDeptsError("Network error loading departments.");
      } finally {
        setLoadingDepts(false);
      }
    };

    fetchDepts();
  }, [tenant, slug, tenantLoading]);

  // ── Validation ────────────────────────────────────────
  const validate = (s: number): boolean => {
    const e: FormErrors = {};
    if (s === 1) {
      if (!form.matric_number.trim())     e.matric_number    = "Matric number is required";
      else if (!isValidMatric(form.matric_number)) e.matric_number = "Enter a valid student number";
      if (!form.email.trim())             e.email            = "Email is required";
      else if (!isValidEmail(form.email)) e.email            = "Enter a valid email";
      if (!form.password)                 e.password         = "Password is required";
      else if (!isValidPassword(form.password)) e.password   = "Password must be at least 8 characters";
      if (form.password !== form.confirm_password) e.confirm_password = "Passwords do not match";
    }
    if (s === 2) {
      if (!form.first_name.trim())  e.first_name    = "First name is required";
      if (!form.last_name.trim())   e.last_name     = "Last name is required";
      if (!form.department_id)      e.department_id = "Please select your department";
      if (!form.level)              e.level         = "Please select your year/level";
      if (form.parent_email && !isValidEmail(form.parent_email))
        e.parent_email = "Enter a valid parent/guardian email";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => { if (validate(step)) setStep((s) => s + 1); };

  // ── Submit ────────────────────────────────────────────
  const submit = async () => {
    if (!validate(2)) return;
    if (!tenant) { showToast("School portal not loaded. Please refresh."); return; }
    setLoading(true);

    const db = getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);

    try {
      const { data: existingMatric } = await db
        .from("students").select("id")
        .eq("matric_number", form.matric_number.trim().toUpperCase())
        .maybeSingle();
      if (existingMatric) { setErrors({ matric_number: "This student number is already registered." }); setStep(1); return; }

      const { data: existingEmail } = await db
        .from("students").select("id")
        .eq("email", form.email.trim().toLowerCase())
        .maybeSingle();
      if (existingEmail) { setErrors({ email: "This email is already registered." }); setStep(1); return; }

      const { data: authData, error: authError } = await db.auth.signUp({
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        options: { data: {
          full_name:     `${form.first_name.trim()} ${form.last_name.trim()}`,
          matric_number: form.matric_number.trim().toUpperCase(),
          role:          "student",
        }},
      });

      if (authError) {
        showToast(authError.message.includes("already registered") ? "This email already has an account." : authError.message);
        return;
      }

      const { error: insertError } = await db.from("students").insert({
        supabase_uid:    authData.user?.id || null,
        matric_number:   form.matric_number.trim().toUpperCase(),
        email:           form.email.trim().toLowerCase(),
        email_verified:  false,
        first_name:      form.first_name.trim(),
        last_name:       form.last_name.trim(),
        gender:          form.gender,
        date_of_birth:   form.date_of_birth || null,
        phone:           form.phone.trim() || null,
        department_id:   form.department_id || null,
        level:           form.level,
        current_session: "2024/2025",
        status:          "pending",
        gpa: 0, cgpa: 0,
        id_card_printed: false, id_card_paid: false,
        parent_email:    form.parent_email.trim() || null,
      } as any);

      if (insertError) { showToast("Registration failed. Please try again."); return; }
      setStep(3);
    } catch { showToast("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const deptOptions = departments.map((d) => ({
    label: d.name + (d.faculties?.[0]?.name ? ` — ${d.faculties[0].name}` : ""),
    value: d.id,
  }));

  if (tenantLoading) {
    return <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}><Spinner size="lg" label="Loading school portal..." /></View>;
  }

  // ── Step 3: Success ───────────────────────────────────
  if (step === 3) {
    const selectedDept = departments.find((d) => d.id === form.department_id);
    return (
      <ScrollView style={[layout.fill, { backgroundColor: colors.bg.primary }]} contentContainerStyle={[styles.scroll, layout.centredH]}>
        <View style={{ width: "100%", maxWidth: 500, alignItems: "center" }}>
          <View style={[styles.successIcon, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}>
            <Icon name="status-success" size="3xl" color={colors.status.success} filled />
          </View>
          <Text variant="title" color="primary" align="center" style={{ marginBottom: spacing[2] }}>Application submitted!</Text>
          <Text variant="body" color="secondary" align="center" style={{ marginBottom: spacing[5], maxWidth: 380 }}>
            Pending admin approval at <Text variant="body" color="primary" weight="bold">{tenant?.name}</Text>.
            You'll be emailed at <Text variant="body" color="link">{form.email}</Text> once activated.
          </Text>
          <Card style={{ width: "100%", marginBottom: spacing[4] }}>
            {[
              ["Student no.", form.matric_number.toUpperCase()],
              ["Name",       `${form.first_name} ${form.last_name}`],
              ["Department", selectedDept?.name || "—"],
              ["Level",      `Year ${form.level?.charAt(0)}`],
              ["Email",      form.email],
            ].map(([label, value], i, arr) => (
              <View key={label} style={[styles.summaryRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle }]}>
                <Text variant="caption" color="muted">{label}</Text>
                <Text variant="label" color="primary" weight="semibold">{value}</Text>
              </View>
            ))}
          </Card>
          <Button label="← Return to login" variant="primary" size="lg" full onPress={() => router.replace("/(tenant)/login")} />
        </View>
      </ScrollView>
    );
  }

  // ── Step progress ─────────────────────────────────────
  const StepDots = () => (
    <View style={[layout.row, { marginBottom: spacing[5] }]}>
      {STEPS.map((st, i) => {
        const num = i + 1; const done = num < step; const cur = num === step;
        return (
          <View key={st} style={{ flex: 1, alignItems: "center" }}>
            <View style={[styles.stepCircle, { borderColor: done || cur ? brand.blue : colors.border.DEFAULT, backgroundColor: done ? brand.blue : cur ? brand.blueAlpha15 : "transparent" }]}>
              {done ? <Icon name="ui-check" size="xs" color="#fff" /> : <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: cur ? brand.blue : colors.text.muted }}>{num}</Text>}
            </View>
            <Text style={{ fontSize: fontSize["2xs"], fontWeight: cur ? fontWeight.semibold : fontWeight.normal, color: cur ? brand.blue : colors.text.muted, marginTop: spacing[1] }}>{st}</Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView style={[layout.fill, { backgroundColor: colors.bg.primary }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {toast && (
        <View style={[styles.toast, { backgroundColor: toast.type === "error" ? colors.status.errorBg : colors.status.successBg, borderColor: toast.type === "error" ? colors.status.errorBorder : colors.status.successBorder }]}>
          <Icon name={toast.type === "error" ? "status-error" : "status-success"} size="sm" color={toast.type === "error" ? colors.status.error : colors.status.success} />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: toast.type === "error" ? colors.status.error : colors.status.success, marginLeft: spacing[2] }}>{toast.msg}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={[styles.scroll, layout.centredH]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>

          {/* School banner */}
          <View style={styles.schoolBanner}>
            <View style={styles.schoolLogo}><Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.sm, color: "#fff" }}>{(tenant?.name || slug || "G").slice(0, 2).toUpperCase()}</Text></View>
            <View style={layout.fill}><Text style={{ fontWeight: fontWeight.bold, color: "#fff", fontSize: fontSize.base }}>{tenant?.name} <Text style={{ fontWeight: fontWeight.normal, fontSize: fontSize.xs, color: "rgba(255,255,255,0.55)" }}>· {slug}.gmis.app</Text></Text></View>
            <TouchableOpacity onPress={() => router.push("/find-school")} activeOpacity={0.7}><Text style={{ fontSize: fontSize["2xs"], color: "rgba(255,255,255,0.4)" }}>← Change</Text></TouchableOpacity>
          </View>

          <View style={[layout.centredH, { marginBottom: spacing[5] }]}>
            <Text variant="title" color="primary" align="center">Create student account</Text>
            <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing[1] }}>Admin approval required before portal access</Text>
          </View>

          <StepDots />

          <Card padding="none" style={styles.card}>
            {/* ── STEP 1 ── */}
            {step === 1 && (
              <View>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Account information</Text>
                <Input label="Student / Matric number *" value={form.matric_number} onChangeText={(v) => set("matric_number", v.toUpperCase())} placeholder="e.g. STU/2024/001" autoCapitalize="characters" iconLeft="user-student" error={errors.matric_number} hint="From your admission letter." />
                <Input label="Email address *" value={form.email} onChangeText={(v) => set("email", v)} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" iconLeft="nav-chat" error={errors.email} />
                <View style={[layout.row, { gap: spacing[3], alignItems: "flex-start" }]}>
                  <View style={layout.fill}><Input label="Password *" value={form.password} onChangeText={(v) => set("password", v)} placeholder="Min. 8 chars" secureTextEntry autoComplete="new-password" iconLeft="auth-password" error={errors.password} /></View>
                  <View style={layout.fill}><Input label="Confirm *" value={form.confirm_password} onChangeText={(v) => set("confirm_password", v)} placeholder="Repeat" secureTextEntry autoComplete="new-password" iconLeft="auth-password" error={errors.confirm_password} /></View>
                </View>
                <View style={[styles.infoBanner, { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder }]}>
                  <Icon name="status-info" size="sm" color={colors.status.info} filled />
                  <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, marginLeft: spacing[2], lineHeight: 18 }}>Your student number must match exactly what's on your admission letter.</Text>
                </View>
                <View style={[layout.row, { justifyContent: "space-between", marginTop: spacing[4] }]}>
                  <Button label="← Back to login" variant="secondary" size="md" onPress={() => router.push("/(tenant)/login")} />
                  <Button label="Continue →" variant="primary" size="md" onPress={nextStep} />
                </View>
              </View>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <View>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Personal details</Text>
                <View style={[layout.row, { gap: spacing[3], alignItems: "flex-start" }]}>
                  <View style={layout.fill}><Input label="First name *" value={form.first_name} onChangeText={(v) => set("first_name", v)} placeholder="First name" error={errors.first_name} /></View>
                  <View style={layout.fill}><Input label="Last name *" value={form.last_name} onChangeText={(v) => set("last_name", v)} placeholder="Last name" error={errors.last_name} /></View>
                </View>
                <Input label="Date of birth" value={form.date_of_birth} onChangeText={(v) => set("date_of_birth", v)} placeholder="YYYY-MM-DD" hint="e.g. 2000-01-15" keyboardType="numbers-and-punctuation" iconLeft="nav-calendar" />
                <View style={[layout.row, { gap: spacing[3], alignItems: "flex-start" }]}>
                  <View style={layout.fill}><SelectModal label="Gender" placeholder="Select gender" value={form.gender} options={GENDER_OPTIONS} onChange={(v) => set("gender", v)} /></View>
                  <View style={layout.fill}><SelectModal label="Year / Level *" placeholder="Select level" value={form.level} options={LEVEL_OPTIONS} onChange={(v) => set("level", v)} error={errors.level} /></View>
                </View>
                {deptsError && <Card variant="error" style={{ marginBottom: spacing[3] }}><View style={[layout.row, { gap: spacing[2] }]}><Icon name="status-warning" size="sm" color={colors.status.error} /><Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.error }}>{deptsError}</Text></View></Card>}
                <SelectModal label="Department / Programme *" placeholder={loadingDepts ? "Loading departments..." : deptsError ? "Cannot load — see error above" : "Select your department"} value={form.department_id} options={deptOptions} onChange={(v) => set("department_id", v)} error={errors.department_id} loading={loadingDepts} disabled={!!deptsError} />
                <Input label="Phone number" value={form.phone} onChangeText={(v) => set("phone", v)} placeholder="+234 800 000 0000" keyboardType="phone-pad" iconLeft="nav-chat" />
                <Input label="Parent / Guardian email" value={form.parent_email} onChangeText={(v) => set("parent_email", v)} placeholder="guardian@email.com (optional)" keyboardType="email-address" autoCapitalize="none" iconLeft="user-parent" error={errors.parent_email} hint="Optional. Your guardian will receive an invite." />
                <View style={[layout.row, { gap: spacing[3], marginTop: spacing[2] }]}>
                  <Button label="← Back" variant="secondary" size="md" onPress={() => setStep(1)} />
                  <Button label={loading ? "Submitting..." : "Submit for approval"} variant="primary" size="md" full loading={loading} onPress={submit} style={layout.fill} />
                </View>
              </View>
            )}
          </Card>

          <View style={[layout.row, { justifyContent: "center", marginTop: spacing[4] }]}>
            <Text variant="caption" color="muted">Already have an account?{" "}<Text variant="caption" color="link" weight="bold" onPress={() => router.push("/(tenant)/login")}>Sign in →</Text></Text>
          </View>

          {/* GMIS footer logo */}
          <View style={{ alignItems: "center", marginTop: spacing[5], marginBottom: spacing[2], gap: spacing[2] }}>
            <Image source={GMIS_LOGO} style={{ width: 80, height: 28 }} resizeMode="contain" />
            <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted, textAlign: "center" }}>
              A product of DAMS Technologies
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:      { flexGrow: 1, paddingVertical: spacing[8], paddingHorizontal: spacing[5] },
  inner:       { width: "100%", maxWidth: 540 },
  toast:       { position: "absolute", top: spacing[12], left: spacing[4], right: spacing[4], zIndex: 100, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  schoolBanner:{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: spacing[4], borderRadius: radius.xl, backgroundColor: "#1a3a8f" },
  schoolLogo:  { width: sizes.brandIconSize, height: sizes.brandIconSize, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  card:        { paddingHorizontal: spacing[6], paddingVertical: spacing[6] },
  stepCircle:  { width: spacing[6] + spacing[1], height: spacing[6] + spacing[1], borderRadius: (spacing[6] + spacing[1]) / 2, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: spacing[1] },
  infoBanner:  { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing[3], paddingVertical: spacing[2] + spacing[1], borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing[4] },
  successIcon: { width: sizes.iconCircle, height: sizes.iconCircle, borderRadius: sizes.iconCircle / 2, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: spacing[5] },
  summaryRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing[2] + spacing[1] },
});
