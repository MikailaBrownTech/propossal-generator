// Fixed, controlled vocabulary for client profile fields. Extraction is
// only ever allowed to populate these -- keeps client_profiles.data
// consistent across every client and every source document, and keeps the
// review screen's layout predictable.
export const PROFILE_FIELDS = [
  "firm_type",
  "staff_count",
  "consumer_count_band",
  "states",
  "systems",
  "remote_work",
  "devices",
  "current_security_posture",
  "concerns",
] as const;

export type ProfileFieldName = (typeof PROFILE_FIELDS)[number];

export const PROFILE_FIELD_LABELS: Record<ProfileFieldName, string> = {
  firm_type: "Firm type",
  staff_count: "Staff count",
  consumer_count_band: "Consumer count (band)",
  states: "States",
  systems: "Systems in use",
  remote_work: "Remote work",
  devices: "Devices",
  current_security_posture: "Current security posture",
  concerns: "Concerns raised",
};
