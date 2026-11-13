# ✝ Papelaria Cristã

Loja virtual da **Papelaria Cristã**: Bíblias, devocionais, livros cristãos, kits de presente e papelaria.
Tem catálogo com busca e filtros, carrinho, finalização do pedido pelo WhatsApp, painel administrativo
com cadastro de produtos, controle de estoque e gestão de pedidos, além de testes automatizados.

---

## Como executar

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

### HTTPS no seu computador

A loja já inicia em **HTTPS**. Na primeira execução é criado um certificado em `data/certs/`.
Como ele é gerado no seu próprio PC (autoassinado), o navegador mostra um aviso **uma vez**:
clique em **Avançado › Continuar para localhost**. A conexão fica criptografada normalmente.

**Para tirar o aviso (cadeado sem alerta)**, use o [mkcert](https://github.com/FiloSottile/mkcert):

```bash
# Windows (PowerShell):  winget install FiloSottile.mkcert
# Mac:                   brew install mkcert
mkcert -install
mkcert -cert-file data/certs/cert.pem -key-file data/certs/key.pem localhost 127.0.0.1 ::1
python run.py
```

Para rodar sem HTTPS: `python run.py --http`.

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
├── frontend/                 # site (HTML, CSS e JavaScript puros)
│   ├── index.html  produtos.html  ofertas.html  produto.html
│   ├── carrinho.html  sobre.html  contato.html  admin.html  404.html
│   ├── css/style.css         # identidade visual completa
│   ├── js/core/              # api.js, cart.js, layout.js, utils.js (reutilizáveis)
│   ├── js/pages/             # um script por página
│   └── img/                  # fotos dos produtos, ícones, uploads
├── tests/
│   ├── test_api.py           # 36 testes da API
│   └── test_e2e.py           # 27 testes no navegador (fluxos, telas de PC e celular, HTTPS)
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
pytest            # roda os 63 testes (API + navegador)
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
