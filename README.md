# Sistema de filas multiorganização

Plataforma de senhas para cartórios, clínicas, pet shops e outros estabelecimentos.
Cada organização possui uma única conta, identidade visual, serviços, guichês e
fila isolada.

## Rotas principais

- `/login`: acesso do administrador da plataforma e das organizações;
- `/plataforma/organizacoes`: cadastro e gestão dos clientes;
- `/app`: painel da organização;
- `/fila/[slug]/cliente`: retirada pública de senha;
- `/fila/[slug]/painel`: painel público de chamadas;
- `/configurar-administrador`: criação única do primeiro administrador.

O plano completo está em
[docs/PLANO-IMPLEMENTACAO-MULTIORGANIZACAO.md](docs/PLANO-IMPLEMENTACAO-MULTIORGANIZACAO.md).

## Pré-requisitos

- Node.js `22.13.0` ou superior;
- npm;
- bindings Cloudflare D1 `DB` e R2 `R2`.

## Configuração local

```bash
npm install
cp .dev.vars.example .dev.vars
```

Edite `.dev.vars` e use valores aleatórios diferentes, com no mínimo 32
caracteres para `JWT_SECRET`. O arquivo é ignorado pelo Git.

```dotenv
JWT_SECRET=segredo-aleatorio-com-pelo-menos-32-caracteres
ADMIN_SETUP_TOKEN=codigo-temporario-para-o-primeiro-administrador
```

Execute:

```bash
npm run dev
```

Na primeira instalação, acesse `/configurar-administrador`, informe o valor de
`ADMIN_SETUP_TOKEN` e crie o administrador. Esse cadastro só funciona enquanto
não existir nenhum usuário com o perfil `platform_admin`.

## Banco e migrations

O schema fica em `db/schema.ts` e as migrations versionadas ficam em `drizzle/`.
A aplicação não cria nem altera tabelas durante requisições.

```bash
npm run db:generate
```

O build do Sites inclui `.openai/hosting.json` e o diretório `drizzle/`; a
publicação aplica as migrations ao D1 vinculado. Antes da primeira aplicação em
produção, faça um backup do D1. Migrations já aplicadas não devem ser editadas;
uma correção deve ser feita em uma migration posterior.

## Validação

```bash
npm run lint
npm run build
npm test
```

O D1 e o R2 locais ficam sob `.wrangler/` e não são versionados. Os dados locais
são separados dos dados publicados.

## Segurança

- JWT assinado com `HS256` e segredo exclusivo do ambiente;
- cookie de sessão `HttpOnly`, `SameSite=Strict` e `Secure` em HTTPS;
- senha protegida com PBKDF2-HMAC-SHA256, salt aleatório e 600.000 iterações;
- sessões persistidas por hash e revogáveis no D1;
- bloqueio temporário após tentativas repetidas;
- organização sempre derivada da sessão nas APIs privadas;
- logos validadas e armazenadas no R2.
