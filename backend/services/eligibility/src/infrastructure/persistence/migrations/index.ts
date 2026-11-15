import { InitialSchema1759400000000 } from './1759400000000-initial-schema';
import { AssessmentOriginPostDonation1761700000000 } from './1761700000000-assessment-origin-post-donation';
import { DonorDonationHistory1761800000000 } from './1761800000000-donor-donation-history';
import { DonorDeclarations1761900000000 } from './1761900000000-donor-declarations';
import { DonorVersionAuditSearch1762000000000 } from './1762000000000-donor-version-audit-search';
import { ReencryptBloodType1762100000000 } from './1762100000000-reencrypt-blood-type';
import { HealthConsentDropHeight1762200000000 } from './1762200000000-health-consent-drop-height';
import { DonorPhoneOptional1762300000000 } from './1762300000000-donor-phone-optional';
import { DropDonorQueryAssessments1762400000000 } from './1762400000000-drop-donor-query-assessments';
import { DropDuplicateDonorIndexes1762700000000 } from './1762700000000-drop-duplicate-donor-indexes';
import { DonorReceiveAlerts1762800000000 } from './1762800000000-donor-receive-alerts';
import { DonorEmailVerified1763000000000 } from './1763000000000-donor-email-verified';

export const MIGRATIONS = [
  InitialSchema1759400000000,
  AssessmentOriginPostDonation1761700000000,
  DonorDonationHistory1761800000000,
  DonorDeclarations1761900000000,
  DonorVersionAuditSearch1762000000000,
  ReencryptBloodType1762100000000,
  HealthConsentDropHeight1762200000000,
  DonorPhoneOptional1762300000000,
  DropDonorQueryAssessments1762400000000,
  DropDuplicateDonorIndexes1762700000000,
  DonorReceiveAlerts1762800000000,
  DonorEmailVerified1763000000000,
];
