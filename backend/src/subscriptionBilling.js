import { listCompanies, listUsersByCompany, listAllUsers, getCompanyById, debitCompanyWithTransaction, ensureEmployeeBillingForCompany, listDueEmployeeBillingsForCompany, setEmployeeBillingNextCharge } from './sqlite.js'
import { sendLowCreditWarning, sendMonthlyBillingSummary, sendAccountSuspensionWarning } from './email.js'

function addDaysIso(iso, days) {
  const base = new Date(iso)
  return new Date(base.getTime() + Number(days || 0) * 86400000).toISOString()
}

export function getCompanyAdminEmail(company_id, company) {
  const admin = listAllUsers().find(u => u.company_id == company_id && u.role === 'company_admin')
  return admin?.email || company?.billing_email || company?.admin_contact_email || null
}

export async function runEmployeeMonthlyBilling({ asOf = new Date(), emitCreditsUpdated } = {}) {
  const asOfIso = (asOf instanceof Date ? asOf : new Date(asOf)).toISOString()
  const companies = listCompanies()

  for (const c of companies) {
    const company_id = c.id
    const company = getCompanyById(company_id) || c
    const adminEmail = getCompanyAdminEmail(company_id, company)
    if (!adminEmail) continue

    try { ensureEmployeeBillingForCompany(company_id) } catch {}
    const due = listDueEmployeeBillingsForCompany(company_id, asOfIso)
    if (!due.length) continue

    const cost = due.length
    try {
      const newBalance = debitCompanyWithTransaction({
        company_id,
        amount_usd: cost,
        credits: cost,
        description: `Employee subscription (30-day) • ${cost} employee(s)`,
        reference_id: `emp_sub_${company_id}_${Date.now()}`
      })

      const nextChargeAt = addDaysIso(asOfIso, 30)
      for (const row of due) {
        try { setEmployeeBillingNextCharge(row.employee_id, nextChargeAt, asOfIso) } catch {}
      }

      const employees = listUsersByCompany(company_id).filter(u => u.role === 'employee')
      const period = `30-day cycle ending ${asOfIso.slice(0, 10)}`
      await sendMonthlyBillingSummary({
        to: adminEmail,
        company,
        period,
        activeEmployees: employees.length,
        deducted: cost,
        remaining: newBalance
      })
      if (typeof emitCreditsUpdated === 'function') {
        try { emitCreditsUpdated(company_id, newBalance) } catch {}
      }
    } catch (e) {
      const fresh = getCompanyById(company_id) || company
      const balance = Number(fresh?.credits || 0)
      if (balance <= 0) await sendAccountSuspensionWarning({ to: adminEmail, company: fresh })
      else await sendLowCreditWarning({ to: adminEmail, balance, company: fresh })
    }
  }
}
