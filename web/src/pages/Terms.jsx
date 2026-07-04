import React from 'react'
import { PublicShell } from '../components/public/PublicShell.jsx'
import { LegalPage, H2 } from '../components/legal/LegalPage.jsx'

export default function Terms() {
  const updatedAt = 'January 29, 2026'
  const toc = [
    { id: 'agreement', label: 'Agreement' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'acceptable-use', label: 'Acceptable Use' },
    { id: 'subscriptions', label: 'Subscriptions & Billing' },
    { id: 'data', label: 'Customer Data' },
    { id: 'ip', label: 'Intellectual Property' },
    { id: 'termination', label: 'Termination' },
    { id: 'disclaimers', label: 'Disclaimers' },
    { id: 'liability', label: 'Limitation of Liability' },
    { id: 'changes', label: 'Changes' },
    { id: 'contact', label: 'Contact' },
  ]

  return (
    <PublicShell
      title="Terms of Service"
      subtitle="These terms govern use of TimeTracker by companies, administrators, managers, and employees."
    >
      <LegalPage updatedAt={updatedAt} toc={toc}>
        <H2 id="agreement">Agreement</H2>
        <p>
          By accessing or using TimeTracker (the “Service”), you agree to these Terms. If you are using the Service on behalf of an
          organization, you represent you have authority to bind that organization.
        </p>

        <H2 id="accounts">Accounts</H2>
        <ul>
          <li>You must provide accurate account information and keep it up to date.</li>
          <li>You are responsible for maintaining the confidentiality of credentials.</li>
          <li>Admins are responsible for configuring roles and access for their organization.</li>
        </ul>

        <H2 id="acceptable-use">Acceptable Use</H2>
        <ul>
          <li>Do not attempt to disrupt the Service or bypass security controls.</li>
          <li>Do not upload malware or use the Service for unlawful purposes.</li>
          <li>Use monitoring features in compliance with applicable laws and workplace policies.</li>
        </ul>

        <H2 id="subscriptions">Subscriptions & Billing</H2>
        <p>
          Paid features may require a subscription or credits. Billing terms, pricing, and usage rules may vary by plan. You authorize us
          (and our payment processors) to charge the applicable fees.
        </p>

        <H2 id="data">Customer Data</H2>
        <p>
          Customer Data includes information submitted to the Service and the output generated through use of the Service (e.g., time logs and
          reports). Customers control configuration, retention, and access for their organization.
        </p>

        <H2 id="ip">Intellectual Property</H2>
        <p>
          TimeTracker and its software, documentation, and branding are owned by us and protected by intellectual property laws. These Terms do
          not grant you ownership rights.
        </p>

        <H2 id="termination">Termination</H2>
        <p>
          We may suspend or terminate access if you breach these Terms or if we reasonably believe continued use poses a security, legal, or
          operational risk.
        </p>

        <H2 id="disclaimers">Disclaimers</H2>
        <p>
          The Service is provided “as is” and “as available.” We do not warrant that the Service will be uninterrupted or error-free.
        </p>

        <H2 id="liability">Limitation of Liability</H2>
        <p>
          To the maximum extent permitted by law, we will not be liable for indirect, incidental, special, consequential, or punitive damages,
          or for any loss of profits, data, or goodwill.
        </p>

        <H2 id="changes">Changes</H2>
        <p>
          We may update these Terms from time to time. Material changes will be communicated through the Service or by other reasonable means.
        </p>

        <H2 id="contact">Contact</H2>
        <p>
          Questions about these Terms can be sent to <a href="mailto:legal@timetracker.com">legal@timetracker.com</a>.
        </p>
      </LegalPage>
    </PublicShell>
  )
}
