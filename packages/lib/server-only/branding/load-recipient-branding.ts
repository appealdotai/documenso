import { IS_BILLING_ENABLED } from '../../constants/app';
import type { TCssVarsSchema } from '../../types/css-vars';
import { ZCssVarsSchema } from '../../types/css-vars';
import {
  hasSigningFieldHighlightOverrides,
  resolveSigningFieldHighlightColors,
} from '../../utils/signing-field-highlight-colors';
import { getOrganisationClaimByTeamId } from '../organisation/get-organisation-claims';
import { getTeamSettings } from '../team/get-team-settings';

export type RecipientBrandingPayload = {
  allowCustomBranding: boolean;
  hidePoweredBy: boolean;
  recipientForceLightMode: boolean;
  colors: TCssVarsSchema | null;
  css: string | null;
};

/**
 * Resolve the branding payload for a recipient-facing route, given the team
 * the envelope/document belongs to. Reads inherited team-or-org branding settings,
 * checks the org's claim flags, and returns a payload safe to send to the client.
 *
 * Returns a minimal disabled payload if the team is not on a plan that allows
 * custom branding.
 */
export const loadRecipientBrandingByTeamId = async ({
  teamId,
}: {
  teamId: number;
}): Promise<RecipientBrandingPayload> => {
  const billingEnabled = IS_BILLING_ENABLED();

  const [settings, claim] = await Promise.all([
    getTeamSettings({ teamId }),
    billingEnabled ? getOrganisationClaimByTeamId({ teamId }).catch(() => null) : Promise.resolve(null),
  ]);

  let allowCustomBranding = !billingEnabled || claim?.flags?.embedSigningWhiteLabel === true;
  const hidePoweredBy = !billingEnabled || claim?.flags?.hidePoweredBy === true;

  if (!settings.brandingEnabled) {
    allowCustomBranding = false;
  }

  const parsedColors = settings.brandingColors ? ZCssVarsSchema.safeParse(settings.brandingColors) : null;
  const savedColors = parsedColors?.success ? parsedColors.data : null;
  const fieldHighlightColors = resolveSigningFieldHighlightColors(savedColors);

  const mergedColors: TCssVarsSchema = {
    ...(allowCustomBranding && savedColors ? savedColors : {}),
    ...fieldHighlightColors,
  };

  return {
    allowCustomBranding: allowCustomBranding || hasSigningFieldHighlightOverrides(savedColors),
    hidePoweredBy,
    recipientForceLightMode: settings.recipientForceLightMode,
    colors: mergedColors,
    css: allowCustomBranding && settings.brandingCss && settings.brandingCss.length > 0 ? settings.brandingCss : null,
  };
};
