import { InitialSchema1759400000000 } from './1759400000000-initial-schema';
import { DropDuplicateEmailIndex1762700000000 } from './1762700000000-drop-duplicate-email-index';
import { AccountNotices1762800000000 } from './1762800000000-account-notices';
import { EmailVerification1763000000000 } from './1763000000000-email-verification';
import { EncryptUserIdentity1763100000000 } from './1763100000000-encrypt-user-identity';

export const MIGRATIONS = [
  InitialSchema1759400000000,
  DropDuplicateEmailIndex1762700000000,
  AccountNotices1762800000000,
  EmailVerification1763000000000,
  EncryptUserIdentity1763100000000,
];
