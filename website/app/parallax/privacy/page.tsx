import LegalPageLayout from '../components/ui/LegalPageLayout';

const h2Style = {
  fontFamily: "'DM Serif Display', var(--font-dm-serif), serif",
  fontSize: 22,
  fontWeight: 400 as const,
  color: '#363840',
  marginTop: 40,
  marginBottom: 16,
};

const h3Style = {
  fontFamily: "'DM Sans', var(--font-dm-sans), sans-serif",
  fontSize: 16,
  fontWeight: 600 as const,
  color: '#363840',
  marginTop: 28,
  marginBottom: 10,
};

const pStyle = {
  fontSize: 15,
  lineHeight: 1.7,
  color: '#363840',
  marginBottom: 16,
};

const liStyle = {
  fontSize: 15,
  lineHeight: 1.7,
  color: '#363840',
  marginBottom: 8,
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout>
      <h1
        style={{
          fontFamily: "'DM Serif Display', var(--font-dm-serif), serif",
          fontSize: 32,
          fontWeight: 400,
          color: '#1a1d23',
          marginBottom: 8,
        }}
      >
        Privacy Policy
      </h1>
      <p style={{ fontSize: 14, color: '#6b6d74', marginBottom: 32 }}>
        <strong>Effective Date:</strong> February 28, 2026 &nbsp;&middot;&nbsp; <strong>Last Updated:</strong> February 28, 2026
      </p>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(26,29,35,0.08)', margin: '24px 0' }} />

      <h2 style={h2Style}>1. Introduction</h2>
      <p style={pStyle}>
        This Privacy Policy describes how Parallax (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;) collects, uses, stores, and protects information in connection with your use of Parallax (&ldquo;the Software,&rdquo; &ldquo;the Service&rdquo;), a browser-based transit and trip service planning tool.
      </p>
      <p style={pStyle}>
        By using the Software, you acknowledge that you have read and understood this Privacy Policy. This Privacy Policy should be read in conjunction with our <a href="/parallax/terms" style={{ color: '#2a6b5a' }}>Terms of Service</a>.
      </p>

      <h2 style={h2Style}>2. Information We Collect</h2>

      <h3 style={h3Style}>2.1 Information You Provide</h3>
      <p style={pStyle}>
        Parallax enables users to import and work with transit operational data, including route schedules, trip records, run configurations, and related planning parameters. This data is provided voluntarily by the user and is processed within user-initiated sessions.
      </p>
      <p style={pStyle}>
        <strong>We do not intentionally collect personally identifiable information (PII) or protected health information (PHI).</strong> The Software is designed to work with operational transit data that does not require or request personal information. If PII or PHI is inadvertently included in data you upload — such as passenger names, contact information, or medical details embedded in trip records — you do so at your own risk. We do not screen uploaded data for PII or PHI and assume no responsibility for its presence.
      </p>

      <h3 style={h3Style}>2.2 Session Data</h3>
      <p style={pStyle}>
        When you create a session in Parallax, the Software generates token-based identifiers (an edit token and a read-only token) to manage your workspace. Session data includes:
      </p>
      <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
        <li style={liStyle}>Session name and timestamps (creation, last update, last access)</li>
        <li style={liStyle}>Imported trip and route data (addresses, coordinates, schedules, status, passenger type)</li>
        <li style={liStyle}>Route configurations (depot locations, start/end times, break schedules)</li>
        <li style={liStyle}>Run structures (run names, service days, platform and pay hours, break periods)</li>
        <li style={liStyle}>Optimization settings and parameters</li>
        <li style={liStyle}>Import templates and field mappings</li>
      </ul>
      <p style={pStyle}>
        Session data is stored on our servers for the duration of the session and may be subject to periodic cleanup. We make no guarantee regarding the long-term persistence of session data.
      </p>

      <h3 style={h3Style}>2.3 Automatically Collected Information</h3>
      <p style={pStyle}>
        When you access the Software, our servers may automatically collect certain technical information, including:
      </p>
      <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
        <li style={liStyle}>IP address</li>
        <li style={liStyle}>Browser type and version</li>
        <li style={liStyle}>Operating system</li>
        <li style={liStyle}>Referring URL</li>
        <li style={liStyle}>Pages visited within the Software</li>
        <li style={liStyle}>Date and time of access</li>
        <li style={liStyle}>General geographic location (derived from IP address)</li>
      </ul>
      <p style={pStyle}>
        This information is collected through standard server logs and is used for maintaining service reliability, diagnosing technical issues, and understanding general usage patterns.
      </p>

      <h3 style={h3Style}>2.4 Cookies and Similar Technologies</h3>
      <p style={pStyle}>
        Parallax uses cookies and similar browser-based storage technologies. The types of cookies we use include:
      </p>
      <p style={pStyle}>
        <strong>Essential Cookies:</strong> Required for the Software to function. These include session tokens that identify your workspace and maintain your active session. These cookies cannot be disabled without breaking core functionality.
      </p>
      <p style={pStyle}>
        <strong>Analytics and Performance Cookies:</strong> We use or plan to use third-party analytics services to understand how users interact with the Software, including which features are used, session duration, and navigation patterns. These cookies help us improve the Software. Analytics providers may include services such as Google Analytics, Plausible, PostHog, or similar platforms. When active, these services may set their own cookies and collect data in accordance with their respective privacy policies.
      </p>
      <p style={pStyle}>
        <strong>Marketing Cookies:</strong> We may use cookies to understand how users discover and engage with the Software. These cookies may track referral sources and general engagement metrics.
      </p>
      <p style={pStyle}>
        You may control non-essential cookies through your browser settings. Disabling analytics or marketing cookies will not affect the core functionality of the Software.
      </p>

      <h2 style={h2Style}>3. How We Use Information</h2>
      <p style={pStyle}>
        We use the information described above for the following purposes:
      </p>
      <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
        <li style={liStyle}><strong>Providing the Service:</strong> Processing your imported data, generating route structures, run bids, and analytical outputs within your session.</li>
        <li style={liStyle}><strong>Maintaining and Improving the Software:</strong> Diagnosing errors, monitoring performance, identifying usage patterns, and informing development priorities.</li>
        <li style={liStyle}><strong>Security and Abuse Prevention:</strong> Detecting and preventing unauthorized access, misuse, or interference with the Software&apos;s infrastructure.</li>
        <li style={liStyle}><strong>Communication:</strong> Responding to inquiries or support requests if you contact us directly.</li>
      </ul>
      <p style={pStyle}>
        We do not sell, rent, or trade your data to third parties for their own marketing purposes.
      </p>

      <h2 style={h2Style}>4. Third-Party Services</h2>

      <h3 style={h3Style}>4.1 Mapbox</h3>
      <p style={pStyle}>
        Parallax integrates with Mapbox to provide mapping, geocoding, and geographic visualization features. When you use these features, certain data — including addresses, geographic coordinates, and location-based queries derived from your imported trip and route data — may be transmitted to Mapbox for processing.
      </p>
      <p style={pStyle}>
        Mapbox processes this data in accordance with its own privacy policy and terms of service, available at{' '}
        <a href="https://www.mapbox.com/legal/privacy" style={{ color: '#2a6b5a' }} target="_blank" rel="noopener noreferrer">
          https://www.mapbox.com/legal/privacy
        </a>. Parallax is not responsible for Mapbox&apos;s data handling practices.
      </p>

      <h3 style={h3Style}>4.2 Analytics Providers</h3>
      <p style={pStyle}>
        We use or intend to use third-party analytics services to collect and analyze usage data. These providers may process data including IP addresses, browser information, and in-app behavior. Each provider operates under its own privacy policy. We will update this section to identify specific providers as they are implemented.
      </p>

      <h3 style={h3Style}>4.3 Future Integrations</h3>
      <p style={pStyle}>
        The Software may incorporate additional third-party services in future releases, including artificial intelligence and machine learning capabilities. If such integrations involve material changes to how your data is collected or processed, we will update this Privacy Policy accordingly.
      </p>

      <h2 style={h2Style}>5. Data Storage and Security</h2>

      <h3 style={h3Style}>5.1 Where Data Is Stored</h3>
      <p style={pStyle}>
        Session data and server logs are stored on self-hosted infrastructure located in the United States. All data processing occurs on servers under Parallax&apos;s direct operational control.
      </p>

      <h3 style={h3Style}>5.2 Security Measures</h3>
      <p style={pStyle}>
        We implement reasonable technical and organizational measures to protect the data processed by the Software, including token-based session management and password hashing for session protection. However, no method of electronic transmission or storage is completely secure. We cannot guarantee absolute security and assume no liability for any unauthorized access to data stored within the Software.
      </p>

      <h3 style={h3Style}>5.3 Data Retention</h3>
      <p style={pStyle}>
        Session data is retained for the duration of active use and may be automatically purged after a period of inactivity. Server logs and analytics data are retained for a reasonable period necessary to fulfill the purposes described in this Privacy Policy. Parallax does not maintain long-term archives of user session data.
      </p>

      <h2 style={h2Style}>6. Your Rights</h2>

      <h3 style={h3Style}>6.1 General Rights</h3>
      <p style={pStyle}>You may at any time:</p>
      <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
        <li style={liStyle}>Stop using the Software and discontinue providing data.</li>
        <li style={liStyle}>Clear your browser&apos;s cookies and local storage related to the Software.</li>
        <li style={liStyle}>Contact us to request information about data associated with your session.</li>
      </ul>

      <h3 style={h3Style}>6.2 Rights for Users in the European Economic Area (EEA) and United Kingdom</h3>
      <p style={pStyle}>
        If you are located in the EEA or UK, you may have additional rights under the General Data Protection Regulation (GDPR) or UK GDPR, including the right to access, rectify, erase, restrict processing, data portability, and objection. To exercise any of these rights, please contact us using the information provided in Section 9.
      </p>
      <p style={pStyle}>
        We process data on the following legal bases: legitimate interest in operating and improving the Software, and consent where required for non-essential cookies and analytics.
      </p>
      <p style={pStyle}>
        Please note that because Parallax uses token-based sessions without user accounts, our ability to identify and retrieve data associated with a specific individual may be limited.
      </p>

      <h3 style={h3Style}>6.3 California Residents</h3>
      <p style={pStyle}>
        If you are a California resident, you may have rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to request deletion, and the right to opt out of the sale of personal information. We do not sell personal information. To exercise your rights, please contact us using the information provided in Section 9.
      </p>

      <h2 style={h2Style}>7. Children&apos;s Privacy</h2>
      <p style={pStyle}>
        Parallax is a professional business-to-business tool and is not directed at individuals under the age of 16. We do not knowingly collect information from children. If you believe a child has provided data through the Software, please contact us and we will take appropriate steps to remove it.
      </p>

      <h2 style={h2Style}>8. Changes to This Privacy Policy</h2>
      <p style={pStyle}>
        We reserve the right to update this Privacy Policy at any time. Changes will be reflected by updating the &ldquo;Last Updated&rdquo; date at the top of this document. Continued use of the Software following any changes constitutes acceptance of the revised Privacy Policy. We encourage you to review this Privacy Policy periodically.
      </p>

      <h2 style={h2Style}>9. Contact</h2>
      <p style={pStyle}>
        For questions, concerns, or requests related to this Privacy Policy, please contact:
      </p>
      <p style={pStyle}>
        <strong>Parallax</strong><br />
        Email: <a href="mailto:john@jroverton.com" style={{ color: '#2a6b5a' }}>john@jroverton.com</a>
      </p>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(26,29,35,0.08)', margin: '32px 0 16px' }} />
      <p style={{ fontSize: 14, fontStyle: 'italic', color: '#6b6d74' }}>
        By using Parallax, you acknowledge that you have read, understood, and agree to the practices described in this Privacy Policy.
      </p>
    </LegalPageLayout>
  );
}
