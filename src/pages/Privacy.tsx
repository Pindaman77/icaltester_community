import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { SEO } from "@/components/SEO";

export default function Privacy() {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="Privacy policy for iCal Tester Pro. Learn how we collect, use, and protect your personal information when using our calendar testing service."
        canonical="/privacy"
      />
      <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-muted/30">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays className="h-5 w-5 text-primary" />
            iCal Tester Pro
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Home
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            <strong>Last update: December 31, 2025</strong>
          </p>

          <div className="mb-8 p-4 bg-muted rounded-lg border border-border">
            <p className="text-sm mb-0">
              <strong>💡 Summary of changes (December 31, 2025):</strong>
              <br />
              Initial privacy policy for iCal Tester Pro.
            </p>
          </div>

          <p>
            Your privacy is important to us. It is our policy to respect your privacy and comply with any applicable law and regulation regarding any personal information we may collect about you, including across our website,{" "}
            <a href="https://icaltester.com" className="text-primary hover:underline">
              https://icaltester.com
            </a>
            , our application, and other services we own and operate.
          </p>

          <p>This policy is effective as of December 31, 2025.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">1. Information We Collect</h2>
          <p>
            Information we collect includes both information you knowingly and actively provide us when using or participating in any of our services, and any information automatically sent by your devices in the course of accessing our products and services.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">2. Log Data</h2>
          <p>
            When you visit our website or use our application, our servers may automatically log the standard data provided by your web browser or network devices. It may include your device's Internet Protocol (IP) address, your browser type and version, the pages you visit, the time and date of your visit, the time spent on each page, other details about your visit, and technical details that occur in conjunction with any errors you may encounter.
          </p>
          <p>
            Please be aware that while this information may not be personally identifying by itself, it may be possible to combine it with other data to personally identify individual persons.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">3. Collection and Use of Information</h2>
          
          <h3 className="text-xl font-semibold mt-6 mb-3">We may collect anonymous information when you do any of the following:</h3>
          <ul>
            <li>
              <strong>Use a web browser to access our website</strong>: in addition to the above-mentioned log data, we collect anonymous navigation statistics. We do not collect any personal information neither do we use cookies or any other tracking technology.
            </li>
            <li>
              <strong>Use our web application</strong>: in addition to the above-mentioned log data, we collect anonymous usage statistics. We do not collect any personal information neither do we use cookies or any other tracking technology.
            </li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">We may collect personal information from you when you do any of the following:</h3>
          <ul>
            <li>
              <strong>Sign up for an account</strong>: profile information, including your email and password.
            </li>
            <li>
              <strong>Use our calendar testing features</strong>: mock calendar data, iCal feed URLs, and booking information you create for testing purposes.
            </li>
            <li>
              <strong>Contact us via email or social media</strong>: your email, name and other details you provide us with.
            </li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">We may collect, hold and use this information for the following purposes:</h3>
          <ul>
            <li>Deliver the service requested by you (calendar testing, feed generation, conflict detection, etc.).</li>
            <li>Improve our services by analyzing the anonymous data collected.</li>
            <li>Provide support and respond to your inquiries.</li>
          </ul>
          <p>
            Personal information will not be further processed in a manner that is incompatible with these purposes.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">4. Security of Your Personal Information</h2>
          <p>
            When we collect and process personal information, and while we retain this information, we will protect it within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use, or modification.
          </p>
          <p>
            Although we will do our best to protect the personal information you provide to us, we advise that no method of electronic transmission or storage is 100% secure, and no one can guarantee absolute data security. We will comply with laws applicable to us in respect of any data breach.
          </p>
          <p>
            You are responsible for selecting any password and its overall security strength, ensuring the security of your own information within the bounds of our services.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">5. How Long We Keep Your Personal Information</h2>
          <p>
            We keep your personal information only for as long as we need to. This time period may depend on what we are using your information for, in accordance with this privacy policy. If your personal information is no longer required, we will delete it or make it anonymous by removing all details that identify you.
          </p>
          <p>
            However, if necessary, we may retain your personal information for our compliance with a legal, accounting, or reporting obligation or for archiving purposes in the public interest, scientific, or historical research purposes or statistical purposes.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">6. Children's Privacy</h2>
          <p>
            We do not aim any of our products or services directly at children under the age of 13, and we do not knowingly collect personal information about children under 13.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">7. International Transfers of Personal Information</h2>
          <p>
            The personal information we collect is stored and/or processed where we or our partners, affiliates, and third-party providers maintain facilities. Please be aware that the locations to which we store, process, or transfer your personal information may not have the same data protection laws as the country in which you initially provided the information.
          </p>
          <p>
            If we transfer your personal information to third parties in other countries: (i) we will perform those transfers in accordance with the requirements of applicable law; and (ii) we will protect the transferred personal information in accordance with this privacy policy.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">8. Your Rights and Controlling Your Personal Information</h2>
          <p>
            You always retain the right to withhold personal information from us, with the understanding that your experience of our service may be affected. We will not discriminate against you for exercising any of your rights over your personal information.
          </p>
          <p>
            If you do provide us with personal information you understand that we will collect, hold, use and disclose it in accordance with this privacy policy. You retain the right to request details of any personal information we hold about you.
          </p>
          <p>
            If we receive personal information about you from a third party, we will protect it as set out in this privacy policy.
          </p>
          <p>
            If you have previously agreed to us using your personal information for direct marketing purposes, you may change your mind at any time. We will provide you with the ability to unsubscribe from our email database or opt out of communications.
          </p>
          <p>
            Please be aware we may need to request specific information from you to help us confirm your identity.
          </p>
          <p>
            If you believe that any information we hold about you is inaccurate, out of date, incomplete, irrelevant, or misleading, please contact us using the details provided in this privacy policy. We will take reasonable steps to correct any information found to be inaccurate, incomplete, misleading, or out of date.
          </p>
          <p>
            If you believe that we have breached a relevant data protection law and wish to make a complaint, please contact us using the details below and provide us with full details of the alleged breach. We will promptly investigate your complaint and respond to you, in writing, setting out the outcome of our investigation and the steps we will take to deal with your complaint.
          </p>
          <p>
            You also have the right to contact a regulatory body or data protection authority in relation to your complaint.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">9. Limits of Our Policy</h2>
          <p>
            Our website may link to external sites that are not operated by us. Please be aware that we have no control over the content and policies of those sites, and cannot accept responsibility or liability for their respective privacy practices.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">10. California Privacy Notice (CCPA/CPRA)</h2>
          <p>
            We do not sell or share personal information as defined by CPRA, and we do not use or disclose sensitive personal information beyond purposes permitted by law.
          </p>
          <p>
            California residents have the right to know, delete, correct, and limit use of their information, and the right to non-discrimination.
          </p>
          <p>
            Submit requests to{" "}
            <a href="mailto:support@icaltester.com" className="text-primary hover:underline">
              support@icaltester.com
            </a>
            ; we will verify and respond within 45 days.
          </p>
          <p>
            <strong>Categories collected:</strong>
          </p>
          <ul>
            <li>Identifiers (email address)</li>
            <li>Commercial information (calendar feed data created for testing)</li>
            <li>Internet activity (log data)</li>
          </ul>
          <p>
            <strong>Sources:</strong> You and our service logs.
          </p>
          <p>
            <strong>Purposes:</strong> Provide, secure, and support the service; enable calendar sync testing features.
          </p>
          <p>
            <strong>Disclosures to service providers:</strong> Hosting provider for infrastructure and data storage.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">11. Data Retention Details</h2>
          <ul>
            <li>
              <strong>Account data</strong> persists while your account is active.
            </li>
            <li>
              Upon <strong>account deletion</strong> requested by you, we delete active records within <strong>30 days</strong>.
            </li>
            <li>
              <strong>Calendar feed data</strong> (mock calendars, bookings, subscriptions) is deleted within <strong>30 days</strong> of account deletion.
            </li>
            <li>
              <strong>Operational logs</strong> are retained up to <strong>90 days</strong> and then deleted or anonymized.
            </li>
            <li>
              <strong>Support correspondence</strong> may be retained up to <strong>24 months</strong>.
            </li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">12. Backup and Restore Practices</h2>
          <p>
            We perform regular backups with encryption. Backups are retained for disaster recovery purposes and are used only for service continuity. Upon account deletion, your data is removed from active systems within 30 days and purged from backups on their normal cycle (up to 90 days).
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">13. Sub-processors</h2>
          <p>
            We use the following third-party service providers who act as processors:
          </p>
          <ul>
            <li>
              <strong>Hosting provider</strong> (e.g., Vercel, Railway, or your chosen provider): Infrastructure and data storage
            </li>
            <li>
              <strong>Analytics provider</strong> (if applicable, e.g., Plausible, PostHog): Anonymous usage analytics
            </li>
          </ul>
          <p>
            Each acts as a processor under appropriate agreements. International transfers rely on safeguards such as Standard Contractual Clauses and Data Processing Agreements where applicable.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">14. Changes to This Policy</h2>
          <p>
            At our discretion, we may change our privacy policy to reflect updates to our business processes, current acceptable practices, or legislative or regulatory changes.
          </p>
          <p>
            If we decide to change this privacy policy, we will post the changes here at the same link by which you are accessing this privacy policy.
          </p>
          <p>
            If required by law, we will get your permission or give you the opportunity to opt in to or opt out of, as applicable, any new uses of your personal information.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4">15. Contact Us</h2>
          <p>
            For any questions or concerns regarding your privacy, you may contact us using the following details:
          </p>
          <p>
            <strong>Email:</strong>{" "}
            <a href="mailto:support@icaltester.com" className="text-primary hover:underline">
              support@icaltester.com
            </a>
          </p>

          <div className="mt-12 pt-8 border-t border-border text-sm text-muted-foreground">
            <p>© iCal Tester Pro 2025. All rights reserved.</p>
          </div>
        </article>
      </main>
    </div>
    </>
  );
}
