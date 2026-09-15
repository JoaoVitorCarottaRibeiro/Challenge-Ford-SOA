# Integrantes

- Arthur Bueno de Oliveira - RM 558396
- João Vitor Carotta Ribeiro - RM 555187
- Victor Magdaleno Marcos - RM 556729

# Fordiq

Plataforma de Inteligência Competitiva Automotiva desenvolvida para o desafio da Ford, no contexto acadêmico da FIAP.

## Sobre o projeto

O Fordiq extrai, padroniza e compara especificações técnicas de picapes médias 4x4 de chassi em escada — o mesmo segmento da Ford Ranger Raptor. O objetivo é permitir que a Ford compreenda como seus veículos se posicionam frente à concorrência em termos de equipamentos e preço.

Dado uma entrada simples de marca, modelo e versão, o sistema retorna uma lista padronizada de especificações técnicas — sempre no mesmo formato, independentemente do veículo pesquisado — priorizando fontes reais e verificáveis (PDF oficial do fabricante ou busca ativa na web) sobre qualquer estimativa gerada por IA.

## Desafio

> Compreender o valor percebido pelo cliente em relação à concorrência exige dados precisos e extremamente organizados. O mercado automotivo atual demanda a rápida compreensão de como os veículos concorrentes se posicionam em termos de preço e pacotes de equipamentos oferecidos.

**Entradas obrigatórias:** Marca, Modelo e Versão
**Saída obrigatória:** Lista padronizada de especificações técnicas, com campos claros e comparáveis. Campos ausentes retornam `null`.
**Validação oficial do desafio:** a solução precisa entregar corretamente as especificações da Ford Ranger Raptor, batendo com a ficha técnica real dela.

## Segmento e catálogo

O produto cobre exclusivamente picapes médias 4x4 de chassi em escada — não é um comparador de carros em geral. Catálogo atual, todos com fonte real (PDF oficial do fabricante ou fontes públicas verificadas):

| Marca | Modelo | Versão |
|---|---|---|
| Ford | Ranger | Raptor |
| Toyota | Hilux | SRX |
| Volkswagen | Amarok | Highline V6 |
| Volkswagen | Amarok | Extreme |
| Volkswagen | Amarok | Comfortline |
| Chevrolet | S10 | High Country |
| Mitsubishi | L200 Triton | Katana |
| Nissan | Frontier | PRO-4X |
| Fiat | Titano | Ranch |
| BYD | Shark | GS |

Novos veículos do mesmo segmento (ex.: outras versões de Hilux, Amarok, S10, Triton, Frontier, Titano, Shark) podem ser adicionados via `/extract` — veja [Endpoints da API](#endpoints-da-api).

## Arquitetura

```
fordiq/
├── apps/
│   ├── api/          # Backend — Node.js + TypeScript + Fastify
│   ├── web/          # Frontend web — Next.js + Tailwind (a entrega principal do desafio)
│   └── mobile/       # Scaffold Expo/React Native, não faz parte da entrega atual
├── packages/
│   └── database/     # Entidades TypeORM + conexão Oracle, compartilhado entre api e web
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript |
| Backend | Node.js + Fastify |
| Web | Next.js 16 + Tailwind CSS |
| Banco de dados | Oracle Database (TypeORM, code first, modo Thin — sem Instant Client) |
| Autenticação | JWT (access + refresh) com bcrypt, RBAC (admin/analyst) |
| Agente de IA | Claude API (Anthropic), com busca web nativa quando não há PDF |
| Testes | Vitest, com `app.inject()` do Fastify contra um banco em memória |
| Documentação da API | OpenAPI/Swagger (`/docs`) |
| Gerenciador de pacotes | pnpm (monorepo) |

## Pré-requisitos

- Node.js 20+
- pnpm
- Credenciais do Oracle Database (fornecidas pela FIAP) — **não precisa instalar Oracle Instant Client**, o driver roda em modo Thin
- Chave da API da Anthropic

## Instalação

```bash
# Clone o repositório
git clone https://github.com/JoaoVitorCarottaRibeiro/Challenge-Ford.git
cd Challenge-Ford

# Instale as dependências
pnpm install
# Se travar em ERR_PNPM_IGNORED_BUILDS: pnpm approve-builds --all

# Configure as variáveis de ambiente (dois arquivos, um por app)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edite os dois com suas credenciais
```

## Variáveis de ambiente

`apps/api/.env` (veja `apps/api/.env.example` para a lista comentada completa):

```env
DB_HOST=
DB_PORT=1521
DB_USER=
DB_PASS=
DB_SERVICE=
ANTHROPIC_API_KEY=
HMAC_SECRET=          # precisa ser idêntico ao NEXT_PUBLIC_HMAC_SECRET do web
JWT_SECRET=
ENCRYPTION_KEY=       # criptografa o payload dos logs de auditoria
API_KEY=              # adminKey exigida em POST /auth/register
```

`apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3333/api
NEXT_PUBLIC_HMAC_SECRET=   # idêntico ao HMAC_SECRET da api
```

O banco Oracle é remoto e compartilhado entre todos os que rodam o projeto — o `ENCRYPTION_KEY` precisa ser **idêntico em todas as máquinas**, senão logs de auditoria já gravados ficam ilegíveis.

## Rodando o projeto

```bash
# API (porta 3333)
pnpm dev:api

# Web (porta 3000)
pnpm dev:web
```

Primeiro usuário: `POST /api/auth/login` exige uma conta já existente. Crie a primeira via `POST /api/auth/register`, passando `adminKey` igual ao `API_KEY` do `.env` — veja [Autenticação](#autenticação).

## Testes automatizados

```bash
pnpm test:api
```

Roda contra um banco em memória (nunca o Oracle real) usando `app.inject()` do Fastify — cobre autenticação, RBAC, JWT, validação de schema, HMAC e tratamento de erros, incluindo cenários de sucesso, erro e acesso não autorizado.

## Documentação interativa da API (Swagger)

Com a API rodando, acesse **http://localhost:3333/docs** — spec OpenAPI completa, com todas as rotas, schemas de entrada e os dois esquemas de segurança (Bearer JWT e assinatura HMAC). JSON puro da spec em `/docs/json`.

## Autenticação

Toda rota exige um **Bearer token JWT**, exceto `/health`, `/docs` e `POST /auth/login` / `/auth/refresh` / `/auth/register`. Há dois papéis (`admin` e `analyst`): cadastrar, remover ou extrair specs de veículo é restrito a `admin`; consultar o catálogo é liberado para os dois papéis.

```bash
# 1. Criar o primeiro usuário (adminKey = API_KEY do apps/api/.env)
curl -X POST http://localhost:3333/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ford.com","password":"SenhaForte123","role":"admin","adminKey":"SUA_API_KEY"}'

# 2. Login
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ford.com","password":"SenhaForte123"}'
# devolve { accessToken, refreshToken, role, expiresIn }
```

Rotas de escrita (`POST /vehicles`, `POST /extract`) exigem, além do Bearer token, um header `X-Signature: sha256=<hash>` — HMAC-SHA256 do corpo da requisição (`JSON.stringify(body)`) usando o `HMAC_SECRET` compartilhado. Login errado 5 vezes seguidas bloqueia a conta por 15 minutos.

## Endpoints da API

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | pública | Verifica se a API está no ar |
| POST | `/api/auth/login` | pública | Autentica e devolve tokens JWT |
| POST | `/api/auth/refresh` | pública | Troca um refresh token por um novo access token |
| POST | `/api/auth/register` | adminKey | Cria um novo usuário |
| GET | `/api/vehicles` | Bearer | Lista o catálogo |
| GET | `/api/vehicles/:id` | Bearer | Busca um veículo por id |
| DELETE | `/api/vehicles/:id` | Bearer + admin | Remove um veículo |
| POST | `/api/vehicles` | Bearer + admin + HMAC | Cadastra um veículo sem specs |
| POST | `/api/extract` | Bearer + admin + HMAC | Extrai e salva specs de um veículo |
| GET | `/api/admin/audit-logs` | Bearer + admin | Últimos 100 logs de auditoria |
| GET | `/api/admin/suspicious` | Bearer + admin | Resumo de eventos suspeitos na última hora |
| DELETE | `/api/admin/audit-logs/retention` | Bearer + admin | Aplica política de retenção nos logs |

Lista completa de parâmetros e schemas: `/docs`.

### Exemplo de uso — extração

```bash
curl -X POST http://localhost:3333/api/extract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Signature: sha256=$(echo -n '{"brand":"Ford","model":"Ranger","version":"Raptor","yearModel":2026}' | openssl dgst -sha256 -hmac "$HMAC_SECRET" | sed 's/^.* //')" \
  -d '{"brand":"Ford","model":"Ranger","version":"Raptor","yearModel":2026}'
```

### Upload de ficha técnica em PDF (qualquer concorrente)

O `/api/extract` aceita, opcionalmente, um PDF arbitrário como fonte — não depende de o veículo estar no mapa de fichas curadas. O PDF vai em base64, dentro do próprio corpo JSON já assinado por HMAC:

```json
{
  "brand": "Toyota",
  "model": "Hilux",
  "version": "GR Sport",
  "yearModel": 2025,
  "pdfBase64": "<base64 do PDF>",
  "pdfFileName": "ficha-concorrente.pdf"
}
```

Regras: PDF até 15MB, validado por assinatura de arquivo (`%PDF-`) e, antes de extrair, por uma checagem de que o conteúdo realmente é uma ficha técnica daquele veículo (rejeita documentos não relacionados). Salvo fora da pasta curada em `apps/api/pdfs/uploads/` (ignorada pelo git). Um envio de PDF força uma nova extração mesmo se já existir spec em cache, e o `source` retornado vem como `pdf_upload`.

### Sem PDF: busca ativa na web

Quando nenhum PDF está disponível (nem curado, nem enviado), o `/extract` busca ativamente fontes oficiais na web (site do fabricante, ou fontes públicas verificadas) antes de recorrer a qualquer geração por IA — o preço, em particular, sempre passa por uma busca ativa versionada antes de ser aceito, para evitar contaminação entre versões/trims.

### Seleção livre de categorias/atributos técnicos

O `/api/extract` aceita um campo opcional `categories` (array de strings) com o subconjunto das categorias de especificações que devem ser pesquisadas:

```json
{
  "brand": "Ford",
  "model": "Ranger",
  "version": "Raptor",
  "yearModel": 2026,
  "categories": ["Segurança", "ADAS e Assistência ao Motorista", "Iluminação"]
}
```

Nomes devem bater exatamente com as categorias de `SPEC_CATEGORIES` (ex.: "Motor e Transmissão", "Rodas e Pneus", "Conectividade e Multimídia", "Conforto, Ar-condicionado e Acabamento", "Segurança", "ADAS e Assistência ao Motorista", "Iluminação", "4x4 e Off-road", "Utilidade e Garantia"); ausente ou vazio pesquisa tudo (comportamento padrão, mantém cache); com categorias restritas, o Claude só é chamado para essas categorias e, se já existir spec salva, apenas os campos pesquisados nesta rodada são atualizados.

## Banco de dados

O projeto utiliza Oracle Database com TypeORM em modo **code first** — as tabelas são geradas automaticamente a partir das entidades TypeScript ao subir a aplicação (`synchronize: true` em desenvolvimento).

### Tabelas geradas

- `segments` — segmentos de mercado (ex: pickup_midsize_4x4)
- `vehicles` — cadastro de veículos (marca, modelo, versão)
- `vehicle_specs` — especificações técnicas padronizadas
- `users` — contas de acesso (email, hash da senha, papel, tentativas de login)
- `audit_logs` — trilha de auditoria (login, acessos negados, ações administrativas), com payload criptografado

## Validação do desafio

```bash
# 1. Suba a API
pnpm dev:api

# 2. Crie um usuário admin e faça login (veja Autenticação acima)

# 3. Extraia a Ranger Raptor, autenticado
curl -X POST http://localhost:3333/api/extract \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Signature: sha256=..." \
  -d '{"brand":"Ford","model":"Ranger","version":"Raptor","yearModel":2026}'

# 4. Compare com os concorrentes no catálogo
curl http://localhost:3333/api/vehicles -H "Authorization: Bearer $ACCESS_TOKEN"
```

Critérios atendidos:
- Entrada livre de marca + modelo + versão
- Saída sempre no mesmo formato padronizado
- Campos ausentes retornam `null` explicitamente
- Dados claros, organizados e comparáveis, com fonte rastreável
- Validação com Ford Ranger Raptor
