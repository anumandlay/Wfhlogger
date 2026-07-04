## Diagnosis

* 500 originates from PDF generation/streaming path issues (e.g., missing pdf\_path on invoice, filesystem write failures, or PDFKit sub-dependency resolution).

* Current flow writes a file then streams it; failures in persistence/regeneration return generic 500.

## Backend Changes

### Route Definition

* GET /api/billing/invoices/:invoiceId/download

* Auth: Admin-only (super\_admin) with JWT; extract company\_id from token.

### Controller Logic (Secure & Tenant-Scoped)

* Steps:

1. Read `company_id` from JWT and `invoiceId` from params.
2. Fetch invoice by (`company_id`, `invoiceId`). If not found → 404.
3. Set headers:

   * `Content-Type: application/pdf`

   * `Content-Disposition: attachment; filename="<invoiceId>.pdf"`
4. Create PDFKit document and stream directly to `res`:

   * `const doc = new PDFDocument({ size: 'A4', margin: 50 })`

   * `doc.pipe(res)`

   * Render company branding, header, item table, totals, payment metadata, and footer.

   * `doc.end()`
5. Append audit log `invoice_downloaded` with `company_id` and `invoiceId`.
6. Error handling:

   * 403 for cross-tenant attempts (mismatch company)

   * 404 for missing invoice

   * 500 with message for PDF generation exceptions

### Example Controller (illustrative)

```js
app.get('/api/billing/invoices/:invoiceId/download', requireRole(['super_admin']), async (req, res) => {
  try {
    const company_id = req.user?.company_id
    const invoiceId = req.params.invoiceId
    const inv = getInvoiceByCompany(company_id, invoiceId)
    if (!inv) return res.status(404).json({ error: 'Invoice not found' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceId}.pdf"`)

    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    doc.pipe(res)

    // Branding
    doc.fontSize(20).text(inv.company_name || 'Company', 50, 50)
    doc.fontSize(10).fillColor('#666').text('Time Tracker SaaS', 50, 75)

    // Header
    doc.moveDown()
    doc.fillColor('#000').fontSize(14).text('Invoice')
    doc.fontSize(10)
      .text(`Invoice Number: ${inv.invoice_id}`)
      .text(`Invoice Date: ${inv.invoice_date}`)
      .text(`Billing Period: ${inv.billing_period || 'One-time'}`)
      .text(`Billing Email: ${inv.billing_email || ''}`)

    // Items
    const items = inv.line_items || []
    doc.moveDown().fontSize(12).text('Items')
    const startY = doc.y; doc.fontSize(10)
    doc.text('Description', 50, startY)
    doc.text('Qty', 300, startY)
    doc.text('Unit', 350, startY)
    doc.text('Subtotal', 420, startY)
    let y = startY + 18
    items.forEach(it => {
      doc.text(it.description || '', 50, y)
      doc.text(String(it.quantity || 0), 300, y)
      doc.text(`$${Number(it.unit_price || 0).toFixed(2)}`, 350, y)
      doc.text(`$${Number(it.subtotal || 0).toFixed(2)}`, 420, y)
      y += 18
    })

    // Totals
    doc.moveDown()
    doc.text(`Subtotal: $${Number(inv.subtotal_amount || 0).toFixed(2)}`, { align: 'right' })
    doc.text(`Tax: $${Number(inv.tax_amount || 0).toFixed(2)}`, { align: 'right' })
    doc.fontSize(12).text(`Total: $${Number(inv.total_amount || 0).toFixed(2)}`, { align: 'right' })

    // Payment meta
    doc.moveDown(); doc.fontSize(10)
      .text(`Payment Provider: ${inv.payment_provider || ''}`)
      .text(`Transaction ID: ${inv.payment_reference_id || ''}`)
      .text(`Payment Status: ${inv.payment_status || ''}`)

    // Footer
    doc.moveDown().fontSize(9).fillColor('#666').text('This is a system-generated invoice.', { align: 'center' })

    doc.end()
    appendAudit('invoice_downloaded', { company_id, invoice_id: invoiceId }, company_id)
  } catch (e) {
    res.status(500).json({ error: 'Failed to download invoice' })
  }
})
```

### Why 500 Happened & Fix

* Causes: missing `pdf_path`, filesystem write/permission failures, PDFKit sub-dependency resolution, or trying to stream a non-existent file.

* Fix: Stream PDF directly to the HTTP response (no filesystem dependency); set headers correctly; regenerate from invoice data reliably; strict tenant checks and clear 404/403 responses.

## Frontend Download (Blob)

* Use authenticated request with `responseType: 'blob'` and anchor-based save:

```js
async function downloadInvoice(invoice_id) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
  const base = await resolveApiBase()
  const res = await axios.get(`${base}/api/billing/invoices/${invoice_id}/download`, { headers, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoice_id}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

## Security & Multi‑Tenant

* Always query invoice by (`company_id`, `invoice_id`); never expose cross-tenant data.

* Enforce role checks; Admin-only by default for listing/downloading.

* Audit logs for both generation and downloads.

## Production Readiness

* Lazy PDFKit import to avoid startup failures; stream-based generation prevents temp file cleanup issues.

* Clear HTTP status codes; no sensitive data exposure; future-ready for tax/regional formats.

## Validation

* Download returns 200 with streamed PDF and correct filename.

* 404 when invoice not found; 403 when company mismatch.

* Works across Admin billing UI with Blob download.

