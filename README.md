# ✝ Papelaria Cristã

Loja virtual da **Papelaria Cristã**: Bíblias, devocionais, livros cristãos, kits de presente e papelaria.
Tem catálogo com busca e filtros, carrinho, finalização do pedido pelo WhatsApp, painel administrativo
com cadastro de produtos, controle de estoque e gestão de pedidos, além de testes automatizados.

### 🛍️ [Abrir a loja online](https://claude.ai/artifact/4aKjvzkKf3WkgVA83wCUmy)

Link com HTTPS válido: abre no PC e no celular sem o aviso "Sua conexão não é particular".

<p align="center">
  <img src="docs/imagens/loja-pc.jpg" alt="Loja no computador" width="68%">
  <img src="docs/imagens/loja-celular.jpg" alt="Loja no celular" width="26%">
</p>
<p align="center"><img src="docs/imagens/animacoes.gif" alt="Animações: adicionar ao carrinho, favoritar e confete ao concluir o pedido" width="80%"></p>

---

## ⭐ A loja em um único arquivo: `frontend/index.html`

A loja inteira (visual, funcionalidades, catálogo e as 8 fotos) está **dentro de um só arquivo**.

- **Sem instalar nada:** dê dois cliques em `frontend/index.html`. Abre no PC e no celular (envie o arquivo
  para o celular e abra no navegador). O carrinho e os favoritos ficam salvos no aparelho, e o pedido sai
  pronto para o WhatsApp.
  Para isso, preencha o WhatsApp da loja no início do script do arquivo (procure por
  `CONFIGURACAO_LOJA`). Sem WhatsApp configurado, o cliente pode **copiar o resumo do pedido**.
- **Com o servidor Python** (`python run.py`), o mesmo arquivo passa a usar automaticamente os produtos,
  estoques e contatos do **painel administrativo** e registra os pedidos no banco.
- **Para hospedar:** o `index.html` funciona em qualquer hospedagem de site estático com HTTPS
  (Netlify, Vercel, GitHub Pages, Hostinger...). O painel administrativo precisa do servidor Python.

**O que tem na loja:** banner em carrossel (arrasta com o dedo), vitrine com abas, categorias, busca com
sugestões enquanto digita (atalho `/`), filtros por categoria, preço, ofertas, disponibilidade e favoritos,
ordenação, página de produto com zoom na foto, "espiar" produto sem sair da página, favoritos, gaveta do
carrinho com desfazer, produtos vistos recentemente, checkout em 5 etapas (dados, retirada ou entrega com
CEP automático, pagamento preferido, presente com mensagem do cartão, observações), barra de atalhos no
celular e versículo do dia.

**Animações:** produto voando até o carrinho, corações ao favoritar, ondulação nos botões, pétalas
caindo e texto entrando no banner, profundidade nas fotos ao mover o mouse, barra de progresso da página,
total do carrinho contando, ✓ desenhado e confete de pétalas ao concluir o pedido, itens entrando em
sequência e esqueleto de carregamento. Tudo é desligado automaticamente para quem configurou o aparelho
para reduzir movimento.

**Para editar o visual ou o código da loja**, altere `frontend/loja/` (`loja.css`, `loja.js`,
`index.template.html`) e gere o arquivo de novo:

```bash
python tools/build_loja.py
```

---

## Como executar o servidor (painel administrativo)

Pré-requisito: **Python 3.10+** ([python.org/downloads](https://www.python.org/downloads/) — no Windows,
marque **“Add python.exe to PATH”** durante a instalação).

### Jeito mais fácil (Windows)

Dê **dois cliques em `iniciar-windows.bat`**. Ele instala o que falta (só na primeira vez), inicia a loja
e abre o navegador em **https://localhost:5000**. **Deixe a janela preta aberta** enquanto usa a loja.

- Para abrir também **no celular** (mesmo Wi-Fi): use `iniciar-celular-windows.bat` e digite no celular
  o endereço que aparece em “No celular”. Se o Windows perguntar sobre o Firewall, clique em **Permitir**.
- Linux/Mac: `./iniciar.sh` (ou `./iniciar.sh --rede`).

### Pelo terminal

```bash
cd papelaria-crista
python -m venv .venv
# Windows:  .venv\Scripts\activate     Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
python run.py            # opções: --rede  --http  --sem-navegador
```

### “localhost recusou a conexão”? Confira:

| Situação | Solução |
|---|---|
| A janela do servidor foi fechada ou mostrou erro | Rode `iniciar-windows.bat` de novo e **mantenha a janela aberta**. Se aparecer “NÃO FOI POSSÍVEL INICIAR”, a mensagem diz o motivo |
| Abriu `localhost` **no celular** | No celular, `localhost` é o próprio celular. Use `iniciar-celular-windows.bat` e o endereço `https://192.168...` mostrado na janela |
| A porta 5000 estava ocupada | A loja usa a próxima porta livre (5001, 5002...). Use o endereço mostrado na janela |
| Digitou `http://` em vez de `https://` | Use `https://localhost:5000` |
| Python não instalado | Instale pelo link acima, marcando “Add python.exe to PATH” |

### Primeiro acesso ao painel

Na primeira execução, o terminal mostra uma **senha gerada** para o painel:

```
==============================================================
  Senha do painel administrativo gerada: Xy7...
==============================================================
```

Acesse **https://localhost:5000/admin.html** com ela. Para definir a sua própria senha:

```bash
python -m backend.manage senha
```

### HTTPS no seu computador (sem o aviso "Sua conexão não é particular")

A loja abre em **https://localhost:5000** com o **cadeado normal**. Na primeira execução ela cria um
certificado próprio e o registra no sistema, do mesmo jeito que a ferramenta mkcert:

- **Windows:** aparece uma janela perguntando se deseja instalar o certificado da "Papelaria Crista".
  Clique em **Sim**. Se o Chrome já estava aberto, feche e abra de novo uma vez.
- **macOS:** o sistema pede a sua senha uma vez.
- **Linux:** usa o `certutil` (pacote `libnss3-tools`) para o Chrome.

É seguro: a autoridade criada só consegue assinar endereços **deste computador e da rede de casa**
(localhost, 127.x, 192.168.x, 10.x...). Ela não pode imitar nenhum site da internet, mesmo que alguém
copie os arquivos.

- Para instalar de novo: `python -m backend.manage certificado`
- Para rodar sem HTTPS: `python run.py --http`
- **No celular** (modo `--rede`) o aviso continua, porque o certificado é do seu PC. Para os clientes
  abrirem em qualquer aparelho **sem aviso nenhum**, publique no GitHub Pages (abaixo).

### Loja na internet com HTTPS de verdade (GitHub Pages, grátis)

```bash
python tools/publicar_site.py
```

Na **primeira vez**, ative no GitHub: **Settings › Pages › Build and deployment › Source: "Deploy from a
branch" › Branch: `gh-pages` / `(root)` › Save**. Em 1 a 2 minutos a loja fica em
`https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`, com certificado válido. Sempre que mudar a loja,
rode o comando de novo. (Lembre de preencher o WhatsApp em `CONFIGURACAO_LOJA`, em `frontend/loja/loja.js`,
antes de publicar: no GitHub Pages não há painel administrativo.)

### Antes de publicar (checklist)

1. **Admin › Configurações**: preencha o WhatsApp da loja (formato `5511987654321`), telefone,
   endereço, horário e redes sociais. Enquanto o WhatsApp não for preenchido, o botão de enviar
   pedido pelo WhatsApp não aparece (o pedido fica registrado no painel do mesmo jeito).
2. **Admin › Produtos**: confira **preços e estoques**. Os 8 produtos iniciais (das fotos enviadas)
   foram cadastrados com **valores de referência** (estoque inicial de 5 unidades cada).
3. Troque a senha do painel (`python -m backend.manage senha`).

---

## Estrutura de pastas

```
papelaria-crista/
├── iniciar-windows.bat       # inicia com dois cliques (Windows)
├── iniciar-celular-windows.bat # idem, acessível pelo celular no Wi-Fi
├── iniciar.sh                # inicia no Linux/Mac
├── run.py                    # inicia o servidor (porta livre, HTTPS, abre o navegador)
├── requirements.txt          # dependências (Flask + cryptography para HTTPS)
├── requirements-dev.txt      # + pytest e playwright (testes)
├── backend/                  # Python: API REST + regras de negócio
│   ├── app.py                # rotas, segurança, arquivos estáticos
│   ├── services.py           # regras: catálogo, pedidos, estoque, configurações
│   ├── auth.py               # senha (PBKDF2), sessões, limite de tentativas
│   ├── validators.py         # validações do servidor
│   ├── db.py                 # conexão SQLite, criação e backup
│   ├── schema.sql            # estrutura do banco
│   ├── seed_data.py          # categorias e produtos iniciais
│   └── manage.py             # comandos: senha, backup, reset
├── frontend/
│   ├── index.html            # ⭐ A LOJA INTEIRA EM UM ARQUIVO (gerado)
│   ├── loja/                 # código-fonte da loja: loja.css, loja.js, index.template.html
│   ├── admin.html  404.html  # painel administrativo e página de erro
│   ├── css/style.css         # visual do painel
│   ├── js/core/  js/pages/   # scripts do painel
│   └── img/                  # fotos dos produtos, ícones, uploads
├── tools/build_loja.py       # gera o frontend/index.html
├── tools/publicar_site.py    # publica a loja no GitHub Pages (HTTPS)
├── tests/
│   ├── test_api.py           # 41 testes da API e do certificado
│   └── test_e2e.py           # 31 testes no navegador (loja, painel, animações, PC, celular, HTTPS)
├── docs/
│   ├── API.md                # documentação dos endpoints
│   ├── RELATORIO_TESTES.md   # relatório dos testes e correções
│   └── EQUIPE.md             # responsabilidades por agente e revisões
└── data/                     # banco de dados (criado automaticamente)
```

## Funcionalidades

| Loja | Painel administrativo |
|---|---|
| Página inicial com banner, promoções e destaques | Login com senha e sessão expirável |
| Catálogo com busca (ignora acentos) | Cadastrar, editar, ocultar e excluir produtos |
| Filtros por categoria, preço, ofertas e disponibilidade | Upload de fotos (JPG/PNG/WEBP, até 5 MB) |
| Ordenação por preço, nome e novidades | Ajuste de estoque com motivo e histórico |
| Página de cada produto (com dados estruturados para o Google) | Pedidos: confirmar (baixa estoque), enviar, concluir, cancelar (devolve estoque) |
| Carrinho: adicionar, +/−, remover, total automático | Configurações de contato e redes sociais |
| Finalização com validação e envio pelo WhatsApp | Visão geral: pendências, estoque baixo, vendas |
| Página de contato e Sobre nós | |

## Decisões técnicas

- **Layout para PC e celular**: o layout de computador vale de 760 px para cima, então notebooks com
  zoom de 125%/150% do Windows continuam com a versão de PC. Abaixo disso, menu e filtros viram versão de celular.
- **Flask + SQLite**: uma dependência só, banco em arquivo, nada para instalar além do Python.
  Para crescer, o SQL é padrão e migra para PostgreSQL sem grandes mudanças.
- **HTML/CSS/JS puros (módulos ES)**: o site carrega rápido e não precisa de etapa de build.
  Cabeçalho, rodapé e cartão de produto ficam num único arquivo (`js/core/layout.js`) para não repetir código.
- **O preço vem sempre do servidor**: o total do pedido é recalculado na API, então mexer no navegador não altera o valor.
- **Estoque baixa na confirmação do pedido** (não no clique do cliente), para pedidos não pagos não “prenderem” produtos.
- **Pagamento combinado pelo WhatsApp**: integrar um gateway (Mercado Pago, PagSeguro, Stripe) exige conta
  e chaves da loja; a estrutura de pedidos já está pronta para receber essa integração.

## Segurança

Senha com hash PBKDF2-SHA256, token de sessão guardado só como hash, limite de 5 tentativas de login
a cada 15 min, validação de todos os dados no servidor, SQL parametrizado, escape de HTML no front-end
(proteção contra XSS), Content-Security-Policy e outros cabeçalhos, upload verificado pelo conteúdo do arquivo,
proteção contra acesso a arquivos fora da pasta do site e limite de pedidos por IP.

## Testes

```bash
pip install -r requirements-dev.txt
playwright install chromium
pytest            # roda os 72 testes (API + navegador)
pytest tests/test_api.py   # só a API (não precisa de navegador)
```

## Manutenção

```bash
python -m backend.manage backup   # cópia do banco em data/backups/
python -m backend.manage reset    # recria o banco com os dados iniciais (pede confirmação)
```

## Publicação

O HTTPS do `run.py` é para uso no seu computador. Para colocar no ar, use um servidor WSGI (ex.: `pip install waitress` e
`waitress-serve --port=8000 run:app`) atrás de HTTPS. Faça backups periódicos da pasta `data/`.
As fontes (Cormorant Garamond e Nunito) vêm do Google Fonts; sem internet, o site usa fontes de reserva.
