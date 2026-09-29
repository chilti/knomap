import * as React from 'react';

export interface EcosystemApp {
  id: string;
  name: string;
  shortName: string;
  tagline: {
    es: string;
    pt: string;
    en: string;
  };
  badge: string;
  badgeColor: string;
  path: string;
  devUrl: string;
  prodUrl: string;
  icon: string;
  accentColor: string;
  glowColor: string;
  activeBorder: string;
}

export interface TlachiaSuiteBarProps {
  currentApp?: 'sinapsisai' | 'revistaslatam' | 'knomap' | 'tlachia_metrics' | string;
  lang?: 'es' | 'pt' | 'en' | string;
  isDev?: boolean;
  onNavigate?: (app: EcosystemApp) => boolean | void;
}

export declare const TlachiaSuiteBar: React.FC<TlachiaSuiteBarProps>;
export declare const ECOSYSTEM_APPS: EcosystemApp[];
export declare const SUITE_I18N: Record<string, Record<string, string>>;
export default TlachiaSuiteBar;
