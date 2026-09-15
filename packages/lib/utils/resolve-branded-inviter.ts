type BrandingInviterSettings = {
  brandingEnabled?: boolean | null;
  brandingName?: string | null;
  brandingEmail?: string | null;
};

type ResolveBrandedInviterOptions = {
  settings?: BrandingInviterSettings | null;
  fallbackName?: string | null;
  fallbackEmail: string;
};

/**
 * Resolve the inviter name/email shown in recipient emails.
 * When branding is enabled and a branded value is set, prefer that over the real user.
 */
export const resolveBrandedInviter = ({ settings, fallbackName, fallbackEmail }: ResolveBrandedInviterOptions) => {
  const inviterName =
    settings?.brandingEnabled && settings.brandingName ? settings.brandingName : fallbackName || undefined;

  const inviterEmail = settings?.brandingEnabled && settings.brandingEmail ? settings.brandingEmail : fallbackEmail;

  return {
    inviterName,
    inviterEmail,
  };
};
