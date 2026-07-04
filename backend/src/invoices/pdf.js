import fs from 'fs'
import path from 'path'

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return String(dateStr)
  }
}

function formatCurrency(amount, currency = 'USD') {
  return `$${Number(amount || 0).toFixed(2)}`
}

export async function generateInvoicePdf(invoice) {
  const PDFDocument = (await import('pdfkit')).default
  const baseDir = path.resolve(process.cwd(), process.env.DATA_DIR || 'data', 'invoices', String(invoice.company_id))
  ensureDir(baseDir)
  const fname = `${invoice.invoice_id}.pdf`
  const outfile = path.join(baseDir, fname)

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const stream = fs.createWriteStream(outfile)
  doc.pipe(stream)

  // -- Styles --
  const primaryColor = '#1F2937' // Gray-900
  const secondaryColor = '#6B7280' // Gray-500
  const accentColor = '#3B82F6' // Blue-500
  const borderColor = '#E5E7EB' // Gray-200
  const tableHeaderBg = '#F3F4F6' // Gray-100

  // Helper: Horizontal Line
  const hr = (y) => {
    doc.strokeColor(borderColor).lineWidth(1).moveTo(50, y).lineTo(545, y).stroke()
  }

  // 1. Header Section
  // Logo / Brand Name (SaaS Provider)
  doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('WFHLOGGER', 50, 50)
  
  // Status Pill (Top Right)
  const status = (invoice.payment_status || 'PAID').toUpperCase()
  const statusColor = status === 'PAID' ? '#10B981' : (status === 'FAILED' ? '#EF4444' : '#F59E0B')
  
  // Draw pill background
  const pillWidth = 80
  const pillHeight = 24
  const pillX = 465
  const pillY = 45
  
  doc.save()
  doc.roundedRect(pillX, pillY, pillWidth, pillHeight, 12).fill(statusColor)
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(status, pillX, pillY + 7, { width: pillWidth, align: 'center' })
  doc.restore()

  // SaaS Contact Info
  doc.fontSize(9).font('Helvetica').fillColor(secondaryColor)
  doc.text('123 SaaS Street, Tech Valley', 50, 75)
  doc.text('support@wfhlogger.com', 50, 88)
  doc.text('www.wfhlogger.com', 50, 101)

  // Invoice Meta (Right side, below pill)
  doc.fontSize(24).font('Helvetica-Bold').fillColor(primaryColor)
  doc.text('INVOICE', 300, 90, { align: 'right', width: 245 })
  
  doc.fontSize(10).font('Helvetica').fillColor(secondaryColor)
  doc.text(`# ${invoice.invoice_id}`, 300, 120, { align: 'right', width: 245 })
  doc.text(`Date: ${formatDate(invoice.invoice_date)}`, 300, 135, { align: 'right', width: 245 })

  hr(160)

  // 2. Bill To Section
  const billToY = 180
  doc.fontSize(10).font('Helvetica-Bold').fillColor(secondaryColor).text('BILL TO', 50, billToY)
  
  let contentY = billToY + 20
  let contentX = 50

  // Tenant Logo if available
  if (invoice.company_logo_url) {
    try {
      const logoPath = path.resolve(process.cwd(), invoice.company_logo_url.replace(/^\//,''))
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, contentY, { width: 40, height: 40, fit: [40, 40] })
        contentX = 100
      }
    } catch {}
  }

  doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor).text(invoice.company_name || 'Valued Customer', contentX, contentY)
  doc.fontSize(10).font('Helvetica').fillColor(secondaryColor)
  doc.text(invoice.billing_email || '', contentX, contentY + 18)
  if (invoice.billing_address) {
     doc.text(invoice.billing_address, contentX, contentY + 32)
  }
  doc.text(`Tenant ID: ${invoice.company_id}`, contentX, contentY + (invoice.billing_address ? 46 : 32))

  // 3. Line Items Table
  const tableTop = 280
  
  // Table Header
  doc.rect(50, tableTop, 495, 24).fill(tableHeaderBg)
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
  
  const col1 = 60  // Description
  const col2 = 320 // Qty
  const col3 = 380 // Unit Price
  const col4 = 480 // Amount

  doc.text('DESCRIPTION', col1, tableTop + 7)
  doc.text('QTY', col2, tableTop + 7)
  doc.text('UNIT PRICE', col3, tableTop + 7)
  doc.text('AMOUNT', col4, tableTop + 7)

  // Table Rows
  let items = invoice.line_items || []
  if (typeof items === 'string') {
    try { items = JSON.parse(items) } catch { items = [] }
  }

  let y = tableTop + 35
  doc.font('Helvetica').fontSize(9).fillColor(primaryColor)

  items.forEach((item, i) => {
    // Alternating row bg optional? Keep it clean white for now.
    doc.text(item.description, col1, y)
    doc.text(String(item.quantity), col2, y)
    doc.text(formatCurrency(item.unit_price), col3, y)
    doc.text(formatCurrency(item.subtotal), col4, y)
    
    y += 24
    hr(y - 8)
  })

  // 4. Totals Section
  const totalsY = y + 10
  const totalsLabelX = 350
  const totalsValueX = 450
  const totalsWidth = 95

  doc.fontSize(9).font('Helvetica').fillColor(secondaryColor)
  doc.text('Subtotal', totalsLabelX, totalsY, { width: 80, align: 'right' })
  doc.fillColor(primaryColor).text(formatCurrency(invoice.subtotal_amount), totalsValueX, totalsY, { width: totalsWidth, align: 'right' })

  doc.fillColor(secondaryColor).text(`Tax (${invoice.tax_rate || '0'}%)`, totalsLabelX, totalsY + 15, { width: 80, align: 'right' })
  doc.fillColor(primaryColor).text(formatCurrency(invoice.tax_amount), totalsValueX, totalsY + 15, { width: totalsWidth, align: 'right' })

  // Grand Total
  doc.rect(totalsLabelX, totalsY + 35, 195, 30).fill(tableHeaderBg)
  doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor)
  doc.text('Total', totalsLabelX + 10, totalsY + 44)
  doc.text(formatCurrency(invoice.total_amount), totalsValueX, totalsY + 44, { width: totalsWidth, align: 'right' })

  // 5. Payment Info & Footer
  const footerY = 700
  
  // Payment Details Box
  doc.roundedRect(50, footerY - 80, 200, 60, 4).stroke(borderColor)
  doc.fontSize(8).font('Helvetica-Bold').fillColor(secondaryColor).text('PAYMENT DETAILS', 60, footerY - 70)
  doc.font('Helvetica').fillColor(primaryColor)
  doc.text(`Provider: ${invoice.payment_provider || 'N/A'}`, 60, footerY - 55)
  doc.text(`Transaction ID: ${invoice.payment_reference_id || 'N/A'}`, 60, footerY - 42)
  
  // Footer Legal
  hr(footerY)
  doc.fontSize(8).font('Helvetica').fillColor(secondaryColor)
  doc.text('This is a system-generated invoice. If you have any questions, please contact our support team.', 50, footerY + 10, { align: 'center', width: 495 })
  doc.text('WFHLOGGER • 123 SaaS Street • support@wfhlogger.com', 50, footerY + 22, { align: 'center', width: 495 })

  doc.end()
  return new Promise((resolve) => {
    stream.on('finish', () => resolve(outfile))
  })
}
