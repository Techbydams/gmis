// ============================================================
// GMIS — Institution Registration
// Route: /register  (web-only, linked from landing page)
//
// 4-step form:
//   1. Institution info  (name, type, slug, country, state, phone, address)
//   2. Admin account     (name, email, password)
//   3. Documents         (CAC, NUC/NBTE accreditation, letterhead)
//   4. Review & submit
//
// Tables: organizations, organization_documents
// Auth: creates Supabase auth user for admin on submit
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useRef } from "react";
import {
  View, ScrollView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase }        from "@/lib/supabase";
import { isValidEmail, isValidPassword } from "@/lib/helpers";
import { Text, Button, Card } from "@/components/ui";
import { Icon }            from "@/components/ui/Icon";
import { useTheme }        from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

// ── Helpers ────────────────────────────────────────────────
function nameToSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 30);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(slug);
}

// ── Constants ──────────────────────────────────────────────
const STEPS = ["Institution", "Admin account", "Documents", "Review"] as const;

const ORG_TYPES = [
  { label: "University",    value: "university"    },
  { label: "Polytechnic",   value: "polytechnic"   },
  { label: "College",       value: "college"       },
  { label: "Vocational",    value: "vocational"    },
  { label: "Seminary",      value: "seminary"      },
  { label: "Other",         value: "other"         },
];

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT - Abuja","Gombe",
  "Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos",
  "Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto",
  "Taraba","Yobe","Zamfara","Outside Nigeria",
];

const DOC_TYPES = [
  { key: "cac",         label: "CAC Certificate",           hint: "Certificate of incorporation from Corporate Affairs Commission" },
  { key: "nuc",         label: "NUC / NBTE Accreditation",  hint: "National Universities Commission or NBTE accreditation letter" },
  { key: "letterhead",  label: "Signed Letterhead",         hint: "Official letter on school letterhead confirming registration intent" },
] as const;

// ── Types ──────────────────────────────────────────────────
type DocKey = "cac" | "nuc" | "letterhead";

interface FormData {
  name:             string;
  type:             string;
  slug:             string;
  country:          string;
  state:            string;
  phone:            string;
  website:          string;
  address:          string;
  admin_name:       string;
  admin_email:      string;
  admin_phone:      string;
  password:         string;
  confirm_password: string;
}

interface DocFile { name: string; size: number; webFile?: File }

// ── Field ─────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, error, secureTextEntry, multiline, hint, required,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; error?: string; secureTextEntry?: boolean;
  multiline?: boolean; hint?: string; required?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing[4] }}>
      <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.secondary, marginBottom: spacing[1] }}>
        {label}{required && <Text style={{ color: colors.status.error }}> *</Text>}
      </Text>
      {hint && <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginBottom: spacing[1] }}>{hint}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={[
          styles.input,
          {
            backgroundColor: colors.bg.input,
            color:            colors.text.primary,
            borderColor:      error ? colors.status.error : colors.border.DEFAULT,
            height:           multiline ? 80 : 48,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
      {error && <Text style={{ fontSize: fontSize.xs, color: colors.status.error, marginTop: spacing[1] }}>{error}</Text>}
    </View>
  );
}

// ── SelectField ────────────────────────────────────────────
function SelectField({
  label, value, options, onChange, error, required,
}: {
  label: string; value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  error?: string; required?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ marginBottom: spacing[4] }}>
      <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.secondary, marginBottom: spacing[1] }}>
        {label}{required && <Text style={{ color: colors.status.error }}> *</Text>}
      </Text>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        activeOpacity={0.85}
        style={[
          styles.input,
          styles.select,
          { backgroundColor: colors.bg.input, borderColor: error ? colors.status.error : colors.border.DEFAULT },
        ]}
      >
        <Text style={{ flex: 1, fontSize: fontSize.base, color: selected ? colors.text.primary : colors.text.muted }}>
          {selected?.label || `Select ${label.toLowerCase()}`}
        </Text>
        <Icon name={open ? "ui-up" : "ui-down"} size="sm" color={colors.text.muted} />
      </TouchableOpacity>
      {open && (
        <View style={[styles.dropdown, { backgroundColor: colors.bg.elevated, borderColor: colors.border.DEFAULT }]}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map((o) => (
              <TouchableOpacity
                key={o.value}
                onPress={() => { onChange(o.value); setOpen(false); }}
                activeOpacity={0.75}
                style={[styles.dropOption, { borderBottomColor: colors.border.subtle, backgroundColor: o.value === value ? brand.blueAlpha10 : "transparent" }]}
              >
                <Text style={{ fontSize: fontSize.sm, color: o.value === value ? brand.blue : colors.text.primary }}>
                  {o.label}
                </Text>
                {o.value === value && <Icon name="ui-check" size="xs" color={brand.blue} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {error && <Text style={{ fontSize: fontSize.xs, color: colors.status.error, marginTop: spacing[1] }}>{error}</Text>}
    </View>
  );
}

// ── DocUpload ──────────────────────────────────────────────
function DocUpload({
  label, hint, file, onFile, error,
}: {
  label: string; hint: string;
  file: DocFile | null;
  onFile: (f: DocFile) => void;
  error?: string;
}) {
  const { colors } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null as any);

  const handlePress = () => {
    if (Platform.OS === "web" && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleChange = (e: any) => {
    const f: File = e.target?.files?.[0];
    if (!f) return;
    onFile({ name: f.name, size: f.size, webFile: f });
  };

  const sizeStr = file ? (file.size > 1024 * 1024
    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(file.size / 1024)} KB`) : "";

  return (
    <View style={{ marginBottom: spacing[4] }}>
      <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.secondary, marginBottom: spacing[1] }}>
        {label} <Text style={{ color: colors.status.error }}>*</Text>
      </Text>
      <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginBottom: spacing[2] }}>{hint}</Text>

      {/* Hidden web file input */}
      {Platform.OS === "web" && (
        <input
          ref={fileInputRef as any}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: "none" } as any}
          onChange={handleChange}
        />
      )}

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          styles.docBox,
          {
            borderColor:     file ? brand.blue : (error ? colors.status.error : colors.border.DEFAULT),
            backgroundColor: file ? brand.blueAlpha10 : colors.bg.card,
            borderStyle:     file ? "solid" : "dashed",
          },
        ]}
      >
        {file ? (
          <>
            <Icon name="content-file" size="lg" color={brand.blue} />
            <View style={{ flex: 1, marginLeft: spacing[3] }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: brand.blue }} numberOfLines={1}>{file.name}</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>{sizeStr}</Text>
            </View>
            <Icon name="status-success" size="sm" color={colors.status.success} filled />
          </>
        ) : (
          <>
            <Icon name="action-upload" size="lg" color={colors.text.muted} />
            <View style={{ flex: 1, marginLeft: spacing[3] }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>Tap to select file</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>PDF, JPG, or PNG · max 5 MB</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
      {error && <Text style={{ fontSize: fontSize.xs, color: colors.status.error, marginTop: spacing[1] }}>{error}</Text>}
    </View>
  );
}

// ── ReviewRow ──────────────────────────────────────────────
function ReviewRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.reviewRow, { borderBottomColor: colors.border.subtle }]}>
      <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, width: 140, flexShrink: 0 }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.text.primary, fontWeight: fontWeight.semibold }}>{value || "—"}</Text>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function RegisterPage() {
  const router     = useRouter();
  const { colors, isDark } = useTheme();

  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; type: "error"|"success" } | null>(null);
  const [slugAvail, setSlugAvail] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [docs,    setDocs]    = useState<Record<DocKey, DocFile | null>>({ cac: null, nuc: null, letterhead: null });

  const [form, setForm] = useState<FormData>({
    name: "", type: "university", slug: "", country: "Nigeria",
    state: "", phone: "", website: "", address: "",
    admin_name: "", admin_email: "", admin_phone: "",
    password: "", confirm_password: "",
  });

  const set = (field: keyof FormData, value: string) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
    if (field === "name") {
      setForm((prev) => ({ ...prev, name: value, slug: nameToSlug(value) }));
      setSlugAvail(null);
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const showToast = (msg: string, type: "error"|"success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const checkSlug = async () => {
    if (!form.slug || !isValidSlug(form.slug)) return;
    setCheckingSlug(true);
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", form.slug)
      .maybeSingle();
    setCheckingSlug(false);
    setSlugAvail(!data);
  };

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.name.trim())             e.name    = "Institution name is required";
      if (!form.slug.trim())             e.slug    = "Subdomain is required";
      else if (!isValidSlug(form.slug))  e.slug    = "Lowercase letters, numbers and hyphens only (3-30 chars)";
      else if (slugAvail === false)      e.slug    = "This subdomain is taken";
      if (!form.type)                    e.type    = "Please select a type";
      if (!form.state.trim())            e.state   = "State / region is required";
      if (!form.phone.trim())            e.phone   = "Phone number is required";
      if (!form.address.trim())          e.address = "Address is required";
    }
    if (s === 2) {
      if (!form.admin_name.trim())              e.admin_name     = "Full name is required";
      if (!form.admin_email.trim())             e.admin_email    = "Email is required";
      else if (!isValidEmail(form.admin_email)) e.admin_email    = "Enter a valid email address";
      if (!form.password)                        e.password      = "Password is required";
      else if (form.password.length < 8)         e.password      = "Minimum 8 characters";
      if (form.password !== form.confirm_password) e.confirm_password = "Passwords do not match";
    }
    if (s === 3) {
      if (!docs.cac)        e.cac        = "CAC certificate is required";
      if (!docs.nuc)        e.nuc        = "Accreditation document is required";
      if (!docs.letterhead) e.letterhead = "Signed letterhead is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) setStep((s) => s + 1); };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const uploadDoc = async (doc: DocFile, path: string): Promise<string | null> => {
    if (!doc.webFile) return null;
    const { data, error } = await supabase.storage.from("org-documents").upload(path, doc.webFile, { upsert: true });
    if (error) return null;
    const { data: urlData } = supabase.storage.from("org-documents").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const submit = async () => {
    if (!validate(3)) return;
    setLoading(true);
    try {
      const orgId      = crypto.randomUUID();
      const slugFolder = `${form.slug}-${orgId.slice(0, 8)}`;

      const ext = (f: DocFile) => f.name.split(".").pop() || "pdf";

      const [cacUrl, nucUrl, lhUrl] = await Promise.all([
        uploadDoc(docs.cac!,        `${slugFolder}/cac.${ext(docs.cac!)}`),
        uploadDoc(docs.nuc!,        `${slugFolder}/nuc.${ext(docs.nuc!)}`),
        uploadDoc(docs.letterhead!, `${slugFolder}/letterhead.${ext(docs.letterhead!)}`),
      ]);

      if (!cacUrl || !nucUrl || !lhUrl) throw new Error("Document upload failed. Please try again.");

      const { error: orgErr } = await supabase.from("organizations").insert({
        id:             orgId,
        name:           form.name.trim(),
        slug:           form.slug.trim().toLowerCase(),
        email:          form.admin_email.trim().toLowerCase(),
        phone:          form.phone.trim(),
        address:        form.address.trim(),
        state:          form.state.trim(),
        country:        form.country.trim(),
        website:        form.website.trim() || null,
        type:           form.type,
        status:         "pending",
        payment_status: "unpaid",
        admin_name:     form.admin_name.trim(),
        admin_email:    form.admin_email.trim().toLowerCase(),
        admin_phone:    form.admin_phone.trim() || null,
      } as any);

      if (orgErr) throw new Error(orgErr.message);

      await supabase.from("organization_documents").insert([
        { org_id: orgId, document_type: "cac",        file_url: cacUrl,  file_name: docs.cac!.name },
        { org_id: orgId, document_type: "nuc",        file_url: nucUrl,  file_name: docs.nuc!.name },
        { org_id: orgId, document_type: "letterhead", file_url: lhUrl,   file_name: docs.letterhead!.name },
      ] as any);

      setDone(true);
    } catch (err: any) {
      showToast(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const bg = isDark ? "#03071a" : "#f8faff";

  // ── Success screen ─────────────────────────────────────
  if (done) {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: bg, padding: spacing[6] }]}>
        <Icon name="status-success" size="3xl" color={colors.status.success} filled />
        <Text style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.black, color: colors.text.primary, marginTop: spacing[5], marginBottom: spacing[2], textAlign: "center" }}>
          Application submitted!
        </Text>
        <Text style={{ fontSize: fontSize.base, color: colors.text.secondary, textAlign: "center", maxWidth: 420, lineHeight: 26, marginBottom: spacing[4] }}>
          <Text style={{ fontWeight: fontWeight.bold, color: colors.text.primary }}>{form.name}</Text> has been submitted for review.{"\n\n"}
          Our team will review your documents within{" "}
          <Text style={{ fontWeight: fontWeight.bold, color: brand.gold }}>48 hours</Text>. You'll receive an email at{" "}
          <Text style={{ fontWeight: fontWeight.semibold, color: brand.blue }}>{form.admin_email}</Text>.
        </Text>
        <Card style={{ marginBottom: spacing[5], width: "100%", maxWidth: 360 }}>
          <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginBottom: spacing[1] }}>Your school's portal</Text>
          <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: brand.blue }}>
            {form.slug}.gmis.app
          </Text>
        </Card>
        <Button label="← Back to GMIS home" variant="secondary" onPress={() => router.replace("/(landing)")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[layout.fill, { backgroundColor: bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, alignItems: "center", padding: spacing[6], paddingTop: spacing[8] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + heading */}
        <TouchableOpacity onPress={() => router.replace("/(landing)")} activeOpacity={0.8} style={{ marginBottom: spacing[6], alignItems: "center" }}>
          <View style={[styles.logoBox, { backgroundColor: brand.blue }]}>
            <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize["2xl"], color: "#fff" }}>G</Text>
          </View>
        </TouchableOpacity>

        <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: colors.text.primary, marginBottom: spacing[1], textAlign: "center" }}>
          Register your institution
        </Text>
        <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing[7], textAlign: "center" }}>
          Reviewed by DAMS Technologies · Approval within 48 hours
        </Text>

        {/* Progress indicator */}
        <View style={[styles.progressRow, { marginBottom: spacing[7] }]}>
          {STEPS.map((s, i) => {
            const n       = i + 1;
            const done_   = n < step;
            const current = n === step;
            return (
              <View key={s} style={{ flex: 1, alignItems: "center" }}>
                {/* Connector line */}
                {i > 0 && (
                  <View style={[styles.connector, { backgroundColor: n <= step ? brand.blue : colors.border.DEFAULT }]} />
                )}
                <TouchableOpacity
                  onPress={() => n < step && setStep(n)}
                  activeOpacity={n < step ? 0.75 : 1}
                  style={[
                    styles.stepBubble,
                    {
                      backgroundColor: done_ ? brand.blue : current ? brand.blueAlpha20 : colors.bg.card,
                      borderColor:     n <= step ? brand.blue : colors.border.DEFAULT,
                    },
                  ]}
                >
                  {done_ ? (
                    <Icon name="ui-check" size="xs" color="#fff" />
                  ) : (
                    <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: current ? brand.blue : colors.text.muted }}>{n}</Text>
                  )}
                </TouchableOpacity>
                <Text style={{ fontSize: fontSize["2xs"] + 1, marginTop: spacing[1], color: current ? brand.blue : colors.text.muted, fontWeight: current ? fontWeight.semibold : fontWeight.normal, textAlign: "center" }}>
                  {s}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Toast */}
        {toast && (
          <View style={[styles.toast, { backgroundColor: toast.type === "error" ? colors.status.errorBg : colors.status.successBg, borderColor: toast.type === "error" ? colors.status.errorBorder : colors.status.successBorder }]}>
            <Icon name={toast.type === "error" ? "status-error" : "status-success"} size="sm" color={toast.type === "error" ? colors.status.error : colors.status.success} />
            <Text style={{ flex: 1, marginLeft: spacing[2], fontSize: fontSize.sm, color: toast.type === "error" ? colors.status.error : colors.status.success }}>{toast.msg}</Text>
          </View>
        )}

        {/* Form card */}
        <View style={[styles.formCard, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT, width: "100%", maxWidth: 560 }]}>

          {/* ── STEP 1: Institution ── */}
          {step === 1 && (
            <View>
              <Text style={[styles.stepTitle, { color: colors.text.primary }]}>Institution details</Text>

              <Field label="Institution name" value={form.name} onChangeText={(v) => set("name", v)}
                placeholder="e.g. University of Benin" error={errors.name} required />

              {/* Slug field */}
              <View style={{ marginBottom: spacing[4] }}>
                <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.secondary, marginBottom: spacing[1] }}>
                  Subdomain <Text style={{ color: colors.status.error }}>*</Text>
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginBottom: spacing[2] }}>
                  Your portal will be at{" "}
                  <Text style={{ color: brand.blue }}>{form.slug || "yourslug"}.gmis.app</Text>
                </Text>
                <View style={[layout.row, { gap: spacing[2] }]}>
                  <TextInput
                    value={form.slug}
                    onChangeText={(v) => { set("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugAvail(null); }}
                    onBlur={checkSlug}
                    placeholder="e.g. uniben"
                    placeholderTextColor={colors.text.muted}
                    style={[styles.input, { flex: 1, backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: errors.slug ? colors.status.error : slugAvail === false ? colors.status.error : slugAvail === true ? colors.status.success : colors.border.DEFAULT, height: 48 }]}
                  />
                  {checkingSlug && <View style={{ justifyContent: "center" }}><Text style={{ color: colors.text.muted, fontSize: fontSize.xs }}>Checking…</Text></View>}
                  {slugAvail === true  && <View style={{ justifyContent: "center" }}><Icon name="status-success" size="sm" color={colors.status.success} filled /></View>}
                  {slugAvail === false && <View style={{ justifyContent: "center" }}><Icon name="status-error"   size="sm" color={colors.status.error}   filled /></View>}
                </View>
                {errors.slug && <Text style={{ fontSize: fontSize.xs, color: colors.status.error, marginTop: spacing[1] }}>{errors.slug}</Text>}
              </View>

              <SelectField label="Institution type" value={form.type} options={ORG_TYPES} onChange={(v) => set("type", v)} error={errors.type} required />
              <SelectField label="State / Region" value={form.state} options={NIGERIAN_STATES.map((s) => ({ label: s, value: s }))} onChange={(v) => set("state", v)} error={errors.state} required />

              <Field label="Phone" value={form.phone} onChangeText={(v) => set("phone", v)} placeholder="+234 800 000 0000" error={errors.phone} required />
              <Field label="Address" value={form.address} onChangeText={(v) => set("address", v)} placeholder="Full institution address" error={errors.address} multiline required />
              <Field label="Website" value={form.website} onChangeText={(v) => set("website", v)} placeholder="https://yourschool.edu.ng (optional)" />
            </View>
          )}

          {/* ── STEP 2: Admin account ── */}
          {step === 2 && (
            <View>
              <Text style={[styles.stepTitle, { color: colors.text.primary }]}>Admin account</Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing[5] }}>
                This account will be the first admin of {form.name || "your institution"} on GMIS.
              </Text>
              <Field label="Full name" value={form.admin_name} onChangeText={(v) => set("admin_name", v)} placeholder="Admin full name" error={errors.admin_name} required />
              <Field label="Email" value={form.admin_email} onChangeText={(v) => set("admin_email", v)} placeholder="admin@yourschool.edu.ng" error={errors.admin_email} required />
              <Field label="Phone (optional)" value={form.admin_phone} onChangeText={(v) => set("admin_phone", v)} placeholder="+234 800 000 0000" />
              <Field label="Password" value={form.password} onChangeText={(v) => set("password", v)} placeholder="Min. 8 characters" secureTextEntry error={errors.password} required />
              <Field label="Confirm password" value={form.confirm_password} onChangeText={(v) => set("confirm_password", v)} placeholder="Repeat password" secureTextEntry error={errors.confirm_password} required />
            </View>
          )}

          {/* ── STEP 3: Documents ── */}
          {step === 3 && (
            <View>
              <Text style={[styles.stepTitle, { color: colors.text.primary }]}>Upload documents</Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing[5] }}>
                These documents are required to verify your institution. All files are securely stored and only reviewed by DAMS Technologies.
              </Text>
              {DOC_TYPES.map(({ key, label, hint }) => (
                <DocUpload
                  key={key}
                  label={label}
                  hint={hint}
                  file={docs[key]}
                  onFile={(f) => setDocs((prev) => ({ ...prev, [key]: f }))}
                  error={errors[key]}
                />
              ))}
            </View>
          )}

          {/* ── STEP 4: Review ── */}
          {step === 4 && (
            <View>
              <Text style={[styles.stepTitle, { color: colors.text.primary }]}>Review & submit</Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing[4] }}>
                Please review your details before submitting.
              </Text>

              <Text style={styles.reviewSection}>Institution</Text>
              <ReviewRow label="Name"      value={form.name} />
              <ReviewRow label="Portal"    value={`${form.slug}.gmis.app`} />
              <ReviewRow label="Type"      value={ORG_TYPES.find((t) => t.value === form.type)?.label || form.type} />
              <ReviewRow label="State"     value={form.state} />
              <ReviewRow label="Phone"     value={form.phone} />
              <ReviewRow label="Address"   value={form.address} />
              {form.website && <ReviewRow label="Website" value={form.website} />}

              <Text style={[styles.reviewSection, { marginTop: spacing[4] }]}>Admin account</Text>
              <ReviewRow label="Name"  value={form.admin_name} />
              <ReviewRow label="Email" value={form.admin_email} />

              <Text style={[styles.reviewSection, { marginTop: spacing[4] }]}>Documents</Text>
              {DOC_TYPES.map(({ key, label }) => (
                <ReviewRow key={key} label={label} value={docs[key]?.name || "Not uploaded"} />
              ))}

              <View style={[styles.reviewNote, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha20 }]}>
                <Icon name="status-info" size="sm" color={brand.blue} />
                <Text style={{ flex: 1, marginLeft: spacing[2], fontSize: fontSize.xs, color: brand.blue, lineHeight: 18 }}>
                  By submitting, you confirm that all details are accurate and that you are authorised to register this institution.
                </Text>
              </View>
            </View>
          )}

          {/* Nav buttons */}
          <View style={[layout.row, { gap: spacing[3], marginTop: spacing[6] }]}>
            {step > 1 && (
              <Button label="← Back" variant="ghost" onPress={back} style={{ flex: 1 }} />
            )}
            {step < 4 ? (
              <Button label="Continue →" variant="primary" onPress={next} style={{ flex: 2 }} />
            ) : (
              <Button
                label={loading ? "Submitting…" : "Submit application →"}
                variant="primary"
                loading={loading}
                onPress={submit}
                style={{ flex: 2 }}
              />
            )}
          </View>
        </View>

        <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginTop: spacing[6], textAlign: "center", maxWidth: 400 }}>
          Already registered?{" "}
          <Text
            onPress={() => router.push("/find-school")}
            style={{ color: brand.blue, fontWeight: fontWeight.semibold }}
          >
            Find your institution
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logoBox: {
    width: spacing[14], height: spacing[14],
    borderRadius: radius["2xl"],
    alignItems: "center", justifyContent: "center",
  },
  progressRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    width:         "100%",
    maxWidth:      480,
    position:      "relative",
  },
  stepBubble: {
    width:        spacing[8],
    height:       spacing[8],
    borderRadius: radius.full,
    borderWidth:  2,
    alignItems:   "center",
    justifyContent: "center",
    zIndex:       1,
  },
  connector: {
    position:   "absolute",
    top:        spacing[4],
    right:      "50%",
    left:       "-50%",
    height:     2,
  },
  formCard: {
    padding:      spacing[6],
    borderRadius: radius["2xl"],
    borderWidth:  1,
  },
  stepTitle: {
    fontSize:     fontSize["2xl"],
    fontWeight:   fontWeight.black,
    marginBottom: spacing[5],
  },
  input: {
    borderWidth:  1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4],
    fontSize:     fontSize.base,
  },
  select: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    height:          48,
    paddingVertical: 0,
  },
  dropdown: {
    borderWidth:  1,
    borderRadius: radius.xl,
    marginTop:    spacing[1],
    overflow:     "hidden",
  },
  dropOption: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderBottomWidth: 1,
  },
  docBox: {
    flexDirection:     "row",
    alignItems:        "center",
    borderWidth:       2,
    borderRadius:      radius.xl,
    padding:           spacing[4],
    marginBottom:      spacing[3],
  },
  reviewRow: {
    flexDirection:   "row",
    gap:             spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  reviewSection: {
    fontSize:     fontSize.xs,
    fontWeight:   fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
    color:         "#888",
    marginBottom:  spacing[2],
  },
  reviewNote: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    marginTop:         spacing[4],
    padding:           spacing[3],
    borderRadius:      radius.lg,
    borderWidth:       1,
  },
  toast: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderRadius:      radius.lg,
    borderWidth:       1,
    marginBottom:      spacing[4],
    width:             "100%",
    maxWidth:          560,
  },
});
