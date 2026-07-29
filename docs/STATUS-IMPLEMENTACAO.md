# Status da implementação multiorganização

Atualizado em 29 de julho de 2026.

## Implementado

- migrations versionadas e remoção de criação de tabelas durante requisições;
- organização padrão e migração dos dados existentes;
- isolamento de organizações, serviços, guichês, sequências e senhas;
- sequência de senha atômica por organização e data;
- autenticação própria com JWT, PBKDF2, cookie seguro e sessões revogáveis;
- configuração única do primeiro administrador;
- cadastro, edição, ativação e suspensão de organizações;
- uma conta de acesso por organização, com senha inicial definida pelo admin;
- encerramento de sessões ao suspender a organização ou trocar a senha;
- painel da organização para serviços, guichês, identidade, conta e operação;
- cadastro de setores com relacionamento entre setores e serviços;
- vínculo obrigatório de cada guichê a um setor;
- chamada atômica limitada aos serviços permitidos no setor do guichê;
- exclusão protegida de serviços, guichês e setores com preservação do histórico;
- migração automática dos guichês e serviços existentes para Atendimento Geral;
- rotas públicas por `slug`;
- nome, cor, fuso e logo específicos por organização;
- armazenamento de logos no R2 com validação de tipo, tamanho e dimensões;
- persistência local da escolha de guichê após a hidratação;
- auditoria das alterações de organização;
- testes estáticos de arquitetura, segurança, setores e hidratação, além do build.

## Próximas evoluções

- recuperação de senha por e-mail e tokens de conta;
- busca e filtros avançados na administração da plataforma;
- limitação distribuída de requisições nas rotas públicas;
- métricas operacionais e alertas;
- testes de concorrência e integração executados contra ambiente de homologação;
- política de retenção e limpeza de logs e sessões expiradas.

## Ativação em um ambiente novo

1. Vincular D1 como `DB` e R2 como `R2`.
2. Definir `JWT_SECRET` e `ADMIN_SETUP_TOKEN` como segredos do ambiente.
3. Publicar o build para aplicar as migrations.
4. Abrir `/configurar-administrador` e criar o primeiro administrador.
5. Remover `ADMIN_SETUP_TOKEN` do ambiente após a configuração inicial.
