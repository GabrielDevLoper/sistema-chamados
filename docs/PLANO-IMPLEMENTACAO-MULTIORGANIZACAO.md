# Plano de implementação — Sistema de filas multiorganização

> Implementação iniciada em 29 de julho de 2026. O acompanhamento do que já foi
> entregue e das evoluções restantes está em [STATUS-IMPLEMENTACAO.md](STATUS-IMPLEMENTACAO.md).
> A decisão de autenticação foi atualizada: o sistema usa login próprio com JWT,
> sem dependência da autenticação do ChatGPT.

## 1. Objetivo

Evoluir o sistema atual de filas para uma plataforma que possa atender cartórios,
clínicas, pet shops e outros estabelecimentos, mantendo os dados e a identidade
visual de cada organização isolados.

O primeiro produto será deliberadamente simples:

- administradores da plataforma cadastram e controlam as organizações;
- cada organização possui somente uma conta de acesso compartilhada;
- atendentes não possuem cadastro individual;
- visitantes que retiram senhas não precisam de conta;
- cada organização configura sua marca, serviços e guichês;
- cada organização acessa somente sua própria fila.

## 2. Decisões aprovadas

### 2.1 Perfis

Existem somente dois tipos de conta:

| Perfil | Responsabilidade |
| --- | --- |
| `platform_admin` | Cadastra, edita, ativa e suspende organizações |
| `organization` | Configura e opera somente a própria organização |

A organização utiliza a mesma conta em vários computadores. Cada computador
seleciona o seu guichê na tela de atendimento.

### 2.2 Estrutura do MVP

```text
Plataforma
└── Organização
    ├── Uma conta de acesso
    ├── Identidade visual
    ├── Serviços
    ├── Guichês
    └── Filas e senhas
```

Múltiplas unidades, contas individuais de atendentes e permissões internas não
fazem parte do MVP.

### 2.3 Decisão inicial de banco de dados

O MVP continuará usando Cloudflare D1.

O D1 atende funcionalmente às demandas aprovadas: organizações, autenticação,
serviços, guichês, sessões e senhas são dados relacionais simples. A API de
`batch()` permite executar alterações atômicas em sequência, e o D1 possui um
sistema oficial de migrations.

A decisão será reavaliada por métricas e necessidades reais. Se for necessária
uma migração, o banco recomendado será PostgreSQL.

## 3. Arquitetura de acesso

### 3.1 Rotas da plataforma

```text
/plataforma/login
/plataforma/organizacoes
/plataforma/organizacoes/nova
/plataforma/organizacoes/[id]
```

### 3.2 Rotas autenticadas da organização

```text
/login
/app
/app/atendimento
/app/guiches
/app/servicos
/app/identidade
/app/configuracoes
```

A organização deve ser obtida exclusivamente pela sessão autenticada. APIs
privadas não devem aceitar `organization_id` enviado pelo navegador como fonte
de autorização.

### 3.3 Rotas públicas

```text
/fila/[slug]/cliente
/fila/[slug]/painel
```

Exemplos:

```text
/fila/clinica-sao-lucas/cliente
/fila/clinica-sao-lucas/painel
/fila/petshop-amigao/cliente
/fila/petshop-amigao/painel
```

## 4. Modelo de dados planejado

Os nomes abaixo são conceituais. As migrations definirão os detalhes finais de
tipos, constraints e chaves estrangeiras.

### 4.1 `organizations`

```text
id
trade_name
slug
business_type
logo_key
primary_color
timezone
status
created_at
updated_at
```

Regras:

- `slug` único;
- `primary_color` normalizada como `#RRGGBB`;
- `status`: `pending`, `active` ou `suspended`;
- a logo fica no R2; o D1 armazena somente `logo_key`;
- fuso padrão inicial: `America/Maceio`.

### 4.2 `users`

```text
id
organization_id
name
email
password_hash ou provider_id
role
status
last_login_at
password_changed_at
created_at
updated_at
```

Regras:

- `email` único e normalizado;
- `role`: `platform_admin` ou `organization`;
- administrador possui `organization_id = null`;
- deve existir no máximo um usuário com perfil `organization` por organização;
- conta de organização suspensa não pode criar novas sessões.

### 4.3 `sessions`

```text
id
user_id
token_hash
device_label
last_seen_at
expires_at
revoked_at
created_at
```

Requisitos:

- permitir múltiplas sessões simultâneas;
- armazenar somente hash do token;
- permitir encerramento de uma sessão ou de todas;
- revogar sessões quando necessário após troca de senha;
- atualizar `last_seen_at` sem gerar escrita excessiva em toda requisição.

### 4.4 `account_tokens`

```text
id
user_id
purpose
token_hash
expires_at
used_at
created_at
```

Finalidades iniciais:

- ativação da conta;
- definição da primeira senha;
- recuperação de senha.

### 4.5 `services`

```text
id
organization_id
name
ticket_prefix
active
sort_order
created_at
updated_at
```

Regras:

- os serviços deixam de ser fixos no código;
- prefixo deve ser curto e validado;
- serviços desativados permanecem no histórico;
- nomes podem variar por segmento.

### 4.6 `desks`

```text
id
organization_id
name
number
active
created_at
updated_at
```

Regras:

- guichês passam a ser registros, não apenas uma quantidade;
- número único dentro da organização;
- guichê em atendimento não pode ser removido;
- guichê desativado permanece no histórico.

### 4.7 `ticket_sequences`

```text
organization_id
service_date
last_number
updated_at
```

Essa tabela substitui o uso de `COUNT(*) + 1`. A atualização da sequência deve
ser atômica para impedir senhas duplicadas em requisições simultâneas.

### 4.8 `tickets`

```text
id
organization_id
service_id
desk_id
code
sequence_number
priority
status
created_at
called_at
finished_at
```

Regras:

- toda senha pertence a uma organização;
- `service_id` identifica o serviço configurável;
- `desk_id` pode ser nulo até a chamada;
- códigos devem ser únicos por organização e data de atendimento;
- queries sempre filtram por `organization_id`;
- datas continuam armazenadas em UTC.

### 4.9 `organization_settings`

```text
organization_id
key
value
updated_at
```

A chave deve ser única dentro de cada organização.

### 4.10 `audit_logs`

```text
id
actor_user_id
organization_id
action
entity_type
entity_id
metadata
created_at
```

Como existe uma conta compartilhada, a auditoria identifica a organização ou o
administrador, mas não o atendente físico que realizou a ação.

## 5. Etapas de implementação

Cada etapa deve ser entregue com migrations, validações e testes próprios. Uma
etapa só começa após os critérios de aceite da anterior estarem aprovados.

## Etapa 0 — Preparação técnica

### Objetivo

Preparar o projeto para mudanças de banco seguras e versionadas.

### Implementação

- [ ] Substituir `CREATE TABLE IF NOT EXISTS` executado durante requisições por
      migrations versionadas;
- [ ] Centralizar o acesso ao banco em módulos de domínio/repositórios;
- [ ] Atualizar o schema do Drizzle para representar o banco real;
- [ ] Definir convenção de IDs, datas, nomes e status;
- [ ] Criar comandos documentados para migrations locais e remotas;
- [ ] Preparar banco local, banco de homologação e banco de produção separados;
- [ ] Criar backup antes da primeira migration de produção.

### Entregáveis

- diretório de migrations;
- schema Drizzle sincronizado;
- documentação de aplicação e rollback;
- testes básicos do banco.

### Critérios de aceite

- aplicação inicia sem criar tabelas durante requisições;
- banco vazio pode ser criado somente pelas migrations;
- migrations podem ser aplicadas em ambiente local e de homologação;
- dados existentes continuam disponíveis.

## Etapa 1 — Fundação multiorganização

### Objetivo

Isolar todos os dados operacionais por organização.

### Implementação

- [ ] Criar `organizations`;
- [ ] Criar uma organização padrão para os dados atuais;
- [ ] Adicionar `organization_id` a configurações e senhas;
- [ ] Criar `services`, `desks` e `ticket_sequences`;
- [ ] Migrar os serviços fixos atuais para registros no banco;
- [ ] Migrar a quantidade de guichês para registros de guichê;
- [ ] Relacionar senhas existentes à organização padrão;
- [ ] Criar chaves estrangeiras e índices compostos;
- [ ] Criar helper obrigatório para contexto da organização;
- [ ] Remover SQL que consulta dados sem organização.

### Índices mínimos

```text
organizations(slug)
services(organization_id, active, sort_order)
desks(organization_id, number)
tickets(organization_id, status, created_at)
tickets(organization_id, service_id, created_at)
ticket_sequences(organization_id, service_date)
```

### Critérios de aceite

- duas organizações podem ter serviços e guichês com os mesmos nomes;
- cada consulta retorna somente dados da organização selecionada;
- dados atuais aparecem na organização padrão;
- duas requisições simultâneas não geram o mesmo código de senha;
- testes automatizados falham se uma query perder o filtro da organização.

## Etapa 2 — Autenticação e sessões

### Objetivo

Criar acesso seguro para administradores e para a conta única da organização.

Decisão aplicada: JWT `HS256` em cookie `HttpOnly`, sessão revogável no D1 e
senhas protegidas com PBKDF2-HMAC-SHA256. O administrador define a senha inicial
ao cadastrar a conta da organização.

### Implementação

- [ ] Definir biblioteca ou provedor de autenticação compatível com Workers;
- [ ] Criar `users`, `sessions` e `account_tokens`;
- [ ] Implementar login e logout;
- [ ] Implementar ativação da primeira senha;
- [ ] Implementar recuperação de senha;
- [ ] Permitir múltiplas sessões para a conta da organização;
- [ ] Implementar encerramento de todas as sessões;
- [ ] Criar guards para páginas e APIs;
- [ ] Implementar autorização por `role`;
- [ ] Bloquear conta e sessões de organização suspensa;
- [ ] Remover dependência do cabeçalho especial do ChatGPT para usuários finais.

### Requisitos de segurança

- cookies `HttpOnly`, `Secure` e `SameSite` adequados;
- tokens aleatórios armazenados somente como hash;
- proteção CSRF para operações autenticadas;
- limitação de tentativas de login;
- mensagens que não revelem se um e-mail está cadastrado;
- expiração e rotação de sessão;
- senha nunca registrada em logs.

### Critérios de aceite

- administrador acessa somente a plataforma;
- conta da organização acessa somente a própria organização;
- uma organização possui no máximo uma conta;
- a mesma conta funciona simultaneamente em guichês diferentes;
- logout de todas as sessões invalida os dispositivos conectados;
- APIs protegidas retornam `401` ou `403` corretamente.

## Etapa 3 — Administração da plataforma

### Objetivo

Permitir que o administrador cadastre e gerencie organizações.

### Implementação

- [ ] Criar layout exclusivo da plataforma;
- [ ] Criar listagem com busca e filtro por status;
- [ ] Criar cadastro de organização;
- [ ] Validar disponibilidade do `slug`;
- [ ] Cadastrar nome fantasia, segmento, logo e cor primária;
- [ ] Cadastrar nome e e-mail da conta da organização;
- [ ] Gerar e enviar link de ativação;
- [ ] Editar organização;
- [ ] Ativar e suspender organização;
- [ ] Permitir reenvio de ativação e recuperação de acesso;
- [ ] Exibir último acesso e sessões ativas;
- [ ] Registrar alterações importantes em auditoria.

### Armazenamento da logo

- [ ] Habilitar binding R2;
- [ ] aceitar inicialmente PNG, JPEG e WebP;
- [ ] limitar tamanho e dimensões;
- [ ] validar conteúdo real, não apenas extensão;
- [ ] usar nome de objeto não previsível;
- [ ] remover logo antiga de forma segura após substituição.

### Critérios de aceite

- administrador cria uma organização completa;
- organização recebe ativação e define a senha;
- organização suspensa perde acesso sem perder dados;
- logo e cor ficam disponíveis para as telas públicas;
- administrador não precisa acessar diretamente o banco.

## Etapa 4 — Painel da organização

### Objetivo

Permitir que a conta compartilhada configure e opere a organização.

### Implementação

- [ ] Criar página inicial da organização;
- [ ] Criar tela de identidade visual;
- [ ] Criar CRUD de serviços;
- [ ] Criar CRUD de guichês;
- [ ] Criar tela de configurações da conta;
- [ ] Exibir sessões ativas;
- [ ] Permitir troca de senha;
- [ ] Permitir encerramento de todas as sessões;
- [ ] Bloquear exclusões que quebrariam o histórico.

### Critérios de aceite

- organização edita somente seus próprios dados;
- serviços e guichês desativados não aparecem em novas operações;
- histórico continua exibindo nomes antigos corretamente;
- alterações de marca aparecem nas telas da organização;
- troca de senha oferece opção de desconectar outros dispositivos.

## Etapa 5 — Operação da fila por organização

### Objetivo

Adaptar retirada, atendimento e painel para o contexto multiorganização.

### Implementação

- [ ] Criar rotas públicas baseadas no `slug`;
- [ ] Carregar serviços ativos da organização;
- [ ] Criar senha com sequência atômica;
- [ ] Adaptar chamadas, rechamadas e finalizações;
- [ ] Selecionar guichê no navegador do atendente;
- [ ] Persistir a seleção do guichê localmente após a hidratação;
- [ ] Detectar guichê desativado ou ocupado;
- [ ] Garantir que operações autenticadas usem a organização da sessão;
- [ ] Atualizar painel em tempo adequado;
- [ ] Tratar conflitos de chamadas simultâneas.

### Critérios de aceite

- organizações diferentes operam filas simultaneamente;
- nenhuma senha aparece no painel de outra organização;
- dois guichês não assumem a mesma senha;
- seleção do guichê sobrevive à atualização da página;
- tela pública funciona sem login;
- ações de atendimento exigem sessão da organização.

## Etapa 6 — Personalização visual

### Objetivo

Aplicar a identidade de cada organização sem duplicar componentes.

### Implementação

- [ ] Criar carregador central de branding;
- [ ] Aplicar nome fantasia e logo;
- [ ] Criar variáveis CSS derivadas da cor primária;
- [ ] Calcular cor de contraste acessível;
- [ ] Definir identidade padrão quando não houver logo;
- [ ] Personalizar metadados das páginas públicas;
- [ ] Evitar diferença de branding entre SSR e hidratação;
- [ ] validar contraste e legibilidade.

### Variáveis previstas

```css
--brand-primary
--brand-primary-contrast
--brand-primary-soft
--brand-primary-dark
```

### Critérios de aceite

- duas organizações abertas simultaneamente exibem marcas diferentes;
- texto permanece legível com todas as cores permitidas;
- branding do servidor e do navegador é idêntico;
- ausência de logo utiliza fallback consistente.

## Etapa 7 — Segurança, testes e observabilidade

### Objetivo

Preparar o MVP para uso real.

### Implementação

- [ ] Testes de isolamento entre organizações;
- [ ] Testes de autenticação e autorização;
- [ ] Testes de concorrência da sequência de senhas;
- [ ] Testes de suspensão e revogação de sessões;
- [ ] Rate limiting em login e criação pública de senhas;
- [ ] Validação de todos os payloads de API;
- [ ] Logs estruturados sem informações sensíveis;
- [ ] Métricas de latência, erros e uso do D1;
- [ ] Política de retenção de senhas antigas;
- [ ] Rotina testada de backup e recuperação;
- [ ] Revisão básica de LGPD.

### Critérios de aceite

- suíte automatizada cobre os fluxos críticos;
- tentativas conhecidas de acesso cruzado são bloqueadas;
- erros do D1 e falhas de autenticação podem ser monitorados;
- existe procedimento documentado de restauração;
- dados pessoais desnecessários não são coletados.

## Etapa 8 — Migração e lançamento

### Objetivo

Publicar a nova arquitetura sem perder os dados atuais.

### Implementação

- [ ] Criar ambiente de homologação;
- [ ] executar migration com cópia dos dados atuais;
- [ ] realizar testes manuais nas quatro telas;
- [ ] validar organização padrão;
- [ ] validar criação de uma segunda organização;
- [ ] aplicar migrations de produção;
- [ ] acompanhar erros e desempenho após publicação;
- [ ] manter plano de rollback para a primeira versão.

### Critérios de aceite

- dados atuais permanecem acessíveis;
- organização padrão funciona como antes;
- nova organização possui dados e branding isolados;
- administrador consegue suspender e reativar uma organização;
- nenhuma rota antiga crítica termina sem redirecionamento ou orientação.

## 6. Avaliação do banco de dados

## 6.1 Por que o D1 atende ao MVP

- já está integrado ao Worker e ao ambiente local;
- usa semântica SQLite adequada ao modelo relacional planejado;
- suporta foreign keys, índices, constraints e migrations;
- `batch()` executa statements sequencialmente e faz rollback do lote em caso de
  falha;
- o volume inicial de escrita do sistema de filas tende a ser pequeno;
- o custo operacional e a configuração são menores;
- Time Travel permite recuperação de versões recentes do banco;
- read replication pode aumentar a capacidade de leitura quando usada com a
  Sessions API.

## 6.2 Limites que precisam ser acompanhados

Segundo a documentação da Cloudflare consultada em julho de 2026:

- banco D1 pago: até 10 GB por banco;
- banco D1 gratuito: até 500 MB por banco;
- o limite de 10 GB por banco não pode ser aumentado;
- cada banco individual é single-threaded e processa queries uma por vez;
- excesso de concorrência é colocado em fila e pode resultar em erro de
  sobrecarga;
- cada statement tem limite de 30 segundos;
- réplicas de leitura não aumentam a capacidade de escrita;
- réplicas podem estar defasadas se a Sessions API não for usada corretamente.

Por isso, produção comercial deve utilizar plano pago, índices adequados,
queries curtas, política de retenção e monitoramento de latência e sobrecarga.

## 6.3 Estratégia D1 para o MVP

O MVP utilizará um banco compartilhado e `organization_id` em todas as tabelas
de negócio. Essa abordagem permite administração global simples e evita a
complexidade de provisionar um binding por organização.

Regras obrigatórias:

- queries privadas recebem a organização da sessão;
- queries públicas resolvem a organização por `slug` validado;
- índices começam por `organization_id` nos principais filtros;
- geração de sequência usa uma única operação atômica;
- onboarding que altera várias tabelas usa `batch()`;
- migrations substituem criação de schema em runtime;
- logo e outros arquivos ficam no R2;
- relatórios pesados não rodam junto ao fluxo crítico da fila;
- dados históricos seguem política de retenção ou arquivamento.

## 6.4 Gatilhos para migrar para PostgreSQL

A decisão deve ser revisada quando pelo menos um destes pontos surgir:

- crescimento contínuo em direção ao limite de armazenamento;
- erros de sobrecarga ou latência de escrita incompatível com o atendimento;
- muitas organizações escrevendo simultaneamente no mesmo banco;
- necessidade de relatórios analíticos complexos e frequentes;
- necessidade de transações interativas longas ou concorrência mais sofisticada;
- necessidade de Row-Level Security como proteção adicional de multi-tenancy;
- entrada de múltiplas unidades, faturamento, integrações e grande volume de
  histórico;
- exigência contratual de infraestrutura, auditoria ou recuperação não atendida
  pelo D1.

Métricas a acompanhar:

```text
tamanho do banco
queries lidas e escritas
latência p50, p95 e p99
erros de overload
tempo de geração de senha
tempo de chamada/finalização
crescimento mensal de tickets
```

## 6.5 Por que PostgreSQL seria a próxima escolha

Se os gatilhos forem atingidos, PostgreSQL é preferível porque oferece:

- concorrência de escrita mais robusta;
- transações e níveis de isolamento mais completos;
- Row-Level Security para reforçar o isolamento entre organizações;
- melhor base para relatórios e integrações complexas;
- ecossistema maduro para SaaS multi-tenant;
- opções gerenciadas compatíveis com Cloudflare Workers via Hyperdrive.

MySQL também é suportado pelo Hyperdrive e atenderia o domínio, mas não oferece
uma vantagem clara para este projeto. PostgreSQL possui recursos especialmente
úteis para multi-tenancy e é a recomendação em uma eventual migração.

## 6.6 Preparação para uma futura migração

Mesmo permanecendo no D1, o código deve evitar acoplamento desnecessário:

- usar Drizzle e migrations como fonte do schema;
- manter SQL em módulos de repositório, não em componentes ou rotas;
- evitar espalhar funções específicas do SQLite;
- usar IDs e constraints portáveis;
- separar regras de negócio da API do banco;
- criar testes de contrato para os repositórios;
- armazenar arquivos fora do banco;
- documentar queries críticas e índices.

## 7. Riscos aceitos no MVP

### Conta compartilhada

- não será possível identificar o funcionário físico responsável por uma ação;
- todos os atendentes poderão conhecer a senha da organização;
- desligamento de funcionário pode exigir troca de senha;
- todos terão acesso às configurações permitidas à organização.

Mitigações iniciais:

- permitir encerramento de todas as sessões;
- mostrar dispositivos/sessões recentes;
- permitir troca simples de senha;
- registrar guichê e sessão nas operações críticas;
- considerar PIN de configurações em uma versão futura.

### Banco compartilhado

- o isolamento depende de filtros corretos na aplicação;
- uma query sem `organization_id` pode expor dados de outra organização;
- todas as organizações compartilham a capacidade de escrita de um D1.

Mitigações iniciais:

- contexto de organização centralizado;
- repositórios obrigatórios;
- testes de isolamento em todas as APIs;
- índices compostos;
- monitoramento de uso e latência;
- plano de migração documentado.

## 8. Fora do MVP

- contas individuais de atendentes;
- permissões internas por funcionário;
- múltiplas unidades;
- histórico por funcionário;
- pagamentos e planos;
- domínio personalizado;
- WhatsApp;
- agendamento;
- aplicativo móvel;
- relatórios avançados;
- integração com sistemas externos.

## 9. Definição de concluído do MVP

O MVP estará concluído quando:

- administrador cadastra e ativa duas organizações;
- cada organização possui uma única conta com múltiplas sessões;
- cada organização configura nome, logo, cor, serviços e guichês;
- atendentes operam guichês diferentes usando a mesma conta;
- visitantes retiram senhas sem login;
- filas funcionam simultaneamente sem compartilhar dados;
- organização suspensa perde acesso sem perder histórico;
- dados antigos pertencem à organização padrão;
- migrations, backup, recuperação e monitoramento estão documentados;
- testes automatizados comprovam o isolamento entre organizações.

## 10. Ordem recomendada de execução

```text
Etapa 0 — Preparação técnica
    ↓
Etapa 1 — Fundação multiorganização
    ↓
Etapa 2 — Autenticação e sessões
    ↓
Etapa 3 — Administração da plataforma
    ↓
Etapa 4 — Painel da organização
    ↓
Etapa 5 — Operação da fila
    ↓
Etapa 6 — Personalização visual
    ↓
Etapa 7 — Segurança e observabilidade
    ↓
Etapa 8 — Migração e lançamento
```

## 11. Referências oficiais

- [Cloudflare D1 — visão geral](https://developers.cloudflare.com/d1/)
- [Cloudflare D1 — limites](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 — API e batch transacional](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cloudflare D1 — migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare D1 — read replication e consistência](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Cloudflare Hyperdrive — PostgreSQL e MySQL](https://developers.cloudflare.com/hyperdrive/)
- [PostgreSQL — Row-Level Security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL — isolamento de transações](https://www.postgresql.org/docs/18/transaction-iso.html)
