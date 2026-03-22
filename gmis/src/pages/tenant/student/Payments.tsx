// ============================================================
// GMIS — Student Payments
// Paystack integration — money goes directly to school account
// ============================================================
import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { formatNaira, formatDate } from '../../../lib/helpers'
import toast from 'react-hot-toast'
import SidebarLayout from '../../../components/layout/SidebarLayout'

interface FeeItem {
  id: string; amount: number; session: string; is_active: boolean
  paystack_subaccount?: string
  fee_types: { id: string; name: string; description: string }
}
interface Payment {
  id: string; amount: number; status: string; reference: string
  paid_at: string | null; created_at: string
  fee_type_id: string
  fee_types: { name: string }
}

export default function StudentPayments() {
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()
  const [studentId,    setStudentId]    = useState<string|null>(null)
  const [feeItems,     setFeeItems]     = useState<FeeItem[]>([])
  const [payments,     setPayments]     = useState<Payment[]>([])
  const [paystackKey,  setPaystackKey]  = useState('')
  const [loading,      setLoading]      = useState(true)
  const [paying,       setPaying]       = useState<string|null>(null)
  const [totals,       setTotals]       = useState({total:0,paid:0,outstanding:0})

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(()=>{ if(db&&user) loadAll() },[db,user])

  const loadAll = async () => {
    setLoading(true)
    try {
      // Load Paystack public key from school's org_settings table
      const {data:cfg} = await db!.from('org_settings').select('paystack_public_key').single()
      if(cfg?.paystack_public_key) setPaystackKey(cfg.paystack_public_key)

      // Get student record
      const {data:s} = await db!.from('students').select('id').eq('supabase_uid',user!.id).single()
      if(!s) return
      setStudentId(s.id)

      // Load fee structure and payment history in parallel
      const [feesRes, paidRes] = await Promise.all([
        db!.from('fee_structure').select('*, fee_types(id,name,description)').eq('is_active',true),
        db!.from('student_payments').select('*, fee_types(name)').eq('student_id',s.id).order('created_at',{ascending:false}),
      ])

      const fees = (feesRes.data||[]) as FeeItem[]
      const paid = (paidRes.data||[]) as Payment[]
      setFeeItems(fees)
      setPayments(paid)

      const totalAmt = fees.reduce((a,f)=>a+f.amount,0)
      const paidAmt  = paid.filter(p=>p.status==='success').reduce((a,p)=>a+p.amount,0)
      setTotals({total:totalAmt, paid:paidAmt, outstanding:totalAmt-paidAmt})
    } finally { setLoading(false) }
  }

  // ── PAYSTACK PAYMENT ─────────────────────────────────────
  const pay = async (fee: FeeItem) => {
    if(!paystackKey){toast.error('Payment gateway not configured. Contact your admin.');return}
    if(!studentId||!user) return
    setPaying(fee.fee_types.id)

    // Create a unique reference
    const ref = `GMIS-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`

    // Save pending record in DB first
    await db!.from('student_payments').insert({
      student_id: studentId, fee_type_id: fee.fee_types.id,
      amount: fee.amount, reference: ref, status: 'pending', session: fee.session,
    })

    // Load Paystack script dynamically
    const existing = document.getElementById('paystack-script')
    const load = (cb: ()=>void) => {
      if(existing){ cb(); return }
      const s = document.createElement('script')
      s.id='paystack-script'; s.src='https://js.paystack.co/v1/inline.js'
      s.onload=cb; document.head.appendChild(s)
    }

    load(()=>{
      // @ts-ignore
      const handler = window.PaystackPop.setup({
        key:      paystackKey,
        email:    user!.email,
        amount:   fee.amount * 100,   // Paystack uses kobo (100 kobo = ₦1)
        ref,
        currency: 'NGN',
        label:    `${fee.fee_types.name} — ${tenant?.name}`,
        metadata: {
          custom_fields: [
            {display_name:'Student ID',   variable_name:'student_id',  value:studentId},
            {display_name:'Fee type',     variable_name:'fee_type',    value:fee.fee_types.name},
            {display_name:'Institution',  variable_name:'school',      value:tenant?.name},
          ]
        },
        // If school configured subaccounts, route to correct one
        ...(fee.paystack_subaccount ? {subaccount:fee.paystack_subaccount} : {}),

        callback: async (res:{reference:string}) => {
          // Mark as paid in DB
          await db!.from('student_payments')
            .update({status:'success', paystack_ref:res.reference, paid_at:new Date().toISOString()})
            .eq('reference',ref)
          toast.success(`✓ ${formatNaira(fee.amount)} payment successful!`)
          setPaying(null)
          loadAll()
        },
        onClose: async () => {
          await db!.from('student_payments').update({status:'failed'}).eq('reference',ref)
          toast.error('Payment cancelled.')
          setPaying(null)
        },
      })
      handler.openIframe()
    })
  }

  // Check if a fee type is already paid
  const isPaid = (feeTypeId:string) =>
    payments.some(p => p.status==='success' && p.fee_type_id===feeTypeId)

  const sc: Record<string,string> = {success:'#4ade80',pending:'#fbbf24',failed:'#f87171'}

  return (
    <SidebarLayout active="payments">
      <h1 style={S.title}>Fee payments</h1>
      <p style={S.sub}>Secured by Paystack · All payments go directly to {tenant?.name}</p>

      {/* Summary stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:13,marginBottom:22}}>
        {[
          {icon:'📋',label:'Total fees',   value:formatNaira(totals.total),       color:''},
          {icon:'✅',label:'Amount paid',  value:formatNaira(totals.paid),         color:'#4ade80'},
          {icon:'⚠️',label:'Outstanding',  value:formatNaira(totals.outstanding),  color:totals.outstanding>0?'#f87171':'#4ade80'},
        ].map(({icon,label,value,color})=>(
          <div key={label} style={S.stat}>
            <div style={{fontSize:20,marginBottom:8}}>{icon}</div>
            <div style={{fontSize:10,color:'#7a8bbf',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{label}</div>
            <div style={{fontSize:20,fontWeight:800,color:color||'#e8eeff',lineHeight:1.2}}>{value}</div>
          </div>
        ))}
      </div>

      {/* Warning if no Paystack configured */}
      {!paystackKey && !loading && (
        <div style={{padding:'13px 16px',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:12,marginBottom:18,fontSize:13,color:'#fbbf24'}}>
          ⚠ Your school admin has not configured the payment gateway yet. Contact your registrar to enable online payments.
        </div>
      )}

      {/* Fee items table */}
      <div style={S.card}>
        <h3 style={S.ct}>Fee structure — {new Date().getFullYear()}/{new Date().getFullYear()+1}</h3>
        {loading ? <Spin /> : feeItems.length===0 ? (
          <Empty text="No fee items have been configured yet. Check back later." />
        ):(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:480}}>
              <thead>
                <tr>{['Fee type','Description','Amount','Status','Action'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {feeItems.map(fee=>{
                  const paid = isPaid(fee.fee_types?.id)
                  const busy = paying===fee.fee_types?.id
                  return(
                    <tr key={fee.id}>
                      <td style={S.td}><strong style={{color:'#e8eeff'}}>{fee.fee_types?.name}</strong></td>
                      <td style={{...S.td,color:'#7a8bbf',fontSize:12}}>{fee.fee_types?.description||'—'}</td>
                      <td style={{...S.td,fontWeight:700,color:'#e8eeff'}}>{formatNaira(fee.amount)}</td>
                      <td style={S.td}>
                        <span style={{fontSize:11,fontWeight:700,background:paid?'rgba(74,222,128,.15)':'rgba(251,191,36,.15)',color:paid?'#4ade80':'#fbbf24',padding:'3px 10px',borderRadius:100}}>
                          {paid?'Paid ✓':'Unpaid'}
                        </span>
                      </td>
                      <td style={S.td}>
                        {paid
                          ?<button style={S.btnSm}>🧾 Receipt</button>
                          :<button onClick={()=>pay(fee)} disabled={busy||!paystackKey}
                            style={{...S.btnPay,opacity:busy?0.7:1,cursor:busy||!paystackKey?'not-allowed':'pointer'}}>
                            {busy?'Processing...':'Pay now'}
                          </button>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div style={S.card}>
        <h3 style={S.ct}>Payment history</h3>
        {payments.length===0
          ?<div style={{textAlign:'center',padding:'20px 0',color:'#3d4f7a',fontSize:13}}>No payments recorded yet.</div>
          :<div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:440}}>
              <thead><tr>{['Fee','Amount','Reference','Status','Date'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {payments.map(p=>(
                  <tr key={p.id}>
                    <td style={S.td}>{p.fee_types?.name||'—'}</td>
                    <td style={{...S.td,fontWeight:600,color:'#e8eeff'}}>{formatNaira(p.amount)}</td>
                    <td style={{...S.td,fontFamily:'monospace',fontSize:11,color:'#7a8bbf'}}>{p.reference}</td>
                    <td style={S.td}>
                      <span style={{fontSize:11,fontWeight:700,background:(sc[p.status]||'#7a8bbf')+'20',color:sc[p.status]||'#7a8bbf',padding:'3px 10px',borderRadius:100,textTransform:'capitalize'}}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{...S.td,color:'#7a8bbf',fontSize:12}}>{p.paid_at?formatDate(p.paid_at):formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>

      <p style={{fontSize:11,color:'#3d4f7a',textAlign:'center',marginTop:8}}>
        🔒 GMIS takes zero cut from student payments. All transactions go directly to {tenant?.name}.
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

function Spin(){return<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'28px 0'}}><div style={{width:26,height:26,border:'2px solid rgba(45,108,255,.2)',borderTopColor:'#2d6cff',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto'}}/></div>}
function Empty({text}:{text:string}){return<div style={{textAlign:'center',padding:'28px 0'}}><div style={{fontSize:36,marginBottom:10}}>💳</div><div style={{fontSize:14,color:'#7a8bbf'}}>{text}</div></div>}

const S: Record<string,React.CSSProperties> = {
  title:  {fontFamily:"'Syne',system-ui",fontWeight:800,fontSize:22,color:'#e8eeff',marginBottom:4},
  sub:    {fontSize:13,color:'#7a8bbf',marginBottom:22},
  stat:   {background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,padding:'16px 18px'},
  card:   {background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:18,padding:'18px 20px',marginBottom:16},
  ct:     {fontFamily:"'Syne',system-ui",fontWeight:700,fontSize:15,color:'#e8eeff',marginBottom:14},
  th:     {textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#3d4f7a',padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.07)',whiteSpace:'nowrap'},
  td:     {padding:'11px 12px',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:13,color:'#7a8bbf',verticalAlign:'middle'},
  btnPay: {padding:'6px 18px',background:'linear-gradient(135deg,#2d6cff,#4f3ef8)',color:'#fff',border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',system-ui"},
  btnSm:  {padding:'6px 14px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:9,color:'#7a8bbf',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',system-ui"},
}
