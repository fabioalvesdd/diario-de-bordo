# Diário de Bordo • Operação 2D

Projeto em Next.js com formulário de diário de bordo, histórico local e sincronização com Notion por rota server-side.

## 1) Instalação

```bash
npm install
```

## 2) Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
NOTION_TOKEN=seu_token
NOTION_DATABASE_ID=seu_database_id
```

## 3) Estrutura necessária no Notion

Crie uma database com estas propriedades exatamente com estes nomes:

- `Diário de Bordo` → Title
- `Data` → Date
- `Hora` → Rich text
- `Responsável` → Select
- `Colaboradores presentes` → Multi-select
- `Relato do dia` → Rich text
- `Faturamento Delivery` → Number
- `Faturamento Salão` → Number
- `Faturamento Total` → Number
- `Criado em` → Date

Também compartilhe essa database com a integração interna do Notion que gerou o token.

## 4) Rodar localmente

```bash
npm run dev
```

## 5) Publicar na Vercel

- Importe o repositório na Vercel
- Adicione as variáveis `NOTION_TOKEN` e `NOTION_DATABASE_ID`
- Faça o deploy

## Observações

- O formulário salva localmente no navegador mesmo se o Notion falhar.
- A rota `app/api/notion-diario/route.ts` é a responsável por criar a página dentro da database.
