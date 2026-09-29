/**
 * frontend/src/components/SuiteBar.tsx
 * Envoltura de la Franja del Ecosistema Científico TlachIA
 */

import React from 'react';
import { TlachiaSuiteBar } from '@tlachia/ecosystem-bar';

export const SuiteBar: React.FC = () => {
  return <TlachiaSuiteBar currentApp="knomap" lang="es" />;
};

export default SuiteBar;
