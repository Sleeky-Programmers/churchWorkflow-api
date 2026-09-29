export class UpdatePastoralSettingsDto {
  needsFollowUpThreshold?: number;
  atRiskThreshold?: number;
  inactiveThreshold?: number;
  trackingMode?: 'SUNDAYS_ONLY' | 'SUNDAYS_MIDWEEK' | 'ALL_SERVICES';
  countSpecialEvents?: boolean;
  countSmallTeams?: boolean;
}

export class AddPastoralNoteDto {
  body: string;
}
