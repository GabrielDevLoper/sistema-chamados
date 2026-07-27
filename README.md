# Fila Alta Serra

Sistema de senhas para cartório com três telas integradas:

- `/cliente`: totem para retirada de senha;
- `/atendente`: controle da fila e dos guichês;
- `/painel`: painel de chamadas para a TV.

## Pré-requisito

Instale o **Node.js 22 LTS** ou uma versão igual ou superior a `22.13.0`.

No Windows, uma opção é abrir o PowerShell como administrador e executar:

```powershell
winget install OpenJS.NodeJS.LTS
```

Feche e abra novamente o PowerShell depois da instalação. Confirme:

```powershell
node --version
npm --version
```

## Executar localmente

Abra o PowerShell na pasta do projeto:

```powershell
cd "D:\GABRIEL\Projetos\sistema-chamados"
npm install
npm run dev
```

Depois, abra:

- Cliente: `http://localhost:3000/cliente`
- Atendente: `http://localhost:3000/atendente`
- Painel da TV: `http://localhost:3000/painel`

Para encerrar o servidor, pressione `Ctrl + C`.

## Outros comandos

```powershell
npm run build
npm test
npm run db:generate
```

O desenvolvimento local usa um banco D1 simulado e armazenado na pasta
`.wrangler`. Os dados locais são separados dos dados da versão publicada.
