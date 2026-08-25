export type OperationalMissionPresentationInput = {
  authorizationActive: boolean;
  desiredState?: string | null;
  controlTerminal?: boolean;
  orchestratorState?: string | null;
  orchestratorTerminal?: boolean;
};

export type OperationalMissionPresentation = Readonly<{
  heading: string;
  description: string;
  terminal: boolean;
  state: string;
}>;

export function deriveOperationalMissionPresentation(
  input: OperationalMissionPresentationInput
): OperationalMissionPresentation;
