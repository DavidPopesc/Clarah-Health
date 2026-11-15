import Link from "next/link";
import { LegalPage, PROJECT_URL, type LegalSection } from "@/components/legal-page";

export const metadata = { title: "Terms of use · Clara" };

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Using Clara",
    body: (
      <p>
        By using Clara you agree to these terms and to the <Link href="/privacy">privacy policy</Link>. Clara is a prototype built for EmoryHacks 2026 and is
        offered for demonstration and education. If you don&apos;t agree, please don&apos;t use it.
      </p>
    ),
  },
  {
    id: "not-medical-advice",
    title: "Clara is not medical advice",
    body: (
      <>
        <p>
          Clara explains health information in plain language. It does not diagnose conditions, recommend treatment, or replace your doctor, nurse, or
          pharmacist. Clara is not a medical device.
        </p>
        <p>
          <strong>Never start, stop, or change a medicine or its dose because of something Clara says.</strong> Talk to your care team first, and always
          follow their advice over Clara&apos;s.
        </p>
      </>
    ),
  },
  {
    id: "emergencies",
    title: "Emergencies",
    body: (
      <p>
        Clara is not for emergencies. <strong>If you think you are having a medical emergency, call 911 now.</strong> If you are in crisis or thinking about
        harming yourself, call or text 988. Clara shows an urgent screen for some warning signs, but it can&apos;t recognize every emergency.
      </p>
    ),
  },
  {
    id: "ai-limits",
    title: "AI can make mistakes",
    body: (
      <>
        <p>
          Clara uses AI to write explanations, transcribe visits, and speak. AI can be wrong, leave things out, or mishear a recording, even when it sounds
          confident. Check anything important against your records and with your care team.
        </p>
        <p>
          Visit recaps repeat what was said at a visit; if a recap doesn&apos;t match what you remember, trust your care team. Medicine summaries in
          &ldquo;What is it?&rdquo; are general information, not advice for you.
        </p>
      </>
    ),
  },
  {
    id: "your-responsibilities",
    title: "Your responsibilities",
    body: (
      <ul>
        <li>Only link accounts and upload documents that belong to you, or that you are authorized to use.</li>
        <li>
          <strong>Care teams:</strong> record a visit only after the patient agrees, and follow the recording-consent laws where you are. Review the
          transcript before creating a recap.
        </li>
        <li>Don&apos;t misuse Clara, try to break its security, or use it to harm others.</li>
      </ul>
    ),
  },
  {
    id: "third-parties",
    title: "Linked services",
    body: (
      <p>
        Clara can connect to MyChart (Epic) and Fitbit with read-only access, and uses AI providers such as Google Gemini. Those services have their own
        terms, and Clara isn&apos;t responsible for them. You can disconnect linked accounts at any time from <Link href="/connections">Sources</Link>.
      </p>
    ),
  },
  {
    id: "as-is",
    title: "Provided as is",
    body: (
      <p>
        Clara is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, including accuracy, reliability, or fitness for
        a particular purpose. It may change, stop working, or be taken offline at any time.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the fullest extent the law allows, the people who built Clara are not liable for any harm or loss from using it or relying on it, including
        decisions about your health. Some places don&apos;t allow these limits, so they may not all apply to you.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        These terms may be updated; the date at the top of the page shows the latest version. Continuing to use Clara means you accept the updated terms.
        For questions, open an issue on the{" "}
        <a href={PROJECT_URL} target="_blank" rel="noreferrer">
          Clara project page
        </a>
        .
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      label="The rules"
      title="Terms of use"
      summary={
        <>
          <strong>In short:</strong> Clara helps you understand your health information, but it isn&apos;t a doctor and can make mistakes. Don&apos;t change
          your medicines because of it, check important things with your care team, and call 911 in an emergency.
        </>
      }
      sections={sections}
    />
  );
}
