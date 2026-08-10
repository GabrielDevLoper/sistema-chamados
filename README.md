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

Antes de iniciar o servidor, o projeto aplica automaticamente as migrations no
D1 local. Bancos locais criados antes do versionamento de migrations são
reconhecidos e preservados. Para executar somente essa atualização, use:

```bash
npm run db:migrate:local
```

Na primeira instalação, acesse `/configurar-administrador`, informe o valor de
`ADMIN_SETUP_TOKEN` e crie o administrador. Esse cadastro só funciona enquanto
não existir nenhum usuário com o perfil `platform_admin`.

Para desenvolvimento, também existe um seed idempotente com a conta
`adm@gmail.com` e senha `123456`:

```bash
npm run db:seed:admin
```

Essa credencial curta é somente local e o arquivo de seed não é incluído nas
migrations automáticas de produção.

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

Para aplicar somente as migrations pendentes no D1 de produção configurado em
`wrangler.jsonc`, autentique o Wrangler na conta correta da Cloudflare e execute:

```bash
npm run db:migrate:remote
```

## Publicação direta na Cloudflare

O Worker de produção está configurado em `wrangler.jsonc` com os bindings:

- `DB`: banco D1 `sistema-chamados-prod`;
- `R2`: bucket `sistema-chamados-logos-prod`;
- `IMAGES`: transformação de imagens do Worker.

Ao importar o repositório no Cloudflare Workers Builds, use a branch `main`, o
comando de build `npm run build` e o comando de deploy `npx wrangler deploy`.
O nome do Worker no painel deve ser `sistema-chamados`.

Depois de criar o Worker, cadastre `JWT_SECRET` e `ADMIN_SETUP_TOKEN` como
Secrets em **Settings > Variables and Secrets**. Aplique as migrations remotas
antes do primeiro acesso. Após criar o administrador em
`/configurar-administrador`, remova `ADMIN_SETUP_TOKEN` e publique novamente.

Também é possível publicar manualmente, depois de autenticar o Wrangler:

```bash
npm run deploy:cloudflare
```

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
- sessão persistente sem expiração automática, com renovação periódica do cookie
  enquanto o sistema estiver em uso;
- senha protegida com PBKDF2-HMAC-SHA256, salt aleatório e 100.000 iterações,
  compatível com o WebCrypto do Cloudflare Workers;
- sessões persistidas por hash e revogáveis no D1;
- bloqueio temporário após tentativas repetidas;
- organização sempre derivada da sessão nas APIs privadas;
- logos validadas e armazenadas no R2.

## Controles do terminal Windows

A tela pública de retirada de senha possui controles protegidos por PIN para
fechar apenas o Chrome vertical ou desligar o computador. Como páginas web não
podem executar comandos do Windows diretamente, o computador do totem precisa
do controlador local incluído em `scripts/windows`.

No computador Windows, mantenha os dois arquivos de instalação na mesma pasta
e execute o PowerShell como o usuário do terminal:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\install-kiosk-controller.ps1
```

O instalador copia o controlador para o perfil local do Windows, inicia o
processo e adiciona sua inicialização automática. O PIN configurado é `123456`.
Para que **Fechar terminal** encerre somente a tela vertical, o atalho do Chrome
deve continuar usando um `--user-data-dir` cujo nome contenha `RetiradaSenha`.

Para remover o controlador:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\uninstall-kiosk-controller.ps1
```
