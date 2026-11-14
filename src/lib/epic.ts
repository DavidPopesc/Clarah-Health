import type {
  BloodPressureReading,
  Condition,
  LabResult,
  Medication,
  PatientRecord,
} from "./types";

// Epic SMART on FHIR (R4), standalone patient launch with PKCE.
// Register an app at https://fhir.epic.com to get a non-production client ID.

export const epicConfig = {
  clientId: process.env.EPIC_CLIENT_ID,
  fhirBase:
    process.env.EPIC_FHIR_BASE ?? "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
  authorizeUrl:
    process.env.EPIC_AUTHORIZE_URL ??
    "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize",
  tokenUrl:
    process.env.EPIC_TOKEN_URL ?? "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
  scope:
    "openid fhirUser launch/patient patient/Patient.read patient/MedicationRequest.read patient/Condition.read patient/Observation.read",
};

export const epicEnabled = () => Boolean(epicConfig.clientId);

/* eslint-disable @typescript-eslint/no-explicit-any -- raw FHIR JSON */

async function fhirGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${epicConfig.fhirBase}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/fhir+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FHIR ${path} failed: ${res.status}`);
  return res.json();
}

function entries(bundle: any): any[] {
  return (bundle?.entry ?? [])
    .map((e: any) => e.resource)
    .filter((r: any) => r && r.resourceType !== "OperationOutcome");
}

function codeText(concept: any): string {
  return concept?.text ?? concept?.coding?.[0]?.display ?? "Unknown";
}

function hasLoinc(concept: any, code: string) {
  return (concept?.coding ?? []).some((c: any) => c.code === code);
}

const day = (s?: string) => (s ?? "").slice(0, 10);

export async function fetchEpicRecord(token: string, patientId: string): Promise<PatientRecord> {
  const [patient, meds, conditions, labs, vitals] = await Promise.all([
    fhirGet(`Patient/${patientId}`, token),
    fhirGet(`MedicationRequest?patient=${patientId}`, token),
    fhirGet(`Condition?patient=${patientId}&category=problem-list-item`, token),
    fhirGet(`Observation?patient=${patientId}&category=laboratory`, token),
    fhirGet(`Observation?patient=${patientId}&category=vital-signs`, token),
  ]);

  const name = patient.name?.[0];
  const givenName = name?.given?.[0] ?? "there";

  const medications: Medication[] = entries(meds).map((m) => ({
    name: m.medicationCodeableConcept
      ? codeText(m.medicationCodeableConcept)
      : (m.medicationReference?.display ?? "Unknown medication"),
    dosage: m.dosageInstruction?.[0]?.text ?? "",
    status: m.status === "active" ? "active" : "stopped",
  }));

  const conditionList: Condition[] = entries(conditions).map((c) => ({
    name: codeText(c.code),
    since: day(c.onsetDateTime ?? c.recordedDate) || undefined,
  }));

  const labResults: LabResult[] = entries(labs)
    .filter((o) => typeof o.valueQuantity?.value === "number")
    .map((o) => ({
      name: codeText(o.code),
      value: o.valueQuantity.value,
      unit: o.valueQuantity.unit ?? "",
      date: day(o.effectiveDateTime ?? o.issued),
    }));

  const bloodPressure: BloodPressureReading[] = entries(vitals)
    .filter((o) => hasLoinc(o.code, "85354-9") || o.component?.length)
    .map((o) => {
      const comp = (code: string) =>
        o.component?.find((c: any) => hasLoinc(c.code, code))?.valueQuantity?.value;
      return { systolic: comp("8480-6"), diastolic: comp("8462-4"), date: day(o.effectiveDateTime) };
    })
    .filter((r) => typeof r.systolic === "number" && typeof r.diastolic === "number");

  return {
    source: "epic",
    identity: {
      name: name?.text ?? [givenName, name?.family].filter(Boolean).join(" "),
      givenName,
      birthDate: patient.birthDate,
      mrn: patient.identifier?.[0]?.value,
    },
    sex: patient.gender,
    medications,
    conditions: conditionList,
    labs: labResults,
    bloodPressure,
  };
}
