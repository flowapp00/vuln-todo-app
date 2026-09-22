# GABARITO — Falhas plantadas de propósito

> Este arquivo é **só o seu gabarito** para conferir a ferramenta de análise.
> Ele **não faz parte do app** e não deveria existir num projeto real.
> App-alvo intencionalmente inseguro, para rodar **apenas localmente** em repositório privado.

Total: **8 falhas plantadas**, todas embutidas de forma realista (sem comentários entregando a posição).

---

## 1. Chave de API secreta exposta no front-end

- **Arquivo / linha:** `client/src/config.js:3`
  ```js
  export const ANALYTICS_API_KEY = "sk-test-1234567890abcdef";
  ```
  (também usada em `client/src/api.js`, no header `x-api-key`)
- **O que um atacante consegue:** todo o código do front-end é baixado pelo navegador de qualquer visitante. Basta abrir o "Ver código-fonte" / DevTools, ou o bundle gerado pelo `vite build`, para ler a chave. Com ela, o atacante usa o serviço pago/privado como se fosse você (gastando sua cota, acessando dados).
- **Correção:** segredos **nunca** ficam no front-end. A chave deve morar só no back-end (variável de ambiente do servidor). O front chama o **seu** back-end, e é o back-end quem usa a chave ao falar com o serviço externo. Se a chave já vazou, ela precisa ser **revogada e trocada** — não adianta só apagar do código, porque ela pode estar no histórico do Git.

---

## 2. Arquivo `.env` com segredos versionado (fora do `.gitignore`)

- **Arquivo / linha:** `server/.env` (todo o arquivo), com destaque para:
  - `server/.env:6` → `DB_PASSWORD=Tr0ub4dor&3-prod`
  - `server/.env:9` → `JWT_SECRET=s3cr3t-jwt-key-todo-app-2024`
  - O `.gitignore` na raiz **não** lista `.env`, então ele vai para o repositório.
- **O que um atacante consegue:** quem tiver acesso ao repositório (ou se ele virar público por engano) lê a senha do banco e o segredo do JWT. Com o `JWT_SECRET`, o atacante **forja tokens de login válidos** para qualquer usuário e entra na conta de qualquer pessoa sem senha.
- **Correção:** adicionar `.env` ao `.gitignore` **antes** do primeiro commit. Versionar apenas um `.env.example` com chaves vazias (`JWT_SECRET=`). Se um segredo já foi commitado, trocar todos os segredos e limpar o histórico. O `.gitignore` correto está no fim deste arquivo.

---

## 3. Controle de acesso quebrado / IDOR (busca de tarefa por ID sem checar o dono)

- **Arquivo / linha:** `server/index.js:82` (rota `GET /api/tasks/:id`)
  ```js
  app.get("/api/tasks/:id", auth, (req, res) => {
    const rows = query(
      `SELECT id, user_id, title, notes, done, created_at FROM tasks WHERE id = ${Number(req.params.id)}`
    );
    ...
    res.json(rows[0]);   // devolve a tarefa sem comparar user_id com req.user.id
  });
  ```
- **O que um atacante consegue:** estando logado na própria conta, ele troca o ID na URL (`/api/tasks/1`, `/2`, `/3`...) e lê tarefas de **outros usuários**, incluindo os detalhes/anotações privadas. É a falha de **Broken Object Level Authorization (IDOR)**.
- **Observação:** repare que as rotas `PATCH` e `DELETE` (linhas 109 e 124) **fazem** a checagem `rows[0].user_id !== req.user.id`. A rota `GET /:id` é a única que esqueceu — exatamente o tipo de inconsistência real que aparece em código de verdade.
- **Correção:** filtrar sempre pelo dono. Ou incluir na query `WHERE id = ? AND user_id = ?` (com o `req.user.id`), ou buscar e comparar `if (rows[0].user_id !== req.user.id) return res.status(404)...`. Retornar 404 (e não 403) evita confirmar que o recurso existe.

---

## 4. SQL Injection (query montada por concatenação de string)

Plantada em **três** pontos que concatenam entrada do usuário direto na SQL:

- **Arquivo / linha:** `server/index.js:56` — login (o mais grave):
  ```js
  const rows = query(
    `SELECT id, name, email FROM users WHERE email = '${email}' AND password = '${password}'`
  );
  ```
- **Arquivo / linha:** `server/index.js:75` — busca de tarefas (`?q=`):
  ```js
  sql += ` AND (title LIKE '%${search}%' OR notes LIKE '%${search}%')`;
  ```
- **O que um atacante consegue:**
  - No login, enviar uma senha como `' OR '1'='1` faz a condição virar sempre verdadeira → **entra sem saber a senha**.
  - Na busca, usar `UNION SELECT ...` permite **extrair outras tabelas** (por exemplo, e-mails e senhas de todos os usuários — que aqui estão em texto puro, veja falha 7).
- **Correção:** **nunca** concatenar entrada na SQL. Usar sempre **queries parametrizadas** (placeholders `?` com os valores separados), como já é feito nos `execute(...)` deste projeto. Ex.: `db.prepare("SELECT ... WHERE email = ? AND password = ?").get(email, senhaHash)`.

---

## 5. CORS liberado para qualquer origem (`*`)

- **Arquivo / linha:** `server/index.js:12`
  ```js
  app.use(cors({ origin: "*" }));
  ```
- **O que um atacante consegue:** qualquer site na internet pode fazer requisições à sua API pelo navegador da vítima. Combinado com tokens mal guardados, isso amplia ataques de roubo de dados a partir de páginas maliciosas. Aceitar `*` desliga a proteção que o navegador daria.
- **Correção:** permitir apenas as origens conhecidas: `cors({ origin: "http://localhost:5173", credentials: true })` (e a URL real do site em produção). Nada de `*` em API autenticada.

---

## 6. Validação só no front-end, nenhuma no back-end

- **Onde está a validação (só no front):** `client/src/App.jsx` — função `validate()` (nome, formato de e-mail, senha ≥ 8), e checagens de título da tarefa (não vazio, ≤ 80 caracteres).
- **Onde falta (back-end):** `server/index.js` — as rotas `POST /api/register` (linha ~33), `POST /api/login` (linha ~54) e `POST /api/tasks` (linha ~96) usam `req.body` **direto**, sem verificar se os campos existem, o tipo, o tamanho ou o formato.
- **O que um atacante consegue:** validação no navegador é só conforto visual — ela **não protege nada**. Qualquer um ignora o front e chama a API direto (curl, Postman) enviando e-mail inválido, senha vazia, título gigante, tipos errados (ex.: `title` como objeto), causando dados sujos, erros ou travamentos.
- **Correção:** validar **sempre no back-end** (a validação do front continua, mas só pela experiência do usuário). Checar presença, tipo e limites de cada campo antes de usar; rejeitar com 400 quando inválido. Bibliotecas como `zod` ou `express-validator` ajudam.

---

## 7. Senhas guardadas em texto puro (sem hash)

- **Arquivo / linha:**
  - Cadastro grava a senha como veio: `server/index.js:41` (`INSERT INTO users ... password`).
  - Reset regrava em texto puro: bloco `POST /api/password/reset` (linha ~166).
  - Seed de exemplo também em texto puro: `server/db.js` (função `seed`).
- **O que um atacante consegue:** se alguém acessar o banco (via SQL Injection da falha 4, backup vazado, etc.), lê **todas as senhas diretamente**. Como as pessoas reusam senhas, isso vaza também o acesso delas a outros serviços.
- **Correção:** guardar apenas o **hash** da senha, com um algoritmo próprio para isso (`bcrypt`, `argon2` ou `scrypt`). No cadastro: `hash = await bcrypt.hash(senha, 12)`. No login: buscar o usuário pelo e-mail (parametrizado) e comparar com `await bcrypt.compare(senha, hashSalvo)`. Nunca dá para "descriptografar" — só comparar.

---

## 8. Endpoint de recuperação de senha expõe o token na resposta

- **Arquivo / linha:** `server/index.js` — rota `POST /api/password/forgot`, na resposta (linha ~158–162):
  ```js
  res.json({
    message: "Enviamos um link de recuperação para o seu e-mail",
    resetToken,      // <- o token de reset volta no corpo da resposta
    expiresAt: expires,
  });
  ```
- **O que um atacante consegue:** o token de reset deveria chegar **só no e-mail do dono** da conta. Aqui ele volta na resposta HTTP. Como o endpoint não exige login, um atacante pede "esqueci minha senha" do e-mail da vítima, recebe o token na hora e chama `POST /api/password/reset` para **trocar a senha e tomar a conta**.
  - Piora: a resposta também confirma quais e-mails existem (retorna 404 para e-mail inexistente) — isso é **enumeração de usuários**.
- **Correção:** o token **nunca** aparece na resposta; ele é enviado por um canal fora da API (e-mail, com um link contendo o token). A resposta deve ser sempre genérica ("se este e-mail existir, enviaremos um link"), **igual** para e-mail existente ou não, para não vazar quem tem conta. Guardar no banco só o **hash** do token e dar validade curta.

---

## Resumo rápido (checklist)

| # | Falha | Arquivo principal | Linha |
|---|-------|-------------------|-------|
| 1 | Chave de API secreta no front-end | `client/src/config.js` | 3 |
| 2 | `.env` com segredos versionado | `server/.env` + `.gitignore` | 6, 9 |
| 3 | IDOR / controle de acesso quebrado | `server/index.js` | 82 |
| 4 | SQL Injection (concatenação) | `server/index.js` | 56, 75 |
| 5 | CORS aberto (`*`) | `server/index.js` | 12 |
| 6 | Validação só no front-end | `client/src/App.jsx` + `server/index.js` | — |
| 7 | Senha em texto puro | `server/index.js` / `server/db.js` | 41 |
| 8 | Token de reset vazado na resposta | `server/index.js` | ~160 |

---

## `.gitignore` correto (como deveria ter sido)

> Copie isto para o `.gitignore` da raiz num projeto real. Repare na linha do `.env`,
> que é justamente a que está faltando de propósito no app-alvo.

```gitignore
# Dependências
node_modules/

# Build / saída
dist/
build/
client/dist/

# Segredos e variáveis de ambiente  <-- ESTA linha é a que evita a falha 2
.env
.env.*
!.env.example

# Logs
*.log
npm-debug.log*

# Banco de dados local
*.sqlite
*.sqlite3
*.db

# Sistema operacional / editor
.DS_Store
Thumbs.db
.vscode/
.idea/
```
