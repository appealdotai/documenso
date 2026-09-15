import { isBase64Image } from '@documenso/lib/constants/signatures';
import { createContext, useContext, useMemo, useState } from 'react';

export type DocumentSigningContextValue = {
  fullName: string;
  setFullName: (_value: string) => void;
  email: string;
  setEmail: (_value: string) => void;
  signature: string | null;
  setSignature: (_value: string | null) => void;
  profileSignature: string | null;
  hasCompletedSignatureActionAuth: boolean;
  markSignatureActionAuthCompleted: () => void;
};

const DocumentSigningContext = createContext<DocumentSigningContextValue | null>(null);

export const useDocumentSigningContext = () => {
  return useContext(DocumentSigningContext);
};

export const useRequiredDocumentSigningContext = () => {
  const context = useDocumentSigningContext();

  if (!context) {
    throw new Error('Signing context is required');
  }

  return context;
};

export interface DocumentSigningProviderProps {
  fullName?: string | null;
  email?: string | null;
  signature?: string | null;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
  children: React.ReactNode;
}

export const DocumentSigningProvider = ({
  fullName: initialFullName,
  email: initialEmail,
  signature: initialSignature,
  typedSignatureEnabled = true,
  uploadSignatureEnabled = true,
  drawSignatureEnabled = true,
  children,
}: DocumentSigningProviderProps) => {
  const [fullName, setFullName] = useState(initialFullName || '');
  const [email, setEmail] = useState(initialEmail || '');
  const [hasCompletedSignatureActionAuth, setHasCompletedSignatureActionAuth] = useState(false);

  const profileSignature = useMemo(() => {
    const sig = initialSignature || '';
    const isBase64 = isBase64Image(sig);

    if (isBase64 && (uploadSignatureEnabled || drawSignatureEnabled)) {
      return sig;
    }

    if (!isBase64 && sig && typedSignatureEnabled) {
      return sig;
    }

    return null;
  }, [drawSignatureEnabled, initialSignature, typedSignatureEnabled, uploadSignatureEnabled]);

  const [signature, setSignature] = useState(profileSignature);

  const markSignatureActionAuthCompleted = () => {
    setHasCompletedSignatureActionAuth(true);
  };

  return (
    <DocumentSigningContext.Provider
      value={{
        fullName,
        setFullName,
        email,
        setEmail,
        signature,
        setSignature,
        profileSignature,
        hasCompletedSignatureActionAuth,
        markSignatureActionAuthCompleted,
      }}
    >
      {children}
    </DocumentSigningContext.Provider>
  );
};

DocumentSigningProvider.displayName = 'DocumentSigningProvider';
