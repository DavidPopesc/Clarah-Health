import Link from "next/link";
import { LegalPage, PROJECT_URL, type LegalSection } from "@/components/legal-page";

export const metadata = { title: "Privacy policy · Clarah Health" };

const sections: LegalSection[] = [
  {
    id: "what-clara-is",
    title: "What Clarah Health is",
    body: (
      <>
        <p>
          Clarah Health is a prototype health companion built for EmoryHacks 2026. It explains your health records, lab reports, and doctor&apos;s visits in plain
          language. This policy describes what information Clarah Health uses, where it goes, and the choices you have.
        </p>
        <p>
          Clarah Health is a demonstration project, not a licensed healthcare service. It has not been certified as HIPAA-compliant, and you should not rely on it
          to store or protect sensitive health information the way your clinic or insurer must.
        </p>
      </>
    ),
  },
  {
    id: "information-we-use",
    title: "Information Clarah Health uses",
    body: (
      <ul>
        <li>
          <strong>Your health record, if you link MyChart (Epic).</strong> With read-only access you approve, Clarah Health reads your profile, medications,
          conditions, and lab and vital-sign results. It cannot change your record.
        </li>
        <li>
          <strong>Wearable data, if you link Fitbit.</strong> Read-only access to heart rate, sleep, and activity for the last seven days.
        </li>
        <li>
          <strong>Demo data.</strong> If you link nothing, Clarah Health uses a made-up patient so you can try it.
        </li>
        <li>
          <strong>Questions you ask Clarah Health</strong> in Ask Clarah Health.
        </li>
        <li>
          <strong>Documents you upload</strong>, such as lab reports or visit summaries (PDF).
        </li>
        <li>
          <strong>Visit recordings and transcripts</strong> that your care team records with your consent, or types in.
        </li>
        <li>
          <strong>Settings</strong> such as Clarah Health&apos;s speaking speed and whether answers are read aloud.
        </li>
      </ul>
    ),
  },
  {
    id: "where-it-goes",
    title: "Where your information goes",
    body: (
      <>
        <ul>
          <li>
            <strong>To AI providers, with identifiers removed first.</strong> To answer questions, explain documents, and create visit recaps, Clarah Health sends the
            needed text to an AI service: Google Gemini first, and a backup provider if Gemini is unavailable. Before anything is sent, Clarah Health removes your
            name and medical record number and uses your age instead of your birth date. Removing identifiers from uploaded documents and transcripts is
            best-effort and may miss some.
          </li>
          <li>
            <strong>Visit recordings.</strong> Audio is sent to Google Gemini to be transcribed. Clarah Health doesn&apos;t keep the audio.
          </li>
          <li>
            <strong>Clarah Health&apos;s voice.</strong> When Clarah Health reads something aloud, that text is sent to Google Gemini to create the speech.
          </li>
          <li>
            <strong>Uploaded PDFs stay on your device.</strong> Your browser reads the text out of the file; only that text is sent, never the file itself.
          </li>
        </ul>
        <p>
          These providers handle data under their own terms and privacy policies, which may allow them to keep or review it for a period. Clarah Health does not
          sell your information or use it for advertising.
        </p>
      </>
    ),
  },
  {
    id: "storage",
    title: "What is stored, and where",
    body: (
      <ul>
        <li>
          <strong>On Clarah Health&apos;s server: nothing about your health.</strong> Questions, documents, and transcripts are processed and then discarded.
        </li>
        <li>
          <strong>In your browser:</strong> uploaded PDFs and their summaries, visit recaps, transcripts, the voice audio for recaps, and which next steps
          you&apos;ve ticked off, plus your voice settings. These stay on the device you used until you delete them.
        </li>
        <li>
          <strong>Sign-in cookies:</strong> if you link MyChart or Fitbit, Clarah Health keeps the access tokens in secure, httpOnly cookies on your device for up to
          seven days so it can read your data.
        </li>
        <li>
          <strong>Ask Clarah Health conversations</strong> are kept only while the page is open.
        </li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and tracking",
    body: (
      <p>
        Clarah Health uses cookies only to keep linked accounts connected and to complete secure sign-in. It doesn&apos;t use advertising cookies, analytics, or
        tracking pixels.
      </p>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <ul>
        <li>
          <strong>Disconnect accounts</strong> at any time from <Link href="/connections">Sources</Link>; this deletes the sign-in cookies.
        </li>
        <li>
          <strong>Delete documents and visit recaps</strong> with the Delete button on each one.
        </li>
        <li>
          <strong>Clear everything on a device</strong> by clearing this site&apos;s data in your browser settings.
        </li>
        <li>
          <strong>Turn off read-aloud</strong> in Ask Clarah Health so answers aren&apos;t sent for speech.
        </li>
      </ul>
    ),
  },
  {
    id: "recording",
    title: "Recording a visit",
    body: (
      <p>
        A care team member may record a visit only after the patient agrees, and must confirm that consent in Clarah Health before recording starts. Some places
        require everyone in a conversation to agree to be recorded; whoever records is responsible for following those laws.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Clarah Health uses encrypted connections, read-only access to linked accounts, and httpOnly cookies, and keeps health content off its own server. No
        system is perfectly secure, and as a prototype Clarah Health has not had an independent security review.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Clarah Health is meant for adults 18 and older and isn&apos;t designed for children.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        If this policy changes, the date at the top of the page will change too. For questions, open an issue on the{" "}
        <a href={PROJECT_URL} target="_blank" rel="noreferrer">
          Clarah Health project page
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      label="Your information"
      title="Privacy policy"
      summary={
        <>
          <strong>In short:</strong> Clarah Health keeps your health information on your own device, not on its server. To explain things, it sends the needed text to
          an AI service with your name and record number removed first. It never sells your data, has no ads or tracking, and you can disconnect or delete
          everything at any time.
        </>
      }
      sections={sections}
    />
  );
}
