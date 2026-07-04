import React from 'react'
import { PublicShell } from '../components/public/PublicShell.jsx'
import { LegalPage, H2 } from '../components/legal/LegalPage.jsx'

export default function Privacy() {
  const updatedAt = 'January 29, 2026'
  const toc = [
    { id: 'overview', label: 'Overview' },
    { id: 'data-we-collect', label: 'Information We Collect' },
    { id: 'how-we-use', label: 'How We Use Data' },
    { id: 'screenshots', label: 'Screenshots & Activity' },
    { id: 'sharing', label: 'Sharing & Disclosure' },
    { id: 'security', label: 'Security' },
    { id: 'retention', label: 'Retention' },
    { id: 'your-rights', label: 'Your Rights' },
    { id: 'contact', label: 'Contact' },
  ]

  return (
    <PublicShell
      title="Privacy Policy"
      subtitle="This policy explains what information we collect, how it’s used, and the choices available to you."
    >
      <LegalPage updatedAt={updatedAt} toc={toc}>
        <H2 id="overview">Overview</H2>
        <p>
          TimeTracker is a workforce time tracking and reporting platform. Our customers (companies) use TimeTracker to manage employee
          time entries, work sessions, and reporting.
        </p>
        <p>
          This policy covers information processed when you visit our website, use our web app, or use the desktop tracker.
        </p>

        <H2 id="data-we-collect">Information We Collect</H2>
        <ul>
          <li><strong>Account data:</strong> name, email, password (stored as a hash), role, and company/tenant identifiers.</li>
          <li><strong>Work data:</strong> work sessions, activity logs, timestamps, and reporting metadata.</li>
          <li><strong>Device and usage data:</strong> IP address, browser/device type, and basic diagnostic logs.</li>
          <li><strong>Support data:</strong> messages you send to Support/Contact and related metadata (e.g., submission time).</li>
        </ul>

        <H2 id="how-we-use">How We Use Data</H2>
        <ul>
          <li>Provide and operate the service, including authentication, reporting, and admin features.</li>
          <li>Maintain safety and prevent abuse, fraud, or unauthorized access.</li>
          <li>Improve product reliability, performance, and usability.</li>
          <li>Respond to questions and support requests.</li>
        </ul>

        <H2 id="screenshots">Screenshots & Activity</H2>
        <p>
          If enabled by your company’s configuration, the desktop tracker may capture screenshots and upload them to storage associated with
          your organization’s workflow. Screenshots are intended to support transparency and auditability of tracked sessions.
        </p>
        <p>
          Companies are responsible for informing their employees about the monitoring configuration, obtaining any required consent, and
          setting appropriate retention periods.
        </p>

        <H2 id="sharing">Sharing & Disclosure</H2>
        <ul>
          <li><strong>Within your company:</strong> administrators and authorized managers may view work data as permitted by role-based access.</li>
          <li><strong>Service providers:</strong> we may use infrastructure and email providers to operate the service.</li>
          <li><strong>Legal:</strong> we may disclose information if required by law or to protect rights and safety.</li>
        </ul>

        <H2 id="security">Security</H2>
        <p>
          We use reasonable technical and organizational safeguards to protect information. No method of transmission or storage is fully
          secure; therefore we cannot guarantee absolute security.
        </p>

        <H2 id="retention">Retention</H2>
        <p>
          Retention depends on company configuration and operational needs. We retain support submissions as needed to respond and improve
          service. Company admins should configure retention in line with their policies.
        </p>

        <H2 id="your-rights">Your Rights</H2>
        <p>
          Depending on your location, you may have rights to access, correct, delete, or export certain personal information. If you are an
          employee user, your company may control certain data processing; in that case, contact your company administrator first.
        </p>

        <H2 id="contact">Contact</H2>
        <p>
          Privacy questions can be sent to <a href="mailto:privacy@timetracker.com">privacy@timetracker.com</a>.
        </p>
      </LegalPage>
    </PublicShell>
  )
}
