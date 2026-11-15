// Servidor SMTP de teste: registra o instante de recebimento de cada mensagem.
const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const out = process.argv[2];
const srv = new SMTPServer({
  authOptional: true, disabledCommands: ['STARTTLS'],
  onData(stream, session, cb) {
    simpleParser(stream).then((m) => {
      fs.appendFileSync(out, JSON.stringify({ t: Date.now(), to: m.to && m.to.text, subject: m.subject }) + '\n');
      cb();
    }).catch(cb);
  },
});
srv.listen(2525, '127.0.0.1', () => console.log('smtp sink on 2525'));
