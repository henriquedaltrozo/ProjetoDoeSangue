import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordHasher } from '../../application/ports/password-hasher.port';

const SALT_ROUNDS = 10;
/** Hash válido de uma senha qualquer: usado só para igualar o tempo de resposta quando o e-mail não existe. */
const FAKE_HASH = bcrypt.hashSync('password-nonexistent', SALT_ROUNDS);

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  verify(password: string, hash: string | null): Promise<boolean> {
    return bcrypt.compare(password, hash ?? FAKE_HASH);
  }
}
