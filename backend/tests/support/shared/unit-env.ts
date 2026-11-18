// Chave de cifra de teste para os testes de unidade (os mappers calculam os índices cegos, que
// derivam de DATA_ENCRYPTION_KEY). Valor fixo e sem relação com nenhum ambiente real.
process.env.DATA_ENCRYPTION_KEY ??= 'b'.repeat(64);
